import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const notifications =
document.getElementById("notifications");

auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const q = query(
        collection(db, "notifications"),
        where("receiverId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {

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
                time = notification.createdAt
                    .toDate()
                    .toLocaleString();
            }

            const card = document.createElement("div");

            card.style.background = "#fff";
            card.style.padding = "15px";
            card.style.borderRadius = "12px";
            card.style.display = "flex";
            card.style.gap = "12px";
            card.style.alignItems = "center";
            card.style.cursor = "pointer";
            card.style.boxShadow = "0 2px 8px rgba(0,0,0,.1)";

            card.innerHTML = `
                <img src="${notification.senderPhoto || 'https://via.placeholder.com/50'}"
                style="width:50px;height:50px;border-radius:50%;object-fit:cover;">

                <div style="flex:1;">
                    <b>${notification.senderName}</b><br>
                    ${notification.text}<br>
                    <small style="color:gray">${time}</small>
                </div>

                ${notification.read ? "" : "<span style='color:red;font-size:22px;'>●</span>"}
            `;

            card.onclick = async () => {

                await updateDoc(doc(db, "notifications", notificationDoc.id), {
                    read: true
                });

                if (notification.postId) {
                    window.location.href =
                        "comments.html?postId=" + notification.postId;
                } else if (notification.senderId) {
                    window.location.href =
                        "profile.html?uid=" + notification.senderId;
                }

            };

            notifications.appendChild(card);

        });

    });

}); 