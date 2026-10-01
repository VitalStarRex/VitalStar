// ============================================================
// VITALSTAR — USERS / DISCOVER PAGE
// Profile Pictures + Groups + Search + Friends + Chat
// Dark + Yellow Theme
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
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// AUTH
// ============================================================

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
});


// ============================================================
// ELEMENTS
// ============================================================

const usersList = document.getElementById("usersList");
const searchInput = document.getElementById("searchInput");


// ============================================================
// STATE
// ============================================================

let allUsers = [];


// ============================================================
// DARK + YELLOW PAGE STYLE
// ============================================================

function injectStyles() {

    if (document.getElementById("vitalstarUsersStyles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "vitalstarUsersStyles";

    style.textContent = `

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            min-height: 100%;
            background:
                radial-gradient(circle at top, #332800 0%, #11100a 35%, #050505 75%);
            color: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
        }

        body {
            min-height: 100vh;
            padding-bottom: 82px;
        }

        #usersList {
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 12px;
        }

        .users-header {
            padding: 20px 15px 10px;
            max-width: 700px;
            margin: auto;
        }

        .users-title {
            font-size: 26px;
            font-weight: 800;
            color: #ffd400;
            margin-bottom: 5px;
            text-shadow: 0 0 12px rgba(255, 212, 0, .35);
        }

        .users-subtitle {
            color: #aaa;
            font-size: 14px;
        }

        .users-search {
            max-width: 700px;
            margin: 12px auto;
            padding: 0 12px;
        }

        .users-search input {
            width: 100%;
            height: 48px;
            padding: 0 18px;
            border-radius: 25px;
            border: 1px solid #ffd400;
            outline: none;
            background: #101010;
            color: white;
            font-size: 15px;
            box-shadow:
                0 0 12px rgba(255, 212, 0, .12),
                inset 0 0 10px rgba(255,255,255,.02);
        }

        .users-search input:focus {
            box-shadow:
                0 0 18px rgba(255, 212, 0, .25);
        }

        .users-search input::placeholder {
            color: #777;
        }

        .user-card {
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            margin-bottom: 12px;
            padding: 14px;
            border: 1px solid rgba(255, 212, 0, .25);
            border-radius: 18px;
            background:
                linear-gradient(
                    145deg,
                    rgba(35, 35, 35, .98),
                    rgba(10, 10, 10, .98)
                );
            box-shadow:
                0 5px 20px rgba(0,0,0,.35),
                0 0 10px rgba(255,212,0,.04);
        }

        .user-card:hover {
            border-color: #ffd400;
        }

        .user-avatar-wrap {
            position: relative;
            flex-shrink: 0;
        }

        .user-avatar {
            width: 58px;
            height: 58px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #ffd400;
            background: #171717;
            display: block;
        }

        .initial-avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffd400;
            font-size: 23px;
            font-weight: 800;
        }

        .group-indicator {
            position: absolute;
            right: -3px;
            bottom: -2px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #ffd400;
            color: #111;
            border: 2px solid #111;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            box-shadow: 0 0 8px rgba(255,212,0,.6);
        }

        .user-info {
            flex: 1;
            min-width: 0;
        }

        .user-name-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .user-name {
            color: #fff;
            font-weight: 800;
            font-size: 16px;
        }

        .verified {
            color: #ffd400;
            font-size: 14px;
        }

        .group-label {
            padding: 2px 7px;
            border-radius: 10px;
            background: rgba(255,212,0,.12);
            color: #ffd400;
            font-size: 10px;
            font-weight: 700;
        }

        .user-username {
            margin-top: 3px;
            color: #aaa;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .user-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        .user-btn {
            border: 0;
            border-radius: 13px;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: .2s ease;
        }

        .user-btn:hover {
            transform: translateY(-1px);
        }

        .add-friend-btn {
            background: #ffd400;
            color: #111;
            box-shadow: 0 0 10px rgba(255,212,0,.25);
        }

        .profile-btn {
            background: #202020;
            color: #ffd400;
            border: 1px solid #ffd400;
        }

        .chat-btn {
            background: #08264c;
            color: #fff;
            border: 1px solid #1260aa;
        }

        .user-btn:disabled {
            opacity: .55;
            cursor: not-allowed;
            transform: none;
        }

        .empty {
            text-align: center;
            padding: 50px 15px;
            color: #888;
        }

        .loading {
            text-align: center;
            padding: 50px;
            color: #ffd400;
        }

        .vitalstar-spinner {
            width: 35px;
            height: 35px;
            margin: 0 auto 12px;
            border: 3px solid #333;
            border-top-color: #ffd400;
            border-right-color: #fff;
            border-radius: 50%;
            animation: vsSpin .8s linear infinite;
        }

        @keyframes vsSpin {
            to {
                transform: rotate(360deg);
            }
        }

        .vitalstar-footer {
            position: fixed;
            z-index: 9999;
            left: 0;
            right: 0;
            bottom: 0;
            height: 68px;
            display: flex;
            justify-content: space-around;
            align-items: center;
            background: rgba(3, 5, 10, .97);
            border-top: 1px solid #ffd400;
            box-shadow: 0 -5px 20px rgba(0,0,0,.5);
            backdrop-filter: blur(10px);
        }

        .footer-btn {
            flex: 1;
            max-width: 100px;
            height: 54px;
            border: 0;
            background: transparent;
            color: #aaa;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
        }

        .footer-icon {
            display: block;
            font-size: 21px;
            margin-bottom: 2px;
        }

        .footer-btn.active {
            color: #ffd400;
            text-shadow: 0 0 10px rgba(255,212,0,.4);
        }

        @media (max-width: 600px) {

            .user-card {
                align-items: flex-start;
            }

            .user-actions {
                width: 100%;
                margin-top: 8px;
                justify-content: flex-start;
            }

            .user-card {
                flex-wrap: wrap;
            }

            .user-info {
                width: calc(100% - 75px);
            }
        }

    `;

    document.head.appendChild(style);
}

injectStyles();


// ============================================================
// LOADING
// ============================================================

function showLoading() {

    usersList.innerHTML = `
        <div class="loading">
            <div class="vitalstar-spinner"></div>
            Loading users...
        </div>
    `;
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


// ============================================================
// ESCAPE ATTRIBUTE
// ============================================================

function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// ============================================================
// FRIEND KEY
// ============================================================

function friendKey(uid1, uid2) {

    return [uid1, uid2].sort().join("_");
}


// ============================================================
// CHECK IF FRIEND
// ============================================================

async function checkIfFriends(uid1, uid2) {

    if (!uid1 || !uid2) return false;

    try {

        const key = friendKey(uid1, uid2);

        const directFriend = await getDoc(
            doc(db, "friends", key)
        );

        if (directFriend.exists()) {
            return true;
        }

        const friendsQuery = query(
            collection(db, "friends"),
            where("users", "array-contains", uid1)
        );

        const snapshot = await getDocs(friendsQuery);

        return snapshot.docs.some((friendDoc) => {

            const data = friendDoc.data();

            return Array.isArray(data.users) &&
                data.users.includes(uid2);

        });

    } catch (error) {

        console.error("Friend check failed:", error);

        return false;
    }
}


// ============================================================
// CHECK PENDING REQUEST
// ============================================================

async function checkPendingRequest(from, to) {

    try {

        const sentQuery = query(
            collection(db, "friendRequests"),
            where("from", "==", from),
            where("to", "==", to),
            where("status", "==", "pending")
        );

        const sentSnapshot = await getDocs(sentQuery);

        if (!sentSnapshot.empty) {
            return {
                exists: true,
                type: "sent",
                id: sentSnapshot.docs[0].id
            };
        }

        const receivedQuery = query(
            collection(db, "friendRequests"),
            where("from", "==", to),
            where("to", "==", from),
            where("status", "==", "pending")
        );

        const receivedSnapshot = await getDocs(receivedQuery);

        if (!receivedSnapshot.empty) {
            return {
                exists: true,
                type: "received",
                id: receivedSnapshot.docs[0].id
            };
        }

        return {
            exists: false
        };

    } catch (error) {

        console.error("Request check failed:", error);

        return {
            exists: false
        };
    }
}


// ============================================================
// ADD FRIEND
// ============================================================

async function addFriend(uid, button) {

    if (!currentUser || !uid) return;

    if (uid === currentUser.uid) {
        return;
    }

    button.disabled = true;
    button.textContent = "Checking...";

    try {

        const alreadyFriends = await checkIfFriends(
            currentUser.uid,
            uid
        );

        if (alreadyFriends) {

            button.textContent = "✓ Friends";
            return;
        }

        const request = await checkPendingRequest(
            currentUser.uid,
            uid
        );

        if (request.exists) {

            if (request.type === "sent") {

                button.textContent = "Request Sent";

            } else {

                button.textContent = "Request Received";
            }

            return;
        }

        await addDoc(
            collection(db, "friendRequests"),
            {
                from: currentUser.uid,
                to: uid,
                status: "pending",
                createdAt: serverTimestamp()
            }
        );

        button.textContent = "Request Sent";

    } catch (error) {

        console.error("Add friend error:", error);

        button.disabled = false;
        button.textContent = "➕ Add Friend";

        alert("Unable to send friend request.");
    }
}


// ============================================================
// UPDATE FRIEND BUTTONS
// ============================================================

async function updateFriendButtons() {

    if (!currentUser) return;

    const buttons = document.querySelectorAll(
        ".add-friend-btn"
    );

    for (const button of buttons) {

        const uid = button.dataset.uid;

        if (!uid || uid === currentUser.uid) {
            continue;
        }

        try {

            const friends = await checkIfFriends(
                currentUser.uid,
                uid
            );

            if (friends) {

                button.textContent = "✓ Friends";
                button.disabled = true;
                continue;
            }

            const request = await checkPendingRequest(
                currentUser.uid,
                uid
            );

            if (request.exists) {

                button.textContent =
                    request.type === "sent"
                        ? "Request Sent"
                        : "Request Received";

                button.disabled = true;
            }

        } catch (error) {

            console.error(
                "Unable to update friend button:",
                error
            );
        }
    }
}


// ============================================================
// RENDER USERS
// ============================================================

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

    usersList.innerHTML = users.map((user) => {

        const uid = escapeAttribute(user.id);

        const fullName =
            user.fullName ||
            user.name ||
            "VitalStar User";

        const username =
            user.username
                ? `@${String(user.username).replace(/^@/, "")}`
                : "";

        const safeName = escapeHtml(fullName);
        const safeUsername = escapeHtml(username);

        const firstLetter =
            String(fullName)
                .trim()
                .charAt(0)
                .toUpperCase() || "V";

        const profilePicture =
            user.profilePicture ||
            user.photoURL ||
            user.avatar ||
            "";

        const isGroup =
            user.isGroup === true ||
            user.accountType === "group" ||
            user.type === "group" ||
            user.userType === "group";

        const isVerified =
            user.verified === true ||
            user.isVerified === true;

        let avatarHTML;

        if (profilePicture) {

            avatarHTML = `
                <img
                    class="user-avatar"
                    src="${escapeAttribute(profilePicture)}"
                    alt="${safeName}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                >
                <div
                    class="user-avatar initial-avatar"
                    style="display:none;"
                >
                    ${escapeHtml(firstLetter)}
                </div>
            `;

        } else {

            avatarHTML = `
                <div class="user-avatar initial-avatar">
                    ${escapeHtml(firstLetter)}
                </div>
            `;
        }

        const groupIndicator = isGroup
            ? `<span class="group-indicator">👥</span>`
            : "";

        const groupLabel = isGroup
            ? `<span class="group-label">GROUP</span>`
            : "";

        const verified = isVerified
            ? `<span class="verified">✓</span>`
            : "";

        const isMe =
            currentUser &&
            user.id === currentUser.uid;

        return `
            <div class="user-card" data-uid="${uid}">

                <div class="user-avatar-wrap">
                    ${avatarHTML}
                    ${groupIndicator}
                </div>

                <div class="user-info">

                    <div class="user-name-row">

                        <span class="user-name">
                            ${safeName}
                        </span>

                        ${verified}
                        ${groupLabel}

                    </div>

                    ${
                        safeUsername
                            ? `<div class="user-username">${safeUsername}</div>`
                            : `<div class="user-username">VitalStar member</div>`
                    }

                </div>

                <div class="user-actions">

                    ${
                        !isMe
                            ? `
                            <button
                                class="user-btn add-friend-btn"
                                data-uid="${uid}"
                            >
                                ➕ Add Friend
                            </button>

                            <button
                                class="user-btn chat-btn"
                                data-action="chat"
                                data-uid="${uid}"
                            >
                                💬 Chat
                            </button>
                            `
                            : ""
                    }

                    <button
                        class="user-btn profile-btn"
                        data-action="profile"
                        data-uid="${uid}"
                    >
                        👤 Profile
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

showLoading();

const usersQuery = query(
    collection(db, "users"),
    orderBy("createdAt", "desc"),
    limit(50)
);

onSnapshot(
    usersQuery,

    (snapshot) => {

        allUsers = snapshot.docs
            .map((userDoc) => ({
                id: userDoc.id,
                ...userDoc.data()
            }))
            .filter((user) => {

                // Don't show yourself in Discover.
                return !currentUser ||
                    user.id !== currentUser.uid;
            });

        renderUsers(allUsers);
    },

    (error) => {

        console.error(
            "Error loading users:",
            error
        );

        usersList.innerHTML = `
            <div class="empty">
                ⚠️<br><br>
                Something went wrong loading users.
            </div>
        `;
    }
);


// ============================================================
// SEARCH
// ============================================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            const term =
                searchInput.value
                    .trim()
                    .toLowerCase();

            if (!term) {

                renderUsers(allUsers);
                return;
            }

            const filtered =
                allUsers.filter((user) => {

                    const name =
                        String(
                            user.fullName ||
                            user.name ||
                            ""
                        ).toLowerCase();

                    const username =
                        String(
                            user.username ||
                            ""
                        )
                        .replace(/^@/, "")
                        .toLowerCase();

                    return (
                        name.includes(term) ||
                        username.includes(
                            term.replace(/^@/, "")
                        )
                    );
                });

            renderUsers(filtered);
        }
    );
}


// ============================================================
// BUTTON ACTIONS
// ============================================================

usersList.addEventListener(
    "click",
    async (event) => {

        const button =
            event.target.closest("button");

        if (!button) return;

        const uid = button.dataset.uid;

        if (!uid) return;


        // ADD FRIEND
        if (
            button.classList.contains(
                "add-friend-btn"
            )
        ) {

            await addFriend(
                uid,
                button
            );

            return;
        }


        // VIEW PROFILE
        if (
            button.dataset.action ===
            "profile"
        ) {

            window.location.href =
                `profile.html?uid=${encodeURIComponent(uid)}`;

            return;
        }


        // CHAT
        if (
            button.dataset.action ===
            "chat"
        ) {

            window.location.href =
                `chat.html?uid=${encodeURIComponent(uid)}`;

            return;
        }

    }
);


// ============================================================
// VITALSTAR FOOTER
// ============================================================

function createFooter() {

    if (
        document.getElementById(
            "vitalstarUsersFooter"
        )
    ) {
        return;
    }

    const footer =
        document.createElement("footer");

    footer.id =
        "vitalstarUsersFooter";

    footer.className =
        "vitalstar-footer";

    footer.innerHTML = `

        <button
            class="footer-btn"
            data-page="home.html"
        >
            <span class="footer-icon">🏠</span>
            Home
        </button>

        <button
            class="footer-btn active"
        >
            <span class="footer-icon">👥</span>
            Discover
        </button>

        <button
            class="footer-btn"
            data-page="create-post.html"
        >
            <span class="footer-icon">＋</span>
            Create
        </button>

        <button
            class="footer-btn"
            data-page="chat.html"
        >
            <span class="footer-icon">💬</span>
            Chat
        </button>

        <button
            class="footer-btn"
            data-page="profile.html"
        >
            <span class="footer-icon">👤</span>
            Profile
        </button>

    `;

    document.body.appendChild(footer);


    footer.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    "[data-page]"
                );

            if (!button) return;

            const page =
                button.dataset.page;

            if (page === "profile.html") {

                if (currentUser) {

                    window.location.href =
                        `profile.html?uid=${encodeURIComponent(
                            currentUser.uid
                        )}`;
                }

                return;
            }

            window.location.href = page;
        }
    );
}

createFooter();


// ============================================================
// SEARCH INPUT AUTO-CREATION
// ============================================================

if (!searchInput) {

    const header =
        document.createElement("div");

    header.className =
        "users-header";

    header.innerHTML = `
        <div class="users-title">
            Discover
        </div>

        <div class="users-subtitle">
            Find people and groups on VitalStar
        </div>
    `;

    const searchBox =
        document.createElement("div");

    searchBox.className =
        "users-search";

    searchBox.innerHTML = `
        <input
            id="vitalstarSearchInput"
            type="search"
            placeholder="🔎 Search people or @username..."
            autocomplete="off"
        >
    `;

    usersList.parentNode.insertBefore(
        header,
        usersList
    );

    usersList.parentNode.insertBefore(
        searchBox,
        usersList
    );

    const newSearch =
        document.getElementById(
            "vitalstarSearchInput"
        );

    newSearch.addEventListener(
        "input",
        () => {

            const term =
                newSearch.value
                    .trim()
                    .toLowerCase()
                    .replace(/^@/, "");

            if (!term) {

                renderUsers(allUsers);
                return;
            }

            const filtered =
                allUsers.filter((user) => {

                    const name =
                        String(
                            user.fullName ||
                            user.name ||
                            ""
                        ).toLowerCase();

                    const username =
                        String(
                            user.username ||
                            ""
                        )
                        .replace(/^@/, "")
                        .toLowerCase();

                    return (
                        name.includes(term) ||
                        username.includes(term)
                    );
                });

            renderUsers(filtered);
        }
    );
}