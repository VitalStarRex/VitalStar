// ============================================================
// VITALSTAR — groups.js
// Handles: auth guard, trending rail, category filtering,
// search (via searchTokens), Discover / Recommended / My Groups
// tabs, join / request-to-join logic, and pagination.
// ============================================================

import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const PAGE_SIZE = 12;

// ============================================================
// DOM REFERENCES
// ============================================================
const navUserAvatar = document.getElementById('navUserAvatar');

const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const searchLoading = document.getElementById('searchLoading');

const categoryChipsContainer = document.getElementById('categoryChips');
const tabsContainer = document.getElementById('groupTabs');

const trendingList = document.getElementById('trendingList');
const trendingSection = document.getElementById('trendingSection');

const groupsGrid = document.getElementById('groupsGrid');
const groupsEmptyState = document.getElementById('groupsEmptyState');
const groupsEmptyMessage = document.getElementById('groupsEmptyMessage');
const loadMoreBtn = document.getElementById('loadMoreBtn');

const toastContainer = document.getElementById('toast-container');

const groupCardTemplate = document.getElementById('groupCardTemplate');
const trendingCardTemplate = document.getElementById('trendingCardTemplate');
const skeletonCardTemplate = document.getElementById('skeletonCardTemplate');

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
  activeTab: 'discover',       // discover | recommended | my-groups
  activeCategory: 'all',
  searchQuery: '',
  searchDebounceHandle: null,

  lastVisibleDoc: null,
  hasMore: false,
  isLoading: false,

  // groupId -> { status: 'active' | 'pending', role, category }
  membershipMap: new Map(),
  // sorted array of { groupId, status, role, category, joinedAt } for My Groups tab
  membershipList: [],
  myGroupsPageIndex: 0
};

// ============================================================
// TOASTS
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

// ============================================================
// UTILITIES
// ============================================================
function formatCount(num) {
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

// ============================================================
// AUTH GUARD
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  state.currentUser = user;

  if (user.photoURL) {
    applyMediaBackground(navUserAvatar, user.photoURL);
  }

  await loadUserMemberships();
  await loadTrending();
  await loadGroupsForActiveView(true);
});

// ============================================================
// LOAD THE CURRENT USER'S MEMBERSHIPS
// (used for join-button state, My Groups tab, and Recommended)
// ============================================================
async function loadUserMemberships() {
  try {
    const membersQuery = query(
      collectionGroup(db, 'members'),
      where('uid', '==', state.currentUser.uid),
      limit(300)
    );
    const snapshot = await getDocs(membersQuery);

    state.membershipMap.clear();
    const list = [];

    snapshot.forEach((memberDoc) => {
      const groupId = memberDoc.ref.parent.parent.id;
      const data = memberDoc.data();
      state.membershipMap.set(groupId, {
        status: data.status,
        role: data.role,
        category: data.category || ''
      });
      list.push({
        groupId,
        status: data.status,
        role: data.role,
        category: data.category || '',
        joinedAt: data.joinedAt ? data.joinedAt.toMillis() : 0
      });
    });

    list.sort((a, b) => b.joinedAt - a.joinedAt);
    state.membershipList = list;
  } catch (error) {
    console.error('Error loading memberships:', error);
  }
}

// ============================================================
// TRENDING RAIL
// ============================================================
async function loadTrending() {
  try {
    const trendingQuery = query(
      collection(db, 'groups'),
      where('privacy', '==', 'public'),
      orderBy('memberCount', 'desc'),
      limit(6)
    );
    const snapshot = await getDocs(trendingQuery);

    trendingList.innerHTML = '';

    if (snapshot.empty) {
      trendingSection.style.display = 'none';
      return;
    }
    trendingSection.style.display = 'block';

    let rank = 0;
    snapshot.forEach((groupDoc) => {
      rank += 1;
      const group = { id: groupDoc.id, ...groupDoc.data() };
      trendingList.appendChild(buildTrendingCard(group, rank));
    });
  } catch (error) {
    console.error('Error loading trending groups:', error);
    trendingSection.style.display = 'none';
  }
}

function buildTrendingCard(group, rank) {
  const node = trendingCardTemplate.content.firstElementChild.cloneNode(true);
  node.href = `group.html?id=${group.id}`;
  node.querySelector('.trending-card__rank').textContent = `#${rank}`;

  const cover = node.querySelector('.trending-card__cover');
  if (group.coverURL) {
    cover.style.backgroundImage = `url(${group.coverURL})`;
  }

  const avatar = node.querySelector('.trending-card__avatar');
  applyMediaBackground(avatar, group.avatarURL, initialsFrom(group.name));

  node.querySelector('.trending-card__name').textContent = group.name || 'Untitled group';
  node.querySelector('.trending-card__member-count').textContent = formatCount(group.memberCount || 0);

  return node;
}

// ============================================================
// GROUP CARD BUILDER (Discover / Recommended / My Groups grid)
// ============================================================
function buildGroupCard(group) {
  const node = groupCardTemplate.content.firstElementChild.cloneNode(true);
  node.href = `group.html?id=${group.id}`;
  node.dataset.groupId = group.id;

  const cover = node.querySelector('.group-card__cover');
  if (group.coverURL) cover.style.backgroundImage = `url(${group.coverURL})`;

  const avatar = node.querySelector('.group-card__avatar');
  applyMediaBackground(avatar, group.avatarURL, initialsFrom(group.name));

  node.querySelector('.group-card__name').textContent = group.name || 'Untitled group';

  const privacyBadge = node.querySelector('.group-card__privacy-badge');
  if (group.privacy === 'private') {
    privacyBadge.className = 'badge badge--private group-card__privacy-badge';
    privacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';
  } else {
    privacyBadge.className = 'badge badge--public group-card__privacy-badge';
    privacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';
  }

  const premiumBadge = node.querySelector('.group-card__premium-badge');
  premiumBadge.style.display = group.type === 'premium' ? 'inline-flex' : 'none';

  const verifiedBadge = node.querySelector('.group-card__verified-badge');
  verifiedBadge.style.display = group.verified ? 'inline-flex' : 'none';

  node.querySelector('.group-card__desc').textContent = group.description || '';
  node.querySelector('.group-card__member-count').textContent = formatCount(group.memberCount || 0);
  node.querySelector('.group-card__post-count').textContent = formatCount(group.postCount || 0);
  node.querySelector('.group-card__online-count').textContent = formatCount(group.onlineCount || 0);

  const joinBtn = node.querySelector('.group-card__join-btn');
  applyJoinButtonState(joinBtn, group.id);

  joinBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleJoinClick(group, joinBtn);
  });

  return node;
}

function applyJoinButtonState(buttonEl, groupId) {
  const membership = state.membershipMap.get(groupId);

  buttonEl.className = 'btn-join group-card__join-btn';
  buttonEl.disabled = false;

  if (!membership) {
    buttonEl.textContent = 'Join group';
    buttonEl.classList.add('is-primary');
  } else if (membership.status === 'pending') {
    buttonEl.textContent = 'Requested';
    buttonEl.classList.add('is-pending');
    buttonEl.disabled = true;
  } else {
    buttonEl.textContent = '✓ Joined';
    buttonEl.disabled = true;
  }
}

// ============================================================
// JOIN / REQUEST TO JOIN
// ============================================================
async function handleJoinClick(group, buttonEl) {
  if (state.membershipMap.has(group.id)) return; // already joined or pending

  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Joining…';

  try {
    const user = state.currentUser;
    const isPrivate = group.privacy === 'private';
    const status = isPrivate ? 'pending' : 'active';

    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    await setDoc(memberRef, {
      uid: user.uid,
      displayName: user.displayName || 'VitalStar Member',
      photoURL: user.photoURL || '',
      role: 'member',
      status,
      category: group.category || '',
      joinedAt: serverTimestamp()
    });

    if (status === 'active') {
      const groupRef = doc(db, 'groups', group.id);
      await updateDoc(groupRef, { memberCount: increment(1) });
    }

    state.membershipMap.set(group.id, { status, role: 'member', category: group.category || '' });
    state.membershipList.unshift({
      groupId: group.id,
      status,
      role: 'member',
      category: group.category || '',
      joinedAt: Date.now()
    });

    applyJoinButtonState(buttonEl, group.id);
    showToast(
      isPrivate ? 'Request sent! An admin will review it soon.' : `You've joined ${group.name}.`,
      'success'
    );
  } catch (error) {
    console.error('Error joining group:', error);
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
    showToast('Could not join this group. Please try again.', 'error');
  }
}

// ============================================================
// MAIN GRID LOADING — routes to the right query for the active tab
// ============================================================
async function loadGroupsForActiveView(reset) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (reset) {
    state.lastVisibleDoc = null;
    groupsGrid.innerHTML = '';
    renderSkeletons(6);
    groupsEmptyState.style.display = 'none';
  }
  loadMoreBtn.style.display = 'none';
  loadMoreBtn.classList.add('is-loading');

  try {
    let groups = [];

    if (state.searchQuery) {
      groups = await fetchSearchResults(reset);
    } else if (state.activeTab === 'discover') {
      groups = await fetchDiscoverGroups(reset);
    } else if (state.activeTab === 'recommended') {
      groups = await fetchRecommendedGroups(reset);
    } else if (state.activeTab === 'my-groups') {
      groups = await fetchMyGroups(reset);
    }

    if (reset) groupsGrid.innerHTML = '';
    clearSkeletons();

    if (groups.length === 0 && reset) {
      groupsEmptyMessage.textContent = buildEmptyMessage();
      groupsEmptyState.style.display = 'flex';
    } else {
      groupsEmptyState.style.display = 'none';
    }

    groups.forEach((group) => groupsGrid.appendChild(buildGroupCard(group)));

    loadMoreBtn.style.display = state.hasMore ? 'block' : 'none';
  } catch (error) {
    console.error('Error loading groups:', error);
    clearSkeletons();
    showToast('Could not load groups right now. Please try again.', 'error');
  } finally {
    loadMoreBtn.classList.remove('is-loading');
    state.isLoading = false;
  }
}

function buildEmptyMessage() {
  if (state.searchQuery) return `No groups matched "${state.searchQuery}". Try a different search.`;
  if (state.activeTab === 'my-groups') return "You haven't joined or created any groups yet.";
  if (state.activeCategory !== 'all') return `No groups in ${CATEGORY_LABELS[state.activeCategory] || state.activeCategory} yet — be the first!`;
  return 'Try a different category, or start your own community.';
}

// ---- Discover ----
async function fetchDiscoverGroups(reset) {
  const constraints = [where('privacy', '==', 'public')];
  if (state.activeCategory !== 'all') constraints.push(where('category', '==', state.activeCategory));
  constraints.push(orderBy('createdAt', 'desc'));
  if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));
  constraints.push(limit(PAGE_SIZE));

  const snapshot = await getDocs(query(collection(db, 'groups'), ...constraints));
  return consumeSnapshot(snapshot);
}

// ---- Recommended ----
async function fetchRecommendedGroups(reset) {
  const joinedCategories = Array.from(
    new Set(state.membershipList.map((m) => m.category).filter(Boolean))
  ).slice(0, 10);

  const constraints = [where('privacy', '==', 'public')];
  if (joinedCategories.length > 0) {
    constraints.push(where('category', 'in', joinedCategories));
  }
  if (state.activeCategory !== 'all') constraints.push(where('category', '==', state.activeCategory));
  constraints.push(orderBy('memberCount', 'desc'));
  if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));
  constraints.push(limit(PAGE_SIZE));

  const snapshot = await getDocs(query(collection(db, 'groups'), ...constraints));
  const groups = consumeSnapshot(snapshot);

  // Don't recommend groups the user already belongs to
  return groups.filter((group) => !state.membershipMap.has(group.id));
}

// ---- My Groups (client-paginated over the already-loaded membership list) ----
async function fetchMyGroups(reset) {
  if (reset) state.myGroupsPageIndex = 0;

  let list = state.membershipList;
  if (state.activeCategory !== 'all') {
    list = list.filter((m) => m.category === state.activeCategory);
  }

  const start = state.myGroupsPageIndex * PAGE_SIZE;
  const pageIds = list.slice(start, start + PAGE_SIZE).map((m) => m.groupId);
  state.myGroupsPageIndex += 1;
  state.hasMore = start + PAGE_SIZE < list.length;

  if (pageIds.length === 0) {
    state.hasMore = false;
    return [];
  }

  const docs = await Promise.all(pageIds.map((id) => getDoc(doc(db, 'groups', id))));
  return docs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Search (uses the searchTokens array built at group-creation time) ----
async function fetchSearchResults(reset) {
  const token = state.searchQuery.toLowerCase();
  const constraints = [where('searchTokens', 'array-contains', token)];
  if (state.activeCategory !== 'all') constraints.push(where('category', '==', state.activeCategory));
  constraints.push(limit(PAGE_SIZE));
  if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));

  const snapshot = await getDocs(query(collection(db, 'groups'), ...constraints));
  return consumeSnapshot(snapshot);
}

function consumeSnapshot(snapshot) {
  const docs = snapshot.docs;
  state.lastVisibleDoc = docs.length > 0 ? docs[docs.length - 1] : state.lastVisibleDoc;
  state.hasMore = docs.length === PAGE_SIZE;
  return docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ============================================================
// SKELETON LOADING STATE
// ============================================================
function renderSkeletons(count) {
  for (let i = 0; i < count; i++) {
    const node = skeletonCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.skeleton = 'true';
    groupsGrid.appendChild(node);
  }
}

function clearSkeletons() {
  groupsGrid.querySelectorAll('[data-skeleton="true"]').forEach((el) => el.remove());
}

// ============================================================
// TABS
// ============================================================
tabsContainer.addEventListener('click', (event) => {
  const tabBtn = event.target.closest('.tab');
  if (!tabBtn || tabBtn.classList.contains('is-active')) return;

  tabsContainer.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
  tabBtn.classList.add('is-active');

  state.activeTab = tabBtn.dataset.tab;
  state.searchQuery = '';
  searchInput.value = '';
  searchClearBtn.classList.remove('is-visible');

  loadGroupsForActiveView(true);
});

// ============================================================
// CATEGORY CHIPS
// ============================================================
categoryChipsContainer.addEventListener('click', (event) => {
  const chip = event.target.closest('.category-chip');
  if (!chip || chip.classList.contains('is-active')) return;

  categoryChipsContainer.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');

  state.activeCategory = chip.dataset.category;
  loadGroupsForActiveView(true);
});

// ============================================================
// SEARCH
// ============================================================
searchInput.addEventListener('input', () => {
  const value = searchInput.value.trim();
  searchClearBtn.classList.toggle('is-visible', value.length > 0);

  clearTimeout(state.searchDebounceHandle);

  if (value.length === 0) {
    state.searchQuery = '';
    searchLoading.classList.remove('is-visible');
    loadGroupsForActiveView(true);
    return;
  }

  searchLoading.classList.add('is-visible');
  state.searchDebounceHandle = setTimeout(() => {
    state.searchQuery = value.toLowerCase();
    searchLoading.classList.remove('is-visible');
    loadGroupsForActiveView(true);
  }, 400);
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchClearBtn.classList.remove('is-visible');
  state.searchQuery = '';
  loadGroupsForActiveView(true);
});

// ========================================