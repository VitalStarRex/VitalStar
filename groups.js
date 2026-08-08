// ============================================================
// VITALSTAR — groups.js
// Handles: auth guard, trending rail, category filtering,
// search (via searchTokens), Discover / Recommended / My Groups
// tabs, join / request-to-join logic, and pagination.
//
// This file preserves the exact Firestore field names, collection
// paths, and DOM element IDs used elsewhere in the VitalStar
// project (as established by the previous version of this file
// and by create-group.js's data shape). Nothing has been renamed.
// ============================================================

import { auth, db } from './firebase.js';
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  runTransaction,
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
// (Every reference below is looked up once. Some of these elements
// are optional depending on which page/version of groups.html is
// loaded, so every place we USE them checks for null first — see
// the safe$() helpers below. This means a missing optional element
// degrades a feature gracefully instead of throwing and killing
// the whole script.)
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
  if (!toastContainer) return; // toast container is optional UI chrome
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
// FIRESTORE ERROR LOGGING
//
// When a Firestore query needs a composite index that doesn't exist yet,
// the SDK rejects with code 'failed-precondition' and a message that
// embeds a direct console link to create that exact index. That link is
// the single most useful piece of debugging info you'll get from
// Firestore, so it must never be swallowed — every catch block below
// that touches a Firestore call passes its error through this function
// FIRST, before showing the generic user-facing toast.
//
// This never replaces the toast — it runs alongside it. The toast is for
// the user; this console output is for you (or whoever's debugging).
// ============================================================
function logFirestoreError(context, error) {
  console.error(`[Firestore error] ${context}`);
  console.error(error); // full error object — preserves stack trace, code, everything

  if (error && error.code) {
    console.error(`  code: ${error.code}`);
  }
  if (error && error.message) {
    console.error(`  message: ${error.message}`);

    // 'failed-precondition' index errors embed a console URL in the message
    // that looks like: https://console.firebase.google.com/project/.../firestore/indexes?create_composite=...
    const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com\S*/);
    if (urlMatch) {
      console.error(`  ➜ This looks like a missing-index error. Create it here: ${urlMatch[0]}`);
    } else if (error.code === 'failed-precondition') {
      console.error('  ➜ This is a failed-precondition error but no index-creation URL was found in the message — check the message above for details.');
    }
  }
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
  if (!el) return;
  if (url) {
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else if (fallbackText !== undefined) {
    el.textContent = fallbackText;
  }
}

// Safe text-setter — no-ops if the node wasn't found in a template
// (protects against a template markup change breaking the whole script).
function setText(root, selector, value) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value;
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

  try {
    await loadUserMemberships();
    await loadTrending();
    await loadGroupsForActiveView(true);
  } catch (error) {
    logFirestoreError('Initializing groups page (auth guard)', error);
    showToast('Something went wrong loading groups. Please refresh.', 'error');
  }
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
    // Memberships silently degrade (join buttons just show as "not joined")
    // rather than blocking the page, but the real error still needs to be
    // visible for debugging — never swallow it.
    logFirestoreError('Loading user memberships (collectionGroup "members" query)', error);
  }
}

// ============================================================
// TRENDING RAIL
// ============================================================
async function loadTrending() {
  if (!trendingList || !trendingSection || !trendingCardTemplate) return; // optional section

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
      const card = buildTrendingCard(group, rank);
      if (card) trendingList.appendChild(card);
    });
  } catch (error) {
    // Trending is optional — never let it block the main Groups page.
    logFirestoreError('Loading trending groups (privacy + memberCount query)', error);
    trendingSection.style.display = 'none';
  }
}

function buildTrendingCard(group, rank) {
  const template = trendingCardTemplate.content.firstElementChild;
  if (!template) return null;
  const node = template.cloneNode(true);
  node.href = `group.html?id=${group.id}`;
  setText(node, '.trending-card__rank', `#${rank}`);

  const cover = node.querySelector('.trending-card__cover');
  if (cover && group.coverURL) {
    cover.style.backgroundImage = `url(${group.coverURL})`;
  }

  const avatar = node.querySelector('.trending-card__avatar');
  applyMediaBackground(avatar, group.avatarURL, initialsFrom(group.name));

  setText(node, '.trending-card__name', group.name || 'Untitled group');
  setText(node, '.trending-card__member-count', formatCount(group.memberCount || 0));

  return node;
}

// ============================================================
// GROUP CARD BUILDER (Discover / Recommended / My Groups grid)
// ============================================================
function buildGroupCard(group) {
  if (!groupCardTemplate) return null;
  const template = groupCardTemplate.content.firstElementChild;
  if (!template) return null;
  const node = template.cloneNode(true);
  node.href = `group.html?id=${group.id}`;
  node.dataset.groupId = group.id;

  const cover = node.querySelector('.group-card__cover');
  if (cover && group.coverURL) cover.style.backgroundImage = `url(${group.coverURL})`;

  const avatar = node.querySelector('.group-card__avatar');
  applyMediaBackground(avatar, group.avatarURL, initialsFrom(group.name));

  setText(node, '.group-card__name', group.name || 'Untitled group');

  const privacyBadge = node.querySelector('.group-card__privacy-badge');
  if (privacyBadge) {
    if (group.privacy === 'private') {
      privacyBadge.className = 'badge badge--private group-card__privacy-badge';
      privacyBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private';
    } else {
      privacyBadge.className = 'badge badge--public group-card__privacy-badge';
      privacyBadge.innerHTML = '<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public';
    }
  }

  const premiumBadge = node.querySelector('.group-card__premium-badge');
  if (premiumBadge) premiumBadge.style.display = group.type === 'premium' ? 'inline-flex' : 'none';

  const verifiedBadge = node.querySelector('.group-card__verified-badge');
  if (verifiedBadge) verifiedBadge.style.display = group.verified ? 'inline-flex' : 'none';

  setText(node, '.group-card__desc', group.description || '');
  setText(node, '.group-card__member-count', formatCount(group.memberCount || 0));
  setText(node, '.group-card__post-count', formatCount(group.postCount || 0));
  setText(node, '.group-card__online-count', formatCount(group.onlineCount || 0));

  const joinBtn = node.querySelector('.group-card__join-btn');
  if (joinBtn) {
    applyJoinButtonState(joinBtn, group.id);
    joinBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleJoinClick(group, joinBtn);
    });
  }

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
//
// This runs as a Firestore transaction so that:
//   1) A double-click, or the same user joining from two open tabs,
//      can never create two member docs or double-increment memberCount.
//   2) The memberCount increment and the member doc creation succeed
//      or fail together — never one without the other.
//
// A pending (private-group) request never touches memberCount; only
// an 'active' (public-group) join does, and only once, because the
// transaction re-checks membership existence server-side before
// writing anything.
// ============================================================
async function handleJoinClick(group, buttonEl) {
  if (state.membershipMap.has(group.id)) return; // already joined or pending (client-side fast path)

  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Joining…';

  const user = state.currentUser;
  const isPrivate = group.privacy === 'private';
  const status = isPrivate ? 'pending' : 'active';

  const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
  const groupRef = doc(db, 'groups', group.id);

  try {
    await runTransaction(db, async (transaction) => {
      const existingMemberSnap = await transaction.get(memberRef);
      if (existingMemberSnap.exists()) {
        // Someone/something already created this membership — do nothing further.
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
    // Not an index-related error (this is a transaction, not a query), but
    // still logged in full — a generic toast alone would hide the real cause
    // (e.g. permission-denied from security rules) from anyone debugging.
    console.error('[Firestore error] Joining group (transaction)');
    console.error(error);
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
    showToast('Could not join this group. Please try again.', 'error');
  }
}

// ============================================================
// MAIN GRID LOADING — routes to the right query for the active tab
// ============================================================
async function loadGroupsForActiveView(reset) {
  if (state.isLoading || !groupsGrid) return;
  state.isLoading = true;

  if (reset) {
    state.lastVisibleDoc = null;
    groupsGrid.innerHTML = '';
    renderSkeletons(6);
    if (groupsEmptyState) groupsEmptyState.style.display = 'none';
  }
  if (loadMoreBtn) {
    loadMoreBtn.style.display = 'none';
    loadMoreBtn.classList.add('is-loading');
  }

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
      if (groupsEmptyMessage) groupsEmptyMessage.textContent = buildEmptyMessage();
      if (groupsEmptyState) groupsEmptyState.style.display = 'flex';
    } else if (groupsEmptyState) {
      groupsEmptyState.style.display = 'none';
    }

    groups.forEach((group) => {
      const card = buildGroupCard(group);
      if (card) groupsGrid.appendChild(card);
    });

    if (loadMoreBtn) loadMoreBtn.style.display = state.hasMore ? 'block' : 'none';
  } catch (error) {
    // This catches errors from fetchDiscoverGroups / fetchRecommendedGroups /
    // fetchMyGroups / fetchSearchResults, whichever ran for the active tab.
    // Include the active tab + category + search query in the log so a
    // missing-index error can be traced straight back to the exact query
    // shape that triggered it.
    logFirestoreError(
      `Loading groups (tab: ${state.activeTab}, category: ${state.activeCategory}, search: "${state.searchQuery}")`,
      error
    );
    clearSkeletons();
    showToast('Could not load groups right now. Please try again.', 'error');
  } finally {
    if (loadMoreBtn) loadMoreBtn.classList.remove('is-loading');
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
// where(privacy) + optional where(category) + orderBy(createdAt) is a
// standard composite query. Firestore will prompt you (via a console
// link in the error message) to create the needed composite index the
// first time this runs in a fresh project — that's expected and correct,
// not a bug to work around. Errors here propagate up to
// loadGroupsForActiveView's catch block, which logs them in full.
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
// IMPORTANT FIX: Firestore does not allow two different inequality-style
// filters on the SAME field in one query — specifically, you cannot mix
// `where('category', 'in', [...])` with `where('category', '==', x)` on
// the same field at once (this combination is invalid and previously
// would have thrown at runtime whenever a category chip was active on
// the Recommended tab). The fix: if a specific category chip is active,
// that single '==' filter is strictly more precise than the 'in' list,
// so we use ONLY the '==' filter in that case and skip the 'in' filter
// entirely. The 'in' filter (recommend from the user's joined
// categories) is only used when the chip is on "All". Errors here also
// propagate up to loadGroupsForActiveView's catch block.
async function fetchRecommendedGroups(reset) {
  const constraints = [where('privacy', '==', 'public')];

  if (state.activeCategory !== 'all') {
    constraints.push(where('category', '==', state.activeCategory));
  } else {
    const joinedCategories = Array.from(
      new Set(state.membershipList.map((m) => m.category).filter(Boolean))
    ).slice(0, 10); // 'in' supports a maximum of 10 values
    if (joinedCategories.length > 0) {
      constraints.push(where('category', 'in', joinedCategories));
    }
  }

  constraints.push(orderBy('memberCount', 'desc'));
  if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));
  constraints.push(limit(PAGE_SIZE));

  const snapshot = await getDocs(query(collection(db, 'groups'), ...constraints));
  const groups = consumeSnapshot(snapshot);

  // Don't recommend groups the user already belongs to or has requested to join
  // (membershipMap holds an entry for BOTH 'active' and 'pending' statuses).
  // Note: this client-side filter can shrink a page below PAGE_SIZE; hasMore
  // is still driven by the raw (pre-filter) snapshot size in consumeSnapshot,
  // so "Load More" will keep fetching until either results run out or the
  // grid is full — this is the safest behavior without a backend function.
  return groups.filter((group) => !state.membershipMap.has(group.id));
}

// ---- My Groups (client-paginated over the already-loaded membership list) ----
// No Firestore query index is needed here — this reads individual docs by
// ID (getDoc), not a filtered/ordered query, so there's nothing for
// logFirestoreError's index-URL matching to find. Errors here (e.g. a
// permission-denied on one of the getDoc calls) still propagate up to
// loadGroupsForActiveView's catch block and get logged in full there.
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
//
// create-group.js builds PROGRESSIVE PREFIX tokens per word, e.g. for the
// word "gaming" it stores: g, ga, gam, gami, gamin, gaming.
//
// KNOWN LIMITATION (please read before changing this):
// searchTokens only stores per-word prefixes — it has no concept of word
// ORDER or of requiring ALL typed words to match. That means Firestore's
// `array-contains-any` can only give us an OR match: "does this group
// contain AT LEAST ONE of the typed words as a prefix token?" There is no
// Firestore-native way to require ALL words to match without either a
// dedicated search service (Algolia/Meilisearch/etc — explicitly out of
// scope here) or a Cloud Function (also out of scope). Introducing either
// would mean inventing a new backend, which the project rules for this
// file forbid.
//
// The safest compatible fix, using only the existing searchTokens data:
//   1. Query Firestore with array-contains-any over the typed words
//      (server-side OR pre-filter, keeps reads bounded to PAGE_SIZE).
//   2. Client-side, narrow that page down to only groups whose
//      searchTokens actually contain EVERY typed word (AND refinement).
// This makes a multi-word query like "cool gaming" behave the way users
// expect (both words must match) instead of matching any group containing
// either word alone — without adding any new backend or index type.
//
// Trade-off: because step 2 filters after the Firestore read, a returned
// page can contain fewer than PAGE_SIZE cards even when more matches exist
// further down the collection. "Load More" still works correctly (it just
// continues fetching subsequent raw pages via the same cursor), so no
// results are silently lost — they just arrive across more "Load More"
// clicks. This is the standard trade-off of doing AND-refinement on top of
// an OR-only index, and is normal/expected without a real search backend.
// Errors here propagate up to loadGroupsForActiveView's catch block.
async function fetchSearchResults(reset) {
  const words = state.searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10); // array-contains-any supports a maximum of 10 values

  if (words.length === 0) return [];

  const constraints = [where('searchTokens', 'array-contains-any', words)];
  if (state.activeCategory !== 'all') constraints.push(where('category', '==', state.activeCategory));
  constraints.push(limit(PAGE_SIZE));
  if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));

  const snapshot = await getDocs(query(collection(db, 'groups'), ...constraints));
  const groups = consumeSnapshot(snapshot);

  // AND-refinement: keep only groups whose searchTokens contain every
  // typed word (not just at least one of them).
  return groups.filter((group) => {
    const tokens = group.searchTokens || [];
    return words.every((word) => tokens.includes(word));
  });
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
  if (!skeletonCardTemplate || !groupsGrid) return;
  const template = skeletonCardTemplate.content.firstElementChild;
  if (!template) return;
  for (let i = 0; i < count; i++) {
    const node = template.cloneNode(true);
    node.dataset.skeleton = 'true';
    groupsGrid.appendChild(node);
  }
}

function clearSkeletons() {
  if (!groupsGrid) return;
  groupsGrid.querySelectorAll('[data-skeleton="true"]').forEach((el) => el.remove());
}

// ============================================================
// TABS
// (Switching tabs always resets: searchQuery, the pagination cursor,
// and myGroupsPageIndex — via loadGroupsForActiveView(true) — so no
// pagination state leaks between Discover / Recommended / My Groups.)
// ============================================================
if (tabsContainer) {
  tabsContainer.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('.tab');
    if (!tabBtn || tabBtn.classList.contains('is-active')) return;

    tabsContainer.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
    tabBtn.classList.add('is-active');

    state.activeTab = tabBtn.dataset.tab;
    state.searchQuery = '';
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('is-visible');

    loadGroupsForActiveView(true);
  });
}

// ============================================================
// CATEGORY CHIPS
// ============================================================
if (categoryChipsContainer) {
  categoryChipsContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('.category-chip');
    if (!chip || chip.classList.contains('is-active')) return;

    categoryChipsContainer.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');

    state.activeCategory = chip.dataset.category;
    loadGroupsForActiveView(true);
  });
}

// ============================================================
// SEARCH
// ============================================================
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const value = searchInput.value.trim();
    if (searchClearBtn) searchClearBtn.classList.toggle('is-visible', value.length > 0);

    clearTimeout(state.searchDebounceHandle);

    if (value.length === 0) {
      state.searchQuery = '';
      if (searchLoading) searchLoading.classList.remove('is-visible');
      loadGroupsForActiveView(true);
      return;
    }

    if (searchLoading) searchLoading.classList.add('is-visible');
    state.searchDebounceHandle = setTimeout(() => {
      state.searchQuery = value.toLowerCase();
      if (searchLoading) searchLoading.classList.remove('is-visible');
      loadGroupsForActiveView(true);
    }, 400);
  });
}

if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn.classList.remove('is-visible');
    state.searchQuery = '';
    loadGroupsForActiveView(true);
  });
}

// ============================================================
// LOAD MORE
// ============================================================
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    loadGroupsForActiveView(false);
  });
}
