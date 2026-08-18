// ============================================================
// VITALSTAR — group.js
// Controller for group.html
//
// Compatible with:
// • group.html
// • create-group.js
// • groups/{groupId} Firestore schema
//
// Features:
// • Authentication
// • Group ID detection
// • Group loading
// • Cover / avatar
// • Privacy / premium / verified
// • Owner information
// • Membership status
// • Join / leave
// • Private-group pending requests
// • Premium-group join protection
// • Tabs
// • Members
// • Admins / moderators
// • Rules
// • Share
// • Notifications
// • Group statistics
// ============================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// DOM HELPER
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// DOM
// ============================================================

const pageLoader = $("pageLoader");
const notFound = $("groupNotFoundState");
const pageContent = $("groupPageContent");

const groupCover = $("groupCover");
const coverEditBtn = $("coverEditBtn");

const groupAvatar = $("groupAvatar");
const groupName = $("groupName");
const navGroupTitle = $("navGroupTitle");

const groupPrivacyBadge = $("groupPrivacyBadge");
const groupPremiumBadge = $("groupPremiumBadge");
const groupVerifiedBadge = $("groupVerifiedBadge");

const groupCategoryChip = $("groupCategoryChip");
const groupOwnerText = $("groupOwnerText");
const groupCreatedText = $("groupCreatedText");
const groupDescription = $("groupDescription");

const statMemberCount = $("statMemberCount");
const statPostCount = $("statPostCount");
const statOnlineCount = $("statOnlineCount");
const statLevel = $("statLevel");

const joinLeaveBtn = $("joinLeaveBtn");
const shareBtn = $("shareBtn");
const inviteBtn = $("inviteBtn");

const yourRoleTag = $("yourRoleTag");
const yourRoleText = $("yourRoleText");

const lockedNotice = $("lockedNotice");
const groupContentGrid = $("groupContentGrid");

const tabsNav = $("groupTabsNav");

const postsTab = $("postsTab");
const membersTab = $("membersTab");
const chatTab = $("chatTab");
const subscriptionTab = $("subscriptionTab");
const settingsTab = $("settingsTab");

const subscriptionTabBtn = $("subscriptionTabBtn");
const settingsTabBtn = $("settingsTabBtn");

const rulesListDisplay = $("rulesListDisplay");
const rulesEmptyDisplay = $("rulesEmptyDisplay");

const adminsList = $("adminsList");
const adminsEmptyDisplay = $("adminsEmptyDisplay");

const notificationBellBtn = $("notificationBellBtn");
const notificationsPanel = $("notificationsPanel");
const closeNotificationsBtn = $("closeNotificationsBtn");
const notificationsList = $("notificationsList");
const notifUnreadDot = $("notifUnreadDot");

const navUserAvatar = $("navUserAvatar");

const toastContainer = $("toast-container");


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentGroup = null;
let groupId = null;

let currentMembership = null;
let currentRole = null;

let activeTab = "posts";

let loadingGroup = false;
let membershipBusy = false;


// ============================================================
// CATEGORY LABELS
// ============================================================

const categoryLabels = {
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
// TOAST
// ============================================================

function toast(message, type = "info") {

  if (!toastContainer) return;

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info"
  };

  const el = document.createElement("div");

  el.className = `toast toast--${type}`;

  el.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span></span>
  `;

  el.querySelector("span").textContent = message;

  toastContainer.appendChild(el);

  setTimeout(() => {

    el.classList.add("is-leaving");

    setTimeout(() => {
      el.remove();
    }, 250);

  }, 4500);
}


// ============================================================
// LOADER
// ============================================================

function hideLoader() {

  if (!pageLoader) return;

  pageLoader.classList.add("is-hidden");
}


function showNotFound() {

  hideLoader();

  if (pageContent) {
    pageContent.classList.remove("is-visible");
  }

  if (notFound) {
    notFound.classList.add("is-visible");
  }
}


function showPage() {

  hideLoader();

  if (notFound) {
    notFound.classList.remove("is-visible");
  }

  if (pageContent) {
    pageContent.classList.add("is-visible");
  }
}


// ============================================================
// GROUP ID
// ============================================================

function getGroupId() {

  const params =
    new URLSearchParams(location.search);

  return (
    params.get("id") ||
    params.get("groupId") ||
    ""
  ).trim();
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {
      location.href = "login.html";
      return;
    }

    currentUser = user;

    setNavAvatar(user);

    groupId = getGroupId();

    if (!groupId) {
      showNotFound();
      return;
    }

    await loadGroup();
  }
);


// ============================================================
// NAV AVATAR
// ============================================================

function setNavAvatar(user) {

  if (!navUserAvatar) return;

  if (user.photoURL) {

    navUserAvatar.style.backgroundImage =
      `url("${user.photoURL}")`;

    navUserAvatar.style.backgroundSize =
      "cover";

    navUserAvatar.style.backgroundPosition =
      "center";

    navUserAvatar.innerHTML = "";

  } else {

    navUserAvatar.style.backgroundImage = "";

    navUserAvatar.innerHTML =
      '<i class="fa-solid fa-user"></i>';
  }
}


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

  if (loadingGroup) return;

  loadingGroup = true;

  try {

    const ref =
      doc(
        db,
        "groups",
        groupId
      );

    const snapshot =
      await getDoc(ref);

    if (!snapshot.exists()) {
      showNotFound();
      return;
    }

    currentGroup = {
      id: snapshot.id,
      ...snapshot.data()
    };

    renderGroup();

    await resolveMembership();

    renderAccess();

    renderRules();

    renderAdmins();

    await loadPosts();

    await loadMembers();

    showPage();

  } catch (error) {

    console.error(
      "GROUP LOAD ERROR:",
      error
    );

    toast(
      "Unable to load this group.",
      "error"
    );

    showNotFound();

  } finally {

    loadingGroup = false;
  }
}


// ============================================================
// RENDER GROUP
// ============================================================

function renderGroup() {

  const group =
    currentGroup;

  if (!group) return;


  // ----------------------------------------------------------
  // TITLE
  // ----------------------------------------------------------

  const name =
    group.name ||
    "Untitled Group";

  groupName.textContent =
    name;

  navGroupTitle.textContent =
    name;

  document.title =
    `${name} · VitalStar`;


  // ----------------------------------------------------------
  // COVER
  // ----------------------------------------------------------

  if (group.coverURL) {

    groupCover.style.backgroundImage =
      `url("${group.coverURL}")`;

    groupCover.style.backgroundSize =
      "cover";

    groupCover.style.backgroundPosition =
      "center";

  } else {

    groupCover.style.backgroundImage =
      "linear-gradient(135deg,#1b3e8f,#241640)";
  }


  // ----------------------------------------------------------
  // AVATAR
  // ----------------------------------------------------------

  if (group.avatarURL) {

    groupAvatar.style.backgroundImage =
      `url("${group.avatarURL}")`;

    groupAvatar.style.backgroundSize =
      "cover";

    groupAvatar.style.backgroundPosition =
      "center";

    groupAvatar.innerHTML = "";

  } else {

    groupAvatar.style.backgroundImage = "";

    groupAvatar.innerHTML =
      '<i class="fa-solid fa-users"></i>';
  }


  // ----------------------------------------------------------
  // PRIVACY
  // ----------------------------------------------------------

  const privacy =
    group.privacy === "private"
      ? "private"
      : "public";

  if (privacy === "private") {

    groupPrivacyBadge.className =
      "badge badge--private";

    groupPrivacyBadge.innerHTML =
      '<i class="fa-solid fa-lock"></i> Private';

  } else {

    groupPrivacyBadge.className =
      "badge badge--public";

    groupPrivacyBadge.innerHTML =
      '<i class="fa-solid fa-globe"></i> Public';
  }


  // ----------------------------------------------------------
  // PREMIUM
  // ----------------------------------------------------------

  const premium =
    group.type === "premium";

  groupPremiumBadge.style.display =
    premium
      ? "inline-flex"
      : "none";


  // ----------------------------------------------------------
  // VERIFIED
  // ----------------------------------------------------------

  groupVerifiedBadge.style.display =
    group.verified === true
      ? "inline-flex"
      : "none";


  // ----------------------------------------------------------
  // CATEGORY
  // ----------------------------------------------------------

  groupCategoryChip.textContent =
    categoryLabels[group.category] ||
    group.category ||
    "General";


  // ----------------------------------------------------------
  // OWNER
  // ----------------------------------------------------------

  groupOwnerText.textContent =
    `Owned by ${group.ownerName || "VitalStar Member"}`;


  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  groupDescription.textContent =
    group.description ||
    "No group description has been added yet.";


  // ----------------------------------------------------------
  // STATS
  // ----------------------------------------------------------

  statMemberCount.textContent =
    formatNumber(
      group.memberCount || 0
    );

  statPostCount.textContent =
    formatNumber(
      group.postCount || 0
    );

  statOnlineCount.textContent =
    formatNumber(
      group.onlineCount || 0
    );

  statLevel.textContent =
    formatNumber(
      group.level || 1
    );


  // ----------------------------------------------------------
  // CREATED DATE
  // ----------------------------------------------------------

  groupCreatedText.textContent =
    `Created ${formatDate(group.createdAt)}`;
}


// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(value) {

  const number =
    Number(value) || 0;

  return number.toLocaleString();
}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(timestamp) {

  if (!timestamp) {
    return "recently";
  }

  try {

    const date =
      timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    );

  } catch {

    return "recently";
  }
}


// ============================================================
// MEMBERSHIP
// ============================================================

async function resolveMembership() {

  currentMembership = null;
  currentRole = null;

  if (!currentUser || !currentGroup) {
    return;
  }

  const members =
    currentGroup.members || {};

  const member =
    members[currentUser.uid];

  if (member) {

    currentMembership = member;

    currentRole =
      member.role || "member";

    return;
  }

  // ----------------------------------------------------------
  // Also check a dedicated membership document if one exists.
// This allows us to extend the system later without changing
// the group document.
// ----------------------------------------------------------

  try {

    const memberRef =
      doc(
        db,
        "groups",
        groupId,
        "members",
        currentUser.uid
      );

    const memberSnapshot =
      await getDoc(memberRef);

    if (memberSnapshot.exists()) {

      currentMembership =
        memberSnapshot.data();

      currentRole =
        currentMembership.role ||
        "member";
    }

  } catch (error) {

    console.warn(
      "Membership subcollection check failed:",
      error
    );
  }
}


// ============================================================
// ROLE HELPERS
// ============================================================

function isOwner() {

  return (
    currentGroup?.ownerId ===
    currentUser?.uid
  );
}


function isAdmin() {

  return (
    isOwner() ||
    currentRole === "admin"
  );
}


function isModerator() {

  return (
    isAdmin() ||
    currentRole === "moderator"
  );
}


function isMember() {

  return (
    currentMembership?.status ===
      "active" ||
    isOwner()
  );
}


function isPending() {

  return (
    currentMembership?.status ===
    "pending"
  );
}


// ============================================================
// ACCESS / HEADER
// ============================================================

function renderAccess() {

  const group =
    currentGroup;

  if (!group) return;


  // ----------------------------------------------------------
  // ROLE TAG
  // ----------------------------------------------------------

  if (isMember()) {

    yourRoleTag.classList.add(
      "is-visible"
    );

    yourRoleText.textContent =
      formatRole(currentRole);

  } else {

    yourRoleTag.classList.remove(
      "is-visible"
    );
  }


  // ----------------------------------------------------------
  // OWNER CONTROLS
  // ----------------------------------------------------------

  if (isOwner()) {

    coverEditBtn.classList.add(
      "is-visible"
    );

    inviteBtn.style.display =
      "flex";

    settingsTabBtn.style.display =
      "flex";

  } else {

    coverEditBtn.classList.remove(
      "is-visible"
    );

    inviteBtn.style.display =
      "none";

    settingsTabBtn.style.display =
      "none";
  }


  // ----------------------------------------------------------
  // SUBSCRIPTION TAB
  // ----------------------------------------------------------

  if (
    group.type === "premium" &&
    isMember()
  ) {

    subscriptionTabBtn.style.display =
      "flex";

  } else {

    subscriptionTabBtn.style.display =
      "none";
  }


  // ----------------------------------------------------------
  // PRIVATE GROUP
  // ----------------------------------------------------------

  if (
    group.privacy === "private" &&
    !isMember()
  ) {

    lockedNotice.classList.add(
      "is-visible"
    );

    groupContentGrid.style.display =
      "none";

  } else {

    lockedNotice.classList.remove(
      "is-visible"
    );

    groupContentGrid.style.display =
      "";
  }


  // ----------------------------------------------------------
  // JOIN BUTTON
  // ----------------------------------------------------------

  updateJoinButton();
}


// ============================================================
// ROLE LABEL
// ============================================================

function formatRole(role) {

  const labels = {
    owner: "Owner",
    admin: "Admin",
    moderator: "Moderator",
    member: "Member"
  };

  return labels[role] ||
    "Member";
}


// ============================================================
// JOIN BUTTON
// ============================================================

function updateJoinButton() {

  if (!joinLeaveBtn) return;

  joinLeaveBtn.disabled =
    membershipBusy;


  // OWNER
  if (isOwner()) {

    joinLeaveBtn.className =
      "btn-join-leave is-member";

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-shield-halved"></i> Owner';

    joinLeaveBtn.disabled =
      true;

    return;
  }


  // ACTIVE MEMBER
  if (isMember()) {

    joinLeaveBtn.className =
      "btn-join-leave is-member";

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-check"></i> Joined';

    return;
  }


  // PENDING
  if (isPending()) {

    joinLeaveBtn.className =
      "btn-join-leave is-pending";

    joinLeaveBtn.innerHTML =
      '<i class="fa-solid fa-clock"></i> Request pending';

    return;
  }


  // JOIN
  joinLeaveBtn.className =
    "btn-join-leave";

  joinLeaveBtn.innerHTML =
    '<i class="fa-solid fa-plus"></i> Join group';
}


// ============================================================
// JOIN / LEAVE
// ============================================================

joinLeaveBtn?.addEventListener(
  "click",
  async () => {

    if (!currentUser) {
      toast(
        "Please sign in first.",
        "error"
      );
      return;
    }

    if (!currentGroup) return;

    if (isOwner()) {
      return;
    }

    if (membershipBusy) return;


    if (isMember()) {

      await leaveGroup();

      return;
    }


    await joinGroup();
  }
);


// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup() {

  membershipBusy = true;

  updateJoinButton();

  try {

    // --------------------------------------------------------
    // PREMIUM
    // --------------------------------------------------------

    if (
      currentGroup.type ===
      "premium"
    ) {

      toast(
        "Premium group membership requires the ₦100 join payment.",
        "info"
      );

      membershipBusy = false;

      updateJoinButton();

      /*
       * Payment integration should be connected here.
       *
       * We intentionally do not pretend a payment succeeded.
       * The member is only activated after payment verification.
       */

      return;
    }


    // --------------------------------------------------------
    // PRIVATE
    // --------------------------------------------------------

    if (
      currentGroup.privacy ===
      "private"
    ) {

      await setDoc(
        doc(
          db,
          "groups",
          groupId,
          "members",
          currentUser.uid
        ),
        {
          userId:
            currentUser.uid,

          role:
            "member",

          status:
            "pending",

          requestedAt:
            serverTimestamp()
        },
        {
          merge: true
        }
      );

      // Keep group document compatible
      // with the existing members map.

      await updateDoc(
        doc(
          db,
          "groups",
          groupId
        ),
        {
          [`members.${currentUser.uid}`]: {
            role: "member",
            status: "pending",
            requestedAt:
              serverTimestamp()
          },

          updatedAt:
            serverTimestamp()
        }
      );

      currentMembership = {
        role: "member",
        status: "pending"
      };

      currentRole = "member";

      toast(
        "Your request to join has been sent.",
        "success"
      );

      renderAccess();

      return;
    }


    // --------------------------------------------------------
    // PUBLIC FREE GROUP
    // --------------------------------------------------------

    const memberData = {
      role: "member",
      status: "active",
      joinedAt:
        serverTimestamp()
    };

    await setDoc(
      doc(
        db,
        "groups",
        groupId,
        "members",
        currentUser.uid
      ),
      {
        userId:
          currentUser.uid,
        ...memberData
      },
      {
        merge: true
      }
    );


    await updateDoc(
      doc(
        db,
        "groups",
        groupId
      ),
      {
        [`members.${currentUser.uid}`]:
          memberData,

        memberCount:
          Number(currentGroup.memberCount || 0) + 1,

        followerCount:
          Number(currentGroup.followerCount || 0) + 1,

        updatedAt:
          serverTimestamp()
      }
    );


    currentMembership =
      memberData;

    currentRole =
      "member";

    currentGroup.memberCount =
      Number(
        currentGroup.memberCount || 0
      ) + 1;

    currentGroup.followerCount =
      Number(
        currentGroup.followerCount || 0
      ) + 1;


    toast(
      "You joined the group!",
      "success"
    );

    renderGroup();
    renderAccess();

    await loadMembers();

  } catch (error) {

    console.error(
      "JOIN GROUP ERROR:",
      error
    );

    toast(
      error?.message ||
      "Unable to join this group.",
      "error"
    );

  } finally {

    membershipBusy = false;

    updateJoinButton();
  }
}


// ============================================================
// LEAVE GROUP
// ============================================================

async function leaveGroup() {

  const confirmed =
    window.confirm(
      "Leave this group?"
    );

  if (!confirmed) {
    return;
  }

  membershipBusy = true;

  updateJoinButton();

  try {

    await deleteDoc(
      doc(
        db,
        "groups",
        groupId,
        "members",
        currentUser.uid
      )
    );


    await updateDoc(
      doc(
        db,
        "groups",
        groupId
      ),
      {
        [`members.${currentUser.uid}`]:
          null,

        memberCount:
          Math.max(
            0,
            Number(
              currentGroup.memberCount || 0
            ) - 1
          ),

        followerCount:
          Math.max(
            0,
            Number(
              currentGroup.followerCount || 0
            ) - 1
          ),

        updatedAt:
          serverTimestamp()
      }
    );


    currentMembership = null;
    currentRole = null;

    currentGroup.memberCount =
      Math.max(
        0,
        Number(
          currentGroup.memberCount || 0
        ) - 1
      );

    currentGroup.followerCount =
      Math.max(
        0,
        Number(
          currentGroup.followerCount || 0
        ) - 1
      );


    toast(
      "You left the group.",
      "success"
    );

    renderGroup();
    renderAccess();

    await loadMembers();

  } catch (error) {

    console.error(
      "LEAVE GROUP ERROR:",
      error
    );

    toast(
      error?.message ||
      "Unable to leave the group.",
      "error"
    );

  } finally {

    membershipBusy = false;

    updateJoinButton();
  }
}


// ============================================================
// RULES
// ============================================================

function renderRules() {

  if (!rulesListDisplay) return;

  rulesListDisplay.innerHTML = "";

  const rules =
    Array.isArray(currentGroup?.rules)
      ? currentGroup.rules
      : [];


  if (!rules.length) {

    rulesEmptyDisplay.style.display =
      "block";

    return;
  }

  rulesEmptyDisplay.style.display =
    "none";


  rules.forEach(
    (rule, index) => {

      const li =
        document.createElement("li");

      li.textContent =
        rule;

      rulesListDisplay.appendChild(li);
    }
  );
}


// ============================================================
// ADMINS / MODERATORS
// ============================================================

async function renderAdmins() {

  if (!adminsList) return;

  adminsList.innerHTML = "";

  const members =
    currentGroup?.members || {};

  const privileged =
    Object.entries(members)
      .filter(
        ([, member]) =>
          member &&
          (
            member.role === "owner" ||
            member.role === "admin" ||
            member.role === "moderator"
          )
      );


  // Owner may not exist in map in older documents
  if (
    currentGroup?.ownerId &&
    !privileged.some(
      ([uid]) =>
        uid === currentGroup.ownerId
    )
  ) {

    privileged.unshift([
      currentGroup.ownerId,
      {
        role: "owner"
      }
    ]);
  }


  if (!privileged.length) {

    adminsEmptyDisplay.style.display =
      "block";

    adminsList.appendChild(
      adminsEmptyDisplay
    );

    return;
  }


  adminsEmptyDisplay.style.display =
    "none";


  for (
    const [uid, member] of privileged
  ) {

    const row =
      document.createElement("div");

    row.className =
      "admin-row";


    const avatar =
      document.createElement("div");

    avatar.className =
      "admin-avatar";

    avatar.innerHTML =
      '<i class="fa-solid fa-user"></i>';


    const info =
      document.createElement("div");

    info.className =
      "admin-info";

    const name =
      document.createElement("div");

    name.className =
      "admin-name";

    const role =
      document.createElement("div");

    role.className =
      "admin-role";

    role.textContent =
      formatRole(
        member.role
      );


    // Owner name is available
    // directly on group document.
    if (
      uid ===
      currentGroup.ownerId
    ) {

      name.textContent =
        currentGroup.ownerName ||
        "Group Owner";

    } else {

      name.textContent =
        "VitalStar Member";
    }


    info.appendChild(name);
    info.appendChild(role);

    row.appendChild(avatar);
    row.appendChild(info);

    adminsList.appendChild(row);
  }
}


// ============================================================
// POSTS
// ============================================================

async function loadPosts() {

  if (!postsTab) return;

  if (!isMember() && currentGroup?.privacy === "private") {
    return;
  }

  postsTab.innerHTML = `
    <div class="tab-panel-placeholder">
      <span class="spinner-sm"></span>
      Loading posts…
    </div>
  `;


  try {

    /*
     * Expected future structure:
     *
     * groups/{groupId}/posts/{postId}
     *
     * This keeps group posts isolated from
     * the normal VitalStar feed.
     */

    const postsRef =
      collection(
        db,
        "groups",
        groupId,
        "posts"
      );

    const postsQuery =
      query(
        postsRef,
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(20)
      );

    const snapshot =
      await getDocs(postsQuery);


    if (snapshot.empty) {

      postsTab.innerHTML = `
        <div class="tab-panel-placeholder">
          <i class="fa-solid fa-note-sticky"></i>
          <span>No posts yet. Be the first to post!</span>
        </div>
      `;

      return;
    }


    postsTab.innerHTML = "";

    snapshot.forEach(
      postDoc => {

        const post =
          postDoc.data();

        const card =
          createPostCard(
            postDoc.id,
            post
          );

        postsTab.appendChild(card);
      }
    );

  } catch (error) {

    console.warn(
      "GROUP POSTS:",
      error
    );

    postsTab.innerHTML = `
      <div class="tab-panel-placeholder">
        <i class="fa-solid fa-note-sticky"></i>
        <span>No group posts available yet.</span>
      </div>
    `;
  }
}


// ============================================================
// POST CARD
// ============================================================

function createPostCard(
  postId,
  post
) {

  const card =
    document.createElement("article");

  card.style.cssText = `
    background:var(--bg-surface);
    border:1px solid var(--border-subtle);
    border-radius:var(--radius-lg);
    padding:18px;
    margin-bottom:14px;
  `;


  const author =
    post.authorName ||
    "VitalStar Member";

  const text =
    post.text ||
    post.content ||
    "";


  card.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      gap:10px;
      margin-bottom:12px;
    ">
      <div style="
        width:38px;
        height:38px;
        border-radius:50%;
        background:linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        );
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
      ">
        <i class="fa-solid fa-user"></i>
      </div>

      <div>
        <div style="
          font-size:13.5px;
          font-weight:600;
        "></div>

        <div style="
          font-size:11px;
          color:var(--text-muted);
        ">
          ${formatDate(post.createdAt)}
        </div>
      </div>
    </div>

    <div style="
      font-size:14px;
      line-height:1.6;
      color:var(--text-secondary);
      white-space:pre-wrap;
    "></div>
  `;


  card.querySelector(
    "div > div > div"
  ).textContent =
    author;

  card.querySelector(
    "div[style*='white-space']"
  ).textContent =
    text ||
    "This post has no text content.";


  return card;
}


// ============================================================
// MEMBERS
// ============================================================

async function loadMembers() {

  if (!membersTab) return;

  if (
    currentGroup?.privacy === "private" &&
    !isMember()
  ) {
    return;
  }


  membersTab.innerHTML = `
    <div class="tab-panel-placeholder">
      <span class="spinner-sm"></span>
      Loading members…
    </div>
  `;


  try {

    const members =
      currentGroup?.members || {};

    const entries =
      Object.entries(members)
        .filter(
          ([, member]) =>
            member &&
            member.status === "active"
        );


    if (!entries.length) {

      membersTab.innerHTML = `
        <div class="tab-panel-placeholder">
          <i class="fa-solid fa-users"></i>
          <span>No members to display.</span>
        </div>
      `;

      return;
    }


    const wrapper =
      document.createElement("div");

    wrapper.style.cssText = `
      display:grid;
      grid-template-columns:
        repeat(auto-fill,minmax(220px,1fr));
      gap:12px;
    `;


    for (
      const [uid, member] of entries
    ) {

      const card =
        document.createElement("div");

      card.style.cssText = `
        display:flex;
        align-items:center;
        gap:11px;
        padding:14px;
        border-radius:var(--radius-md);
        background:var(--bg-surface);
        border:1px solid var(--border-subtle);
      `;


      const avatar =
        document.createElement("div");

      avatar.style.cssText = `
        width:42px;
        height:42px;
        border-radius:50%;
        background:linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        );
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
      `;

      avatar.innerHTML =
        '<i class="fa-solid fa-user"></i>';


      const info =
        document.createElement("div");

      info.style.minWidth =
        "0";


      const name =
        document.createElement("div");

      name.style.cssText = `
        font-size:13px;
        font-weight:600;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      `;


      const role =
        document.createElement("div");

      role.style.cssText = `
        font-size:11px;
        color:var(--text-muted);
        text-transform:capitalize;
        margin-top:2px;
      `;


      if (
        uid ===
        currentGroup.ownerId
      ) {

        name.textContent =
          currentGroup.ownerName ||
          "Group Owner";

      } else if (
        uid ===
        currentUser.uid
      ) {

        name.textContent =
          currentUser.displayName ||
          "You";

      } else {

        name.textContent =
          "VitalStar Member";
      }


      role.textContent =
        formatRole(
          member.role
        );


      info.appendChild(name);
      info.appendChild(role);

      card.appendChild(avatar);
      card.appendChild(info);

      wrapper.appendChild(card);
    }


    membersTab.innerHTML = "";

    membersTab.appendChild(wrapper);

  } catch (error) {

    console.error(
      "LOAD MEMBERS ERROR:",
      error
    );

    membersTab.innerHTML = `
      <div class="tab-panel-placeholder">
        Unable to load members.
      </div>
    `;
  }
}


// ============================================================
// CHAT
// ============================================================

function loadChat() {

  if (!chatTab) return;


  if (!isMember()) {

    chatTab.innerHTML = `
      <div class="tab-panel-placeholder">
        <i class="fa-solid fa-lock"></i>
        <span>Join the group to access group chat.</span>
      </div>
    `;

    return;
  }


  chatTab.innerHTML = `
    <div style="
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:24px;
      text-align:center;
    ">
      <i
        class="fa-solid fa-comments"
        style="
          font-size:30px;
          color:var(--electric-blue-bright);
          margin-bottom:12px;
        "
      ></i>

      <h3 style="
        margin:0 0 6px;
        font-family:var(--font-display);
      ">
        Group Chat
      </h3>

      <p style="
        margin:0;
        color:var(--text-muted);
        font-size:13px;
      ">
        Group chat is ready for the chat system integration.
      </p>
    </div>
  `;
}


// ============================================================
// SUBSCRIPTION
// ============================================================

function loadSubscription() {

  if (!subscriptionTab) return;


  if (
    currentGroup?.type !==
    "premium"
  ) {

    subscriptionTab.innerHTML = `
      <div class="tab-panel-placeholder">
        This is a free group.
      </div>
    `;

    return;
  }


  const fee =
    currentGroup?.followerFee?.amount ||
    100;


  subscriptionTab.innerHTML = `
    <div style="
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:22px;
    ">

      <div style="
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:16px;
      ">

        <div style="
          width:44px;
          height:44px;
          border-radius:13px;
          background:rgba(255,194,75,.12);
          display:flex;
          align-items:center;
          justify-content:center;
          color:var(--gold-accent);
        ">
          <i class="fa-solid fa-crown"></i>
        </div>

        <div>
          <h3 style="
            margin:0;
            font-family:var(--font-display);
          ">
            Premium Group
          </h3>

          <p style="
            margin:3px 0 0;
            color:var(--text-muted);
            font-size:12px;
          ">
            Premium membership
          </p>
        </div>

      </div>

      <div style="
        padding:16px;
        border-radius:var(--radius-md);
        background:var(--bg-surface-raised);
        border:1px solid var(--border-subtle);
      ">

        <div style="
          color:var(--text-muted);
          font-size:11px;
          text-transform:uppercase;
        ">
          Membership fee
        </div>

        <div style="
          margin-top:4px;
          font-family:var(--font-mono);
          font-size:24px;
          font-weight:600;
        ">
          ₦${formatNumber(fee)}
        </div>

      </div>

      <p style="
        color:var(--text-secondary);
        font-size:13px;
        line-height:1.5;
        margin:16px 0 0;
      ">
        Premium members are required to complete the
        membership payment before access is granted.
      </p>

    </div>
  `;
}


// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {

  if (!settingsTab) return;


  if (!isAdmin()) {

    settingsTab.innerHTML = `
      <div class="tab-panel-placeholder">
        <i class="fa-solid fa-lock"></i>
        <span>Only group admins can access settings.</span>
      </div>
    `;

    return;
  }


  settingsTab.innerHTML = `
    <div style="
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:22px;
    ">

      <h3 style="
        margin:0 0 8px;
        font-family:var(--font-display);
      ">
        Group settings
      </h3>

      <p style="
        margin:0;
        color:var(--text-muted);
        font-size:13px;
        line-height:1.5;
      ">
        Group management controls will be added here.
      </p>

    </div>
  `;
}


// ============================================================
// TABS
// ============================================================

tabsNav?.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".group-tab"
      );

    if (!button) return;

    const tab =
      button.dataset.tab;

    if (!tab) return;

    activateTab(tab);
  }
);


// ============================================================
// ACTIVATE TAB
// ============================================================

async function activateTab(tab) {

  const button =
    tabsNav?.querySelector(
      `[data-tab="${tab}"]`
    );

  if (
    !button ||
    button.style.display === "none"
  ) {
    return;
  }


  activeTab = tab;


  document
    .querySelectorAll(
      ".group-tab"
    )
    .forEach(
      item => {

        item.classList.toggle(
          "is-active",
          item.dataset.tab === tab
        );
      }
    );


  document
    .querySelectorAll(
      ".tab-panel"
    )
    .forEach(
      panel => {

        panel.classList.toggle(
          "is-active",
          panel.dataset.panel === tab
        );
      }
    );


  if (tab === "posts") {
    await loadPosts();
  }

  if (tab === "members") {
    await loadMembers();
  }

  if (tab === "chat") {
    loadChat();
  }

  if (tab === "subscription") {
    loadSubscription();
  }

  if (tab === "settings") {
    loadSettings();
  }
}


// ============================================================
// SHARE
// ============================================================

shareBtn?.addEventListener(
  "click",
  async () => {

    const url =
      `${location.origin}${location.pathname}?id=${encodeURIComponent(groupId)}`;

    const title =
      currentGroup?.name ||
      "VitalStar Group";


    if (
      navigator.share
    ) {

      try {

        await navigator.share({
          title,
          text:
            `Join ${title} on VitalStar.`,
          url
        });

        return;

      } catch (error) {

        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }
      }
    }


    try {

      await navigator.clipboard.writeText(
        url
      );

      toast(
        "Group link copied!",
        "success"
      );

    } catch {

      toast(
        url,
        "info"
      );
    }
  }
);


// ============================================================
// INVITE
// ============================================================

inviteBtn?.addEventListener(
  "click",
  async () => {

    const url =
      `${location.origin}${location.pathname}?id=${encodeURIComponent(groupId)}`;

    try {

      await navigator.clipboard.writeText(
        url
      );

      toast(
        "Invite link copied!",
        "success"
      );

    } catch {

      toast(
        "Unable to copy the invite link.",
        "error"
      );
    }
  }
);


// ============================================================
// COVER EDIT
// ============================================================

coverEditBtn?.addEventListener(
  "click",
  () => {

    if (!isOwner()) {
      return;
    }

    toast(
      "Cover editing will be connected to the group editor next.",
      "info"
    );
  }
);


// ============================================================
// NOTIFICATIONS
// ============================================================

notificationBellBtn?.addEventListener(
  "click",
  async event => {

    event.stopPropagation();

    notificationsPanel.classList.toggle(
      "is-visible"
    );

    if (
      notificationsPanel.classList.contains(
        "is-visible"
      )
    ) {

      await loadNotifications();
    }
  }
);


closeNotificationsBtn?.addEventListener(
  "click",
  () => {

    notificationsPanel.classList.remove(
      "is-visible"
    );
  }
);


document.addEventListener(
  "click",
  event => {

    if (
      notificationsPanel &&
      notificationsPanel.classList.contains(
        "is-visible"
      ) &&
      !notificationsPanel.contains(event.target) &&
      !notificationBellBtn.contains(event.target)
    ) {

      notificationsPanel.classList.remove(
        "is-visible"
      );
    }
  }
);


// ============================================================
// LOAD NOTIFICATIONS
// ============================================================

async function loadNotifications() {

  if (!currentUser) return;

  notificationsList.innerHTML = `
    <div class="notifications-empty">
      Loading notifications…
    </div>
  `;

  try {

    const ref =
      collection(
        db,
        "notifications"
      );

    const q =
      query(
        ref,
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(20)
      );

    const snapshot =
      await getDocs(q);


    const notifications =
      snapshot.docs
        .map(
          item => ({
            id: item.id,
            ...item.data()
          })
        )
        .filter(
          notification =>
            notification.receiverId ===
            currentUser.uid ||
            notification.userId ===
            currentUser.uid
        );


    if (!notifications.length) {

      notificationsList.innerHTML = `
        <div class="notifications-empty">
          You're all caught up.
        </div>
      `;

      notifUnreadDot.classList.remove(
        "is-visible"
      );

      return;
    }


    notificationsList.innerHTML = "";


    notifications.forEach(
      notification => {

        const item =
          document.createElement("div");

        item.className =
          "notification-item";


        const icon =
          document.createElement("div");

        icon.className =
          "notification-item__icon";

        icon.innerHTML =
          '<i class="fa-solid fa-bell"></i>';


        const body =
          document.createElement("div");


        const text =
          document.createElement("div");

        text.className =
          "notification-item__text";

        text.textContent =
          notification.message ||
          "You have a new notification.";


        const time =
          document.createElement("div");

        time.className =
          "notification-item__time";

        time.textContent =
          formatDate(
            notification.createdAt
          );


        body.appendChild(text);
        body.appendChild(time);

        item.appendChild(icon);
        item.appendChild(body);

        notificationsList.appendChild(item);
      }
    );


    notifUnreadDot.classList.remove(
      "is-visible"
    );

  } catch (error) {

    console.warn(
      "NOTIFICATIONS ERROR:",
      error
    );

    notificationsList.innerHTML = `
      <div class="notifications-empty">
        No notifications available.
      </div>
    `;
  }
}


// ============================================================
// INITIAL STATE
// ============================================================

if (tabsNav) {

  activateTab(
    "posts"
  );
}