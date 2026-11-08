// ============================================================
// VITALSTAR — groups.js (bug-fix release)
// ============================================================
// Works with:
//   groups/{groupId}                 (ownerId, name, description, category,
//                                     searchTokens, coverURL, avatarURL, privacy,
//                                     type, memberCount, postCount, onlineCount,
//                                     status, premiumStatus, createdAt, members{})
//   groups/{groupId}/members/{uid}   (uid, role, status, joinedAt)
//
// Filtering, searching and sorting are client-side, so no composite
// Firestore indexes are required.
// ============================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  query,
  where,
  limit,
  increment,
  serverTimestamp,
  FieldPath
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 12;
const TOP_ACTIVE_LIMIT = 5;
const NEW_GROUPS_LIMIT = 5;
const TRENDING_LIMIT = 6;
const MAX_GROUPS_TO_LOAD = 500;


// ============================================================
// DOM
// ============================================================

const navUserAvatar = document.getElementById("navUserAvatar");
const searchInput = document.getElementById("searchInput");
const searchClearBtn = document.getElementById("searchClearBtn");
const searchLoading = document.getElementById("searchLoading");
const categoryChipsContainer = document.getElementById("categoryChips");
const tabsContainer = document.getElementById("groupTabs");
const trendingList = document.getElementById("trendingList");
const trendingSection = document.getElementById("trendingSection");
const groupsGrid = document.getElementById("groupsGrid");
const groupsEmptyState = document.getElementById("groupsEmptyState");
const groupsEmptyMessage = document.getElementById("groupsEmptyMessage");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const toastContainer = document.getElementById("toast-container");
const groupCardTemplate = document.getElementById("groupCardTemplate");
const trendingCardTemplate = document.getElementById("trendingCardTemplate");
const skeletonCardTemplate = document.getElementById("skeletonCardTemplate");

// Optional sections (only used if present in the HTML)
const topActiveList = document.getElementById("topActiveList");
const topActiveSection = document.getElementById("topActiveSection");
const newGroupsList = document.getElementById("newGroupsList");
const newGroupsSection = document.getElementById("newGroupsSection");


// ============================================================
// CATEGORY LABELS
// ============================================================

const CATEGORY_LABELS = {
  technology: "Technology",
  gaming: "Gaming",
  programming: "Programming",
  music: "Music",
  "movies-tv": "Movies & TV",
  anime: "Anime",
  sports: "Sports",
  education: "Education",
  business: "Business",
  entertainment: "Entertainment",
  news: "News",
  science: "Science",
  fashion: "Fashion",
  travel: "Travel",
  politics: "Politics",
  religion: "Religion",
  general: "General",
  other: "Other"
};


// ============================================================
// STATE
// ============================================================

const state = {
  currentUser: null,
  initializedUid: null,

  activeTab: "discover",
  activeCategory: "all",
  searchQuery: "",
  searchDebounceHandle: null,

  isLoading: false,
  hasMore: false,
  currentPage: 0,
  requestId: 0,

  // groupId -> { groupId, status, role, category, joinedAt }
  // Only "active" / "pending" memberships (and owned groups) live here.
  membershipMap: new Map(),
  membershipList: [],
  blockedGroups: new Set(),

  myGroups: [],

  allGroupsCache: [],
  groupsCacheLoaded: false,
  groupsPromise: null,

  renderedGroupIds: new Set()
};


// ============================================================
// TOAST
// ============================================================

function showToast(message, type = "info") {
  if (!toastContainer) return;

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;

  const text = toast.querySelector("span");
  if (text) text.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}


// ============================================================
// UTILITIES
// ============================================================

function logFirestoreError(context, error) {
  console.error(`[VITALSTAR GROUPS] ${context}`, error);
}

function formatCount(value) {
  const num = Number(value) || 0;

  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";

  return String(num);
}

function initialsFrom(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}

function setText(root, selector, value) {
  const element = root?.querySelector(selector);
  if (element) element.textContent = value ?? "";
}

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

function getCreatedTime(group) {
  return getTimestampMillis(group?.createdAt);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

// Only allow safe image URLs, and quote them safely for CSS
function safeUrl(url) {
  const value = String(url || "").trim();
  return /^(https?:|data:image\/|blob:)/i.test(value) ? value : "";
}

function applyCover(element, url) {
  if (!element) return;

  const safe = safeUrl(url);

  if (safe) {
    element.style.backgroundImage = `url(${JSON.stringify(safe)})`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
  } else {
    element.style.backgroundImage = "";
  }
}

function applyMediaBackground(element, url, fallback = "") {
  if (!element) return;

  const safe = safeUrl(url);

  if (safe) {
    element.style.backgroundImage = `url(${JSON.stringify(safe)})`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.textContent = "";
  } else {
    element.style.backgroundImage = "";
    element.textContent = fallback;
  }
}

function isVisibleGroup(group) {
  return group.status !== "inactive";
}

function isLiveMembership(status) {
  return status === "active" || status === "pending";
}

function isBlockedStatus(status) {
  return status === "banned" || status === "blocked";
}


// ============================================================
// LOAD ALL GROUPS
// ============================================================
// Simple collection read (no composite index needed).
// The user's OWN groups and groups where they are a member are fetched
// separately and merged in, so they can never fall outside the
// MAX_GROUPS_TO_LOAD window (previously a cause of missing "My Groups").
// ============================================================

async function mergeUserGroups(groupMap) {
  const uid = state.currentUser?.uid;
  if (!uid) return;

  // Groups owned by the user
  try {
    const owned = await getDocs(
      query(collection(db, "groups"), where("ownerId", "==", uid))
    );

    owned.forEach(groupDoc => {
      groupMap.set(groupDoc.id, { id: groupDoc.id, ...groupDoc.data() });
    });
  } catch (error) {
    logFirestoreError("Loading owned groups", error);
  }

  // Groups where the user appears in the members map
  try {
    const joined = await getDocs(
      query(
        collection(db, "groups"),
        where(new FieldPath("members", uid, "status"), "in", ["active", "pending"])
      )
    );

    joined.forEach(groupDoc => {
      groupMap.set(groupDoc.id, { id: groupDoc.id, ...groupDoc.data() });
    });
  } catch (error) {
    logFirestoreError("Loading groups from members map", error);
  }
}

async function loadAllGroups(forceReload = false) {
  if (state.groupsCacheLoaded && !forceReload) {
    return state.allGroupsCache;
  }

  if (state.groupsPromise && !forceReload) {
    return state.groupsPromise;
  }

  state.groupsPromise = (async () => {
    const snapshot = await getDocs(
      query(collection(db, "groups"), limit(MAX_GROUPS_TO_LOAD))
    );

    const groupMap = new Map();

    snapshot.docs.forEach(groupDoc => {
      groupMap.set(groupDoc.id, { id: groupDoc.id, ...groupDoc.data() });
    });

    await mergeUserGroups(groupMap);

    state.allGroupsCache = [...groupMap.values()];
    state.groupsCacheLoaded = true;

    return state.allGroupsCache;
  })();

  try {
    return await state.groupsPromise;
  } catch (error) {
    logFirestoreError("Loading groups collection", error);
    throw error;
  } finally {
    state.groupsPromise = null;
  }
}


// ============================================================
// AUTH + INITIALIZATION
// ============================================================

async function initializePage(force = false) {
  await loadAllGroups(force);
  await loadUserMemberships();

  await Promise.all([
    loadTopActiveGroups(),
    loadNewGroups(),
    loadTrendingGroups()
  ]);

  await loadGroupsForActiveView(true);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Avoid running the whole setup twice for the same user
  if (state.initializedUid === user.uid) return;

  state.initializedUid = user.uid;
  state.currentUser = user;

  const avatarUrl = safeUrl(user.photoURL);

  if (avatarUrl && navUserAvatar) {
    applyMediaBackground(navUserAvatar, avatarUrl);
  }

  try {
    await initializePage(false);
  } catch (error) {
    logFirestoreError("Groups page initialization", error);
    clearSkeletons();
    showToast("Could not load groups. Please refresh.", "error");
  }
});

// Back/forward cache: refresh data so new/joined groups show up
window.addEventListener("pageshow", event => {
  if (event.persisted && state.currentUser) {
    initializePage(true).catch(error => {
      logFirestoreError("Refreshing groups after pageshow", error);
    });
  }
});


// ============================================================
// LOAD USER MEMBERSHIPS
// ============================================================
// Sources (the subcollection is the most authoritative):
//   A. groups/{groupId}/members/{uid}
//   B. groups/{groupId}.members[uid]
//   C. groups owned by the current user
//
// Only "active" and "pending" count as being in a group.
// "banned"/"blocked" are remembered so the button can't be used.
// Anything else (left, rejected, removed) is treated as not a member.
// ============================================================

async function loadUserMemberships() {
  state.membershipMap.clear();
  state.membershipList = [];
  state.blockedGroups.clear();

  const uid = state.currentUser?.uid;
  if (!uid) return;

  // A. members subcollection
  const subMemberships = new Map();

  try {
    const snapshot = await getDocs(
      query(collectionGroup(db, "members"), where("uid", "==", uid), limit(500))
    );

    snapshot.forEach(memberDoc => {
      const parentGroup = memberDoc.ref.parent.parent;
      if (parentGroup) subMemberships.set(parentGroup.id, memberDoc.data());
    });
  } catch (error) {
    // Usually a missing collection-group index/rule. Other sources still work.
    logFirestoreError("Reading members subcollections", error);
  }

  const groups = await loadAllGroups();
  const knownIds = new Set();

  const applyMembership = (groupId, data, category, fallbackJoinedAt) => {
    const status = data?.status || "active";

    if (isBlockedStatus(status)) {
      state.blockedGroups.add(groupId);
      return;
    }

    if (!isLiveMembership(status)) return;

    state.membershipMap.set(groupId, {
      groupId,
      status,
      role: data?.role || "member",
      category: category || data?.category || "",
      joinedAt: data?.joinedAt || fallbackJoinedAt || null
    });
  };

  groups.forEach(group => {
    knownIds.add(group.id);

    // C. owner
    if (group.ownerId === uid) {
      state.membershipMap.set(group.id, {
        groupId: group.id,
        status: "active",
        role: "owner",
        category: group.category || "",
        joinedAt: group.createdAt || null
      });
      return;
    }

    // A (authoritative) then B
    if (subMemberships.has(group.id)) {
      applyMembership(group.id, subMemberships.get(group.id), group.category, group.createdAt);
    } else if (group.members?.[uid]) {
      applyMembership(group.id, group.members[uid], group.category, group.createdAt);
    }
  });

  // Memberships for groups that were not in the cache
  subMemberships.forEach((data, groupId) => {
    if (!knownIds.has(groupId)) applyMembership(groupId, data, data.category, null);
  });

  state.membershipList = Array.from(state.membershipMap.values());

  state.membershipList.sort(
    (a, b) => getTimestampMillis(b.joinedAt) - getTimestampMillis(a.joinedAt)
  );
}


// ============================================================
// TOP ACTIVE / NEW / TRENDING (optional + trending rail)
// ============================================================

function activityScore(group, postWeight, onlineWeight) {
  return (
    (Number(group.memberCount) || 0) +
    (Number(group.postCount) || 0) * postWeight +
    (Number(group.onlineCount) || 0) * onlineWeight
  );
}

async function loadTopActiveGroups() {
  if (!topActiveList || !topActiveSection || !groupCardTemplate) return;

  try {
    const allGroups = await loadAllGroups();

    const groups = allGroups
      .filter(group => group.privacy === "public" && isVisibleGroup(group))
      .map(group => ({ ...group, score: activityScore(group, 3, 2) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_ACTIVE_LIMIT);

    topActiveList.innerHTML = "";

    if (!groups.length) {
      topActiveSection.style.display = "none";
      return;
    }

    topActiveSection.style.display = "";

    groups.forEach((group, index) => {
      const card = buildSpecialGroupCard(group, index + 1);
      if (card) topActiveList.appendChild(card);
    });
  } catch (error) {
    logFirestoreError("Loading top active groups", error);
    topActiveSection.style.display = "none";
  }
}

async function loadNewGroups() {
  if (!newGroupsList || !newGroupsSection || !groupCardTemplate) return;

  try {
    const groups = await loadAllGroups();

    const newGroups = groups
      .filter(isVisibleGroup)
      .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))
      .slice(0, NEW_GROUPS_LIMIT);

    newGroupsList.innerHTML = "";

    if (!newGroups.length) {
      newGroupsSection.style.display = "none";
      return;
    }

    newGroupsSection.style.display = "";

    newGroups.forEach(group => {
      const card = buildGroupCard(group);
      if (card) newGroupsList.appendChild(card);
    });
  } catch (error) {
    logFirestoreError("Loading new groups", error);
    newGroupsSection.style.display = "none";
  }
}

async function loadTrendingGroups() {
  if (!trendingList || !trendingSection || !trendingCardTemplate) return;

  try {
    const groups = await loadAllGroups();

    const trending = groups
      .filter(group => group.privacy === "public" && isVisibleGroup(group))
      .sort((a, b) => activityScore(b, 2, 1) - activityScore(a, 2, 1))
      .slice(0, TRENDING_LIMIT);

    trendingList.innerHTML = "";

    if (!trending.length) {
      trendingSection.style.display = "none";
      return;
    }

    trendingSection.style.display = "";

    trending.forEach((group, index) => {
      const card = buildTrendingCard(group, index + 1);
      if (card) trendingList.appendChild(card);
    });
  } catch (error) {
    logFirestoreError("Loading trending groups", error);
    trendingSection.style.display = "none";
  }
}


// ============================================================
// CARDS
// ============================================================

function buildTrendingCard(group, rank) {
  const template = trendingCardTemplate?.content?.firstElementChild;
  if (!template) return null;

  const node = template.cloneNode(true);

  node.href = `group.html?id=${encodeURIComponent(group.id)}`;
  node.dataset.groupId = group.id;

  setText(node, ".trending-card__rank", `#${rank}`);

  applyCover(node.querySelector(".trending-card__cover"), group.coverURL);

  applyMediaBackground(
    node.querySelector(".trending-card__avatar"),
    group.avatarURL,
    initialsFrom(group.name)
  );

  setText(node, ".trending-card__name", group.name || "Untitled group");
  setText(node, ".trending-card__member-count", formatCount(group.memberCount));

  return node;
}

function buildSpecialGroupCard(group, rank) {
  const card = buildGroupCard(group);
  if (!card) return null;

  card.dataset.rank = String(rank);

  const rankElement = card.querySelector(".group-card__rank");
  if (rankElement) rankElement.textContent = `#${rank}`;

  return card;
}

function buildGroupCard(group) {
  const template = groupCardTemplate?.content?.firstElementChild;
  if (!template) return null;

  const node = template.cloneNode(true);

  node.href = `group.html?id=${encodeURIComponent(group.id)}`;
  node.dataset.groupId = group.id;

  applyCover(node.querySelector(".group-card__cover"), group.coverURL);

  applyMediaBackground(
    node.querySelector(".group-card__avatar"),
    group.avatarURL,
    initialsFrom(group.name)
  );

  setText(node, ".group-card__name", group.name || "Untitled group");
  setText(node, ".group-card__desc", group.description || "");
  setText(node, ".group-card__member-count", formatCount(group.memberCount));
  setText(node, ".group-card__post-count", formatCount(group.postCount));
  setText(node, ".group-card__online-count", formatCount(group.onlineCount));

  // Privacy
  const privacyBadge = node.querySelector(".group-card__privacy-badge");

  if (privacyBadge) {
    if (group.privacy === "private") {
      privacyBadge.className = "badge badge--private group-card__privacy-badge";
      privacyBadge.innerHTML = `<i class="fa-solid fa-lock"></i> Private`;
    } else {
      privacyBadge.className = "badge badge--public group-card__privacy-badge";
      privacyBadge.innerHTML = `<i class="fa-solid fa-globe"></i> Public`;
    }
  }

  // Premium
  const premiumBadge = node.querySelector(".group-card__premium-badge");

  if (premiumBadge) {
    const isPremium =
      group.type === "premium" ||
      group.premiumStatus === "active" ||
      group.premiumActivation?.required === true;

    premiumBadge.style.display = isPremium ? "inline-flex" : "none";
  }

  // Verified
  const verifiedBadge = node.querySelector(".group-card__verified-badge");
  if (verifiedBadge) verifiedBadge.style.display = group.verified ? "inline-flex" : "none";

  // Join button
  const joinBtn = node.querySelector(".group-card__join-btn");

  if (joinBtn) {
    applyJoinButtonState(joinBtn, group);

    joinBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      handleJoinClick(group, joinBtn);
    });
  }

  return node;
}


// ============================================================
// JOIN BUTTON STATE
// ============================================================

function applyJoinButtonState(button, group) {
  if (!button) return;

  const membership = state.membershipMap.get(group.id);

  button.disabled = false;
  button.className = "btn-join group-card__join-btn";

  // Owner
  if (group.ownerId === state.currentUser?.uid) {
    button.textContent = "Manage group";
    button.classList.add("is-primary");
    return;
  }

  // Banned / blocked
  if (state.blockedGroups.has(group.id)) {
    button.textContent = "Unavailable";
    button.disabled = true;
    return;
  }

  // Pending request
  if (membership?.status === "pending") {
    button.textContent = "Requested";
    button.classList.add("is-pending");
    button.disabled = true;
    return;
  }

  // Joined
  if (membership?.status === "active") {
    button.textContent = "✓ Joined";
    button.classList.add("is-joined");
    button.disabled = true;
    return;
  }

  // Premium group waiting for payment
  if (group.status === "pending_payment") {
    button.textContent = "Unavailable";
    button.disabled = true;
    return;
  }

  // Private
  if (group.privacy === "private") {
    button.textContent = "Request to join";
    button.classList.add("is-primary");
    return;
  }

  // Public
  button.textContent = "Join group";
  button.classList.add("is-primary");
}

// Refresh every join button currently on screen for one group
function refreshJoinButtonsFor(group) {
  document
    .querySelectorAll(`[data-group-id="${CSS.escape(group.id)}"] .group-card__join-btn`)
    .forEach(button => applyJoinButtonState(button, group));
}


// ============================================================
// JOIN GROUP
// ============================================================

async function handleJoinClick(group, button) {
  if (!state.currentUser) {
    showToast("Please sign in first.", "error");
    return;
  }

  // Owner → open the group
  if (group.ownerId === state.currentUser.uid) {
    window.location.href = `group.html?id=${encodeURIComponent(group.id)}`;
    return;
  }

  // Already a member / pending / blocked
  if (state.membershipMap.has(group.id) || state.blockedGroups.has(group.id)) return;

  if (group.status === "pending_payment") {
    showToast("This premium group is not active yet.", "info");
    return;
  }

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Joining…";

  const user = state.currentUser;
  const isPrivate = group.privacy === "private";
  const status = isPrivate ? "pending" : "active";

  const groupRef = doc(db, "groups", group.id);
  const memberRef = doc(db, "groups", group.id, "members", user.uid);

  try {
    const result = await runTransaction(db, async transaction => {
      const [groupSnap, memberSnap] = await Promise.all([
        transaction.get(groupRef),
        transaction.get(memberRef)
      ]);

      if (!groupSnap.exists()) throw new Error("group-missing");

      const existingStatus = memberSnap.exists() ? memberSnap.data().status : null;

      if (isLiveMembership(existingStatus)) {
        return { status: existingStatus, already: true };
      }

      if (isBlockedStatus(existingStatus)) throw new Error("blocked");

      transaction.set(memberRef, {
        uid: user.uid,
        displayName: user.displayName || "VitalStar Member",
        photoURL: user.photoURL || "",
        role: "member",
        status,
        category: group.category || "",
        joinedAt: serverTimestamp()
      });

      if (status === "active") {
        transaction.update(groupRef, {
          memberCount: increment(1),
          updatedAt: serverTimestamp()
        });
      }

      return { status, already: false };
    });

    // Local membership
    const membership = {
      groupId: group.id,
      status: result.status,
      role: "member",
      category: group.category || "",
      joinedAt: null
    };

    state.membershipMap.set(group.id, membership);
    state.membershipList = [
      membership,
      ...state.membershipList.filter(item => item.groupId !== group.id)
    ];

    // Local group cache
    const cachedGroup = state.allGroupsCache.find(item => item.id === group.id);

    if (cachedGroup && !result.already && result.status === "active") {
      cachedGroup.memberCount = (Number(cachedGroup.memberCount) || 0) + 1;
      group.memberCount = cachedGroup.memberCount;
    }

    refreshJoinButtonsFor(group);

    if (result.already) {
      showToast("You're already part of this group.", "info");
    } else if (isPrivate) {
      showToast("Join request sent successfully.", "success");
    } else {
      showToast(`You joined ${group.name}.`, "success");
    }

    // Keep My Groups correct if it's the open tab
    if (state.activeTab === "my-groups") {
      await loadGroupsForActiveView(true);
    }
  } catch (error) {
    logFirestoreError("Joining group", error);

    button.disabled = false;
    button.textContent = originalText;

    if (error?.message === "blocked") {
      state.blockedGroups.add(group.id);
      refreshJoinButtonsFor(group);
      showToast("You can't join this group.", "error");
    } else if (error?.message === "group-missing") {
      showToast("This group no longer exists.", "error");
    } else {
      showToast("Could not join this group. Please try again.", "error");
    }
  }
}


// ============================================================
// FILTER (category + search + status)
// ============================================================

function filterGroups(groups) {
  const uid = state.currentUser?.uid;

  let result = groups.filter(group => group.ownerId === uid || isVisibleGroup(group));

  if (state.activeCategory !== "all") {
    const category = normalizeText(state.activeCategory);
    result = result.filter(group => normalizeText(group.category) === category);
  }

  if (state.searchQuery) {
    const words = state.searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10);

    result = result.filter(group => {
      const name = normalizeText(group.name);
      const description = normalizeText(group.description);
      const category = normalizeText(group.category);
      const tokens = Array.isArray(group.searchTokens)
        ? group.searchTokens.map(normalizeText)
        : [];

      return words.every(
        word =>
          name.includes(word) ||
          description.includes(word) ||
          category.includes(word) ||
          tokens.includes(word)
      );
    });
  }

  return result;
}

// Name matches that start with the search come first (stable)
function rankSearchResults(groups) {
  const search = normalizeText(state.searchQuery);
  if (!search) return groups;

  const starts = [];
  const rest = [];

  groups.forEach(group => {
    (normalizeText(group.name).startsWith(search) ? starts : rest).push(group);
  });

  return [...starts, ...rest];
}


// ============================================================
// TAB DATA SOURCES (each returns the FULL filtered list;
// pagination happens in the loader)
// ============================================================

async function getDiscoverList() {
  const groups = await loadAllGroups();

  return filterGroups(groups).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));
}

function getRecommendedScore(group, joinedCategories) {
  let score = 0;

  if (joinedCategories.includes(normalizeText(group.category))) score += 100;

  score += (Number(group.memberCount) || 0) * 2;
  score += Number(group.postCount) || 0;
  score += Number(group.onlineCount) || 0;

  return score;
}

async function getRecommendedList() {
  const groups = await loadAllGroups();

  const joinedCategories = [
    ...new Set(
      state.membershipList.map(item => normalizeText(item.category)).filter(Boolean)
    )
  ];

  return filterGroups(groups)
    .filter(group => !state.membershipMap.has(group.id))
    .sort(
      (a, b) =>
        getRecommendedScore(b, joinedCategories) -
        getRecommendedScore(a, joinedCategories)
    );
}

async function rebuildMyGroups() {
  const uid = state.currentUser?.uid;

  if (!uid) {
    state.myGroups = [];
    return;
  }

  const groups = await loadAllGroups();
  const byId = new Map(groups.map(group => [group.id, group]));

  // Memberships for groups that aren't in the cache → fetch them
  const missingIds = [...state.membershipMap.keys()].filter(id => !byId.has(id));

  if (missingIds.length) {
    const fetched = await Promise.all(
      missingIds.map(async groupId => {
        try {
          const snapshot = await getDoc(doc(db, "groups", groupId));
          return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        } catch (error) {
          logFirestoreError(`Could not load member group ${groupId}`, error);
          return null;
        }
      })
    );

    fetched.filter(Boolean).forEach(group => {
      byId.set(group.id, group);
      state.allGroupsCache.push(group);
    });
  }

  const result = [];

  state.membershipMap.forEach((membership, groupId) => {
    const group = byId.get(groupId);
    if (!group) return;

    const isOwner = group.ownerId === uid;

    // Hide inactive groups from everyone except their owner
    if (!isOwner && !isVisibleGroup(group)) return;

    result.push(group);
  });

  result.sort((a, b) => {
    const aOwned = a.ownerId === uid;
    const bOwned = b.ownerId === uid;

    if (aOwned && !bOwned) return -1;
    if (!aOwned && bOwned) return 1;

    return getCreatedTime(b) - getCreatedTime(a);
  });

  state.myGroups = result;
}

async function getMyGroupsList() {
  // Always rebuild so groups joined/created since last visit are included
  await rebuildMyGroups();

  const uid = state.currentUser?.uid;

  // Category + search apply here too (search used to ignore this tab)
  return filterGroups(state.myGroups).sort((a, b) => {
    const aOwned = a.ownerId === uid;
    const bOwned = b.ownerId === uid;

    if (aOwned && !bOwned) return -1;
    if (!aOwned && bOwned) return 1;

    return getCreatedTime(b) - getCreatedTime(a);
  });
}


// ============================================================
// MAIN GROUP LOADER
// ============================================================

async function loadGroupsForActiveView(reset = false) {
  if (!groupsGrid) return;

  // "Load more" can't overlap itself; a reset always wins
  if (!reset && (state.isLoading || !state.hasMore)) return;

  // Newer requests invalidate older ones (previously they were dropped)
  const requestId = ++state.requestId;

  state.isLoading = true;

  if (reset) {
    state.currentPage = 0;
    state.hasMore = false;
    state.renderedGroupIds.clear();

    groupsGrid.innerHTML = "";

    if (groupsEmptyState) groupsEmptyState.style.display = "none";
    if (loadMoreBtn) loadMoreBtn.style.display = "none";

    renderSkeletons(6);
  }

  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.classList.add("is-loading");
  }

  try {
    let list;

    switch (state.activeTab) {
      case "recommended":
        list = await getRecommendedList();
        break;

      case "my-groups":
        list = await getMyGroupsList();
        break;

      case "discover":
      default:
        list = await getDiscoverList();
        break;
    }

    // A newer request started while we were waiting
    if (requestId !== state.requestId) return;

    if (state.searchQuery) list = rankSearchResults(list);

    const start = state.currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const page = list.slice(start, end);

    state.currentPage++;
    state.hasMore = end < list.length;

    clearSkeletons();

    let added = 0;

    page.forEach(group => {
      if (state.renderedGroupIds.has(group.id)) return;

      const card = buildGroupCard(group);
      if (!card) return;

      state.renderedGroupIds.add(group.id);
      groupsGrid.appendChild(card);
      added++;
    });

    // Empty state
    if (reset && added === 0) {
      if (groupsEmptyMessage) groupsEmptyMessage.textContent = buildEmptyMessage();
      if (groupsEmptyState) groupsEmptyState.style.display = "flex";
    } else if (groupsEmptyState) {
      groupsEmptyState.style.display = "none";
    }

    if (loadMoreBtn) loadMoreBtn.style.display = state.hasMore ? "block" : "none";
  } catch (error) {
    if (requestId !== state.requestId) return;

    logFirestoreError(`Loading groups — ${state.activeTab}`, error);

    clearSkeletons();
    showToast("Could not load groups right now.", "error");
  } finally {
    // Only the newest request controls the loading flag / button
    if (requestId === state.requestId) {
      state.isLoading = false;

      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.classList.remove("is-loading");
      }
    }
  }
}


// ============================================================
// EMPTY MESSAGE
// ============================================================

function buildEmptyMessage() {
  if (state.searchQuery) {
    return state.activeTab === "my-groups"
      ? `None of your groups matched "${state.searchQuery}".`
      : `No groups matched "${state.searchQuery}".`;
  }

  if (state.activeTab === "my-groups") {
    return state.activeCategory !== "all"
      ? `You have no groups in ${CATEGORY_LABELS[state.activeCategory] || state.activeCategory}.`
      : "You haven't created or joined any groups yet.";
  }

  if (state.activeTab === "recommended") {
    return "No recommended groups are available right now.";
  }

  if (state.activeCategory !== "all") {
    return `No groups found in ${CATEGORY_LABELS[state.activeCategory] || state.activeCategory}.`;
  }

  return "No groups available right now.";
}


// ============================================================
// SKELETONS
// ============================================================

function renderSkeletons(count) {
  const template = skeletonCardTemplate?.content?.firstElementChild;
  if (!template || !groupsGrid) return;

  for (let i = 0; i < count; i++) {
    const node = template.cloneNode(true);
    node.dataset.skeleton = "true";
    groupsGrid.appendChild(node);
  }
}

function clearSkeletons() {
  groupsGrid
    ?.querySelectorAll('[data-skeleton="true"]')
    .forEach(element => element.remove());
}


// ============================================================
// TABS
// ============================================================

tabsContainer?.addEventListener("click", event => {
  const tab = event.target.closest(".tab");
  if (!tab) return;

  const tabName = tab.dataset.tab;
  if (!tabName || state.activeTab === tabName) return;

  tabsContainer.querySelectorAll(".tab").forEach(button => button.classList.remove("is-active"));
  tab.classList.add("is-active");

  state.activeTab = tabName;

  // Reset search when changing tabs
  clearTimeout(state.searchDebounceHandle);
  state.searchQuery = "";

  if (searchInput) searchInput.value = "";
  searchClearBtn?.classList.remove("is-visible");
  searchLoading?.classList.remove("is-visible");

  loadGroupsForActiveView(true);
});


// ============================================================
// CATEGORY FILTER
// ============================================================

categoryChipsContainer?.addEventListener("click", event => {
  const chip = event.target.closest(".category-chip");
  if (!chip) return;

  const category = chip.dataset.category;
  if (!category) return;

  categoryChipsContainer
    .querySelectorAll(".category-chip")
    .forEach(item => item.classList.remove("is-active"));

  chip.classList.add("is-active");

  state.activeCategory = category;

  loadGroupsForActiveView(true);
});


// ============================================================
// SEARCH
// ============================================================

searchInput?.addEventListener("input", () => {
  const value = searchInput.value.trim();

  searchClearBtn?.classList.toggle("is-visible", value.length > 0);

  clearTimeout(state.searchDebounceHandle);

  if (!value) {
    state.searchQuery = "";
    searchLoading?.classList.remove("is-visible");
    loadGroupsForActiveView(true);
    return;
  }

  searchLoading?.classList.add("is-visible");

  state.searchDebounceHandle = setTimeout(() => {
    state.searchQuery = value.toLowerCase();
    searchLoading?.classList.remove("is-visible");
    loadGroupsForActiveView(true);
  }, 350);
});

searchClearBtn?.addEventListener("click", () => {
  clearTimeout(state.searchDebounceHandle);

  if (searchInput) searchInput.value = "";

  state.searchQuery = "";

  searchClearBtn.classList.remove("is-visible");
  searchLoading?.classList.remove("is-visible");

  loadGroupsForActiveView(true);
});


// ============================================================
// LOAD MORE
// ============================================================

loadMoreBtn?.addEventListener("click", () => {
  loadGroupsForActiveView(false);
});


// ============================================================
// INITIAL UI
// ============================================================

if (groupsEmptyState) groupsEmptyState.style.display = "none";
if (loadMoreBtn) loadMoreBtn.style.display = "none";

// Show placeholders right away instead of a blank grid
renderSkeletons(6);
