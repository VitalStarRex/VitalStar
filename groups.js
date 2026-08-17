// ============================================================
// VITALSTAR — groups.js
// ============================================================
// Handles:
//   • Authentication
//   • Trending groups
//   • Top 5 most active groups
//   • New groups
//   • Category filtering
//   • Search
//   • Discover
//   • Recommended
//   • My Groups
//       ├── Groups I Created
//       └── Groups I Joined
//   • Join / request-to-join
//   • Better pagination
//   • Skeleton loading
//
// Existing Firestore paths are preserved:
//
//   groups/{groupId}
//   groups/{groupId}/members/{uid}
//
// Existing group fields are preserved:
//
//   name
//   description
//   avatarURL
//   coverURL
//   privacy
//   type
//   category
//   verified
//   memberCount
//   postCount
//   onlineCount
//   createdAt
//   searchTokens
//
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
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 12;
const RAIL_LIMIT = 5;
const TRENDING_LIMIT = 6;


// ============================================================
// DOM
// ============================================================

const navUserAvatar = document.getElementById('navUserAvatar');

const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const searchLoading = document.getElementById('searchLoading');

const categoryChipsContainer =
  document.getElementById('categoryChips');

const tabsContainer =
  document.getElementById('groupTabs');

const groupsGrid =
  document.getElementById('groupsGrid');

const groupsEmptyState =
  document.getElementById('groupsEmptyState');

const groupsEmptyMessage =
  document.getElementById('groupsEmptyMessage');

const loadMoreBtn =
  document.getElementById('loadMoreBtn');

const toastContainer =
  document.getElementById('toast-container');


// Optional sections

const trendingList =
  document.getElementById('trendingList');

const trendingSection =
  document.getElementById('trendingSection');

const activeGroupsList =
  document.getElementById('activeGroupsList');

const activeGroupsSection =
  document.getElementById('activeGroupsSection');

const newGroupsList =
  document.getElementById('newGroupsList');

const newGroupsSection =
  document.getElementById('newGroupsSection');

const recommendedList =
  document.getElementById('recommendedList');

const recommendedSection =
  document.getElementById('recommendedSection');


// Templates

const groupCardTemplate =
  document.getElementById('groupCardTemplate');

const trendingCardTemplate =
  document.getElementById('trendingCardTemplate');

const skeletonCardTemplate =
  document.getElementById('skeletonCardTemplate');


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

  activeTab: 'discover',

  activeCategory: 'all',

  searchQuery: '',

  searchDebounceHandle: null,

  lastVisibleDoc: null,

  hasMore: false,

  isLoading: false,

  // Prevents repeated requests while changing tabs/categories.
  requestVersion: 0,

  // groupId -> membership
  membershipMap: new Map(),

  // Membership records.
  membershipList: [],

  // Groups created by the current user.
  createdGroups: [],

  // Pagination for My Groups.
  myGroupsPageIndex: 0,

  // IDs already displayed in the current grid.
  displayedGroupIds: new Set()
};


// ============================================================
// TOAST
// ============================================================

function showToast(message, type = 'info') {

  if (!toastContainer) return;

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
// FIRESTORE ERROR LOGGER
// ============================================================

function logFirestoreError(context, error) {

  console.error(`[Firestore error] ${context}`);

  console.error(error);

  if (error?.code) {
    console.error(`code: ${error.code}`);
  }

  if (error?.message) {

    console.error(`message: ${error.message}`);

    const match =
      error.message.match(
        /https:\/\/console\.firebase\.google\.com\S*/
      );

    if (match) {

      console.error(
        `Create the required Firestore index here: ${match[0]}`
      );
    }
  }
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


function applyMediaBackground(
  el,
  url,
  fallbackText = ''
) {

  if (!el) return;

  if (url) {

    el.style.backgroundImage =
      `url("${url}")`;

    el.style.backgroundSize = 'cover';

    el.style.backgroundPosition =
      'center';

    el.textContent = '';

  } else {

    el.style.backgroundImage = '';

    el.textContent = fallbackText;
  }
}


function setText(root, selector, value) {

  if (!root) return;

  const el =
    root.querySelector(selector);

  if (el) {
    el.textContent = value ?? '';
  }
}


function getTimestampValue(value) {

  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  if (typeof value === 'number') {
    return value;
  }

  return 0;
}


// ============================================================
// CREATOR DETECTION
// ============================================================
//
// Different versions of create-group.js may have used one of these
// creator fields. This helper supports them without changing the
// existing group document.
//
// ============================================================

function isGroupCreatedByUser(group, uid) {

  if (!group || !uid) return false;

  const creatorFields = [
    'ownerId',
    'creatorId',
    'createdBy',
    'createdByUid',
    'creatorUid'
  ];

  return creatorFields.some(
    field => group[field] === uid
  );
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href = 'login.html';

    return;
  }

  state.currentUser = user;

  if (user.photoURL) {

    applyMediaBackground(
      navUserAvatar,
      user.photoURL
    );
  }

  try {

    await loadUserMemberships();

    await Promise.all([
      loadTrending(),
      loadTopActiveGroups(),
      loadNewGroups(),
      loadRecommendedRail()
    ]);

    await loadGroupsForActiveView(true);

  } catch (error) {

    logFirestoreError(
      'Initializing Groups page',
      error
    );

    showToast(
      'Something went wrong loading groups.',
      'error'
    );
  }
});


// ============================================================
// LOAD USER MEMBERSHIPS
// ============================================================

async function loadUserMemberships() {

  try {

    const membersQuery = query(
      collectionGroup(db, 'members'),
      where(
        'uid',
        '==',
        state.currentUser.uid
      ),
      limit(500)
    );

    const snapshot =
      await getDocs(membersQuery);

    state.membershipMap.clear();

    const list = [];

    snapshot.forEach(memberDoc => {

      const parentGroup =
        memberDoc.ref.parent.parent;

      if (!parentGroup) return;

      const groupId =
        parentGroup.id;

      const data =
        memberDoc.data();

      state.membershipMap.set(
        groupId,
        {
          status: data.status || 'active',
          role: data.role || 'member',
          category: data.category || ''
        }
      );

      list.push({

        groupId,

        status:
          data.status || 'active',

        role:
          data.role || 'member',

        category:
          data.category || '',

        joinedAt:
          getTimestampValue(data.joinedAt)
      });
    });

    list.sort(
      (a, b) => b.joinedAt - a.joinedAt
    );

    state.membershipList = list;

    // Now find groups the user created.
    await loadCreatedGroups();

  } catch (error) {

    logFirestoreError(
      'Loading user memberships',
      error
    );

    state.membershipMap.clear();
    state.membershipList = [];

    await loadCreatedGroups();
  }
}


// ============================================================
// LOAD CREATED GROUPS
// ============================================================
//
// We intentionally check several possible creator field names.
//
// This means My Groups can still work if create-group.js stored:
//   ownerId
//   creatorId
//   createdBy
//   createdByUid
//   creatorUid
//
// ============================================================

async function loadCreatedGroups() {

  const uid =
    state.currentUser?.uid;

  if (!uid) return;

  const found =
    new Map();

  const creatorFields = [
    'ownerId',
    'creatorId',
    'createdBy',
    'createdByUid',
    'creatorUid'
  ];

  for (const field of creatorFields) {

    try {

      const q = query(
        collection(db, 'groups'),
        where(field, '==', uid),
        limit(100)
      );

      const snapshot =
        await getDocs(q);

      snapshot.forEach(groupDoc => {

        found.set(
          groupDoc.id,
          {
            id: groupDoc.id,
            ...groupDoc.data()
          }
        );
      });

    } catch (error) {

      // Some fields may not exist in the current schema.
      // We log the error but continue checking the others.

      logFirestoreError(
        `Checking created groups using "${field}"`,
        error
      );
    }
  }

  state.createdGroups =
    Array.from(found.values());

  state.createdGroups.sort(
    (a, b) =>
      getTimestampValue(b.createdAt) -
      getTimestampValue(a.createdAt)
  );
}


// ============================================================
// TRENDING
// ============================================================

async function loadTrending() {

  if (
    !trendingList ||
    !trendingSection ||
    !trendingCardTemplate
  ) {
    return;
  }

  try {

    const q = query(
      collection(db, 'groups'),
      where('privacy', '==', 'public'),
      orderBy('memberCount', 'desc'),
      limit(TRENDING_LIMIT)
    );

    const snapshot =
      await getDocs(q);

    trendingList.innerHTML = '';

    if (snapshot.empty) {

      trendingSection.style.display =
        'none';

      return;
    }

    trendingSection.style.display =
      'block';

    let rank = 0;

    snapshot.forEach(groupDoc => {

      rank++;

      const group = {
        id: groupDoc.id,
        ...groupDoc.data()
      };

      const card =
        buildTrendingCard(
          group,
          rank
        );

      if (card) {
        trendingList.appendChild(card);
      }
    });

  } catch (error) {

    logFirestoreError(
      'Loading trending groups',
      error
    );

    trendingSection.style.display =
      'none';
  }
}


// ============================================================
// TOP 5 MOST ACTIVE GROUPS
// ============================================================
//
// Activity score:
//
//   posts + members + online users
//
// If activityScore already exists, it is used first.
//
// ============================================================

async function loadTopActiveGroups() {

  if (
    !activeGroupsList ||
    !activeGroupsSection
  ) {
    return;
  }

  try {

    const q = query(
      collection(db, 'groups'),
      where('privacy', '==', 'public'),
      orderBy('postCount', 'desc'),
      limit(10)
    );

    const snapshot =
      await getDocs(q);

    const groups =
      snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

    groups.sort((a, b) => {

      const scoreA =
        Number(a.activityScore ?? (
          Number(a.postCount || 0) * 3 +
          Number(a.memberCount || 0) +
          Number(a.onlineCount || 0) * 2
        ));

      const scoreB =
        Number(b.activityScore ?? (
          Number(b.postCount || 0) * 3 +
          Number(b.memberCount || 0) +
          Number(b.onlineCount || 0) * 2
        ));

      return scoreB - scoreA;
    });

    const topFive =
      groups.slice(0, 5);

    activeGroupsList.innerHTML = '';

    if (!topFive.length) {

      activeGroupsSection.style.display =
        'none';

      return;
    }

    activeGroupsSection.style.display =
      'block';

    topFive.forEach(group => {

      const card =
        buildRailCard(group);

      if (card) {
        activeGroupsList.appendChild(card);
      }
    });

  } catch (error) {

    logFirestoreError(
      'Loading Top 5 Most Active Groups',
      error
    );

    activeGroupsSection.style.display =
      'none';
  }
}


// ============================================================
// NEW GROUPS
// ============================================================

async function loadNewGroups() {

  if (
    !newGroupsList ||
    !newGroupsSection
  ) {
    return;
  }

  try {

    const q = query(
      collection(db, 'groups'),
      where('privacy', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const snapshot =
      await getDocs(q);

    newGroupsList.innerHTML = '';

    if (snapshot.empty) {

      newGroupsSection.style.display =
        'none';

      return;
    }

    newGroupsSection.style.display =
      'block';

    snapshot.forEach(groupDoc => {

      const group = {
        id: groupDoc.id,
        ...groupDoc.data()
      };

      const card =
        buildRailCard(group);

      if (card) {
        newGroupsList.appendChild(card);
      }
    });

  } catch (error) {

    logFirestoreError(
      'Loading New Groups',
      error
    );

    newGroupsSection.style.display =
      'none';
  }
}


// ============================================================
// RECOMMENDED RAIL
// ============================================================

async function loadRecommendedRail() {

  if (
    !recommendedList ||
    !recommendedSection
  ) {
    return;
  }

  try {

    const joinedCategories =
      Array.from(
        new Set(
          state.membershipList
            .map(m => m.category)
            .filter(Boolean)
        )
      ).slice(0, 10);

    let snapshot;

    if (joinedCategories.length) {

      const q = query(
        collection(db, 'groups'),
        where('privacy', '==', 'public'),
        where(
          'category',
          'in',
          joinedCategories
        ),
        orderBy(
          'memberCount',
          'desc'
        ),
        limit(10)
      );

      snapshot =
        await getDocs(q);

    } else {

      const q = query(
        collection(db, 'groups'),
        where('privacy', '==', 'public'),
        orderBy(
          'memberCount',
          'desc'
        ),
        limit(10)
      );

      snapshot =
        await getDocs(q);
    }

    const groups =
      snapshot.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .filter(
          group =>
            !state.membershipMap.has(
              group.id
            )
        )
        .slice(0, 5);

    recommendedList.innerHTML = '';

    if (!groups.length) {

      recommendedSection.style.display =
        'none';

      return;
    }

    recommendedSection.style.display =
      'block';

    groups.forEach(group => {

      const card =
        buildRailCard(group);

      if (card) {
        recommendedList.appendChild(card);
      }
    });

  } catch (error) {

    logFirestoreError(
      'Loading Recommended Groups',
      error
    );

    recommendedSection.style.display =
      'none';
  }
}


// ============================================================
// TRENDING CARD
// ============================================================

function buildTrendingCard(
  group,
  rank
) {

  if (!trendingCardTemplate) {
    return null;
  }

  const template =
    trendingCardTemplate
      .content
      .firstElementChild;

  if (!template) return null;

  const node =
    template.cloneNode(true);

  if ('href' in node) {
    node.href =
      `group.html?id=${encodeURIComponent(group.id)}`;
  }

  setText(
    node,
    '.trending-card__rank',
    `#${rank}`
  );

  const cover =
    node.querySelector(
      '.trending-card__cover'
    );

  if (cover && group.coverURL) {

    cover.style.backgroundImage =
      `url("${group.coverURL}")`;

    cover.style.backgroundSize =
      'cover';

    cover.style.backgroundPosition =
      'center';
  }

  const avatar =
    node.querySelector(
      '.trending-card__avatar'
    );

  applyMediaBackground(
    avatar,
    group.avatarURL,
    initialsFrom(group.name)
  );

  setText(
    node,
    '.trending-card__name',
    group.name || 'Untitled group'
  );

  setText(
    node,
    '.trending-card__member-count',
    `${formatCount(group.memberCount || 0)} members`
  );

  return node;
}


// ============================================================
// GENERIC RAIL CARD
// ============================================================

function buildRailCard(group) {

  const a =
    document.createElement('a');

  a.className =
    'group-rail-card';

  a.href =
    `group.html?id=${encodeURIComponent(group.id)}`;

  const avatar =
    document.createElement('div');

  avatar.className =
    'group-rail-card__avatar';

  applyMediaBackground(
    avatar,
    group.avatarURL,
    initialsFrom(group.name)
  );

  const content =
    document.createElement('div');

  content.className =
    'group-rail-card__content';

  const name =
    document.createElement('div');

  name.className =
    'group-rail-card__name';

  name.textContent =
    group.name || 'Untitled group';

  const meta =
    document.createElement('div');

  meta.className =
    'group-rail-card__meta';

  meta.textContent =
    `${formatCount(group.memberCount || 0)} members`;

  content.appendChild(name);
  content.appendChild(meta);

  a.appendChild(avatar);
  a.appendChild(content);

  return a;
}


// ============================================================
// MAIN GROUP CARD
// ============================================================

function buildGroupCard(group) {

  if (!groupCardTemplate) {
    return null;
  }

  const template =
    groupCardTemplate
      .content
      .firstElementChild;

  if (!template) return null;

  const node =
    template.cloneNode(true);

  node.href =
    `group.html?id=${encodeURIComponent(group.id)}`;

  node.dataset.groupId =
    group.id;

  const cover =
    node.querySelector(
      '.group-card__cover'
    );

  if (cover && group.coverURL) {

    cover.style.backgroundImage =
      `url("${group.coverURL}")`;

    cover.style.backgroundSize =
      'cover';

    cover.style.backgroundPosition =
      'center';
  }

  const avatar =
    node.querySelector(
      '.group-card__avatar'
    );

  applyMediaBackground(
    avatar,
    group.avatarURL,
    initialsFrom(group.name)
  );

  setText(
    node,
    '.group-card__name',
    group.name || 'Untitled group'
  );

  const privacyBadge =
    node.querySelector(
      '.group-card__privacy-badge'
    );

  if (privacyBadge) {

    if (group.privacy === 'private') {

      privacyBadge.className =
        'badge badge--private group-card__privacy-badge';

      privacyBadge.innerHTML =
        '<i class="fa-solid fa-lock"></i> Private';

    } else {

      privacyBadge.className =
        'badge badge--public group-card__privacy-badge';

      privacyBadge.innerHTML =
        '<i class="fa-solid fa-globe"></i> Public';
    }
  }

  const premiumBadge =
    node.querySelector(
      '.group-card__premium-badge'
    );

  if (premiumBadge) {

    premiumBadge.style.display =
      group.type === 'premium'
        ? 'inline-flex'
        : 'none';
  }

  const verifiedBadge =
    node.querySelector(
      '.group-card__verified-badge'
    );

  if (verifiedBadge) {

    verifiedBadge.style.display =
      group.verified
        ? 'inline-flex'
        : 'none';
  }

  setText(
    node,
    '.group-card__desc',
    group.description || ''
  );

  setText(
    node,
    '.group-card__member-count',
    formatCount(group.memberCount || 0)
  );

  setText(
    node,
    '.group-card__post-count',
    formatCount(group.postCount || 0)
  );

  setText(
    node,
    '.group-card__online-count',
    formatCount(group.onlineCount || 0)
  );


  // ==========================================================
  // CREATED / JOINED BADGES
  // ==========================================================

  const membership =
    state.membershipMap.get(group.id);

  const createdByMe =
    isGroupCreatedByUser(
      group,
      state.currentUser?.uid
    );

  const statusBadge =
    node.querySelector(
      '.group-card__status'
    );

  if (statusBadge) {

    if (createdByMe) {

      statusBadge.textContent =
        'Created by you';

      statusBadge.style.display =
        'inline-flex';

    } else if (
      membership?.status === 'active'
    ) {

      statusBadge.textContent =
        'Joined';

      statusBadge.style.display =
        'inline-flex';

    } else if (
      membership?.status === 'pending'
    ) {

      statusBadge.textContent =
        'Requested';

      statusBadge.style.display =
        'inline-flex';

    } else {

      statusBadge.style.display =
        'none';
    }
  }


  // ==========================================================
  // JOIN BUTTON
  // ==========================================================

  const joinBtn =
    node.querySelector(
      '.group-card__join-btn'
    );

  if (joinBtn) {

    // Creator does not need a Join button.
    if (createdByMe) {

      joinBtn.textContent =
        'Your group';

      joinBtn.disabled =
        true;

      joinBtn.className =
        'btn-join group-card__join-btn is-owner';

    } else {

      applyJoinButtonState(
        joinBtn,
        group.id
      );

      joinBtn.addEventListener(
        'click',
        event => {

          event.preventDefault();
          event.stopPropagation();

          handleJoinClick(
            group,
            joinBtn
          );
        }
      );
    }
  }

  return node;
}


// ============================================================
// JOIN BUTTON STATE
// ============================================================

function applyJoinButtonState(
  buttonEl,
  groupId
) {

  if (!buttonEl) return;

  const membership =
    state.membershipMap.get(groupId);

  buttonEl.className =
    'btn-join group-card__join-btn';

  buttonEl.disabled =
    false;

  if (!membership) {

    buttonEl.textContent =
      'Join group';

    buttonEl.classList.add(
      'is-primary'
    );

    return;
  }

  if (
    membership.status === 'pending'
  ) {

    buttonEl.textContent =
      'Requested';

    buttonEl.classList.add(
      'is-pending'
    );

    buttonEl.disabled =
      true;

    return;
  }

  buttonEl.textContent =
    '✓ Joined';

  buttonEl.disabled =
    true;
}


// ============================================================
// JOIN GROUP
// ============================================================

async function handleJoinClick(
  group,
  buttonEl
) {

  if (
    state.membershipMap.has(
      group.id
    )
  ) {
    return;
  }

  const originalText =
    buttonEl.textContent;

  buttonEl.disabled =
    true;

  buttonEl.textContent =
    'Joining…';

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
      group.id,
      'members',
      user.uid
    );

  const groupRef =
    doc(
      db,
      'groups',
      group.id
    );

  try {

    await runTransaction(
      db,
      async transaction => {

        const existing =
          await transaction.get(
            memberRef
          );

        if (existing.exists()) {
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
              user.photoURL || '',

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

    state.membershipMap.set(
      group.id,
      {
        status,
        role: 'member',
        category:
          group.category || ''
      }
    );

    state.membershipList.unshift({
      groupId: group.id,
      status,
      role: 'member',
      category:
        group.category || '',
      joinedAt: Date.now()
    });

    applyJoinButtonState(
      buttonEl,
      group.id
    );

    showToast(
      isPrivate
        ? 'Request sent! An admin will review it.'
        : `You've joined ${group.name}.`,
      'success'
    );

    // Refresh recommendations.
    loadRecommendedRail();

  } catch (error) {

    logFirestoreError(
      'Joining group',
      error
    );

    buttonEl.disabled =
      false;

    buttonEl.textContent =
      originalText;

    showToast(
      'Could not join this group. Please try again.',
      'error'
    );
  }
}


// ============================================================
// LOAD MAIN GROUP GRID
// ============================================================

async function loadGroupsForActiveView(
  reset = false
) {

  if (
    state.isLoading ||
    !groupsGrid
  ) {
    return;
  }

  state.isLoading =
    true;

  const requestId =
    ++state.requestVersion;

  if (reset) {

    state.lastVisibleDoc =
      null;

    state.hasMore =
      false;

    state.myGroupsPageIndex =
      0;

    state.displayedGroupIds.clear();

    groupsGrid.innerHTML = '';

    renderSkeletons(6);

    if (groupsEmptyState) {
      groupsEmptyState.style.display =
        'none';
    }
  }

  if (loadMoreBtn) {

    loadMoreBtn.disabled =
      true;

    loadMoreBtn.classList.add(
      'is-loading'
    );
  }

  try {

    let groups = [];

    if (state.searchQuery) {

      groups =
        await fetchSearchResults(reset);

    } else if (
      state.activeTab === 'discover'
    ) {

      groups =
        await fetchDiscoverGroups(reset);

    } else if (
      state.activeTab === 'recommended'
    ) {

      groups =
        await fetchRecommendedGroups(reset);

    } else if (
      state.activeTab === 'my-groups'
    ) {

      groups =
        await fetchMyGroups(reset);
    }


    // Ignore stale request.
    if (
      requestId !==
      state.requestVersion
    ) {
      return;
    }

    clearSkeletons();

    if (reset) {
      groupsGrid.innerHTML = '';
    }


    // Remove duplicate cards.
    const uniqueGroups = [];

    for (const group of groups) {

      if (
        state.displayedGroupIds.has(
          group.id
        )
      ) {
        continue;
      }

      state.displayedGroupIds.add(
        group.id
      );

      uniqueGroups.push(group);
    }


    if (
      uniqueGroups.length === 0 &&
      reset
    ) {

      if (groupsEmptyMessage) {

        groupsEmptyMessage.textContent =
          buildEmptyMessage();
      }

      if (groupsEmptyState) {

        groupsEmptyState.style.display =
          'flex';
      }

    } else if (groupsEmptyState) {

      groupsEmptyState.style.display =
        'none';
    }


    uniqueGroups.forEach(group => {

      const card =
        buildGroupCard(group);

      if (card) {
        groupsGrid.appendChild(card);
      }
    });


    if (loadMoreBtn) {

      loadMoreBtn.style.display =
        state.hasMore
          ? 'block'
          : 'none';

      loadMoreBtn.disabled =
        false;
    }

  } catch (error) {

    logFirestoreError(
      `Loading groups — tab=${state.activeTab}, category=${state.activeCategory}, search=${state.searchQuery}`,
      error
    );

    clearSkeletons();

    if (reset) {

      groupsGrid.innerHTML = '';
    }

    showToast(
      'Could not load groups right now.',
      'error'
    );

  } finally {

    state.isLoading =
      false;

    if (loadMoreBtn) {

      loadMoreBtn.classList.remove(
        'is-loading'
      );

      loadMoreBtn.disabled =
        false;
    }
  }
}


// ============================================================
// EMPTY MESSAGE
// ============================================================

function buildEmptyMessage() {

  if (state.searchQuery) {

    return `No groups matched "${state.searchQuery}".`;
  }

  if (
    state.activeTab === 'my-groups'
  ) {

    return 'You have not created or joined any groups yet.';
  }

  if (
    state.activeCategory !== 'all'
  ) {

    return `No groups in ${
      CATEGORY_LABELS[
        state.activeCategory
      ] ||
      state.activeCategory
    } yet.`;
  }

  if (
    state.activeTab === 'recommended'
  ) {

    return 'No recommended groups available right now.';
  }

  return 'No groups available right now.';
}


// ============================================================
// DISCOVER
// ============================================================

async function fetchDiscoverGroups(
  reset
) {

  const constraints = [
    where(
      'privacy',
      '==',
      'public'
    )
  ];

  if (
    state.activeCategory !==
    'all'
  ) {

    constraints.push(
      where(
        'category',
        '==',
        state.activeCategory
      )
    );
  }

  constraints.push(
    orderBy(
      'createdAt',
      'desc'
    )
  );

  if (
    !reset &&
    state.lastVisibleDoc
  ) {

    constraints.push(
      startAfter(
        state.lastVisibleDoc
      )
    );
  }

  constraints.push(
    limit(PAGE_SIZE)
  );

  const snapshot =
    await getDocs(
      query(
        collection(db, 'groups'),
        ...constraints
      )
    );

  return consumeSnapshot(
    snapshot
  );
}


// ============================================================
// RECOMMENDED
// ============================================================

async function fetchRecommendedGroups(
  reset
) {

  const constraints = [
    where(
      'privacy',
      '==',
      'public'
    )
  ];

  if (
    state.activeCategory !==
    'all'
  ) {

    constraints.push(
      where(
        'category',
        '==',
        state.activeCategory
      )
    );

  } else {

    const categories =
      Array.from(
        new Set(
          state.membershipList
            .map(
              m => m.category
            )
            .filter(Boolean)
        )
      ).slice(0, 10);

    if (categories.length) {

      constraints.push(
        where(
          'category',
          'in',
          categories
        )
      );
    }
  }

  constraints.push(
    orderBy(
      'memberCount',
      'desc'
    )
  );

  if (
    !reset &&
    state.lastVisibleDoc
  ) {

    constraints.push(
      startAfter(
        state.lastVisibleDoc
      )
    );
  }

  constraints.push(
    limit(PAGE_SIZE)
  );

  const snapshot =
    await getDocs(
      query(
        collection(db, 'groups'),
        ...constraints
      )
    );

  const groups =
    consumeSnapshot(snapshot);

  return groups.filter(
    group =>
      !state.membershipMap.has(
        group.id
      )
  );
}


// ============================================================
// MY GROUPS
// ============================================================
//
// IMPORTANT:
//
// This is the main fix.
//
// My Groups now combines:
//
//   1. Groups created by the current user
//   2. Groups the current user joined
//
// It also keeps pending requests separate from actual joined groups.
//
// The creator's group is shown even if there is no member document.
// If the creator is also in the members collection, duplicates are
// removed automatically.
//
// ============================================================

async function fetchMyGroups(reset) {

  if (reset) {

    state.myGroupsPageIndex =
      0;
  }


  // ----------------------------------------------------------
  // Get all created groups.
  // ----------------------------------------------------------

  const created =
    [...state.createdGroups];


  // ----------------------------------------------------------
  // Get active joined groups.
  // Pending requests are intentionally excluded from "joined".
  // ----------------------------------------------------------

  const joinedMemberships =
    state.membershipList.filter(
      member => {

        if (
          member.status !==
          'active'
        ) {
          return false;
        }

        if (
          state.activeCategory !==
          'all'
        ) {

          return (
            member.category ===
            state.activeCategory
          );
        }

        return true;
      }
    );


  // ----------------------------------------------------------
  // Category filter for created groups.
  // ----------------------------------------------------------

  const filteredCreated =
    created.filter(group => {

      if (
        state.activeCategory ===
        'all'
      ) {
        return true;
      }

      return (
        group.category ===
        state.activeCategory
      );
    });


  // ----------------------------------------------------------
  // Build unique ID list.
  // Created groups are placed first.
  // ----------------------------------------------------------

  const idMap =
    new Map();

  filteredCreated.forEach(group => {

    idMap.set(
      group.id,
      {
        id: group.id,
        source: 'created'
      }
    );
  });

  joinedMemberships.forEach(member => {

    if (!idMap.has(member.groupId)) {

      idMap.set(
        member.groupId,
        {
          id: member.groupId,
          source: 'joined'
        }
      );
    }
  });


  const allEntries =
    Array.from(
      idMap.values()
    );


  // ----------------------------------------------------------
  // Better pagination.
  //
  // We paginate the merged My Groups list instead of separately
  // paginating created and joined groups.
  // ----------------------------------------------------------

  const start =
    state.myGroupsPageIndex *
    PAGE_SIZE;

  const page =
    allEntries.slice(
      start,
      start + PAGE_SIZE
    );

  state.myGroupsPageIndex += 1;

  state.hasMore =
    start + PAGE_SIZE <
    allEntries.length;


  if (!page.length) {

    return [];
  }


  // ----------------------------------------------------------
  // Fetch group documents.
  // ----------------------------------------------------------

  const docs =
    await Promise.all(
      page.map(entry =>
        getDoc(
          doc(
            db,
            'groups',
            entry.id
          )
        )
      )
    );


  const groups =
    docs
      .filter(
        snapshot =>
          snapshot.exists()
      )
      .map(
        snapshot => ({
          id: snapshot.id,
          ...snapshot.data()
        })
      );


  // ----------------------------------------------------------
  // Created groups first, then joined groups.
  // ----------------------------------------------------------

  groups.sort(
    (a, b) => {

      const aCreated =
        isGroupCreatedByUser(
          a,
          state.currentUser.uid
        );

      const bCreated =
        isGroupCreatedByUser(
          b,
          state.currentUser.uid
        );

      if (
        aCreated &&
        !bCreated
      ) {
        return -1;
      }

      if (
        !aCreated &&
        bCreated
      ) {
        return 1;
      }

      return (
        getTimestampValue(
          b.createdAt
        ) -
        getTimestampValue(
          a.createdAt
        )
      );
    }
  );


  return groups;
}


// ============================================================
// SEARCH
// ============================================================

async function fetchSearchResults(
  reset
) {

  const words =
    state.searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10);

  if (!words.length) {

    state.hasMore = false;

    return [];
  }


  const constraints = [
    where(
      'searchTokens',
      'array-contains-any',
      words
    )
  ];

  if (
    state.activeCategory !==
    'all'
  ) {

    constraints.push(
      where(
        'category',
        '==',
        state.activeCategory
      )
    );
  }


  if (
    !reset &&
    state.lastVisibleDoc
  ) {

    constraints.push(
      startAfter(
        state.lastVisibleDoc
      )
    );
  }


  constraints.push(
    limit(PAGE_SIZE)
  );


  const snapshot =
    await getDocs(
      query(
        collection(db, 'groups'),
        ...constraints
      )
    );


  const groups =
    consumeSnapshot(
      snapshot
    );


  // AND refinement.
  return groups.filter(
    group => {

      const tokens =
        Array.isArray(
          group.searchTokens
        )
          ? group.searchTokens
          : [];

      return words.every(
        word =>
          tokens.includes(word)
      );
    }
  );
}


// ============================================================
// SNAPSHOT PAGINATION
// ============================================================

function consumeSnapshot(
  snapshot
) {

  const docs =
    snapshot.docs;

  if (docs.length) {

    state.lastVisibleDoc =
      docs[docs.length - 1];
  }

  state.hasMore =
    docs.length === PAGE_SIZE;

  return docs.map(
    d => ({
      id: d.id,
      ...d.data()
    })
  );
}


// ============================================================
// SKELETONS
// ============================================================

function renderSkeletons(count) {

  if (
    !skeletonCardTemplate ||
    !groupsGrid
  ) {
    return;
  }

  const template =
    skeletonCardTemplate
      .content
      .firstElementChild;

  if (!template) return;

  for (
    let i = 0;
    i < count;
    i++
  ) {

    const node =
      template.cloneNode(true);

    node.dataset.skeleton =
      'true';

    groupsGrid.appendChild(node);
  }
}


function clearSkeletons() {

  if (!groupsGrid) return;

  groupsGrid
    .querySelectorAll(
      '[data-skeleton="true"]'
    )
    .forEach(
      el => el.remove()
    );
}


// ============================================================
// TAB SWITCHING
// ============================================================

if (tabsContainer) {

  tabsContainer.addEventListener(
    'click',
    event => {

      const tabBtn =
        event.target.closest(
          '.tab'
        );

      if (!tabBtn) return;

      const newTab =
        tabBtn.dataset.tab;

      if (!newTab) return;

      if (
        newTab ===
        state.activeTab
      ) {
        return;
      }

      tabsContainer
        .querySelectorAll(
          '.tab'
        )
        .forEach(
          tab =>
            tab.classList.remove(
              'is-active'
            )
        );

      tabBtn.classList.add(
        'is-active'
      );

      state.activeTab =
        newTab;

      state.searchQuery =
        '';

      if (searchInput) {
        searchInput.value =
          '';
      }

      if (searchClearBtn) {

        searchClearBtn.classList.remove(
          'is-visible'
        );
      }

      state.requestVersion++;

      loadGroupsForActiveView(
        true
      );
    }
  );
}


// ============================================================
// CATEGORY CHIPS
// ============================================================

if (categoryChipsContainer) {

  categoryChipsContainer.addEventListener(
    'click',
    event => {

      const chip =
        event.target.closest(
          '.category-chip'
        );

      if (!chip) return;

      const category =
        chip.dataset.category;

      if (!category) return;

      if (
        category ===
        state.activeCategory
      ) {
        return;
      }

      categoryChipsContainer
        .querySelectorAll(
          '.category-chip'
        )
        .forEach(
          c =>
            c.classList.remove(
              'is-active'
            )
        );

      chip.classList.add(
        'is-active'
      );

      state.activeCategory =
        category;

      state.requestVersion++;

      loadGroupsForActiveView(
        true
      );
    }
  );
}


// ============================================================
// SEARCH INPUT
// ============================================================

if (searchInput) {

  searchInput.addEventListener(
    'input',
    () => {

      const value =
        searchInput.value.trim();

      if (searchClearBtn) {

        searchClearBtn.classList.toggle(
          'is-visible',
          value.length > 0
        );
      }

      clearTimeout(
        state.searchDebounceHandle
      );


      if (!value) {

        state.searchQuery =
          '';

        if (searchLoading) {

          searchLoading.classList.remove(
            'is-visible'
          );
        }

        loadGroupsForActiveView(
          true
        );

        return;
      }


      if (searchLoading) {

        searchLoading.classList.add(
          'is-visible'
        );
      }


      state.searchDebounceHandle =
        setTimeout(
          () => {

            state.searchQuery =
              value.toLowerCase();

            if (searchLoading) {

              searchLoading.classList.remove(
                'is-visible'
              );
            }

            loadGroupsForActiveView(
              true
            );

          },
          400
        );
    }
  );
}


// ============================================================
// CLEAR SEARCH
// ============================================================

if (searchClearBtn) {

  searchClearBtn.addEventListener(
    'click',
    () => {

      if (searchInput) {

        searchInput.value =
          '';
      }

      searchClearBtn.classList.remove(
        'is-visible'
      );

      state.searchQuery =
        '';

      clearTimeout(
        state.searchDebounceHandle
      );

      loadGroupsForActiveView(
        true
      );
    }
  );
}


// ============================================================
// LOAD MORE
// ============================================================

if (loadMoreBtn) {

  loadMoreBtn.addEventListener(
    'click',
    async () => {

      if (
        state.isLoading ||
        !state.hasMore
      ) {
        return;
      }

      await loadGroupsForActiveView(
        false
      );
    }
  );
}


// ============================================================
// OPTIONAL REFRESH
// ============================================================
//
// If groups.html has a button with:
//
//   id="refreshGroupsBtn"
//
// it can refresh everything without requiring a page reload.
//
// ============================================================

const refreshGroupsBtn =
  document.getElementById(
    'refreshGroupsBtn'
  );

if (refreshGroupsBtn) {

  refreshGroupsBtn.addEventListener(
    'click',
    async () => {

      if (state.isLoading) return;

      refreshGroupsBtn.disabled =
        true;

      try {

        await loadUserMemberships();

        await Promise.all([
          loadTrending(),
          loadTopActiveGroups(),
          loadNewGroups(),
          loadRecommendedRail()
        ]);

        await loadGroupsForActiveView(
          true
        );

      } finally {

        refreshGroupsBtn.disabled =
          false;
      }
    }
  );
}