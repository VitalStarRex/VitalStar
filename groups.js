// ============================================================
// VITALSTAR — groups.js
// ============================================================
// Handles:
//
// • Authentication
// • Top 5 Most Active Groups
// • New Groups
// • Recommended Groups
// • My Groups
// • Trending Groups
// • Search
// • Category filtering
// • Public / Private joining
// • Pagination
// • Skeleton loading
// • Premium groups
//
// Compatible with create-group.js data:
//
// groups/{groupId}
//
// ownerId
// name
// description
// category
// searchTokens
// coverURL
// avatarURL
// privacy
// type
// memberCount
// followerCount
// postCount
// onlineCount
// status
// premiumStatus
// createdAt
// updatedAt
// members: {
//    [uid]: {
//       role,
//       status,
//       joinedAt
//    }
// }
//
// Also supports:
//
// groups/{groupId}/members/{uid}
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
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 12;
const TOP_ACTIVE_LIMIT = 5;
const NEW_GROUPS_LIMIT = 5;
const TRENDING_LIMIT = 6;


// ============================================================
// DOM
// ============================================================

const navUserAvatar =
  document.getElementById("navUserAvatar");

const searchInput =
  document.getElementById("searchInput");

const searchClearBtn =
  document.getElementById("searchClearBtn");

const searchLoading =
  document.getElementById("searchLoading");

const categoryChipsContainer =
  document.getElementById("categoryChips");

const tabsContainer =
  document.getElementById("groupTabs");

const trendingList =
  document.getElementById("trendingList");

const trendingSection =
  document.getElementById("trendingSection");

const groupsGrid =
  document.getElementById("groupsGrid");

const groupsEmptyState =
  document.getElementById("groupsEmptyState");

const groupsEmptyMessage =
  document.getElementById("groupsEmptyMessage");

const loadMoreBtn =
  document.getElementById("loadMoreBtn");

const toastContainer =
  document.getElementById("toast-container");

const groupCardTemplate =
  document.getElementById("groupCardTemplate");

const trendingCardTemplate =
  document.getElementById("trendingCardTemplate");

const skeletonCardTemplate =
  document.getElementById("skeletonCardTemplate");


// ============================================================
// OPTIONAL SECTION ELEMENTS
// ============================================================

const topActiveList =
  document.getElementById("topActiveList");

const topActiveSection =
  document.getElementById("topActiveSection");

const newGroupsList =
  document.getElementById("newGroupsList");

const newGroupsSection =
  document.getElementById("newGroupsSection");


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

  activeTab: "discover",

  activeCategory: "all",

  searchQuery: "",

  searchDebounceHandle: null,

  lastVisibleDoc: null,

  hasMore: false,

  isLoading: false,

  membershipMap: new Map(),

  membershipList: [],

  myGroups: [],

  myGroupsPageIndex: 0,

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

  const toast =
    document.createElement("div");

  toast.className =
    `toast toast--${type}`;

  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span></span>
  `;

  const text =
    toast.querySelector("span");

  if (text) {
    text.textContent = message;
  }

  toastContainer.appendChild(toast);

  setTimeout(() => {

    toast.classList.add("is-leaving");

    setTimeout(() => {
      toast.remove();
    }, 400);

  }, 3500);
}


// ============================================================
// FIRESTORE ERROR
// ============================================================

function logFirestoreError(context, error) {

  console.error(
    `[Firestore error] ${context}`
  );

  console.error(error);

  if (error?.code) {
    console.error(
      "Code:",
      error.code
    );
  }

  if (error?.message) {

    console.error(
      "Message:",
      error.message
    );

    const match =
      error.message.match(
        /https:\/\/console\.firebase\.google\.com\S*/
      );

    if (match) {

      console.error(
        "Firestore index:",
        match[0]
      );

    }

  }
}


// ============================================================
// UTILITIES
// ============================================================

function formatCount(value) {

  const num =
    Number(value) || 0;

  if (num >= 1000000) {

    return (
      (num / 1000000)
        .toFixed(1)
        .replace(/\.0$/, "") +
      "M"
    );

  }

  if (num >= 1000) {

    return (
      (num / 1000)
        .toFixed(1)
        .replace(/\.0$/, "") +
      "K"
    );

  }

  return String(num);
}


function initialsFrom(name) {

  return (
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase()
  );

}


function setText(root, selector, value) {

  if (!root) return;

  const el =
    root.querySelector(selector);

  if (el) {
    el.textContent =
      value ?? "";
  }

}


function applyMediaBackground(
  element,
  url,
  fallback = ""
) {

  if (!element) return;

  if (url) {

    element.style.backgroundImage =
      `url("${url}")`;

    element.style.backgroundSize =
      "cover";

    element.style.backgroundPosition =
      "center";

    element.textContent = "";

  } else {

    element.style.backgroundImage =
      "";

    element.textContent =
      fallback;

  }

}


function getCreatedTime(group) {

  if (!group?.createdAt) return 0;

  if (
    typeof group.createdAt.toMillis ===
    "function"
  ) {

    return group.createdAt.toMillis();

  }

  if (
    group.createdAt.seconds
  ) {

    return group.createdAt.seconds * 1000;

  }

  return 0;
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
        "login.html";

      return;

    }

    state.currentUser =
      user;

    if (
      user.photoURL &&
      navUserAvatar
    ) {

      applyMediaBackground(
        navUserAvatar,
        user.photoURL
      );

    }

    try {

      await loadUserMemberships();

      await Promise.all([
        loadTopActiveGroups(),
        loadNewGroups(),
        loadTrendingGroups()
      ]);

      await loadGroupsForActiveView(true);

    } catch (error) {

      logFirestoreError(
        "Groups page initialization",
        error
      );

      showToast(
        "Could not load groups. Please refresh.",
        "error"
      );

    }

  }
);


// ============================================================
// LOAD USER MEMBERSHIPS
// ============================================================
//
// Supports:
//
// 1. groups/{groupId}/members/{uid}
//
// 2. groups where ownerId == current user
//
// The second part is important because create-group.js creates
// the owner inside the group's `members` MAP and sets ownerId.
// ============================================================

async function loadUserMemberships() {

  state.membershipMap.clear();

  state.membershipList = [];

  const uid =
    state.currentUser.uid;


  // ----------------------------------------------------------
  // SUBCOLLECTION MEMBERS
  // ----------------------------------------------------------

  try {

    const membersQuery =
      query(
        collectionGroup(
          db,
          "members"
        ),
        where(
          "uid",
          "==",
          uid
        ),
        limit(500)
      );

    const snapshot =
      await getDocs(
        membersQuery
      );

    snapshot.forEach(
      memberDoc => {

        const parentGroup =
          memberDoc.ref.parent.parent;

        if (!parentGroup) return;

        const groupId =
          parentGroup.id;

        const data =
          memberDoc.data();

        const membership = {

          groupId,

          status:
            data.status ||
            "active",

          role:
            data.role ||
            "member",

          category:
            data.category ||
            "",

          joinedAt:
            data.joinedAt || null

        };

        state.membershipMap.set(
          groupId,
          membership
        );

      }
    );

  } catch (error) {

    logFirestoreError(
      "Loading members subcollections",
      error
    );

  }


  // ----------------------------------------------------------
  // GROUPS CREATED BY USER
  // ----------------------------------------------------------

  try {

    const ownerQuery =
      query(
        collection(
          db,
          "groups"
        ),
        where(
          "ownerId",
          "==",
          uid
        ),
        limit(500)
      );

    const snapshot =
      await getDocs(
        ownerQuery
      );

    snapshot.forEach(
      groupDoc => {

        const group =
          groupDoc.data();

        const existing =
          state.membershipMap.get(
            groupDoc.id
          );

        state.membershipMap.set(
          groupDoc.id,
          {

            groupId:
              groupDoc.id,

            status:
              "active",

            role:
              "owner",

            category:
              group.category ||
              existing?.category ||
              "",

            joinedAt:
              group.createdAt ||
              existing?.joinedAt ||
              null

          }
        );

      }
    );

  } catch (error) {

    logFirestoreError(
      "Loading groups owned by user",
      error
    );

  }


  // ----------------------------------------------------------
  // BUILD SORTED LIST
  // ----------------------------------------------------------

  state.membershipList =
    Array.from(
      state.membershipMap.values()
    );

  state.membershipList.sort(
    (a, b) => {

      const aTime =
        a.joinedAt?.toMillis?.() ||
        0;

      const bTime =
        b.joinedAt?.toMillis?.() ||
        0;

      return bTime - aTime;

    }
  );

}


// ============================================================
// TOP 5 MOST ACTIVE GROUPS
// ============================================================
//
// Activity score:
//
// memberCount
// + postCount * 3
// + onlineCount * 2
//
// We retrieve public groups by memberCount and then calculate
// the final activity score client-side. This avoids introducing
// a new Firestore field.
// ============================================================

async function loadTopActiveGroups() {

  if (
    !topActiveList ||
    !topActiveSection ||
    !groupCardTemplate
  ) {
    return;
  }

  try {

    const q =
      query(
        collection(
          db,
          "groups"
        ),
        where(
          "privacy",
          "==",
          "public"
        ),
        where(
          "status",
          "==",
          "active"
        ),
        orderBy(
          "memberCount",
          "desc"
        ),
        limit(20)
      );

    const snapshot =
      await getDocs(q);

    const groups =
      snapshot.docs
        .map(
          d => ({
            id: d.id,
            ...d.data()
          })
        )
        .map(
          group => ({

            ...group,

            activityScore:

              (Number(
                group.memberCount
              ) || 0)

              +

              (
                Number(
                  group.postCount
                ) || 0
              ) * 3

              +

              (
                Number(
                  group.onlineCount
                ) || 0
              ) * 2

          })
        )
        .sort(
          (a, b) =>
            b.activityScore -
            a.activityScore
        )
        .slice(
          0,
          TOP_ACTIVE_LIMIT
        );


    topActiveList.innerHTML =
      "";

    if (!groups.length) {

      topActiveSection.style.display =
        "none";

      return;

    }

    topActiveSection.style.display =
      "";

    groups.forEach(
      (group, index) => {

        const card =
          buildSpecialGroupCard(
            group,
            index + 1
          );

        if (card) {
          topActiveList.appendChild(
            card
          );
        }

      }
    );

  } catch (error) {

    logFirestoreError(
      "Loading Top 5 Most Active Groups",
      error
    );

    topActiveSection.style.display =
      "none";

  }

}


// ============================================================
// NEW GROUPS
// ============================================================

async function loadNewGroups() {

  if (
    !newGroupsList ||
    !newGroupsSection ||
    !groupCardTemplate
  ) {
    return;
  }

  try {

    const q =
      query(
        collection(
          db,
          "groups"
        ),
        where(
          "status",
          "==",
          "active"
        ),
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(
          NEW_GROUPS_LIMIT
        )
      );

    const snapshot =
      await getDocs(q);

    newGroupsList.innerHTML =
      "";

    if (snapshot.empty) {

      newGroupsSection.style.display =
        "none";

      return;

    }

    newGroupsSection.style.display =
      "";

    snapshot.forEach(
      groupDoc => {

        const group = {

          id:
            groupDoc.id,

          ...groupDoc.data()

        };

        const card =
          buildGroupCard(
            group
          );

        if (card) {
          newGroupsList.appendChild(
            card
          );
        }

      }
    );

  } catch (error) {

    logFirestoreError(
      "Loading new groups",
      error
    );

    newGroupsSection.style.display =
      "none";

  }

}


// ============================================================
// TRENDING
// ============================================================

async function loadTrendingGroups() {

  if (
    !trendingList ||
    !trendingSection ||
    !trendingCardTemplate
  ) {
    return;
  }

  try {

    const q =
      query(
        collection(
          db,
          "groups"
        ),
        where(
          "privacy",
          "==",
          "public"
        ),
        where(
          "status",
          "==",
          "active"
        ),
        orderBy(
          "memberCount",
          "desc"
        ),
        limit(
          TRENDING_LIMIT
        )
      );

    const snapshot =
      await getDocs(q);

    trendingList.innerHTML =
      "";

    if (snapshot.empty) {

      trendingSection.style.display =
        "none";

      return;

    }

    trendingSection.style.display =
      "";

    snapshot.docs.forEach(
      (groupDoc, index) => {

        const group = {

          id:
            groupDoc.id,

          ...groupDoc.data()

        };

        const card =
          buildTrendingCard(
            group,
            index + 1
          );

        if (card) {
          trendingList.appendChild(
            card
          );
        }

      }
    );

  } catch (error) {

    logFirestoreError(
      "Loading trending groups",
      error
    );

    trendingSection.style.display =
      "none";

  }

}


// ============================================================
// TRENDING CARD
// ============================================================

function buildTrendingCard(
  group,
  rank
) {

  const template =
    trendingCardTemplate
      ?.content
      ?.firstElementChild;

  if (!template) return null;

  const node =
    template.cloneNode(true);

  node.href =
    `group.html?id=${encodeURIComponent(group.id)}`;

  node.dataset.groupId =
    group.id;

  setText(
    node,
    ".trending-card__rank",
    `#${rank}`
  );

  const cover =
    node.querySelector(
      ".trending-card__cover"
    );

  if (cover) {

    if (group.coverURL) {

      cover.style.backgroundImage =
        `url("${group.coverURL}")`;

      cover.style.backgroundSize =
        "cover";

      cover.style.backgroundPosition =
        "center";

    }

  }

  const avatar =
    node.querySelector(
      ".trending-card__avatar"
    );

  applyMediaBackground(
    avatar,
    group.avatarURL,
    initialsFrom(group.name)
  );

  setText(
    node,
    ".trending-card__name",
    group.name ||
      "Untitled group"
  );

  setText(
    node,
    ".trending-card__member-count",
    formatCount(
      group.memberCount
    )
  );

  return node;

}


// ============================================================
// SPECIAL CARD
// ============================================================

function buildSpecialGroupCard(
  group,
  rank
) {

  const card =
    buildGroupCard(group);

  if (!card) return null;

  card.dataset.rank =
    String(rank);

  const rankElement =
    card.querySelector(
      ".group-card__rank"
    );

  if (rankElement) {

    rankElement.textContent =
      `#${rank}`;

  }

  return card;

}


// ============================================================
// GROUP CARD
// ============================================================

function buildGroupCard(group) {

  if (!groupCardTemplate) {
    return null;
  }

  const template =
    groupCardTemplate
      .content
      ?.firstElementChild;

  if (!template) {
    return null;
  }

  const node =
    template.cloneNode(true);

  node.href =
    `group.html?id=${encodeURIComponent(group.id)}`;

  node.dataset.groupId =
    group.id;


  // ----------------------------------------------------------
  // COVER
  // ----------------------------------------------------------

  const cover =
    node.querySelector(
      ".group-card__cover"
    );

  if (cover && group.coverURL) {

    cover.style.backgroundImage =
      `url("${group.coverURL}")`;

    cover.style.backgroundSize =
      "cover";

    cover.style.backgroundPosition =
      "center";

  }


  // ----------------------------------------------------------
  // AVATAR
  // ----------------------------------------------------------

  const avatar =
    node.querySelector(
      ".group-card__avatar"
    );

  applyMediaBackground(
    avatar,
    group.avatarURL,
    initialsFrom(group.name)
  );


  // ----------------------------------------------------------
  // NAME
  // ----------------------------------------------------------

  setText(
    node,
    ".group-card__name",
    group.name ||
      "Untitled group"
  );


  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  setText(
    node,
    ".group-card__desc",
    group.description ||
      ""
  );


  // ----------------------------------------------------------
  // COUNTS
  // ----------------------------------------------------------

  setText(
    node,
    ".group-card__member-count",
    formatCount(
      group.memberCount
    )
  );

  setText(
    node,
    ".group-card__post-count",
    formatCount(
      group.postCount
    )
  );

  setText(
    node,
    ".group-card__online-count",
    formatCount(
      group.onlineCount
    )
  );


  // ----------------------------------------------------------
  // PRIVACY
  // ----------------------------------------------------------

  const privacyBadge =
    node.querySelector(
      ".group-card__privacy-badge"
    );

  if (privacyBadge) {

    if (
      group.privacy ===
      "private"
    ) {

      privacyBadge.className =
        "badge badge--private group-card__privacy-badge";

      privacyBadge.innerHTML =
        `
          <i class="fa-solid fa-lock"></i>
          Private
        `;

    } else {

      privacyBadge.className =
        "badge badge--public group-card__privacy-badge";

      privacyBadge.innerHTML =
        `
          <i class="fa-solid fa-globe"></i>
          Public
        `;

    }

  }


  // ----------------------------------------------------------
  // PREMIUM
  // ----------------------------------------------------------

  const premiumBadge =
    node.querySelector(
      ".group-card__premium-badge"
    );

  if (premiumBadge) {

    const isPremium =
      group.type ===
        "premium" ||
      group.premiumStatus ===
        "active" ||
      group.premiumActivation
        ?.required === true;

    premiumBadge.style.display =
      isPremium
        ? "inline-flex"
        : "none";

  }


  // ----------------------------------------------------------
  // VERIFIED
  // ----------------------------------------------------------

  const verifiedBadge =
    node.querySelector(
      ".group-card__verified-badge"
    );

  if (verifiedBadge) {

    verifiedBadge.style.display =
      group.verified
        ? "inline-flex"
        : "none";

  }


  // ----------------------------------------------------------
  // JOIN BUTTON
  // ----------------------------------------------------------

  const joinBtn =
    node.querySelector(
      ".group-card__join-btn"
    );

  if (joinBtn) {

    applyJoinButtonState(
      joinBtn,
      group
    );

    joinBtn.addEventListener(
      "click",
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


  return node;

}


// ============================================================
// JOIN BUTTON STATE
// ============================================================

function applyJoinButtonState(
  button,
  group
) {

  if (!button) return;

  const membership =
    state.membershipMap.get(
      group.id
    );


  button.disabled =
    false;

  button.className =
    "btn-join group-card__join-btn";


  // OWNER
  if (
    group.ownerId ===
    state.currentUser?.uid
  ) {

    button.textContent =
      "Manage group";

    button.classList.add(
      "is-primary"
    );

    return;

  }


  // PENDING
  if (
    membership?.status ===
    "pending"
  ) {

    button.textContent =
      "Requested";

    button.classList.add(
      "is-pending"
    );

    button.disabled =
      true;

    return;

  }


  // JOINED
  if (
    membership &&
    membership.status ===
      "active"
  ) {

    button.textContent =
      "✓ Joined";

    button.classList.add(
      "is-joined"
    );

    button.disabled =
      true;

    return;

  }


  // INACTIVE PREMIUM GROUP
  if (
    group.status ===
      "pending_payment"
  ) {

    button.textContent =
      "Unavailable";

    button.disabled =
      true;

    return;

  }


  // PRIVATE
  if (
    group.privacy ===
    "private"
  ) {

    button.textContent =
      "Request to join";

    button.classList.add(
      "is-primary"
    );

    return;

  }


  // PUBLIC
  button.textContent =
    "Join group";

  button.classList.add(
    "is-primary"
  );

}


// ============================================================
// JOIN GROUP
// ============================================================

async function handleJoinClick(
  group,
  button
) {

  if (!state.currentUser) {
    showToast(
      "Please sign in first.",
      "error"
    );
    return;
  }


  // Owner
  if (
    group.ownerId ===
    state.currentUser.uid
  ) {

    window.location.href =
      `group.html?id=${encodeURIComponent(group.id)}`;

    return;

  }


  // Already member
  if (
    state.membershipMap.has(
      group.id
    )
  ) {

    return;

  }


  // Premium inactive
  if (
    group.status ===
    "pending_payment"
  ) {

    showToast(
      "This premium group is not active yet.",
      "info"
    );

    return;

  }


  const originalText =
    button.textContent;

  button.disabled =
    true;

  button.textContent =
    "Joining…";


  const user =
    state.currentUser;

  const isPrivate =
    group.privacy ===
    "private";

  const status =
    isPrivate
      ? "pending"
      : "active";


  const memberRef =
    doc(
      db,
      "groups",
      group.id,
      "members",
      user.uid
    );

  const groupRef =
    doc(
      db,
      "groups",
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

        if (
          existing.exists()
        ) {
          return;
        }


        transaction.set(
          memberRef,
          {

            uid:
              user.uid,

            displayName:
              user.displayName ||
              "VitalStar Member",

            photoURL:
              user.photoURL ||
              "",

            role:
              "member",

            status,

            category:
              group.category ||
              "",

            joinedAt:
              serverTimestamp()

          }
        );


        if (
          status ===
          "active"
        ) {

          transaction.update(
            groupRef,
            {

              memberCount:
                increment(1),

              updatedAt:
                serverTimestamp()

            }
          );

        }

      }
    );


    // --------------------------------------------------------
    // UPDATE LOCAL STATE
    // --------------------------------------------------------

    const membership = {

      groupId:
        group.id,

      status,

      role:
        "member",

      category:
        group.category ||
        "",

      joinedAt:
        null

    };


    state.membershipMap.set(
      group.id,
      membership
    );


    state.membershipList.unshift(
      membership
    );


    applyJoinButtonState(
      button,
      group
    );


    if (isPrivate) {

      showToast(
        "Join request sent successfully.",
        "success"
      );

    } else {

      showToast(
        `You joined ${group.name}.`,
        "success"
      );

    }


    // Refresh My Groups if currently open
    if (
      state.activeTab ===
      "my-groups"
    ) {

      await loadGroupsForActiveView(
        true
      );

    }

  } catch (error) {

    logFirestoreError(
      "Joining group",
      error
    );

    button.disabled =
      false;

    button.textContent =
      originalText;

    showToast(
      "Could not join this group. Please try again.",
      "error"
    );

  }

}


// ============================================================
// MAIN GROUP LOADER
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


  if (reset) {

    state.lastVisibleDoc =
      null;

    state.hasMore =
      false;

    state.myGroupsPageIndex =
      0;

    state.renderedGroupIds.clear();

    groupsGrid.innerHTML =
      "";

    if (groupsEmptyState) {

      groupsEmptyState.style.display =
        "none";

    }

    renderSkeletons(6);

  }


  if (loadMoreBtn) {

    loadMoreBtn.disabled =
      true;

    loadMoreBtn.classList.add(
      "is-loading"
    );

  }


  try {

    let groups = [];


    if (
      state.searchQuery
    ) {

      groups =
        await fetchSearchResults(
          reset
        );

    } else {

      switch (
        state.activeTab
      ) {

        case "recommended":

          groups =
            await fetchRecommendedGroups(
              reset
            );

          break;


        case "my-groups":

          groups =
            await fetchMyGroups(
              reset
            );

          break;


        case "discover":

        default:

          groups =
            await fetchDiscoverGroups(
              reset
            );

          break;

      }

    }


    clearSkeletons();


    if (reset) {

      groupsGrid.innerHTML =
        "";

      state.renderedGroupIds.clear();

    }


    let added =
      0;


    groups.forEach(
      group => {

        if (
          state.renderedGroupIds.has(
            group.id
          )
        ) {
          return;
        }


        const card =
          buildGroupCard(
            group
          );

        if (!card) return;


        state.renderedGroupIds.add(
          group.id
        );

        groupsGrid.appendChild(
          card
        );

        added++;

      }
    );


    if (
      reset &&
      added === 0
    ) {

      if (groupsEmptyMessage) {

        groupsEmptyMessage.textContent =
          buildEmptyMessage();

      }

      if (groupsEmptyState) {

        groupsEmptyState.style.display =
          "flex";

      }

    } else if (
      groupsEmptyState
    ) {

      groupsEmptyState.style.display =
        "none";

    }


    if (loadMoreBtn) {

      loadMoreBtn.style.display =
        state.hasMore
          ? "block"
          : "none";

    }

  } catch (error) {

    logFirestoreError(
      `Loading groups — ${state.activeTab}`,
      error
    );

    clearSkeletons();

    showToast(
      "Could not load groups right now.",
      "error"
    );

  } finally {

    state.isLoading =
      false;

    if (loadMoreBtn) {

      loadMoreBtn.disabled =
        false;

      loadMoreBtn.classList.remove(
        "is-loading"
      );

    }

  }

}


// ============================================================
// EMPTY MESSAGE
// ============================================================

function buildEmptyMessage() {

  if (
    state.searchQuery
  ) {

    return (
      `No groups matched "${state.searchQuery}".`
    );

  }


  if (
    state.activeTab ===
    "my-groups"
  ) {

    return (
      "You haven't created or joined any groups yet."
    );

  }


  if (
    state.activeTab ===
    "recommended"
  ) {

    return (
      "No recommended groups are available right now."
    );

  }


  if (
    state.activeCategory !==
    "all"
  ) {

    return (
      `No groups found in ${
        CATEGORY_LABELS[
          state.activeCategory
        ] ||
        state.activeCategory
      }.`
    );

  }


  return (
    "No groups available right now."
  );

}


// ============================================================
// DISCOVER
// ============================================================

async function fetchDiscoverGroups(
  reset
) {

  const constraints = [];


  constraints.push(
    where(
      "status",
      "==",
      "active"
    )
  );


  if (
    state.activeCategory !==
    "all"
  ) {

    constraints.push(
      where(
        "category",
        "==",
        state.activeCategory
      )
    );

  }


  constraints.push(
    orderBy(
      "createdAt",
      "desc"
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
        collection(
          db,
          "groups"
        ),
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
//
// Recommended logic:
//
// • Uses categories the user already belongs to
// • If a category is selected, uses that category
// • Removes groups user already owns/has joined
// • Falls back to popular public groups
// ============================================================

async function fetchRecommendedGroups(
  reset
) {

  const joinedCategories =
    [
      ...new Set(
        state.membershipList
          .map(
            item =>
              item.category
          )
          .filter(Boolean)
      )
    ]
    .slice(0, 10);


  const constraints = [

    where(
      "privacy",
      "==",
      "public"
    ),

    where(
      "status",
      "==",
      "active"
    )

  ];


  if (
    state.activeCategory !==
    "all"
  ) {

    constraints.push(
      where(
        "category",
        "==",
        state.activeCategory
      )
    );

  } else if (
    joinedCategories.length
  ) {

    constraints.push(
      where(
        "category",
        "in",
        joinedCategories
      )
    );

  }


  constraints.push(
    orderBy(
      "memberCount",
      "desc"
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
        collection(
          db,
          "groups"
        ),
        ...constraints
      )
    );


  const groups =
    consumeSnapshot(
      snapshot
    );


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
// This does NOT depend only on collectionGroup("members").
//
// It combines:
//
// A. Groups owned by current user
// B. Groups joined through members subcollection
//
// This fixes the problem caused by create-group.js storing the
// owner in the group's `members` MAP.
// ============================================================

async function fetchMyGroups(
  reset
) {

  if (reset) {

    await rebuildMyGroups();

    state.myGroupsPageIndex =
      0;

  }


  let list =
    [...state.myGroups];


  if (
    state.activeCategory !==
    "all"
  ) {

    list =
      list.filter(
        group =>
          group.category ===
          state.activeCategory
      );

  }


  const start =
    state.myGroupsPageIndex *
    PAGE_SIZE;

  const end =
    start + PAGE_SIZE;


  const page =
    list.slice(
      start,
      end
    );


  state.myGroupsPageIndex++;


  state.hasMore =
    end < list.length;


  if (!page.length) {

    return [];

  }


  return page;

}


// ============================================================
// REBUILD MY GROUPS
// ============================================================

async function rebuildMyGroups() {

  const uid =
    state.currentUser.uid;

  const ids =
    new Set();


  // ----------------------------------------------------------
  // 1. OWNER GROUPS
  // ----------------------------------------------------------

  try {

    const ownerQuery =
      query(
        collection(
          db,
          "groups"
        ),
        where(
          "ownerId",
          "==",
          uid
        ),
        limit(500)
      );

    const snapshot =
      await getDocs(
        ownerQuery
      );

    snapshot.forEach(
      d => ids.add(d.id)
    );

  } catch (error) {

    logFirestoreError(
      "Finding owned groups",
      error
    );

  }


  // ----------------------------------------------------------
  // 2. MEMBER SUBCOLLECTION GROUPS
  // ----------------------------------------------------------

  try {

    const memberQuery =
      query(
        collectionGroup(
          db,
          "members"
        ),
        where(
          "uid",
          "==",
          uid
        ),
        limit(500)
      );

    const snapshot =
      await getDocs(
        memberQuery
      );

    snapshot.forEach(
      memberDoc => {

        const parent =
          memberDoc.ref.parent.parent;

        if (parent) {
          ids.add(parent.id);
        }

      }
    );

  } catch (error) {

    logFirestoreError(
      "Finding joined groups",
      error
    );

  }


  // ----------------------------------------------------------
  // 3. GET GROUP DOCUMENTS
  // ----------------------------------------------------------

  const idArray =
    [...ids];


  const groups = [];


  // Firestore getDoc does not require a composite index.
  const documents =
    await Promise.all(
      idArray.map(
        async groupId => {

          try {

            const snapshot =
              await getDoc(
                doc(
                  db,
                  "groups",
                  groupId
                )
              );

            if (!snapshot.exists()) {
              return null;
            }

            return {

              id:
                snapshot.id,

              ...snapshot.data()

            };

          } catch (error) {

            console.error(
              "Could not load group:",
              groupId,
              error
            );

            return null;

          }

        }
      )
    );


  documents.forEach(
    group => {

      if (!group) return;

      // Don't display inactive groups in My Groups
      // unless they are owned by the user.
      if (
        group.status !==
          "active" &&
        group.ownerId !== uid
      ) {
        return;
      }

      groups.push(group);

    }
  );


  // ----------------------------------------------------------
  // SORT
  // ----------------------------------------------------------

  groups.sort(
    (a, b) => {

      const aOwned =
        a.ownerId === uid;

      const bOwned =
        b.ownerId === uid;


      // Owned groups first
      if (
        aOwned &&
        !bOwned
      ) {
        return -1;
      }

      if (
        !aOwned &&
        bOwned
      ) {
        return 1;
      }


      return (
        getCreatedTime(b) -
        getCreatedTime(a)
      );

    }
  );


  state.myGroups =
    groups;

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
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10);


  if (!words.length) {

    state.hasMore =
      false;

    return [];

  }


  const constraints = [

    where(
      "searchTokens",
      "array-contains-any",
      words
    )

  ];


  if (
    state.activeCategory !==
    "all"
  ) {

    constraints.push(
      where(
        "category",
        "==",
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
        collection(
          db,
          "groups"
        ),
        ...constraints
      )
    );


  const groups =
    consumeSnapshot(
      snapshot
    );


  // ----------------------------------------------------------
  // AND FILTER
  // ----------------------------------------------------------

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
    docs.length ===
    PAGE_SIZE;


  return docs.map(
    d => ({

      id:
        d.id,

      ...d.data()

    })
  );

}


// ============================================================
// SKELETONS
// ============================================================

function renderSkeletons(
  count
) {

  if (
    !skeletonCardTemplate ||
    !groupsGrid
  ) {
    return;
  }


  const template =
    skeletonCardTemplate
      .content
      ?.firstElementChild;

  if (!template) return;


  for (
    let i = 0;
    i < count;
    i++
  ) {

    const node =
      template.cloneNode(true);

    node.dataset.skeleton =
      "true";

    groupsGrid.appendChild(
      node
    );

  }

}


function clearSkeletons() {

  if (!groupsGrid) return;

  groupsGrid
    .querySelectorAll(
      '[data-skeleton="true"]'
    )
    .forEach(
      element =>
        element.remove()
    );

}


// ============================================================
// TABS
// ============================================================

if (tabsContainer) {

  tabsContainer.addEventListener(
    "click",
    event => {

      const tab =
        event.target.closest(
          ".tab"
        );

      if (!tab) return;

      const tabName =
        tab.dataset.tab;

      if (!tabName) return;

      if (
        state.activeTab ===
        tabName
      ) {
        return;
      }


      tabsContainer
        .querySelectorAll(
          ".tab"
        )
        .forEach(
          button =>
            button.classList.remove(
              "is-active"
            )
        );


      tab.classList.add(
        "is-active"
      );


      state.activeTab =
        tabName;

      state.searchQuery =
        "";

      state.lastVisibleDoc =
        null;

      state.hasMore =
        false;

      if (searchInput) {

        searchInput.value =
          "";

      }

      if (searchClearBtn) {

        searchClearBtn.classList.remove(
          "is-visible"
        );

      }


      loadGroupsForActiveView(
        true
      );

    }
  );

}


// ============================================================
// CATEGORY FILTER
// ============================================================

if (
  categoryChipsContainer
) {

  categoryChipsContainer.addEventListener(
    "click",
    event => {

      const chip =
        event.target.closest(
          ".category-chip"
        );

      if (!chip) return;


      const category =
        chip.dataset.category;

      if (!category) return;


      categoryChipsContainer
        .querySelectorAll(
          ".category-chip"
        )
        .forEach(
          item =>
            item.classList.remove(
              "is-active"
            )
        );


      chip.classList.add(
        "is-active"
      );


      state.activeCategory =
        category;


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
    "input",
    () => {

      const value =
        searchInput.value.trim();


      if (searchClearBtn) {

        searchClearBtn.classList.toggle(
          "is-visible",
          value.length > 0
        );

      }


      clearTimeout(
        state.searchDebounceHandle
      );


      if (!value) {

        state.searchQuery =
          "";

        if (searchLoading) {

          searchLoading.classList.remove(
            "is-visible"
          );

        }

        loadGroupsForActiveView(
          true
        );

        return;

      }


      if (searchLoading) {

        searchLoading.classList.add(
          "is-visible"
        );

      }


      state.searchDebounceHandle =
        setTimeout(
          () => {

            state.searchQuery =
              value.toLowerCase();

            if (searchLoading) {

              searchLoading.classList.remove(
                "is-visible"
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
    "click",
    () => {

      if (searchInput) {

        searchInput.value =
          "";

      }

      state.searchQuery =
        "";

      searchClearBtn.classList.remove(
        "is-visible"
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
    "click",
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
// INITIAL UI
// ============================================================

if (groupsEmptyState) {

  groupsEmptyState.style.display =
    "none";

}

if (loadMoreBtn) {

  loadMoreBtn.style.display =
    "none";

}