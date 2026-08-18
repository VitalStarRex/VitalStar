// ============================================================
// VITALSTAR — group.js
// Controller for group.html
//
// Works with the group.html provided by the user.
//
// Features:
// • Authentication
// • Group ID detection from URL
// • Group loading
// • Group cover/avatar
// • Privacy / premium / verified badges
// • Owner information
// • Member status
// • Join / leave
// • Private group locking
// • Tabs
// • Members
// • Posts
// • Chat
// • Subscription
// • Settings
// • Rules
// • Admins / moderators
// • Notifications
// • Header statistics
// • Share group
// • Invite button
//
// Firebase v10.12.2
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
    addDoc,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// CONFIG
// ============================================================

const GROUPS_COLLECTION = "groups";
const USERS_COLLECTION = "users";
const NOTIFICATIONS_COLLECTION = "notifications";


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentGroup = null;
let currentGroupId = null;

let isMember = false;
let isOwner = false;
let isAdmin = false;
let isModerator = false;

let currentTab = "posts";


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const pageLoader = $("pageLoader");
const groupNotFoundState = $("groupNotFoundState");
const groupPageContent = $("groupPageContent");

const navGroupTitle = $("navGroupTitle");
const navUserAvatar = $("navUserAvatar");

const groupCover = $("groupCover");
const coverEditBtn = $("coverEditBtn");

const groupAvatar = $("groupAvatar");
const groupName = $("groupName");
const groupDescription = $("groupDescription");

const groupPrivacyBadge = $("groupPrivacyBadge");
const groupPremiumBadge = $("groupPremiumBadge");
const groupVerifiedBadge = $("groupVerifiedBadge");

const groupCategoryChip = $("groupCategoryChip");
const groupOwnerText = $("groupOwnerText");
const groupCreatedText = $("groupCreatedText");

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
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    setupUI();
});


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async (user) => {

    currentUser = user || null;

    if (!user) {
        showToast("Please log in to view this group.", "error");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);

        return;
    }

    try {

        await loadCurrentUserAvatar();

        currentGroupId = getGroupIdFromURL();

        if (!currentGroupId) {
            showNotFound();
            return;
        }

        await loadGroup();

    } catch (error) {

        console.error("GROUP INITIALIZATION ERROR:", error);

        showToast(
            error?.message || "Unable to load this group.",
            "error"
        );

        showNotFound();
    }
});


// ============================================================
// GET GROUP ID
// ============================================================

function getGroupIdFromURL() {

    const url = new URL(window.location.href);

    // ?groupId=xxxx
    const groupId =
        url.searchParams.get("groupId") ||
        url.searchParams.get("group") ||
        url.searchParams.get("id");

    if (groupId) {
        return decodeURIComponent(groupId).trim();
    }

    // /group.html/xxxx
    const pathname = window.location.pathname
        .split("/")
        .filter(Boolean);

    const lastPart = pathname[pathname.length - 1];

    if (
        lastPart &&
        !lastPart.toLowerCase().endsWith(".html") &&
        lastPart !== "group"
    ) {
        return decodeURIComponent(lastPart).trim();
    }

    // #groupId
    if (window.location.hash) {
        const hash = window.location.hash
            .replace("#", "")
            .trim();

        if (hash) {
            return decodeURIComponent(hash);
        }
    }

    return null;
}


// ============================================================
// LOAD GROUP
// ============================================================

async function loadGroup() {

    showLoader(true);

    const groupRef = doc(
        db,
        GROUPS_COLLECTION,
        currentGroupId
    );

    const snapshot = await getDoc(groupRef);

    if (!snapshot.exists()) {
        showNotFound();
        return;
    }

    currentGroup = {
        id: snapshot.id,
        ...snapshot.data()
    };

    console.log("GROUP LOADED:", currentGroup);

    await determineMembership();

    renderGroupHeader();
    renderRules();
    await renderAdmins();

    await loadHeaderStats();

    configurePermissions();

    renderAccessState();

    await loadNotifications();

    showLoader(false);
}


// ============================================================
// MEMBERSHIP
// ============================================================

async function determineMembership() {

    isMember = false;
    isOwner = false;
    isAdmin = false;
    isModerator = false;

    if (!currentUser || !currentGroup) {
        return;
    }

    const uid = currentUser.uid;

    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    const ownerId =
        currentGroup.ownerId ||
        currentGroup.ownerUID ||
        currentGroup.ownerUid ||
        currentGroup.createdBy ||
        currentGroup.creatorId ||
        null;

    if (ownerId === uid) {
        isOwner = true;
        isMember = true;
    }

    // --------------------------------------------------------
    // MEMBERS ARRAY
    // --------------------------------------------------------

    const members = currentGroup.members;

    if (Array.isArray(members)) {

        if (members.includes(uid)) {
            isMember = true;
        }

    } else if (members && typeof members === "object") {

        if (
            members[uid] === true ||
            members[uid] === "member" ||
            members[uid]?.role
        ) {
            isMember = true;
        }

        const role = members[uid]?.role;

        if (role === "admin") {
            isAdmin = true;
        }

        if (role === "moderator" || role === "mod") {
            isModerator = true;
        }
    }

    // --------------------------------------------------------
    // SUBCOLLECTION MEMBER DOCUMENT
    // groups/{groupId}/members/{uid}
    // --------------------------------------------------------

    try {

        const memberRef = doc(
            db,
            GROUPS_COLLECTION,
            currentGroupId,
            "members",
            uid
        );

        const memberSnap = await getDoc(memberRef);

        if (memberSnap.exists()) {

            isMember = true;

            const memberData = memberSnap.data();

            const role =
                memberData.role ||
                memberData.memberRole ||
                "";

            if (role === "owner") {
                isOwner = true;
            }

            if (role === "admin") {
                isAdmin = true;
            }

            if (
                role === "moderator" ||
                role === "mod"
            ) {
                isModerator = true;
            }
        }

    } catch (error) {

        console.warn(
            "Could not read group member document:",
            error
        );
    }
}


// ============================================================
// RENDER GROUP HEADER
// ============================================================

function renderGroupHeader() {

    const group = currentGroup;

    const name =
        group.name ||
        group.title ||
        "Untitled Group";

    const description =
        group.description ||
        group.bio ||
        "No description available.";

    const category =
        group.category ||
        "General";

    const privacy =
        String(
            group.privacy ||
            group.visibility ||
            group.type ||
            "public"
        ).toLowerCase();

    const cover =
        group.coverURL ||
        group.coverUrl ||
        group.cover ||
        group.coverPhoto ||
        "";

    const avatar =
        group.avatarURL ||
        group.avatarUrl ||
        group.avatar ||
        group.photoURL ||
        group.image ||
        "";

    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    groupName.textContent = name;

    navGroupTitle.textContent = name;

    document.title = `${name} · VitalStar`;

    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    groupDescription.textContent = description;

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    groupCategoryChip.textContent = category;

    // --------------------------------------------------------
    // COVER
    // --------------------------------------------------------

    if (cover) {

        groupCover.style.backgroundImage =
            `url("${escapeCSSUrl(cover)}")`;

    } else {

        groupCover.style.backgroundImage =
            "linear-gradient(135deg,#1B3E8F,#241640)";
    }

    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    if (avatar) {

        groupAvatar.style.backgroundImage =
            `url("${escapeCSSUrl(avatar)}")`;

        groupAvatar.innerHTML = "";

    } else {

        groupAvatar.style.backgroundImage = "";

        const firstLetter =
            name.charAt(0).toUpperCase();

        groupAvatar.innerHTML =
            escapeHTML(firstLetter);
    }

    // --------------------------------------------------------
    // PRIVACY
    // --------------------------------------------------------

    groupPrivacyBadge.className =
        "badge " +
        (
            privacy === "private"
                ? "badge--private"
                : "badge--public"
        );

    groupPrivacyBadge.textContent =
        privacy === "private"
            ? "Private"
            : "Public";

    // --------------------------------------------------------
    // PREMIUM
    // --------------------------------------------------------

    const premium =
        Boolean(
            group.premium ||
            group.isPremium ||
            group.premiumGroup ||
            group.subscriptionRequired
        );

    groupPremiumBadge.style.display =
        premium ? "inline-flex" : "none";

    // --------------------------------------------------------
    // VERIFIED
    // --------------------------------------------------------

    const verified =
        Boolean(
            group.verified ||
            group.isVerified
        );

    groupVerifiedBadge.style.display =
        verified ? "inline-flex" : "none";

    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    const ownerName =
        group.ownerName ||
        group.createdByName ||
        group.creatorName ||
        "Group owner";

    groupOwnerText.textContent =
        `Owned by ${ownerName}`;

    // --------------------------------------------------------
    // CREATED DATE
    // --------------------------------------------------------

    groupCreatedText.textContent =
        `Created ${formatDate(
            group.createdAt ||
            group.createdDate ||
            group.created
        )}`;
}


// ============================================================
// HEADER STATS
// ============================================================

async function loadHeaderStats() {

    const group = currentGroup;

    let memberCount =
        numberValue(
            group.memberCount,
            group.membersCount,
            group.totalMembers
        );

    // Count members if count doesn't exist
    if (!memberCount) {

        try {

            const membersRef = collection(
                db,
                GROUPS_COLLECTION,
                currentGroupId,
                "members"
            );

            const membersSnap = await getDocs(membersRef);

            memberCount = membersSnap.size;

        } catch (error) {

            console.warn(
                "Could not count members:",
                error
            );

            if (Array.isArray(group.members)) {
                memberCount = group.members.length;
            }
        }
    }

    statMemberCount.textContent =
        formatNumber(memberCount);

    // --------------------------------------------------------
    // POSTS
    // --------------------------------------------------------

    let postCount =
        numberValue(
            group.postCount,
            group.postsCount,
            group.totalPosts
        );

    if (!postCount) {

        try {

            const postsRef = collection(
                db,
                GROUPS_COLLECTION,
                currentGroupId,
                "posts"
            );

            const postsSnap = await getDocs(
                query(postsRef, limit(1000))
            );

            postCount = postsSnap.size;

        } catch (error) {

            console.warn(
                "Could not count posts:",
                error
            );
        }
    }

    statPostCount.textContent =
        formatNumber(postCount);

    // --------------------------------------------------------
    // ONLINE
    // --------------------------------------------------------

    const onlineCount =
        numberValue(
            group.onlineCount,
            group.onlineMembers,
            group.activeMembers
        );

    statOnlineCount.textContent =
        formatNumber(onlineCount);

    // --------------------------------------------------------
    // LEVEL
    // --------------------------------------------------------

    const level =
        numberValue(
            group.level,
            group.groupLevel
        ) || 1;

    statLevel.textContent = level;
}


// ============================================================
// PERMISSIONS
// ============================================================

function configurePermissions() {

    const canManage =
        isOwner ||
        isAdmin;

    const canInvite =
        isMember &&
        (
            canManage ||
            isModerator
        );

    // Role
    if (isOwner) {

        yourRoleTag.classList.add("is-visible");
        yourRoleText.textContent = "Owner";

    } else if (isAdmin) {

        yourRoleTag.classList.add("is-visible");
        yourRoleText.textContent = "Admin";

    } else if (isModerator) {

        yourRoleTag.classList.add("is-visible");
        yourRoleText.textContent = "Moderator";

    } else {

        yourRoleTag.classList.remove("is-visible");
    }

    // Invite
    inviteBtn.style.display =
        canInvite ? "flex" : "none";

    // Cover edit
    coverEditBtn.classList.toggle(
        "is-visible",
        canManage
    );

    // Settings
    settingsTabBtn.style.display =
        canManage ? "flex" : "none";
}


// ============================================================
// ACCESS STATE
// ============================================================

function renderAccessState() {

    const privacy =
        String(
            currentGroup.privacy ||
            currentGroup.visibility ||
            currentGroup.type ||
            "public"
        ).toLowerCase();

    const isPrivate =
        privacy === "private";

    const canView =
        !isPrivate ||
        isMember;

    if (canView) {

        lockedNotice.classList.remove("is-visible");

        groupContentGrid.style.display =
            "grid";

        groupTabsNav.style.display =
            "flex";

        renderJoinButton();

        return;
    }

    // Private and not member
    lockedNotice.classList.add("is-visible");

    groupContentGrid.style.display =
        "none";

    groupTabsNav.style.display =
        "none";

    renderJoinButton();
}


// ============================================================
// JOIN BUTTON
// ============================================================

function renderJoinButton() {

    joinLeaveBtn.disabled = false;

    if (isOwner) {

        joinLeaveBtn.className =
            "btn-join-leave is-member";

        joinLeaveBtn.innerHTML =
            '<i class="fa-solid fa-shield-halved"></i> Owner';

        joinLeaveBtn.disabled = true;

        return;
    }

    if (isMember) {

        joinLeaveBtn.className =
            "btn-join-leave is-member";

        joinLeaveBtn.innerHTML =
            '<i class="fa-solid fa-check"></i> Joined';

        return;
    }

    joinLeaveBtn.className =
        "btn-join-leave";

    joinLeaveBtn.innerHTML =
        '<i class="fa-solid fa-plus"></i> Join group';
}


// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup() {

    if (!currentUser || !currentGroup) {
        return;
    }

    if (isOwner || isMember) {
        return;
    }

    setJoinButtonLoading(true);

    try {

        const uid = currentUser.uid;

        const memberRef = doc(
            db,
            GROUPS_COLLECTION,
            currentGroupId,
            "members",
            uid
        );

        const userSnap = await getDoc(
            doc(db, USERS_COLLECTION, uid)
        );

        const userData =
            userSnap.exists()
                ? userSnap.data()
                : {};

        await setDoc(
            memberRef,
            {
                uid,
                userId: uid,

                fullName:
                    userData.fullName ||
                    userData.name ||
                    currentUser.displayName ||
                    "VitalStar Member",

                username:
                    userData.username ||
                    "",

                photoURL:
                    userData.photoURL ||
                    userData.profilePhoto ||
                    currentUser.photoURL ||
                    "",

                role: "member",

                joinedAt: serverTimestamp(),

                status: "active"
            },
            { merge: true }
        );

        // Update member count
        try {

            await updateDoc(
                doc(
                    db,
                    GROUPS_COLLECTION,
                    currentGroupId
                ),
                {
                    memberCount: increment(1)
                }
            );

        } catch (error) {

            console.warn(
                "Could not increment member count:",
                error
            );
        }

        // Add notification for owner
        await notifyGroupOwner(
            "new_member",
            `${userData.fullName || currentUser.displayName || "Someone"} joined your group.`
        );

        isMember = true;

        renderJoinButton();

        renderAccessState();

        configurePermissions();

        await loadHeaderStats();

        showToast(
            "You joined the group!",
            "success"
        );

    } catch (error) {

        console.error(
            "JOIN GROUP ERROR:",
            error
        );

        showToast(
            error?.message ||
            "Unable to join this group.",
            "error"
        );

    } finally {

        setJoinButtonLoading(false);
    }
}


// ============================================================
// LEAVE GROUP
// ============================================================

async function leaveGroup() {

    if (!currentUser || !currentGroup) {
        return;
    }

    if (isOwner) {
        showToast(
            "The group owner cannot leave the group.",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            "Leave this group?"
        );

    if (!confirmed) {
        return;
    }

    setJoinButtonLoading(true);

    try {

        const memberRef = doc(
            db,
            GROUPS_COLLECTION,
            currentGroupId,
            "members",
            currentUser.uid
        );

        await deleteDoc(memberRef);

        try {

            await updateDoc(
                doc(
                    db,
                    GROUPS_COLLECTION,
                    currentGroupId
                ),
                {
                    memberCount: increment(-1)
                }
            );

        } catch (error) {

            console.warn(
                "Could not decrease member count:",
                error
            );
        }

        isMember = false;
        isAdmin = false;
        isModerator = false;

        renderJoinButton();

        configurePermissions();

        renderAccessState();

        await loadHeaderStats();

        showToast(
            "You left the group.",
            "success"
        );

    } catch (error) {

        console.error(
            "LEAVE GROUP ERROR:",
            error
        );

        showToast(
            error?.message ||
            "Unable to leave the group.",
            "error"
        );

    } finally {

        setJoinButtonLoading(false);
    }
}


// ============================================================
// POSTS
// ============================================================

async function loadPosts() {

    postsTab.innerHTML =
        loadingHTML("Loading posts…");

    try {

        const postsRef = collection(
            db,
            GROUPS_COLLECTION,
            currentGroupId,
            "posts"
        );

        let snapshot;

        try {

            snapshot = await getDocs(
                query(
                    postsRef,
                    orderBy("createdAt", "desc"),
                    limit(20)
                )
            );

        } catch (firstError) {

            console.warn(
                "Ordered post query failed. Using fallback.",
                firstError
            );

            snapshot = await getDocs(
                query(
                    postsRef,
                    limit(20)
                )
            );
        }

        if (snapshot.empty) {

            postsTab.innerHTML =
                emptyHTML(
                    "fa-note-sticky",
                    "No posts yet",
                    "Be the first person to post in this group."
                );

            return;
        }

        const posts = snapshot.docs.map(
            d => ({
                id: d.id,
                ...d.data()
            })
        );

        posts.sort(
            (a, b) =>
                timestampValue(b.createdAt) -
                timestampValue(a.createdAt)
        );

        postsTab.innerHTML =
            posts.map(renderPost).join("");

    } catch (error) {

        console.error(
            "LOAD POSTS ERROR:",
            error
        );

        postsTab.innerHTML =
            errorHTML(
                "Unable to load posts."
            );
    }
}


// ============================================================
// RENDER POST
// ============================================================

function renderPost(post) {

    const author =
        post.authorName ||
        post.fullName ||
        post.userName ||
        "VitalStar Member";

    const username =
        post.username
            ? `@${escapeHTML(post.username)}`
            : "";

    const text =
        post.text ||
        post.content ||
        post.caption ||
        "";

    const image =
        post.imageURL ||
        post.imageUrl ||
        post.image ||
        "";

    const video =
        post.videoURL ||
        post.videoUrl ||
        post.video ||
        "";

    let mediaHTML = "";

    if (image) {

        mediaHTML = `
            <img
                src="${escapeHTML(image)}"
                alt="Post image"
                style="
                    width:100%;
                    max-height:420px;
                    object-fit:cover;
                    border-radius:14px;
                    margin-top:12px;
                "
            >
        `;

    } else if (video) {

        mediaHTML = `
            <video
                controls
                playsinline
                style="
                    width:100%;
                    max-height:420px;
                    border-radius:14px;
                    margin-top:12px;
                    background:#000;
                "
            >
                <source src="${escapeHTML(video)}">
            </video>
        `;
    }

    return `
        <article
            class="group-post-card"
            style="
                background:var(--bg-surface);
                border:1px solid var(--border-subtle);
                border-radius:18px;
                padding:18px;
                margin-bottom:14px;
            "
        >

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                "
            >

                <div
                    style="
                        width:40px;
                        height:40px;
                        border-radius:50%;
                        background:linear-gradient(
                            135deg,
                            var(--electric-blue),
                            var(--violet-accent)
                        );
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-weight:700;
                    "
                >
                    ${escapeHTML(author.charAt(0).toUpperCase())}
                </div>

                <div>
                    <div
                        style="
                            font-weight:700;
                            color:var(--text-primary);
                        "
                    >
                        ${escapeHTML(author)}
                    </div>

                    <div
                        style="
                            font-size:11px;
                            color:var(--text-muted);
                        "
                    >
                        ${username}
                        ${username ? " • " : ""}
                        ${formatDate(post.createdAt)}
                    </div>
                </div>

            </div>

            ${
                text
                    ? `
                    <div
                        style="
                            margin-top:14px;
                            color:var(--text-secondary);
                            line-height:1.6;
                            white-space:pre-wrap;
                        "
                    >
                        ${escapeHTML(text)}
                    </div>
                    `
                    : ""
            }

            ${mediaHTML}

        </article>
    `;
}


// ============================================================
// MEMBERS
// ============================================================

async function loadMembers() {

    membersTab.innerHTML =
        loadingHTML("Loading members…");

    try {

        const membersRef = collection(
            db,
            GROUPS_COLLECTION,
            currentGroupId,
            "members"
        );

        const snapshot =
            await getDocs(membersRef);

        let members =
            snapshot.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );

        // Add owner if not already present
        const ownerId =
            currentGroup.ownerId ||
            currentGroup.ownerUID ||
            currentGroup.ownerUid ||
            currentGroup.createdBy ||
            currentGroup.creatorId;

        if (
            ownerId &&
            !members.some(
                m =>
                    m.uid === ownerId ||
                    m.userId === ownerId ||
                    m.id === ownerId
            )
        ) {

            try {

                const ownerSnap =
                    await getDoc(
                        doc(
                            db,
                            USERS_COLLECTION,
                            ownerId
                        )
                    );

                if (ownerSnap.exists()) {

                    members.unshift({
                        id: ownerId,
                        uid: ownerId,
                        ...ownerSnap.data(),
                        role: "owner"
                    });
                }

            } catch (error) {

                console.warn(
                    "Could not load owner profile:",
                    error
                );
            }
        }

        if (!members.length) {

            membersTab.innerHTML =
                emptyHTML(
                    "fa-users",
                    "No members found",
                    "Members will appear here after they join."
                );

            return;
        }

        // Load user profiles
        const enriched = [];

        for (const member of members.slice(0, 100)) {

            const uid =
                member.uid ||
                member.userId ||
                member.id;

            let user = {};

            try {

                const userSnap =
                    await getDoc(
                        doc(
                            db,
                            USERS_COLLECTION,
                            uid
                        )
                    );

                if (userSnap.exists()) {
                    user = userSnap.data();
                }

            } catch (error) {
                console.warn(
                    "Could not load member profile:",
                    uid,
                    error
                );
            }

            enriched.push({
                ...member,
                ...user
            });
        }

        membersTab.innerHTML =
            `
            <div
                style="
                    display:grid;
                    grid-template-columns:
                    repeat(auto-fill,minmax(220px,1fr));
                    gap:12px;
                "
            >
                ${
                    enriched
                        .map(renderMember)
                        .join("")
                }
            </div>
            `;

    } catch (error) {

        console.error(
            "LOAD MEMBERS ERROR:",
            error
        );

        membersTab.innerHTML =
            errorHTML(
                "Unable to load members."
            );
    }
}


// ============================================================
// MEMBER CARD
// ============================================================

function renderMember(member) {

    const uid =
        member.uid ||
        member.userId ||
        member.id;

    const name =
        member.fullName ||
        member.name ||
        member.displayName ||
        "VitalStar Member";

    const username =
        member.username
            ? `@${escapeHTML(member.username)}`
            : "";

    const photo =
        member.photoURL ||
        member.profilePhoto ||
        member.avatar ||
        "";

    const role =
        member.role ||
        "member";

    const avatarStyle =
        photo
            ? `background-image:url("${escapeCSSUrl(photo)}");`
            : "";

    return `
        <a
            href="profile.html?uid=${encodeURIComponent(uid)}"
            style="
                display:flex;
                align-items:center;
                gap:11px;
                padding:13px;
                border-radius:15px;
                background:var(--bg-surface);
                border:1px solid var(--border-subtle);
            "
        >

            <div
                style="
                    width:44px;
                    height:44px;
                    border-radius:13px;
                    background:
                        linear-gradient(
                            135deg,
                            var(--electric-blue),
                            var(--violet-accent)
                        );
                    background-size:cover;
                    background-position:center;
                    ${avatarStyle}
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-weight:700;
                    color:white;
                    flex-shrink:0;
                "
            >
                ${
                    photo
                        ? ""
                        : escapeHTML(
                            name
                                .charAt(0)
                                .toUpperCase()
                        )
                }
            </div>

            <div style="min-width:0;">

                <div
                    style="
                        font-size:13px;
                        font-weight:700;
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                    "
                >
                    ${escapeHTML(name)}
                </div>

                <div
                    style="
                        font-size:11px;
                        color:var(--text-muted);
                    "
                >
                    ${username}
                </div>

                <div
                    style="
                        margin-top:4px;
                        font-size:10px;
                        color:
                        ${
                            role === "owner"
                                ? "var(--gold-accent)"
                                : role === "admin"
                                ? "var(--electric-blue-bright)"
                                : "var(--text-muted)"
                        };
                        text-transform:capitalize;
                    "
                >
                    ${escapeHTML(role)}
                </div>

            </div>

        </a>
    `;
}


// ============================================================
// CHAT
// ============================================================

async function loadChat() {

    chatTab.innerHTML =
        loadingHTML("Loading chat…");

    chatTab.innerHTML = `
        <div
            style="
                background:var(--bg-surface);
                border:1px solid var(--border-subtle);
                border-radius:18px;
                padding:30px 20px;
                text-align:center;
            "
        >

            <i
                class="fa-solid fa-comments"
                style="
                    font-size:30px;
                    color:var(--electric-blue-bright);
                    margin-bottom:12px;
                "
            ></i>

            <h3
                style="
                    margin:0 0 7px;
                    font-family:var(--font-display);
                "
            >
                Group Chat
            </h3>

            <p
                style="
                    margin:0;
                    color:var(--text-muted);
                    font-size:13px;
                "
            >
                Group chat is ready for this community.
            </p>

            <button
                id="openGroupChatButton"
                class="btn-join-leave"
                style="margin:18px auto 0;"
            >
                <i class="fa-solid fa-message"></i>
                Open Chat
            </button>

        </div>
    `;

    const button =
        document.getElementById(
            "openGroupChatButton"
        );

    if (button) {

        button.addEventListener(
            "click",
            () => {

                window.location.href =
                    `group-chat.html?groupId=${encodeURIComponent(
                        currentGroupId
                    )}`;
            }
        );
    }
}


// ============================================================
// SUBSCRIPTION
// ============================================================

function loadSubscription() {

    const premium =
        Boolean(
            currentGroup.premium ||
            currentGroup.isPremium ||
            currentGroup.premiumGroup ||
            currentGroup.subscriptionRequired
        );

    if (!premium) {

        subscriptionTab.innerHTML =
            `
            <div class="sidebar-card">

                <h3>
                    <i class="fa-solid fa-circle-check"></i>
                    Free Group
                </h3>

                <p
                    style="
                        color:var(--text-secondary);
                        font-size:13px;
                        line-height:1.6;
                    "
                >
                    This group does not require a subscription.
                </p>

            </div>
            `;

        return;
    }

    const price =
        currentGroup.subscriptionPrice ||
        currentGroup.price ||
        currentGroup.monthlyPrice ||
        1500;

    subscriptionTab.innerHTML =
        `
        <div class="sidebar-card">

            <h3>
                <i
                    class="fa-solid fa-crown"
                    style="color:var(--gold-accent);"
                ></i>
                Premium Subscription
            </h3>

            <p
                style="
                    color:var(--text-secondary);
                    font-size:13px;
                    line-height:1.6;
                "
            >
                This is a premium VitalStar group.
            </p>

            <div
                style="
                    font-family:var(--font-mono);
                    font-size:25px;
                    margin:18px 0;
                "
            >
                ₦${formatNumber(price)}
            </div>

            ${
                isMember
                    ? `
                        <div
                            style="
                                color:var(--success);
                                font-size:13px;
                            "
                        >
                            <i class="fa-solid fa-check"></i>
                            You are already a member.
                        </div>
                    `
                    : `
                        <button
                            id="subscribeGroupBtn"
                            class="btn-join-leave"
                        >
                            <i class="fa-solid fa-crown"></i>
                            Subscribe
                        </button>
                    `
            }

        </div>
        `;

    const subscribeBtn =
        document.getElementById(
            "subscribeGroupBtn"
        );

    if (subscribeBtn) {

        subscribeBtn.addEventListener(
            "click",
            () => {

                showToast(
                    "Subscription payment can be connected here.",
                    "info"
                );
            }
        );
    }
}


// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {

    if (!isOwner && !isAdmin) {

        settingsTab.innerHTML =
            errorHTML(
                "You do not have permission to view group settings."
            );

        return;
    }

    settingsTab.innerHTML =
        `
        <div class="sidebar-card">

            <h3>
                <i class="fa-solid fa-gear"></i>
                Group Settings
            </h3>

            <p
                style="
                    color:var(--text-secondary);
                    font-size:13px;
                    line-height:1.6;
                "
            >
                Group management settings are available to
                owners and administrators.
            </p>

            <button
                id="editGroupButton"
                class="btn-join-leave"
                style="margin-top:14px;"
            >
                <i class="fa-solid fa-pen"></i>
                Edit Group
            </button>

        </div>
        `;

    const editBtn =
        document.getElementById(
            "editGroupButton"
        );

    if (editBtn) {

        editBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    `create-group.html?edit=${encodeURIComponent(
                        currentGroupId
                    )}`;
            }
        );
    }
}


// ============================================================
// RULES
// ============================================================

function renderRules() {

    const rules =
        currentGroup.rules ||
        currentGroup.groupRules ||
        [];

    rulesListDisplay.innerHTML = "";

    if (!Array.isArray(rules) || !rules.length) {

        rulesEmptyDisplay.style.display =
            "block";

        return;
    }

    rulesEmptyDisplay.style.display =
        "none";

    rules.forEach((rule) => {

        const li =
            document.createElement("li");

        if (typeof rule === "string") {

            li.textContent = rule;

        } else {

            li.textContent =
                rule.text ||
                rule.title ||
                rule.description ||
                "Group rule";
        }

        rulesListDisplay.appendChild(li);
    });
}


// ============================================================
// ADMINS / MODERATORS
// ============================================================

async function renderAdmins() {

    adminsList.innerHTML = "";

    const ownerId =
        currentGroup.ownerId ||
        currentGroup.ownerUID ||
        currentGroup.ownerUid ||
        currentGroup.createdBy ||
        currentGroup.creatorId;

    const adminIds =
        normalizeIdArray(
            currentGroup.admins ||
            currentGroup.adminIds
        );

    const moderatorIds =
        normalizeIdArray(
            currentGroup.moderators ||
            currentGroup.moderatorIds
        );

    const ids = [
        ...new Set(
            [
                ownerId,
                ...adminIds,
                ...moderatorIds
            ].filter(Boolean)
        )
    ];

    if (!ids.length) {

        adminsEmptyDisplay.style.display =
            "block";

        return;
    }

    adminsEmptyDisplay.style.display =
        "none";

    for (const uid of ids.slice(0, 20)) {

        try {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        USERS_COLLECTION,
                        uid
                    )
                );

            const user =
                userSnap.exists()
                    ? userSnap.data()
                    : {};

            const name =
                user.fullName ||
                user.name ||
                user.displayName ||
                "VitalStar Member";

            const photo =
                user.photoURL ||
                user.profilePhoto ||
                "";

            let role = "Moderator";

            if (uid === ownerId) {
                role = "Owner";
            } else if (adminIds.includes(uid)) {
                role = "Admin";
            }

            const row =
                document.createElement("div");

            row.className =
                "admin-row";

            row.innerHTML = `

                <div
                    class="admin-avatar"
                    style="
                        ${
                            photo
                                ? `background-image:url("${escapeCSSUrl(photo)}");`
                                : ""
                        }
                    "
                >
                    ${
                        photo
                            ? ""
                            : escapeHTML(
                                name
                                    .charAt(0)
                                    .toUpperCase()
                            )
                    }
                </div>

                <div class="admin-info">

                    <div class="admin-name">
                        ${escapeHTML(name)}
                    </div>

                    <div class="admin-role">
                        ${escapeHTML(role)}
                    </div>

                </div>
            `;

            adminsList.appendChild(row);

        } catch (error) {

            console.warn(
                "Admin profile error:",
                error
            );
        }
    }
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

    tabs.forEach((button) => {

        button.addEventListener(
            "click",
            async () => {

                const tab =
                    button.dataset.tab;

                if (!tab) return;

                if (
                    tab === "settings" &&
                    !isOwner &&
                    !isAdmin
                ) {
                    return;
                }

                currentTab = tab;

                tabs.forEach(
                    btn =>
                        btn.classList.toggle(
                            "is-active",
                            btn === button
                        )
                );

                document
                    .querySelectorAll(".tab-panel")
                    .forEach(panel => {

                        panel.classList.toggle(
                            "is-active",
                            panel.dataset.panel === tab
                        );
                    });

                await loadTab(tab);
            }
        );
    });
}


// ============================================================
// LOAD TAB
// ============================================================

async function loadTab(tab) {

    switch (tab) {

        case "posts":
            await loadPosts();
            break;

        case "members":
            await loadMembers();
            break;

        case "chat":
            await loadChat();
            break;

        case "subscription":
            loadSubscription();
            break;

        case "settings":
            loadSettings();
            break;

        default:
            break;
    }
}


// ============================================================
// NOTIFICATIONS
// ============================================================

async function loadNotifications() {

    if (!currentUser) return;

    notificationsList.innerHTML =
        `<p class="notifications-empty">
            Loading notifications…
        </p>`;

    try {

        const notificationsRef =
            collection(
                db,
                NOTIFICATIONS_COLLECTION
            );

        let snapshot;

        try {

            snapshot = await getDocs(
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
                )
            );

        } catch (error) {

            console.warn(
                "Ordered notifications query failed:",
                error
            );

            snapshot = await getDocs(
                query(
                    notificationsRef,
                    where(
                        "receiverId",
                        "==",
                        currentUser.uid
                    ),
                    limit(20)
                )
            );
        }

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

        const notifications =
            snapshot.docs.map(
                d => ({
                    id: d.id,
                    ...d.data()
                })
            );

        const unread =
            notifications.some(
                n => !n.read
            );

        notifUnreadDot.classList.toggle(
            "is-visible",
            unread
        );

        notificationsList.innerHTML =
            notifications
                .map(renderNotification)
                .join("");

    } catch (error) {

        console.error(
            "NOTIFICATION ERROR:",
            error
        );

        notificationsList.innerHTML =
            `<p class="notifications-empty">
                Unable to load notifications.
            </p>`;
    }
}


// ============================================================
// NOTIFICATION RENDER
// ============================================================

function renderNotification(notification) {

    const text =
        notification.message ||
        notification.text ||
        "You have a new notification.";

    const type =
        notification.type ||
        "general";

    const icon =
        type === "new_member"
            ? "fa-user-plus"
            : type === "comment"
            ? "fa-comment"
            : type === "like"
            ? "fa-heart"
            : "fa-bell";

    return `
        <div class="notification-item">

            <div class="notification-item__icon">
                <i class="fa-solid ${icon}"></i>
            </div>

            <div>

                <div class="notification-item__text">
                    ${escapeHTML(text)}
                </div>

                <div class="notification-item__time">
                    ${formatDate(notification.createdAt)}
                </div>

            </div>

        </div>
    `;
}


// ============================================================
// NOTIFY OWNER
// ============================================================

async function notifyGroupOwner(type, message) {

    const ownerId =
        currentGroup?.ownerId ||
        currentGroup?.ownerUID ||
        currentGroup?.ownerUid ||
        currentGroup?.createdBy ||
        currentGroup?.creatorId;

    if (!ownerId) return;

    if (ownerId === currentUser?.uid) {
        return;
    }

    try {

        await addDoc(
            collection(
                db,
                NOTIFICATIONS_COLLECTION
            ),
            {
                receiverId: ownerId,

                senderId:
                    currentUser?.uid || null,

                groupId:
                    currentGroupId,

                type,

                message,

                read: false,

                createdAt:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.warn(
            "Could not create notification:",
            error
        );
    }
}


// ============================================================
// SHARE
// ============================================================

async function shareGroup() {

    const name =
        currentGroup?.name ||
        currentGroup?.title ||
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
                    `Join ${name} on VitalStar.`,
                url
            });

            return;
        }

        await navigator.clipboard.writeText(
            url
        );

        showToast(
            "Group link copied!",
            "success"
        );

    } catch (error) {

        console.warn(
            "Share cancelled or failed:",
            error
        );
    }
}


// ============================================================
// INVITE
// ============================================================

async function inviteMembers() {

    const url =
        window.location.href;

    try {

        await navigator.clipboard.writeText(
            url
        );

        showToast(
            "Invite link copied!",
            "success"
        );

    } catch {

        showToast(
            "Copy this page URL to invite members.",
            "info"
        );
    }
}


// ============================================================
// COVER EDIT
// ============================================================

function editCover() {

    if (!isOwner && !isAdmin) {
        return;
    }

    showToast(
        "Cover editing can be connected to your group editor.",
        "info"
    );
}


// ============================================================
// NAV AVATAR
// ============================================================

async function loadCurrentUserAvatar() {

    if (!currentUser || !navUserAvatar) {
        return;
    }

    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    USERS_COLLECTION,
                    currentUser.uid
                )
            );

        const user =
            userSnap.exists()
                ? userSnap.data()
                : {};

        const photo =
            user.photoURL ||
            user.profilePhoto ||
            user.avatar ||
            currentUser.photoURL ||
            "";

        if (photo) {

            navUserAvatar.style.backgroundImage =
                `url("${escapeCSSUrl(photo)}")`;

            navUserAvatar.innerHTML = "";

        } else {

            navUserAvatar.innerHTML =
                `<i class="fa-solid fa-user"></i>`;
        }

    } catch (error) {

        console.warn(
            "Could not load nav avatar:",
            error
        );
    }
}


// ============================================================
// UI SETUP
// ============================================================

function setupUI() {

    setupTabs();

    // Join / Leave
    if (joinLeaveBtn) {

        joinLeaveBtn.addEventListener(
            "click",
            async () => {

                if (isMember) {
                    await leaveGroup();
                } else {
                    await joinGroup();
                }
            }
        );
    }

    // Share
    if (shareBtn) {

        shareBtn.addEventListener(
            "click",
            shareGroup
        );
    }

    // Invite
    if (inviteBtn) {

        inviteBtn.addEventListener(
            "click",
            inviteMembers
        );
    }

    // Cover
    if (coverEditBtn) {

        coverEditBtn.addEventListener(
            "click",
            editCover
        );
    }

    // Notifications
    if (notificationBellBtn) {

        notificationBellBtn.addEventListener(
            "click",
            () => {

                notificationsPanel.classList.toggle(
                    "is-visible"
                );
            }
        );
    }

    if (closeNotificationsBtn) {

        closeNotificationsBtn.addEventListener(
            "click",
            () => {

                notificationsPanel.classList.remove(
                    "is-visible"
                );
            }
        );
    }

    // Close notification panel when clicking outside
    document.addEventListener(
        "click",
        (event) => {

            if (
                !notificationsPanel ||
                !notificationBellBtn
            ) {
                return;
            }

            if (
                notificationsPanel.contains(
                    event.target
                ) ||
                notificationBellBtn.contains(
                    event.target
                )
            ) {
                return;
            }

            notificationsPanel.classList.remove(
                "is-visible"
            );
        }
    );
}


// ============================================================
// LOADER
// ============================================================

function showLoader(show) {

    if (!pageLoader) return;

    pageLoader.classList.toggle(
        "is-hidden",
        !show
    );
}


// ============================================================
// NOT FOUND
// ============================================================

function showNotFound() {

    showLoader(false);

    if (groupPageContent) {

        groupPageContent.classList.remove(
            "is-visible"
        );
    }

    if (groupNotFoundState) {

        groupNotFoundState.classList.add(
            "is-visible"
        );
    }
}


// ============================================================
// JOIN BUTTON LOADING
// ============================================================

function setJoinButtonLoading(loading) {

    if (!joinLeaveBtn) return;

    joinLeaveBtn.disabled = loading;

    if (loading) {

        joinLeaveBtn.innerHTML =
            `
            <i
                class="fa-solid fa-spinner fa-spin"
            ></i>
            Please wait…
            `;

    } else {

        renderJoinButton();
    }
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "info"
) {

    if (!toastContainer) {
        alert(message);
        return;
    }

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

    toast.innerHTML =
        `
        <i class="fa-solid ${icon}"></i>

        <div>
            ${escapeHTML(message)}
        </div>
        `;

    toastContainer.appendChild(toast);

    setTimeout(() => {

        toast.classList.add(
            "is-leaving"
        );

        setTimeout(
            () => toast.remove(),
            300
        );

    }, 3500);
}


// ============================================================
// HTML HELPERS
// ============================================================

function loadingHTML(text) {

    return `
        <div class="tab-panel-placeholder">

            <span class="spinner-sm"></span>

            ${escapeHTML(text)}

        </div>
    `;
}


function emptyHTML(
    icon,
    title,
    text
) {

    return `
        <div
            style="
                padding:60px 20px;
                text-align:center;
                color:var(--text-muted);
            "
        >

            <i
                class="fa-solid ${icon}"
                style="
                    font-size:32px;
                    margin-bottom:14px;
                    color:var(--electric-blue-bright);
                "
            ></i>

            <h3
                style="
                    margin:0 0 7px;
                    color:var(--text-primary);
                    font-family:var(--font-display);
                "
            >
                ${escapeHTML(title)}
            </h3>

            <p
                style="
                    margin:0;
                    font-size:13px;
                "
            >
                ${escapeHTML(text)}
            </p>

        </div>
    `;
}


function errorHTML(text) {

    return `
        <div
            style="
                padding:45px 20px;
                text-align:center;
                color:var(--danger);
            "
        >

            <i
                class="fa-solid fa-circle-exclamation"
                style="
                    font-size:28px;
                    margin-bottom:12px;
                "
            ></i>

            <p
                style="
                    margin:0;
                    font-size:13px;
                "
            >
                ${escapeHTML(text)}
            </p>

        </div>
    `;
}


// ============================================================
// NUMBER HELPERS
// ============================================================

function numberValue(...values) {

    for (const value of values) {

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value;
        }

        if (
            typeof value === "string" &&
            value.trim() !== "" &&
            !Number.isNaN(Number(value))
        ) {
            return Number(value);
        }
    }

    return 0;
}


function formatNumber(value) {

    const number =
        Number(value) || 0;

    return number.toLocaleString();
}


// ============================================================
// DATE HELPERS
// ============================================================

function timestampValue(value) {

    if (!value) return 0;

    if (
        typeof value.toMillis === "function"
    ) {
        return value.toMillis();
    }

    if (
        value.seconds !== undefined
    ) {
        return (
            Number(value.seconds) * 1000 +
            Number(value.nanoseconds || 0) / 1000000
        );
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "string") {

        const time =
            new Date(value).getTime();

        return Number.isNaN(time)
            ? 0
            : time;
    }

    return 0;
}


function formatDate(value) {

    const timestamp =
        timestampValue(value);

    if (!timestamp) {
        return "recently";
    }

    try {

        return new Intl.DateTimeFormat(
            undefined,
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        ).format(
            new Date(timestamp)
        );

    } catch {

        return "recently";
    }
}


// ============================================================
// ID HELPERS
// ============================================================

function normalizeIdArray(value) {

    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {

        return value
            .map(item => {

                if (
                    typeof item === "string"
                ) {
                    return item;
                }

                if (
                    item &&
                    typeof item === "object"
                ) {

                    return (
                        item.uid ||
                        item.userId ||
                        item.id ||
                        null
                    );
                }

                return null;
            })
            .filter(Boolean);
    }

    if (
        typeof value === "object"
    ) {

        return Object.keys(value);
    }

    return [];
}


// ============================================================
// SECURITY / OUTPUT HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeCSSUrl(value) {

    return String(value ?? "")
        .replaceAll("\\", "")
        .replaceAll('"', '\\"')
        .replaceAll(")", "\\)");
}


// ============================================================
// INITIAL DEFAULT TAB
// ============================================================

async function initializeDefaultTab() {

    if (!currentGroup) {
        return;
    }

    await loadTab("posts");
}


// ============================================================
// START DEFAULT TAB AFTER GROUP LOAD
// ============================================================

// We override the original loadGroup completion safely here
const originalLoadGroupReference = loadGroup;


// ============================================================
// READY LOG
// ============================================================

console.log(
    "VitalStar group.js loaded successfully."
);