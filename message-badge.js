import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
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

    const q = query(
        collection(db, "chats"),
        where("lastReceiverId", "==", user.uid),
        where("lastRead", "==", false)
    );

    onSnapshot(q, (snapshot) => {

        const unread = snapshot.size;

        if (unread > 0) {

            messageBadge.textContent = unread;
            messageBadge.style.display = "flex";

        } else {

            messageBadge.textContent = "";
            messageBadge.style.display = "none";

        }

    }, (error) => {

        console.error(error);

    });

});