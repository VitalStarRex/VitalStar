// ============================================================
// VITALSTAR — group.js
// Main controller for group.html
// ============================================================

import { auth, db } from './firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
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
let outsideNotificationBound = false;


// ============================================================
// DOM
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
// URL STATE
// ============================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const requestedPostId =
  urlParams.get('postId');

const requestedTab =
  urlParams.get('tab');


// ============================================================
// STATE
// ============================================================

const state = {

  currentUser: null,

  groupId:
    urlParams.get('id'),

  groupData: null,

  membership: null,

  activeTab:
    requestedTab || 'posts',

  postId:
    requestedPostId || null,

  loading: false

};


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
// HELPERS
// ============================================================

function setText(el, value) {

  if (el) {
    el.textContent =
      value ?? '';
  }

}


function setDisplay(el, value) {

  if (el) {
    el.style.display =
      value;
  }

}


function formatCount(value) {

  const num =
    Number(value) || 0;

  if (num >= 1000000) {

    return `${(
      num / 1000000
    ).toFixed(1)
      .replace('.0', '')}M`;

  }

  if (num >= 1000) {

    return `${(
      num / 1000
    ).toFixed(1)
      .replace('.0', '')}K`;

  }

  return String(num);

}


function initialsFrom(name) {

  const value =
    String(name || '?')
      .trim();

  return value
    ? value.charAt(0).toUpperCase()
    : '?';

}


function applyMediaBackground(
  el,
  url,
  fallbackText = ''
) {

  if (!el) {
    return;
  }

  if (url) {

    el.style.backgroundImage =
      `url("${String(url)
        .replace(/"/g, '\\"')}")`;

    el.style.backgroundSize =
      'cover';

    el.style.backgroundPosition =
      'center';

    el.textContent =
      '';

  } else {

    el.style.backgroundImage =
      '';

    el.textContent =
      fallbackText || '';

  }

}


function formatDate(timestamp) {

  if (!timestamp) {
    return 'recently';
  }

  try {

    let date = null;

    if (
      typeof timestamp.toDate ===
      'function'
    ) {

      date =
        timestamp.toDate();

    } else if (
      timestamp instanceof Date
    ) {

      date =
        timestamp;

    } else if (
      typeof timestamp === 'number'
    ) {

      date =
        new Date(timestamp);

    }

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {

      return 'recently';

    }

    return date.toLocaleDateString(
      undefined,
      {
        month: 'short',
        year: 'numeric'
      }
    );

  } catch {
    return 'recently';
  }

}


// ============================================================
// TOAST
// ============================================================

function showToast(
  message,
  type = 'info'
) {

  if (!toastContainer) {

    console.log(
      `[${type}] ${message}`
    );

    return;

  }

  const icons = {

    success:
      'fa-circle-check',

    error:
      'fa-circle-exclamation',

    info:
      'fa-circle-info'

  };

  const toast =
    document.createElement('div');

  toast.className =
    `toast toast--${type}`;

  const icon =
    document.createElement('i');

  icon.className =
    `fa-solid ${
      icons[type] ||
      icons.info
    }`;

  const text =
    document.createElement('span');

  text.textContent =
    message;

  toast.append(
    icon,
    text
  );

  toastContainer.appendChild(
    toast
  );

  setTimeout(
    () => {

      toast.classList.add(
        'is-leaving'
      );

      setTimeout(
        () => toast.remove(),
        400
      );

    },
    3800
  );

}


// ============================================================
// OWNER / ADMIN
// ============================================================

function getOwnerId() {

  const group =
    state.groupData;

  if (!group) {
    return null;
  }

  return (
    group.ownerId ||
    group.ownerUid ||
    group.createdBy ||
    group.creatorId ||
    null
  );

}


function isCurrentUserOwner() {

  const uid =
    state.currentUser?.uid;

  if (!uid) {
    return false;
  }

  if (
    state.membership?.role ===
    'owner'
  ) {

    return true;

  }

  const ownerId =
    getOwnerId();

  return (
    !!ownerId &&
    ownerId === uid
  );

}


function isCurrentUserAdmin() {

  const role =
    state.membership?.role;

  return [
    'admin',
    'moderator'
  ].includes(role);

}


function canManageGroup() {

  return (
    isCurrentUserOwner() ||
    isCurrentUserAdmin()
  );

}


function isActiveMember() {

  return (
    state.membership?.status ===
    'active'
  );

}


function canViewGroup() {

  const group =
    state.groupData;

  if (!group) {
    return false;
  }

  const privacy =
    String(
      group.privacy ||
      'public'
    ).toLowerCase();

  if (
    privacy !== 'private'
  ) {

    return true;

  }

  return (
    isActiveMember() ||
    canManageGroup()
  );

}


// ============================================================
// LOADING
// ============================================================

function hideLoader() {

  if (pageLoader) {

    pageLoader.classList.add(
      'is-hidden'
    );

  }

}


function showPage() {

  hideLoader();

  if (groupPageContent) {

    groupPageContent.classList.add(
      'is-visible'
    );

  }

}


function showNotFound() {

  hideLoader();

  if (groupNotFoundState) {

    groupNotFoundState.classList.add(
      'is-visible'
    );

  }

  if (groupPageContent) {

    groupPageContent.classList.remove(
      'is-visible'
    );

  }

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    try {

      if (!user) {

        window.location.href =
          'login.html';

        return;

      }

      state.currentUser =
        user;

      applyUserAvatar(user);

      await loadGroup();

    } catch (error) {

      console.error(
        'AUTH/GROUP ERROR:',
        error
      );

      showNotFound();

      showToast(
        'Unable to load this group.',
        'error'
      );

    }

  }
);


// ============================================================
// USER AVATAR
// ============================================================

function applyUserAvatar(user) {

  if (!navUserAvatar) {
    return;
  }

  applyMediaBackground(
    navUserAvatar,
    user.photoURL || '',
    initialsFrom(
      user.displayName ||
      'V'
    )
  );

}


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

  if (state.loading) {
    return;
  }

  if (!state.groupId) {

    console.error(
      'Missing group ID.'
    );

    showNotFound();

    showToast(
      'No group ID was provided.',
      'error'
    );

    return;
  }

  state.loading =
    true;

  try {

    const groupRef =
      doc(
        db,
        'groups',
        state.groupId
      );

    const groupSnap =
      await getDoc(
        groupRef
      );

    if (!groupSnap.exists()) {

      showNotFound();

      showToast(
        'This group no longer exists.',
        'error'
      );

      return;
    }

    state.groupData = {

      id:
        groupSnap.id,

      ...groupSnap.data()

    };

    // --------------------------------------------------------
    // LOAD MEMBERSHIP
    // --------------------------------------------------------

    const memberRef =
      doc(
        db,
        'groups',
        state.groupId,
        'members',
        state.currentUser.uid
      );

    try {

      const memberSnap =
        await getDoc(
          memberRef
        );

      state.membership =
        memberSnap.exists()
          ? {
              uid:
                state.currentUser.uid,

              ...memberSnap.data()
            }
          : null;

    } catch (error) {

      console.error(
        'Membership loading error:',
        error
      );

      state.membership =
        null;

    }

    // --------------------------------------------------------
    // OWNER ALWAYS GETS OWNER ACCESS
    // --------------------------------------------------------

    if (
      isCurrentUserOwner()
    ) {

      state.membership = {

        ...(state.membership || {}),

        uid:
          state.currentUser.uid,

        role:
          'owner',

        status:
          'active'

      };

    }

    renderHeader();

    renderSidebar();

    applyAccessControl();

    setupTabs();

    bindHeaderActions();

    await renderAdmins();

    showPage();

  } catch (error) {

    console.error(
      'GROUP LOAD ERROR:',
      error
    );

    showNotFound();

    showToast(
      'Unable to load this group.',
      'error'
    );

  } finally {

    state.loading =
      false;

    hideLoader();

  }

}


// ============================================================
// HEADER
// ============================================================

function renderHeader() {

  const group =
    state.groupData;

  if (!group) {
    return;
  }

  document.title =
    `${group.name || 'Group'} · VitalStar`;

  setText(
    navGroupTitle,
    group.name ||
    'VitalStar Group'
  );

  applyMediaBackground(
    groupCover,
    group.coverURL ||
    group.coverUrl ||
    group.coverPhoto ||
    '',
    ''
  );

  applyMediaBackground(
    groupAvatar,
    group.avatarURL ||
    group.avatarUrl ||
    group.photoURL ||
    group.photoUrl ||
    '',
    initialsFrom(
      group.name
    )
  );

  setText(
    groupName,
    group.name ||
    'VitalStar Group'
  );

  // ----------------------------------------------------------
  // PRIVACY
  // ----------------------------------------------------------

  if (groupPrivacyBadge) {

    const privacy =
      String(
        group.privacy ||
        'public'
      ).toLowerCase();

    if (
      privacy === 'private'
    ) {

      groupPrivacyBadge.className =
        'badge badge--private';

      groupPrivacyBadge.innerHTML =
        '<i class="fa-solid fa-lock"></i> Private';

    } else {

      groupPrivacyBadge.className =
        'badge badge--public';

      groupPrivacyBadge.innerHTML =
        '<i class="fa-solid fa-globe"></i> Public';

    }

  }

  // ----------------------------------------------------------
  // PREMIUM
  // ----------------------------------------------------------

  setDisplay(
    groupPremiumBadge,
    group.type === 'premium'
      ? 'inline-flex'
      : 'none'
  );

  // ----------------------------------------------------------
  // VERIFIED
  // ----------------------------------------------------------

  setDisplay(
    groupVerifiedBadge,
    group.verified === true
      ? 'inline-flex'
      : 'none'
  );

  // ----------------------------------------------------------
  // CATEGORY
  // ----------------------------------------------------------

  setText(
    groupCategoryChip,
    CATEGORY_LABELS[
      group.category
    ] ||
    group.category ||
    'General'
  );

  // ----------------------------------------------------------
  // OWNER
  // ----------------------------------------------------------

  const ownerName =
    group.ownerName ||
    group.ownerDisplayName ||
    group.creatorName ||
    (
      isCurrentUserOwner()
        ? (
            state.currentUser
              ?.displayName ||
            'You'
          )
        : 'a member'
    );

  setText(
    groupOwnerText,
    `Owned by ${ownerName}`
  );

  // ----------------------------------------------------------
  // CREATED
  // ----------------------------------------------------------

  setText(
    groupCreatedText,
    `Created ${formatDate(
      group.createdAt
    )}`
  );

  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  setText(
    groupDescription,
    group.description ||
    ''
  );

  // ----------------------------------------------------------
  // STATS
  // ----------------------------------------------------------

  setText(
    statMemberCount,
    formatCount(
      group.memberCount
    )
  );

  setText(
    statPostCount,
    formatCount(
      group.postCount
    )
  );

  setText(
    statOnlineCount,
    formatCount(
      group.onlineCount
    )
  );

  setText(
    statLevel,
    group.level ||
    1
  );

  renderJoinLeaveState();

  if (coverEditBtn) {

    coverEditBtn.classList.toggle(
      'is-visible',
      canManageGroup()
    );

  }

}


// ============================================================
// JOIN / LEAVE UI
// ============================================================

function renderJoinLeaveState() {

  if (!joinLeaveBtn) {
    return;
  }

  // OWNER
  if (
    isCurrentUserOwner()
  ) {

    joinLeaveBtn.style.display =
      'none';

    setDisplay(
      yourRoleTag,
      'inline-flex'
    );

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

  // ACTIVE MEMBER
  if (
    state.membership?.status ===
    'active'
  ) {

    joinLeaveBtn.style.display =
      'flex';

    joinLeaveBtn.disabled =
      false;

    joinLeaveBtn.className =
      'btn-join-leave is-member';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-check"></i> Joined';

    setDisplay(
      yourRoleTag,
      'inline-flex'
    );

    setText(
      yourRoleText,
      capitalize(
        state.membership.role ||
        'member'
      )
    );

    setDisplay(
      inviteBtn,
      'inline-flex'
    );

    return;
  }

  // PENDING
  if (
    state.membership?.status ===
    'pending'
  ) {

    joinLeaveBtn.style.display =
      'flex';

    joinLeaveBtn.disabled =
      false;

    joinLeaveBtn.className =
      'btn-join-leave is-pending';

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-clock"></i> Requested';

    setDisplay(
      yourRoleTag,
      'none'
    );

    setDisplay(
      inviteBtn,
      'none'
    );

    return;
  }

  // NOT MEMBER
  joinLeaveBtn.style.display =
    'flex';

  joinLeaveBtn.disabled =
    false;

  joinLeaveBtn.className =
    'btn-join-leave';

  joinLeaveBtn.innerHTML =
    '<i class="fa-solid fa-plus"></i> Join group';

  setDisplay(
    yourRoleTag,
    'none'
  );

  setDisplay(
    inviteBtn,
    'none'
  );

}


function capitalize(value) {

  const text =
    String(
      value ||
      'member'
    );

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );

}


// ============================================================
// SIDEBAR
// ============================================================

function renderSidebar() {

  if (!rulesListDisplay) {
    return;
  }

  const rules =
    Array.isArray(
      state.groupData?.rules
    )
      ? state.groupData.rules
      : [];

  rulesListDisplay.innerHTML =
    '';

  if (!rules.length) {

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

  rules.forEach(
    rule => {

      const li =
        document.createElement(
          'li'
        );

      li.textContent =
        String(rule);

      rulesListDisplay
        .appendChild(li);

    }
  );

}


// ============================================================
// ADMINS
// ============================================================

async function renderAdmins() {

  if (!adminsList) {
    return;
  }

  try {

    const membersRef =
      collection(
        db,
        'groups',
        state.groupId,
        'members'
      );

    const q =
      query(
        membersRef,
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
      await getDocs(q);

    adminsList
      .querySelectorAll(
        '.admin-row'
      )
      .forEach(
        row => row.remove()
      );

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

    const priority = {

      owner: 0,
      admin: 1,
      moderator: 2

    };

    const admins =
      snapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .sort(
          (a, b) =>
            (
              priority[a.role] ??
              9
            ) -
            (
              priority[b.role] ??
              9
            )
        );

    admins.forEach(
      admin => {

        const row =
          document.createElement(
            'div'
          );

        row.className =
          'admin-row';

        const avatar =
          document.createElement(
            'div'
          );

        avatar.className =
          'admin-avatar';

        applyMediaBackground(
          avatar,
          admin.photoURL ||
          admin.photoUrl ||
          '',
          initialsFrom(
            admin.displayName ||
            admin.fullName ||
            admin.name ||
            'V'
          )
        );

        const info =
          document.createElement(
            'div'
          );

        info.className =
          'admin-info';

        const name =
          document.createElement(
            'div'
          );

        name.className =
          'admin-name';

        name.textContent =
          admin.displayName ||
          admin.fullName ||
          admin.name ||
          'VitalStar Member';

        const role =
          document.createElement(
            'div'
          );

        role.className =
          'admin-role';

        role.textContent =
          capitalize(
            admin.role ||
            'member'
          );

        info.append(
          name,
          role
        );

        row.append(
          avatar,
          info
        );

        adminsList.appendChild(
          row
        );

      }
    );

  } catch (error) {

    console.error(
      'Admin loading error:',
      error
    );

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

  const canView =
    canViewGroup();

  if (lockedNotice) {

    lockedNotice.classList.toggle(
      'is-visible',
      !canView
    );

  }

  if (groupContentGrid) {

    groupContentGrid.style.display =
      canView
        ? ''
        : 'none';

  }

  setDisplay(
    subscriptionTabBtn,
    state.groupData?.type ===
      'premium'
      ? 'flex'
      : 'none'
  );

  setDisplay(
    settingsTabBtn,
    canManageGroup()
      ? 'flex'
      : 'none'
  );

  if (canView) {

    activateTab(
      state.activeTab ||
      'posts'
    );

  }

}


// ============================================================
// TABS
// ============================================================

function setupTabs() {

  if (
    !groupTabsNav ||
    tabsBound
  ) {
    return;
  }

  tabsBound =
    true;

  groupTabsNav.addEventListener(
    'click',
    event => {

      const button =
        event.target.closest(
          '.group-tab'
        );

      if (!button) {
        return;
      }

      const tab =
        button.dataset.tab;

      if (!tab) {
        return;
      }

      activateTab(tab);

    }
  );

}


function activateTab(tabName) {

  if (!tabName) {
    return;
  }

  // ----------------------------------------------------------
  // PRIVATE GROUP
  // ----------------------------------------------------------

  if (
    !canViewGroup() &&
    tabName !== 'posts'
  ) {

    showToast(
      'Join the group to access this section.',
      'info'
    );

    return;
  }

  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------

  if (
    tabName === 'settings' &&
    !canManageGroup()
  ) {

    showToast(
      'You do not have permission to manage this group.',
      'error'
    );

    return;
  }

  // ----------------------------------------------------------
  // PREMIUM
  // ----------------------------------------------------------

  if (
    tabName === 'subscription' &&
    state.groupData?.type !==
      'premium'
  ) {

    return;

  }

  state.activeTab =
    tabName;

  if (groupTabsNav) {

    groupTabsNav
      .querySelectorAll(
        '.group-tab'
      )
      .forEach(
        button => {

          button.classList.toggle(
            'is-active',
            button.dataset.tab ===
              tabName
          );

        }
      );

  }

  document
    .querySelectorAll(
      '.tab-panel'
    )
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
// TAB MODULE LOADER
// ============================================================

async function loadTabModuleIfNeeded(
  tabName
) {

  if (
    loadedTabModules.has(
      tabName
    )
  ) {

    return;

  }

  const loader =
    TAB_MODULE_LOADERS[tabName];

  if (!loader) {
    return;
  }

  const panel =
    document.getElementById(
      `${tabName}Tab`
    );

  try {

    const module =
      await loader();

    loadedTabModules.add(
      tabName
    );

    if (
      module &&
      typeof module.init ===
      'function'
    ) {

      await module.init(
        buildTabContext(panel)
      );

    }

  } catch (error) {

    console.error(
      `Failed to load ${tabName}:`,
      error
    );

    loadedTabModules.delete(
      tabName
    );

    if (!panel) {
      return;
    }

    panel.innerHTML = `
      <div class="tab-panel-placeholder">
        <i class="fa-solid fa-circle-exclamation"></i>
        <p>Unable to load this section.</p>
        <button
          type="button"
          class="retry-tab-btn"
        >
          Try again
        </button>
      </div>
    `;

    const retry =
      panel.querySelector(
        '.retry-tab-btn'
      );

    retry?.addEventListener(
      'click',
      () => {

        panel.innerHTML =
          '';

        loadTabModuleIfNeeded(
          tabName
        );

      }
    );

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

    postId:
      state.postId,

    requestedPostId:
      state.postId,

    showToast,

    formatCount,

    initialsFrom,

    applyMediaBackground,

    refreshHeaderStats,

    isCurrentUserOwner,

    isCurrentUserAdmin,

    canManageGroup,

    isActiveMember,

    canViewGroup,

    sendGroupNotification,

    getUserProfile

  };

}


// ============================================================
// REFRESH HEADER STATS
// ============================================================

async function refreshHeaderStats() {

  if (!state.groupId) {
    return;
  }

  try {

    const groupRef =
      doc(
        db,
        'groups',
        state.groupId
      );

    const snap =
      await getDoc(
        groupRef
      );

    if (!snap.exists()) {
      return;
    }

    state.groupData = {

      id:
        snap.id,

      ...snap.data()

    };

    if (
      isCurrentUserOwner()
    ) {

      state.membership = {

        ...(state.membership || {}),

        uid:
          state.currentUser.uid,

        role:
          'owner',

        status:
          'active'

      };

    }

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

    setText(
      statLevel,
      state.groupData.level ||
      1
    );

    setDisplay(
      settingsTabBtn,
      canManageGroup()
        ? 'flex'
        : 'none'
    );

    if (coverEditBtn) {

      coverEditBtn.classList.toggle(
        'is-visible',
        canManageGroup()
      );

    }

  } catch (error) {

    console.error(
      'Stats refresh error:',
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

  headerActionsBound =
    true;

  joinLeaveBtn?.addEventListener(
    'click',
    handleJoinLeaveClick
  );

  shareBtn?.addEventListener(
    'click',
    handleShareClick
  );

  inviteBtn?.addEventListener(
    'click',
    handleInviteClick
  );

  coverEditBtn?.addEventListener(
    'click',
    () => {

      if (!canManageGroup()) {

        showToast(
          'You do not have permission to edit this group.',
          'error'
        );

        return;
      }

      activateTab(
        'settings'
      );

    }
  );

  notificationBellBtn?.addEventListener(
    'click',
    toggleNotificationsPanel
  );

  closeNotificationsBtn?.addEventListener(
    'click',
    closeNotifications
  );

  if (
    !outsideNotificationBound
  ) {

    outsideNotificationBound =
      true;

    document.addEventListener(
      'click',
      handleOutsideNotificationClick
    );

  }

}


function closeNotifications() {

  notificationsPanel
    ?.classList
    .remove(
      'is-visible'
    );

}


function handleOutsideNotificationClick(
  event
) {

  if (
    !notificationsPanel ||
    !notificationBellBtn
  ) {

    return;

  }

  if (
    notificationsPanel.classList
      .contains(
        'is-visible'
      ) &&
    !notificationsPanel.contains(
      event.target
    ) &&
    !notificationBellBtn.contains(
      event.target
    )
  ) {

    closeNotifications();

  }

}


// ============================================================
// JOIN / LEAVE
// ============================================================

async function handleJoinLeaveClick() {

  if (
    isCurrentUserOwner()
  ) {

    return;

  }

  const membership =
    state.membership;

  if (!membership) {

    await joinGroup();

    return;

  }

  if (
    membership.status ===
    'pending'
  ) {

    await cancelJoinRequest();

    return;

  }

  if (
    membership.status ===
      'active' &&
    membership.role !==
      'owner'
  ) {

    await leaveGroup();

  }

}


// ============================================================
// USER PROFILE
// ============================================================

async function getUserProfile(
  uid
) {

  if (!uid) {
    return null;
  }

  try {

    const userSnap =
      await getDoc(
        doc(
          db,
          'users',
          uid
        )
      );

    if (
      userSnap.exists()
    ) {

      return {

        uid,

        ...userSnap.data()

      };

    }

  } catch (error) {

    console.error(
      'User profile lookup error:',
      error
    );

  }

  return null;

}


// ============================================================
// NOTIFICATION
// ============================================================

async function sendGroupNotification({

  recipientId,

  type,

  text,

  senderId = null,

  senderName = 'VitalStar Member',

  senderPhoto = '',

  groupId =
    state.groupId,

  groupName =
    state.groupData?.name ||
    'VitalStar Group',

  postId = null,

  chatId = null,

  requesterId = null,

  applicantId = null

}) {

  if (!recipientId) {
    return;
  }

  try {

    const notificationData = {

      receiverId:
        recipientId,

      recipientId:
        recipientId,

      senderId:
        senderId ||
        state.currentUser?.uid ||
        null,

      senderName:
        senderName ||
        'VitalStar Member',

      senderPhoto:
        senderPhoto ||
        '',

      senderPhotoURL:
        senderPhoto ||
        '',

      type:
        type ||
        'group',

      text:
        text ||
        '',

      message:
        text ||
        '',

      groupId:
        groupId ||
        null,

      groupName:
        groupName ||
        'VitalStar Group',

      read:
        false,

      createdAt:
        serverTimestamp(),

      url:
        groupId
          ? `group.html?id=${encodeURIComponent(
              groupId
            )}`
          : 'notifications.html'

    };

    if (postId) {

      notificationData.postId =
        postId;

      if (groupId) {

        notificationData.url =
          `group.html?id=${encodeURIComponent(
            groupId
          )}&tab=posts&postId=${encodeURIComponent(
            postId
          )}`;

      }

    }

    if (chatId) {

      notificationData.chatId =
        chatId;

    }

    if (requesterId) {

      notificationData.requesterId =
        requesterId;

    }

    if (applicantId) {

      notificationData.applicantId =
        applicantId;

    }

    await addDoc(
      collection(
        db,
        'notifications'
      ),
      notificationData
    );

  } catch (error) {

    console.error(
      'Group notification error:',
      error
    );

  }

}


// ============================================================
// JOIN REQUEST NOTIFICATION
// ============================================================

async function sendJoinRequestNotification() {

  const group =
    state.groupData;

  const user =
    state.currentUser;

  if (
    !group ||
    !user
  ) {

    return;

  }

  try {

    const recipients =
      new Set();

    const ownerId =
      getOwnerId();

    if (
      ownerId &&
      ownerId !== user.uid
    ) {

      recipients.add(
        ownerId
      );

    }

    const membersRef =
      collection(
        db,
        'groups',
        state.groupId,
        'members'
      );

    const adminsQuery =
      query(
        membersRef,

        where(
          'role',
          'in',
          [
            'admin',
            'moderator'
          ]
        ),

        where(
          'status',
          '==',
          'active'
        )

      );

    const adminsSnapshot =
      await getDocs(
        adminsQuery
      );

    adminsSnapshot.forEach(
      memberDoc => {

        const member =
          memberDoc.data();

        const uid =
          member.uid ||
          memberDoc.id;

        if (
          uid &&
          uid !== user.uid
        ) {

          recipients.add(
            uid
          );

        }

      }
    );

    if (!recipients.size) {
      return;
    }

    const profile =
      await getUserProfile(
        user.uid
      );

    const senderName =
      profile?.fullName ||
      profile?.displayName ||
      profile?.name ||
      user.displayName ||
      'VitalStar Member';

    const senderPhoto =
      profile?.photoURL ||
      profile?.photoUrl ||
      profile?.profilePhoto ||
      profile?.profilePicture ||
      user.photoURL ||
      '';

    const groupName =
      group.name ||
      'your group';

    await Promise.all(

      [...recipients].map(
        recipientId =>
          sendGroupNotification({

            recipientId,

            type:
              'group_join_request',

            text:
              `${senderName} requested to join ${groupName}.`,

            senderId:
              user.uid,

            senderName,

            senderPhoto,

            groupId:
              state.groupId,

            groupName,

            requesterId:
              user.uid,

            applicantId:
              user.uid

          })
      )

    );

  } catch (error) {

    console.error(
      'Join request notification error:',
      error
    );

  }

}


// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup() {

  if (
    !joinLeaveBtn ||
    !state.groupData ||
    !state.currentUser
  ) {

    return;

  }

  joinLeaveBtn.disabled =
    true;

  const group =
    state.groupData;

  const user =
    state.currentUser;

  const privacy =
    String(
      group.privacy ||
      'public'
    ).toLowerCase();

  const status =
    privacy === 'private'
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

    let alreadyExists =
      false;

    let profile =
      null;

    /*
     * IMPORTANT:
     * Firebase transactions should not perform
     * arbitrary Firestore reads after the transaction
     * has started. Load the user profile BEFORE
     * runTransaction().
     */

    profile =
      await getUserProfile(
        user.uid
      );

    const fullName =
      profile?.fullName ||
      profile?.displayName ||
      profile?.name ||
      user.displayName ||
      'VitalStar Member';

    const photoURL =
      profile?.photoURL ||
      profile?.photoUrl ||
      profile?.profilePhoto ||
      profile?.profilePicture ||
      user.photoURL ||
      '';

    await runTransaction(
      db,
      async transaction => {

        const memberSnap =
          await transaction.get(
            memberRef
          );

        if (
          memberSnap.exists()
        ) {

          alreadyExists =
            true;

          return;

        }

        transaction.set(
          memberRef,
          {

            uid:
              user.uid,

            displayName:
              fullName,

            fullName:
              fullName,

            photoURL:
              photoURL,

            role:
              'member',

            status:
              status,

            category:
              group.category ||
              '',

            joinedAt:
              serverTimestamp()

          }
        );

        if (
          status ===
          'active'
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
      alreadyExists
    ) {

      /*
       * Reload the membership so the UI reflects
       * whatever is actually in Firestore.
       */

      const existingSnap =
        await getDoc(
          memberRef
        );

      state.membership =
        existingSnap.exists()
          ? {
              uid:
                user.uid,

              ...existingSnap.data()
            }
          : null;

      renderJoinLeaveState();

      showToast(
        'You already have a membership record for this group.',
        'info'
      );

      return;

    }

    state.membership = {

      uid:
        user.uid,

      displayName:
        fullName,

      fullName:
        fullName,

      photoURL:
        photoURL,

      role:
        'member',

      status:
        status,

      category:
        group.category ||
        ''

    };

    if (
      status ===
      'active'
    ) {

      state.groupData.memberCount =
        (
          Number(
            state.groupData.memberCount
          ) || 0
        ) + 1;

    }

    if (
      status ===
      'pending'
    ) {

      await sendJoinRequestNotification();

    }

    renderJoinLeaveState();

    applyAccessControl();

    renderHeader();

    showToast(
      status === 'active'
        ? `You've joined ${group.name}.`
        : 'Join request sent for approval.',
      'success'
    );

  } catch (error) {

    console.error(
      'Join group error:',
      error
    );

    showToast(
      error?.message ||
      'Could not join this group.',
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

  if (!joinLeaveBtn) {
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
      'Join request cancelled.',
      'info'
    );

  } catch (error) {

    console.error(
      'Cancel request error:',
      error
    );

    showToast(
      'Could not cancel the request.',
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

  if (!state.groupData) {
    return;
  }

  if (
    !window.confirm(
      `Leave ${state.groupData.name}?`
    )
  ) {

    return;

  }

  if (!joinLeaveBtn) {
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

    let removed =
      false;

    let wasActive =
      false;

    await runTransaction(
      db,
      async transaction => {

        const memberSnap =
          await transaction.get(
            memberRef
          );

        if (
          !memberSnap.exists()
        ) {

          return;

        }

        const member =
          memberSnap.data();

        if (
          member.role ===
            'owner' ||
          isCurrentUserOwner()
        ) {

          return;

        }

        transaction.delete(
          memberRef
        );

        removed =
          true;

        if (
          member.status ===
          'active'
        ) {

          wasActive =
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

    if (
      isCurrentUserOwner()
    ) {

      return;

    }

    if (!removed) {

      state.membership =
        null;

      renderJoinLeaveState();

      return;

    }

    state.membership =
      null;

    if (wasActive) {

      state.groupData.memberCount =
        Math.max(
          0,
          (
            Number(
              state.groupData.memberCount
            ) || 0
          ) - 1
        );

    }

    renderJoinLeaveState();

    applyAccessControl();

    renderHeader();

    showToast(
      `You left ${state.groupData.name}.`,
      'info'
    );

  } catch (error) {

    console.error(
      'Leave group error:',
      error
    );

    showToast(
      'Could not leave the group.',
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
      typeof navigator.share ===
      'function'
    ) {

      await navigator.share({

        title:
          state.groupData?.name ||
          'VitalStar Group',

        text:
          state.groupData?.description ||
          '',

        url

      });

      return;

    }

    await copyText(url);

    showToast(
      'Group link copied.',
      'success'
    );

  } catch (error) {

    if (
      error?.name !==
      'AbortError'
    ) {

      console.error(
        'Share error:',
        error
      );

    }

  }

}


// ============================================================
// INVITE
// ============================================================

async function handleInviteClick() {

  try {

    await copyText(
      window.location.href
    );

    showToast(
      'Invite link copied.',
      'success'
    );

  } catch (error) {

    console.error(
      'Invite copy error:',
      error
    );

    showToast(
      'Could not copy the invite link.',
      'error'
    );

  }

}


// ============================================================
// COPY
// ============================================================

async function copyText(text) {

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {

    await navigator.clipboard.writeText(
      text
    );

    return;

  }

  const textarea =
    document.createElement(
      'textarea'
    );

  textarea.value =
    text;

  textarea.style.position =
    'fixed';

  textarea.style.left =
    '-9999px';

  textarea.style.opacity =
    '0';

  document.body.appendChild(
    textarea
  );

  textarea.focus();

  textarea.select();

  const copied =
    document.execCommand(
      'copy'
    );

  textarea.remove();

  if (!copied) {

    throw new Error(
      'Clipboard copy failed'
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

  const opening =
    !notificationsPanel.classList.contains(
      'is-visible'
    );

  notificationsPanel.classList.toggle(
    'is-visible',
    opening
  );

  if (
    !opening ||
    notificationsModuleLoaded
  ) {

    return;

  }

  try {

    const module =
      await import(
        './group-notifications.js'
      );

    notificationsModuleLoaded =
      true;

    if (
      module &&
      typeof module.init ===
      'function'
    ) {

      await module.init({

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
      'Notifications error:',
      error
    );

    notificationsModuleLoaded =
      false;

    showToast(
      'Notifications could not be loaded.',
      'error'
    );

  }

}


// ============================================================
// GLOBAL ERROR PROTECTION
// ============================================================

window.addEventListener(
  'unhandledrejection',
  event => {

    console.error(
      'Unhandled group promise:',
      event.reason
    );

  }
);

window.addEventListener(
  'error',
  event => {

    console.error(
      'Global group error:',
      event.error ||
      event.message
    );

  }
);


// ============================================================
// DEBUG
// ============================================================

console.log(
  'VitalStar group.js loaded.',
  {
    groupId:
      state.groupId,

    requestedTab:
      requestedTab,

    requestedPostId:
      requestedPostId
  }
);


// ============================================================
// END OF GROUP.JS
// ============================================================