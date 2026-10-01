// ============================================================
// VITALSTAR — NOTIFICATIONS PAGE
// Firebase v10.12.2
// ============================================================

import {
    collection,
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
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    auth,
    db
} from "./firebase.js";


// ============================================================
// ELEMENTS
// ============================================================

const notificationsContainer =
    document.getElementById("notifications");

if (!notificationsContainer) {
    console.error(
        "VitalStar: #notifications element not found."
    );
}


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let unsubscribeNotifications = null;


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// DISPLAY NAME
// ============================================================

function getDisplayName(user) {

    if (!user) {
        return "VitalStar User";
    }

    return (
        user.fullName ||
        user.displayName ||
        user.username ||
        "VitalStar User"
    );
}


// ============================================================
// GET SENDER PHOTO
// ============================================================

function getSenderPhoto(notification) {

    if (notification.senderPhoto) {
        return notification.senderPhoto;
    }

    if (notification.senderPhotoURL) {
        return notification.senderPhotoURL;
    }

    return (
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(
            notification.senderName ||
            "VitalStar User"
        ) +
        "&background=171d32&color=ffffff"
    );
}


// ============================================================
// NOTIFICATION ICON
// ============================================================

function getNotificationIcon(type) {

    switch (type) {

        // ------------------------------
        // FRIEND SYSTEM
        // ------------------------------

        case "friend_request":
            return "👥";

        case "friend_accepted":
            return "🤝";


        // ------------------------------
        // NORMAL
        // ------------------------------

        case "like":
            return "❤️";

        case "comment":
            return "💬";

        case "follow":
            return "👤";

        case "message":
            return "📩";

        case "mention":
            return "🔔";


        // ------------------------------
        // GROUP
        // ------------------------------

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


        // ------------------------------
        // SYSTEM
        // ------------------------------

        case "system":
            return "⚙️";

        default:
            return "🔔";
    }
}


// ============================================================
// NOTIFICATION TEXT
// ============================================================

function getNotificationText(notification) {

    // Friend request
    if (notification.type === "friend_request") {

        return (
            notification.text ||
            notification.message ||
            `${notification.senderName || "Someone"} sent you a friend request.`
        );
    }


    // Friend accepted
    if (notification.type === "friend_accepted") {

        return (
            notification.text ||
            notification.message ||
            `${notification.senderName || "Someone"} accepted your friend request.`
        );
    }


    // Everything else
    return (
        notification.text ||
        notification.message ||
        "You have a new notification."
    );
}


// ============================================================
// FORMAT TIME
// ============================================================

function formatNotificationTime(timestamp) {

    if (!timestamp) {
        return "Just now";
    }

    try {

        let date;

        if (timestamp.toDate) {

            date = timestamp.toDate();

        } else if (timestamp.seconds) {

            date = new Date(
                timestamp.seconds * 1000
            );

        } else {

            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) {
            return "Just now";
        }

        const now = new Date();

        const difference =
            now.getTime() -
            date.getTime();

        const seconds =
            Math.floor(
                difference / 1000
            );

        const minutes =
            Math.floor(
                seconds / 60
            );

        const hours =
            Math.floor(
                minutes / 60
            );

        const days =
            Math.floor(
                hours / 24
            );

        if (seconds < 10) {
            return "just now";
        }

        if (seconds < 60) {
            return `${seconds}s ago`;
        }

        if (minutes < 60) {
            return (
                minutes === 1
                    ? "1 min ago"
                    : `${minutes} mins ago`
            );
        }

        if (hours < 24) {
            return (
                hours === 1
                    ? "1 hour ago"
                    : `${hours} hours ago`
            );
        }

        if (days < 7) {
            return (
                days === 1
                    ? "yesterday"
                    : `${days} days ago`
            );
        }

        return date.toLocaleDateString();

    } catch (error) {

        return "Just now";
    }
}


// ============================================================
// NOTIFICATION DESTINATION
// ============================================================

function getNotificationDestination(notification) {

    const type =
        notification.type;


    // ========================================================
    // FRIEND REQUEST
    // ========================================================

    if (type === "friend_request") {

        return "myfriends.html?tab=requests";
    }


    // ========================================================
    // FRIEND ACCEPTED
    // ========================================================

    if (type === "friend_accepted") {

        return "myfriends.html?tab=friends";
    }


    // ========================================================
    // GROUP POST
    // ========================================================

    if (
        type === "group_post" ||
        type === "group_post_like" ||
        type === "group_post_comment"
    ) {

        if (notification.groupId) {

            let url =
                "group.html?id=" +
                encodeURIComponent(
                    notification.groupId
                ) +
                "&tab=posts";

            if (notification.postId) {

                url +=
                    "&postId=" +
                    encodeURIComponent(
                        notification.postId
                    );
            }

            return url;
        }
    }


    // ========================================================
    // GROUP CHAT
    // ========================================================

    if (
        type === "group_message"
    ) {

        if (notification.groupId) {

            return (
                "group.html?id=" +
                encodeURIComponent(
                    notification.groupId
                ) +
                "&tab=chat"
            );
        }
    }


    // ========================================================
    // GROUP JOIN REQUEST
    // ========================================================

    if (
        type === "group_join_request"
    ) {

        if (notification.groupId) {

            return (
                "group.html?id=" +
                encodeURIComponent(
                    notification.groupId
                ) +
                "&tab=members"
            );
        }
    }


    // ========================================================
    // OTHER GROUP NOTIFICATIONS
    // ========================================================

    if (
        notification.groupId &&
        (
            type === "group" ||
            type === "group_join" ||
            type === "group_invite" ||
            type === "group_admin" ||
            type === "group_member" ||
            type === "group_mention" ||
            type === "group_subscription"
        )
    ) {

        return (
            "group.html?id=" +
            encodeURIComponent(
                notification.groupId
            )
        );
    }


    // ========================================================
    // POST
    // ========================================================

    if (
        notification.postId &&
        (
            type === "like" ||
            type === "comment" ||
            type === "mention"
        )
    ) {

        return (
            "comments.html?postId=" +
            encodeURIComponent(
                notification.postId
            )
        );
    }


    // ========================================================
    // MESSAGE
    // ========================================================

    if (type === "message") {

        if (notification.senderId) {

            return (
                "message.html?uid=" +
                encodeURIComponent(
                    notification.senderId
                )
            );
        }
    }


    // ========================================================
    // CUSTOM URL
    // ========================================================

    if (notification.url) {
        return notification.url;
    }


    // ========================================================
    // SENDER PROFILE
    // ========================================================

    if (notification.senderId) {

        return (
            "profile.html?uid=" +
            encodeURIComponent(
                notification.senderId
            )
        );
    }


    return "#";
}


// ============================================================
// MARK ONE AS READ
// ============================================================

async function markAsRead(notificationId) {

    if (!notificationId) {
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "notifications",
                notificationId
            ),
            {
                read: true
            }
        );

    } catch (error) {

        console.error(
            "Could not mark notification as read:",
            error
        );
    }
}


// ============================================================
// MARK ALL AS READ
// ============================================================

async function markAllAsRead() {

    if (!currentUser) {
        return;
    }

    try {

        const q = query(
            collection(
                db,
                "notifications"
            ),
            where(
                "receiverId",
                "==",
                currentUser.uid
            ),
            where(
                "read",
                "==",
                false
            )
        );

        const snapshot =
            await getDocs(q);

        if (snapshot.empty) {
            return;
        }

        const batch =
            writeBatch(db);

        snapshot.docs.forEach(
            function(notificationDoc) {

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
            "Mark all as read error:",
            error
        );
    }
}


// ============================================================
// MARK ALL BUTTON
// ============================================================

function createMarkAllButton() {

    if (!notificationsContainer) {
        return;
    }

    let button =
        document.getElementById(
            "markAllNotifications"
        );

    if (button) {
        return;
    }

    button =
        document.createElement("button");

    button.id =
        "markAllNotifications";

    button.type = "button";

    button.textContent =
        "✓ Mark all as read";

    button.style.cssText = `
        display:block;
        margin:0 0 15px auto;
        background:transparent;
        border:0;
        color:#63a4ff;
        font-size:14px;
        font-weight:600;
        cursor:pointer;
    `;

    button.addEventListener(
        "click",
        markAllAsRead
    );

    if (
        notificationsContainer.parentElement
    ) {

        notificationsContainer
            .parentElement
            .insertBefore(
                button,
                notificationsContainer
            );
    }
}


// ============================================================
// OPEN NOTIFICATION
// ============================================================

async function openNotification(
    notification
) {

    if (!notification) {
        return;
    }

    if (!notification.read) {

        await markAsRead(
            notification.id
        );
    }

    const destination =
        getNotificationDestination(
            notification
        );

    if (
        destination &&
        destination !== "#"
    ) {

        window.location.href =
            destination;
    }
}


// ============================================================
// RENDER NOTIFICATION
// ============================================================

function renderNotification(
    notification
) {

    const unread =
        notification.read !== true;

    const senderName =
        notification.senderName ||
        "VitalStar User";

    const photo =
        getSenderPhoto(
            notification
        );

    const icon =
        getNotificationIcon(
            notification.type
        );

    const text =
        getNotificationText(
            notification
        );

    const time =
        formatNotificationTime(
            notification.createdAt
        );


    // Extra information
    let label = "";


    if (notification.groupName) {

        label = `
            <div class="notification-label">
                👥 ${escapeHTML(
                    notification.groupName
                )}
            </div>
        `;

    } else if (
        notification.postId &&
        notification.type !==
            "friend_request" &&
        notification.type !==
            "friend_accepted"
    ) {

        label = `
            <div class="notification-label">
                📝 Post
            </div>
        `;
    }


    return `
        <div
            class="notification-item ${
                unread
                    ? "unread"
                    : ""
            }"
            data-id="${escapeHTML(
                notification.id
            )}"
        >

            <div class="notification-icon">
                ${icon}
            </div>

            <img
                class="notification-avatar"
                src="${escapeHTML(photo)}"
                alt=""
                loading="lazy"
            >

            <div class="notification-content">

                <div class="notification-text">
                    ${escapeHTML(text)}
                </div>

                ${label}

                <div class="notification-time">
                    ${escapeHTML(time)}
                </div>

            </div>

            ${
                unread
                    ? `
                        <div
                            class="unread-dot"
                        ></div>
                    `
                    : ""
            }

        </div>
    `;
}


// ============================================================
// EMPTY
// ============================================================

function renderEmpty() {

    notificationsContainer.innerHTML = `
        <div class="notifications-empty">

            <div class="empty-icon">
                🔔
            </div>

            <strong>
                No notifications yet
            </strong>

            <p>
                Your likes, comments, friend requests,
                messages and other activity will appear here.
            </p>

        </div>
    `;
}


// ============================================================
// LOADING
// ============================================================

function renderLoading() {

    notificationsContainer.innerHTML = `
        <div class="notifications-loading">

            <div class="notification-spinner"></div>

            <p>
                Loading notifications...
            </p>

        </div>
    `;
}


// ============================================================
// ERROR
// ============================================================

function renderError(error) {

    notificationsContainer.innerHTML = `
        <div class="notifications-empty">

            <div class="empty-icon">
                ⚠️
            </div>

            <strong>
                Could not load notifications
            </strong>

            <p>
                ${escapeHTML(
                    error?.message ||
                    "Please try again."
                )}
            </p>

        </div>
    `;
}


// ============================================================
// CLICK EVENTS
// ============================================================

function setupNotificationEvents() {

    if (!notificationsContainer) {
        return;
    }

    notificationsContainer.addEventListener(
        "click",
        async function(event) {

            const item =
                event.target.closest(
                    ".notification-item"
                );

            if (!item) {
                return;
            }

            const id =
                item.dataset.id;

            if (!id) {
                return;
            }


            // Find current notification
            const notification =
                window.__VitalStarNotifications
                    ?.find(
                        function(item) {
                            return item.id === id;
                        }
                    );

            if (!notification) {
                return;
            }

            await openNotification(
                notification
            );
        }
    );
}


// ============================================================
// LOAD NOTIFICATIONS
// ============================================================

function listenToNotifications() {

    if (
        !currentUser ||
        !notificationsContainer
    ) {
        return;
    }


    if (unsubscribeNotifications) {

        unsubscribeNotifications();

        unsubscribeNotifications =
            null;
    }


    renderLoading();


    const q = query(
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


    unsubscribeNotifications =
        onSnapshot(
            q,

            function(snapshot) {

                const notifications =
                    snapshot.docs.map(
                        function(notificationDoc) {

                            return {
                                id:
                                    notificationDoc.id,

                                ...notificationDoc.data()
                            };
                        }
                    );


                // Save for click handling
                window.__VitalStarNotifications =
                    notifications;


                if (!notifications.length) {

                    renderEmpty();

                    return;
                }


                notificationsContainer.innerHTML =
                    notifications
                        .map(
                            renderNotification
                        )
                        .join("");
            },

            function(error) {

                console.error(
                    "Notifications listener:",
                    error
                );

                renderError(error);
            }
        );
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    function(user) {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        currentUser = user;

        createMarkAllButton();

        setupNotificationEvents();

        listenToNotifications();
    }
);