// ============================================================
// VITALSTAR — group.js
// ============================================================

import { auth, db } from '../firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  increment,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TAB_LOADERS = {
  posts: () => import('./group-posts.js'),
  members: () => import('./group-members.js'),
  chat: () => import('./group-chat.js'),
  subscription: () => import('./group-subscription.js'),
  settings: () => import('./group-settings.js')
};

const loadedTabs = new Set();
let tabsBound = false;
let actionsBound = false;
let notificationsLoaded = false;

const $ = id => document.getElementById(id);

const navUserAvatar = $('navUserAvatar');
const navGroupTitle = $('navGroupTitle');
const pageLoader = $('pageLoader');
const notFound = $('groupNotFoundState');
const page = $('groupPageContent');

const cover = $('groupCover');
const coverEdit = $('coverEditBtn');
const avatar = $('groupAvatar');

const shareBtn = $('shareBtn');
const inviteBtn = $('inviteBtn');
const joinBtn = $('joinLeaveBtn');

const roleTag = $('yourRoleTag');
const roleText = $('yourRoleText');

const nameEl = $('groupName');
const privacy = $('groupPrivacyBadge');
const premium = $('groupPremiumBadge');
const verified = $('groupVerifiedBadge');
const category = $('groupCategoryChip');
const ownerText = $('groupOwnerText');
const createdText = $('groupCreatedText');
const description = $('groupDescription');

const memberCount = $('statMemberCount');
const postCount = $('statPostCount');
const onlineCount = $('statOnlineCount');
const level = $('statLevel');

const locked = $('lockedNotice');
const content = $('groupContentGrid');
const tabs = $('groupTabsNav');
const subscriptionTab = $('subscriptionTabBtn');
const settingsTab = $('settingsTabBtn');

const rulesList = $('rulesListDisplay');
const rulesEmpty = $('rulesEmptyDisplay');

const adminsList = $('adminsList');
const adminsEmpty = $('adminsEmptyDisplay');

const bell = $('notificationBellBtn');
const unreadDot = $('notifUnreadDot');
const notificationPanel = $('notificationsPanel');
const closeNotifications = $('closeNotificationsBtn');
const notificationList = $('notificationsList');

const toastBox = $('toast-container');

const categories = {
  technology: 'Technology',
  gaming: 'Gaming',
  programming: 'Programming',
  music: 'Music',
  'movies-tv': 'Movies & TV',
  anime: 'Anime',
  sports: 'Sports',
  education: 'Education',
  business: 'Business',
  entertainment: 'Entertainment',
  news: 'News',
  science: 'Science',
  fashion: 'Fashion',
  travel: 'Travel',
  politics: 'Politics',
  religion: 'Religion',
  general: 'General',
  other: 'Other'
};

const state = {
  user: null,
  id: new URLSearchParams(location.search).get('id'),
  group: null,
  membership: null,
  tab: 'posts'
};

function text(el, value) {
  if (el) el.textContent = value ?? '';
}

function display(el, value) {
  if (el) el.style.display = value;
}

function toast(message, type = 'info') {
  if (!toastBox) return console.log(`[${type}]`, message);

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;
  el.querySelector('span').textContent = message;

  toastBox.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 3500);
}

function count(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return String(n);
}

function initials(name = '') {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function media(el, url, fallback = '') {
  if (!el) return;

  if (url) {
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = fallback;
  }
}

function date(timestamp) {
  if (!timestamp?.toDate) return 'recently';

  return timestamp.toDate().toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric'
  });
}

function hideLoader() {
  pageLoader?.classList.add('is-hidden');
}

function showPage() {
  hideLoader();
  page?.classList.add('is-visible');
}

function showNotFound() {
  hideLoader();
  notFound?.classList.add('is-visible');
}

// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'login.html';
    return;
  }

  state.user = user;

  if (navUserAvatar) {
    media(navUserAvatar, user.photoURL, initials(user.displayName));
  }

  await loadGroup();
});

// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {
  if (!state.id) {
    showNotFound();
    return;
  }

  try {
    const groupRef = doc(db, 'groups', state.id);
    const memberRef = doc(db, 'groups', state.id, 'members', state.user.uid);

    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      showNotFound();
      return;
    }

    state.group = {
      id: groupSnap.id,
      ...groupSnap.data()
    };

    try {
      const memberSnap = await getDoc(memberRef);
      state.membership = memberSnap.exists()
        ? memberSnap.data()
        : null;
    } catch {
      state.membership = null;
    }

    /*
     * IMPORTANT OWNER FIX
     *
     * Some older groups may not have a working owner membership
     * document. The group's ownerId is therefore also trusted.
     */
    if (
      state.group.ownerId &&
      state.group.ownerId === state.user.uid
    ) {
      state.membership = {
        ...(state.membership || {}),
        uid: state.user.uid,
        role: 'owner',
        status: 'active'
      };
    }

    renderHeader();
    renderSidebar();
    applyAccess();
    setupTabs();
    bindActions();

    renderAdmins().catch(console.error);

    showPage();
  } catch (error) {
    console.error('Group load error:', error);
    showNotFound();
    toast('Unable to load this group.', 'error');
  } finally {
    hideLoader();
  }
}

// ============================================================
// HEADER
// ============================================================

function renderHeader() {
  const g = state.group;
  if (!g) return;

  document.title = `${g.name || 'Group'} · VitalStar`;
  text(navGroupTitle, g.name || 'VitalStar Group');

  if (cover) {
    cover.style.backgroundImage = g.coverURL
      ? `url("${g.coverURL}")`
      : '';
    cover.style.backgroundSize = 'cover';
    cover.style.backgroundPosition = 'center';
  }

  if (avatar) {
    media(avatar, g.avatarURL, initials(g.name));
  }

  text(nameEl, g.name || 'VitalStar Group');

  if (privacy) {
    const isPrivate = g.privacy === 'private';

    privacy.className = `badge badge--${isPrivate ? 'private' : 'public'}`;

    privacy.innerHTML = isPrivate
      ? '<i class="fa-solid fa-lock"></i> Private'
      : '<i class="fa-solid fa-globe"></i> Public';
  }

  display(premium, g.type === 'premium' ? 'inline-flex' : 'none');
  display(verified, g.verified ? 'inline-flex' : 'none');

  text(
    category,
    categories[g.category] || g.category || 'General'
  );

  text(
    ownerText,
    `Owned by ${g.ownerName || 'a member'}`
  );

  text(createdText, `Created ${date(g.createdAt)}`);
  text(description, g.description || '');

  text(memberCount, count(g.memberCount));
  text(postCount, count(g.postCount));
  text(onlineCount, count(g.onlineCount));
  text(level, g.level || 1);

  renderJoinState();

  const owner = isOwner();
  const admin = isAdmin();

  coverEdit?.classList.toggle('is-visible', owner || admin);
}

function isOwner() {
  return (
    state.group?.ownerId === state.user?.uid ||
    state.membership?.role === 'owner'
  );
}

function isAdmin() {
  return (
    state.membership?.role === 'admin' ||
    state.membership?.role === 'owner'
  );
}

function isActiveMember() {
  return state.membership?.status === 'active';
}

// ============================================================
// JOIN STATE
// ============================================================

function renderJoinState() {
  if (!joinBtn) return;

  if (isOwner()) {
    joinBtn.style.display = 'none';
    roleTag?.classList.add('is-visible');
    text(roleText, 'Owner');
    display(inviteBtn, 'inline-flex');
    return;
  }

  if (
    isActiveMember() &&
    ['member', 'admin', 'moderator'].includes(state.membership?.role)
  ) {
    joinBtn.style.display = 'flex';
    joinBtn.disabled = false;
    joinBtn.className = 'btn-join-leave is-member';
    joinBtn.innerHTML = '<i class="fa-solid fa-check"></i> Joined';

    roleTag?.classList.add('is-visible');
    text(
      roleText,
      state.membership.role.charAt(0).toUpperCase() +
      state.membership.role.slice(1)
    );

    display(inviteBtn, 'inline-flex');
    return;
  }

  if (state.membership?.status === 'pending') {
    joinBtn.style.display = 'flex';
    joinBtn.disabled = false;
    joinBtn.className = 'btn-join-leave is-pending';
    joinBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Requested';

    roleTag?.classList.remove('is-visible');
    display(inviteBtn, 'none');
    return;
  }

  joinBtn.style.display = 'flex';
  joinBtn.disabled = false;
  joinBtn.className = 'btn-join-leave';
  joinBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Join group';

  roleTag?.classList.remove('is-visible');
  display(inviteBtn, 'none');
}

// ============================================================
// SIDEBAR
// ============================================================

function renderSidebar() {
  if (!rulesList) return;

  const rules = Array.isArray(state.group.rules)
    ? state.group.rules
    : [];

  rulesList.innerHTML = '';

  display(rulesEmpty, rules.length ? 'none' : 'block');

  rules.forEach(rule => {
    const li = document.createElement('li');
    li.textContent = rule;
    rulesList.appendChild(li);
  });
}

// ============================================================
// ADMINS
// ============================================================

async function renderAdmins() {
  if (!adminsList) return;

  try {
    const q = query(
      collection(db, 'groups', state.id, 'members'),
      where('role', 'in', ['owner', 'admin', 'moderator']),
      limit(10)
    );

    const snap = await getDocs(q);

    adminsList
      .querySelectorAll('.admin-row')
      .forEach(el => el.remove());

    display(adminsEmpty, snap.empty ? 'block' : 'none');

    const priority = {
      owner: 0,
      admin: 1,
      moderator: 2
    };

    snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort(
        (a, b) =>
          (priority[a.role] ?? 3) -
          (priority[b.role] ?? 3)
      )
      .forEach(admin => {
        const row = document.createElement('div');
        row.className = 'admin-row';

        const av = document.createElement('div');
        av.className = 'admin-avatar';

        media(
          av,
          admin.photoURL,
          initials(admin.displayName)
        );

        const info = document.createElement('div');
        info.className = 'admin-info';

        const n = document.createElement('div');
        n.className = 'admin-name';
        n.textContent = admin.displayName || 'VitalStar Member';

        const r = document.createElement('div');
        r.className = 'admin-role';
        r.textContent = admin.role || 'member';

        info.append(n, r);
        row.append(av, info);
        adminsList.appendChild(row);
      });
  } catch (error) {
    console.error('Admin loading error:', error);
    display(adminsEmpty, 'block');
  }
}

// ============================================================
// ACCESS
// ============================================================

function applyAccess() {
  const g = state.group;
  if (!g) return;

  const active = isActiveMember();
  const canView = g.privacy === 'public' || active || isOwner();

  locked?.classList.toggle('is-visible', !canView);

  if (content) {
    content.style.display = canView ? 'grid' : 'none';
  }

  display(
    subscriptionTab,
    g.type === 'premium' ? 'flex' : 'none'
  );

  // OWNER FIX:
  // Settings now checks ownerId directly too.
  display(
    settingsTab,
    isOwner() || isAdmin() ? 'flex' : 'none'
  );

  if (canView) activateTab('posts');
}

// ============================================================
// TABS
// ============================================================

function setupTabs() {
  if (!tabs || tabsBound) return;

  tabsBound = true;

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('.group-tab');
    if (!btn?.dataset.tab) return;

    activateTab(btn.dataset.tab);
  });
}

function activateTab(tab) {
  if (!tab) return;

  state.tab = tab;

  tabs?.querySelectorAll('.group-tab').forEach(btn => {
    btn.classList.toggle(
      'is-active',
      btn.dataset.tab === tab
    );
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle(
      'is-active',
      panel.dataset.panel === tab
    );
  });

  loadTab(tab);
}

async function loadTab(tab) {
  if (loadedTabs.has(tab)) return;

  const loader = TAB_LOADERS[tab];
  if (!loader) return;

  const panel = $(`${tab}Tab`);

  try {
    const mod = await loader();

    loadedTabs.add(tab);

    if (typeof mod?.init === 'function') {
      await mod.init({
        db,
        auth,
        groupId: state.id,
        groupRef: doc(db, 'groups', state.id),
        groupData: state.group,
        currentUser: state.user,
        membership: state.membership,
        panelEl: panel,
        showToast: toast,
        formatCount: count,
        initialsFrom: initials,
        applyMediaBackground: media,
        refreshHeaderStats
      });
    }
  } catch (error) {
    console.error(`Tab ${tab} error:`, error);

    if (panel) {
      panel.innerHTML = `
        <div class="tab-panel-placeholder">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Unable to load this section.</p>
          <button type="button" class="retry-tab-btn">Try again</button>
        </div>
      `;

      panel
        .querySelector('.retry-tab-btn')
        ?.addEventListener('click', () => {
          loadedTabs.delete(tab);
          loadTab(tab);
        });
    }
  }
}

// ============================================================
// STATS
// ============================================================

async function refreshHeaderStats() {
  try {
    const snap = await getDoc(
      doc(db, 'groups', state.id)
    );

    if (!snap.exists()) return;

    state.group = {
      id: snap.id,
      ...snap.data()
    };

    text(memberCount, count(state.group.memberCount));
    text(postCount, count(state.group.postCount));
    text(onlineCount, count(state.group.onlineCount));
  } catch (error) {
    console.error('Stats refresh error:', error);
  }
}

// ============================================================
// HEADER ACTIONS
// ============================================================

function bindActions() {
  if (actionsBound) return;

  actionsBound = true;

  joinBtn?.addEventListener('click', joinLeave);
  shareBtn?.addEventListener('click', shareGroup);
  inviteBtn?.addEventListener('click', invite);
  coverEdit?.addEventListener('click', () => {
    if (isOwner() || isAdmin()) activateTab('settings');
  });

  bell?.addEventListener('click', toggleNotifications);

  closeNotifications?.addEventListener('click', () => {
    notificationPanel?.classList.remove('is-visible');
  });

  document.addEventListener('click', e => {
    if (
      notificationPanel?.classList.contains('is-visible') &&
      !notificationPanel.contains(e.target) &&
      !bell?.contains(e.target)
    ) {
      notificationPanel.classList.remove('is-visible');
    }
  });
}

// ============================================================
// JOIN / LEAVE
// ============================================================

async function joinLeave() {
  if (isOwner()) return;

  if (!state.membership) return joinGroup();

  if (state.membership.status === 'pending') {
    return cancelRequest();
  }

  return leaveGroup();
}

async function joinGroup() {
  if (!joinBtn) return;

  joinBtn.disabled = true;

  const g = state.group;
  const privateGroup = g.privacy === 'private';
  const status = privateGroup ? 'pending' : 'active';

  const memberRef = doc(
    db,
    'groups',
    state.id,
    'members',
    state.user.uid
  );

  const groupRef = doc(db, 'groups', state.id);

  try {
    let exists = false;

    await runTransaction(db, async tx => {
      const snap = await tx.get(memberRef);

      if (snap.exists()) {
        exists = true;
        return;
      }

      tx.set(memberRef, {
        uid: state.user.uid,
        displayName:
          state.user.displayName || 'VitalStar Member',
        photoURL: state.user.photoURL || '',
        role: 'member',
        status,
        category: g.category || '',
        joinedAt: serverTimestamp()
      });

      if (status === 'active') {
        tx.update(groupRef, {
          memberCount: increment(1)
        });
      }
    });

    if (exists) {
      toast('You are already a member.', 'info');
      return;
    }

    state.membership = {
      uid: state.user.uid,
      role: 'member',
      status,
      category: g.category || ''
    };

    if (status === 'active') {
      state.group.memberCount =
        (Number(state.group.memberCount) || 0) + 1;

      text(memberCount, count(state.group.memberCount));
    }

    renderJoinState();
    applyAccess();

    toast(
      privateGroup
        ? 'Join request sent.'
        : `You've joined ${g.name}.`,
      'success'
    );
  } catch (error) {
    console.error('Join error:', error);
    toast('Could not join this group.', 'error');
  } finally {
    joinBtn.disabled = false;
  }
}

async function cancelRequest() {
  if (!confirm('Cancel your request to join this group?')) return;

  joinBtn.disabled = true;

  try {
    await deleteDoc(
      doc(
        db,
        'groups',
        state.id,
        'members',
        state.user.uid
      )
    );

    state.membership = null;

    renderJoinState();
    applyAccess();

    toast('Join request cancelled.', 'info');
  } catch (error) {
    console.error('Cancel request error:', error);
    toast('Could not cancel the request.', 'error');
  } finally {
    joinBtn.disabled = false;
  }
}

async function leaveGroup() {
  if (
    !confirm(
      `Leave ${state.group.name}? You'll need to rejoin to see its posts again.`
    )
  ) return;

  joinBtn.disabled = true;

  const memberRef = doc(
    db,
    'groups',
    state.id,
    'members',
    state.user.uid
  );

  const groupRef = doc(db, 'groups', state.id);

  try {
    let active = false;

    await runTransaction(db, async tx => {
      const snap = await tx.get(memberRef);

      if (!snap.exists()) return;

      const data = snap.data();

      if (data.role === 'owner') return;

      tx.delete(memberRef);

      if (data.status === 'active') {
        active = true;

        tx.update(groupRef, {
          memberCount: increment(-1)
        });
      }
    });

    state.membership = null;

    if (active) {
      state.group.memberCount = Math.max(
        0,
        (Number(state.group.memberCount) || 1) - 1
      );

      text(memberCount, count(state.group.memberCount));
    }

    renderJoinState();
    applyAccess();

    toast(`You left ${state.group.name}.`, 'info');
  } catch (error) {
    console.error('Leave error:', error);
    toast('Could not leave this group.', 'error');
  } finally {
    joinBtn.disabled = false;
  }
}

// ============================================================
// SHARE / INVITE
// ============================================================

async function shareGroup() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: state.group.name,
        url: location.href
      });
    } else {
      await navigator.clipboard.writeText(location.href);
      toast('Group link copied.', 'success');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Share error:', error);
    }
  }
}

async function invite() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Invite link copied.', 'success');
  } catch (error) {
    console.error('Invite error:', error);
    toast('Could not copy the invite link.', 'error');
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

async function toggleNotifications() {
  if (!notificationPanel) return;

  const show =
    !notificationPanel.classList.contains('is-visible');

  notificationPanel.classList.toggle(
    'is-visible',
    show
  );

  if (!show || notificationsLoaded) return;

  try {
    const mod = await import('./group-notifications.js');

    notificationsLoaded = true;

    if (typeof mod?.init === 'function') {
      await mod.init({
        db,
        auth,
        currentUser: state.user,
        groupId: state.id,
        listEl: notificationList,
        unreadDotEl: unreadDot,
        showToast: toast
      });
    }
  } catch (error) {
    console.error('Notifications error:', error);
    toast('Notifications could not be loaded.', 'error');
  }
}