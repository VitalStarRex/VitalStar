// ============================================================
// VITALSTAR — notifications-page.js
// General notification system
//
// Supports:
// likes
// comments
// follows
// messages
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
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    writeBatch,
    runTransaction,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
// MARK ALL AS READ LINK
// ============================================================

let markAllReadLink =
    document.getElementById(
        "markAllReadLink"
    );


if (
    !markAllReadLink &&
    notifications
) {

    markAllReadLink =
        document.createElement("a");

    markAllReadLink.href = "#";

    markAllReadLink.id =
        "markAllReadLink";

    markAllReadLink.textContent =
        "Mark all as read";

    markAllReadLink.style.cssText = `
        display:block;
        text-align:right;
        padding:8px 12px;
        color:#1565c0;
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
// NOTIFICATION ICON
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
// DATE FORMAT
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

    } catch (error) {

        return "Just now";

    }

}


// ============================================================
// SAFE HTML
// ============================================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


// ============================================================
// GET NOTIFICATION TEXT
// ============================================================

function getNotificationText(
    notification
) {

    return (
        notification.text ||
        notification.message ||
        "New notification"
    );

}


// ============================================================
// GET SENDER PHOTO
// ============================================================

function getSenderPhoto(
    notification
) {

    return (
        notification.senderPhoto ||
        notification.senderPhotoURL ||
        notification.photoURL ||
        "https://via.placeholder.com/50"
    );

}


// ============================================================
// IS GROUP POST NOTIFICATION
// ============================================================

function isGroupPostNotification(
    notification
) {

    return Boolean(
        notification.groupId &&
        notification.postId
    );

}


// ============================================================
// GET DESTINATION
// ============================================================

function getNotificationDestination(
    notification
) {

    // --------------------------------------------------------
    // GROUP POST
    // IMPORTANT:
    // Group post notifications MUST stay inside group.html.
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
    // GROUP
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
                encodeURIComponent(
                    chatId
                )
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
// GET GROUP OWNER / ADMIN PERMISSION
// ============================================================

async function canManageJoinRequest(
    notification
) {

    const user =
        auth.currentUser;

    if (
        !user ||
        !notification.groupId
    ) {
        return false;
    }

    try {

        const groupRef =
            doc(
                db,
                "groups",
                notification.groupId
            );

        const groupSnap =
            await getDoc(groupRef);

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
            ownerId === user.uid
        ) {
            return true;
        }


        const memberRef =
            doc(
                db,
                "groups",
                notification.groupId,
                "members",
                user.uid
            );

        const memberSnap =
            await getDoc(memberRef);

        if (!memberSnap.exists()) {
            return false;
        }

        const member =
            memberSnap.data();

        return (
            member.status === "active" &&
            (
                member.role === "admin" ||
                member.role === "moderator"
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
    button
) {

    const user =
        auth.currentUser;

    if (!user) {
        return;
    }

    button.disabled = true;

    try {

        const allowed =
            await canManageJoinRequest(
                notification
            );

        if (!allowed) {

            alert(
                "You do not have permission to approve this request."
            );

            button.disabled = false;

            return;
        }


        const groupId =
            notification.groupId;

        const requesterId =
            notification.senderId;

        if (
            !groupId ||
            !requesterId
        ) {

            throw new Error(
                "Missing group or requester ID."
            );

        }


        const memberRef =
            doc(
                db,
                "groups",
                groupId,
                "members",
                requesterId
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
                    return;
                }


                const member =
                    memberSnap.data();


                if (
                    member.status !== "pending"
                ) {
                    return;
                }


                transaction.update(
                    memberRef,
                    {
                        status: "active",
                        approvedAt:
                            new Date()
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

            alert(
                "This join request is no longer pending."
            );

            button.disabled = false;

            return;
        }


        // ----------------------------------------------------
        // Mark original notification as handled
        // ----------------------------------------------------

        await updateDoc(
            notificationDoc.ref,
            {
                read: true,
                action: "approved",
                actionAt: new Date()
            }
        );


        // ----------------------------------------------------
        // Notify requester
        // ----------------------------------------------------

        await createGeneralNotification({
            receiverId:
                requesterId,

            senderId:
                user.uid,

            senderName:
                user.displayName ||
                "Group Admin",

            senderPhoto:
                user.photoURL || "",

            type:
                "group_join",

            groupId,

            groupName:
                notification.groupName ||
                "the group",

            text:
                `Your request to join ${
                    notification.groupName ||
                    "the group"
                } was approved.`,

            url:
                `group.html?id=${encodeURIComponent(
                    groupId
                )}`
        });


        const card =
            button.closest(
                ".notification-card"
            );

        if (card) {

            const actions =
                card.querySelector(
                    ".join-request-actions"
                );

            if (actions) {
                actions.innerHTML = `
                    <span style="
                        color:#16803c;
                        font-size:13px;
                        font-weight:600;
                    ">
                        ✓ Approved
                    </span>
                `;
            }

        }

    } catch (error) {

        console.error(
            "Approve join request error:",
            error
        );

        alert(
            "Could not approve the join request."
        );

        button.disabled = false;

    }

}


// ============================================================
// REJECT / CANCEL JOIN REQUEST
// ============================================================

async function rejectJoinRequest(
    notificationDoc,
    notification,
    button
) {

    const user =
        auth.currentUser;

    if (!user) {
        return;
    }

    button.disabled = true;

    try {

        const allowed =
            await canManageJoinRequest(
                notification
            );

        if (!allowed) {

            alert(
                "You do not have permission to reject this request."
            );

            button.disabled = false;

            return;
        }


        const groupId =
            notification.groupId;

        const requesterId =
            notification.senderId;


        if (
            !groupId ||
            !requesterId
        ) {

            throw new Error(
                "Missing group or requester ID."
            );

        }


        const memberRef =
            doc(
                db,
                "groups",
                groupId,
                "members",
                requesterId
            );


        const memberSnap =
            await getDoc(
                memberRef
            );


        if (
            memberSnap.exists()
        ) {

            const member =
                memberSnap.data();

            if (
                member.status === "pending"
            ) {

                await deleteDoc(
                    memberRef
                );

            }

        }


        await updateDoc(
            notificationDoc.ref,
            {
                read: true,
                action: "rejected",
                actionAt: new Date()
            }
        );


        // ----------------------------------------------------
        // Notify requester
        // ----------------------------------------------------

        await createGeneralNotification({
            receiverId:
                requesterId,

            senderId:
                user.uid,

            senderName:
                user.displayName ||
                "Group Admin",

            senderPhoto:
                user.photoURL || "",

            type:
                "group_admin",

            groupId,

            groupName:
                notification.groupName ||
                "the group",

            text:
                `Your request to join ${
                    notification.groupName ||
                    "the group"
                } was declined.`,

            url:
                `group.html?id=${encodeURIComponent(
                    groupId
                )}`
        });


        const card =
            button.closest(
                ".notification-card"
            );

        if (card) {

            const actions =
                card.querySelector(
                    ".join-request-actions"
                );

            if (actions) {

                actions.innerHTML = `
                    <span style="
                        color:#b42318;
                        font-size:13px;
                        font-weight:600;
                    ">
                        ✕ Declined
                    </span>
                `;

            }

        }

    } catch (error) {

        console.error(
            "Reject join request error:",
            error
        );

        alert(
            "Could not reject the join request."
        );

        button.disabled = false;

    }

}


// ============================================================
// CREATE GENERAL NOTIFICATION
// ============================================================

async function createGeneralNotification(
    data
) {

    try {

        const {
            addDoc
        } = await import(
            "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
        );

        await addDoc(
            collection(
                db,
                "notifications"
            ),
            {
                ...data,

                recipientId:
                    data.receiverId,

                receiverId:
                    data.receiverId,

                read:
                    false,

                createdAt:
                    new Date()
            }
        );

    } catch (error) {

        console.error(
            "Create notification error:",
            error
        );

    }

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
            doc(
                db,
                "notifications",
                notificationDoc.id
            ),
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
                        <div class="loading">
                            No notifications yet.
                        </div>
                    `;

                    return;
                }


                snapshot.forEach(
                    notificationDoc => {

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
                                "Someone"
                            );


                        const text =
                            escapeHTML(
                                getNotificationText(
                                    notification
                                )
                            );


                        const senderPhoto =
                            getSenderPhoto(
                                notification
                            );


                        const safeSenderPhoto =
                            escapeHTML(
                                senderPhoto
                            );


                        const card =
                            document.createElement(
                                "div"
                            );


                        card.className =
                            "notification-card";


                        if (
                            notification.read !== true
                        ) {

                            card.classList.add(
                                "is-unread"
                            );

                            card.style.background =
                                "#eef5ff";

                        }


                        // ------------------------------------------------
                        // GROUP LABEL
                        // ------------------------------------------------

                        let groupLabel =
                            "";


                        if (
                            notification.groupId &&
                            notification.groupName
                        ) {

                            groupLabel = `
                                <div style="
                                    font-size:12px;
                                    color:#777;
                                    margin-top:3px;
                                ">
                                    👥 ${escapeHTML(
                                        notification.groupName
                                    )}
                                </div>
                            `;

                        }


                        // ------------------------------------------------
                        // POST LABEL
                        // ------------------------------------------------

                        let postLabel =
                            "";


                        if (
                            notification.postId
                        ) {

                            postLabel = `
                                <div style="
                                    font-size:12px;
                                    color:#777;
                                    margin-top:2px;
                                ">
                                    📝 View group post
                                </div>
                            `;

                        }


                        // ------------------------------------------------
                        // JOIN REQUEST ACTIONS
                        // ------------------------------------------------

                        let joinRequestActions =
                            "";


                        if (
                            notification.type ===
                            "group_join_request" &&
                            notification.groupId &&
                            notification.senderId &&
                            notification.action !==
                                "approved" &&
                            notification.action !==
                                "rejected"
                        ) {

                            joinRequestActions = `
                                <div
                                    class="join-request-actions"
                                    style="
                                        display:flex;
                                        gap:8px;
                                        margin-top:10px;
                                    "
                                >

                                    <button
                                        type="button"
                                        class="approve-join-btn"
                                        style="
                                            border:0;
                                            border-radius:8px;
                                            padding:7px 12px;
                                            background:#16803c;
                                            color:white;
                                            cursor:pointer;
                                            font-weight:600;
                                        "
                                    >
                                        ✓ Approve
                                    </button>

                                    <button
                                        type="button"
                                        class="reject-join-btn"
                                        style="
                                            border:0;
                                            border-radius:8px;
                                            padding:7px 12px;
                                            background:#b42318;
                                            color:white;
                                            cursor:pointer;
                                            font-weight:600;
                                        "
                                    >
                                        ✕ Cancel
                                    </button>

                                </div>
                            `;

                        }


                        // ------------------------------------------------
                        // CARD
                        // ------------------------------------------------

                        card.innerHTML = `

                            <img
                                src="${safeSenderPhoto}"
                                alt=""
                                style="
                                    width:40px;
                                    height:40px;
                                    border-radius:50%;
                                    object-fit:cover;
                                    flex-shrink:0;
                                "
                                onerror="
                                    this.src='https://via.placeholder.com/50';
                                "
                            >

                            <div
                                class="notification-text"
                            >

                                <b>
                                    ${senderName}
                                </b>

                                <br>

                                <span>
                                    ${icon}
                                    ${text}
                                </span>

                                ${groupLabel}

                                ${postLabel}

                                ${joinRequestActions}

                                <br>

                                <small>
                                    ${escapeHTML(
                                        time
                                    )}
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

                        `;


                        // ------------------------------------------------
                        // APPROVE BUTTON
                        // ------------------------------------------------

                        const approveButton =
                            card.querySelector(
                                ".approve-join-btn"
                            );


                        if (
                            approveButton
                        ) {

                            approveButton.addEventListener(
                                "click",
                                event => {

                                    event.stopPropagation();

                                    approveJoinRequest(
                                        notificationDoc,
                                        notification,
                                        approveButton
                                    );

                                }
                            );

                        }


                        // ------------------------------------------------
                        // REJECT BUTTON
                        // ------------------------------------------------

                        const rejectButton =
                            card.querySelector(
                                ".reject-join-btn"
                            );


                        if (
                            rejectButton
                        ) {

                            rejectButton.addEventListener(
                                "click",
                                event => {

                                    event.stopPropagation();

                                    rejectJoinRequest(
                                        notificationDoc,
                                        notification,
                                        rejectButton
                                    );

                                }
                            );

                        }


                        // ------------------------------------------------
                        // CARD CLICK
                        // ------------------------------------------------

                        card.addEventListener(
                            "click",
                            event => {

                                if (
                                    event.target.closest(
                                        "button"
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


                        notifications.appendChild(
                            card
                        );

                    }
                );

            },


            error => {

                console.error(
                    "Notifications Error:",
                    error
                );


                notifications.innerHTML = `
                    <div class="loading">
                        Unable to load notifications.
                    </div>
                `;

            }

        );

    }
);


// ============================================================
// END OF notifications-page.js
// ============================================================