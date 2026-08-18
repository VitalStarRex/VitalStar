// ============================================================
// VITALSTAR — group.js
// Complete controller for group.html
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
// • Cancel pending request
// • Private-group requests
// • Approve / reject requests
// • Join-request notifications
// • Group notifications
// • Unread notification state
// • Exact postId notification handling
// • Tabs
// • Posts
// • Members
// • Admins / moderators
// • Group chat launcher
// • Premium subscription
// • Settings
// • Rules
// • Share / invites
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
  addDoc,
  collection,
  query,
  where,
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

let notificationsCache = [];


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

  const span = el.querySelector("span");

  if (span) {
    span.textContent = message;
  }

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
      `url("${escapeCssUrl(user.photoURL)}")`;

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
// SAFE CSS URL
// ============================================================

function escapeCssUrl(url) {

  return String(url || "")
    .replace(/"/g, '\\"');
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

    await renderAdmins();

    await loadPosts();

    await loadMembers();

    updateNotificationDot();

    showPage();

    handleNotificationNavigation();

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

  const name =
    group.name ||
    "Untitled Group";

  if (groupName) {
    groupName.textContent = name;
  }

  if (navGroupTitle) {
    navGroupTitle.textContent = name;
  }

  document.title =
    `${name} · VitalStar`;


  // ----------------------------------------------------------
  // COVER
  // ----------------------------------------------------------

  if (groupCover) {

    if (group.coverURL) {

      groupCover.style.backgroundImage =
        `url("${escapeCssUrl(group.coverURL)}")`;

      groupCover.style.backgroundSize =
        "cover";

      groupCover.style.backgroundPosition =
        "center";

    } else {

      groupCover.style.backgroundImage =
        "linear-gradient(135deg,#1b3e8f,#241640)";
    }
  }


  // ----------------------------------------------------------
  // AVATAR
  // ----------------------------------------------------------

  if (groupAvatar) {

    if (group.avatarURL) {

      groupAvatar.style.backgroundImage =
        `url("${escapeCssUrl(group.avatarURL)}")`;

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
  }


  // ----------------------------------------------------------
  // PRIVACY
  // ----------------------------------------------------------

  const privacy =
    group.privacy === "private"
      ? "private"
      : "public";

  if (groupPrivacyBadge) {

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
  }


  // ----------------------------------------------------------
  // PREMIUM
  // ----------------------------------------------------------

  if (groupPremiumBadge) {

    groupPremiumBadge.style.display =
      group.type === "premium"
        ? "inline-flex"
        : "none";
  }


  // ----------------------------------------------------------
  // VERIFIED
  // ----------------------------------------------------------

  if (groupVerifiedBadge) {

    groupVerifiedBadge.style.display =
      group.verified === true
        ? "inline-flex"
        : "none";
  }


  // ----------------------------------------------------------
  // CATEGORY
  // ----------------------------------------------------------

  if (groupCategoryChip) {

    groupCategoryChip.textContent =
      categoryLabels[group.category] ||
      group.category ||
      "General";
  }


  // ----------------------------------------------------------
  // OWNER
  // ----------------------------------------------------------

  if (groupOwnerText) {

    groupOwnerText.textContent =
      `Owned by ${group.ownerName || "VitalStar Member"}`;
  }


  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  if (groupDescription) {

    groupDescription.textContent =
      group.description ||
      "No group description has been added yet.";
  }


  // ----------------------------------------------------------
  // STATS
  // ----------------------------------------------------------

  if (statMemberCount) {

    statMemberCount.textContent =
      formatNumber(
        group.memberCount || 0
      );
  }

  if (statPostCount) {

    statPostCount.textContent =
      formatNumber(
        group.postCount || 0
      );
  }

  if (statOnlineCount) {

    statOnlineCount.textContent =
      formatNumber(
        group.onlineCount || 0
      );
  }

  if (statLevel) {

    statLevel.textContent =
      formatNumber(
        group.level || 1
      );
  }


  // ----------------------------------------------------------
  // CREATED DATE
  // ----------------------------------------------------------

  if (groupCreatedText) {

    groupCreatedText.textContent =
      `Created ${formatDate(group.createdAt)}`;
  }
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
      timestamp?.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "recently";
    }

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
  // SUBCOLLECTION FALLBACK
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

  if (
    yourRoleTag &&
    yourRoleText
  ) {

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
  }


  // ----------------------------------------------------------
  // OWNER CONTROLS
  // ----------------------------------------------------------

  if (isOwner()) {

    coverEditBtn?.classList.add(
      "is-visible"
    );

    if (inviteBtn) {
      inviteBtn.style.display =
        "flex";
    }

    if (settingsTabBtn) {
      settingsTabBtn.style.display =
        "flex";
    }

  } else {

    coverEditBtn?.classList.remove(
      "is-visible"
    );

    if (inviteBtn) {
      inviteBtn.style.display =
        "none";
    }

    if (settingsTabBtn) {
      settingsTabBtn.style.display =
        isAdmin()
          ? "flex"
          : "none";
    }
  }


  // ----------------------------------------------------------
  // SUBSCRIPTION TAB
  // ----------------------------------------------------------

  if (subscriptionTabBtn) {

    subscriptionTabBtn.style.display =
      group.type === "premium"
        ? "flex"
        : "none";
  }


  // ----------------------------------------------------------
  // PRIVATE GROUP
  // ----------------------------------------------------------

  if (
    lockedNotice &&
    groupContentGrid
  ) {

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


  // ACTIVE
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
      '<i class="fa-solid fa-clock"></i> Cancel request';

    return;
  }


  // JOIN
  joinLeaveBtn.className =
    "btn-join-leave";

  joinLeaveBtn.innerHTML =
    '<i class="fa-solid fa-plus"></i> Join group';
}


// ============================================================
// JOIN / LEAVE / CANCEL
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

    if (isOwner()) return;

    if (membershipBusy) return;


    if (isMember()) {

      await leaveGroup();

      return;
    }


    if (isPending()) {

      await cancelJoinRequest();

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

      await startPremiumJoin();

      return;
    }


    // --------------------------------------------------------
    // PRIVATE
    // --------------------------------------------------------

    if (
      currentGroup.privacy ===
      "private"
    ) {

      await createJoinRequest();

      return;
    }


    // --------------------------------------------------------
    // PUBLIC FREE
    // --------------------------------------------------------

    await activateMember();

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
// PRIVATE JOIN REQUEST
// ============================================================

async function createJoinRequest() {

  const membershipData = {
    userId:
      currentUser.uid,

    role:
      "member",

    status:
      "pending",

    requestedAt:
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
    membershipData,
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


  // Notify owner/admins.
  await notifyGroupStaffOfJoinRequest();


  toast(
    "Your request to join has been sent.",
    "success"
  );


  renderAccess();
}


// ============================================================
// ACTIVATE MEMBER
// ============================================================

async function activateMember() {

  const memberData = {
    userId:
      currentUser.uid,

    role:
      "member",

    status:
      "active",

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
    memberData,
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
        Number(
          currentGroup.memberCount || 0
        ) + 1,

      followerCount:
        Number(
          currentGroup.followerCount || 0
        ) + 1,

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


  await createGroupNotification(
    currentUser.uid,
    "joined_group",
    `${getCurrentUserName()} joined ${currentGroup.name || "the group"}.`
  );


  toast(
    "You joined the group!",
    "success"
  );


  renderGroup();
  renderAccess();

  await loadMembers();
}


// ============================================================
// CANCEL REQUEST
// ============================================================

async function cancelJoinRequest() {

  const confirmed =
    window.confirm(
      "Cancel your join request?"
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

        updatedAt:
          serverTimestamp()
      }
    );


    currentMembership = null;
    currentRole = null;


    toast(
      "Join request cancelled.",
      "success"
    );


    renderAccess();

  } catch (error) {

    console.error(
      "CANCEL REQUEST ERROR:",
      error
    );

    toast(
      error?.message ||
      "Unable to cancel the request.",
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
// NOTIFICATION HELPER
// ============================================================

async function createNotification({
  receiverId,
  type,
  message,
  groupId: notificationGroupId = null,
  postId = null,
  senderId = null,
  read = false
}) {

  if (!receiverId) return null;

  try {

    const ref =
      await addDoc(
        collection(
          db,
          "notifications"
        ),
        {
          receiverId,

          userId:
            receiverId,

          senderId:
            senderId ||
            currentUser?.uid ||
            null,

          type:
            type || "group",

          message:
            message || "You have a new notification.",

          groupId:
            notificationGroupId,

          postId,

          read,

          createdAt:
            serverTimestamp()
        }
      );

    return ref.id;

  } catch (error) {

    console.warn(
      "CREATE NOTIFICATION ERROR:",
      error
    );

    return null;
  }
}


// ============================================================
// GROUP NOTIFICATION
// ============================================================

async function createGroupNotification(
  senderId,
  type,
  message,
  postId = null
) {

  if (!currentGroup) return;

  const recipients =
    getActiveMemberIds();

  for (
    const receiverId of recipients
  ) {

    if (
      receiverId === senderId
    ) {
      continue;
    }

    await createNotification({
      receiverId,
      senderId,
      type,
      message,
      groupId,
      postId,
      read: false
    });
  }
}


// ============================================================
// STAFF NOTIFICATION
// ============================================================

async function notifyGroupStaffOfJoinRequest() {

  if (!currentGroup) return;

  const staff =
    getStaffIds();

  const requester =
    getCurrentUserName();


  for (
    const receiverId of staff
  ) {

    if (
      receiverId ===
      currentUser.uid
    ) {
      continue;
    }

    await createNotification({
      receiverId,

      senderId:
        currentUser.uid,

      type:
        "group_join_request",

      message:
        `${requester} requested to join ${currentGroup.name || "your group"}.`,

      groupId,

      postId:
        null,

      read:
        false
    });
  }
}


// ============================================================
// GET STAFF IDS
// ============================================================

function getStaffIds() {

  const ids = new Set();

  if (currentGroup?.ownerId) {
    ids.add(currentGroup.ownerId);
  }

  const members =
    currentGroup?.members || {};

  Object.entries(members)
    .forEach(
      ([uid, member]) => {

        if (
          member &&
          (
            member.role === "owner" ||
            member.role === "admin" ||
            member.role === "moderator"
          )
        ) {

          ids.add(uid);
        }
      }
    );

  return [...ids];
}


// ============================================================
// GET ACTIVE MEMBER IDS
// ============================================================

function getActiveMemberIds() {

  const ids = new Set();

  const members =
    currentGroup?.members || {};

  Object.entries(members)
    .forEach(
      ([uid, member]) => {

        if (
          member &&
          member.status === "active"
        ) {

          ids.add(uid);
        }
      }
    );


  if (currentGroup?.ownerId) {
    ids.add(currentGroup.ownerId);
  }

  return [...ids];
}


// ============================================================
// CURRENT USER NAME
// ============================================================

function getCurrentUserName() {

  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "VitalStar Member"
  );
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

    if (rulesEmptyDisplay) {
      rulesEmptyDisplay.style.display =
        "block";
    }

    return;
  }


  if (rulesEmptyDisplay) {
    rulesEmptyDisplay.style.display =
      "none";
  }


  rules.forEach(
    rule => {

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

    if (adminsEmptyDisplay) {
      adminsEmptyDisplay.style.display =
        "block";

      adminsList.appendChild(
        adminsEmptyDisplay
      );
    }

    return;
  }


  if (adminsEmptyDisplay) {
    adminsEmptyDisplay.style.display =
      "none";
  }


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


    if (
      uid ===
      currentGroup.ownerId
    ) {

      name.textContent =
        currentGroup.ownerName ||
        "Group Owner";

    } else if (
      uid ===
      currentUser?.uid
    ) {

      name.textContent =
        "You";

    } else {

      const profile =
        await getUserProfile(uid);

      name.textContent =
        profile?.fullname ||
        profile?.fullName ||
        profile?.displayName ||
        profile?.username ||
        "VitalStar Member";

      if (profile?.photoURL) {

        avatar.style.backgroundImage =
          `url("${escapeCssUrl(profile.photoURL)}")`;

        avatar.style.backgroundSize =
          "cover";

        avatar.style.backgroundPosition =
          "center";

        avatar.innerHTML = "";
      }
    }


    info.appendChild(name);
    info.appendChild(role);

    row.appendChild(avatar);
    row.appendChild(info);

    adminsList.appendChild(row);
  }
}


// ============================================================
// USER PROFILE
// ============================================================

async function getUserProfile(uid) {

  if (!uid) return null;

  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "users",
          uid
        )
      );

    if (
      snapshot.exists()
    ) {

      return snapshot.data();
    }

  } catch (error) {

    console.warn(
      "USER PROFILE ERROR:",
      error
    );
  }

  return null;
}


// ============================================================
// POSTS
// ============================================================

async function loadPosts() {

  if (!postsTab) return;

  if (
    !isMember() &&
    currentGroup?.privacy === "private"
  ) {
    return;
  }


  postsTab.innerHTML = `
    <div class="tab-panel-placeholder">
      <span class="spinner-sm"></span>
      Loading posts…
    </div>
  `;


  try {

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

  card.dataset.postId =
    postId;

  card.style.cssText = `
    background:var(--bg-surface);
    border:1px solid var(--border-subtle);
    border-radius:var(--radius-lg);
    padding:18px;
    margin-bottom:14px;
  `;


  const author =
    post.authorName ||
    post.fullName ||
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
      <div
        class="group-post-avatar"
        style="
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
        "
      >
        <i class="fa-solid fa-user"></i>
      </div>

      <div>
        <div
          class="group-post-author"
          style="
            font-size:13.5px;
            font-weight:600;
          "
        ></div>

        <div style="
          font-size:11px;
          color:var(--text-muted);
        ">
          ${formatDate(post.createdAt)}
        </div>
      </div>
    </div>

    <div
      class="group-post-text"
      style="
        font-size:14px;
        line-height:1.6;
        color:var(--text-secondary);
        white-space:pre-wrap;
      "
    ></div>

    <div
      class="group-post-actions"
      style="
        margin-top:14px;
        display:flex;
        gap:8px;
      "
    >
      <button
        type="button"
        class="group-post-open"
        data-post-id="${escapeHtml(postId)}"
        style="
          border:0;
          background:transparent;
          color:var(--electric-blue-bright);
          cursor:pointer;
          font-size:12px;
        "
      >
        Open post
      </button>
    </div>
  `;


  const authorElement =
    card.querySelector(
      ".group-post-author"
    );

  if (authorElement) {
    authorElement.textContent =
      author;
  }


  const textElement =
    card.querySelector(
      ".group-post-text"
    );

  if (textElement) {

    textElement.textContent =
      text ||
      "This post has no text content.";
  }


  const openButton =
    card.querySelector(
      ".group-post-open"
    );

  openButton?.addEventListener(
    "click",
    () => {
      openGroupPost(postId);
    }
  );


  return card;
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ============================================================
// OPEN GROUP POST
// ============================================================

function openGroupPost(postId) {

  if (!postId) return;

  const url =
    new URL(
      location.href
    );

  url.searchParams.set(
    "id",
    groupId
  );

  url.searchParams.set(
    "postId",
    postId
  );

  history.replaceState(
    {},
    "",
    url
  );


  const card =
    postsTab?.querySelector(
      `[data-post-id="${CSS.escape(postId)}"]`
    );


  if (card) {

    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    card.style.outline =
      "2px solid var(--electric-blue)";

    setTimeout(() => {

      card.style.outline = "";

    }, 2500);

    return;
  }


  toast(
    "That post is not currently loaded.",
    "info"
  );
}


// ============================================================
// EXACT POST ID FROM URL / NOTIFICATION
// ============================================================

function handleNotificationNavigation() {

  const params =
    new URLSearchParams(
      location.search
    );

  const postId =
    params.get("postId");

  const notificationId =
    params.get("notificationId");


  if (postId) {

    setTimeout(() => {

      openGroupPost(postId);

    }, 500);
  }


  if (notificationId) {

    markNotificationRead(
      notificationId
    );
  }
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

        const profile =
          await getUserProfile(uid);

        name.textContent =
          profile?.fullname ||
          profile?.fullName ||
          profile?.displayName ||
          profile?.username ||
          "VitalStar Member";


        if (profile?.photoURL) {

          avatar.style.backgroundImage =
            `url("${escapeCssUrl(profile.photoURL)}")`;

          avatar.style.backgroundSize =
            "cover";

          avatar.style.backgroundPosition =
            "center";

          avatar.innerHTML = "";
        }
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
        margin:0 0 16px;
        color:var(--text-muted);
        font-size:13px;
      ">
        Chat with members of this group.
      </p>

      <button
        type="button"
        id="openGroupChatBtn"
        style="
          border:0;
          border-radius:10px;
          padding:10px 16px;
          cursor:pointer;
          background:var(--electric-blue);
          color:white;
          font-weight:600;
        "
      >
        Open group chat
      </button>
    </div>
  `;


  $("openGroupChatBtn")?.addEventListener(
    "click",
    () => {

      const url =
        `chat.html?groupId=${encodeURIComponent(groupId)}`;

      location.href = url;
    }
  );
}


// ============================================================
// PREMIUM SUBSCRIPTION
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
    currentGroup?.joinFee ||
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
        Complete the payment through the configured
        VitalStar payment flow before membership is activated.
      </p>

      <button
        type="button"
        id="premiumJoinBtn"
        style="
          margin-top:16px;
          width:100%;
          border:0;
          border-radius:10px;
          padding:12px;
          background:var(--electric-blue);
          color:white;
          font-weight:600;
          cursor:pointer;
        "
      >
        Continue to payment
      </button>

    </div>
  `;


  $("premiumJoinBtn")?.addEventListener(
    "click",
    startPremiumJoin
  );
}


// ============================================================
// PREMIUM JOIN HOOK
// ============================================================

async function startPremiumJoin() {

  if (!currentUser) return;

  const fee =
    currentGroup?.followerFee?.amount ||
    currentGroup?.joinFee ||
    100;


  /*
   * IMPORTANT:
   *
   * This function does NOT mark payment as successful.
   *
   * Connect your existing Paystack/server-side payment
   * verification here.
   *
   * After verified payment, call:
   *
   * await activateMember();
   *
   * Never activate membership only because the user clicked
   * the payment button.
   */


  toast(
    `Payment flow ready for ₦${formatNumber(fee)}. Connect your verified Paystack callback here.`,
    "info"
  );
}


// ============================================================
// SETTINGS
// ============================================================

async function loadSettings() {

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
    <div
      id="groupSettingsContainer"
      style="
        display:grid;
        gap:14px;
      "
    >

      <div style="
        background:var(--bg-surface);
        border:1px solid var(--border-subtle);
        border-radius:var(--radius-lg);
        padding:20px;
      ">

        <h3 style="
          margin:0 0 6px;
          font-family:var(--font-display);
        ">
          Group management
        </h3>

        <p style="
          margin:0;
          color:var(--text-muted);
          font-size:13px;
        ">
          Manage requests, members and group information.
        </p>

      </div>

      <div
        id="groupRequestsAdmin"
      ></div>

      <div
        id="groupAdminActions"
      ></div>

    </div>
  `;


  await renderPendingRequests();

  renderAdminActions();
}


// ============================================================
// PENDING REQUESTS
// ============================================================

async function getPendingRequests() {

  const members =
    currentGroup?.members || {};

  return Object.entries(members)
    .filter(
      ([, member]) =>
        member &&
        member.status === "pending"
    );
}


// ============================================================
// RENDER PENDING REQUESTS
// ============================================================

async function renderPendingRequests() {

  const container =
    $("groupRequestsAdmin");

  if (!container) return;

  if (!isAdmin()) return;


  const requests =
    await getPendingRequests();


  if (!requests.length) {

    container.innerHTML = `
      <div style="
        background:var(--bg-surface);
        border:1px solid var(--border-subtle);
        border-radius:var(--radius-lg);
        padding:20px;
      ">
        <strong>No pending requests</strong>
        <div style="
          color:var(--text-muted);
          font-size:12px;
          margin-top:4px;
        ">
          New private-group join requests will appear here.
        </div>
      </div>
    `;

    return;
  }


  container.innerHTML = `
    <div style="
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:20px;
    ">
      <h3 style="
        margin:0 0 14px;
        font-family:var(--font-display);
      ">
        Join requests
      </h3>

      <div
        id="pendingRequestList"
        style="
          display:grid;
          gap:10px;
        "
      ></div>
    </div>
  `;


  const list =
    $("pendingRequestList");


  for (
    const [uid, request] of requests
  ) {

    const profile =
      await getUserProfile(uid);


    const name =
      profile?.fullname ||
      profile?.fullName ||
      profile?.displayName ||
      profile?.username ||
      "VitalStar Member";


    const row =
      document.createElement("div");

    row.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:12px;
      border:1px solid var(--border-subtle);
      border-radius:10px;
    `;


    const info =
      document.createElement("div");

    info.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <div style="
        color:var(--text-muted);
        font-size:11px;
        margin-top:3px;
      ">
        Requested ${formatDate(request.requestedAt)}
      </div>
    `;


    const actions =
      document.createElement("div");

    actions.style.cssText = `
      display:flex;
      gap:7px;
      flex-wrap:wrap;
    `;


    const approve =
      document.createElement("button");

    approve.type =
      "button";

    approve.textContent =
      "Approve";

    approve.style.cssText = `
      border:0;
      border-radius:8px;
      padding:8px 11px;
      cursor:pointer;
      background:var(--electric-blue);
      color:white;
      font-weight:600;
    `;


    const reject =
      document.createElement("button");

    reject.type =
      "button";

    reject.textContent =
      "Reject";

    reject.style.cssText = `
      border:1px solid var(--border-subtle);
      border-radius:8px;
      padding:8px 11px;
      cursor:pointer;
      background:transparent;
      color:var(--text-primary);
    `;


    approve.addEventListener(
      "click",
      async () => {

        await approveJoinRequest(
          uid
        );
      }
    );


    reject.addEventListener(
      "click",
      async () => {

        await rejectJoinRequest(
          uid
        );
      }
    );


    actions.appendChild(
      approve
    );

    actions.appendChild(
      reject
    );

    row.appendChild(info);
    row.appendChild(actions);

    list.appendChild(row);
  }
}


// ============================================================
// APPROVE REQUEST
// ============================================================

async function approveJoinRequest(
  uid
) {

  if (!isAdmin()) return;

  if (!uid) return;


  try {

    const memberData = {
      userId:
        uid,

      role:
        "member",

      status:
        "active",

      joinedAt:
        serverTimestamp()
    };


    await setDoc(
      doc(
        db,
        "groups",
        groupId,
        "members",
        uid
      ),
      memberData,
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
        [`members.${uid}`]:
          memberData,

        memberCount:
          Number(
            currentGroup.memberCount || 0
          ) + 1,

        followerCount:
          Number(
            currentGroup.followerCount || 0
          ) + 1,

        updatedAt:
          serverTimestamp()
      }
    );


    currentGroup.memberCount =
      Number(
        currentGroup.memberCount || 0
      ) + 1;


    currentGroup.followerCount =
      Number(
        currentGroup.followerCount || 0
      ) + 1;


    await createNotification({
      receiverId:
        uid,

      senderId:
        currentUser.uid,

      type:
        "group_join_approved",

      message:
        `Your request to join ${currentGroup.name || "the group"} was approved.`,

      groupId,

      read:
        false
    });


    toast(
      "Join request approved.",
      "success"
    );


    renderGroup();

    await renderPendingRequests();

  } catch (error) {

    console.error(
      "APPROVE REQUEST ERROR:",
      error
    );

    toast(
      error?.message ||
      "Unable to approve request.",
      "error"
    );
  }
}


// ============================================================
// REJECT REQUEST
// ============================================================

async function rejectJoinRequest(
  uid
) {

  if (!isAdmin()) return;

  if (!uid) return;


  try {

    await deleteDoc(
      doc(
        db,
        "groups",
        groupId,
        "members",
        uid
      )
    );


    await updateDoc(
      doc(
        db,
        "groups",
        groupId
      ),
      {
        [`members.${uid}`]:
          null,

        updatedAt:
          serverTimestamp()
      }
    );


    await createNotification({
      receiverId:
        uid,

      senderId:
        currentUser.uid,

      type:
        "group_join_rejected",

      message:
        `Your request to join ${currentGroup.name || "the group"} was not approved.`,

      groupId,

      read:
        false
    });


    toast(
      "Join request rejected.",
      "success"
    );


    await renderPendingRequests();

  } catch (error) {

    console.error(
      "REJECT REQUEST ERROR:",
      error
    );

    toast(
      error?.message ||
      "Unable to reject request.",
      "error"
    );
  }
}


// ============================================================
// ADMIN ACTIONS
// ============================================================

function renderAdminActions() {

  const container =
    $("groupAdminActions");

  if (!container) return;

  container.innerHTML = `
    <div style="
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:20px;
    ">

      <h3 style="
        margin:0 0 12px;
        font-family:var(--font-display);
      ">
        Admin controls
      </h3>

      <button
        type="button"
        id="refreshGroupDataBtn"
        style="
          border:1px solid var(--border-subtle);
          background:transparent;
          color:var(--text-primary);
          border-radius:9px;
          padding:10px 14px;
          cursor:pointer;
        "
      >
        Refresh group data
      </button>

    </div>
  `;


  $("refreshGroupDataBtn")
    ?.addEventListener(
      "click",
      async () => {

        await refreshGroup();
      }
    );
}


// ============================================================
// REFRESH GROUP
// ============================================================

async function refreshGroup() {

  if (!groupId) return;

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
      showNotFound();
      return;
    }


    currentGroup = {
      id:
        snapshot.id,

      ...snapshot.data()
    };


    await resolveMembership();

    renderGroup();

    renderAccess();

    renderRules();

    await renderAdmins();

    await loadMembers();

    if (activeTab === "settings") {
      await loadSettings();
    }


    toast(
      "Group refreshed.",
      "success"
    );

  } catch (error) {

    console.error(
      "REFRESH GROUP ERROR:",
      error
    );

    toast(
      "Unable to refresh group.",
      "error"
    );
  }
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
    await loadSettings();
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
      "Connect this button to your group editor / Cloudinary upload flow.",
      "info"
    );
  }
);


// ============================================================
// NOTIFICATION BELL
// ============================================================

notificationBellBtn?.addEventListener(
  "click",
  async event => {

    event.stopPropagation();

    if (!notificationsPanel) return;

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


// ============================================================
// CLOSE NOTIFICATIONS
// ============================================================

closeNotificationsBtn?.addEventListener(
  "click",
  () => {

    notificationsPanel?.classList.remove(
      "is-visible"
    );
  }
);


// ============================================================
// CLOSE NOTIFICATIONS OUTSIDE
// ============================================================

document.addEventListener(
  "click",
  event => {

    if (
      notificationsPanel &&
      notificationsPanel.classList.contains(
        "is-visible"
      ) &&
      !notificationsPanel.contains(
        event.target
      ) &&
      !notificationBellBtn?.contains(
        event.target
      )
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

  if (!notificationsList) return;


  notificationsList.innerHTML = `
    <div class="notifications-empty">
      Loading notifications…
    </div>
  `;


  try {

    let snapshot;


    // --------------------------------------------------------
    // Preferred query: receiverId
    // --------------------------------------------------------

    try {

      const q =
        query(
          collection(
            db,
            "notifications"
          ),
          where(
            "receiverId",
            "==",
            currentUser.uid
          ),
          orderBy(
            "createdAt",
            "desc"
          ),
          limit(50)
        );

      snapshot =
        await getDocs(q);

    } catch (queryError) {

      console.warn(
        "Notification indexed query failed. Using fallback.",
        queryError
      );


      const fallback =
        query(
          collection(
            db,
            "notifications"
          ),
          orderBy(
            "createdAt",
            "desc"
          ),
          limit(100)
        );


      snapshot =
        await getDocs(fallback);
    }


    const notifications =
      snapshot.docs
        .map(
          item => ({
            id:
              item.id,

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


    notificationsCache =
      notifications;


    if (!notifications.length) {

      notificationsList.innerHTML = `
        <div class="notifications-empty">
          You're all caught up.
        </div>
      `;

      updateNotificationDot();

      return;
    }


    notificationsList.innerHTML = "";


    notifications.forEach(
      notification => {

        const item =
          createNotificationElement(
            notification
          );

        notificationsList.appendChild(
          item
        );
      }
    );


    updateNotificationDot();

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
// NOTIFICATION ELEMENT
// ============================================================

function createNotificationElement(
  notification
) {

  const item =
    document.createElement("button");

  item.type =
    "button";

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


  body.appendChild(
    text
  );

  body.appendChild(
    time
  );


  item.appendChild(
    icon
  );

  item.appendChild(
    body
  );


  if (!notification.read) {

    item.classList.add(
      "is-unread"
    );
  }


  item.addEventListener(
    "click",
    async () => {

      await handleNotificationClick(
        notification
      );
    }
  );


  return item;
}


// ============================================================
// NOTIFICATION CLICK
// ============================================================

async function handleNotificationClick(
  notification
) {

  if (!notification) return;


  await markNotificationRead(
    notification.id
  );


  // ----------------------------------------------------------
  // Exact post navigation
  // ----------------------------------------------------------

  if (
    notification.postId
  ) {

    const targetGroupId =
      notification.groupId ||
      groupId;


    if (
      targetGroupId ===
      groupId
    ) {

      await activateTab(
        "posts"
      );

      openGroupPost(
        notification.postId
      );

      notificationsPanel?.classList.remove(
        "is-visible"
      );

      return;
    }


    const url =
      `group.html?id=${encodeURIComponent(targetGroupId)}&postId=${encodeURIComponent(notification.postId)}`;

    location.href =
      url;

    return;
  }


  // ----------------------------------------------------------
  // Join request notification
  // ----------------------------------------------------------

  if (
    notification.type ===
    "group_join_request"
  ) {

    if (isAdmin()) {

      notificationsPanel?.classList.remove(
        "is-visible"
      );

      await activateTab(
        "settings"
      );

      return;
    }
  }


  // ----------------------------------------------------------
  // Group notification
  // ----------------------------------------------------------

  if (
    notification.groupId &&
    notification.groupId !== groupId
  ) {

    location.href =
      `group.html?id=${encodeURIComponent(notification.groupId)}`;

    return;
  }


  notificationsPanel?.classList.remove(
    "is-visible"
  );
}


// ============================================================
// MARK NOTIFICATION READ
// ============================================================

async function markNotificationRead(
  notificationId
) {

  if (!notificationId) return;

  try {

    await updateDoc(
      doc(
        db,
        "notifications",
        notificationId
      ),
      {
        read:
          true,

        readAt:
          serverTimestamp()
      }
    );


    const cached =
      notificationsCache.find(
        item =>
          item.id ===
          notificationId
      );


    if (cached) {
      cached.read = true;
    }


    updateNotificationDot();

  } catch (error) {

    console.warn(
      "MARK NOTIFICATION READ ERROR:",
      error
    );
  }
}


// ============================================================
// NOTIFICATION DOT
// ============================================================

function updateNotificationDot() {

  if (!notifUnreadDot) return;


  const unread =
    notificationsCache.some(
      notification =>
        notification.read !== true
    );


  notifUnreadDot.classList.toggle(
    "is-visible",
    unread
  );
}


// ============================================================
// CHECK NOTIFICATION DOT
// ============================================================

async function checkNotificationUnread() {

  if (!currentUser) return;

  try {

    const q =
      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "receiverId",
          "==",
          currentUser.uid
        ),
        limit(50)
      );


    const snapshot =
      await getDocs(q);


    notificationsCache =
      snapshot.docs
        .map(
          item => ({
            id:
              item.id,

            ...item.data()
          })
        );


    updateNotificationDot();

  } catch (error) {

    console.warn(
      "CHECK NOTIFICATION ERROR:",
      error
    );
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


// ============================================================
// INITIAL NOTIFICATION CHECK
// ============================================================

if (currentUser) {
  checkNotificationUnread();
}