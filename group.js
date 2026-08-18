// ============================================================
// VITALSTAR — group.js
// Fresh controller for group.html
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
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);

const pageLoader = $("pageLoader");
const groupNotFoundState = $("groupNotFoundState");
const groupPageContent = $("groupPageContent");

const navGroupTitle = $("navGroupTitle");
const navUserAvatar = $("navUserAvatar");

const groupCover = $("groupCover");
const groupAvatar = $("groupAvatar");
const coverEditBtn = $("coverEditBtn");

const groupName = $("groupName");
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

const yourRoleTag = $("yourRoleTag");
const yourRoleText = $("yourRoleText");

const shareBtn = $("shareBtn");
const inviteBtn = $("inviteBtn");
const joinLeaveBtn = $("joinLeaveBtn");

const lockedNotice = $("lockedNotice");
const groupContentGrid = $("groupContentGrid");

const groupTabsNav = $("groupTabsNav");

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
const notifUnreadDot = $("notifUnreadDot");
const notificationsPanel = $("notificationsPanel");
const closeNotificationsBtn = $("closeNotificationsBtn");
const notificationsList = $("notificationsList");

const toastContainer = $("toast-container");


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let groupId = null;
let groupData = null;

let currentMembership = null;
let currentRole = null;

let postsLoaded = false;
let membersLoaded = false;
let chatLoaded = false;
let subscriptionLoaded = false;
let settingsLoaded = false;


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    groupId = getGroupId();

    if (!groupId) {
        showNotFound();
        return;
    }

    setupEvents();

    onAuthStateChanged(auth, async (user) => {

        currentUser = user;

        if (user) {
            await loadNavigationUser();
        }

        await initializeGroup();
    });
});


// ============================================================
// GROUP ID
// ============================================================

function getGroupId() {

    const params = new URLSearchParams(window.location.search);

    const fromQuery =
        params.get("id") ||
        params.get("groupId") ||
        params.get("group");

    if (fromQuery) {
        return decodeURIComponent(fromQuery);
    }

    const pathParts =
        window.location.pathname
            .split("/")
            .filter(Boolean);

    const lastPart = pathParts[pathParts.length - 1];

    if (
        lastPart &&
        lastPart !== "group.html" &&
        !lastPart.includes(".html")
    ) {
        return decodeURIComponent(lastPart);
    }

    return null;
}


// ============================================================
// INITIALIZE GROUP
// ============================================================

async function initializeGroup() {

    try {

        showLoader();

        const groupRef = doc(db, "groups", groupId);
        const snapshot = await getDoc(groupRef);

        if (!snapshot.exists()) {
            showNotFound();
            return;
        }

        groupData = {
            id: snapshot.id,
            ...snapshot.data()
        };

        await determineMembership();

        renderGroup();

        await loadRules();

        await loadAdmins();

        updateAccessUI();

        await loadPostCount();

        await loadOnlineCount();

        await loadNotifications();

        hideLoader();

    } catch (error) {

        console.error("Group initialization error:", error);

        showToast(
            "Unable to load this group.",
            "error"
        );

        showNotFound();
    }
}


// ============================================================
// MEMBERSHIP
// ============================================================

async function determineMembership() {

    currentMembership = null;
    currentRole = null;

    if (!currentUser) {
        return;
    }

    // --------------------------------------------------------
    // 1. Try embedded members map
    // --------------------------------------------------------

    if (
        groupData.members &&
        typeof groupData.members === "object" &&
        !Array.isArray(groupData.members)
    ) {

        const memberInfo =
            groupData.members[currentUser.uid];

        if (memberInfo) {

            currentMembership = memberInfo;

            currentRole =
                typeof memberInfo === "string"
                    ? memberInfo
                    : memberInfo.role || "member";

            return;
        }
    }


    // --------------------------------------------------------
    // 2. Try groupMembers collection
    // --------------------------------------------------------

    try {

        const membershipRef =
            doc(
                db,
                "groups",
                groupId,
                "members",
                currentUser.uid
            );

        const membershipSnap =
            await getDoc(membershipRef);

        if (membershipSnap.exists()) {

            currentMembership = {
                id: membershipSnap.id,
                ...membershipSnap.data()
            };

            currentRole =
                currentMembership.role || "member";

            return;
        }

    } catch (error) {

        console.warn(
            "Could not check group member document:",
            error
        );
    }


    // --------------------------------------------------------
    // 3. Try members collection
    // --------------------------------------------------------

    try {

        const memberRef =
            doc(
                db,
                "members",
                `${groupId}_${currentUser.uid}`
            );

        const memberSnap =
            await getDoc(memberRef);

        if (memberSnap.exists()) {

            currentMembership = {
                id: memberSnap.id,
                ...memberSnap.data()
            };

            currentRole =
                currentMembership.role || "member";
        }

    } catch (error) {

        console.warn(
            "Fallback membership check failed:",
            error
        );
    }


    // --------------------------------------------------------
    // Owner always counts as member
    // --------------------------------------------------------

    if (
        groupData.ownerId &&
        groupData.ownerId === currentUser.uid
    ) {

        currentMembership = {
            role: "owner"
        };

        currentRole = "owner";
    }
}


// ============================================================
// RENDER GROUP
// ============================================================

function renderGroup() {

    const name =
        groupData.name ||
        groupData.groupName ||
        "Untitled Group";

    const description =
        groupData.description ||
        groupData.bio ||
        "No description provided.";

    const category =
        groupData.category ||
        "General";

    const ownerName =
        groupData.ownerName ||
        groupData.ownerFullName ||
        groupData.createdByName ||
        "Unknown";

    const memberCount =
        Number(
            groupData.memberCount ??
            groupData.membersCount ??
            getEmbeddedMemberCount()
        );


    // --------------------------------------------------------
    // Title
    // --------------------------------------------------------

    document.title =
        `${name} · VitalStar`;

    navGroupTitle.textContent = name;

    groupName.textContent = name;

    groupDescription.textContent =
        description;

    groupCategoryChip.textContent =
        category;

    groupOwnerText.textContent =
        `Owned by ${ownerName}`;

    groupCreatedText.textContent =
        `Created ${formatDate(
            groupData.createdAt ||
            groupData.createdDate
        )}`;


    // --------------------------------------------------------
    // Avatar
    // --------------------------------------------------------

    setBackgroundImage(
        groupAvatar,
        groupData.avatar ||
        groupData.avatarUrl ||
        groupData.image ||
        groupData.photoURL
    );

    if (
        !groupData.avatar &&
        !groupData.avatarUrl &&
        !groupData.image &&
        !groupData.photoURL
    ) {

        groupAvatar.innerHTML =
            `<span>${escapeHtml(
                getInitials(name)
            )}</span>`;
    }


    // --------------------------------------------------------
    // Cover
    // --------------------------------------------------------

    const coverUrl =
        groupData.cover ||
        groupData.coverUrl ||
        groupData.coverPhoto ||
        groupData.banner;

    if (coverUrl) {

        groupCover.style.backgroundImage =
            `url("${safeUrl(coverUrl)}")`;

    } else {

        groupCover.style.backgroundImage = "";
    }


    // --------------------------------------------------------
    // Privacy
    // --------------------------------------------------------

    const isPrivate =
        groupData.privacy === "private" ||
        groupData.type === "private" ||
        groupData.isPrivate === true ||
        groupData.visibility === "private";

    groupPrivacyBadge.textContent =
        isPrivate ? "Private" : "Public";

    groupPrivacyBadge.className =
        `badge ${
            isPrivate
                ? "badge--private"
                : "badge--public"
        }`;

    groupPrivacyBadge.innerHTML =
        isPrivate
            ? `<i class="fa-solid fa-lock" style="font-size:9px;"></i> Private`
            : `<i class="fa-solid fa-globe" style="font-size:9px;"></i> Public`;


    // --------------------------------------------------------
    // Premium
    // --------------------------------------------------------

    const isPremium =
        groupData.premium === true ||
        groupData.isPremium === true ||
        groupData.plan === "premium";

    groupPremiumBadge.style.display =
        isPremium ? "inline-flex" : "none";


    // --------------------------------------------------------
    // Verified
    // --------------------------------------------------------

    const isVerified =
        groupData.verified === true ||
        groupData.isVerified === true;

    groupVerifiedBadge.style.display =
        isVerified ? "inline-flex" : "none";


    // --------------------------------------------------------
    // Stats
    // --------------------------------------------------------

    statMemberCount.textContent =
        formatNumber(memberCount);

    statLevel.textContent =
        Number(groupData.level || 1);


    // --------------------------------------------------------
    // Owner / admin controls
    // --------------------------------------------------------

    const isOwner =
        currentUser &&
        groupData.ownerId === currentUser.uid;

    const isAdmin =
        isOwner ||
        currentRole === "admin" ||
        currentRole === "moderator";

    if (isAdmin) {

        coverEditBtn.classList.add("is-visible");
        inviteBtn.style.display = "flex";
        settingsTabBtn.style.display = "flex";

        yourRoleTag.classList.add("is-visible");

        yourRoleText.textContent =
            isOwner
                ? "Owner"
                : capitalize(currentRole);
    }


    // --------------------------------------------------------
    // Subscription tab
    // --------------------------------------------------------

    if (isPremium) {
        subscriptionTabBtn.style.display = "flex";
    }
}


// ============================================================
// ACCESS UI
// ============================================================

function updateAccessUI() {

    const isPrivate =
        groupData.privacy === "private" ||
        groupData.type === "private" ||
        groupData.isPrivate === true ||
        groupData.visibility === "private";

    const isOwner =
        currentUser &&
        groupData.ownerId === currentUser.uid;

    const isMember =
        Boolean(currentMembership) ||
        isOwner;

    // --------------------------------------------------------
    // Not logged in
    // --------------------------------------------------------

    if (!currentUser) {

        joinLeaveBtn.innerHTML =
            `<i class="fa-solid fa-right-to-bracket"></i>
             Sign in to join`;

        joinLeaveBtn.classList.remove(
            "is-member",
            "is-pending"
        );

        if (isPrivate) {

            lockedNotice.classList.add("is-visible");
            groupContentGrid.style.display = "none";

        } else {

            lockedNotice.classList.remove("is-visible");
            groupContentGrid.style.display = "";
        }

        return;
    }


    // --------------------------------------------------------
    // Owner
    // --------------------------------------------------------

    if (isOwner) {

        joinLeaveBtn.innerHTML =
            `<i class="fa-solid fa-shield-halved"></i>
             Owner`;

        joinLeaveBtn.classList.add("is-member");

        joinLeaveBtn.disabled = true;

        lockedNotice.classList.remove("is-visible");
        groupContentGrid.style.display = "";

        return;
    }


    joinLeaveBtn.disabled = false;


    // --------------------------------------------------------
    // Member
    // --------------------------------------------------------

    if (isMember) {

        joinLeaveBtn.innerHTML =
            `<i class="fa-solid fa-check"></i>
             Joined`;

        joinLeaveBtn.classList.add("is-member");
        joinLeaveBtn.classList.remove("is-pending");

        lockedNotice.classList.remove("is-visible");
        groupContentGrid.style.display = "";

        return;
    }


    // --------------------------------------------------------
    // Private non-member
    // --------------------------------------------------------

    joinLeaveBtn.innerHTML =
        `<i class="fa-solid fa-plus"></i>
         ${isPrivate ? "Request to join" : "Join group"}`;

    joinLeaveBtn.classList.remove(
        "is-member",
        "is-pending"
    );

    if (isPrivate) {

        lockedNotice.classList.add("is-visible");
        groupContentGrid.style.display = "none";

    } else {

        lockedNotice.classList.remove("is-visible");
        groupContentGrid.style.display = "";
    }
}


// ============================================================
// JOIN / LEAVE
// ============================================================

async function handleJoinLeave() {

    if (!currentUser) {

        showToast(
            "Please sign in first.",
            "info"
        );

        return;
    }

    if (
        groupData.ownerId === currentUser.uid
    ) {
        return;
    }

    const isMember =
        Boolean(currentMembership);

    joinLeaveBtn.disabled = true;

    try {

        if (isMember) {

            await leaveGroup();

        } else {

            await joinGroup();
        }

    } catch (error) {

        console.error(
            "Join/leave error:",
            error
        );

        showToast(
            "Something went wrong. Please try again.",
            "error"
        );

    } finally {

        joinLeaveBtn.disabled = false;
    }
}


// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup() {

    const memberRef =
        doc(
            db,
            "groups",
            groupId,
            "members",
            currentUser.uid
        );

    const isPrivate =
        groupData.privacy === "private" ||
        groupData.type === "private" ||
        groupData.isPrivate === true ||
        groupData.visibility === "private";


    // --------------------------------------------------------
    // Private group
    // --------------------------------------------------------

    if (isPrivate) {

        const requestRef =
            doc(
                db,
                "groups",
                groupId,
                "joinRequests",
                currentUser.uid
            );

        await setDoc(
            requestRef,
            {
                userId: currentUser.uid,
                userName:
                    currentUser.displayName ||
                    currentUser.email ||
                    "User",

                status: "pending",

                createdAt:
                    serverTimestamp()
            },
            { merge: true }
        );

        joinLeaveBtn.innerHTML =
            `<i class="fa-solid fa-clock"></i>
             Request pending`;

        joinLeaveBtn.classList.add(
            "is-pending"
        );

        showToast(
            "Join request sent.",
            "success"
        );

        return;
    }


    // --------------------------------------------------------
    // Public group
    // --------------------------------------------------------

    await setDoc(
        memberRef,
        {
            userId: currentUser.uid,

            displayName:
                currentUser.displayName ||
                "User",

            email:
                currentUser.email || "",

            role: "member",

            joinedAt:
                serverTimestamp()
        }
    );


    // --------------------------------------------------------
    // Update count
    // --------------------------------------------------------

    try {

        await updateDoc(
            doc(db, "groups", groupId),
            {
                memberCount:
                    increment(1)
            }
        );

    } catch (error) {

        console.warn(
            "Could not increment member count:",
            error
        );
    }


    currentMembership = {
        role: "member"
    };

    currentRole = "member";

    statMemberCount.textContent =
        formatNumber(
            Number(
                statMemberCount.textContent
            ) + 1
        );

    updateAccessUI();

    showToast(
        `You joined ${groupData.name || "the group"}.`,
        "success"
    );
}


// ============================================================
// LEAVE GROUP
// ============================================================

async function leaveGroup() {

    const confirmed =
        window.confirm(
            "Are you sure you want to leave this group?"
        );

    if (!confirmed) {
        return;
    }

    const memberRef =
        doc(
            db,
            "groups",
            groupId,
            "members",
            currentUser.uid
        );

    await deleteDoc(memberRef);


    try {

        await updateDoc(
            doc(db, "groups", groupId),
            {
                memberCount:
                    increment(-1)
            }
        );

    } catch (error) {

        console.warn(
            "Could not decrement member count:",
            error
        );
    }


    currentMembership = null;
    currentRole = null;

    updateAccessUI();

    showToast(
        "You left the group.",
        "success"
    );
}


// ============================================================
// RULES
// ============================================================

async function loadRules() {

    rulesListDisplay.innerHTML = "";

    const rules =
        Array.isArray(groupData.rules)
            ? groupData.rules
            : [];

    if (!rules.length) {

        rulesEmptyDisplay.style.display =
            "block";

        return;
    }

    rulesEmptyDisplay.style.display =
        "none";

    rules.forEach((rule) => {

        const li =
            document.createElement("li");

        li.textContent =
            typeof rule === "string"
                ? rule
                : rule.text ||
                  rule.title ||
                  "Group rule";

        rulesListDisplay.appendChild(li);
    });
}


// ============================================================
// ADMINS
// ============================================================

async function loadAdmins() {

    adminsList.innerHTML = "";

    let admins = [];

    // --------------------------------------------------------
    // Embedded admins
    // --------------------------------------------------------

    if (Array.isArray(groupData.admins)) {
        admins = groupData.admins;
    }


    // --------------------------------------------------------
    // Owner
    // --------------------------------------------------------

    if (
        groupData.ownerId &&
        !admins.some(
            (admin) =>
                getAdminUserId(admin) ===
                groupData.ownerId
        )
    ) {

        admins.unshift({
            userId: groupData.ownerId,
            name:
                groupData.ownerName ||
                groupData.ownerFullName ||
                "Owner",
            role: "owner",
            avatar:
                groupData.ownerAvatar ||
                groupData.ownerPhoto
        });
    }


    if (!admins.length) {

        adminsEmptyDisplay.style.display =
            "block";

        return;
    }

    adminsEmptyDisplay.style.display =
        "none";


    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------

    admins.slice(0, 10).forEach((admin) => {

        const row =
            document.createElement("div");

        row.className =
            "admin-row";

        const avatar =
            document.createElement("div");

        avatar.className =
            "admin-avatar";

        const avatarUrl =
            admin.avatar ||
            admin.avatarUrl ||
            admin.photoURL;

        if (avatarUrl) {

            avatar.style.backgroundImage =
                `url("${safeUrl(avatarUrl)}")`;

        } else {

            avatar.textContent =
                getInitials(
                    admin.name ||
                    admin.displayName ||
                    "U"
                );
        }


        const info =
            document.createElement("div");

        info.className =
            "admin-info";

        const name =
            document.createElement("div");

        name.className =
            "admin-name";

        name.textContent =
            admin.name ||
            admin.displayName ||
            "User";


        const role =
            document.createElement("div");

        role.className =
            "admin-role";

        role.textContent =
            admin.role ||
            "admin";


        info.appendChild(name);
        info.appendChild(role);

        row.appendChild(avatar);
        row.appendChild(info);

        adminsList.appendChild(row);
    });
}


// ============================================================
// POST COUNT
// ============================================================

async function loadPostCount() {

    try {

        // Most flexible approach:
        // groups/{groupId}/posts

        const postsRef =
            collection(
                db,
                "groups",
                groupId,
                "posts"
            );

        const snapshot =
            await getDocs(
                query(
                    postsRef,
                    limit(1000)
                )
            );

        statPostCount.textContent =
            formatNumber(
                snapshot.size
            );

    } catch (error) {

        console.warn(
            "Post count query failed:",
            error
        );

        statPostCount.textContent =
            formatNumber(
                groupData.postCount || 0
            );
    }
}


// ============================================================
// ONLINE COUNT
// ============================================================

async function loadOnlineCount() {

    /*
       This intentionally supports multiple possible
       online fields in the group document.

       RTDB presence can be connected later if your
       group member system uses Realtime Database.
    */

    const count =
        Number(
            groupData.onlineCount ||
            groupData.onlineMembers ||
            0
        );

    statOnlineCount.textContent =
        formatNumber(count);
}


// ============================================================
// TABS
// ============================================================

function setupTabs() {

    if (!groupTabsNav) return;

    const tabs =
        groupTabsNav.querySelectorAll(
            ".group-tab"
        );

    tabs.forEach((tab) => {

        tab.addEventListener(
            "click",
            () => {

                const tabName =
                    tab.dataset.tab;

                activateTab(tabName);
            }
        );
    });
}


async function activateTab(tabName) {

    const tabs =
        groupTabsNav.querySelectorAll(
            ".group-tab"
        );

    const panels =
        document.querySelectorAll(
            ".tab-panel"
        );

    tabs.forEach((tab) => {

        tab.classList.toggle(
            "is-active",
            tab.dataset.tab === tabName
        );
    });

    panels.forEach((panel) => {

        panel.classList.toggle(
            "is-active",
            panel.dataset.panel === tabName
        );
    });


    // --------------------------------------------------------
    // Load only when opened
    // --------------------------------------------------------

    if (tabName === "posts" && !postsLoaded) {

        postsLoaded = true;

        await loadPosts();
    }


    if (
        tabName === "members" &&
        !membersLoaded
    ) {

        membersLoaded = true;

        await loadMembers();
    }


    if (tabName === "chat" && !chatLoaded) {

        chatLoaded = true;

        loadChat();
    }


    if (
        tabName === "subscription" &&
        !subscriptionLoaded
    ) {

        subscriptionLoaded = true;

        loadSubscription();
    }


    if (
        tabName === "settings" &&
        !settingsLoaded
    ) {

        settingsLoaded = true;

        loadSettings();
    }
}


// ============================================================
// POSTS
// ============================================================

async function loadPosts() {

    postsTab.innerHTML =
        `<div class="tab-panel-placeholder">
            <span class="spinner-sm"></span>
            Loading posts…
        </div>`;

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

            postsTab.innerHTML =
                `<div class="tab-panel-placeholder">
                    <i class="fa-solid fa-note-sticky"></i>
                    No posts yet.
                </div>`;

            return;
        }


        postsTab.innerHTML = "";


        snapshot.forEach((postDoc) => {

            const post =
                postDoc.data();

            const article =
                document.createElement("article");

            article.style.cssText = `
                background: var(--bg-surface);
                border: 1px solid var(--border-subtle);
                border-radius: var(--radius-lg);
                padding: 18px;
                margin-bottom: 14px;
            `;

            const author =
                post.authorName ||
                post.fullname ||
                post.userName ||
                "Member";

            const text =
                post.text ||
                post.content ||
                post.caption ||
                "";

            const created =
                formatDate(
                    post.createdAt
                );

            article.innerHTML = `
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
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:linear-gradient(
                            135deg,
                            var(--electric-blue),
                            var(--violet-accent)
                        );
                        font-weight:700;
                    ">
                        ${escapeHtml(
                            getInitials(author)
                        )}
                    </div>

                    <div>
                        <div style="
                            font-size:13px;
                            font-weight:600;
                        ">
                            ${escapeHtml(author)}
                        </div>

                        <div style="
                            font-size:11px;
                            color:var(--text-muted);
                        ">
                            ${escapeHtml(created)}
                        </div>
                    </div>
                </div>

                ${
                    text
                        ? `<div style="
                            color:var(--text-secondary);
                            font-size:14px;
                            line-height:1.6;
                            white-space:pre-wrap;
                        ">
                            ${escapeHtml(text)}
                        </div>`
                        : ""
                }
            `;

            postsTab.appendChild(article);
        });

    } catch (error) {

        console.error(
            "Posts loading error:",
            error
        );

        postsTab.innerHTML =
            `<div class="tab-panel-placeholder">
                Unable to load posts.
            </div>`;
    }
}


// ============================================================
// MEMBERS
// ============================================================

async function loadMembers() {

    membersTab.innerHTML =
        `<div class="tab-panel-placeholder">
            <span class="spinner-sm"></span>
            Loading members…
        </div>`;

    try {

        const membersRef =
            collection(
                db,
                "groups",
                groupId,
                "members"
            );

        const snapshot =
            await getDocs(
                query(
                    membersRef,
                    limit(100)
                )
            );

        if (snapshot.empty) {

            membersTab.innerHTML =
                `<div class="tab-panel-placeholder">
                    No members found.
                </div>`;

            return;
        }


        const wrapper =
            document.createElement("div");

        wrapper.style.cssText =
            "display:flex;flex-direction:column;gap:8px;";


        snapshot.forEach((memberDoc) => {

            const member =
                memberDoc.data();

            const name =
                member.displayName ||
                member.fullname ||
                member.name ||
                "Member";

            const row =
                document.createElement("div");

            row.style.cssText = `
                display:flex;
                align-items:center;
                gap:12px;
                padding:12px 14px;
                background:var(--bg-surface);
                border:1px solid var(--border-subtle);
                border-radius:14px;
            `;

            row.innerHTML = `
                <div style="
                    width:42px;
                    height:42px;
                    border-radius:50%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    flex-shrink:0;
                    background:
                        linear-gradient(
                            135deg,
                            var(--electric-blue),
                            var(--violet-accent)
                        );
                    font-weight:700;
                ">
                    ${escapeHtml(
                        getInitials(name)
                    )}
                </div>

                <div style="min-width:0;">
                    <div style="
                        font-size:14px;
                        font-weight:600;
                    ">
                        ${escapeHtml(name)}
                    </div>

                    <div style="
                        font-size:11px;
                        color:var(--text-muted);
                        text-transform:capitalize;
                    ">
                        ${escapeHtml(
                            member.role ||
                            "member"
                        )}
                    </div>
                </div>
            `;

            wrapper.appendChild(row);
        });

        membersTab.innerHTML = "";

        membersTab.appendChild(wrapper);

    } catch (error) {

        console.error(
            "Members loading error:",
            error
        );

        membersTab.innerHTML =
            `<div class="tab-panel-placeholder">
                Unable to load members.
            </div>`;
    }
}


// ============================================================
// CHAT
// ============================================================

function loadChat() {

    chatTab.innerHTML = `
        <div style="
            padding:40px 20px;
            text-align:center;
            background:var(--bg-surface);
            border:1px solid var(--border-subtle);
            border-radius:var(--radius-lg);
        ">
            <i class="fa-solid fa-comments"
               style="
                   font-size:30px;
                   color:var(--electric-blue-bright);
                   margin-bottom:12px;
               ">
            </i>

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
                Group chat is ready to be connected.
            </p>
        </div>
    `;
}


// ============================================================
// SUBSCRIPTION
// ============================================================

function loadSubscription() {

    const premium =
        groupData.premium === true ||
        groupData.isPremium === true ||
        groupData.plan === "premium";

    if (!premium) {

        subscriptionTab.innerHTML =
            `<div class="tab-panel-placeholder">
                This is not a premium group.
            </div>`;

        return;
    }

    const price =
        groupData.subscriptionPrice ||
        groupData.price ||
        1500;

    subscriptionTab.innerHTML = `
        <div style="
            padding:24px;
            background:var(--bg-surface);
            border:1px solid var(--border-subtle);
            border-radius:var(--radius-lg);
        ">
            <div style="
                display:flex;
                align-items:center;
                gap:10px;
                margin-bottom:12px;
            ">
                <i class="fa-solid fa-crown"
                   style="color:var(--gold-accent);">
                </i>

                <h3 style="
                    margin:0;
                    font-family:var(--font-display);
                ">
                    Premium Group
                </h3>
            </div>

            <p style="
                color:var(--text-secondary);
                font-size:13.5px;
                line-height:1.6;
            ">
                This group uses a premium membership system.
            </p>

            <div style="
                font-family:var(--font-mono);
                font-size:20px;
                margin-top:16px;
            ">
                ₦${formatNumber(price)}
            </div>
        </div>
    `;
}


// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {

    const isOwner =
        currentUser &&
        groupData.ownerId === currentUser.uid;

    if (!isOwner) {

        settingsTab.innerHTML =
            `<div class="tab-panel-placeholder">
                You don't have permission to view settings.
            </div>`;

        return;
    }

    settingsTab.innerHTML = `
        <div style="
            padding:24px;
            background:var(--bg-surface);
            border:1px solid var(--border-subtle);
            border-radius:var(--radius-lg);
        ">
            <h3 style="
                margin:0 0 16px;
                font-family:var(--font-display);
            ">
                Group Settings
            </h3>

            <p style="
                color:var(--text-secondary);
                font-size:13px;
                line-height:1.6;
            ">
                Group administration controls can be connected
                here without affecting the public group view.
            </p>
        </div>
    `;
}


// ============================================================
// SHARE
// ============================================================

async function shareGroup() {

    const name =
        groupData.name ||
        "VitalStar Group";

    const url =
        window.location.href;

    try {

        if (
            navigator.share
        ) {

            await navigator.share({
                title: name,
                text:
                    `Join ${name} on VitalStar`,
                url
            });

            return;
        }

        await navigator.clipboard.writeText(
            url
        );

        showToast(
            "Group link copied.",
            "success"
        );

    } catch (error) {

        console.warn(
            "Share cancelled/failed:",
            error
        );
    }
}


// ============================================================
// INVITE
// ============================================================

function inviteMembers() {

    const url =
        window.location.href;

    navigator.clipboard
        ?.writeText(url)
        .then(() => {

            showToast(
                "Invite link copied.",
                "success"
            );

        })
        .catch(() => {

            showToast(
                url,
                "info"
            );
        });
}


// ============================================================
// COVER EDIT
// ============================================================

function editCover() {

    const isAdmin =
        currentUser &&
        (
            groupData.ownerId === currentUser.uid ||
            currentRole === "admin"
        );

    if (!isAdmin) {
        return;
    }

    showToast(
        "Cover editing can be connected to your upload system.",
        "info"
    );
}


// ============================================================
// NAV USER
// ============================================================

async function loadNavigationUser() {

    if (!currentUser) {
        return;
    }

    try {

        const userRef =
            doc(
                db,
                "users",
                currentUser.uid
            );

        const snapshot =
            await getDoc(userRef);

        if (snapshot.exists()) {

            const user =
                snapshot.data();

            const avatar =
                user.photoURL ||
                user.avatar ||
                user.profilePicture;

            if (avatar) {

                navUserAvatar.style.backgroundImage =
                    `url("${safeUrl(avatar)}")`;

                navUserAvatar.innerHTML = "";
            }
        }

    } catch (error) {

        console.warn(
            "Navigation user loading failed:",
            error
        );
    }
}


// ============================================================
// NOTIFICATIONS
// ============================================================

async function loadNotifications() {

    if (!currentUser) {

        notifUnreadDot.classList.remove(
            "is-visible"
        );

        return;
    }

    try {

        const notificationsRef =
            collection(
                db,
                "notifications"
            );

        const q =
            query(
                notificationsRef,
                where(
                    "receiverId",
                    "==",
                    currentUser.uid
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(20)
            );

        const snapshot =
            await getDocs(q);

        notificationsList.innerHTML = "";

        if (snapshot.empty) {

            notificationsList.innerHTML =
                `<p class="notifications-empty">
                    You're all caught up.
                </p>`;

            notifUnreadDot.classList.remove(
                "is-visible"
            );

            return;
        }

        let unread = 0;

        snapshot.forEach((notificationDoc) => {

            const notification =
                notificationDoc.data();

            if (
                notification.read !== true
            ) {
                unread++;
            }

            const item =
                document.createElement("div");

            item.className =
                "notification-item";

            item.innerHTML = `
                <div class="notification-item__icon">
                    <i class="fa-solid fa-bell"></i>
                </div>

                <div>
                    <div class="notification-item__text">
                        ${escapeHtml(
                            notification.message ||
                            notification.text ||
                            "New notification"
                        )}
                    </div>

                    <div class="notification-item__time">
                        ${escapeHtml(
                            formatDate(
                                notification.createdAt
                            )
                        )}
                    </div>
                </div>
            `;

            notificationsList.appendChild(item);
        });

        if (unread > 0) {

            notifUnreadDot.classList.add(
                "is-visible"
            );

        } else {

            notifUnreadDot.classList.remove(
                "is-visible"
            );
        }

    } catch (error) {

        console.warn(
            "Notifications failed:",
            error
        );
    }
}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

    setupTabs();


    joinLeaveBtn?.addEventListener(
        "click",
        handleJoinLeave
    );


    shareBtn?.addEventListener(
        "click",
        shareGroup
    );


    inviteBtn?.addEventListener(
        "click",
        inviteMembers
    );


    coverEditBtn?.addEventListener(
        "click",
        editCover
    );


    notificationBellBtn?.addEventListener(
        "click",
        () => {

            notificationsPanel.classList.toggle(
                "is-visible"
            );
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
        (event) => {

            if (
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
}


// ============================================================
// LOADER / NOT FOUND
// ============================================================

function showLoader() {

    pageLoader.classList.remove(
        "is-hidden"
    );

    groupPageContent.classList.remove(
        "is-visible"
    );

    groupNotFoundState.classList.remove(
        "is-visible"
    );
}


function hideLoader() {

    pageLoader.classList.add(
        "is-hidden"
    );

    groupPageContent.classList.add(
        "is-visible"
    );
}


function showNotFound() {

    pageLoader.classList.add(
        "is-hidden"
    );

    groupPageContent.classList.remove(
        "is-visible"
    );

    groupNotFoundState.classList.add(
        "is-visible"
    );
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "info"
) {

    const toast =
        document.createElement("div");

    toast.className =
        `toast toast--${type}`;

    let icon =
        "fa-circle-info";

    if (type === "success") {
        icon = "fa-circle-check";
    }

    if (type === "error") {
        icon = "fa-circle-exclamation";
    }

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div>${escapeHtml(message)}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {

        toast.classList.add(
            "is-leaving"
        );

        setTimeout(() => {
            toast.remove();
        }, 250);

    }, 3500);
}


// ============================================================
// HELPERS
// ============================================================

function formatNumber(value) {

    const number =
        Number(value) || 0;

    return number.toLocaleString();
}


function capitalize(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value).slice(1);
}


function getInitials(name) {

    if (!name) {
        return "G";
    }

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function getEmbeddedMemberCount() {

    if (
        Array.isArray(groupData.members)
    ) {
        return groupData.members.length;
    }

    if (
        groupData.members &&
        typeof groupData.members === "object"
    ) {
        return Object.keys(
            groupData.members
        ).length;
    }

    return 0;
}


function getAdminUserId(admin) {

    if (!admin) {
        return null;
    }

    if (typeof admin === "string") {
        return admin;
    }

    return (
        admin.userId ||
        admin.uid ||
        admin.id ||
        null
    );
}


function formatDate(timestamp) {

    if (!timestamp) {
        return "—";
    }

    try {

        let date;

        if (
            timestamp &&
            typeof timestamp.toDate === "function"
        ) {

            date = timestamp.toDate();

        } else if (
            timestamp instanceof Date
        ) {

            date = timestamp;

        } else if (
            typeof timestamp === "number"
        ) {

            date = new Date(timestamp);

        } else {

            date = new Date(timestamp);
        }

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    } catch {

        return "—";
    }
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function safeUrl(url) {

    if (!url) {
        return "";
    }

    const value =
        String(url).trim();

    if (
        value.startsWith("https://") ||
        value.startsWith("http://")
    ) {
        return value;
    }

    return "";
}


function setBackgroundImage(
    element,
    url
) {

    if (!element) {
        return;
    }

    const safe =
        safeUrl(url);

    if (safe) {

        element.style.backgroundImage =
            `url("${safe}")`;

        element.innerHTML = "";

    } else {

        element.style.backgroundImage =
            "";
    }
}