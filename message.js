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


let currentUser = null;
let allChats = [];
let rendering = false;
let renderAgain = false;


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHtml(text) {

    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/* ============================================================
   TIMESTAMP VALUE
============================================================ */

function getTimestampValue(timestamp) {

    if (!timestamp) {
        return 0;
    }

    if (
        typeof timestamp.toDate === "function"
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


/* ============================================================
   FORMAT TIME
============================================================ */

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    let date;

    if (
        typeof timestamp.toDate === "function"
    ) {
        date = timestamp.toDate();

    } else if (timestamp.seconds) {
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

    const seconds =
        Math.floor(
            (now - date) / 1000
        );


    if (seconds < 60) {
        return "Just now";
    }


    if (seconds < 3600) {

        return (
            Math.floor(seconds / 60) +
            " min"
        );
    }


    if (seconds < 86400) {

        return date.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );
    }


    if (seconds < 604800) {

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


/* ============================================================
   LAST MESSAGE
============================================================ */

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


/* ============================================================
   GET UNREAD COUNT
============================================================ */

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


        const snapshot =
            await getDocs(
                messagesRef
            );


        let count = 0;


        snapshot.forEach(
            messageDoc => {

                const message =
                    messageDoc.data();


                if (
                    message.receiverId ===
                    userId &&
                    message.read === false
                ) {

                    count++;
                }

            }
        );


        return count;

    } catch (error) {

        console.error(
            "Unread count error:",
            error
        );

        return 0;
    }
}


/* ============================================================
   EMPTY STATE
============================================================ */

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


/* ============================================================
   DELETE CHAT
============================================================ */

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

        card.style.opacity = "0.45";
        card.style.pointerEvents = "none";


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
                "Start a conversation on VitalStar."
            );
        }

    } catch (error) {

        console.error(
            "Delete chat error:",
            error
        );


        card.style.opacity = "1";
        card.style.pointerEvents = "auto";


        alert(
            "Failed to delete chat. Please try again."
        );
    }
}


/* ============================================================
   CREATE CHAT CARD
============================================================ */

async function createChatCard(chat) {

    const unreadCount =
        await getUnreadCount(
            chat.id,
            currentUser.uid
        );


    const card =
        document.createElement("div");


    card.className =
        "message-card";


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
                    ${escapeHtml(chat.fullName)}
                </div>

                <div class="time-text">
                    ${formatTime(
                        chat.lastTimestamp
                    )}
                </div>

            </div>


            <div class="bottom-row">

                <div class="last-message">

                    ${getLastMessageHtml(chat)}

                </div>


                ${
                    unreadCount > 0
                        ? `
                            <span class="unread-badge">
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
            type="button"
            title="Delete chat"
            aria-label="Delete chat">

            🗑️

        </button>

    `;


    /* OPEN CHAT */

    card.addEventListener(
        "click",
        () => {

            window.location.href =
                `chat.html?uid=${chat.otherUserId}`;

        }
    );


    /* DELETE CHAT */

    const deleteButton =
        card.querySelector(
            ".delete-chat-btn"
        );


    deleteButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            deleteChat(
                chat.id,
                card
            );

        }
    );


    return card;
}


/* ============================================================
   RENDER CHAT LIST
============================================================ */

async function renderChats() {

    if (!currentUser) {
        return;
    }


    /*
     * Prevent multiple renders from
     * fighting with each other.
     */

    if (rendering) {

        renderAgain = true;
        return;
    }


    rendering = true;


    try {

        const search =
            searchInput?.value
                ?.trim()
                .toLowerCase() || "";


        let chats =
            [...allChats];


        /* SEARCH */

        if (search) {

            chats =
                chats.filter(
                    chat => {

                        const name =
                            (
                                chat.fullName ||
                                ""
                            ).toLowerCase();


                        const lastMessage =
                            (
                                chat.lastMessage ||
                                ""
                            ).toLowerCase();


                        return (
                            name.includes(search) ||
                            lastMessage.includes(search)
                        );

                    }
                );
        }


        /* SORT */

        chats.sort(
            (a, b) => {

                return (
                    getTimestampValue(
                        b.lastTimestamp
                    ) -
                    getTimestampValue(
                        a.lastTimestamp
                    )
                );

            }
        );


        /* EMPTY */

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
         * Build everything in a temporary
         * container first.
         *
         * This prevents the page from
         * becoming blank during rendering.
         */

        const fragment =
            document.createDocumentFragment();


        for (
            const chat
            of chats
        ) {

            const card =
                await createChatCard(
                    chat
                );


            fragment.appendChild(
                card
            );
        }


        /*
         * Replace the list only after
         * everything is ready.
         */

        messageList.innerHTML = "";

        messageList.appendChild(
            fragment
        );


    } catch (error) {

        console.error(
            "Render error:",
            error
        );


        showEmptyState(
            "⚠️",
            "Something went wrong",
            "Unable to display your conversations."
        );

    } finally {

        rendering = false;


        if (renderAgain) {

            renderAgain = false;

            setTimeout(
                renderChats,
                50
            );
        }
    }
}


/* ============================================================
   AUTHENTICATION
============================================================ */

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


        /*
         * Get all chats belonging
         * to the current user.
         */

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


        onSnapshot(
            chatsQuery,

            async snapshot => {

                const chats = [];


                /*
                 * Read each conversation.
                 */

                for (
                    const chatDoc
                    of snapshot.docs
                ) {

                    const data =
                        chatDoc.data();


                    if (
                        !Array.isArray(
                            data.participants
                        )
                    ) {

                        continue;
                    }


                    const otherUserId =
                        data.participants.find(
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
                            "Profile loading error:",
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
                 * Listen for new/read messages.
                 *
                 * This updates unread numbers
                 * without clearing the list
                 * unnecessarily.
                 */

                chats.forEach(
                    chat => {

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
                );

            },

            error => {

                console.error(
                    "Chat list error:",
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


/* ============================================================
   SEARCH
============================================================ */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderChats();

        }
    );
}