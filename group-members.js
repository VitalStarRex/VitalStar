// ============================================================
// VITALSTAR — group-members.js
// Members tab controller for group.html
// ============================================================

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ============================================================
// STATE
// ============================================================

let ctx = null;

const state = {
  members: [],
  filtered: [],
  search: '',
  loading: false
};


// ============================================================
// INIT
// ============================================================

export async function init(context) {

  ctx = context;

  if (!ctx || !ctx.panelEl) {
    console.error('group-members.js: Missing context.');
    return;
  }

  renderShell();

  bindEvents();

  await loadMembers();
}


// ============================================================
// DOM
// ============================================================

function renderShell() {

  ctx.panelEl.innerHTML = `
    <div class="members-module">

      <div class="members-head">

        <div>
          <h2 class="members-title">
            <i class="fa-solid fa-users"></i>
            Group Members
          </h2>

          <p class="members-subtitle">
            <span id="gmMemberCount">0</span> members
          </p>
        </div>

        <button
          type="button"
          class="gm-refresh-btn"
          id="gmRefreshBtn"
          aria-label="Refresh members"
        >
          <i class="fa-solid fa-rotate"></i>
        </button>

      </div>


      <div class="gm-search-wrap">

        <i class="fa-solid fa-magnifying-glass"></i>

        <input
          type="search"
          id="gmSearch"
          class="gm-search"
          placeholder="Search members..."
          autocomplete="off"
        >

        <button
          type="button"
          id="gmClearSearch"
          class="gm-clear-search"
          aria-label="Clear search"
          style="display:none;"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

      </div>


      <div
        id="gmList"
        class="gm-list"
      >
        <div class="gm-loading">
          <span class="gm-spinner"></span>
          Loading members...
        </div>
      </div>

    </div>


    <style>

      .members-module {
        width: 100%;
      }


      .members-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 18px;
      }


      .members-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 9px;
        color: var(--text-primary);
      }


      .members-title i {
        color: var(--electric-blue-bright);
      }


      .members-subtitle {
        margin: 5px 0 0;
        color: var(--text-muted);
        font-size: 12.5px;
      }


      .gm-refresh-btn {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-subtle);
        background: var(--bg-surface-raised);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: .2s;
      }


      .gm-refresh-btn:hover {
        color: var(--text-primary);
        border-color: var(--electric-blue);
      }


      .gm-refresh-btn.is-loading i {
        animation: gm-spin .7s linear infinite;
      }


      .gm-search-wrap {
        position: relative;
        margin-bottom: 18px;
      }


      .gm-search-wrap > i {
        position: absolute;
        left: 15px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        font-size: 13px;
        pointer-events: none;
      }


      .gm-search {
        width: 100%;
        height: 46px;
        padding: 0 42px 0 42px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        outline: none;
        background: var(--bg-surface);
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: 13.5px;
        transition: .2s;
      }


      .gm-search:focus {
        border-color: var(--electric-blue);
        box-shadow: 0 0 0 3px rgba(47,111,255,.10);
      }


      .gm-clear-search {
        position: absolute;
        right: 9px;
        top: 50%;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--text-muted);
      }


      .gm-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }


      .gm-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        transition: .2s;
        animation: gm-rise .3s var(--ease-out);
      }


      .gm-card:hover {
        border-color: var(--border-strong);
        background: var(--bg-surface-raised);
      }


      .gm-avatar-wrap {
        position: relative;
        flex-shrink: 0;
      }


      .gm-avatar {
        width: 48px;
        height: 48px;
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            var(--electric-blue),
            var(--violet-accent)
          );
        background-size: cover;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 16px;
      }


      .gm-online {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--success);
        border: 3px solid var(--bg-surface);
        display: none;
      }


      .gm-online.is-online {
        display: block;
      }


      .gm-info {
        min-width: 0;
        flex: 1;
      }


      .gm-name-row {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
      }


      .gm-name {
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }


      .gm-username {
        margin-top: 3px;
        color: var(--text-muted);
        font-size: 11.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }


      .gm-role {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 7px;
        border-radius: var(--radius-full);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .03em;
      }


      .gm-role.owner {
        color: var(--gold-accent);
        background: rgba(255,194,75,.12);
      }


      .gm-role.admin {
        color: var(--electric-blue-bright);
        background: rgba(47,111,255,.12);
      }


      .gm-role.moderator {
        color: var(--violet-accent);
        background: rgba(139,92,255,.12);
      }


      .gm-role.member {
        color: var(--text-muted);
        background: rgba(255,255,255,.05);
      }


      .gm-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
      }


      .gm-action {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid var(--border-subtle);
        background: var(--bg-surface-raised);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: .2s;
      }


      .gm-action:hover {
        color: var(--text-primary);
        border-color: var(--border-strong);
      }


      .gm-action.danger:hover {
        color: var(--danger);
        border-color: rgba(255,92,122,.4);
      }


      .gm-action.blue:hover {
        color: var(--electric-blue-bright);
        border-color: rgba(47,111,255,.4);
      }


      .gm-loading,
      .gm-empty,
      .gm-error {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 9px;
        color: var(--text-muted);
        font-size: 13px;
        padding: 30px;
      }


      .gm-empty i,
      .gm-error i {
        font-size: 28px;
        opacity: .7;
      }


      .gm-error i {
        color: var(--danger);
      }


      .gm-spinner {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid rgba(91,157,255,.2);
        border-top-color: var(--electric-blue-bright);
        animation: gm-spin .7s linear infinite;
      }


      .gm-loading-more {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        padding: 12px;
      }


      @keyframes gm-spin {
        to {
          transform: rotate(360deg);
        }
      }


      @keyframes gm-rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }


      @media (max-width: 520px) {

        .gm-card {
          padding: 10px;
        }

        .gm-avatar {
          width: 44px;
          height: 44px;
          border-radius: 13px;
        }

        .gm-actions {
          gap: 3px;
        }

        .gm-action {
          width: 31px;
          height: 31px;
          font-size: 11px;
        }

      }

    </style>
  `;

}


// ============================================================
// EVENTS
// ============================================================

function bindEvents() {

  const search =
    document.getElementById('gmSearch');

  const clear =
    document.getElementById('gmClearSearch');

  const refresh =
    document.getElementById('gmRefreshBtn');


  if (search) {

    search.addEventListener(
      'input',
      () => {

        state.search =
          search.value.trim().toLowerCase();

        if (clear) {
          clear.style.display =
            state.search
              ? 'flex'
              : 'none';
        }

        filterMembers();

      }
    );

  }


  if (clear) {

    clear.addEventListener(
      'click',
      () => {

        if (search) {
          search.value = '';
        }

        state.search = '';

        clear.style.display = 'none';

        filterMembers();

        search?.focus();

      }
    );

  }


  if (refresh) {

    refresh.addEventListener(
      'click',
      async () => {

        refresh.classList.add('is-loading');

        await loadMembers();

        refresh.classList.remove('is-loading');

      }
    );

  }

}


// ============================================================
// LOAD MEMBERS
// ============================================================

async function loadMembers() {

  if (state.loading) return;

  state.loading = true;

  const list =
    document.getElementById('gmList');

  if (!list) {
    state.loading = false;
    return;
  }


  try {

    list.innerHTML = `
      <div class="gm-loading">
        <span class="gm-spinner"></span>
        Loading members...
      </div>
    `;


    const membersRef =
      collection(
        ctx.db,
        'groups',
        ctx.groupId,
        'members'
      );


    const membersQuery =
      query(
        membersRef,
        where(
          'status',
          '==',
          'active'
        )
      );


    const snapshot =
      await getDocs(membersQuery);


    state.members =
      snapshot.docs.map(
        memberDoc => ({
          id: memberDoc.id,
          ...memberDoc.data()
        })
      );


    sortMembers();

    filterMembers();

    updateCount();


  } catch (error) {

    console.error(
      'group-members.js: Failed to load members:',
      error
    );


    list.innerHTML = `
      <div class="gm-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <strong>Unable to load members</strong>
        <span>Please try again.</span>
      </div>
    `;


    ctx.showToast?.(
      'Could not load group members.',
      'error'
    );

  } finally {

    state.loading = false;

  }

}


// ============================================================
// SORT
// ============================================================

function sortMembers() {

  const priority = {
    owner: 0,
    admin: 1,
    moderator: 2,
    member: 3
  };


  state.members.sort(
    (a, b) => {

      const roleA =
        priority[a.role] ?? 9;

      const roleB =
        priority[b.role] ?? 9;


      if (roleA !== roleB) {
        return roleA - roleB;
      }


      return (
        getMemberName(a).localeCompare(
          getMemberName(b)
        )
      );

    }
  );

}


// ============================================================
// SEARCH
// ============================================================

function filterMembers() {

  const search =
    state.search;


  if (!search) {

    state.filtered =
      [...state.members];

  } else {

    state.filtered =
      state.members.filter(
        member => {

          const name =
            getMemberName(member)
              .toLowerCase();

          const username =
            String(
              member.username ||
              ''
            ).toLowerCase();

          return (
            name.includes(search) ||
            username.includes(search)
          );

        }
      );

  }


  renderMembers();

}


// ============================================================
// COUNT
// ============================================================

function updateCount() {

  const countEl =
    document.getElementById(
      'gmMemberCount'
    );


  if (countEl) {

    countEl.textContent =
      ctx.formatCount
        ? ctx.formatCount(
            state.members.length
          )
        : state.members.length;

  }

}


// ============================================================
// RENDER MEMBERS
// ============================================================

function renderMembers() {

  const list =
    document.getElementById('gmList');

  if (!list) return;


  if (!state.filtered.length) {

    list.innerHTML = `
      <div class="gm-empty">

        <i class="fa-solid fa-user-group"></i>

        <strong>
          ${
            state.search
              ? 'No members found'
              : 'No members yet'
          }
        </strong>

        <span>
          ${
            state.search
              ? 'Try another search.'
              : 'This group has no active members.'
          }
        </span>

      </div>
    `;

    return;

  }


  list.innerHTML = '';


  state.filtered.forEach(
    (member, index) => {

      list.appendChild(
        createMemberCard(
          member,
          index
        )
      );

    }
  );

}


// ============================================================
// MEMBER CARD
// ============================================================

function createMemberCard(member, index) {

  const card =
    document.createElement('article');

  card.className =
    'gm-card';

  card.style.animationDelay =
    `${Math.min(index * 25, 250)}ms`;


  // ----------------------------------------------------------
  // AVATAR
  // ----------------------------------------------------------

  const avatarWrap =
    document.createElement('div');

  avatarWrap.className =
    'gm-avatar-wrap';


  const avatar =
    document.createElement('div');

  avatar.className =
    'gm-avatar';


  const name =
    getMemberName(member);


  if (member.photoURL) {

    avatar.style.backgroundImage =
      `url("${escapeCssUrl(member.photoURL)}")`;

    avatar.textContent = '';

  } else {

    avatar.textContent =
      ctx.initialsFrom
        ? ctx.initialsFrom(name)
        : name.charAt(0).toUpperCase();

  }


  const online =
    document.createElement('span');

  online.className =
    'gm-online';


  if (isOnline(member)) {

    online.classList.add(
      'is-online'
    );

  }


  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(online);


  // ----------------------------------------------------------
  // INFO
  // ----------------------------------------------------------

  const info =
    document.createElement('div');

  info.className =
    'gm-info';


  const nameRow =
    document.createElement('div');

  nameRow.className =
    'gm-name-row';


  const nameEl =
    document.createElement('div');

  nameEl.className =
    'gm-name';

  nameEl.textContent =
    name;


  const role =
    normalizeRole(
      member.role
    );


  const roleBadge =
    document.createElement('span');

  roleBadge.className =
    `gm-role ${role}`;


  const roleIcons = {
    owner: 'fa-crown',
    admin: 'fa-shield-halved',
    moderator: 'fa-user-shield',
    member: 'fa-user'
  };


  roleBadge.innerHTML =
    `<i class="fa-solid ${roleIcons[role] || roleIcons.member}"></i> ${capitalize(role)}`;


  nameRow.appendChild(nameEl);
  nameRow.appendChild(roleBadge);


  const username =
    document.createElement('div');

  username.className =
    'gm-username';


  if (member.username) {

    username.textContent =
      `@${String(member.username).replace(/^@/, '')}`;

  } else if (
    member.uid === ctx.currentUser?.uid
  ) {

    username.textContent =
      '@you';

  } else {

    username.textContent =
      'VitalStar member';

  }


  info.appendChild(nameRow);
  info.appendChild(username);


  // ----------------------------------------------------------
  // ACTIONS
  // ----------------------------------------------------------

  const actions =
    document.createElement('div');

  actions.className =
    'gm-actions';


  if (
    canManageMember(member)
  ) {

    // --------------------------------------------------------
    // PROMOTE / DEMOTE
    // --------------------------------------------------------

    if (
      role === 'member' ||
      role === 'moderator' ||
      role === 'admin'
    ) {

      const roleBtn =
        document.createElement('button');

      roleBtn.type =
        'button';

      roleBtn.className =
        'gm-action blue';

      roleBtn.title =
        role === 'admin'
          ? 'Demote to member'
          : 'Promote to admin';

      roleBtn.innerHTML =
        role === 'admin'
          ? '<i class="fa-solid fa-user-minus"></i>'
          : '<i class="fa-solid fa-shield-halved"></i>';


      roleBtn.addEventListener(
        'click',
        () => handleRoleChange(
          member
        )
      );


      actions.appendChild(
        roleBtn
      );

    }


    // --------------------------------------------------------
    // REMOVE
    // --------------------------------------------------------

    const removeBtn =
      document.createElement('button');

    removeBtn.type =
      'button';

    removeBtn.className =
      'gm-action danger';

    removeBtn.title =
      'Remove member';

    removeBtn.innerHTML =
      '<i class="fa-solid fa-user-xmark"></i>';


    removeBtn.addEventListener(
      'click',
      () => handleRemoveMember(
        member
      )
    );


    actions.appendChild(
      removeBtn
    );

  }


  card.appendChild(
    avatarWrap
  );

  card.appendChild(
    info
  );

  if (actions.children.length) {

    card.appendChild(
      actions
    );

  }


  return card;

}


// ============================================================
// PERMISSIONS
// ============================================================

function canManageMember(member) {

  const current =
    ctx.currentUser?.uid;


  if (!current) {
    return false;
  }


  // Never show management buttons
  // for yourself.
  if (
    member.uid === current ||
    member.id === current
  ) {

    return false;

  }


  // Nobody can manage the owner.
  if (
    normalizeRole(member.role) ===
    'owner'
  ) {

    return false;

  }


  // Owner can manage everybody except owner.
  if (
    typeof ctx.isCurrentUserOwner ===
      'function' &&
    ctx.isCurrentUserOwner()
  ) {

    return true;

  }


  // Admin can manage normal members
  // and moderators, but not other admins.
  if (
    typeof ctx.isCurrentUserAdmin ===
      'function' &&
    ctx.isCurrentUserAdmin()
  ) {

    return ![
      'admin',
      'owner'
    ].includes(
      normalizeRole(member.role)
    );

  }


  return false;

}


// ============================================================
// ROLE CHANGE
// ============================================================

async function handleRoleChange(member) {

  if (!canManageMember(member)) {

    ctx.showToast?.(
      'You do not have permission to manage this member.',
      'error'
    );

    return;

  }


  const currentRole =
    normalizeRole(member.role);


  let newRole;


  if (currentRole === 'admin') {

    newRole = 'member';

  } else {

    newRole = 'admin';

  }


  const memberName =
    getMemberName(member);


  const message =
    newRole === 'admin'
      ? `Promote ${memberName} to admin?`
      : `Demote ${memberName} to member?`;


  if (!window.confirm(message)) {
    return;
  }


  try {

    const memberRef =
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'members',
        member.uid || member.id
      );


    await updateDoc(
      memberRef,
      {
        role: newRole,
        roleUpdatedAt:
          serverTimestamp(),
        roleUpdatedBy:
          ctx.currentUser.uid
      }
    );


    const local =
      state.members.find(
        item =>
          item.uid === member.uid ||
          item.id === member.id
      );


    if (local) {

      local.role =
        newRole;

    }


    sortMembers();
    filterMembers();


    ctx.showToast?.(
      newRole === 'admin'
        ? `${memberName} is now an admin.`
        : `${memberName} is now a member.`,
      'success'
    );


  } catch (error) {

    console.error(
      'Role update failed:',
      error
    );


    ctx.showToast?.(
      'Could not update this member role.',
      'error'
    );

  }

}


// ============================================================
// REMOVE MEMBER
// ============================================================

async function handleRemoveMember(member) {

  if (!canManageMember(member)) {

    ctx.showToast?.(
      'You do not have permission to remove this member.',
      'error'
    );

    return;

  }


  const memberName =
    getMemberName(member);


  if (
    !window.confirm(
      `Remove ${memberName} from this group?`
    )
  ) {

    return;

  }


  try {

    const uid =
      member.uid || member.id;


    const memberRef =
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'members',
        uid
      );


    const memberSnap =
      await getDoc(memberRef);


    if (!memberSnap.exists()) {

      ctx.showToast?.(
        'This member is no longer in the group.',
        'info'
      );

      await loadMembers();

      return;

    }


    const memberData =
      memberSnap.data();


    // --------------------------------------------------------
    // OWNER PROTECTION
    // --------------------------------------------------------

    if (
      normalizeRole(
        memberData.role
      ) === 'owner'
    ) {

      ctx.showToast?.(
        'The group owner cannot be removed.',
        'error'
      );

      return;

    }


    // --------------------------------------------------------
    // ADMIN PROTECTION
    // --------------------------------------------------------
    // A normal admin cannot remove another admin.
    // The owner can.
    // --------------------------------------------------------

    if (
      normalizeRole(
        memberData.role
      ) === 'admin' &&
      !ctx.isCurrentUserOwner?.()
    ) {

      ctx.showToast?.(
        'Only the group owner can remove an admin.',
        'error'
      );

      return;

    }


    await deleteDoc(
      memberRef
    );


    // --------------------------------------------------------
    // UPDATE GROUP MEMBER COUNT
    // --------------------------------------------------------

    try {

      await updateDoc(
        ctx.groupRef,
        {
          memberCount:
            increment(-1)
        }
      );

    } catch (countError) {

      console.error(
        'Member count update failed:',
        countError
      );

    }


    state.members =
      state.members.filter(
        item =>
          item.uid !== uid &&
          item.id !== uid
      );


    sortMembers();
    filterMembers();
    updateCount();


    // Refresh group header stats.
    if (
      typeof ctx.refreshHeaderStats ===
      'function'
    ) {

      await ctx.refreshHeaderStats();

    }


    ctx.showToast?.(
      `${memberName} was removed from the group.`,
      'success'
    );


  } catch (error) {

    console.error(
      'Remove member failed:',
      error
    );


    ctx.showToast?.(
      'Could not remove this member.',
      'error'
    );

  }

}


// ============================================================
// HELPERS
// ============================================================

function getMemberName(member) {

  return (
    member.displayName ||
    member.fullName ||
    member.name ||
    'VitalStar Member'
  );

}


function normalizeRole(role) {

  const value =
    String(
      role || 'member'
    ).toLowerCase();


  if (
    [
      'owner',
      'admin',
      'moderator',
      'member'
    ].includes(value)
  ) {

    return value;

  }


  return 'member';

}


function capitalize(value) {

  return String(
    value || ''
  )
    .charAt(0)
    .toUpperCase() +
    String(
      value || ''
    ).slice(1);

}


// ============================================================
// ONLINE DETECTION
// ============================================================

function isOnline(member) {

  // Supports several possible presence
  // fields without breaking older
  // member documents.

  if (
    member.online === true ||
    member.isOnline === true
  ) {

    return true;

  }


  // If your member document stores
  // presence as a string.
  if (
    String(
      member.presence || ''
    ).toLowerCase() === 'online'
  ) {

    return true;

  }


  // Optional lastSeen support.
  // A member is considered online when
  // lastSeen is very recent.
  if (
    member.lastSeen &&
    typeof member.lastSeen.toDate ===
      'function'
  ) {

    const lastSeen =
      member.lastSeen.toDate().getTime();


    const difference =
      Date.now() - lastSeen;


    return (
      difference >= 0 &&
      difference <= 120000
    );

  }


  return false;

}


// ============================================================
// SAFE CSS URL
// ============================================================

function escapeCssUrl(url) {

  return String(url || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '')
    .replace(/\r/g, '');

}