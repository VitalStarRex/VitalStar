// ============================================================
// VITALSTAR — USERS / DISCOVER PAGE
// Theme, header, search box and bottom nav now live in users.html.
// This file only handles data: users, friendship status, buttons.
// Firebase v10.12.2
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    getDoc,
    getDocs,
    where,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// ELEMENTS + STATE
// ============================================================

const usersList = document.getElementById("usersList");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let allUsers = [];
let unsubscribeUsers = null;

// uid -> "friends" | "sent" | "received"
const friendStatus = new Map();

let usersReady = false;
let statusReady = false;


// ============================================================
// TINY INDICATOR
// Stays visible until users AND friendship status are loaded.
// It never blocks taps, so every button stays usable.
// ============================================================

function maybeFinishLoading() {
    if (usersReady && statusReady) {
        window.hideUsersLoader?.();
    }
}


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function escapeAttribute(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function friendKey(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

function getPicture(user) {
    const candidates = [
        user.profilePic,
        user.profilePicture,
        user.photoURL,
        user.photoUrl,
        user.profileImage,
        user.avatar
    ];

    for (const candidate of candidates) {
        const value = typeof candidate === "string" ? candidate.trim() : "";
        if (value && /^(https?:|data:image\/|blob:)/i.test(value)) {
            return value;
        }
    }
    return "";
}


// ============================================================
// FRIENDSHIP STATUS — BULK LOAD (3 queries total)
// Used to be up to 4 queries PER user, on every render/search.
// ============================================================

async function safeGetDocs(q, label) {
    try {
        return await getDocs(q);
    } catch (error) {
        console.error(label, error);
        return null;
    }
}

async function loadFriendStatuses(myUid) {
    friendStatus.clear();

    const [friendsSnap, sentSnap, receivedSnap] = await Promise.all([
        safeGetDocs(
            query(collection(db, "friends"), where("users", "array-contains", myUid)),
            "Friends load:"
        ),
        safeGetDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", myUid),
                where("status", "==", "pending")
            ),
            "Sent requests load:"
        ),
        safeGetDocs(
            query(
                collection(db, "friendRequests"),
                where("to", "==", myUid),
                where("status", "==", "pending")
            ),
            "Received requests load:"
        )
    ]);

    // Priority (lowest -> highest): received, sent, friends
    receivedSnap?.forEach(requestDoc => {
        const from = requestDoc.data().from;
        if (from) friendStatus.set(from, "received");
    });

    sentSnap?.forEach(requestDoc => {
        const to = requestDoc.data().to;
        if (to) friendStatus.set(to, "sent");
    });

    friendsSnap?.forEach(friendDoc => {
        const users = friendDoc.data().users;
        if (!Array.isArray(users)) return;
        const other = users.find(id => id !== myUid);
        if (other) friendStatus.set(other, "friends");
    });
}


// ============================================================
// SINGLE CHECKS (used right before sending a request)
// ============================================================

async function checkIfFriends(uid1, uid2) {
    try {
        const direct = await getDoc(doc(db, "friends", friendKey(uid1, uid2)));
        if (direct.exists()) return true;

        const snapshot = await getDocs(
            query(collection(db, "friends"), where("users", "array-contains", uid1))
        );

        return snapshot.docs.some(friendDoc => {
            const data = friendDoc.data();
            return Array.isArray(data.users) && data.users.includes(uid2);
        });
    } catch (error) {
        console.error("Friend check:", error);
        return false;
    }
}

async function checkPendingRequest(from, to) {
    try {
        const sent = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", from),
                where("to", "==", to),
                where("status", "==", "pending")
            )
        );
        if (!sent.empty) return { exists: true, type: "sent" };

        const received = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", to),
                where("to", "==", from),
                where("status", "==", "pending")
            )
        );
        if (!received.empty) return { exists: true, type: "received" };

        return { exists: false };
    } catch (error) {
        console.error("Request check:", error);
        return { exists: false };
    }
}


// ============================================================
// FRIEND BUTTON STATE
// ============================================================

function setFriendButton(button) {
    const uid = button.dataset.uid;

    button.classList.remove("checking");

    if (!statusReady) {
        button.disabled = true;
        button.classList.add("checking");
        button.textContent = "Checking...";
        return;
    }

    const status = friendStatus.get(uid);

    if (status === "friends") {
        button.disabled = true;
        button.textContent = "✓ Friends";
    } else if (status === "sent") {
        button.disabled = true;
        button.textContent = "Request Sent";
    } else if (status === "received") {
        button.disabled = true;
        button.textContent = "Request Received";
    } else {
        button.disabled = false;
        button.textContent = "➕ Add Friend";
    }
}

function updateFriendButtons() {
    usersList
        .querySelectorAll(".add-friend-btn")
        .forEach(setFriendButton);
}


// ============================================================
// ADD FRIEND
// ============================================================

async function addFriend(uid, button) {
    if (!currentUser || !uid || uid === currentUser.uid) return;

    button.disabled = true;
    button.textContent = "Checking...";

    try {
        if (await checkIfFriends(currentUser.uid, uid)) {
            friendStatus.set(uid, "friends");
            setFriendButton(button);
            return;
        }

        const request = await checkPendingRequest(currentUser.uid, uid);

        if (request.exists) {
            friendStatus.set(uid, request.type);
            setFriendButton(button);
            return;
        }

        await addDoc(collection(db, "friendRequests"), {
            from: currentUser.uid,
            to: uid,
            status: "pending",
            createdAt: serverTimestamp()
        });

        friendStatus.set(uid, "sent");
        setFriendButton(button);

    } catch (error) {
        console.error("Add friend:", error);
        button.disabled = false;
        button.textContent = "➕ Add Friend";
    }
}


// ============================================================
// RENDER USERS
// ============================================================

function getFilteredUsers() {
    const term = (searchInput?.value || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "");

    if (!term) return allUsers;

    return allUsers.filter(user => {
        const name = String(user.fullName || user.name || "").toLowerCase();
        const username = String(user.username || "").replace(/^@/, "").toLowerCase();
        return name.includes(term) || username.includes(term);
    });
}

function renderUsers(users) {
    if (!users.length) {
        usersList.innerHTML = `
            <div class="empty">
                🔎<br><br>
                No users found.
            </div>
        `;
        return;
    }

    usersList.innerHTML = users.map(user => {
        const uid = escapeAttribute(user.id);
        const name = user.fullName || user.name || "VitalStar User";

        const username = user.username
            ? "@" + String(user.username).replace(/^@/, "")
            : "";

        const picture = getPicture(user);

        const isGroup =
            user.isGroup === true ||
            user.accountType === "group" ||
            user.type === "group" ||
            user.userType === "group";

        const verified = user.verified === true || user.isVerified === true;

        const initial = String(name).trim().charAt(0).toUpperCase() || "V";

        const avatar = picture
            ? `
                <img class="user-avatar" src="${escapeAttribute(picture)}"
                     alt="${escapeAttribute(name)}" loading="lazy"
                     referrerpolicy="no-referrer">
                <div class="user-avatar initial-avatar" style="display:none;">
                    ${escapeHtml(initial)}
                </div>
            `
            : `<div class="user-avatar initial-avatar">${escapeHtml(initial)}</div>`;

        return `
            <div class="user-card" data-uid="${uid}">

                <div class="user-avatar-wrap">
                    ${avatar}
                    ${isGroup ? `<span class="group-indicator">👥</span>` : ""}
                </div>

                <div class="user-info">
                    <div class="user-name-row">
                        <span class="user-name">${escapeHtml(name)}</span>
                        ${verified ? `<span class="verified">✓</span>` : ""}
                        ${isGroup ? `<span class="group-label">GROUP</span>` : ""}
                    </div>

                    <div class="user-username">
                        ${username ? escapeHtml(username) : "VitalStar member"}
                    </div>
                </div>

                <div class="user-actions">
                    <button class="user-btn add-friend-btn" data-uid="${uid}">
                        ➕ Add Friend
                    </button>

                    <button class="user-btn profile-btn" data-action="profile" data-uid="${uid}">
                        👤 Profile
                    </button>

                    <button class="user-btn chat-btn" data-action="chat" data-uid="${uid}">
                        💬 Chat
                    </button>
                </div>

            </div>
        `;
    }).join("");

    updateFriendButtons();
}


// ============================================================
// LOAD USERS
// ============================================================

function loadUsers() {
    const usersQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc"),
        limit(50)
    );

    unsubscribeUsers = onSnapshot(
        usersQuery,

        snapshot => {
            allUsers = snapshot.docs
                .map(userDoc => ({ id: userDoc.id, ...userDoc.data() }))
                .filter(user => !currentUser || user.id !== currentUser.uid);

            // Keeps the current search filter when live updates arrive
            renderUsers(getFilteredUsers());

            usersReady = true;
            maybeFinishLoading();
        },

        error => {
            console.error("Loading users:", error);

            usersList.innerHTML = `
                <div class="empty">
                    ⚠️<br><br>
                    Something went wrong loading users.
                </div>
            `;

            usersReady = true;
            statusReady = true;
            window.hideUsersLoader?.();
        }
    );
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async user => {
    // Prevents duplicate listeners if auth fires more than once
    if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
    }

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    usersReady = false;
    statusReady = false;

    // Cards appear right away; Add Friend buttons show "Checking..."
    // while Profile / Chat / navigation stay fully clickable.
    loadUsers();

    await loadFriendStatuses(user.uid);

    statusReady = true;
    updateFriendButtons();
    maybeFinishLoading();
});

window.addEventListener("pagehide", () => {
    if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
    }
});


// ============================================================
// SEARCH
// ============================================================

searchInput?.addEventListener("input", () => {
    renderUsers(getFilteredUsers());
});


// ============================================================
// AVATAR FALLBACK (error events don't bubble, so use capture)
// ============================================================

usersList.addEventListener("error", event => {
    const image = event.target;
    if (!image || !image.matches?.("img.user-avatar")) return;

    image.style.display = "none";
    const fallback = image.nextElementSibling;
    if (fallback) fallback.style.display = "flex";
}, true);


// ============================================================
// USER BUTTONS
// ============================================================

usersList.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;

    const uid = button.dataset.uid;
    if (!uid) return;

    if (button.classList.contains("add-friend-btn")) {
        await addFriend(uid, button);
        return;
    }

    if (button.dataset.action === "profile") {
        window.location.href = `profile.html?uid=${encodeURIComponent(uid)}`;
        return;
    }

    if (button.dataset.action === "chat") {
        window.location.href = `chat.html?uid=${encodeURIComponent(uid)}`;
    }
});
