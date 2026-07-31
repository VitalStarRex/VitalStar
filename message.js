import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import 





function formatTime(timestamp) {

    if (!timestamp) return "";

    const messageTime = new Date(timestamp.seconds * 1000);
    const now = new Date();

    const seconds = Math.floor(
        (now - messageTime) / 1000
    );

    if (seconds < 60) {
        return "Just now";
    }

    if (seconds < 3600) {
        return Math.floor(seconds / 60) + " min ago";
    }

    if (seconds < 86400) {
        return Math.floor(seconds / 3600) + " hr ago";
    }

    return messageTime.toLocaleDateString();
}





{
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const messageList = document.getElementById("messageList");

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

        // Store all chats
        const chats = [];

        snapshot.forEach((chatDoc) => {
            chats.push({
                id: chatDoc.id,
                ...chatDoc.data()
            });
        });

        // Unread first, newest first
        chats.sort((a, b) => {

            if (a.read !== b.read) {
                return a.read ? 1 : -1;
            }

            const aTime = a.lastTimestamp?.seconds || 0;
            const bTime = b.lastTimestamp?.seconds || 0;

            return bTime - aTime;
        });

        for (const chat of chats) {

            const otherUserId = chat.participants.find(
                id => id !== user.uid
            );

            let fullName = "Unknown User";
            let profilePic = "default.png";

            const userSnap = await getDoc(
                doc(db, "users", otherUserId)
            );

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

            


let status = "";

if (chat.lastSenderId === user.uid) {
    status = "Sent ✓";
} else if (chat.lastRead) {
    status = "Read ✓✓";
} else {
    status = "Unread 🔴";
}



            const div = document.createElement("div");

            div.className = "message-card";





            div.innerHTML = `

                <img
                    src="${profilePic}"
                    onerror="this.src='default.png'"
                    class="profile-picture">

                <div class="message-info">

                    <div class="name">
                        ${fullName}
                    </div>

                    <div class="last-message">
                        ${chat.lastMessage || "No message"}
                    </div>

                    <div class="time">
                        ${status}
                    </div>

                </div>

            `;

            div.onclick = () => {
                window.location.href =
                    `chat.html?uid=${otherUserId}`;
            };

            messageList.appendChild(div);

        }

    });

});