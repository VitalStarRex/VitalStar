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

let rendering = false;
let renderAgain = false;

// Keep message listeners so we don't create duplicates
const messageListeners = new Map();


// ===============================
// ESCAPE HTML
// ===============================

function escapeHtml(text) {
    if (text === null || text === undefined) return "";

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ===============================
// TIMESTAMP
// ===============================

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


// ===============================
// FORMAT TIME
// ===============================

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


// ===============================
// LAST MESSAGE
// ===============================

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


// ===============================
// GET UNREAD COUNT
// ===============================

async function getUnreadCount(chatId, userId) {

    try {

        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        const snapshot = await getDocs(messagesRef);

        let count = 0;

        snapshot.forEach(messageDoc => {

            const message = messageDoc.data();

            if (
                message.receiverId === userId &&
                message.read === false
            ) {
                count++;
            }

        });

        return count;

    } catch (error) {

        console.error(
            "Unread count error:",
            error
        );

        return 0;
    }
}


// ===============================
// DELETE CHAT
// ===============================

async function deleteChat(chatId, card) {

    const confirmed = confirm(
        "Delete this conversation?\n\nAll messages in this chat will be deleted."
    );

    if (!confirmed) return;

    try {

        card.style.opacity = "0.45";
        card.style.pointerEvents = "none";

        const messagesRef = collection(
            db,
            "chats",
            chatId,
            "messages"
        );

        const snapshot = await getDocs(messagesRef);

        let batch = writeBatch(db);
        let count = 0;

        for (const messageDoc of snapshot.docs) {

            batch.delete(messageDoc.ref);

            count++;

            if (count === 500) {

                await batch.commit();

                batch = writeBatch(db);

                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
        }

        await deleteDoc(
            doc(db, "chats", chatId)
        );

        // Remove listener
        if (messageListeners.has(chatId)) {

            messageListeners.get(chatId)();

            messageListeners.delete(chatId);
        }

        card.remove();

        allChats = allChats.filter(
            chat => chat.id !== chatId
        );

        if (
            !messageList.querySelector(
                ".message-card"
            )
        ) {

            showEmptyState(
                "💬",
                "No conversations",
                "Start chatting with your friends."
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
            "Unable to delete this conversation."
        );
    }
}


// ===============================
// EMPTY STATE
// ===============================

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


// ===============================
// PROFILE IMAGE
// ===============================

function getProfilePicture(userData) {

    if (!userData) {
        return DEFAULT_PROFILE_PIC;
    }

    const possiblePictures = [
        userData.profilePic,
        userData.profilePicture,
        userData.photoURL,
        userData.photoUrl,
        userData.profileImage,
        userData.imageUrl
    ];

    for (const picture of possiblePictures) {

        if (
            typeof picture === "string" &&
            picture.trim() !== ""
        ) {
            return picture.trim();
        }
    }

    return DEFAULT_PROFILE_PIC;
}


// ===============================
// CREATE CHAT CARD
// ===============================

async function createChatCard(chat) {

    const unreadCount = await getUnreadCount(
        chat.id,
        currentUser.uid
    );

    const card = document.createElement("div");

    card.className = "message-card";

    if (unreadCount > 0) {
        card.classList.add("unread-card");
    }

    const profilePic =
        chat.profilePic || DEFAULT_PROFILE_PIC;

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
            aria-label="Delete chat"
        >
            🗑️
        </button>

    `;


    // ===============================
    // PROFILE IMAGE FALLBACK
    // ===============================

    const image =
        card.querySelector(".profile-picture");

    if (image) {

        image.addEventListener(
            "error",
            () => {

                // Prevent infinite loop
                if (
                    image.src.endsWith(
                        DEFAULT_PROFILE_PIC
                    )
                ) {
                    return;
                }

                image.src = DEFAULT_PROFILE_PIC;
            }
        );

    }


    // ===============================
    // OPEN CHAT
    // ===============================

    card.addEventListener(
        "click",
        () => {

            window.location.href =
                `chat.html?uid=${encodeURIComponent(
                    chat.otherUserId
                )}`;

        }
    );


    // ===============================
    // DELETE BUTTON
    // ===============================

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


// ===============================
// RENDER CHATS
// ===============================

async function renderChats() {

    if (!currentUser) return;

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

        let chats = [...allChats];


        // ===============================
        // SEARCH
        // ===============================

        if (search) {

            chats = chats.filter(chat => {

                const name =
                    (chat.fullName || "")
                        .toLowerCase();

                const lastMessage =
                    (chat.lastMessage || "")
                        .toLowerCase();

                return (
                    name.includes(search) ||
                    lastMessage.includes(search)
                );

            });

        }


        // ===============================
        // NEWEST FIRST
        // ===============================

        chats.sort(
            (a, b) =>
                getTimestampValue(
                    b.lastTimestamp
                ) -
                getTimestampValue(
                    a.lastTimestamp
                )
        );


        // ===============================
        // EMPTY
        // ===============================

        if (!chats.length) {

            if (search) {

                showEmptyState(
                    "🔎",
                    "No results",
                    "No conversations match your search."
                );

            } else {

                showEmptyState(
                    "💬",
                    "No conversations",
                    "Start chatting with your friends."
                );

            }

            return;
        }


        // ===============================
        // BUILD LIST
        // ===============================

        const fragment =
            document.createDocumentFragment();

        for (const chat of chats) {

            const card =
                await createChatCard(chat);

            fragment.appendChild(card);

        }


        // Replace everything at once
        messageList.innerHTML = "";

        messageList.appendChild(
            fragment
        );


    } catch (error) {

        console.error(
            "Render chats error:",
            error
        );

        showEmptyState(
            "⚠️",
            "Unable to load messages",
            "Please refresh the page and try again."
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


// ===============================
// AUTHENTICATION
// ===============================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        currentUser = user;


        // ===============================
        // CHATS QUERY
        // ===============================

        const chatsQuery = query(
            collection(db, "chats"),
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


                // ===============================
                // LOAD CHAT USERS
                // ===============================

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


                    let fullName =
                        "Unknown User";

                    let profilePic =
                        DEFAULT_PROFILE_PIC;


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
                                getProfilePicture(
                                    userData
                                );

                        }

                    } catch (error) {

                        console.error(
                            "User profile error:",
                            error
                        );

                    }


                    chats.push({

                        id: chatDoc.id,

                        ...data,

                        otherUserId,

                        fullName,

                        profilePic

                    });

                }


                // ===============================
                // REMOVE OLD LISTENERS
                // ===============================

                for (
                    const [
                        chatId,
                        unsubscribe
                    ]
                    of messageListeners
                ) {

                    if (
                        !activeChatIds.has(
                            chatId
                        )
                    ) {

                        unsubscribe();

                        messageListeners.delete(
                            chatId
                        );

                    }

                }


                allChats = chats;


                // ===============================
                // RENDER
                // ===============================

                await renderChats();


                // ===============================
                // LIVE UNREAD UPDATES
                // ===============================

                for (
                    const chat of chats
                ) {

                    if (
                        messageListeners.has(
                            chat.id
                        )
                    ) {
                        continue;
                    }


                    const messagesRef =
                        collection(
                            db,
                            "chats",
                            chat.id,
                            "messages"
                        );


                    const unsubscribe =
                        onSnapshot(
                            messagesRef,
                            () => {

                                renderChats();

                            }
                        );


                    messageListeners.set(
                        chat.id,
                        unsubscribe
                    );

                }

            },

            error => {

                console.error(
                    "Chats listener error:",
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


// ===============================
// SEARCH
// ===============================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderChats();

        }
    );

}