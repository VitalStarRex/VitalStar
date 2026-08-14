// ============================================================
// VITALSTAR — notifications-page.js
// General notification system
// Supports:
// likes, comments, follows, messages,
// group joins, group invites, group posts,
// group messages, admin actions, etc.
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
    doc,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const notifications = document.getElementById("notifications");

if (!notifications) {
    console.error("Notifications container not found.");
}


// ============================================================
// MARK ALL AS READ
// ============================================================

let markAllReadLink = document.getElementById("markAllReadLink");

if (!markAllReadLink && notifications) {

    markAllReadLink = document.createElement("a");

    markAllReadLink.href = "#";
    markAllReadLink.id = "markAllReadLink";
    markAllReadLink.textContent = "Mark all as read";

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
// MARK ALL READ ACTION
// ============================================================

if (markAllReadLink) {

    markAllReadLink.addEventListener("click", async (e) => {

        e.preventDefault();

        const user = auth.currentUser;

        if (!user) return;

        try {

            const unreadQuery = query(
                collection(db, "notifications"),
                where("receiverId", "==", user.uid),
                where("read", "==", false)
            );

            const snapshot =
                await getDocs(unreadQuery);

            if (snapshot.empty) return;

            const batch = writeBatch(db);

            snapshot.forEach((notificationDoc) => {

                batch.update(
                    notificationDoc.ref,
                    {
                        read: true
                    }
                );

            });

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

    });

}


// ============================================================
// NOTIFICATION ICON
// ============================================================

function getNotificationIcon(type) {

    switch (type) {

        // General
        case "like":
            return "❤️";

        case "comment":
            return "💬";

        case "follow":
            return "👤";

        case "message":
            return "📩";


        // Groups
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


        // Other
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

        if (typeof timestamp.toDate === "function") {

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
// SAFE TEXT
// ============================================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

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


        // ----------------------------------------------------
        // GROUP NOTIFICATION
        // ----------------------------------------------------

        if (notification.groupId) {

            window.location.href =
                `group.html?id=${encodeURIComponent(
                    notification.groupId
                )}`;

            return;
        }


        // ----------------------------------------------------
        // POST NOTIFICATION
        // ----------------------------------------------------

        if (notification.postId) {

            window.location.href =
                `comments.html?postId=${encodeURIComponent(
                    notification.postId
                )}`;

            return;
        }


        // ----------------------------------------------------
        // CHAT / MESSAGE
        // ----------------------------------------------------

        if (
            notification.chatId ||
            notification.conversationId
        ) {

            const chatId =
                notification.chatId ||
                notification.conversationId;

            window.location.href =
                `chat.html?id=${encodeURIComponent(
                    chatId
                )}`;

            return;
        }


        // ----------------------------------------------------
        // SENDER PROFILE
        // ----------------------------------------------------

        if (notification.senderId) {

            window.location.href =
                `profile.html?uid=${encodeURIComponent(
                    notification.senderId
                )}`;

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
// AUTH
// ============================================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href =
            "login.html";

        return;
    }


    if (!notifications) {
        return;
    }


    // --------------------------------------------------------
    // GENERAL NOTIFICATIONS
    // --------------------------------------------------------

    const q = query(
        collection(db, "notifications"),
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

        (snapshot) => {

            notifications.innerHTML = "";


            // ------------------------------------------------
            // EMPTY
            // ------------------------------------------------

            if (snapshot.empty) {

                notifications.innerHTML = `
                    <div class="loading">
                        No notifications yet.
                    </div>
                `;

                return;
            }


            // ------------------------------------------------
            // RENDER
            // ------------------------------------------------

            snapshot.forEach(
                (notificationDoc) => {

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
                            notification.text ||
                            "New notification"
                        );


                    const senderPhoto =
                        notification.senderPhoto ||
                        notification.photoURL ||
                        "https://via.placeholder.com/50";


                    // ------------------------------------------------
                    // CARD
                    // ------------------------------------------------

                    const card =
                        document.createElement("div");

                    card.className =
                        "notification-card";


                    // Unread
                    if (!notification.read) {

                        card.classList.add(
                            "is-unread"
                        );

                        card.style.background =
                            "#eef5ff";

                    }


                    // ------------------------------------------------
                    // GROUP BADGE
                    // ------------------------------------------------

                    let groupLabel = "";

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
                    // CARD HTML
                    // ------------------------------------------------

                    card.innerHTML = `

                        <img
                            src="${senderPhoto}"
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

                        <div class="notification-text">

                            <b>
                                ${senderName}
                            </b>

                            <br>

                            <span>
                                ${icon}
                                ${text}
                            </span>

                            ${groupLabel}

                            <br>

                            <small>
                                ${escapeHTML(time)}
                            </small>

                        </div>

                        ${
                            !notification.read
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
                    // CLICK
                    // ------------------------------------------------

                    card.addEventListener(
                        "click",
                        () => {

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


        // ----------------------------------------------------
        // ERROR
        // ----------------------------------------------------

        (error) => {

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

});