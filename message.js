import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const messageList = document.getElementById("messageList");

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatTime(timestamp) {
    if (!timestamp) return "";

    let messageDate;

    if (typeof timestamp.toDate === "function") {
        messageDate = timestamp.toDate();
    } else if (timestamp.seconds) {
        messageDate = new Date(timestamp.seconds * 1000);
    } else {
        messageDate = new Date(timestamp);
    }

    const now = new Date();
    const seconds = Math.floor((now - messageDate) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + " hr ago";

    return messageDate.toLocaleDateString();
}

function getTimestampValue(timestamp) {
    if (!timestamp) return 0;

    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().getTime();
    }

    if (timestamp.seconds) {
        return timestamp.seconds * 1000;
    }

    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

function getStatus(chat, currentUserId) {
    if (chat.lastRead) {
        return "Read ✓✓";
    }

    if (chat.lastSenderId === currentUserId) {
        return chat.lastDelivered ? "Delivered ✓✓" : "Sent ✓";
    }

    return "Unread 🔴";
}

function getLastMessageHtml(chat) {
    if (chat.lastImage) {
        return `<img src="${chat.lastImage}" class="message-preview-image" onerror="this.style.display='none'">`;
    }

    if (chat.lastVideo) {
        return `<div class="last-message-text">🎥 Video</div>`;
    }

    if (chat.lastAudio) {
        return `<div class="last-message-text">🎤 Voice message</div>`;
    }

    return `<div class="last-message-text">${escapeHtml(chat.lastMessage || "No message")}</div>`;
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid)
    );

    onSnapshot(q, async (snapshot) => {
        messageList.innerHTML = "";

        if (snapshot.empty) {
            messageList.innerHTML = "No messages yet";
            return;
        }

        const chats = [];

        snapshot.forEach((chatDoc) => {
            chats.push({
                id: chatDoc.id,
                ...chatDoc.data()
            });
        });

        chats.sort((a, b) => {
            const aUnread = a.lastRead ? 1 : 0;
            const bUnread = b.lastRead ? 1 : 0;

            if (aUnread !== bUnread) {
                return aUnread - bUnread;
            }

            return getTimestampValue(b.lastTimestamp) - getTimestampValue(a.lastTimestamp);
        });

        for (const chat of chats) {
            const otherUserId = chat.participants.find(id => id !== user.uid);

            let fullName = "Unknown User";
            let profilePic = "default.png";

            const userSnap = await getDoc(doc(db, "users", otherUserId));

            if (userSnap.exists()) {
                const userData = userSnap.data();

                fullName =
                    userData.fullName ||
                    userData.username ||
                    "Unknown User";

                profilePic =
                    userData.profilePic ||
                    userData.photoURL ||
                    userData.photoUrl ||
                    userData.profileImage ||
                    userData.imageUrl ||
                    "default.png";
            }

            const status = getStatus(chat, user.uid);
            const timeText = formatTime(chat.lastTimestamp);
            const lastMessageHtml = getLastMessageHtml(chat);

            const div = document.createElement("div");
            div.className = "message-card";

            div.innerHTML = `
                <img
                    src="${profilePic}"
                    onerror="this.src='default.png'"
                    class="profile-picture">

                <div class="message-info">
                    <div class="name">
                        ${escapeHtml(fullName)}
                    </div>

                    <div class="last-message">
                        ${lastMessageHtml}
                    </div>

                    <div class="time">
                        <span class="status-text">${status}</span>
                        <span class="time-text">${timeText}</span>
                    </div>
                </div>
            `;

            div.onclick = () => {
                window.location.href = `chat.html?uid=${otherUserId}`;
            };

            messageList.appendChild(div);
        }
    });
});