import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collectionGroup,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const messageBadge = document.getElementById("messageBadge");

if (messageBadge) {
    messageBadge.style.display = "none";
}

onAuthStateChanged(auth, (user) => {

    if (!user || !messageBadge) return;

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid)
    );

    onSnapshot(chatsQuery, (snapshot) => {

        let unreadCount = 0;

        snapshot.forEach((chatDoc) => {

            const chat = chatDoc.data();

            if (
                chat.lastReceiverId === user.uid &&
                chat.lastRead === false
            ) {
                unreadCount++;
            }

        });

        if (unreadCount > 0) {
            messageBadge.textContent = unreadCount;
            messageBadge.style.display = "flex";
        } else {
            messageBadge.textContent = "";
            messageBadge.style.display = "none";
        }

    }, (error) => {

        console.error("Message badge error:", error);

    });

});