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
    doc,
    getDocs,
    writeBatch
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

        // ----------------------------------------------------
        // GENERAL
        // ----------------------------------------------------

        case "like":
            return "❤️";

        case "comment":
            return "💬";

        case "follow":
            return "👤";

        case "message":
            return "📩";


        // ----------------------------------------------------
        // GROUPS
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // OTHER
        // ----------------------------------------------------

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

function formatNotificationTime(
    timestamp
) {

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
// Supports both "text" and old "message"
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
// Supports multiple field names
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
// GET DESTINATION
// ============================================================

function getNotificationDestination(
    notification
) {

    // --------------------------------------------------------
    // GROUP
    // --------------------------------------------------------

    if (
        notification.groupId
    ) {

        // If notification contains a post,
        // open that post's comments page.

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


        // If it contains a chat ID,
        // open the group chat.

        if (
            notification.chatId
        ) {

            return (
                `group.html?id=${
                    encodeURIComponent(
                        notification.groupId
                    )}&tab=chat`
            );

        }


        // Default group destination

        return (
            `group.html?id=${
                encodeURIComponent(
                    notification.groupId
                )
            }`
        );

    }


    // --------------------------------------------------------
    // POST
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
    // SENDER PROFILE
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
// OPEN NOTIFICATION
// ============================================================

async function openNotification(
    notificationDoc,
    notification
) {

    try {

        // ----------------------------------------------------
        // MARK AS READ
        // ----------------------------------------------------

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
        // DESTINATION
        // ----------------------------------------------------

        const destination =
            getNotificationDestination(
                notification
            );


        if (
            destination
        ) {

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


        // ----------------------------------------------------
        // GENERAL NOTIFICATIONS QUERY
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // REALTIME LISTENER
        // ----------------------------------------------------

        onSnapshot(

            q,

            snapshot => {

                notifications.innerHTML =
                    "";


                // ------------------------------------------------
                // EMPTY
                // ------------------------------------------------

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


                // ------------------------------------------------
                // RENDER
                // ------------------------------------------------

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


                        // ------------------------------------------------
                        // CARD
                        // ------------------------------------------------

                        const card =
                            document.createElement(
                                "div"
                            );


                        card.className =
                            "notification-card";


                        // ------------------------------------------------
                        // UNREAD
                        // ------------------------------------------------

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
                        // GROUP BADGE
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
                        // POST INDICATOR
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
                                    📝 View post
                                </div>
                            `;

                        }


                        // ------------------------------------------------
                        // CARD HTML
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


            // ------------------------------------------------
            // ERROR
            // ------------------------------------------------

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
// END OF NOTIFICATIONS-PAGE.JS
// ============================================================