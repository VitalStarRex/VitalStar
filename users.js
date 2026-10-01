// ============================================================
// VITALSTAR — USERS / DISCOVER PAGE
// Dark Theme + VITALSTAR Green Loading Indicator
// Profile Pictures + Groups + Search + Friends + Chat
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
// STATE
// ============================================================

let currentUser = null;
let allUsers = [];


// ============================================================
// DARK THEME
// ============================================================

function applyDarkTheme() {

    document.documentElement.style.background = "#050914";

    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    document.body.style.background = `
        radial-gradient(
            circle at 50% -10%,
            #162c35 0%,
            #0b151c 30%,
            #050914 65%,
            #02040a 100%
        )
    `;
    document.body.style.color = "#fff";
    document.body.style.fontFamily =
        "Arial, Helvetica, sans-serif";
    document.body.style.paddingBottom = "82px";
}

applyDarkTheme();


// ============================================================
// VITALSTAR LOADING INDICATOR
// Same style as PROFILE page
// ============================================================

function showVitalStarLoader() {

    if (
        document.getElementById(
            "vitalstarFullscreenLoader"
        )
    ) {
        return;
    }

    const loader =
        document.createElement("div");

    loader.id =
        "vitalstarFullscreenLoader";

    loader.innerHTML = `
        <div class="vitalstar-loader-ring"></div>

        <div class="vitalstar-loader-ring reverse"></div>

        <div class="vitalstar-loader-content">
            <div class="vitalstar-loader-vs">
                VS
            </div>

            <div class="vitalstar-loader-text">
                Loading...
            </div>
        </div>
    `;

    document.body.appendChild(loader);
}


function removeVitalStarLoader() {

    const loader =
        document.getElementById(
            "vitalstarFullscreenLoader"
        );

    if (!loader) return;

    loader.style.opacity = "0";

    setTimeout(() => {
        loader.remove();
    }, 300);
}


// ============================================================
// STYLES
// ============================================================

function injectStyles() {

    if (
        document.getElementById(
            "vitalstarUsersStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "vitalstarUsersStyles";

    style.textContent = `

        * {
            box-sizing: border-box;
        }

        html,
        body {
            background: #050914 !important;
        }

        /* ====================================================
           VITALSTAR LOADER
           ==================================================== */

        #vitalstarFullscreenLoader {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            background:
                radial-gradient(
                    circle at center,
                    #10251f 0%,
                    #07120f 35%,
                    #020606 100%
                );
            transition: opacity .3s ease;
        }

        .vitalstar-loader-ring {
            position: absolute;
            width: 130px;
            height: 130px;
            border-radius: 50%;
            border: 4px solid transparent;
            border-top-color: #00ff88;
            border-right-color: #00eaff;
            border-bottom-color: #7c3cff;
            border-left-color: #ff2bd6;
            animation: vitalstarSpin 1.1s linear infinite;
            box-shadow:
                0 0 15px rgba(0,255,136,.45),
                0 0 30px rgba(0,234,255,.2);
        }

        .vitalstar-loader-ring.reverse {
            width: 105px;
            height: 105px;
            border: 2px dashed rgba(0,255,136,.7);
            animation:
                vitalstarSpinReverse 2s linear infinite;
            box-shadow:
                0 0 20px rgba(0,255,136,.2);
        }

        .vitalstar-loader-content {
            position: relative;
            z-index: 3;
            text-align: center;
        }

        .vitalstar-loader-vs {
            font-size: 34px;
            font-weight: 900;
            color: #fff;
            letter-spacing: 2px;
            text-shadow:
                0 0 8px #00ff88,
                0 0 18px #00ff88,
                0 0 30px #00eaff;
            animation: vitalstarPulse 1.2s ease-in-out infinite;
        }

        .vitalstar-loader-text {
            margin-top: 13px;
            color: #8affbd;
            font-size: 12px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        @keyframes vitalstarSpin {
            to {
                transform: rotate(360deg);
            }
        }

        @keyframes vitalstarSpinReverse {
            to {
                transform: rotate(-360deg);
            }
        }

        @keyframes vitalstarPulse {
            0%, 100% {
                transform: scale(1);
                opacity: .75;
            }

            50% {
                transform: scale(1.12);
                opacity: 1;
            }
        }


        /* ====================================================
           HEADER
           ==================================================== */

        .users-header {
            max-width: 700px;
            margin: 0 auto;
            padding: 22px 15px 8px;
        }

        .users-title {
            color: #fff;
            font-size: 27px;
            font-weight: 900;
            letter-spacing: .5px;
        }

        .users-title span {
            color: #ffd400;
        }

        .users-subtitle {
            margin-top: 5px;
            color: #87929c;
            font-size: 13px;
        }


        /* ====================================================
           SEARCH
           ==================================================== */

        .users-search {
            max-width: 700px;
            margin: 10px auto 14px;
            padding: 0 12px;
        }

        .users-search input {
            width: 100%;
            height: 48px;
            padding: 0 18px;
            border-radius: 25px;
            border: 1px solid #26323b;
            outline: none;
            background: #0a1118;
            color: #fff;
            font-size: 15px;
            box-shadow:
                inset 0 0 12px rgba(0,0,0,.5),
                0 0 12px rgba(0,0,0,.25);
        }

        .users-search input:focus {
            border-color: #ffd400;
            box-shadow:
                0 0 15px rgba(255,212,0,.15);
        }

        .users-search input::placeholder {
            color: #68727b;
        }


        /* ====================================================
           USERS
           ==================================================== */

        #usersList {
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 0 12px;
        }

        .user-card {
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
            padding: 13px;
            border: 1px solid #1d2a33;
            border-radius: 18px;
            background:
                linear-gradient(
                    145deg,
                    #101923,
                    #080d13
                );
            box-shadow:
                0 7px 25px rgba(0,0,0,.4);
            transition: .2s ease;
        }

        .user-card:hover {
            border-color: rgba(255,212,0,.55);
            transform: translateY(-1px);
        }


        /* ====================================================
           PROFILE PICTURE
           ==================================================== */

        .user-avatar-wrap {
            position: relative;
            flex-shrink: 0;
        }

        .user-avatar {
            width: 59px;
            height: 59px;
            border-radius: 50%;
            object-fit: cover;
            display: block;
            border: 2px solid #ffd400;
            background: #101820;
        }

        .initial-avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffd400;
            font-size: 23px;
            font-weight: 900;
        }


        /* ====================================================
           GROUP INDICATOR
           ==================================================== */

        .group-indicator {
            position: absolute;
            right: -3px;
            bottom: -2px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffd400;
            color: #111;
            border: 2px solid #080d13;
            font-size: 11px;
            box-shadow:
                0 0 10px rgba(255,212,0,.55);
        }


        /* ====================================================
           USER INFO
           ==================================================== */

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
            font-size: 16px;
            font-weight: 800;
        }

        .verified {
            color: #ffd400;
            font-size: 13px;
        }

        .group-label {
            padding: 3px 7px;
            border-radius: 9px;
            background: rgba(255,212,0,.1);
            color: #ffd400;
            font-size: 9px;
            font-weight: 800;
        }

        .user-username {
            margin-top: 4px;
            color: #7e8993;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }


        /* ====================================================
           BUTTONS
           ==================================================== */

        .user-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: flex-end;
        }

        .user-btn {
            border-radius: 12px;
            padding: 8px 10px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
            transition: .2s ease;
        }

        .user-btn:active {
            transform: scale(.95);
        }

        .add-friend-btn {
            border: 1px solid #ffd400;
            background: #ffd400;
            color: #111;
            box-shadow:
                0 0 10px rgba(255,212,0,.18);
        }

        .profile-btn {
            border: 1px solid #35434d;
            background: #121b23;
            color: #fff;
        }

        .chat-btn {
            border: 1px solid #1265a5;
            background: #08294c;
            color: #fff;
        }

        .user-btn:disabled {
            opacity: .55;
            cursor: not-allowed;
        }


        /* ====================================================
           EMPTY / ERROR
           ==================================================== */

        .empty {
            padding: 60px 15px;
            text-align: center;
            color: #77828c;
            font-size: 14px;
        }


        /* ====================================================
           FOOTER
           ==================================================== */

        .vitalstar-footer {
            position: fixed;
            z-index: 9999;
            left: 0;
            right: 0;
            bottom: 0;
            height: 68px;
            display: flex;
            align-items: center;
            justify-content: space-around;
            background: rgba(3,7,11,.97);
            border-top: 1px solid #18232b;
            box-shadow:
                0 -5px 20px rgba(0,0,0,.55);
            backdrop-filter: blur(12px);
        }

        .footer-btn {
            flex: 1;
            max-width: 100px;
            height: 58px;
            border: 0;
            background: transparent;
            color: #69747d;
            font-size: 10px;
            font-weight: 700;
            cursor: pointer;
        }

        .footer-icon {
            display: block;
            margin-bottom: 3px;
            font-size: 21px;
        }

        .footer-btn.active {
            color: #ffd400;
            text-shadow:
                0 0 10px rgba(255,212,0,.35);
        }


        /* ====================================================
           MOBILE
           ==================================================== */

        @media (max-width: 600px) {

            .user-card {
                flex-wrap: wrap;
                align-items: flex-start;
            }

            .user-info {
                width: calc(100% - 75px);
            }

            .user-actions {
                width: 100%;
                padding-left: 71px;
                justify-content: flex-start;
            }

        }

    `;

    document.head.appendChild(style);
}

injectStyles();


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href =
            "login.html";

        return;
    }

    currentUser = user;

    showVitalStarLoader();

    loadUsers();
});


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

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

    return [uid1, uid2]
        .sort()
        .join("_");
}


// ============================================================
// CHECK FRIEND
// ============================================================

async function checkIfFriends(uid1, uid2) {

    try {

        const key =
            friendKey(uid1, uid2);

        const direct =
            await getDoc(
                doc(db, "friends", key)
            );

        if (direct.exists()) {
            return true;
        }

        const q =
            query(
                collection(db, "friends"),
                where(
                    "users",
                    "array-contains",
                    uid1
                )
            );

        const snapshot =
            await getDocs(q);

        return snapshot.docs.some(
            friendDoc => {

                const data =
                    friendDoc.data();

                return (
                    Array.isArray(data.users) &&
                    data.users.includes(uid2)
                );
            }
        );

    } catch (error) {

        console.error(
            "Friend check:",
            error
        );

        return false;
    }
}


// ============================================================
// CHECK REQUEST
// ============================================================

async function checkPendingRequest(
    from,
    to
) {

    try {

        const sentQuery =
            query(
                collection(db, "friendRequests"),
                where("from", "==", from),
                where("to", "==", to),
                where("status", "==", "pending")
            );

        const sent =
            await getDocs(sentQuery);

        if (!sent.empty) {

            return {
                exists: true,
                type: "sent"
            };
        }


        const receivedQuery =
            query(
                collection(db, "friendRequests"),
                where("from", "==", to),
                where("to", "==", from),
                where("status", "==", "pending")
            );

        const received =
            await getDocs(receivedQuery);

        if (!received.empty) {

            return {
                exists: true,
                type: "received"
            };
        }

        return {
            exists: false
        };

    } catch (error) {

        console.error(
            "Request check:",
            error
        );

        return {
            exists: false
        };
    }
}


// ============================================================
// ADD FRIEND
// ============================================================

async function addFriend(
    uid,
    button
) {

    if (
        !currentUser ||
        !uid ||
        uid === currentUser.uid
    ) {
        return;
    }

    button.disabled = true;
    button.textContent =
        "Checking...";

    try {

        const friends =
            await checkIfFriends(
                currentUser.uid,
                uid
            );

        if (friends) {

            button.textContent =
                "✓ Friends";

            return;
        }

        const request =
            await checkPendingRequest(
                currentUser.uid,
                uid
            );

        if (request.exists) {

            button.textContent =
                request.type === "sent"
                    ? "Request Sent"
                    : "Request Received";

            return;
        }

        await addDoc(
            collection(
                db,
                "friendRequests"
            ),
            {
                from: currentUser.uid,
                to: uid,
                status: "pending",
                createdAt:
                    serverTimestamp()
            }
        );

        button.textContent =
            "Request Sent";

    } catch (error) {

        console.error(
            "Add friend:",
            error
        );

        button.disabled = false;

        button.textContent =
            "➕ Add Friend";
    }
}


// ============================================================
// UPDATE FRIEND BUTTONS
// ============================================================

async function updateFriendButtons() {

    if (!currentUser) return;

    const buttons =
        document.querySelectorAll(
            ".add-friend-btn"
        );

    for (
        const button of buttons
    ) {

        const uid =
            button.dataset.uid;

        try {

            if (
                await checkIfFriends(
                    currentUser.uid,
                    uid
                )
            ) {

                button.textContent =
                    "✓ Friends";

                button.disabled = true;

                continue;
            }

            const request =
                await checkPendingRequest(
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

            console.error(error);
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

    usersList.innerHTML =
        users.map(user => {

            const uid =
                escapeAttribute(user.id);

            const name =
                user.fullName ||
                user.name ||
                "VitalStar User";

            const username =
                user.username
                    ? "@" +
                      String(user.username)
                        .replace(/^@/, "")
                    : "";

            const picture =
                user.profilePicture ||
                user.photoURL ||
                user.avatar ||
                "";

            const isGroup =
                user.isGroup === true ||
                user.accountType === "group" ||
                user.type === "group" ||
                user.userType === "group";

            const verified =
                user.verified === true ||
                user.isVerified === true;

            const initial =
                String(name)
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "V";

            let avatar;

            if (picture) {

                avatar = `
                    <img
                        class="user-avatar"
                        src="${escapeAttribute(picture)}"
                        alt="${escapeAttribute(name)}"
                        loading="lazy"
                        onerror="
                            this.style.display='none';
                            this.nextElementSibling.style.display='flex';
                        "
                    >

                    <div
                        class="user-avatar initial-avatar"
                        style="display:none;"
                    >
                        ${escapeHtml(initial)}
                    </div>
                `;

            } else {

                avatar = `
                    <div class="user-avatar initial-avatar">
                        ${escapeHtml(initial)}
                    </div>
                `;
            }

            const groupIndicator =
                isGroup
                    ? `<span class="group-indicator">👥</span>`
                    : "";

            const groupLabel =
                isGroup
                    ? `<span class="group-label">GROUP</span>`
                    : "";

            const verifiedIcon =
                verified
                    ? `<span class="verified">✓</span>`
                    : "";

            return `
                <div
                    class="user-card"
                    data-uid="${uid}"
                >

                    <div class="user-avatar-wrap">

                        ${avatar}

                        ${groupIndicator}

                    </div>


                    <div class="user-info">

                        <div class="user-name-row">

                            <span class="user-name">
                                ${escapeHtml(name)}
                            </span>

                            ${verifiedIcon}
                            ${groupLabel}

                        </div>

                        <div class="user-username">
                            ${
                                username
                                    ? escapeHtml(username)
                                    : "VitalStar member"
                            }
                        </div>

                    </div>


                    <div class="user-actions">

                        <button
                            class="user-btn add-friend-btn"
                            data-uid="${uid}"
                        >
                            ➕ Add Friend
                        </button>

                        <button
                            class="user-btn profile-btn"
                            data-action="profile"
                            data-uid="${uid}"
                        >
                            👤 Profile
                        </button>

                        <button
                            class="user-btn chat-btn"
                            data-action="chat"
                            data-uid="${uid}"
                        >
                            💬 Chat
                        </button>

                    </div>

                </div>
            `;

        }).join("");

    updateFriendButtons();
}


// ============================================================
// USERS LIST
// ============================================================

const usersList =
    document.getElementById(
        "usersList"
    );


// ============================================================
// LOAD USERS
// ============================================================

function loadUsers() {

    const usersQuery =
        query(
            collection(db, "users"),
            orderBy(
                "createdAt",
                "desc"
            ),
            limit(50)
        );

    onSnapshot(
        usersQuery,

        snapshot => {

            allUsers =
                snapshot.docs
                    .map(userDoc => ({
                        id: userDoc.id,
                        ...userDoc.data()
                    }))
                    .filter(
                        user =>
                            !currentUser ||
                            user.id !== currentUser.uid
                    );

            renderUsers(allUsers);

            removeVitalStarLoader();
        },

        error => {

            console.error(
                "Loading users:",
                error
            );

            usersList.innerHTML = `
                <div class="empty">
                    ⚠️<br><br>
                    Something went wrong loading users.
                </div>
            `;

            removeVitalStarLoader();
        }
    );
}


// ============================================================
// SEARCH
// ============================================================

function setupSearch() {

    let searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) {

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
            searchBox,
            usersList
        );

        searchInput =
            document.getElementById(
                "vitalstarSearchInput"
            );
    }

    searchInput.addEventListener(
        "input",
        () => {

            const term =
                searchInput.value
                    .trim()
                    .toLowerCase()
                    .replace(/^@/, "");

            if (!term) {

                renderUsers(allUsers);

                return;
            }

            const filtered =
                allUsers.filter(user => {

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

setupSearch();


// ============================================================
// USER BUTTONS
// ============================================================

usersList.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "button"
            );

        if (!button) return;

        const uid =
            button.dataset.uid;

        if (!uid) return;


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


        if (
            button.dataset.action ===
            "profile"
        ) {

            window.location.href =
                `profile.html?uid=${encodeURIComponent(uid)}`;

            return;
        }


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
// HEADER
// ============================================================

function createHeader() {

    if (
        document.getElementById(
            "vitalstarUsersHeader"
        )
    ) {
        return;
    }

    const header =
        document.createElement("div");

    header.id =
        "vitalstarUsersHeader";

    header.className =
        "users-header";

    header.innerHTML = `
        <div class="users-title">
            Discover <span>People</span>
        </div>

        <div class="users-subtitle">
            Find people and groups on VitalStar
        </div>
    `;

    usersList.parentNode.insertBefore(
        header,
        usersList.parentNode.firstChild
    );
}

createHeader();


// ============================================================
// FOOTER
// ============================================================

function createFooter() {

    const footer =
        document.createElement("footer");

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

    document.body.appendChild(
        footer
    );


    footer.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-page]"
                );

            if (!button) return;

            const page =
                button.dataset.page;

            if (
                page === "profile.html" &&
                currentUser
            ) {

                window.location.href =
                    `profile.html?uid=${encodeURIComponent(
                        currentUser.uid
                    )}`;

                return;
            }

            window.location.href =
                page;
        }
    );
}

createFooter();