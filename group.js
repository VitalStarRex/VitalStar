// ============================================================
// VITALSTAR — group.js
// Core controller for group.html
// ============================================================

import { auth, db } from '../firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  increment,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ============================================================
// TAB MODULES
// ============================================================

const TAB_MODULE_LOADERS = {
  posts: () => import('./group-posts.js'),
  members: () => import('./group-members.js'),
  chat: () => import('./group-chat.js'),
  subscription: () => import('./group-subscription.js'),
  settings: () => import('./group-settings.js')
};

const loadedTabModules = new Set();

let notificationsModuleLoaded = false;
let headerActionsBound = false;
let tabsBound = false;


// ============================================================
// DOM REFERENCES
// ============================================================

const navUserAvatar = document.getElementById('navUserAvatar');
const navGroupTitle = document.getElementById('navGroupTitle');

const pageLoader = document.getElementById('pageLoader');
const groupNotFoundState = document.getElementById('groupNotFoundState');
const groupPageContent = document.getElementById('groupPageContent');

const groupCover = document.getElementById('groupCover');
const coverEditBtn = document.getElementById('coverEditBtn');
const groupAvatar = document.getElementById('groupAvatar');

const groupHeaderActions = document.getElementById('groupHeaderActions');
const yourRoleTag = document.getElementById('yourRoleTag');
const yourRoleText = document.getElementById('yourRoleText');

const shareBtn = document.getElementById('shareBtn');
const inviteBtn = document.getElementById('inviteBtn');
const joinLeaveBtn = document.getElementById('joinLeaveBtn');

const groupName = document.getElementById('groupName');
const groupPrivacyBadge = document.getElementById('groupPrivacyBadge');
const groupPremiumBadge = document.getElementById('groupPremiumBadge');
const groupVerifiedBadge = document.getElementById('groupVerifiedBadge');
const groupCategoryChip = document.getElementById('groupCategoryChip');
const groupOwnerText = document.getElementById('groupOwnerText');
const groupCreatedText = document.getElementById('groupCreatedText');
const groupDescription = document.getElementById('groupDescription');

const statMemberCount = document.getElementById('statMemberCount');
const statPostCount = document.getElementById('statPostCount');
const statOnlineCount = document.getElementById('statOnlineCount');
const statLevel = document.getElementById('statLevel');

const lockedNotice = document.getElementById('lockedNotice');
const groupContentGrid = document.getElementById('groupContentGrid');

const groupTabsNav = document.getElementById('groupTabsNav');
const subscriptionTabBtn = document.getElementById('subscriptionTabBtn');
const settingsTabBtn = document.getElementById('settingsTabBtn');

const rulesListDisplay = document.getElementById('rulesListDisplay');
const rulesEmptyDisplay = document.getElementById('rulesEmptyDisplay');

const adminsList = document.getElementById('adminsList');
const adminsEmptyDisplay = document.getElementById('adminsEmptyDisplay');

const notificationBellBtn = document.getElementById('notificationBellBtn');
const notifUnreadDot = document.getElementById('notifUnreadDot');
const notificationsPanel = document.getElementById('notificationsPanel');
const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
const notificationsList = document.getElementById('notificationsList');

const toastContainer = document.getElementById('toast-container');


// ============================================================
// CATEGORY LABELS
// ============================================================

const CATEGORY_LABELS = {
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


// ============================================================
// STATE
// ============================================================

const state = {
  currentUser: null,
  groupId: new URLSearchParams(window.location.search).get('id'),
  groupData: null,
  membership: null,
  activeTab: 'posts'
};


// ============================================================
// SAFE DOM HELPERS
// ============================================================

function exists(el) {
  return !!el;
}

function setText(el, value) {
  if (el) {
    el.textContent = value ?? '';
  }
}

function setDisplay(el, value) {
  if (el) {
    el.style.display = value;
  }
}


// ============================================================
// TOAST
// ============================================================

function showToast(message, type = 'info') {

  if (!toastContainer) {
    console.log(`[${type}] ${message}`);
    return;
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');

  toast.className = `toast toast--${type}`;

  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span></span>
  `;

  const span = toast.querySelector('span');

  if (span) {
    span.textContent = message;
  }

  toastContainer.appendChild(toast);

  setTimeout(() => {

    toast.classList.add('is-leaving');

    toast.addEventListener(
      'animationend',
      () => toast.remove(),
      { once: true }
    );

  }, 3800);
}


// ============================================================
// UTILITIES
// ============================================================

function formatCount(num) {

  num = Number(num) || 0;

  if (num >= 1000000) {
    return `${(num / 1000000)
      .toFixed(1)
      .replace(/\.0$/, '')}M`;
  }

  if (num >= 1000) {
    return `${(num / 1000)
      .toFixed(1)
      .replace(/\.0$/, '')}K`;
  }

  return String(num);
}


function initialsFrom(name) {

  return (name || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
}


function applyMediaBackground(el, url, fallbackText) {

  if (!el) return;

  if (url) {

    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';

  } else if (fallbackText !== undefined) {

    el.style.backgroundImage = '';
    el.textContent = fallbackText;

  }
}


function formatDate(timestamp) {

  if (
    !timestamp ||
    typeof timestamp.toDate !== 'function'
  ) {
    return 'recently';
  }

  return timestamp
    .toDate()
    .toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric'
    });
}


// ============================================================
// LOADING CONTROL
// ============================================================

function hideLoader() {

  if (pageLoader) {
    pageLoader.classList.add('is-hidden');
  }

}


function showPage() {

  hideLoader();

  if (groupPageContent) {
    groupPageContent.classList.add('is-visible');
  }

}


function showNotFound() {

  hideLoader();

  if (groupNotFoundState) {
    groupNotFoundState.classList.add('is-visible');
  }

}


// ============================================================
// AUTH GUARD
// ============================================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href = 'login.html';

    return;
  }

  state.currentUser = user;

  if (navUserAvatar && user.photoURL) {
    applyMediaBackground(
      navUserAvatar,
      user.photoURL
    );
  }

  await loadGroup();

});


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

  // Prevent endless loading if URL has no group ID.
  if (!state.groupId) {

    console.error('No group ID found in URL.');

    showNotFound();

    return;
  }


  try {

    const groupRef = doc(
      db,
      'groups',
      state.groupId
    );

    const memberRef = doc(
      db,
      'groups',
      state.groupId,
      'members',
      state.currentUser.uid
    );


    // --------------------------------------------------------
    // LOAD GROUP
    // --------------------------------------------------------

    const groupSnap = await getDoc(groupRef);


    if (!groupSnap.exists()) {

      console.error(
        'Group does not exist:',
        state.groupId
      );

      showNotFound();

      return;
    }


    state.groupData = {
      id: groupSnap.id,
      ...groupSnap.data()
    };


    // --------------------------------------------------------
    // LOAD MEMBERSHIP
    // --------------------------------------------------------

    try {

      const memberSnap = await getDoc(memberRef);

      state.membership = memberSnap.exists()
        ? memberSnap.data()
        : null;

    } catch (membershipError) {

      console.error(
        'Membership loading error:',
        membershipError
      );

      // Membership failure should NOT freeze the whole page.
      state.membership = null;
    }


    // --------------------------------------------------------
    // RENDER MAIN PAGE
    // --------------------------------------------------------

    renderHeader();

    renderSidebar();

    applyAccessControl();

    setupTabs();

    bindHeaderActions();

    // IMPORTANT:
    // Admins are secondary content.
    // Do NOT wait for them before showing the group.
    renderAdmins().catch(error => {
      console.error(
        'Admin loading error:',
        error
      );
    });


    // --------------------------------------------------------
    // SHOW PAGE IMMEDIATELY
    // --------------------------------------------------------

    showPage();


  } catch (error) {

    console.error(
      'CRITICAL GROUP LOAD ERROR:',
      error
    );

    showNotFound();

    showToast(
      'Unable to load this group. Please try again.',
      'error'
    );

  } finally {

    // FINAL SAFETY NET
    // Nothing is allowed to leave the page permanently stuck.
    hideLoader();

  }

}


// ============================================================
// RENDER HEADER
// ============================================================

function renderHeader() {

  const group = state.groupData;

  if (!group) return;


  document.title =
    `${group.name || 'Group'} · VitalStar`;


  setText(
    navGroupTitle,
    group.name || 'VitalStar Group'
  );


  // Cover
  if (groupCover) {

    if (group.coverURL) {

      groupCover.style.backgroundImage =
        `url("${group.coverURL}")`;

      groupCover.style.backgroundSize = 'cover';
      groupCover.style.backgroundPosition = 'center';

    } else {

      groupCover.style.backgroundImage = '';

    }

  }


  // Avatar
  if (groupAvatar) {

    if (group.avatarURL) {

      applyMediaBackground(
        groupAvatar,
        group.avatarURL
      );

    } else {

      groupAvatar.style.backgroundImage = '';

      groupAvatar.textContent =
        initialsFrom(group.name);

    }

  }


  setText(
    groupName,
    group.name || 'VitalStar Group'
  );


  // Privacy
  if (groupPrivacyBadge) {

    if (group.privacy === 'private') {

      groupPrivacyBadge.className =
        'badge badge--private';

      groupPrivacyBadge.innerHTML =
        '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';

    } else {

      groupPrivacyBadge.className =
        'badge badge--public';

      groupPrivacyBadge.innerHTML =
        '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';

    }

  }


  setDisplay(
    groupPremiumBadge,
    group.type === 'premium'
      ? 'inline-flex'
      : 'none'
  );


  setDisplay(
    groupVerifiedBadge,
    group.verified
      ? 'inline-flex'
      : 'none'
  );


  setText(
    groupCategoryChip,
    CATEGORY_LABELS[group.category] ||
    group.category ||
    'General'
  );


  setText(
    groupOwnerText,
    `Owned by ${group.ownerName || 'a member'}`
  );


  setText(
    groupCreatedText,
    `Created ${formatDate(group.createdAt)}`
  );


  setText(
    groupDescription,
    group.description || ''
  );


  setText(
    statMemberCount,
    formatCount(group.memberCount)
  );


  setText(
    statPostCount,
    formatCount(group.postCount)
  );


  setText(
    statOnlineCount,
    formatCount(group.onlineCount)
  );


  setText(
    statLevel,
    group.level || 1
  );


  renderJoinLeaveState();


  const role =
    state.membership?.role || null;

  const isOwnerOrAdmin =
    role === 'owner' ||
    role === 'admin';


  if (coverEditBtn) {

    coverEditBtn.classList.toggle(
      'is-visible',
      isOwnerOrAdmin
    );

  }

}


// ============================================================
// JOIN / LEAVE UI
// ============================================================

function renderJoinLeaveState() {

  if (!joinLeaveBtn) return;

  const membership =
    state.membership;


  // Owner
  if (
    membership &&
    membership.role === 'owner'
  ) {

    joinLeaveBtn.style.display = 'none';

    if (yourRoleTag) {
      yourRoleTag.classList.add('is-visible');
    }

    setText(
      yourRoleText,
      'Owner'
    );

    setDisplay(
      inviteBtn,
      'inline-flex'
    );

    return;
  }


  // Active member
  if (
    membership &&
    [
      'admin',
      'moderator',
      'member'
    ].includes(membership.role) &&
    membership.status === 'active'
  ) {

    joinLeaveBtn.style.display = 'flex';

    joinLeaveBtn.disabled = false;

    joinLeaveBtn.className =
      'btn-join-leave is-member';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-check"></i> Joined';


    if (yourRoleTag) {
      yourRoleTag.classList.add('is-visible');
    }


    setText(
      yourRoleText,
      membership.role.charAt(0).toUpperCase() +
      membership.role.slice(1)
    );


    setDisplay(
      inviteBtn,
      'inline-flex'
    );

    return;
  }


  // Pending
  if (
    membership &&
    membership.status === 'pending'
  ) {

    joinLeaveBtn.style.display = 'flex';

    joinLeaveBtn.disabled = false;

    joinLeaveBtn.className =
      'btn-join-leave is-pending';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-clock"></i> Requested';


    if (yourRoleTag) {
      yourRoleTag.classList.remove('is-visible');
    }


    setDisplay(
      inviteBtn,
      'none'
    );

    return;
  }


  // Not a member
  joinLeaveBtn.style.display = 'flex';

  joinLeaveBtn.disabled = false;

  joinLeaveBtn.className =
    'btn-join-leave';

  joinLeaveBtn.innerHTML =
    '<i class="fa-solid fa-plus"></i> Join group';


  if (yourRoleTag) {
    yourRoleTag.classList.remove('is-visible');
  }


  setDisplay(
    inviteBtn,
    'none'
  );

}


// ============================================================
// SIDEBAR
// ============================================================

function renderSidebar() {

  if (!rulesListDisplay) return;

  const rules =
    Array.isArray(state.groupData.rules)
      ? state.groupData.rules
      : [];


  rulesListDisplay.innerHTML = '';


  if (rules.length === 0) {

    setDisplay(
      rulesEmptyDisplay,
      'block'
    );

    return;
  }


  setDisplay(
    rulesEmptyDisplay,
    'none'
  );


  rules.forEach(rule => {

    const li =
      document.createElement('li');

    li.textContent = rule;

    rulesListDisplay.appendChild(li);

  });

}


// ============================================================
// ADMINS
// ============================================================

async function renderAdmins() {

  if (!adminsList) return;


  try {

    const membersQuery = query(
      collection(
        db,
        'groups',
        state.groupId,
        'members'
      ),
      where(
        'role',
        'in',
        [
          'owner',
          'admin',
          'moderator'
        ]
      ),
      limit(10)
    );


    const snapshot =
      await getDocs(membersQuery);


    adminsList
      .querySelectorAll('.admin-row')
      .forEach(el => el.remove());


    if (snapshot.empty) {

      setDisplay(
        adminsEmptyDisplay,
        'block'
      );

      return;
    }


    setDisplay(
      adminsEmptyDisplay,
      'none'
    );


    const rolePriority = {
      owner: 0,
      admin: 1,
      moderator: 2
    };


    const admins =
      snapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        .sort(
          (a, b) =>
            (rolePriority[a.role] ?? 3) -
            (rolePriority[b.role] ?? 3)
        );


    admins.forEach(admin => {

      const row =
        document.createElement('div');

      row.className =
        'admin-row';


      const avatar =
        document.createElement('div');

      avatar.className =
        'admin-avatar';


      applyMediaBackground(
        avatar,
        admin.photoURL,
        initialsFrom(
          admin.displayName
        )
      );


      const info =
        document.createElement('div');

      info.className =
        'admin-info';


      const name =
        document.createElement('div');

      name.className =
        'admin-name';

      name.textContent =
        admin.displayName ||
        'VitalStar Member';


      const role =
        document.createElement('div');

      role.className =
        'admin-role';

      role.textContent =
        admin.role || 'member';


      info.appendChild(name);
      info.appendChild(role);


      row.appendChild(avatar);
      row.appendChild(info);


      adminsList.appendChild(row);

    });


  } catch (error) {

    console.error(
      'Error loading admins:',
      error
    );

    // Do NOT throw.
    // Admin failure must never stop group.html.
    setDisplay(
      adminsEmptyDisplay,
      'block'
    );

  }

}


// ============================================================
// ACCESS CONTROL
// ============================================================

function applyAccessControl() {

  const group =
    state.groupData;

  if (!group) return;


  const isActiveMember =
    state.membership &&
    state.membership.status === 'active';


  const canView =
    group.privacy === 'public' ||
    isActiveMember;


  if (lockedNotice) {

    lockedNotice.classList.toggle(
      'is-visible',
      !canView
    );

  }


  if (groupContentGrid) {

    groupContentGrid.style.display =
      canView
        ? 'grid'
        : 'none';

  }


  const role =
    state.membership?.role || null;


  const isOwnerOrAdmin =
    role === 'owner' ||
    role === 'admin';


  setDisplay(
    subscriptionTabBtn,
    group.type === 'premium'
      ? 'flex'
      : 'none'
  );


  setDisplay(
    settingsTabBtn,
    isOwnerOrAdmin
      ? 'flex'
      : 'none'
  );


  if (canView) {

    activateTab('posts');

  }

}


// ============================================================
// TABS
// ============================================================

function setupTabs() {

  if (!groupTabsNav || tabsBound) {
    return;
  }

  tabsBound = true;


  groupTabsNav.addEventListener(
    'click',
    event => {

      const tabBtn =
        event.target.closest('.group-tab');


      if (!tabBtn) return;


      const tabName =
        tabBtn.dataset.tab;


      if (!tabName) return;


      activateTab(tabName);

    }
  );

}


function activateTab(tabName) {

  if (!tabName) return;


  state.activeTab =
    tabName;


  if (groupTabsNav) {

    groupTabsNav
      .querySelectorAll('.group-tab')
      .forEach(btn => {

        btn.classList.toggle(
          'is-active',
          btn.dataset.tab === tabName
        );

      });

  }


  document
    .querySelectorAll('.tab-panel')
    .forEach(panel => {

      panel.classList.toggle(
        'is-active',
        panel.dataset.panel === tabName
      );

    });


  loadTabModuleIfNeeded(
    tabName
  );

}


// ============================================================
// LOAD TAB MODULE
// ============================================================

async function loadTabModuleIfNeeded(tabName) {

  if (
    loadedTabModules.has(tabName)
  ) {
    return;
  }


  const loader =
    TAB_MODULE_LOADERS[tabName];


  if (!loader) return;


  const panel =
    document.getElementById(
      `${tabName}Tab`
    );


  try {

    const mod =
      await loader();


    loadedTabModules.add(
      tabName
    );


    if (
      mod &&
      typeof mod.init === 'function'
    ) {

      await mod.init(
        buildTabContext(panel)
      );

    }


  } catch (error) {

    console.error(
      `Tab "${tabName}" failed to load:`,
      error
    );


    if (panel) {

      panel.innerHTML = `
        <div class="tab-panel-placeholder">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Unable to load this section.</p>
          <button type="button" class="retry-tab-btn">
            Try again
          </button>
        </div>
      `;


      const retryBtn =
        panel.querySelector(
          '.retry-tab-btn'
        );


      if (retryBtn) {

        retryBtn.addEventListener(
          'click',
          () => {

            loadedTabModules.delete(
              tabName
            );

            loadTabModuleIfNeeded(
              tabName
            );

          }
        );

      }

    }

  }

}


// ============================================================
// TAB CONTEXT
// ============================================================

function buildTabContext(panelEl) {

  return {

    db,

    auth,

    groupId:
      state.groupId,

    groupRef:
      doc(
        db,
        'groups',
        state.groupId
      ),

    groupData:
      state.groupData,

    currentUser:
      state.currentUser,

    membership:
      state.membership,

    panelEl,

    showToast,

    formatCount,

    initialsFrom,

    applyMediaBackground,

    refreshHeaderStats

  };

}


// ============================================================
// REFRESH HEADER STATS
// ============================================================

async function refreshHeaderStats() {

  try {

    const groupRef =
      doc(
        db,
        'groups',
        state.groupId
      );


    const snap =
      await getDoc(groupRef);


    if (!snap.exists()) {
      return;
    }


    state.groupData = {
      id: snap.id,
      ...snap.data()
    };


    setText(
      statMemberCount,
      formatCount(
        state.groupData.memberCount
      )
    );


    setText(
      statPostCount,
      formatCount(
        state.groupData.postCount
      )
    );


    setText(
      statOnlineCount,
      formatCount(
        state.groupData.onlineCount
      )
    );


  } catch (error) {

    console.error(
      'Error refreshing group stats:',
      error
    );

  }

}


// ============================================================
// HEADER ACTIONS
// ============================================================

function bindHeaderActions() {

  if (headerActionsBound) {
    return;
  }

  headerActionsBound = true;


  if (joinLeaveBtn) {

    joinLeaveBtn.addEventListener(
      'click',
      handleJoinLeaveClick
    );

  }


  if (shareBtn) {

    shareBtn.addEventListener(
      'click',
      handleShareClick
    );

  }


  if (inviteBtn) {

    inviteBtn.addEventListener(
      'click',
      handleInviteClick
    );

  }


  if (coverEditBtn) {

    coverEditBtn.addEventListener(
      'click',
      () => activateTab('settings')
    );

  }


  // ----------------------------------------------------------
  // NOTIFICATION BELL
  // ----------------------------------------------------------

  if (notificationBellBtn) {

    notificationBellBtn.addEventListener(
      'click',
      toggleNotificationsPanel
    );

  }


  if (closeNotificationsBtn) {

    closeNotificationsBtn.addEventListener(
      'click',
      () => {

        if (notificationsPanel) {

          notificationsPanel
            .classList
            .remove('is-visible');

        }

      }
    );

  }


  document.addEventListener(
    'click',
    event => {

      if (!notificationsPanel) {
        return;
      }


      if (!notificationBellBtn) {
        return;
      }


      if (
        notificationsPanel.classList.contains(
          'is-visible'
        ) &&
        !notificationsPanel.contains(
          event.target
        ) &&
        !notificationBellBtn.contains(
          event.target
        )
      ) {

        notificationsPanel
          .classList
          .remove('is-visible');

      }

    }
  );

}


// ============================================================
// JOIN / LEAVE
// ============================================================

async function handleJoinLeaveClick() {

  const membership =
    state.membership;


  if (!membership) {

    await joinGroup();

  } else if (
    membership.status === 'pending'
  ) {

    await cancelJoinRequest();

  } else if (
    membership.role !== 'owner'
  ) {

    await leaveGroup();

  }

}


// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup() {

  if (!joinLeaveBtn) return;


  joinLeaveBtn.disabled =
    true;


  const group =
    state.groupData;

  const user =
    state.currentUser;


  const isPrivate =
    group.privacy === 'private';


  const status =
    isPrivate
      ? 'pending'
      : 'active';


  const memberRef =
    doc(
      db,
      'groups',
      state.groupId,
      'members',
      user.uid
    );


  const groupRef =
    doc(
      db,
      'groups',
      state.groupId
    );


  try {

    let alreadyMember =
      false;


    await runTransaction(
      db,
      async transaction => {

        const existingMemberSnap =
          await transaction.get(
            memberRef
          );


        if (
          existingMemberSnap.exists()
        ) {

          alreadyMember =
            true;

          return;
        }


        transaction.set(
          memberRef,
          {

            uid: user.uid,

            displayName:
              user.displayName ||
              'VitalStar Member',

            photoURL:
              user.photoURL ||
              '',

            role:
              'member',

            status,

            category:
              group.category ||
              '',

            joinedAt:
              serverTimestamp()

          }
        );


        if (
          status === 'active'
        ) {

          transaction.update(
            groupRef,
            {
              memberCount:
                increment(1)
            }
          );

        }

      }
    );


    if (
      alreadyMember
    ) {

      showToast(
        'You are already a member of this group.',
        'info'
      );

      return;
    }


    if (
      status === 'active'
    ) {

      state.groupData.memberCount =
        (
          Number(
            state.groupData.memberCount
          ) || 0
        ) + 1;


      setText(
        statMemberCount,
        formatCount(
          state.groupData.memberCount
        )
      );

    }


    state.membership = {

      status,

      role:
        'member',

      category:
        group.category || ''

    };


    renderJoinLeaveState();

    applyAccessControl();


    showToast(
      isPrivate
        ? 'Request sent! An admin will review it soon.'
        : `You've joined ${group.name}.`,
      'success'
    );


  } catch (error) {

    console.error(
      'Error joining group:',
      error
    );


    showToast(
      'Could not join this group. Please try again.',
      'error'
    );


  } finally {

    joinLeaveBtn.disabled =
      false;

  }

}


// ============================================================
// CANCEL JOIN REQUEST
// ============================================================

async function cancelJoinRequest() {

  if (
    !window.confirm(
      'Cancel your request to join this group?'
    )
  ) {

    return;
  }


  if (!joinLeaveBtn) return;


  joinLeaveBtn.disabled =
    true;


  try {

    await deleteDoc(
      doc(
        db,
        'groups',
        state.groupId,
        'members',
        state.currentUser.uid
      )
    );


    state.membership =
      null;


    renderJoinLeaveState();

    applyAccessControl();


    showToast(
      'Your join request was cancelled.',
      'info'
    );


  } catch (error) {

    console.error(
      'Error cancelling request:',
      error
    );


    showToast(
      'Could not cancel the request. Please try again.',
      'error'
    );


  } finally {

    joinLeaveBtn.disabled =
      false;

  }

}


// ============================================================
// LEAVE GROUP
// ============================================================

async function leaveGroup() {

  if (
    !window.confirm(
      `Leave ${state.groupData.name}? You'll need to rejoin to see its posts again.`
    )
  ) {

    return;
  }


  if (!joinLeaveBtn) return;


  joinLeaveBtn.disabled =
    true;


  const memberRef =
    doc(
      db,
      'groups',
      state.groupId,
      'members',
      state.currentUser.uid
    );


  const groupRef =
    doc(
      db,
      'groups',
      state.groupId
    );


  try {

    let wasActiveMember =
      false;


    await runTransaction(
      db,
      async transaction => {

        const existingMemberSnap =
          await transaction.get(
            memberRef
          );


        if (
          !existingMemberSnap.exists()
        ) {

          return;
        }


        const memberData =
          existingMemberSnap.data();


        transaction.delete(
          memberRef
        );


        if (
          memberData.status === 'active'
        ) {

          wasActiveMember =
            true;


          transaction.update(
            groupRef,
            {
              memberCount:
                increment(-1)
            }
          );

        }

      }
    );


    state.membership =
      null;


    if (
      wasActiveMember
    ) {

      state.groupData.memberCount =
        Math.max(
          0,
          (
            Number(
              state.groupData.memberCount
            ) || 1
          ) - 1
        );


      setText(
        statMemberCount,
        formatCount(
          state.groupData.memberCount
        )
      );

    }


    renderJoinLeaveState();

    applyAccessControl();


    showToast(
      `You left ${state.groupData.name}.`,
      'info'
    );


  } catch (error) {

    console.error(
      'Error leaving group:',
      error
    );


    showToast(
      'Could not leave the group. Please try again.',
      'error'
    );


  } finally {

    joinLeaveBtn.disabled =
      false;

  }

}


// ============================================================
// SHARE
// ============================================================

async function handleShareClick() {

  const url =
    window.location.href;


  try {

    if (
      navigator.share
    ) {

      await navigator.share({

        title:
          state.groupData.name,

        url

      });

    } else {

      await navigator.clipboard.writeText(
        url
      );


      showToast(
        'Group link copied to clipboard.',
        'success'
      );

    }

  } catch (error) {

    if (
      error.name !== 'AbortError'
    ) {

      console.error(
        'Error sharing group:',
        error
      );

    }

  }

}


// ============================================================
// INVITE
// ============================================================

async function handleInviteClick() {

  const url =
    window.location.href;


  try {

    await navigator.clipboard.writeText(
      url
    );


    showToast(
      'Invite link copied — share it to invite people.',
      'success'
    );


  } catch (error) {

    console.error(
      'Error copying invite link:',
      error
    );


    showToast(
      'Could not copy the invite link.',
      'error'
    );

  }

}


// ============================================================
// NOTIFICATIONS
// ============================================================

async function toggleNotificationsPanel() {

  if (!notificationsPanel) {
    return;
  }


  const willShow =
    !notificationsPanel
      .classList
      .contains('is-visible');


  notificationsPanel
    .classList
    .toggle(
      'is-visible',
      willShow
    );


  if (
    !willShow ||
    notificationsModuleLoaded
  ) {

    return;
  }


  try {

    const mod =
      await import(
        './group-notifications.js'
      );


    notificationsModuleLoaded =
      true;


    if (
      mod &&
      typeof mod.init === 'function'
    ) {

      await mod.init({

        db,

        auth,

        currentUser:
          state.currentUser,

        groupId:
          state.groupId,

        listEl:
          notificationsList,

        unreadDotEl:
          notifUnreadDot,

        showToast

      });

    }


  } catch (error) {

    console.error(
      'Group notifications failed to load:',
      error
    );


    showToast(
      'Notifications could not be loaded.',
      'error'
    );

  }

}


// ============================================================
// END OF GROUP.JS
// ============================================================