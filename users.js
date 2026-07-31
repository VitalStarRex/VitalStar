import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
});

const usersList = document.getElementById("usersList");

const q = query(
    collection(db, "users"),
    orderBy("fullName", "asc")
);

onSnapshot(q, (snapshot) => {

    usersList.innerHTML = "";

    snapshot.forEach((doc) => {

        const user = doc.data();
        const name = user.fullName || "User";

        usersList.innerHTML += `
            <div class="user" onclick="location.href='profile.html?uid=${doc.id}'">
                <div class="avatar">
                    ${name.charAt(0).toUpperCase()}
                </div>

                <div class="info">
                    <div class="name">${name}</div>
                    <div class="status">Tap to chat</div>
                </div>
            </div>
        `;

    });

});