import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const notifications = document.getElementById("notifications");

auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const q = query(
        collection(db, "notifications"),
        where("receiverId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(50)
    );

    onSnapshot(
        q,
        (snapshot) => {

            notifications.innerHTML = "";

            if (snapshot.empty) {
                notifications.innerHTML = `
                    <div class="loading">
                        No notifications yet.
                    </div>
                `;
                return;
            }

            snapshot.forEach((notificationDoc) => {

                const notification = notificationDoc.data();

                let time = "Just now";

                if (notification.createdAt) {
                    try {
                        time = notification.createdAt
                            .toDate()
                            .toLocaleString();
                    } catch (e) {}
                }

                let icon = "🔔";

                switch (notification.type) {
                    case "like":
                        icon = "❤️";
                        break;

                    case "comment":
                        icon = "💬";
                        break;

                    case "follow":
                        icon = "👤";
                        break;

                    case "message":
                        icon = "📩";
                        break;
                }

                const card = document.createElement("div");
                card.className = "notification-card";

                if (!notification.read) {
                    card.style.background = "#eef5ff";
                }

                card.innerHTML = `
                    <img
                        src="${notification.senderPhoto || 'https://via.placeholder.com/50'}"
                        style="
                            width:40px;
                            height:40px;
                            border-radius:50%;
                            object-fit:cover;
                        ">

                    <div class="notification-text">
                        <b>${notification.senderName || "Someone"}</b>
                        <br>
                        ${icon} ${notification.text || "New notification"}
                        <br>
                        <small>${time}</small>
                    </div>

                    ${
                        notification.read
                            ? ""
                            : `<span class="unread-dot">●</span>`
                    }
                `;

                card.onclick = async () => {

                    try {

                        await updateDoc(
                            doc(db, "notifications", notificationDoc.id),
                            {
                                read: true
                            }
                        );

                        if (notification.postId) {
                            window.location.href =
                                `comments.html?postId=${notification.postId}`;
                        } else if (notification.senderId) {
                            window.location.href =
                                `profile.html?uid=${notification.senderId}`;
                        }

                    } catch (error) {
                        console.error(error);
                        alert("Failed to open notification.");
                    }

                };

                notifications.appendChild(card);

            });

        },
        (error) => {

            console.error(error);

            notifications.innerHTML = `
                <div class="loading">
                    Failed to load notifications.
                </div>
            `;

        }
    );

});