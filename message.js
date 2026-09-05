// VITALSTAR MESSAGES
// message.js

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

const messageList = document.getElementById("messageList");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let allChats = [];

const chatListeners = new Map();
const unreadCounts = new Map();


// ======================================
// ESCAPE HTML
// ======================================

function escapeHtml(text) {
    if (text === null || text === undefined) return "";

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================
// GET TIMESTAMP
// ======================================

function getTimestampValue(timestamp) {
    if (!timestamp) return 0;

    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }

    if (timestamp.seconds) {
        return timestamp.seconds * 1000;
    }

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }

    if (typeof timestamp === "number") {
        return timestamp;
    }

    return 0;
}


// ======================================
// FORMAT TIME
// ======================================

function formatTime(timestamp) {
    const time = getTimestampValue(timestamp);

    if (!time) return "";

    const date = new Date(time);
    const now = new Date();

    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (sameDay) {
        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
        return "Yesterday";
    }

    return date.toLocaleDateString([], {
        day: "numeric",
        month: "short"
    });
}


// ======================================
// LAST MESSAGE
// ======================================

function getLastMessageHtml(chat) {
    if (chat.lastMessage) {
        return escapeHtml(chat.lastMessage);
    }

    if (chat.lastImage) {
        return "🖼️ Photo";
    }

    if (chat.lastVideo) {
        return "🎥 Video";
    }

    if (chat.lastAudio) {
        return "🎤 Voice message";
    }

    return "Start a conversation";
}


// ======================================
// GET PROFILE PICTURE
// ======================================

function getProfilePicture(userData) {
    if (!userData) return "";

    const pictures = [
        userData.profilePic,
        userData.profilePicture,
        userData.photoURL,
        userData.photoUrl,
        userData.profileImage,
        userData.imageUrl
    ];

    for (const picture of pictures) {
        if (
            typeof picture === "string" &&
            picture.trim() !== ""
        ) {
            return picture.trim();
        }
    }

    return "";
}


// ======================================
// GET FIRST LETTER
// ======================================

function getFirstLetter(name) {
    const cleanName = String(name || "U").trim();

    if (!cleanName) return "U";

    return cleanName
        .charAt(0)
        .toUpperCase();
}


// ======================================
// CREATE AVATAR
// ======================================

function createAvatar(chat) {
    const letter = getFirstLetter(chat.fullName);

    // User has profile picture
    if (chat.profilePic) {
        return `
            <div class="avatar-wrapper">

                <img
                    src="${escapeHtml(chat.profilePic)}"
                    class="profile-picture"
                    alt="${escapeHtml(chat.fullName)}"
                >

                <span class="avatar-letter">
                    ${escapeHtml(letter)}
                </span>

                <span class="online-dot"></span>

            </div>
        `;
    }

    // No profile picture:
    // show first letter
    return `
        <div class="avatar-wrapper">

            <div class="profile-letter">
                ${escapeHtml(letter)}
            </div>

            <span class="online-dot"></span>

        </div>
    `;
}


// ======================================
// CREATE CHAT CARD
// ======================================

function createChatCard(chat) {

    const unreadCount =
        unreadCounts.get(chat.id) || 0;

    const card =
        document.createElement("div");

    card.className = "message-card";

    if (unreadCount > 0) {
        card.classList.add("unread-card");
    }

    const unreadBadge =
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
            : "";

    card.innerHTML = `

        ${createAvatar(chat)}

        <div class="message-info">

            <div class="top-row">

                <div class="name">
                    ${escapeHtml(chat.fullName)}
                </div>

                <div class="time-text">
                    ${formatTime(chat.lastTimestamp)}
                </div>

            </div>


            <div class="bottom-row">

                <div class="last-message">
                    ${getLastMessageHtml(chat)}
                </div>

                ${unreadBadge}

            </div>

        </div>


        <button
            class="delete-chat-btn"
            type="button"
            title="Delete chat"
            aria-label="Delete chat"
        >
            🗑️
        </button>

    `;


    // ==================================
    // PROFILE IMAGE FALLBACK
    // ==================================

    const image =
        card.querySelector(".profile-picture");

    if (image) {

        image.addEventListener(
            "error",
            () => {

                const wrapper =
                    image.closest(
                        ".avatar-wrapper"
                    );

                if (!wrapper) return;

                const letter =
                    getFirstLetter(
                        chat.fullName
                    );

                wrapper.innerHTML = `

                    <div class="profile-letter">
                        ${escapeHtml(letter)}
                    </div>

                    <span class="online-dot"></span>

                `;

            }
        );

    }


    // ==================================
    // OPEN CHAT
    // ==================================

    card.addEventListener(
        "click",
        () => {

            window.location.href =
                `chat.html?uid=${encodeURIComponent(
                    chat.otherUserId
                )}`;

        }
    );


    // ==================================
    // DELETE CHAT
    // ==================================

    const deleteButton =
        card.querySelector(
            ".delete-chat-btn"
        );

    if (deleteButton) {

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

    }


    return card;
}


// ======================================
// RENDER CHATS
// ======================================

function renderChats() {

    if (!messageList) return;

    const search =
        searchInput?.value
            ?.trim()
            .toLowerCase() || "";

    let chats = [...allChats];


    // SEARCH
    if (search) {

        chats = chats.filter(chat => {

            const name =
                (chat.fullName || "")
                    .toLowerCase();

            const message =
                (chat.lastMessage || "")
                    .toLowerCase();

            return (
                name.includes(search) ||
                message.includes(search)
            );

        });

    }


    // SORT NEWEST FIRST
    chats.sort(
        (a, b) =>
            getTimestampValue(
                b.lastTimestamp
            ) -
            getTimestampValue(
                a.lastTimestamp
            )
    );


    // EMPTY
    if (!chats.length) {

        messageList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ${search ? "🔎" : "💬"}
                </div>

                <h2>
                    ${
                        search
                            ? "No results"
                            : "No conversations"
                    }
                </h2>

                <p>
                    ${
                        search
                            ? "No conversations match your search."
                            : "Start chatting with your friends."
                    }
                </p>

            </div>

        `;

        return;
    }


    // FAST RENDER
    const fragment =
        document.createDocumentFragment();

    for (const chat of chats) {

        fragment.appendChild(
            createChatCard(chat)
        );

    }

    messageList.innerHTML = "";

    messageList.appendChild(
        fragment
    );
}


// ======================================
// UPDATE UNREAD BADGE
// ======================================

function updateUnreadBadge(chatId) {

    const count =
        unreadCounts.get(chatId) || 0;

    const chat =
        allChats.find(
            item => item.id === chatId
        );

    if (!chat) return;


    /*
       Find card using the user's
       unique chat ID instead of name.
    */

    const card =
        messageList.querySelector(
            `[data-chat-id="${CSS.escape(chatId)}"]`
        );

    if (!card) {

        renderChats();

        return;
    }


    const bottomRow =
        card.querySelector(
            ".bottom-row"
        );

    if (!bottomRow) return;


    const oldBadge =
        bottomRow.querySelector(
            ".unread-badge"
        );

    if (oldBadge) {
        oldBadge.remove();
    }


    if (count > 0) {

        const badge =
            document.createElement(
                "span"
            );

        badge.className =
            "unread-badge";

        badge.textContent =
            count > 99
                ? "99+"
                : count;

        bottomRow.appendChild(
            badge
        );

        card.classList.add(
            "unread-card"
        );

    } else {

        card.classList.remove(
            "unread-card"
        );

    }
}


// ======================================
// LOAD UNREAD COUNT
// ======================================

async function loadUnreadCount(chatId) {

    if (!currentUser) return;

    try {

        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );

        const snapshot =
            await getDocs(messagesRef);

        let count = 0;

        snapshot.forEach(
            messageDoc => {

                const message =
                    messageDoc.data();

                if (
                    message.receiverId ===
                        currentUser.uid &&
                    message.read === false
                ) {
                    count++;
                }

            }
        );

        unreadCounts.set(
            chatId,
            count
        );

        updateUnreadBadge(
            chatId
        );

    } catch (error) {

        console.error(
            "Unread count error:",
            error
        );

    }
}


// ======================================
// LIVE MESSAGE LISTENER
// ======================================

function listenToChat(chatId) {

    if (
        chatListeners.has(chatId)
    ) {
        return;
    }


    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );


    const unsubscribe =
        onSnapshot(
            messagesRef,
            snapshot => {

                let unread = 0;

                snapshot.forEach(
                    messageDoc => {

                        const message =
                            messageDoc.data();

                        if (
                            message.receiverId ===
                                currentUser.uid &&
                            message.read === false
                        ) {

                            unread++;

                        }

                    }
                );


                unreadCounts.set(
                    chatId,
                    unread
                );


                /*
                   Re-rendering keeps the
                   conversation badge and
                   latest data synchronized.
                */

                renderChats();

            },
            error => {

                console.error(
                    "Message listener error:",
                    error
                );

            }
        );


    chatListeners.set(
        chatId,
        unsubscribe
    );
}


// ======================================
// DELETE CHAT
// ======================================

async function deleteChat(
    chatId,
    card
) {

    const confirmed =
        confirm(
            "Delete this conversation?\n\nAll messages in this chat will be deleted."
        );

    if (!confirmed) return;


    try {

        card.style.opacity = "0.45";
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
            await getDocs(messagesRef);


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


        // Stop listener

        if (
            chatListeners.has(
                chatId
            )
        ) {

            chatListeners
                .get(chatId)();

            chatListeners.delete(
                chatId
            );

        }


        unreadCounts.delete(
            chatId
        );


        allChats =
            allChats.filter(
                chat =>
                    chat.id !== chatId
            );


        renderChats();


    } catch (error) {

        console.error(
            "Delete chat error:",
            error
        );


        card.style.opacity = "1";

        card.style.pointerEvents =
            "auto";


        alert(
            "Unable to delete this conversation."
        );

    }
}


// ======================================
// AUTHENTICATION
// ======================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentUser = user;


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

                const activeChatIds =
                    new Set();


                // ==================================
                // GET CHAT DATA FIRST
                // ==================================

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


                    activeChatIds.add(
                        chatDoc.id
                    );


                    chats.push({

                        id:
                            chatDoc.id,

                        ...data,

                        otherUserId,

                        fullName:
                            "Loading...",

                        profilePic:
                            ""

                    });

                }


                // ==================================
                // SHOW CONVERSATIONS IMMEDIATELY
                // ==================================

                allChats = chats;

                renderChats();


                // ==================================
                // REMOVE OLD LISTENERS
                // ==================================

                for (
                    const [
                        chatId,
                        unsubscribe
                    ]
                    of chatListeners
                ) {

                    if (
                        !activeChatIds.has(
                            chatId
                        )
                    ) {

                        unsubscribe();

                        chatListeners.delete(
                            chatId
                        );

                    }

                }


                // ==================================
                // LOAD PROFILES
                // ==================================

                for (
                    const chat of chats
                ) {

                    try {

                        const userSnap =
                            await getDoc(
                                doc(
                                    db,
                                    "users",
                                    chat.otherUserId
                                )
                            );


                        if (
                            userSnap.exists()
                        ) {

                            const userData =
                                userSnap.data();


                            chat.fullName =
                                userData.fullName ||
                                userData.username ||
                                "Unknown User";


                            chat.profilePic =
                                getProfilePicture(
                                    userData
                                );

                        } else {

                            chat.fullName =
                                "Unknown User";

                        }

                    } catch (error) {

                        console.error(
                            "Profile loading error:",
                            error
                        );

                        chat.fullName =
                            "Unknown User";

                    }


                    renderChats();

                }


                // ==================================
                // LIVE MESSAGE LISTENERS
                // ==================================

                for (
                    const chat of chats
                ) {

                    listenToChat(
                        chat.id
                    );

                }

            },

            error => {

                console.error(
                    "Chats error:",
                    error
                );


                showEmptyState(
                    "⚠️",
                    "Unable to load messages",
                    "Check your connection and try again."
                );

            }
        );

    }
);


// ======================================
// EMPTY STATE
// ======================================

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

            <h2>
                ${escapeHtml(title)}
            </h2>

            <p>
                ${escapeHtml(text)}
            </p>

        </div>

    `;
}


// ======================================
// SEARCH
// ======================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderChats();

        }
    );

}