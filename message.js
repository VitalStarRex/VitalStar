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

const DEFAULT_PROFILE_PIC = "default.png";

let currentUser = null;
let allChats = [];

const chatListeners = new Map();
const unreadCounts = new Map();

let firstLoad = true;


// ======================================
// ESCAPE HTML
// ======================================

function escapeHtml(text) {

    if (text === null || text === undefined) {
        return "";
    }

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================
// TIMESTAMP
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

    yesterday.setDate(
        now.getDate() - 1
    );

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
// PROFILE IMAGE
// ======================================

function getProfilePicture(userData) {

    if (!userData) {
        return DEFAULT_PROFILE_PIC;
    }

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

    return DEFAULT_PROFILE_PIC;
}


// ======================================
// CREATE CARD
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

    const profilePic =
        chat.profilePic || DEFAULT_PROFILE_PIC;

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

        <div class="avatar-wrapper">

            <img
                src="${escapeHtml(profilePic)}"
                class="profile-picture"
                alt="${escapeHtml(chat.fullName)}"
            >

            <span class="online-dot"></span>

        </div>


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
    // IMAGE FALLBACK
    // ==================================

    const image =
        card.querySelector(".profile-picture");

    if (image) {

        image.addEventListener(
            "error",
            () => {

                if (
                    !image.src.endsWith(
                        DEFAULT_PROFILE_PIC
                    )
                ) {

                    image.src =
                        DEFAULT_PROFILE_PIC;

                }

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
    // DELETE
    // ==================================

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


// ======================================
// RENDER LIST IMMEDIATELY
// ======================================

function renderChats() {

    if (!messageList) return;

    const search =
        searchInput?.value
            ?.trim()
            .toLowerCase() || "";

    let chats = [...allChats];


    // ==================================
    // SEARCH
    // ==================================

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


    // ==================================
    // SORT
    // ==================================

    chats.sort(
        (a, b) =>
            getTimestampValue(
                b.lastTimestamp
            ) -
            getTimestampValue(
                a.lastTimestamp
            )
    );


    // ==================================
    // EMPTY
    // ==================================

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


    // ==================================
    // RENDER FAST
    // ==================================

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
// UPDATE ONE UNREAD BADGE
// ======================================

function updateUnreadBadge(chatId) {

    const count =
        unreadCounts.get(chatId) || 0;

    const chat =
        allChats.find(
            item => item.id === chatId
        );

    if (!chat) return;


    // Find the current card
    const cards =
        messageList.querySelectorAll(
            ".message-card"
        );

    for (const card of cards) {

        const name =
            card.querySelector(".name");

        if (!name) continue;

        if (
            name.textContent.trim() ===
            chat.fullName
        ) {

            const bottomRow =
                card.querySelector(
                    ".bottom-row"
                );

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

            break;
        }
    }
}


// ======================================
// COUNT UNREAD MESSAGES
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


                updateUnreadBadge(
                    chatId
                );

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


        // Remove listener

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


        card.remove();


        if (
            allChats.length === 0
        ) {

            renderChats();

        }


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
// AUTH
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


        // ==================================
        // LOAD CONVERSATIONS
        // ==================================

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
                // GET BASIC CHAT DATA FIRST
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
                            DEFAULT_PROFILE_PIC

                    });

                }


                // ==================================
                // SHOW CHAT LIST IMMEDIATELY
                // ==================================

                allChats = chats;

                renderChats();


                // ==================================
                // LOAD PROFILES IN BACKGROUND
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

                            chat.profilePic =
                                DEFAULT_PROFILE_PIC;

                        }


                    } catch (error) {

                        console.error(
                            "Profile loading error:",
                            error
                        );


                        chat.fullName =
                            "Unknown User";

                        chat.profilePic =
                            DEFAULT_PROFILE_PIC;

                    }


                    // Update screen
                    renderChats();

                }


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
                // START LIVE UNREAD LISTENERS
                // ==================================

                for (
                    const chat of chats
                ) {

                    listenToChat(
                        chat.id
                    );

                }


                firstLoad = false;

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