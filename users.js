import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});

const usersList = document.getElementById("usersList");
const searchInput = document.getElementById("searchInput"); // add this input in your HTML, see note below

let allUsers = []; // keeps the currently loaded (latest 20) users, used for search filtering

// NOTE: this assumes your user documents have a "createdAt" timestamp field.
// If your field is named differently (e.g. "joinedAt"), change it below.
const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc"),
    limit(20)
);

onSnapshot(
    q,
    (snapshot) => {
        allUsers = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
        renderUsers(allUsers);
    },
    (error) => {
        console.error("Error loading users:", error);
        usersList.innerHTML = `<p class="empty">Something went wrong loading users.</p>`;
    }
);

// Escapes text before inserting into HTML, prevents broken markup / XSS from user-entered names
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderUsers(users) {
    if (users.length === 0) {
        usersList.innerHTML = `<p class="empty">No users found.</p>`;
        return;
    }

    // Build the full HTML string once, then set it — avoids repeated reflows from innerHTML +=
    usersList.innerHTML = users
        .map((user) => {
            const name = escapeHtml(user.fullName || "User");
            return `
            <div class="user" data-uid="${user.id}">
                <div class="avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="info">
                    <div class="name">${name}</div>
                    <div class="status">Tap to chat</div>
                </div>
            </div>
        `;
        })
        .join("");
}

// Handles clicks on any user card (safer than inline onclick attributes)
usersList.addEventListener("click", (e) => {
    const card = e.target.closest(".user");
    if (card) {
        window.location.href = `profile.html?uid=${card.dataset.uid}`;
    }
});

// Live search — filters the already-loaded users by name as you type
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();
        const filtered = allUsers.filter((u) =>
            (u.fullName || "").toLowerCase().includes(term)
        );
        renderUsers(filtered);
    });
}