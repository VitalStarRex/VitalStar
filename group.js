// ============================================================
// VITALSTAR — group.js
// ============================================================
// Core controller for group.html.
//
// Handles:
// - Authentication
// - Loading the group
// - Membership / roles
// - Header and sidebar
// - Join / leave
// - Share / invite
// - Tabs
// - Admin list
// - Group access control
// - Group notifications
// - Real-time notification badge
// - Notification panel
//
// Notification collection:
//
// groups/{groupId}/notifications/{notificationId}
//
// Notification fields:
//
// recipientId
// actorId
// actorName
// actorPhotoURL
// type
// message
// read
// createdAt
// link
// ============================================================


import { auth, db } from '../firebase.js';


import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  where,
  limit,
  increment,
  runTransaction,
  onSnapshot
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


// ============================================================
// DOM REFERENCES
// ============================================================

const navUserAvatar =
  document.getElementById('navUserAvatar');

const navGroupTitle =
  document.getElementById('navGroupTitle');


const pageLoader =
  document.getElementById('pageLoader');

const groupNotFoundState =
  document.getElementById('groupNotFoundState');

const groupPageContent =
  document.getElementById('groupPageContent');


const groupCover =
  document.getElementById('groupCover');

const coverEditBtn =
  document.getElementById('coverEditBtn');

const groupAvatar =
  document.getElementById('groupAvatar');


const groupHeaderActions =
  document.getElementById('groupHeaderActions');

const yourRoleTag =
  document.getElementById('yourRoleTag');

const yourRoleText =
  document.getElementById('yourRoleText');

const shareBtn =
  document.getElementById('shareBtn');

const inviteBtn =
  document.getElementById('inviteBtn');

const joinLeaveBtn =
  document.getElementById('joinLeaveBtn');


const groupName =
  document.getElementById('groupName');

const groupPrivacyBadge =
  document.getElementById('groupPrivacyBadge');

const groupPremiumBadge =
  document.getElementById('groupPremiumBadge');

const groupVerifiedBadge =
  document.getElementById('groupVerifiedBadge');

const groupCategoryChip =
  document.getElementById('groupCategoryChip');

const groupOwnerText =
  document.getElementById('groupOwnerText');

const groupCreatedText =
  document.getElementById('groupCreatedText');

const groupDescription =
  document.getElementById('groupDescription');


const statMemberCount =
  document.getElementById('statMemberCount');

const statPostCount =
  document.getElementById('statPostCount');

const statOnlineCount =
  document.getElementById('statOnlineCount');

const statLevel =
  document.getElementById('statLevel');


const lockedNotice =
  document.getElementById('lockedNotice');

const groupContentGrid =
  document.getElementById('groupContentGrid');


const groupTabsNav =
  document.getElementById('groupTabsNav');

const subscriptionTabBtn =
  document.getElementById('subscriptionTabBtn');

const settingsTabBtn =
  document.getElementById('settingsTabBtn');


const rulesListDisplay =
  document.getElementById('rulesListDisplay');

const rulesEmptyDisplay =
  document.getElementById('rulesEmptyDisplay');

const adminsList =
  document.getElementById('adminsList');

const adminsEmptyDisplay =
  document.getElementById('adminsEmptyDisplay');


// ============================================================
// NOTIFICATION DOM
// ============================================================

const notificationBellBtn =
  document.getElementById('notificationBellBtn');

const notifUnreadDot =
  document.getElementById('notifUnreadDot');

const notificationsPanel =
  document.getElementById('notificationsPanel');

const closeNotificationsBtn =
  document.getElementById('closeNotificationsBtn');

const notificationsList =
  document.getElementById('notificationsList');


const toastContainer =
  document.getElementById('toast-container');


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

  groupId:
    new URLSearchParams(window.location.search).get('id'),

  groupData: null,

  membership: null,

  activeTab: 'posts',

  notifications: [],

  notificationsUnsubscribe: null,

  initialized: false,

  headerActionsBound: false,

  tabsBound: false

};


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function showToast(message, type = 'info') {

  if (!toastContainer) {

    alert(message);

    return;

  }


  const icons = {

    success: 'fa-circle-check',

    error: 'fa-circle-exclamation',

    info: 'fa-circle-info'

  };


  const toast =
    document.createElement('div');


  toast.className =
    `toast toast--${type}`;


  toast.innerHTML = `

    <i class="fa-solid ${icons[type] || icons.info}"></i>

    <span></span>

  `;


  const text =
    toast.querySelector('span');


  if (text) {

    text.textContent = message;

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
// FORMAT COUNT
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


  return `${num}`;

}


// ============================================================
// INITIALS
// ============================================================

function initialsFrom(name) {

  return (name || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

}


// ============================================================
// MEDIA BACKGROUND
// ============================================================

function applyMediaBackground(
  el,
  url,
  fallbackText
) {

  if (!el) return;


  if (url) {

    el.style.backgroundImage =
      `url("${url}")`;

    el.style.backgroundSize =
      'cover';

    el.style.backgroundPosition =
      'center';

    el.textContent = '';

  } else if (
    fallbackText !== undefined
  ) {

    el.style.backgroundImage = '';

    el.textContent =
      fallbackText;

  }

}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(timestamp) {

  if (
    !timestamp ||
    typeof timestamp.toDate !== 'function'
  ) {

    return 'recently';

  }


  return timestamp
    .toDate()
    .toLocaleDateString(
      undefined,
      {
        month: 'short',
        year: 'numeric'
      }
    );

}


// ============================================================
// NOTIFICATION DATE
// ============================================================

function formatNotificationTime(timestamp) {

  if (!timestamp) {

    return 'just now';

  }


  let date;


  if (
    typeof timestamp.toDate === 'function'
  ) {

    date = timestamp.toDate();

  } else if (
    timestamp.seconds
  ) {

    date =
      new Date(timestamp.seconds * 1000);

  } else {

    return 'just now';

  }


  const now = Date.now();

  const diff =
    Math.max(0, now - date.getTime());


  const seconds =
    Math.floor(diff / 1000);

  const minutes =
    Math.floor(seconds / 60);

  const hours =
    Math.floor(minutes / 60);

  const days =
    Math.floor(hours / 24);


  if (seconds < 60) {

    return 'just now';

  }


  if (minutes < 60) {

    return `${minutes}m ago`;

  }


  if (hours < 24) {

    return `${hours}h ago`;

  }


  if (days < 7) {

    return `${days}d ago`;

  }


  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric'
    }
  );

}


// ============================================================
// AUTH GUARD
// ============================================================

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      window.location.href =
        'login.html';

      return;

    }


    state.currentUser =
      user;


    if (user.photoURL) {

      applyMediaBackground(
        navUserAvatar,
        user.photoURL
      );

    }


    await loadGroup();

  }
);


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

  if (!state.groupId) {

    showNotFound();

    return;

  }


  try {

    const groupRef =
      doc(
        db,
        'groups',
        state.groupId
      );


    const memberRef =
      doc(
        db,
        'groups',
        state.groupId,
        'members',
        state.currentUser.uid
      );


    const groupSnap =
      await getDoc(groupRef);


    if (!groupSnap.exists()) {

      showNotFound();

      return;

    }


    state.groupData = {

      id: groupSnap.id,

      ...groupSnap.data()

    };


    const memberSnap =
      await getDoc(memberRef);


    state.membership =
      memberSnap.exists()
        ? memberSnap.data()
        : null;


    renderHeader();

    renderSidebar();

    await renderAdmins();

    applyAccessControl();

    setupTabs();

    bindHeaderActions();

    startNotificationListener();


    if (pageLoader) {

      pageLoader.classList.add(
        'is-hidden'
      );

    }


    if (groupPageContent) {

      groupPageContent.classList.add(
        'is-visible'
      );

    }


    state.initialized = true;

  } catch (error) {

    console.error(
      'Error loading group:',
      error
    );

    showToast(
      'Could not load this group.',
      'error'
    );

    showNotFound();

  }

}


// ============================================================
// NOT FOUND
// ============================================================

function showNotFound() {

  if (pageLoader) {

    pageLoader.classList.add(
      'is-hidden'
    );

  }


  if (groupNotFoundState) {

    groupNotFoundState.classList.add(
      'is-visible'
    );

  }

}


// ============================================================
// RENDER HEADER
// ============================================================

function renderHeader() {

  const group =
    state.groupData;


  document.title =
    `${group.name || 'Group'} · VitalStar`;


  if (navGroupTitle) {

    navGroupTitle.textContent =
      group.name || 'Group';

  }


  if (
    groupCover &&
    group.coverURL
  ) {

    groupCover.style.backgroundImage =
      `url("${group.coverURL}")`;

  }


  applyMediaBackground(
    groupAvatar,
    group.avatarURL,
    group.avatarURL
      ? undefined
      : initialsFrom(group.name)
  );


  if (
    groupAvatar &&
    !group.avatarURL
  ) {

    groupAvatar.innerHTML =
      initialsFrom(group.name);

  }


  if (groupName) {

    groupName.textContent =
      group.name || 'Group';

  }


  if (groupPrivacyBadge) {

    if (
      group.privacy === 'private'
    ) {

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


  if (groupPremiumBadge) {

    groupPremiumBadge.style.display =
      group.type === 'premium'
        ? 'inline-flex'
        : 'none';

  }


  if (groupVerifiedBadge) {

    groupVerifiedBadge.style.display =
      group.verified
        ? 'inline-flex'
        : 'none';

  }


  if (groupCategoryChip) {

    groupCategoryChip.textContent =
      CATEGORY_LABELS[group.category]
      || group.category
      || 'General';

  }


  if (groupOwnerText) {

    groupOwnerText.textContent =
      `Owned by ${group.ownerName || 'a member'}`;

  }


  if (groupCreatedText) {

    groupCreatedText.textContent =
      `Created ${formatDate(group.createdAt)}`;

  }


  if (groupDescription) {

    groupDescription.textContent =
      group.description || '';

  }


  if (statMemberCount) {

    statMemberCount.textContent =
      formatCount(group.memberCount);

  }


  if (statPostCount) {

    statPostCount.textContent =
      formatCount(group.postCount);

  }


  if (statOnlineCount) {

    statOnlineCount.textContent =
      formatCount(group.onlineCount);

  }


  if (statLevel) {

    statLevel.textContent =
      group.level || 1;

  }


  renderJoinLeaveState();


  const role =
    state.membership?.role;


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
// JOIN / LEAVE BUTTON
// ============================================================

function renderJoinLeaveState() {

  if (!joinLeaveBtn) return;


  const membership =
    state.membership;


  if (
    membership &&
    membership.role === 'owner'
  ) {

    joinLeaveBtn.style.display =
      'none';


    if (yourRoleTag) {

      yourRoleTag.classList.add(
        'is-visible'
      );

    }


    if (yourRoleText) {

      yourRoleText.textContent =
        'Owner';

    }


    if (inviteBtn) {

      inviteBtn.style.display =
        'inline-flex';

    }


    return;

  }


  if (
    membership &&
    [
      'admin',
      'moderator',
      'member'
    ].includes(membership.role) &&
    membership.status === 'active'
  ) {

    joinLeaveBtn.style.display =
      'flex';

    joinLeaveBtn.disabled =
      false;

    joinLeaveBtn.className =
      'btn-join-leave is-member';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-check"></i> Joined';


    if (yourRoleTag) {

      yourRoleTag.classList.add(
        'is-visible'
      );

    }


    if (yourRoleText) {

      yourRoleText.textContent =
        membership.role
          .charAt(0)
          .toUpperCase()
        +
        membership.role.slice(1);

    }


    if (inviteBtn) {

      inviteBtn.style.display =
        'inline-flex';

    }


    return;

  }


  if (
    membership &&
    membership.status === 'pending'
  ) {

    joinLeaveBtn.style.display =
      'flex';

    joinLeaveBtn.disabled =
      false;

    joinLeaveBtn.className =
      'btn-join-leave is-pending';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-clock"></i> Requested';


    if (yourRoleTag) {

      yourRoleTag.classList.remove(
        'is-visible'
      );

    }


    if (inviteBtn) {

      inviteBtn.style.display =
        'none';

    }


    return;

  }


  joinLeaveBtn.style.display =
    'flex';

  joinLeaveBtn.disabled =
    false;

  joinLeaveBtn.className =
    'btn-join-leave';

  joinLeaveBtn.innerHTML =
    '<i class="fa-solid fa-plus"></i> Join group';


  if (yourRoleTag) {

    yourRoleTag.classList.remove(
      'is-visible'
    );

  }


  if (inviteBtn) {

    inviteBtn.style.display =
      'none';

  }

}


// ============================================================
// SIDEBAR
// ============================================================

function renderSidebar() {

  if (
    !rulesListDisplay ||
    !rulesEmptyDisplay
  ) {

    return;

  }


  const rules =
    state.groupData.rules || [];


  rulesListDisplay.innerHTML =
    '';


  if (!rules.length) {

    rulesEmptyDisplay.style.display =
      'block';

  } else {

    rulesEmptyDisplay.style.display =
      'none';


    rules.forEach(
      (rule) => {

        const li =
          document.createElement('li');

        li.textContent =
          rule;

        rulesListDisplay.appendChild(
          li
        );

      }
    );

  }

}


// ============================================================
// ADMINS
// ============================================================

async function renderAdmins() {

  if (!adminsList) return;


  try {

    const membersQuery =
      query(
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
      .forEach(
        el => el.remove()
      );


    if (snapshot.empty) {

      if (adminsEmptyDisplay) {

        adminsEmptyDisplay.style.display =
          'block';

      }

      return;

    }


    if (adminsEmptyDisplay) {

      adminsEmptyDisplay.style.display =
        'none';

    }


    const rolePriority = {

      owner: 0,

      admin: 1,

      moderator: 2

    };


    const admins =
      snapshot.docs
        .map(
          d => d.data()
        )
        .sort(
          (a, b) =>
            (rolePriority[a.role] ?? 3)
            -
            (rolePriority[b.role] ?? 3)
        );


    admins.forEach(
      (admin) => {

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


        info.innerHTML = `

          <div class="admin-name"></div>

          <div class="admin-role"></div>

        `;


        info.querySelector(
          '.admin-name'
        ).textContent =
          admin.displayName ||
          'VitalStar Member';


        info.querySelector(
          '.admin-role'
        ).textContent =
          admin.role;


        row.appendChild(
          avatar
        );

        row.appendChild(
          info
        );


        adminsList.appendChild(
          row
        );

      }
    );

  } catch (error) {

    console.error(
      'Error loading admins:',
      error
    );

  }

}


// ============================================================
// ACCESS CONTROL
// ============================================================

function applyAccessControl() {

  const group =
    state.groupData;


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
    state.membership
      ? state.membership.role
      : null;


  const isOwnerOrAdmin =
    role === 'owner' ||
    role === 'admin';


  if (subscriptionTabBtn) {

    subscriptionTabBtn.style.display =
      group.type === 'premium'
        ? 'flex'
        : 'none';

  }


  if (settingsTabBtn) {

    settingsTabBtn.style.display =
      isOwnerOrAdmin
        ? 'flex'
        : 'none';

  }


  if (canView) {

    activateTab('posts');

  }

}


// ============================================================
// TABS
// ============================================================

function setupTabs() {

  if (
    state.tabsBound ||
    !groupTabsNav
  ) {

    return;

  }


  state.tabsBound = true;


  groupTabsNav.addEventListener(
    'click',
    (event) => {

      const tabBtn =
        event.target.closest(
          '.group-tab'
        );


      if (!tabBtn) return;


      const tabName =
        tabBtn.dataset.tab;


      if (!tabName) return;


      activateTab(tabName);

    }
  );

}


// ============================================================
// ACTIVATE TAB
// ============================================================

function activateTab(tabName) {

  state.activeTab =
    tabName;


  if (groupTabsNav) {

    groupTabsNav
      .querySelectorAll('.group-tab')
      .forEach(
        btn => {

          btn.classList.toggle(
            'is-active',
            btn.dataset.tab ===
              tabName
          );

        }
      );

  }


  document
    .querySelectorAll('.tab-panel')
    .forEach(
      panel => {

        panel.classList.toggle(
          'is-active',
          panel.dataset.panel ===
            tabName
        );

      }
    );


  loadTabModuleIfNeeded(
    tabName
  );

}


// ============================================================
// LOAD TAB MODULE
// ============================================================

async function loadTabModuleIfNeeded(
  tabName
) {

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
      `${tabName === 'posts'
        ? 'posts'
        : tabName}Tab`
    );


  try {

    const mod =
      await loader();


    loadedTabModules.add(
      tabName
    );


    if (
      typeof mod.init ===
      'function'
    ) {

      await mod.init(
        buildTabContext(panel)
      );

    }

  } catch (error) {

    console.warn(
      `Tab module for "${tabName}" isn't available yet:`,
      error
    );


    if (panel) {

      panel.innerHTML = `

        <div class="tab-panel-placeholder">

          This section is still being built out —
          check back soon.

        </div>

      `;

    }

  }

}


// ============================================================
// TAB CONTEXT
// ============================================================

function buildTabContext(
  panelEl
) {

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

    refreshHeaderStats,

    // --------------------------------------------
    // Notification helpers
    // --------------------------------------------

    notifyMember,

    notifyGroupAdmins,

    notifyGroupMembers,

    createGroupNotification,

    markNotificationAsRead,

    markAllNotificationsAsRead

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


    if (!snap.exists()) return;


    state.groupData = {

      id: snap.id,

      ...snap.data()

    };


    if (statMemberCount) {

      statMemberCount.textContent =
        formatCount(
          state.groupData.memberCount
        );

    }


    if (statPostCount) {

      statPostCount.textContent =
        formatCount(
          state.groupData.postCount
        );

    }


    if (statOnlineCount) {

      statOnlineCount.textContent =
        formatCount(
          state.groupData.onlineCount
        );

    }

  } catch (error) {

    console.error(
      'Error refreshing header stats:',
      error
    );

  }

}


// ============================================================
// HEADER ACTIONS
// ============================================================

function bindHeaderActions() {

  if (state.headerActionsBound) {

    return;

  }


  state.headerActionsBound =
    true;


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

          notificationsPanel.classList.remove(
            'is-visible'
          );

        }

      }
    );

  }


  document.addEventListener(
    'click',
    (event) => {

      if (
        !notificationsPanel ||
        !notificationBellBtn
      ) {

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

        notificationsPanel.classList.remove(
          'is-visible'
        );

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

            uid:
              user.uid,

            displayName:
              user.displayName ||
              'VitalStar Member',

            photoURL:
              user.photoURL || '',

            role:
              'member',

            status,

            category:
              group.category || '',

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
      !alreadyMember &&
      status === 'active'
    ) {

      state.groupData.memberCount =
        (
          state.groupData.memberCount ||
          0
        ) + 1;


      if (statMemberCount) {

        statMemberCount.textContent =
          formatCount(
            state.groupData.memberCount
          );

      }

    }


    state.membership = {

      status,

      role: 'member',

      category:
        group.category || ''

    };


    renderJoinLeaveState();

    applyAccessControl();


    // Notify group admins/owner.
    await notifyGroupAdmins({

      type:
        isPrivate
          ? 'join_request'
          : 'member_joined',

      message:
        isPrivate
          ? `${user.displayName || 'A member'} requested to join ${group.name}.`
          : `${user.displayName || 'A member'} joined ${group.name}.`,

      link:
        window.location.href

    });


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
          memberData.status ===
          'active'
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


    if (wasActiveMember) {

      state.groupData.memberCount =
        Math.max(
          0,
          (
            state.groupData.memberCount ||
            1
          ) - 1
        );


      if (statMemberCount) {

        statMemberCount.textContent =
          formatCount(
            state.groupData.memberCount
          );

      }

    }


    // Notify admins before leaving.
    await notifyGroupAdmins({

      type:
        'member_left',

      message:
        `${state.currentUser.displayName || 'A member'} left ${state.groupData.name}.`,

      link:
        window.location.href

    });


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
// SHARE GROUP
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
      error.name !==
      'AbortError'
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
// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
// ============================================================


// ============================================================
// NOTIFICATION COLLECTION
// ============================================================

function notificationsCollection() {

  return collection(
    db,
    'groups',
    state.groupId,
    'notifications'
  );

}


// ============================================================
// CREATE NOTIFICATION
// ============================================================

async function createGroupNotification({

  recipientId,

  type = 'general',

  message = '',

  actorId = state.currentUser?.uid || '',

  actorName =
    state.currentUser?.displayName ||
    'VitalStar Member',

  actorPhotoURL =
    state.currentUser?.photoURL ||
    '',

  link = '',

  postId = '',

  commentId = ''

}) {

  if (
    !recipientId ||
    !message ||
    !state.groupId
  ) {

    return null;

  }


  // Never notify the person who caused the action.
  if (
    recipientId ===
    state.currentUser?.uid
  ) {

    return null;

  }


  try {

    const notificationData = {

      recipientId,

      actorId,

      actorName,

      actorPhotoURL,

      type,

      message,

      link,

      postId,

      commentId,

      read: false,

      createdAt:
        serverTimestamp()

    };


    const notificationRef =
      await addDoc(
        notificationsCollection(),
        notificationData
      );


    return notificationRef.id;

  } catch (error) {

    console.error(
      'Error creating group notification:',
      error
    );


    return null;

  }

}


// ============================================================
// NOTIFY ONE MEMBER
// ============================================================

async function notifyMember({

  recipientId,

  type = 'general',

  message,

  link = '',

  postId = '',

  commentId = ''

}) {

  if (!recipientId) {

    return null;

  }


  return createGroupNotification({

    recipientId,

    type,

    message,

    link,

    postId,

    commentId

  });

}


// ============================================================
// GET GROUP ADMINS
// ============================================================

async function getGroupAdmins() {

  try {

    const membersRef =
      collection(
        db,
        'groups',
        state.groupId,
        'members'
      );


    const snapshot =
      await getDocs(
        membersRef
      );


    const admins = [];


    snapshot.forEach(
      memberDoc => {

        const data =
          memberDoc.data();


        if (
          data.status === 'active' &&
          [
            'owner',
            'admin',
            'moderator'
          ].includes(data.role)
        ) {

          admins.push({

            uid:
              memberDoc.id,

            ...data

          });

       