// ============================================================
// VITALSTAR — notifications-page.js
// General notification system
//
// Supports:
// likes
// comments
// follows
// messages
// friend requests
// friend accepted
// group joins
// group join requests
// group invites
// group posts
// group post likes
// group post comments
// group messages
// group mentions
// group admin actions
// group subscriptions
// etc.
// ============================================================

import { auth, db } from "./firebase.js";

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    writeBatch,
    deleteDoc,
    runTransaction,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// DARK THEME
// ============================================================

const darkStyle = document.createElement("style");

darkStyle.textContent = `
    body {
        background:#080b14 !important;
        color:#f5f7ff !important;
    }

    #notifications {
        background:#080b14;
        color:#f5f7ff;
    }

    #markAllReadLink {
        color:#63a4ff !important;
    }

    .notification-card {
        background:#111827 !important;
        color:#f5f7ff !important;
        border:1px solid #202a3d !important;
        border-radius:14px;
        margin:8px 0;
        padding:13px;
        transition:background .2s ease,
                   border-color .2s ease,
                   transform .15s ease;
    }

    .notification-card:hover {
        background:#151e31 !important;
        border-color:#315b91 !important;
    }

    .notification-card.is-unread {
        background:#101d31 !important;
        border-color:#2463a8 !important;
    }

    .notification-card small {
        color:#8f9bb3 !important;
    }

    .notification-card .notification-text {
        color:#f5f7ff !important;
    }

    .notification-card .notification-text span {
        color:#d9e0ef !important;
    }

    .notification-card b {
        color:#ffffff !important;
    }

    .unread-dot {
        color:#4da3ff !important;
    }

    .loading {
        color:#9aa7bd !important;
        background:#0d1220 !important;
        padding:20px;
        border-radius:14px;
        text-align:center;
    }
`;

document.head.appendChild(darkStyle);


// ============================================================
// DOM
// ============================================================

const notifications =
    document.getElementById("notifications");

if (!notifications) {
    console.error(
        "Notifications container not found."
    );
}


// ============================================================
// MARK ALL AS READ
// ============================================================

let markAllReadLink =
    document.getElementById("markAllReadLink");

if (
    !markAllReadLink &&
    notifications
) {

    markAllReadLink =
        document.createElement("a");

    markAllReadLink.href = "#";
    markAllReadLink.id = "markAllReadLink";
    markAllReadLink.textContent =
        "Mark all as read";

    markAllReadLink.style.cssText = `
        display:block;
        text-align:right;
        padding:8px 12px;
        color:#63a4ff;
        text-decoration:none;
        font-size:14px;
        cursor:pointer;
    `;

    notifications.parentNode.insertBefore(
        markAllReadLink,
        notifications
    );
}


// ============================================================
// MARK ALL READ
// ============================================================

if (markAllReadLink) {

    markAllReadLink.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            const user =
                auth.currentUser;

            if (!user) {
                return;
            }

            try {

                const unreadQuery =
                    query(
                        collection(
                            db,
                            "notifications"
                        ),

                        where(
                            "receiverId",
                            "==",
                            user.uid
                        ),

                        where(
                            "read",
                            "==",
                            false
                        )
                    );

                const snapshot =
                    await getDocs(
                        unreadQuery
                    );

                if (snapshot.empty) {
                    return;
                }

                const batch =
                    writeBatch(db);

                snapshot.forEach(
                    notificationDoc => {

                        batch.update(
                            notificationDoc.ref,
                            {
                                read: true
                            }
                        );

                    }
                );

                await batch.commit();

            } catch (error) {

                console.error(
                    "Failed to mark all as read:",
                    error
                );

                alert(
                    "Failed to mark notifications as read."
                );

            }

        }
    );
}


// ============================================================
// ICON
// ============================================================

function getNotificationIcon(type) {

    switch (type) {

        case "like":
            return "❤️";

        case "comment":
            return "💬";

        case "follow":
            return "👤";

        case "message":
            return "📩";


        // ====================================================
        // FRIEND SYSTEM
        // ====================================================

        case "friend_request":
            return "👥";

        case "friend_accepted":
            return "🤝";


        // ====================================================
        // GROUP SYSTEM
        // ====================================================

        case "group":
            return "👥";

        case "group_join":
            return "👋";

        case "group_join_request":
            return "🙋";

        case "group_invite":
            return "📨";

        case "group_post":
            return "📝";

        case "group_post_like":
            return "❤️";

        case "group_post_comment":
            return "💬";

        case "group_message":
            return "💬";

        case "group_admin":
            return "🛡️";

        case "group_member":
            return "👥";

        case "group_mention":
            return "🔔";

        case "group_subscription":
            return "⭐";

        case "mention":
            return "🔔";

        case "system":
            return "⚙️";

        default:
            return "🔔";
    }
}


// ============================================================
// DATE
// ============================================================

function formatNotificationTime(timestamp) {

    if (!timestamp) {
        return "Just now";
    }

    try {

        if (
            typeof timestamp.toDate ===
            "function"
        ) {

            return timestamp
                .toDate()
                .toLocaleString();

        }

        return "Just now";

    } catch {

        return "Just now";
    }
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// ============================================================
// TEXT
// ============================================================

function getNotificationText(notification) {

    // --------------------------------------------------------
    // FRIEND REQUEST
    // --------------------------------------------------------

    if (
        notification.type ===
        "friend_request"
    ) {

        return (
            notification.text ||
            notification.message ||
            `${notification.senderName || "Someone"} sent you a friend request.`
        );
    }


    // --------------------------------------------------------
    // FRIEND ACCEPTED
    // --------------------------------------------------------

    if (
        notification.type ===
        "friend_accepted"
    ) {

        return (
            notification.text ||
            notification.message ||
            `${notification.senderName || "Someone"} accepted your friend request.`
        );
    }


    return (
        notification.text ||
        notification.message ||
        "New notification"
    );
}


// ============================================================
// SENDER PHOTO
// ============================================================

function getSenderPhoto(notification) {

    return (
        notification.senderPhoto ||
        notification.senderPhotoURL ||
        notification.photoURL ||
        "https://via.placeholder.com/50"
    );
}


// ============================================================
// GROUP POST NOTIFICATION CHECK
// ============================================================

function isGroupPostNotification(notification) {

    return (
        Boolean(notification.groupId) &&
        Boolean(notification.postId) &&
        [
            "group_post",
            "group_post_like",
            "group_post_comment",
            "group_mention"
        ].includes(notification.type)
    );
}


// ============================================================
// DESTINATION
// ============================================================

function getNotificationDestination(
    notification
) {

    // --------------------------------------------------------
    // FRIEND REQUEST
    // --------------------------------------------------------

    if (
        notification.type ===
        "friend_request"
    ) {

        return "myfriends.html?tab=requests";
    }


    // --------------------------------------------------------
    // FRIEND ACCEPTED
    // --------------------------------------------------------

    if (
        notification.type ===
        "friend_accepted"
    ) {

        return "myfriends.html?tab=friends";
    }


    // --------------------------------------------------------
    // GROUP POST
    // --------------------------------------------------------

    if (
        isGroupPostNotification(
            notification
        )
    ) {

        return (
            `group.html?id=${
                encodeURIComponent(
                    notification.groupId
                )
            }&tab=posts&postId=${
                encodeURIComponent(
                    notification.postId
                )
            }`
        );
    }


    // --------------------------------------------------------
    // GROUP CHAT
    // --------------------------------------------------------

    if (
        notification.groupId &&
        notification.chatId
    ) {

        return (
            `group.html?id=${
                encodeURIComponent(
                    notification.groupId
                )
            }&tab=chat`
        );
    }


    // --------------------------------------------------------
    // GROUP JOIN REQUEST
    // --------------------------------------------------------

    if (
        notification.type ===
        "group_join_request"
    ) {

        return (
            `group.html?id=${
                encodeURIComponent(
                    notification.groupId
                )
            }&tab=members`
        );
    }


    // --------------------------------------------------------
    // OTHER GROUP NOTIFICATION
    // --------------------------------------------------------

    if (
        notification.groupId
    ) {

        return (
            `group.html?id=${
                encodeURIComponent(
                    notification.groupId
                )
            }`
        );
    }


    // --------------------------------------------------------
    // NORMAL POST
    // --------------------------------------------------------

    if (
        notification.postId
    ) {

        return (
            `comments.html?postId=${
                encodeURIComponent(
                    notification.postId
                )
            }`
        );
    }


    // --------------------------------------------------------
    // CHAT
    // --------------------------------------------------------

    if (
        notification.chatId ||
        notification.conversationId
    ) {

        const chatId =
            notification.chatId ||
            notification.conversationId;

        return (
            `chat.html?id=${
                encodeURIComponent(chatId)
            }`
        );
    }


    // --------------------------------------------------------
    // CUSTOM URL
    // --------------------------------------------------------

    if (
        notification.url
    ) {

        return notification.url;
    }


    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    if (
        notification.senderId
    ) {

        return (
            `profile.html?uid=${
                encodeURIComponent(
                    notification.senderId
                )
            }`
        );
    }


    return null;
}


// ============================================================
// CURRENT USER CAN MANAGE GROUP
// ============================================================

async function canManageGroup(
    groupId,
    uid
) {

    if (!groupId || !uid) {
        return false;
    }

    try {

        const groupSnap =
            await getDoc(
                doc(
                    db,
                    "groups",
                    groupId
                )
            );

        if (!groupSnap.exists()) {
            return false;
        }

        const group =
            groupSnap.data();

        const ownerId =
            group.ownerId ||
            group.ownerUid ||
            group.createdBy ||
            group.creatorId;

        if (
            ownerId === uid
        ) {
            return true;
        }

        const memberSnap =
            await getDoc(
                doc(
                    db,
                    "groups",
                    groupId,
                    "members",
                    uid
                )
            );

        if (!memberSnap.exists()) {
            return false;
        }

        const member =
            memberSnap.data();

        return (
            member.status === "active" &&
            [
                "owner",
                "admin",
                "moderator"
            ].includes(
                member.role
            )
        );

    } catch (error) {

        console.error(
            "Permission check error:",
            error
        );

        return false;
    }
}


// ============================================================
// APPROVE JOIN REQUEST
// ============================================================

async function approveJoinRequest(
    notificationDoc,
    notification,
    card
) {

    const currentUser =
        auth.currentUser;

    if (!currentUser) {
        return;
    }

    const groupId =
        notification.groupId;

    const applicantId =
        notification.requesterId ||
        notification.applicantId ||
        notification.senderId;

    if (
        !groupId ||
        !applicantId
    ) {

        alert(
            "This join request is missing required information."
        );

        return;
    }

    const allowed =
        await canManageGroup(
            groupId,
            currentUser.uid
        );

    if (!allowed) {

        alert(
            "You do not have permission to approve this request."
        );

        return;
    }

    try {

        const memberRef =
            doc(
                db,
                "groups",
                groupId,
                "members",
                applicantId
            );

        const groupRef =
            doc(
                db,
                "groups",
                groupId
            );

        let approved = false;

        await runTransaction(
            db,
            async transaction => {

                const memberSnap =
                    await transaction.get(
                        memberRef
                    );

                if (!memberSnap.exists()) {

                    throw new Error(
                        "Join request no longer exists."
                    );
                }

                const member =
                    memberSnap.data();

                if (
                    member.status !==
                    "pending"
                ) {

                    throw new Error(
                        "This request has already been processed."
                    );
                }

                transaction.update(
                    memberRef,
                    {
                        status: "active",
                        role: "member",
                        joinedAt:
                            serverTimestamp()
                    }
                );

                transaction.update(
                    groupRef,
                    {
                        memberCount:
                            increment(1)
                    }
                );

                approved = true;
            }
        );

        if (!approved) {
            return;
        }

        await updateDoc(
            notificationDoc.ref,
            {
                read: true,
                requestStatus: "approved",
                processedAt:
                    serverTimestamp(),
                processedBy:
                    currentUser.uid
            }
        );

        let groupName =
            notification.groupName ||
            "the group";

        const groupSnap =
            await getDoc(
                groupRef
            );

        if (groupSnap.exists()) {

            groupName =
                groupSnap.data().name ||
                groupName;
        }

        await addDoc(
            collection(
                db,
                "notifications"
            ),
            {
                receiverId:
                    applicantId,

                recipientId:
                    applicantId,

                senderId:
                    currentUser.uid,

                senderName:
                    currentUser.displayName ||
                    "Group Admin",

                senderPhoto:
                    currentUser.photoURL ||
                    "",

                senderPhotoURL:
                    currentUser.photoURL ||
                    "",

                type:
                    "group_join",

                text:
                    `Your request to join ${groupName} was approved.`,

                message:
                    `Your request to join ${groupName} was approved.`,

                groupId,

                groupName,

                read: false,

                createdAt:
                    serverTimestamp(),

                url:
                    `group.html?id=${encodeURIComponent(
                        groupId
                    )}`
            }
        );

        const actionArea =
            card.querySelector(
                ".join-request-actions"
            );

        if (actionArea) {

            actionArea.innerHTML = `
                <div style="
                    color:#4ade80;
                    font-size:13px;
                    font-weight:600;
                    padding-top:8px;
                ">
                    ✓ Request approved
                </div>
            `;
        }

    } catch (error) {

        console.error(
            "Approve join request error:",
            error
        );

        alert(
            error.message ||
            "Could not approve this request."
        );
    }
}


// ============================================================
// REJECT / CANCEL JOIN REQUEST
// ============================================================

async function rejectJoinRequest(
    notificationDoc,
    notification,
    card
) {

    const currentUser =
        auth.currentUser;

    if (!currentUser) {
        return;
    }

    const groupId =
        notification.groupId;

    const applicantId =
        notification.requesterId ||
        notification.applicantId ||
        notification.senderId;

    if (
        !groupId ||
        !applicantId
    ) {

        alert(
            "This join request is missing required information."
        );

        return;
    }

    const allowed =
        await canManageGroup(
            groupId,
            currentUser.uid
        );

    if (!allowed) {

        alert(
            "You do not have permission to reject this request."
        );

        return;
    }

    try {

        const memberRef =
            doc(
                db,
                "groups",
                groupId,
                "members",
                applicantId
            );

        const memberSnap =
            await getDoc(
                memberRef
            );

        if (
            memberSnap.exists() &&
            memberSnap.data().status ===
                "pending"
        ) {

            await deleteDoc(
                memberRef
            );
        }

        await updateDoc(
            notificationDoc.ref,
            {
                read: true,
                requestStatus: "rejected",
                processedAt:
                    serverTimestamp(),
                processedBy:
                    currentUser.uid
            }
        );

        const groupSnap =
            await getDoc(
                doc(
                    db,
                    "groups",
                    groupId
                )
            );

        const groupName =
            groupSnap.exists()
                ? (
                    groupSnap.data().name ||
                    notification.groupName ||
                    "the group"
                )
                : (
                    notification.groupName ||
                    "the group"
                );

        await addDoc(
            collection(
                db,
                "notifications"
            ),
            {
                receiverId:
                    applicantId,

                recipientId:
                    applicantId,

                senderId:
                    currentUser.uid,

                senderName:
                    currentUser.displayName ||
                    "Group Admin",

                senderPhoto:
                    currentUser.photoURL ||
                    "",

                senderPhotoURL:
                    currentUser.photoURL ||
                    "",

                type:
                    "group_join",

                text:
                    `Your request to join ${groupName} was declined.`,

                message:
                    `Your request to join ${groupName} was declined.`,

                groupId,

                groupName,

                read: false,

                createdAt:
                    serverTimestamp(),

                url:
                    `group.html?id=${encodeURIComponent(
                        groupId
                    )}`
            }
        );

        const actionArea =
            card.querySelector(
                ".join-request-actions"
            );

        if (actionArea) {

            actionArea.innerHTML = `
                <div style="
                    color:#f87171;
                    font-size:13px;
                    font-weight:600;
                    padding-top:8px;
                ">
                    ✕ Request declined
                </div>
            `;
        }

    } catch (error) {

        console.error(
            "Reject join request error:",
            error
        );

        alert(
            error.message ||
            "Could not reject this request."
        );
    }
}


// ============================================================
// JOIN REQUEST ACTIONS
// ============================================================

function renderJoinRequestActions(
    card,
    notificationDoc,
    notification
) {

    if (
        notification.type !==
        "group_join_request"
    ) {
        return;
    }

    const actionArea =
        document.createElement("div");

    actionArea.className =
        "join-request-actions";

    actionArea.style.cssText = `
        display:flex;
        gap:8px;
        margin-top:9px;
        flex-wrap:wrap;
    `;

    if (
        notification.requestStatus ===
        "approved"
    ) {

        actionArea.innerHTML = `
            <span style="
                color:#4ade80;
                font-size:13px;
                font-weight:600;
            ">
                ✓ Request approved
            </span>
        `;

        card.appendChild(
            actionArea
        );

        return;
    }

    if (
        notification.requestStatus ===
        "rejected"
    ) {

        actionArea.innerHTML = `
            <span style="
                color:#f87171;
                font-size:13px;
                font-weight:600;
            ">
                ✕ Request declined
            </span>
        `;

        card.appendChild(
            actionArea
        );

        return;
    }

    const approveBtn =
        document.createElement("button");

    approveBtn.type = "button";

    approveBtn.textContent =
        "Approve";

    approveBtn.style.cssText = `
        border:0;
        border-radius:8px;
        padding:7px 13px;
        background:#16803c;
        color:white;
        font-size:13px;
        font-weight:600;
        cursor:pointer;
    `;

    const rejectBtn =
        document.createElement("button");

    rejectBtn.type = "button";

    rejectBtn.textContent =
        "Cancel";

    rejectBtn.style.cssText = `
        border:1px solid #3b465c;
        border-radius:8px;
        padding:7px 13px;
        background:#151c2b;
        color:#f87171;
        font-size:13px;
        font-weight:600;
        cursor:pointer;
    `;

    approveBtn.addEventListener(
        "click",
        async event => {

            event.stopPropagation();

            approveBtn.disabled = true;
            rejectBtn.disabled = true;

            await approveJoinRequest(
                notificationDoc,
                notification,
                card
            );

            approveBtn.disabled = false;
            rejectBtn.disabled = false;
        }
    );

    rejectBtn.addEventListener(
        "click",
        async event => {

            event.stopPropagation();

            const confirmed =
                window.confirm(
                    "Reject this join request?"
                );

            if (!confirmed) {
                return;
            }

            approveBtn.disabled = true;
            rejectBtn.disabled = true;

            await rejectJoinRequest(
                notificationDoc,
                notification,
                card
            );
        }
    );

    actionArea.append(
        approveBtn,
        rejectBtn
    );

    card.appendChild(
        actionArea
    );
}


// ============================================================
// OPEN NOTIFICATION
// ============================================================

async function openNotification(
    notificationDoc,
    notification
) {

    try {

        await updateDoc(
            notificationDoc.ref,
            {
                read: true
            }
        );

        const destination =
            getNotificationDestination(
                notification
            );

        if (destination) {

            window.location.href =
                destination;

            return;
        }

    } catch (error) {

        console.error(
            "Failed to open notification:",
            error
        );

        alert(
            "Failed to open notification."
        );
    }
}


// ============================================================
// RENDER NOTIFICATION
// ============================================================

function renderNotification(
    notificationDoc
) {

    const notification =
        notificationDoc.data();

    const icon =
        getNotificationIcon(
            notification.type
        );

    const time =
        formatNotificationTime(
            notification.createdAt
        );

    const senderName =
        escapeHTML(
            notification.senderName ||
            notification.fullName ||
            "Someone"
        );

    const text =
        escapeHTML(
            getNotificationText(
                notification
            )
        );

    const senderPhoto =
        escapeHTML(
            getSenderPhoto(
                notification
            )
        );

    const card =
        document.createElement("div");

    card.className =
        "notification-card";

    card.style.cursor =
        "pointer";

    if (
        notification.read !== true
    ) {

        card.classList.add(
            "is-unread"
        );
    }


    // ========================================================
    // FRIEND NOTIFICATION LABEL
    // ========================================================

    let friendLabel = "";

    if (
        notification.type ===
        "friend_request"
    ) {

        friendLabel = `
            <div style="
                font-size:12px;
                color:#63a4ff;
                margin-top:5px;
                font-weight:600;
            ">
                👥 Friend request
            </div>
        `;
    }

    if (
        notification.type ===
        "friend_accepted"
    ) {

        friendLabel = `
            <div style="
                font-size:12px;
                color:#7ee787;
                margin-top:5px;
                font-weight:600;
            ">
                🤝 Friends
            </div>
        `;
    }


    // ========================================================
    // GROUP LABEL
    // ========================================================

    let groupLabel = "";

    if (
        notification.groupId &&
        notification.groupName
    ) {

        groupLabel = `
            <div style="
                font-size:12px;
                color:#8f9bb3;
                margin-top:3px;
            ">
                👥 ${escapeHTML(
                    notification.groupName
                )}
            </div>
        `;
    }


    // ========================================================
    // POST LABEL
    // ========================================================

    let postLabel = "";

    if (
        isGroupPostNotification(
            notification
        )
    ) {

        postLabel = `
            <div style="
                font-size:12px;
                color:#8f9bb3;
                margin-top:2px;
            ">
                📝 View post in group
            </div>
        `;

    } else if (
        notification.postId
    ) {

        postLabel = `
            <div style="
                font-size:12px;
                color:#8f9bb3;
                margin-top:2px;
            ">
                📝 View post
            </div>
        `;
    }


    // ========================================================
    // CARD HTML
    // ========================================================

    card.innerHTML = `

        <div style="
            display:flex;
            gap:10px;
            align-items:flex-start;
        ">

            <img
                src="${senderPhoto}"
                alt=""
                style="
                    width:44px;
                    height:44px;
                    border-radius:50%;
                    object-fit:cover;
                    flex-shrink:0;
                    border:1px solid #29354d;
                "
                onerror="
                    this.src='https://via.placeholder.com/50';
                "
            >

            <div
                class="notification-text"
                style="flex:1;"
            >

                <b>
                    ${senderName}
                </b>

                <br>

                <span>
                    ${icon}
                    ${text}
                </span>

                ${friendLabel}

                ${groupLabel}

                ${postLabel}

                <br>

                <small>
                    ${escapeHTML(time)}
                </small>

            </div>

            ${
                notification.read !== true
                    ? `
                        <span
                            class="unread-dot"
                            title="Unread"
                        >
                            ●
                        </span>
                    `
                    : ""
            }

        </div>
    `;


    renderJoinRequestActions(
        card,
        notificationDoc,
        notification
    );


    card.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    ".join-request-actions"
                )
            ) {
                return;
            }

            openNotification(
                notificationDoc,
                notification
            );
        }
    );


    return card;
}


// ============================================================
// AUTH
// ============================================================

auth.onAuthStateChanged(
    user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        if (!notifications) {
            return;
        }


        const q =
            query(
                collection(
                    db,
                    "notifications"
                ),

                where(
                    "receiverId",
                    "==",
                    user.uid
                ),

                orderBy(
                    "createdAt",
                    "desc"
                ),

                limit(50)
            );


        onSnapshot(

            q,

            snapshot => {

                notifications.innerHTML =
                    "";

                if (
                    snapshot.empty
                ) {

                    notifications.innerHTML = `
                        <div
                            class="loading"
                            style="
                                background:#0d1220;
                                color:#9aa7bd;
                                border-radius:14px;
                                padding:25px;
                                text-align:center;
                            "
                        >
                            🔔<br><br>
                            No notifications yet.
                        </div>
                    `;

                    return;
                }


                snapshot.forEach(
                    notificationDoc => {

                        const card =
                            renderNotification(
                                notificationDoc
                            );

                        notifications.appendChild(
                            card
                        );
                    }
                );

            },

            error => {

                console.error(
                    "Notification listener error:",
                    error
                );

                notifications.innerHTML = `
                    <div
                        class="loading"
                        style="
                            background:#0d1220;
                            color:#ff7b7b;
                            border-radius:14px;
                            padding:25px;
                            text-align:center;
                        "
                    >
                        ⚠️<br><br>
                        Unable to load notifications.
                    </div>
                `;
            }
        );
    }
);


// ============================================================
// END OF NOTIFICATIONS-PAGE.JS
// ============================================================