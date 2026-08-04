import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OWNER_UID = "FvbfTXi65VgpuPtBxr8kGzBRLRr1";
const usersContainer = document.getElementById("users");

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    if (user.uid !== OWNER_UID) {
        alert("Access Denied!");
        location.href = "index.html";
        return;
    }

    loadUsers();

});

async function loadUsers() {

    usersContainer.innerHTML = "<h3>Loading users...</h3>";

    const snapshot = await getDocs(collection(db, "users"));

    usersContainer.innerHTML = "";

    snapshot.forEach((userDoc) => {

        const data = userDoc.data();

        const card = document.createElement("div");
        card.className = "user";

        const image = data.profilePicture || "https://via.placeholder.com/60";

        const ownerBadge = userDoc.id === OWNER_UID
            ? `<span class="badge">👑 OWNER</span>`
            : "";

        const banned = data.banned === true;

        card.innerHTML = `
            <img src="${image}">

            <div class="info">
                <h3>${data.fullName || "No Name"} ${ownerBadge}</h3>

                <p>@${data.username || ""}</p>

                <p>${data.email || ""}</p>

                <p>Status:
                    <b style="color:${banned ? "red" : "green"}">
                        ${banned ? "Banned" : "Active"}
                    </b>
                </p>
            </div>

            ${
                userDoc.id === OWNER_UID
                    ? ""
                    : `
                <button class="btn ban">
                    ${banned ? "Unban" : "Ban"}
                </button>
            `
            }
        `;

        const banButton = card.querySelector(".ban");

        if (banButton) {

            banButton.onclick = async () => {

                await updateDoc(doc(db, "users", userDoc.id), {
                    banned: !banned
                });

                loadUsers();

            };

        }

        usersContainer.appendChild(card);

    });

}