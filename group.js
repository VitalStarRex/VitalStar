// ============================================================
// VITALSTAR — group.js
// Main controller for group.html
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


// ============================================================
// DOM
// ============================================================

const navUserAvatar = document.getElementById('navUserAvatar');
const navGroupTitle = document.getElementById('navGroupTitle');

const pageLoader = document.getElementById('pageLoader');
const groupNotFoundState = document.getElementById('groupNotFoundState');
const groupPageContent = document.getElementById('groupPageContent');

const groupCover = document.getElementById('groupCover');
const coverEditBtn = document.getElementById('coverEditBtn');
const groupAvatar = document.getElementById('groupAvatar');

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
  activeTab: 'posts',
  loading: false
};


// ============================================================
// HELPERS
// ============================================================

function setText(el, value) {
  if (el) el.textContent = value ?? '';
}


function setDisplay(el, value) {
  if (el) el.style.display = value;
}


function formatCount(value) {

  const num = Number(value) || 0;

  if (num >= 1000000) {
    return `${(num / 1000000)
      .toFixed(1)
      .replace('.0', '')}M`;
  }

  if (num >= 1000) {
    return `${(num / 1000)
      .toFixed(1)
      .replace('.0', '')}K`;
  }

  return String(num);
}


function initialsFrom(name) {

  return String(name || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
}


function applyMediaBackground(el, url, fallbackText = '') {

  if (!el) return;

  if (url) {

    el.style.backgroundImage =
      `url("${String(url).replace(/"/g, '\\"')}")`;

    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';

  } else {

    el.style.backgroundImage = '';
    el.textContent = fallbackText || '';

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

  const icon = document.createElement('i');
  icon.className =
    `fa-solid ${icons[type] || icons.info}`;

  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);
  toastContainer.appendChild(toast);

  setTimeout(() => {

    toast.classList.add('is-leaving');

    setTimeout(() => {
      toast.remove();
    }, 400);

  }, 3800);
}


// ============================================================
// OWNER / ADMIN
// ============================================================

function isCurrentUserOwner() {

  const uid = state.currentUser?.uid;

  if (!uid || !state.groupData) {
    return false;
  }

  return [
    state.groupData.ownerId,
    state.groupData.ownerUid,
    state.groupData.createdBy,
    state.groupData.creatorId
  ]
    .filter(Boolean)
    .includes(uid);
}


function isCurrentUserAdmin() {

  return [
    'admin',
    'moderator'
  ].includes(
    state.membership?.role
  );
}


function canManageGroup() {

  return (
    isCurrentUserOwner() ||
    state.membership?.role === 'owner' ||
    isCurrentUserAdmin()
  );
}


function isActiveMember() {

  return (
    state.membership?.status === 'active'
  );
}


function canViewGroup() {

  if (!state.groupData) {
    return false;
  }

  if (
    state.groupData.privacy !== 'private'
  ) {
    return true;
  }

  return isActiveMember() || canManageGroup();
}


// ============================================================
// LOADING
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

  if (groupPageContent) {
    groupPageContent.classList.remove('is-visible');
  }
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async user => {

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  state.currentUser = user;

  applyUserAvatar(user);

  await loadGroup();

});


function applyUserAvatar(user) {

  if (!navUserAvatar) return;

  applyMediaBackground(
    navUserAvatar,
    user.photoURL || '',
    initialsFrom(
      user.displayName || 'V'
    )
  );
}


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

  if (state.loading) return;

  if (!state.groupId) {

    console.error('Missing group ID.');

    showNotFound();

    return;
  }

  state.loading = true;

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


    const groupSnap =
      await getDoc(groupRef);

    if (!groupSnap.exists()) {

      showNotFound();

      showToast(
        'This group no longer exists.',
        'error'
      );

      return;
    }


    state.groupData = {
      id: groupSnap.id,
      ...groupSnap.data()
    };


    try {

      const memberSnap =
        await getDoc(memberRef);

      state.membership =
        memberSnap.exists()
          ? {
              uid: state.currentUser.uid,
              ...memberSnap.data()
            }
          : null;

    } catch (error) {

      console.error(
        'Membership error:',
        error
      );

      state.membership = null;
    }


    if (isCurrentUserOwner()) {

      state.membership = {
        ...(state.membership || {}),
        uid: state.currentUser.uid,
        role: 'owner',
        status: 'active'
      };

    }


    renderHeader();
    renderSidebar();
    applyAccessControl();
    setupTabs();
    bindHeaderActions();

    renderAdmins().catch(error => {
      console.error(
        'Admin rendering error:',
        error
      );
    });

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

    state.loading = false;
    hideLoader();

  }

}


// ============================================================
// HEADER
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


  applyMediaBackground(
    groupCover,
    group.coverURL || group.coverUrl || '',
    ''
  );


  applyMediaBackground(
    groupAvatar,
    group.avatarURL || group.avatarUrl || '',
    initialsFrom(group.name)
  );


  setText(
    groupName,
    group.name || 'VitalStar Group'
  );


  if (groupPrivacyBadge) {

    if (group.privacy === 'private') {

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


  setDisplay(
    groupPremiumBadge,
    group.type === 'premium'
      ? 'inline-flex'
      : 'none'
  );


  setDisplay(
    groupVerifiedBadge,
    group.verified === true
      ? 'inline-flex'
      : 'none'
  );


  setText(
    groupCategoryChip,
    CATEGORY_LABELS[group.category] ||
    group.category ||
    'General'
  );


  const ownerName =
    group.ownerName ||
    group.ownerDisplayName ||
    (
      isCurrentUserOwner()
        ? (
            state.currentUser?.displayName ||
            'You'
          )
        : 'a member'
    );

  setText(
    groupOwnerText,
    `Owned by ${ownerName}`
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

  if (!joinLeaveBtn) return;


  if (
    isCurrentUserOwner() ||
    state.membership?.role === 'owner'
  ) {

    joinLeaveBtn.style.display = 'none';

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


  if (
    state.membership &&
    state.membership.status === 'active'
  ) {

    joinLeaveBtn.style.display = 'flex';

    joinLeaveBtn.disabled = false;

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
        state.membership.role || 'member'
      )
    );

    setDisplay(
      inviteBtn,
      'inline-flex'
    );

    return;
  }


  if (
    state.membership?.status === 'pending'
  ) {

    joinLeaveBtn.style.display = 'flex';

    joinLeaveBtn.disabled = false;

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


  joinLeaveBtn.style.display = 'flex';

  joinLeaveBtn.disabled = false;

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

  const text = String(value || 'member');

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}


// ============================================================
// SIDEBAR
// ============================================================

function renderSidebar() {

  if (!rulesListDisplay) return;

  const rules =
    Array.isArray(state.groupData?.rules)
      ? state.groupData.rules
      : [];

  rulesListDisplay.innerHTML = '';

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


  rules.forEach(rule => {

    const li =
      document.createElement('li');

    li.textContent =
      String(rule);

    rulesListDisplay.appendChild(li);

  });

}


// ============================================================
// ADMINS
// ============================================================

async function renderAdmins() {

  if (!adminsList) return;


  try {

    const q = query(
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
      await getDocs(q);


    adminsList
      .querySelectorAll('.admin-row')
      .forEach(row => row.remove());


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
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .sort(
          (a, b) =>
            (priority[a.role] ?? 9) -
            (priority[b.role] ?? 9)
        );


    admins.forEach(admin => {

      const row =
        document.createElement('div');

      row.className = 'admin-row';


      const avatar =
        document.createElement('div');

      avatar.className =
        'admin-avatar';


      applyMediaBackground(
        avatar,
        admin.photoURL || '',
        initialsFrom(
          admin.displayName ||
          admin.fullName ||
          'V'
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
        admin.fullName ||
        'VitalStar Member';


      const role =
        document.createElement('div');

      role.className =
        'admin-role';

      role.textContent =
        capitalize(
          admin.role || 'member'
        );


      info.append(
        name,
        role
      );

      row.append(
        avatar,
        info
      );

      adminsList.appendChild(row);

    });

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
      canView ? 'grid' : 'none';

  }


  setDisplay(
    subscriptionTabBtn,
    state.groupData?.type === 'premium'
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
      state.activeTab || 'posts'
    );

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

      const button =
        event.target.closest('.group-tab');

      if (!button) return;

      const tab =
        button.dataset.tab;

      if (!tab) return;

      activateTab(tab);

    }
  );

}


function activateTab(tabName) {

  if (!tabName) return;


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


  if (
    tabName === 'subscription' &&
    state.groupData?.type !== 'premium'
  ) {
    return;
  }


  state.activeTab =
    tabName;


  if (groupTabsNav) {

    groupTabsNav
      .querySelectorAll('.group-tab')
      .forEach(button => {

        button.classList.toggle(
          'is-active',
          button.dataset.tab === tabName
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


  loadTabModuleIfNeeded(tabName);

}


// ============================================================
// TAB MODULE LOADER
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

    const module =
      await loader();


    loadedTabModules.add(tabName);


    if (
      module &&
      typeof module.init === 'function'
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


    if (!panel) return;


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


    if (retry) {

      retry.addEventListener(
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

    refreshHeaderStats,

    isCurrentUserOwner,
    isCurrentUserAdmin,
    canManageGroup,
    isActiveMember,
    canViewGroup

  };

}


// ============================================================
// REFRESH STATS
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


    if (isCurrentUserOwner()) {

      state.membership = {
        ...(state.membership || {}),
        uid: state.currentUser.uid,
        role: 'owner',
        status: 'active'
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
      state.groupData.level || 1
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

  headerActionsBound = true;


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

      activateTab('settings');

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


  document.addEventListener(
    'click',
    handleOutsideNotificationClick
  );

}


function closeNotifications() {

  notificationsPanel
    ?.classList
    .remove('is-visible');

}


function handleOutsideNotificationClick(event) {

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
    membership.status === 'pending'
  ) {

    await cancelJoinRequest();

    return;
  }


  if (
    membership.status === 'active' &&
    membership.role !== 'owner'
  ) {

    await leaveGroup();

  }

}


// ============================================================
// GROUP JOIN REQUEST NOTIFICATION
// ============================================================

async function sendJoinRequestNotification() {

  const group =
    state.groupData;

  const user =
    state.currentUser;


  if (!group || !user) {
    return;
  }


  try {

    const recipients =
      new Set();


    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    const ownerId =
      group.ownerId ||
      group.ownerUid ||
      group.createdBy ||
      group.creatorId;


    if (
      ownerId &&
      ownerId !== user.uid
    ) {

      recipients.add(
        ownerId
      );

    }


    // --------------------------------------------------------
    // ADMINS / MODERATORS
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // NO RECIPIENTS
    // --------------------------------------------------------

    if (!recipients.size) {
      return;
    }


    const senderName =
      user.displayName ||
      'VitalStar Member';


    const groupName =
      group.name ||
      'your group';


    // --------------------------------------------------------
    // CREATE NOTIFICATIONS
    // --------------------------------------------------------

    await Promise.all(

      [...recipients].map(
        async recipientId => {

          await addDoc(
            collection(
              db,
              'notifications'
            ),
            {

              // Receiver
              recipientId,

              // Compatibility with
              // existing notification systems
              receiverId:
                recipientId,


              // Sender
              senderId:
                user.uid,

              senderName,

              senderPhotoURL:
                user.photoURL || '',


              // Notification type
              type:
                'group_join_request',


              // Group
              groupId:
                state.groupId,

              groupName,


              // Message
              message:
                `${senderName} requested to join ${groupName}.`,


              // Status
              read:
                false,


              // Timestamp
              createdAt:
                serverTimestamp(),


              // Destination
              url:
                `group.html?id=${encodeURIComponent(
                  state.groupId
                )}`

            }
          );

        }
      )

    );


  } catch (error) {

    // Notification failure should
    // never cancel the join request.

    console.error(
      'Join request notification error:',
      error
    );

  }

}


// ============================================================
// JOIN
// ============================================================

async function joinGroup() {

  if (
    !joinLeaveBtn ||
    !state.groupData ||
    !state.currentUser
  ) {
    return;
  }


  joinLeaveBtn.disabled = true;


  const group =
    state.groupData;

  const user =
    state.currentUser;


  const status =
    group.privacy === 'private'
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

    let alreadyExists = false;


    await runTransaction(
      db,
      async transaction => {

        const memberSnap =
          await transaction.get(
            memberRef
          );


        if (memberSnap.exists()) {

          alreadyExists = true;

          return;
        }


        transaction.set(
          memberRef,
          {
            uid: user.uid,

            displayName:
              user.displayName ||
              'VitalStar Member',

            fullName:
              user.displayName ||
              'VitalStar Member',

            photoURL:
              user.photoURL ||
              '',

            role: 'member',

            status,

            category:
              group.category || '',

            joinedAt:
              serverTimestamp()
          }
        );


        if (status === 'active') {

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


    if (alreadyExists) {

      showToast(
        'You are already a member of this group.',
        'info'
      );

      return;
    }


    state.membership = {

      uid: user.uid,

      displayName:
        user.displayName ||
        'VitalStar Member',

      fullName:
        user.displayName ||
        'VitalStar Member',

      photoURL:
        user.photoURL || '',

      role: 'member',

      status,

      category:
        group.category || ''

    };


    if (status === 'active') {

      state.groupData.memberCount =
        (
          Number(
            state.groupData.memberCount
          ) || 0
        ) + 1;

    }


    // --------------------------------------------------------
    // PRIVATE GROUP NOTIFICATION
    // --------------------------------------------------------

    if (
      status === 'pending'
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
      'Could not join this group.',
      'error'
    );

  } finally {

    joinLeaveBtn.disabled = false;

  }

}


// ============================================================
// CANCEL REQUEST
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

  joinLeaveBtn.disabled = true;


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


    state.membership = null;

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

    joinLeaveBtn.disabled = false;

  }

}


// ============================================================
// LEAVE
// ============================================================

async function leaveGroup() {

  if (!state.groupData) return;


  if (
    !window.confirm(
      `Leave ${state.groupData.name}?`
    )
  ) {
    return;
  }


  if (!joinLeaveBtn) return;

  joinLeaveBtn.disabled = true;


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

    let removed = false;
    let wasActive = false;


    await runTransaction(
      db,
      async transaction => {

        const memberSnap =
          await transaction.get(
            memberRef
          );


        if (!memberSnap.exists()) {
          return;
        }


        const member =
          memberSnap.data();


        if (
          member.role === 'owner' ||
          isCurrentUserOwner()
        ) {
          return;
        }


        transaction.delete(
          memberRef
        );


        removed = true;


        if (
          member.status === 'active'
        ) {

          wasActive = true;

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


    if (isCurrentUserOwner()) {
      return;
    }


    if (!removed) {

      state.membership = null;

      renderJoinLeaveState();

      return;
    }


    state.membership = null;


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
      'Could not leave this group.',
      'error'
    );

  } finally {

    joinLeaveBtn.disabled = false;

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
      typeof navigator.share === 'function'
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
      error?.name !== 'AbortError'
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
    document.createElement('textarea');

  textarea.value = text;

  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);

  textarea.select();

  const copied =
    document.execCommand('copy');

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
    !notificationsPanel
      .classList
      .contains('is-visible');


  notificationsPanel
    .classList
    .toggle(
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


    notificationsModuleLoaded = true;


    if (
      module &&
      typeof module.init === 'function'
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


// ============================================================
// END OF GROUP.JS
// ============================================================