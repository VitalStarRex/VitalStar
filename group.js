// ============================================================
// VITALSTAR — group.js
// The core controller for group.html. Loads the group document,
// determines the viewer's role, renders the header/sidebar,
// handles join/leave/share/invite, and lazily loads each tab's
// dedicated script (group-posts.js, group-members.js, etc.) the
// first time that tab is opened.
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
  orderBy,
  limit,
  getDocs,
  increment,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ============================================================
// Each tab is backed by its own module, loaded on first visit.
// Every tab module is expected to export an `init(ctx)` function.
// See the `buildTabContext()` function below for what `ctx` contains.
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

const CATEGORY_LABELS = {
  technology: 'Technology', gaming: 'Gaming', programming: 'Programming',
  music: 'Music', 'movies-tv': 'Movies & TV', anime: 'Anime', sports: 'Sports',
  education: 'Education', business: 'Business', entertainment: 'Entertainment',
  news: 'News', science: 'Science', fashion: 'Fashion', travel: 'Travel',
  politics: 'Politics', religion: 'Religion', general: 'General', other: 'Other'
};

// ============================================================
// STATE
// ============================================================
const state = {
  currentUser: null,
  groupId: new URLSearchParams(window.location.search).get('id'),
  groupData: null,
  membership: null,   // { status, role, category } | null
  activeTab: 'posts'
};

// ============================================================
// UTILITIES
// ============================================================
function showToast(message, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;
  toast.querySelector('span').textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3800);
}

function formatCount(num) {
  num = num || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${num}`;
}

function initialsFrom(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function applyMediaBackground(el, url, fallbackText) {
  if (url) {
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else if (fallbackText !== undefined) {
    el.textContent = fallbackText;
  }
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'recently';
  return timestamp.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
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
  if (user.photoURL) applyMediaBackground(navUserAvatar, user.photoURL);

  await loadGroup();
});

// ============================================================
// LOAD GROUP
// ============================================================
async function loadGroup() {
  if (!state.groupId) {
    showNotFound();
    return;
  }

  try {
    const groupRef = doc(db, 'groups', state.groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      showNotFound();
      return;
    }

    state.groupData = { id: groupSnap.id, ...groupSnap.data() };

    const memberRef = doc(db, 'groups', state.groupId, 'members', state.currentUser.uid);
    const memberSnap = await getDoc(memberRef);
    state.membership = memberSnap.exists() ? memberSnap.data() : null;

    renderHeader();
    renderSidebar();
    await renderAdmins();
    applyAccessControl();
    setupTabs();
    bindHeaderActions();

    pageLoader.classList.add('is-hidden');
    groupPageContent.classList.add('is-visible');
  } catch (error) {
    console.error('Error loading group:', error);
    showNotFound();
  }
}

function showNotFound() {
  pageLoader.classList.add('is-hidden');
  groupNotFoundState.classList.add('is-visible');
}

// ============================================================
// RENDER HEADER
// ============================================================
function renderHeader() {
  const group = state.groupData;

  document.title = `${group.name} · VitalStar`;
  navGroupTitle.textContent = group.name;

  if (group.coverURL) groupCover.style.backgroundImage = `url(${group.coverURL})`;
  applyMediaBackground(groupAvatar, group.avatarURL, group.avatarURL ? undefined : initialsFrom(group.name));
  if (!group.avatarURL) groupAvatar.innerHTML = initialsFrom(group.name);

  groupName.textContent = group.name;

  if (group.privacy === 'private') {
    groupPrivacyBadge.className = 'badge badge--private';
    groupPrivacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';
  } else {
    groupPrivacyBadge.className = 'badge badge--public';
    groupPrivacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';
  }

  groupPremiumBadge.style.display = group.type === 'premium' ? 'inline-flex' : 'none';
  groupVerifiedBadge.style.display = group.verified ? 'inline-flex' : 'none';

  groupCategoryChip.textContent = CATEGORY_LABELS[group.category] || group.category || 'General';
  groupOwnerText.textContent = `Owned by ${group.ownerName || 'a member'}`;
  groupCreatedText.textContent = `Created ${formatDate(group.createdAt)}`;
  groupDescription.textContent = group.description || '';

  statMemberCount.textContent = formatCount(group.memberCount);
  statPostCount.textContent = formatCount(group.postCount);
  statOnlineCount.textContent = formatCount(group.onlineCount);
  statLevel.textContent = group.level || 1;

  renderJoinLeaveState();

  const isOwnerOrAdmin = state.membership && ['owner', 'admin'].includes(state.membership.role);
  coverEditBtn.classList.toggle('is-visible', !!isOwnerOrAdmin);
}

function renderJoinLeaveState() {
  const membership = state.membership;

  if (membership && membership.role === 'owner') {
    joinLeaveBtn.style.display = 'none';
    yourRoleTag.classList.add('is-visible');
    yourRoleText.textContent = 'Owner';
    inviteBtn.style.display = 'inline-flex';
    return;
  }

  if (membership && ['admin', 'moderator', 'member'].includes(membership.role) && membership.status === 'active') {
    joinLeaveBtn.style.display = 'flex';
    joinLeaveBtn.disabled = false;
    joinLeaveBtn.className = 'btn-join-leave is-member';
    joinLeaveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Joined';
    yourRoleTag.classList.add('is-visible');
    yourRoleText.textContent = membership.role.charAt(0).toUpperCase() + membership.role.slice(1);
    inviteBtn.style.display = 'inline-flex';
    return;
  }

  if (membership && membership.status === 'pending') {
    joinLeaveBtn.style.display = 'flex';
    joinLeaveBtn.disabled = false;
    joinLeaveBtn.className = 'btn-join-leave is-pending';
    joinLeaveBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Requested';
    yourRoleTag.classList.remove('is-visible');
    inviteBtn.style.display = 'none';
    return;
  }

  // Not a member at all
  joinLeaveBtn.style.display = 'flex';
  joinLeaveBtn.disabled = false;
  joinLeaveBtn.className = 'btn-join-leave';
  joinLeaveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Join group';
  yourRoleTag.classList.remove('is-visible');
  inviteBtn.style.display = 'none';
}

// ============================================================
// RENDER SIDEBAR (rules + admins)
// ============================================================
function renderSidebar() {
  const rules = state.groupData.rules || [];
  rulesListDisplay.innerHTML = '';

  if (rules.length === 0) {
    rulesEmptyDisplay.style.display = 'block';
  } else {
    rulesEmptyDisplay.style.display = 'none';
    rules.forEach((rule) => {
      const li = document.createElement('li');
      li.textContent = rule;
      rulesListDisplay.appendChild(li);
    });
  }
}

async function renderAdmins() {
  try {
    const membersQuery = query(
      collection(db, 'groups', state.groupId, 'members'),
      where('role', 'in', ['owner', 'admin', 'moderator']),
      limit(10)
    );
    const snapshot = await getDocs(membersQuery);

    adminsList.querySelectorAll('.admin-row').forEach((el) => el.remove());

    if (snapshot.empty) {
      adminsEmptyDisplay.style.display = 'block';
      return;
    }
    adminsEmptyDisplay.style.display = 'none';

    const rolePriority = { owner: 0, admin: 1, moderator: 2 };
    const admins = snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3));

    admins.forEach((admin) => {
      const row = document.createElement('div');
      row.className = 'admin-row';

      const avatar = document.createElement('div');
      avatar.className = 'admin-avatar';
      applyMediaBackground(avatar, admin.photoURL, initialsFrom(admin.displayName));

      const info = document.createElement('div');
      info.className = 'admin-info';
      info.innerHTML = `
        <div class="admin-name"></div>
        <div class="admin-role"></div>
      `;
      info.querySelector('.admin-name').textContent = admin.displayName || 'VitalStar Member';
      info.querySelector('.admin-role').textContent = admin.role;

      row.appendChild(avatar);
      row.appendChild(info);
      adminsList.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading admins:', error);
  }
}

// ============================================================
// ACCESS CONTROL (private groups gate the tabs behind membership)
// ============================================================
function applyAccessControl() {
  const group = state.groupData;
  const isActiveMember = state.membership && state.membership.status === 'active';
  const canView = group.privacy === 'public' || isActiveMember;

  lockedNotice.classList.toggle('is-visible', !canView);
  groupContentGrid.style.display = canView ? 'grid' : 'none';

  const role = state.membership ? state.membership.role : null;
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  subscriptionTabBtn.style.display = group.type === 'premium' ? 'flex' : 'none';
  settingsTabBtn.style.display = isOwnerOrAdmin ? 'flex' : 'none';

  if (canView) {
    activateTab('posts');
  }
}

// ============================================================
// TABS
// ============================================================
function setupTabs() {
  groupTabsNav.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('.group-tab');
    if (!tabBtn) return;
    activateTab(tabBtn.dataset.tab);
  });
}

function activateTab(tabName) {
  state.activeTab = tabName;

  groupTabsNav.querySelectorAll('.group-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === tabName);
  });

  loadTabModuleIfNeeded(tabName);
}

async function loadTabModuleIfNeeded(tabName) {
  if (loadedTabModules.has(tabName)) return;
  const loader = TAB_MODULE_LOADERS[tabName];
  if (!loader) return;

  const panel = document.getElementById(`${tabName === 'posts' ? 'posts' : tabName}Tab`);

  try {
    const mod = await loader();
    loadedTabModules.add(tabName);
    if (typeof mod.init === 'function') {
      await mod.init(buildTabContext(panel));
    }
  } catch (error) {
    // Expected until that tab's script has been built — show a friendly
    // placeholder instead of a broken panel.
    console.warn(`Tab module for "${tabName}" isn't available yet:`, error);
    if (panel) {
      panel.innerHTML = `
        <div class="tab-panel-placeholder">
          This section is still being built out — check back soon.
        </div>
      `;
    }
  }
}

/**
 * Shared context handed to every lazily-loaded tab module so each
 * one doesn't need to re-fetch the group or re-implement auth/toast
 * plumbing. Tab modules should treat groupData as read-only; if they
 * change something (e.g. postCount), update Firestore directly and
 * call ctx.refreshHeaderStats() to reflect it here.
 */
function buildTabContext(panelEl) {
  return {
    db,
    auth,
    groupId: state.groupId,
    groupRef: doc(db, 'groups', state.groupId),
    groupData: state.groupData,
    currentUser: state.currentUser,
    membership: state.membership,
    panelEl,
    showToast,
    formatCount,
    initialsFrom,
    applyMediaBackground,
    refreshHeaderStats
  };
}

async function refreshHeaderStats() {
  try {
    const groupRef = doc(db, 'groups', state.groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) return;
    state.groupData = { id: snap.id, ...snap.data() };
    statMemberCount.textContent = formatCount(state.groupData.memberCount);
    statPostCount.textContent = formatCount(state.groupData.postCount);
    statOnlineCount.textContent = formatCount(state.groupData.onlineCount);
  } catch (error) {
    console.error('Error refreshing header stats:', error);
  }
}

// ============================================================
// HEADER ACTIONS — join / leave / share / invite / edit cover
// ============================================================
function bindHeaderActions() {
  joinLeaveBtn.addEventListener('click', handleJoinLeaveClick);
  shareBtn.addEventListener('click', handleShareClick);
  inviteBtn.addEventListener('click', handleInviteClick);
  coverEditBtn.addEventListener('click', () => activateTab('settings'));

  notificationBellBtn.addEventListener('click', toggleNotificationsPanel);
  closeNotificationsBtn.addEventListener('click', () => notificationsPanel.classList.remove('is-visible'));
  document.addEventListener('click', (event) => {
    if (
      notificationsPanel.classList.contains('is-visible') &&
      !notificationsPanel.contains(event.target) &&
      !notificationBellBtn.contains(event.target)
    ) {
      notificationsPanel.classList.remove('is-visible');
    }
  });
}

async function handleJoinLeaveClick() {
  const membership = state.membership;

  if (!membership) {
    await joinGroup();
  } else if (membership.status === 'pending') {
    await cancelJoinRequest();
  } else if (membership.role !== 'owner') {
    await leaveGroup();
  }
}

async function joinGroup() {
  joinLeaveBtn.disabled = true;
  const group = state.groupData;
  const user = state.currentUser;
  const isPrivate = group.privacy === 'private';
  const status = isPrivate ? 'pending' : 'active';

  const memberRef = doc(db, 'groups', state.groupId, 'members', user.uid);
  const groupRef = doc(db, 'groups', state.groupId);

  try {
    // Atomic: the member-doc creation and the memberCount increment either
    // both happen or neither does, and the transaction re-checks (server-side)
    // whether a member doc already exists before writing anything — so a
    // double-click, two open tabs, or a reload-then-click can never create a
    // duplicate membership or increment memberCount more than once.
    let alreadyMember = false;

    await runTransaction(db, async (transaction) => {
      const existingMemberSnap = await transaction.get(memberRef);
      if (existingMemberSnap.exists()) {
        alreadyMember = true;
        return;
      }

      transaction.set(memberRef, {
        uid: user.uid,
        displayName: user.displayName || 'VitalStar Member',
        photoURL: user.photoURL || '',
        role: 'member',
        status,
        category: group.category || '',
        joinedAt: serverTimestamp()
      });

      // Only bump memberCount for immediate (public) joins — a pending
      // private-group request must NOT count as a member yet.
      if (status === 'active') {
        transaction.update(groupRef, { memberCount: increment(1) });
      }
    });

    if (!alreadyMember && status === 'active') {
      state.groupData.memberCount = (state.groupData.memberCount || 0) + 1;
      statMemberCount.textContent = formatCount(state.groupData.memberCount);
    }

    state.membership = { status, role: 'member', category: group.category || '' };
    renderJoinLeaveState();
    applyAccessControl();
    showToast(isPrivate ? 'Request sent! An admin will review it soon.' : `You've joined ${group.name}.`, 'success');
  } catch (error) {
    console.error('Error joining group:', error);
    showToast('Could not join this group. Please try again.', 'error');
  } finally {
    joinLeaveBtn.disabled = false;
  }
}

async function cancelJoinRequest() {
  if (!window.confirm('Cancel your request to join this group?')) return;
  joinLeaveBtn.disabled = true;

  try {
    await deleteDoc(doc(db, 'groups', state.groupId, 'members', state.currentUser.uid));
    state.membership = null;
    renderJoinLeaveState();
    applyAccessControl();
    showToast('Your join request was cancelled.', 'info');
  } catch (error) {
    console.error('Error cancelling request:', error);
    showToast('Could not cancel the request. Please try again.', 'error');
  } finally {
    joinLeaveBtn.disabled = false;
  }
}

async function leaveGroup() {
  if (!window.confirm(`Leave ${state.groupData.name}? You'll need to rejoin to see its posts again.`)) return;
  joinLeaveBtn.disabled = true;

  const memberRef = doc(db, 'groups', state.groupId, 'members', state.currentUser.uid);
  const groupRef = doc(db, 'groups', state.groupId);

  try {
    // Atomic: only remove the membership doc and decrement memberCount if an
    // ACTIVE membership actually exists right now, re-checked server-side —
    // so a double-click, two open tabs, or a stale UI state can never
    // decrement more than once or decrement a membership that's already gone.
    let wasActiveMember = false;

    await runTransaction(db, async (transaction) => {
      const existingMemberSnap = await transaction.get(memberRef);
      if (!existingMemberSnap.exists()) {
        return; // already removed elsewhere — nothing to delete or decrement
      }

      const memberData = existingMemberSnap.data();
      transaction.delete(memberRef);

      if (memberData.status === 'active') {
        wasActiveMember = true;
        transaction.update(groupRef, { memberCount: increment(-1) });
      }
    });

    state.membership = null;

    if (wasActiveMember) {
      state.groupData.memberCount = Math.max(0, (state.groupData.memberCount || 1) - 1);
      statMemberCount.textContent = formatCount(state.groupData.memberCount);
    }

    renderJoinLeaveState();
    applyAccessControl();
    showToast(`You left ${state.groupData.name}.`, 'info');
  } catch (error) {
    console.error('Error leaving group:', error);
    showToast('Could not leave the group. Please try again.', 'error');
  } finally {
    joinLeaveBtn.disabled = false;
  }
}

async function handleShareClick() {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: state.groupData.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Group link copied to clipboard.', 'success');
    }
  } catch (error) {
    // User cancelling the native share sheet also lands here — not an error.
    if (error.name !== 'AbortError') {
      console.error('Error sharing group:', error);
    }
  }
}

async function handleInviteClick() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Invite link copied — share it to invite people.', 'success');
  } catch (error) {
    console.error('Error copying invite link:', error);
    showToast('Could not copy the invite link.', 'error');
  }
}

// ============================================================
// NOTIFICATIONS PANEL (lazily loads group-notifications.js)
// ============================================================
async function toggleNotificationsPanel() {
  const willShow = !notificationsPanel.classList.contains('is-visible');
  notificationsPanel.classList.toggle('is-visible', willShow);
  if (!willShow || notificationsModuleLoaded) return;

  try {
    const mod = await import('./group-notifications.js');
    notificationsModuleLoaded = true;
    if (typeof mod.init === 'function') {
      await mod.init({
        db,
        auth,
        currentUser: state.currentUser,
        groupId: state.groupId,
        listEl: notificationsList,
        unreadDotEl: notifUnreadDot,
        showToast
      });
    }
  } catch (error) {
    console.warn('Notifications module isn\'t available yet:', error);
  }
}
