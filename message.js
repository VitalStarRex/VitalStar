import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDoc,
    getDocs,
    doc,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const messageList =
    document.getElementById("messageList");

const searchInput =
    document.getElementById("searchInput");


let allChats = [];
let currentUser = null;


/* ===============================
   ESCAPE HTML
================================ */

function escapeHtml(text) {

    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/* ===============================
   TIMESTAMP
================================ */

function getTimestampValue(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (
        typeof timestamp.toDate ===
        "function"
    ) {
        return timestamp.toDate().getTime();
    }

    if (timestamp.seconds) {

        return timestamp.seconds * 1000;
    }

    const date =
        new Date(timestamp);

    return isNaN(date.getTime())
        ? 0
        : date.getTime();
}


/* ===============================
   FORMAT TIME
================================ */

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    let date;

    if (
        typeof timestamp.toDate ===
        "function"
    ) {

        date =
            timestamp.toDate();

    } else if (
        timestamp.seconds
    ) {

        date =
            new Date(
                timestamp.seconds * 1000
            );

    } else {

        date =
            new Date(timestamp);
    }


    if (isNaN(date.getTime())) {
        return "";
    }


    const now =
        new Date();


    const diff =
        Math.floor(
            (now - date) / 1000
        );


    if (diff < 60) {
        return "Just now";
    }


    if (diff < 3600) {

        return (
            Math.floor(diff / 60) +
            " min"
        );
    }


    if (diff < 86400) {

        return date.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }


    if (diff < 604800) {

        return date.toLocaleDateString(
            [],
            {
                weekday: "short"
            }
        );
    }


    return date.toLocaleDateString(
        [],
        {
            day: "numeric",
            month: "short"
        }
    );
}


/* ===============================
   LAST MESSAGE
================================ */

function getLastMessageHtml(chat) {

    if (chat.lastImage) {

        return `
            <div class="last-message-text">
                🖼️ Photo
            </div>
        `;
    }


    if (chat.lastVideo) {

        return `
            <div class="last-message-text">
                🎥 Video
            </div>
        `;
    }


    if (chat.lastAudio) {

        return `
            <div class="last-message-text">
                🎤 Voice message
            </div>
        `;
    }


    if (chat.lastDocument) {

        return `
            <div class="last-message-text">
                📄 Document
            </div>
        `;
    }


    return `
        <div class="last-message-text">
            ${escapeHtml(
                chat.lastMessage ||
                "No messages yet"
            )}
        </div>
    `;
}


/* ===============================
   COUNT UNREAD MESSAGES
================================ */

async function getUnreadCount(
    chatId,
    userId
) {

    try {

        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        const unreadQuery =
            query(
                messagesRef,

                where(
                    "receiverId",
                    "==",
                    userId
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


        return snapshot.size;

    } catch (error) {

        console.error(
            "Unread count error:",
            error
        );

        return 0;
    }
}


/* ===============================
   DELETE CHAT
================================ */

async function deleteChat(
    chatId,
    card
) {

    const confirmed =
        confirm(
            "Delete this conversation?\n\n" +
            "All messages in this chat will be deleted."
        );


    if (!confirmed) {
        return;
    }


    try {

        card.style.opacity =
            "0.45";

        card.style.pointerEvents =
            "none";


        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        const snapshot =
            await getDocs(
                messagesRef
            );


        /*
         * Firestore allows a maximum
         * of 500 writes per batch.
         */

        let batch =
            writeBatch(db);

        let count = 0;


        for (
            const messageDoc
            of snapshot.docs
        ) {

            batch.delete(
                messageDoc.ref
            );

            count++;


            if (count === 500) {

                await batch.commit();

                batch =
                    writeBatch(db);

                count = 0;
            }
        }


        if (count > 0) {

            await batch.commit();
        }


        await deleteDoc(
            doc(
                db,
                "chats",
                chatId
            )
        );


        card.remove();


        allChats =
            allChats.filter(
                chat =>
                    chat.id !== chatId
            );


        if (
            !messageList.querySelector(
                ".message-card"
            )
        ) {

            showEmptyState(
                "💬",
                "No conversations",
                "Start a conversation with someone on VitalStar."
            );
        }


    } catch (error) {

        console.error(
            "Delete chat error:",
            error
        );


        card.style.opacity =
            "1";

        card.style.pointerEvents =
            "auto";


        alert(
            "Unable to delete this chat. Please try again."
        );
    }
}


/* ===============================
   EMPTY STATE
================================ */

function showEmptyState(
    icon,
    title,
    text
) {

    messageList.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                ${icon}
            </div>

            <div class="empty-title">
                ${escapeHtml(title)}
            </div>

            <div class="empty-text">
                ${escapeHtml(text)}
            </div>

        </div>

    `;
}


/* ===============================
   RENDER CHATS
================================ */

async function renderChats() {

    if (!currentUser) {
        return;
    }


    const search =
        searchInput?.value
            ?.trim()
            .toLowerCase() || "";


    messageList.innerHTML = "";


    let chats =
        [...allChats];


    /*
     * Search by user's name
     * or latest message.
     */

    if (search) {

        chats =
            chats.filter(chat => {

                const name =
                    (
                        chat.fullName ||
                        ""
                    ).toLowerCase();

                const message =
                    (
                        chat.lastMessage ||
                        ""
                    ).toLowerCase();

                return (
                    name.includes(search) ||
                    message.includes(search)
                );
            });
    }


    if (!chats.length) {

        if (search) {

            showEmptyState(
                "🔍",
                "No results",
                "No conversation matches your search."
            );

        } else {

            showEmptyState(
                "💬",
                "No conversations",
                "Start chatting with your friends on VitalStar."
            );
        }

        return;
    }


    /*
     * Newest conversation first.
     */

    chats.sort(
        (a, b) =>
            getTimestampValue(
                b.lastTimestamp
            ) -
            getTimestampValue(
                a.lastTimestamp
            )
    );


    /*
     * Render one card at a time.
     */

    for (
        const chat of chats
    ) {

        const card =
            document.createElement(
                "div"
            );


        card.className =
            "message-card";


        /*
         * Get unread count.
         */

        const unreadCount =
            await getUnreadCount(
                chat.id,
                currentUser.uid
            );


        if (unreadCount > 0) {

            card.classList.add(
                "unread-card"
            );
        }


        const profilePic =
            chat.profilePic ||
            "default.png";


        card.innerHTML = `

            <div class="avatar-wrapper">

                <img
                    src="${escapeHtml(profilePic)}"
                    class="profile-picture"
                    alt="${escapeHtml(chat.fullName)}"
                    onerror="this.src='default.png'">

                <span class="online-dot"></span>

            </div>


            <div class="message-info">

                <div class="top-row">

                    <div class="name">
                        ${escapeHtml(
                            chat.fullName
                        )}
                    </div>

                    <div class="time-text">
                        ${formatTime(
                            chat.lastTimestamp
                        )}
                    </div>

                </div>


                <div class="bottom-row">

                    <div class="last-message">

                        ${getLastMessageHtml(
                            chat
                        )}

                    </div>


                    ${
                        unreadCount > 0
                            ? `
                                <span
                                    class="unread-badge">
                                    ${
                                        unreadCount > 99
                                            ? "99+"
                                            : unreadCount
                                    }
                                </span>
                              `
                            : ""
                    }

                </div>

            </div>


            <button
                class="delete-chat-btn"
                title="Delete chat"
                aria-label="Delete chat">

                🗑️

            </button>

        `;


        /*
         * Open chat.
         */

        card.addEventListener(
            "click",
            () => {

                window.location.href =
                    `chat.html?uid=${chat.otherUserId}`;
            }
        );


        /*
         * Delete button.
         */

        const deleteButton =
            card.querySelector(
                ".delete-chat-btn"
            );


        deleteButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                deleteChat(
                    chat.id,
                    card
                );
            }
        );


        messageList.appendChild(
            card
        );
    }
}


/* ===============================
   AUTH
================================ */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentUser =
            user;


        const chatsQuery =
            query(
                collection(
                    db,
                    "chats"
                ),

                where(
                    "participants",
                    "array-contains",
                    user.uid
                )
            );


        /*
         * Listen for conversations.
         */

        onSnapshot(
            chatsQuery,
            async snapshot => {

                const chats = [];


                for (
                    const chatDoc
                    of snapshot.docs
                ) {

                    const data =
                        chatDoc.data();


                    const otherUserId =
                        data.participants?.find(
                            id =>
                                id !== user.uid
                        );


                    if (!otherUserId) {
                        continue;
                    }


                    let fullName =
                        "Unknown User";


                    let profilePic =
                        "default.png";


                    try {

                        const userSnap =
                            await getDoc(
                                doc(
                                    db,
                                    "users",
                                    otherUserId
                                )
                            );


                        if (
                            userSnap.exists()
                        ) {

                            const userData =
                                userSnap.data();


                            fullName =
                                userData.fullName ||
                                userData.username ||
                                "Unknown User";


                            profilePic =
                                userData.profilePic ||
                                userData.profilePicture ||
                                userData.photoURL ||
                                userData.photoUrl ||
                                userData.profileImage ||
                                userData.imageUrl ||
                                "default.png";
                        }

                    } catch (error) {

                        console.error(
                            "User loading error:",
                            error
                        );
                    }


                    chats.push({

                        id:
                            chatDoc.id,

                        ...data,

                        otherUserId:
                            otherUserId,

                        fullName:
                            fullName,

                        profilePic:
                            profilePic
                    });
                }


                allChats =
                    chats;


                await renderChats();


                /*
                 * Live unread updates.
                 *
                 * Listen to each conversation's
                 * message collection so the badge
                 * changes immediately.
                 */

                for (
                    const chat
                    of chats
                ) {

                    const messagesRef =
                        collection(
                            db,
                            "chats",
                            chat.id,
                            "messages"
                        );


                    onSnapshot(
                        messagesRef,
                        () => {

                            renderChats();
                        }
                    );
                }

            },

            error => {

                console.error(
                    "Chat loading error:",
                    error
                );


                showEmptyState(
                    "⚠️",
                    "Unable to load messages",
                    "Please check your internet connection and try again."
                );
            }
        );

    }
);


/* ===============================
   SEARCH
================================ */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderChats();
        }
    );
}