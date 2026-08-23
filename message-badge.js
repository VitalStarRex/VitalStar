import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// VITALSTAR — MESSAGE BADGE
// Shows unread message count
// Displays 0 when there are no unread messages
// ============================================================

const messageBadge = document.getElementById("messageBadge");


// ============================================================
// INITIAL STATE
// ============================================================

if (messageBadge) {

    messageBadge.textContent = "0";

    messageBadge.style.display = "flex";

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, (user) => {

    // User is logged out
    if (!user) {

        if (messageBadge) {

            messageBadge.textContent = "0";
            messageBadge.style.display = "flex";

        }

        return;
    }


    // Badge element does not exist
    if (!messageBadge) return;


    // ========================================================
    // FIND UNREAD CHATS
    // ========================================================

    const q = query(
        collection(db, "chats"),

        where(
            "lastReceiverId",
            "==",
            user.uid
        ),

        where(
            "lastRead",
            "==",
            false
        )
    );


    // ========================================================
    // REAL-TIME LISTENER
    // ========================================================

    onSnapshot(
        q,

        (snapshot) => {

            const unread = snapshot.size;


            // ==================================================
            // SHOW COUNT
            // ==================================================

            messageBadge.textContent = String(unread);

            messageBadge.style.display = "flex";

        },


        (error) => {

            console.error(
                "Message badge error:",
                error
            );


            // Keep badge visible as 0 if there is an error
            messageBadge.textContent = "0";

            messageBadge.style.display = "flex";

        }
    );

});