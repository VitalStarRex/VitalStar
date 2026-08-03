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

    const unreadQuery = query(
        collectionGroup(db, "messages"),
        where("receiverId", "==", user.uid),
        where("read", "==", false)
    );

    onSnapshot(unreadQuery, (snapshot) => {

        const unreadCount = snapshot.size;

        if (unreadCount > 0) {
            messageBadge.textContent = unreadCount;
            messageBadge.style.display = "flex";
        } else {
            messageBadge.textContent = "";
            messageBadge.style.display = "none";
        }

    }, (error) => {

    alert(error.message);

}); });