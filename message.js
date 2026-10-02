// ============================================================
// VITALSTAR MESSAGES
// message.js
//
// Features:
// - Conversations
// - Search
// - Profile pictures
// - First-letter avatars
// - Unread counts
// - Live message updates
// - Delete conversations
// - Full-screen VS loading indicator
// - Dark VitalStar theme
// - Home-style bottom navigation
// ============================================================

import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDoc,
    getDocs,
    doc,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// ============================================================
// VITALSTAR DARK THEME + HOME FOOTER
// ============================================================

const vitalStarThemeStyle = document.createElement("style");

vitalStarThemeStyle.textContent = `

/* ==========================================================
   VITALSTAR DARK THEME
   ========================================================== */

:root {
    --vs-bg: #030712;
    --vs-bg-2: #07101f;
    --vs-card: #091426;
    --vs-card-2: #0d1a2d;
    --vs-border: rgba(255, 215, 0, .15);
    --vs-yellow: #ffd700;
    --vs-blue: #1683ff;
    --vs-blue-2: #0066ff;
    --vs-green: #00ff88;
    --vs-text: #ffffff;
    --vs-muted: #8fa4bd;
    --vs-nav: #050914;
}

/* BODY */

html,
body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background:
        radial-gradient(
            circle at top,
            rgba(0, 105, 255, .10),
            transparent 35%
        ),
        linear-gradient(
            180deg,
            #02050c 0%,
            #030712 55%,
            #050914 100%
        ) !important;

    color: var(--vs-text);
    font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    color-scheme: dark;
}

/* MAIN MESSAGE AREA */

body {
    padding-bottom: 90px !important;
}

.message-page,
.messages-page,
.messages-container,
main {
    color: var(--vs-text);
}

/* SEARCH */

#searchInput,
.search-input,
input[type="search"] {
    background:
        linear-gradient(
            145deg,
            rgba(12, 27, 48, .96),
            rgba(5, 14, 27, .96)
        ) !important;

    color: #ffffff !important;

    border: 1px solid
        rgba(255, 215, 0, .22) !important;

    box-shadow:
        0 0 15px rgba(0, 102, 255, .08),
        inset 0 0 12px rgba(0, 0, 0, .25);

    outline: none;
}

#searchInput::placeholder,
.search-input::placeholder {
    color: #71849d !important;
}

#searchInput:focus,
.search-input:focus {
    border-color: rgba(255, 215, 0, .65) !important;

    box-shadow:
        0 0 0 2px rgba(255, 215, 0, .08),
        0 0 20px rgba(0, 102, 255, .16);
}

/* MESSAGE CARDS */

.message-card {
    position: relative;

    background:
        linear-gradient(
            145deg,
            rgba(10, 25, 45, .98),
            rgba(4, 12, 25, .98)
        ) !important;

    border: 1px solid
        rgba(255, 215, 0, .12) !important;

    border-radius: 18px !important;

    color: #ffffff !important;

    box-shadow:
        0 8px 25px rgba(0, 0, 0, .28),
        inset 0 1px 0 rgba(255, 255, 255, .025);

    transition:
        transform .2s ease,
        border-color .2s ease,
        box-shadow .2s ease,
        background .2s ease;

    overflow: hidden;
}

.message-card:hover {
    transform: translateY(-2px);

    border-color:
        rgba(255, 215, 0, .32) !important;

    box-shadow:
        0 12px 30px rgba(0, 0, 0, .35),
        0 0 18px rgba(0, 102, 255, .08);
}

.message-card:active {
    transform: scale(.985);
}

/* UNREAD */

.message-card.unread-card {
    border-color:
        rgba(0, 255, 136, .35) !important;

    box-shadow:
        0 0 18px rgba(0, 255, 136, .07),
        0 8px 25px rgba(0, 0, 0, .3);
}

.message-card .name {
    color: #ffffff !important;
    font-weight: 800;
}

.message-card .last-message {
    color: #91a4bc !important;
}

.message-card .time-text {
    color: #6f849e !important;
}

/* AVATARS */

.avatar-wrapper {
    position: relative;
    flex-shrink: 0;
}

.profile-picture,
.profile-letter {
    width: 54px !important;
    height: 54px !important;

    border-radius: 50% !important;

    object-fit: cover;

    border: 2px solid
        rgba(255, 215, 0, .42);

    box-shadow:
        0 0 12px rgba(0, 102, 255, .18);
}

.profile-letter {
    display: flex;

    align-items: center;
    justify-content: center;

    background:
        linear-gradient(
            135deg,
            #061a35,
            #092c54
        ) !important;

    color: #ffffff !important;

    font-size: 21px;
    font-weight: 900;
}

/* ONLINE DOT */

.online-dot {
    position: absolute;

    width: 12px;
    height: 12px;

    right: 1px;
    bottom: 1px;

    border-radius: 50%;

    background: #00ff88;

    border: 2px solid #07101f;

    box-shadow:
        0 0 7px #00ff88,
        0 0 14px rgba(0, 255, 136, .8);
}

/* UNREAD BADGE */

.unread-badge {
    min-width: 22px;
    height: 22px;

    padding: 0 7px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border-radius: 999px;

    background:
        linear-gradient(
            135deg,
            #00ff88,
            #00c96b
        ) !important;

    color: #001b10 !important;

    font-size: 11px;
    font-weight: 1000;

    box-shadow:
        0 0 9px rgba(0, 255, 136, .5);
}

/* DELETE BUTTON */

.delete-chat-btn {
    color: #ff6575 !important;

    background:
        rgba(255, 70, 90, .07) !important;

    border: 1px solid
        rgba(255, 70, 90, .12) !important;

    border-radius: 10px;

    cursor: pointer;

    transition:
        .2s ease;
}

.delete-chat-btn:hover {
    background:
        rgba(255, 70, 90, .15) !important;

    box-shadow:
        0 0 12px rgba(255, 70, 90, .15);
}

/* EMPTY STATE */

.empty-state {
    color: #ffffff !important;

    background:
        radial-gradient(
            circle at center,
            rgba(0, 102, 255, .08),
            transparent 65%
        );
}

.empty-state h2 {
    color: #ffffff !important;
}

.empty-state p {
    color: #7f94ad !important;
}

.empty-icon {
    filter:
        drop-shadow(
            0 0 12px rgba(0, 102, 255, .25)
        );
}


/* ==========================================================
   HOME.HTML STYLE BOTTOM NAVIGATION
   ========================================================== */

.vitalstar-bottom-nav {
    position: fixed;

    left: 0;
    right: 0;
    bottom: 0;

    width: 100%;

    height: 70px;

    z-index: 99990;

    display: flex;

    align-items: center;
    justify-content: space-around;

    background:
        rgba(5, 9, 20, .98);

    border-top:
        1px solid rgba(0, 102, 255, .32);

    box-shadow:
        0 -5px 25px rgba(0, 0, 0, .45),
        0 -1px 12px rgba(0, 102, 255, .08);

    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

    padding:
        0 8px;

    box-sizing: border-box;
}

.vitalstar-bottom-nav a {
    position: relative;

    width: 20%;

    height: 100%;

    display: flex;

    flex-direction: column;

    align-items: center;
    justify-content: center;

    gap: 3px;

    text-decoration: none;

    color: #b8c7dc;

    font-size: 12px;

    transition:
        color .2s ease,
        transform .2s ease;
}

.vitalstar-bottom-nav a:hover {
    color: #ffffff;
}

.vitalstar-bottom-nav a.active {
    color: #ffffff;
}

.vitalstar-bottom-nav a.active::before {
    content: "";

    position: absolute;

    top: 0;

    width: 32px;
    height: 3px;

    border-radius: 0 0 6px 6px;

    background:
        linear-gradient(
            90deg,
            #1683ff,
            #ffd700
        );

    box-shadow:
        0 0 10px rgba(0, 102, 255, .7);
}

.vitalstar-bottom-nav .nav-icon {
    font-size: 21px;

    line-height: 1;

    display: flex;

    align-items: center;
    justify-content: center;
}

.vitalstar-bottom-nav small {
    font-size: 10px;

    font-weight: 700;

    letter-spacing: .15px;
}

/* CREATE BUTTON */

.vitalstar-bottom-nav .create-btn {
    width: 58px;
    height: 58px;

    margin-top: -28px;

    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #1683ff,
            #6b35ff
        );

    color: #ffffff;

    border:
        3px solid #050914;

    box-shadow:
        0 0 18px rgba(0, 102, 255, .55),
        0 7px 22px rgba(0, 0, 0, .4);

    display: flex;

    align-items: center;
    justify-content: center;

    font-size: 28px;

    transition:
        transform .2s ease,
        box-shadow .2s ease;
}

.vitalstar-bottom-nav .create-btn:hover {
    transform:
        translateY(-3px)
        scale(1.04);

    box-shadow:
        0 0 24px rgba(0, 102, 255, .7),
        0 9px 25px rgba(0, 0, 0, .5);
}

.vitalstar-bottom-nav .create-btn small {
    display: none;
}


/* ==========================================================
   MOBILE FOOTER
   ========================================================== */

@media (max-width: 600px) {

    body {
        padding-bottom: 78px !important;
    }

    .vitalstar-bottom-nav {
        height: 65px;
        padding: 0 4px;
    }

    .vitalstar-bottom-nav .create-btn {
        width: 56px;
        height: 56px;
        margin-top: -26px;
    }

    .vitalstar-bottom-nav .nav-icon {
        font-size: 20px;
    }

    .vitalstar-bottom-nav small {
        font-size: 9px;
    }

}


/* ==========================================================
   SCROLLBAR
   ========================================================== */

* {
    scrollbar-width: thin;

    scrollbar-color:
        #17385e
        #030712;
}

::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: #030712;
}

::-webkit-scrollbar-thumb {
    background: #17385e;

    border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
    background: #245989;
}

`;

document.head.appendChild(
    vitalStarThemeStyle
);


// ============================================================
// CREATE HOME FOOTER
// ============================================================

function createHomeFooter() {

    // Remove an old footer if message.html already has one.
    const oldFooter =
        document.querySelector(
            ".bottom-nav"
        );

    if (oldFooter) {
        oldFooter.remove();
    }

    const oldVitalFooter =
        document.querySelector(
            ".vitalstar-bottom-nav"
        );

    if (oldVitalFooter) {
        oldVitalFooter.remove();
    }


    const footer =
        document.createElement("nav");

    footer.className =
        "vitalstar-bottom-nav";


    footer.setAttribute(
        "aria-label",
        "VitalStar navigation"
    );


    footer.innerHTML = `

        <a
            href="home.html"
            class="home-nav"
            aria-label="Home"
        >
            <span class="nav-icon">🏠</span>
            <small>Home</small>
        </a>


        <a
            href="users.html"
            class="explore-nav"
            aria-label="Explore"
        >
            <span class="nav-icon">👥</span>
            <small>Explore</small>
        </a>


        <a
            href="create-post.html"
            class="create-btn"
            aria-label="Create post"
        >
            <span class="nav-icon">+</span>
        </a>


        <a
            href="wallet.html"
            class="finance-nav"
            aria-label="Finance"
        >
            <span class="nav-icon">💰</span>
            <small>Finance</small>
        </a>


        <a
            href="profile.html"
            class="profile-nav"
            aria-label="Profile"
        >
            <span class="nav-icon">👤</span>
            <small>Profile</small>
        </a>

    `;


    document.body.appendChild(
        footer
    );
}

createHomeFooter();


// ============================================================
// FULL SCREEN VITALSTAR LOADING INDICATOR
// ============================================================

const vitalStarLoader =
    document.createElement("div");

vitalStarLoader.id =
    "vitalStarLoader";

vitalStarLoader.className =
    "vitalstar-fullscreen";


vitalStarLoader.innerHTML = `

    <div class="vitalstar-indicator">

        <div class="vitalstar-glow"></div>

        <div class="vitalstar-vs">
            VS
        </div>

    </div>

    <div class="vitalstar-loading-text">
        Loading Messages...
    </div>

    <div class="vitalstar-loading-subtext">
        Connect, Share & Shine
    </div>

`;


const vitalStarLoaderStyle =
    document.createElement("style");


vitalStarLoaderStyle.textContent = `

    @keyframes vitalStarRingSpin {
        0% {
            transform:
                translate(-50%, -50%)
                rotate(0deg);
        }

        100% {
            transform:
                translate(-50%, -50%)
                rotate(360deg);
        }
    }


    @keyframes vitalStarRingSpinReverse {
        0% {
            transform:
                translate(-50%, -50%)
                rotate(360deg);
        }

        100% {
            transform:
                translate(-50%, -50%)
                rotate(0deg);
        }
    }


    @keyframes vitalStarPulse {

        0%, 100% {
            transform:scale(1);

            text-shadow:
                0 0 8px #00ff88,
                0 0 18px #00ff88,
                0 0 35px #00ff88;
        }

        50% {
            transform:scale(1.08);

            text-shadow:
                0 0 12px #00ff88,
                0 0 25px #00ff88,
                0 0 50px #00ff88;
        }

    }


    @keyframes vitalStarGlow {

        0%, 100% {
            opacity:.55;

            transform:
                translate(-50%, -50%)
                scale(.96);
        }

        50% {
            opacity:.9;

            transform:
                translate(-50%, -50%)
                scale(1.04);
        }

    }


    .vitalstar-fullscreen {

        position:fixed;

        inset:0;

        width:100vw;
        height:100vh;

        min-height:100vh;

        z-index:999999;

        display:flex;

        flex-direction:column;

        align-items:center;
        justify-content:center;

        text-align:center;

        box-sizing:border-box;

        padding:20px;

        background:
            radial-gradient(
                circle at center,
                rgba(0,255,136,.13) 0%,
                rgba(3,25,17,.80) 32%,
                rgba(2,8,7,.78) 72%,
                rgba(1,3,4,.78) 100%
            );

        overflow:hidden;

        opacity:1;

        visibility:visible;

        pointer-events:all;

        transition:
            opacity .3s ease,
            visibility .3s ease;
    }


    .vitalstar-fullscreen.hide {

        opacity:0;

        visibility:hidden;

        pointer-events:none;

    }


    .vitalstar-fullscreen::before {

        content:"";

        position:absolute;

        inset:-30%;

        background:
            radial-gradient(
                circle,
                rgba(0,255,136,.13),
                transparent 55%
            );

        animation:
            vitalStarGlow
            1.2s
            ease-in-out
            infinite;

        pointer-events:none;

    }


    .vitalstar-indicator {

        position:relative;

        width:96px;
        height:96px;

        margin:
            0 auto 20px;

        display:flex;

        align-items:center;
        justify-content:center;

        border-radius:50%;

        background:
            radial-gradient(
                circle,
                rgba(0,255,136,.22) 0%,
                rgba(0,180,100,.12) 42%,
                rgba(0,60,35,.08) 65%,
                transparent 72%
            );

        box-shadow:
            0 0 18px rgba(0,255,136,.28),
            0 0 40px rgba(0,255,136,.18),
            inset 0 0 22px rgba(0,255,136,.12);

    }


    .vitalstar-indicator::before {

        content:"";

        position:absolute;

        left:50%;
        top:50%;

        width:78px;
        height:78px;

        border-radius:50%;

        border:4px solid transparent;

        border-top-color:#00ff88;
        border-right-color:#00d9ff;
        border-bottom-color:#a855f7;
        border-left-color:#ff3cac;

        animation:
            vitalStarRingSpin
            .65s
            linear
            infinite;

        filter:
            drop-shadow(
                0 0 5px
                rgba(0,255,136,.9)
            )
            drop-shadow(
                0 0 10px
                rgba(168,85,247,.65)
            );

        box-sizing:border-box;

    }


    .vitalstar-indicator::after {

        content:"";

        position:absolute;

        left:50%;
        top:50%;

        width:66px;
        height:66px;

        border-radius:50%;

        border:
            2px dashed
            rgba(255,255,255,.28);

        animation:
            vitalStarRingSpinReverse
            1.1s
            linear
            infinite;

        box-sizing:border-box;

    }


    .vitalstar-vs {

        position:relative;

        z-index:5;

        font-size:27px;

        font-weight:1000;

        letter-spacing:1px;

        color:#ffffff;

        animation:
            vitalStarPulse
            1s
            ease-in-out
            infinite;

    }


    .vitalstar-glow {

        position:absolute;

        left:50%;
        top:50%;

        width:120px;
        height:120px;

        transform:
            translate(-50%, -50%);

        border-radius:50%;

        background:
            radial-gradient(
                circle,
                rgba(0,255,136,.22),
                transparent 68%
            );

        filter:blur(8px);

        animation:
            vitalStarGlow
            1.2s
            ease-in-out
            infinite;

        pointer-events:none;

    }


    .vitalstar-loading-text {

        position:relative;

        z-index:5;

        font-size:15px;

        font-weight:800;

        color:#eafff5;

        letter-spacing:.4px;

        text-shadow:
            0 0 8px
            rgba(0,255,136,.3);

    }


    .vitalstar-loading-subtext {

        position:relative;

        z-index:5;

        margin-top:8px;

        color:#6fae91;

        font-size:12px;

    }

`;

document.head.appendChild(
    vitalStarLoaderStyle
);


document.body.appendChild(
    vitalStarLoader
);


// ============================================================
// HIDE LOADING INDICATOR
// ============================================================

let vitalStarLoaderHidden = false;


function hideVitalStarLoader() {

    if (vitalStarLoaderHidden) {
        return;
    }


    vitalStarLoaderHidden = true;


    const loader =
        document.getElementById(
            "vitalStarLoader"
        );


    if (!loader) {
        return;
    }


    loader.classList.add(
        "hide"
    );


    setTimeout(() => {

        loader.remove();

    }, 400);

}


// ============================================================
// HTML ELEMENTS
// ============================================================

const messageList =
    document.getElementById(
        "messageList"
    );


const searchInput =
    document.getElementById(
        "searchInput"
    );


let currentUser = null;

let allChats = [];

const chatListeners =
    new Map();

const unreadCounts =
    new Map();


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(text) {

    if (
        text === null ||
        text === undefined
    ) {
        return "";
    }


    return String(text)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// GET TIMESTAMP
// ============================================================

function getTimestampValue(timestamp) {

    if (!timestamp) {
        return 0;
    }


    if (
        typeof timestamp.toMillis ===
        "function"
    ) {
        return timestamp.toMillis();
    }


    if (timestamp.seconds) {
        return timestamp.seconds * 1000;
    }


    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }


    if (
        typeof timestamp ===
        "number"
    ) {
        return timestamp;
    }


    return 0;

}


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(timestamp) {

    const time =
        getTimestampValue(
            timestamp
        );


    if (!time) {
        return "";
    }


    const date =
        new Date(time);

    const now =
        new Date();


    const sameDay =

        date.getDate() ===
            now.getDate() &&

        date.getMonth() ===
            now.getMonth() &&

        date.getFullYear() ===
            now.getFullYear();


    if (sameDay) {

        return date.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }


    const yesterday =
        new Date();


    yesterday.setDate(
        now.getDate() - 1
    );


    const isYesterday =

        date.getDate() ===
            yesterday.getDate() &&

        date.getMonth() ===
            yesterday.getMonth() &&

        date.getFullYear() ===
            yesterday.getFullYear();


    if (isYesterday) {
        return "Yesterday";
    }


    return date.toLocaleDateString(
        [],
        {
            day: "numeric",
            month: "short"
        }
    );

}


// ============================================================
// LAST MESSAGE
// ============================================================

function getLastMessageHtml(chat) {

    if (chat.lastMessage) {

        return escapeHtml(
            chat.lastMessage
        );

    }


    if (chat.lastImage) {
        return "🖼️ Photo";
    }


    if (chat.lastVideo) {
        return "🎥 Video";
    }


    if (chat.lastAudio) {
        return "🎤 Voice message";
    }


    return "Start a conversation";

}


// ============================================================
// GET PROFILE PICTURE
// ============================================================

function getProfilePicture(userData) {

    if (!userData) {
        return "";
    }


    const pictures = [

        userData.profilePic,
        userData.profilePicture,
        userData.photoURL,
        userData.photoUrl,
        userData.profileImage,
        userData.imageUrl

    ];


    for (
        const picture of pictures
    ) {

        if (

            typeof picture ===
                "string" &&

            picture.trim() !== ""

        ) {

            return picture.trim();

        }

    }


    return "";

}


// ============================================================
// GET FIRST LETTER
// ============================================================

function getFirstLetter(name) {

    const cleanName =
        String(
            name || "U"
        ).trim();


    if (!cleanName) {
        return "U";
    }


    return cleanName
        .charAt(0)
        .toUpperCase();

}


// ============================================================
// CREATE AVATAR
// ============================================================

function createAvatar(chat) {

    const letter =
        getFirstLetter(
            chat.fullName
        );


    if (chat.profilePic) {

        return `

            <div class="avatar-wrapper">

                <img
                    src="${escapeHtml(
                        chat.profilePic
                    )}"
                    class="profile-picture"
                    alt="${escapeHtml(
                        chat.fullName
                    )}"
                >

                <span class="avatar-letter">
                    ${escapeHtml(letter)}
                </span>

                <span class="online-dot"></span>

            </div>

        `;

    }


    return `

        <div class="avatar-wrapper">

            <div class="profile-letter">
                ${escapeHtml(letter)}
            </div>

            <span class="online-dot"></span>

        </div>

    `;

}


// ============================================================
// CREATE CHAT CARD
// ============================================================

function createChatCard(chat) {

    const unreadCount =
        unreadCounts.get(
            chat.id
        ) || 0;


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "message-card";


    card.dataset.chatId =
        chat.id;


    if (unreadCount > 0) {

        card.classList.add(
            "unread-card"
        );

    }


    const unreadBadge =
        unreadCount > 0

            ? `

                <span class="unread-badge">

                    ${
                        unreadCount > 99
                            ? "99+"
                            : unreadCount
                    }

                </span>

            `

            : "";


    card.innerHTML = `

        ${createAvatar(chat)}

        <div class="message-info">

            <div class="top-row">

                <div class="name">
                    ${escapeHtml(
                        chat.fullName
                    )}
                </div>

                <div class="time-text">
                    ${formatTime(
                        chat.lastTimestamp
                    )}
                </div>

            </div>

            <div class="bottom-row">

                <div class="last-message">
                    ${getLastMessageHtml(
                        chat
                    )}
                </div>

                ${unreadBadge}

            </div>

        </div>

        <button
            class="delete-chat-btn"
            type="button"
            title="Delete chat"
            aria-label="Delete chat"
        >
            🗑️
        </button>

    `;


    // ========================================================
    // PROFILE IMAGE FALLBACK
    // ========================================================

    const image =
        card.querySelector(
            ".profile-picture"
        );


    if (image) {

        image.addEventListener(
            "error",
            () => {

                const wrapper =
                    image.closest(
                        ".avatar-wrapper"
                    );


                if (!wrapper) {
                    return;
                }


                const letter =
                    getFirstLetter(
                        chat.fullName
                    );


                wrapper.innerHTML = `

                    <div class="profile-letter">

                        ${escapeHtml(
                            letter
                        )}

                    </div>

                    <span class="online-dot"></span>

                `;

            }
        );

    }


    // ========================================================
    // OPEN CHAT
    // ========================================================

    card.addEventListener(
        "click",
        () => {

            window.location.href =
                `chat.html?uid=${
                    encodeURIComponent(
                        chat.otherUserId
                    )
                }`;

        }
    );


    // ========================================================
    // DELETE CHAT
    // ========================================================

    const deleteButton =
        card.querySelector(
            ".delete-chat-btn"
        );


    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();


                deleteChat(
                    chat.id,
                    card
                );

            }
        );

    }


    return card;

}


// ============================================================
// RENDER CHATS
// ============================================================

function renderChats() {

    if (!messageList) {
        return;
    }


    const search =
        searchInput?.value
            ?.trim()
            .toLowerCase() || "";


    let chats =
        [...allChats];


    if (search) {

        chats =
            chats.filter(
                chat => {

                    const name =
                        (
                            chat.fullName ||
                            ""
                        ).toLowerCase();


                    const message =
                        (
                            chat.lastMessage ||
                            ""
                        ).toLowerCase();


                    return (

                        name.includes(
                            search
                        ) ||

                        message.includes(
                            search
                        )

                    );

                }
            );

    }


    chats.sort(
        (a, b) =>

            getTimestampValue(
                b.lastTimestamp
            )

            -

            getTimestampValue(
                a.lastTimestamp
            )
    );


    if (!chats.length) {

        messageList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">

                    ${
                        search
                            ? "🔎"
                            : "💬"
                    }

                </div>

                <h2>

                    ${
                        search
                            ? "No results"
                            : "No conversations"
                    }

                </h2>

                <p>

                    ${
                        search
                            ? "No conversations match your search."
                            : "Start chatting with your friends."
                    }

                </p>

            </div>

        `;

        return;

    }


    const fragment =
        document.createDocumentFragment();


    for (
        const chat of chats
    ) {

        fragment.appendChild(
            createChatCard(chat)
        );

    }


    messageList.innerHTML = "";

    messageList.appendChild(
        fragment
    );

}


// ============================================================
// UPDATE UNREAD BADGE
// ============================================================

function updateUnreadBadge(chatId) {

    const count =
        unreadCounts.get(
            chatId
        ) || 0;


    const chat =
        allChats.find(
            item =>
                item.id === chatId
        );


    if (!chat) {
        return;
    }


    const card =
        messageList?.querySelector(
            `[data-chat-id="${CSS.escape(
                chatId
            )}"]`
        );


    if (!card) {

        renderChats();

        return;

    }


    const bottomRow =
        card.querySelector(
            ".bottom-row"
        );


    if (!bottomRow) {
        return;
    }


    const oldBadge =
        bottomRow.querySelector(
            ".unread-badge"
        );


    if (oldBadge) {
        oldBadge.remove();
    }


    if (count > 0) {

        const badge =
            document.createElement(
                "span"
            );


        badge.className =
            "unread-badge";


        badge.textContent =
            count > 99
                ? "99+"
                : count;


        bottomRow.appendChild(
            badge
        );


        card.classList.add(
            "unread-card"
        );

    } else {

        card.classList.remove(
            "unread-card"
        );

    }

}


// ============================================================
// LOAD UNREAD COUNT
// ============================================================

async function loadUnreadCount(chatId) {

    if (!currentUser) {
        return;
    }


    try {

        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        const snapshot =
            await getDocs(
                messagesRef
            );


        let count = 0;


        snapshot.forEach(
            messageDoc => {

                const message =
                    messageDoc.data();


                if (

                    message.receiverId ===
                        currentUser.uid &&

                    message.read === false

                ) {

                    count++;

                }

            }
        );


        unreadCounts.set(
            chatId,
            count
        );


        updateUnreadBadge(
            chatId
        );


    } catch (error) {

        console.error(
            "Unread count error:",
            error
        );

    }

}


// ============================================================
// LIVE MESSAGE LISTENER
// ============================================================

function listenToChat(chatId) {

    if (
        chatListeners.has(
            chatId
        )
    ) {
        return;
    }


    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );


    const unsubscribe =
        onSnapshot(
            messagesRef,
            snapshot => {

                let unread = 0;


                snapshot.forEach(
                    messageDoc => {

                        const message =
                            messageDoc.data();


                        if (

                            message.receiverId ===
                                currentUser.uid &&

                            message.read === false

                        ) {

                            unread++;

                        }

                    }
                );


                unreadCounts.set(
                    chatId,
                    unread
                );


                renderChats();

            },


            error => {

                console.error(
                    "Message listener error:",
                    error
                );

            }
        );


    chatListeners.set(
        chatId,
        unsubscribe
    );

}


// ============================================================
// DELETE CHAT
// ============================================================

async function deleteChat(
    chatId,
    card
) {

    const confirmed =
        confirm(
            "Delete this conversation?\n\nAll messages in this chat will be deleted."
        );


    if (!confirmed) {
        return;
    }


    try {

        card.style.opacity = "0.45";

        card.style.pointerEvents = "none";


        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        const snapshot =
            await getDocs(
                messagesRef
            );


        let batch =
            writeBatch(db);

        let count = 0;


        for (
            const messageDoc
            of snapshot.docs
        ) {

            batch.delete(
                messageDoc.ref
            );


            count++;


            if (count === 500) {

                await batch.commit();

                batch =
                    writeBatch(db);

                count = 0;

            }

        }


        if (count > 0) {

            await batch.commit();

        }


        await deleteDoc(
            doc(
                db,
                "chats",
                chatId
            )
        );


        if (
            chatListeners.has(
                chatId
            )
        ) {

            chatListeners
                .get(chatId)();

            chatListeners.delete(
                chatId
            );

        }


        unreadCounts.delete(
            chatId
        );


        allChats =
            allChats.filter(
                chat =>
                    chat.id !== chatId
            );


        renderChats();


    } catch (error) {

        console.error(
            "Delete chat error:",
            error
        );


        card.style.opacity = "1";

        card.style.pointerEvents = "auto";


        alert(
            "Unable to delete this conversation."
        );

    }

}


// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentUser =
            user;


        const chatsQuery =
            query(
                collection(
                    db,
                    "chats"
                ),

                where(
                    "participants",
                    "array-contains",
                    user.uid
                )
            );


        onSnapshot(
            chatsQuery,

            async snapshot => {

                const chats = [];

                const activeChatIds =
                    new Set();


                // ============================================
                // GET CHAT DATA
                // ============================================

                for (
                    const chatDoc
                    of snapshot.docs
                ) {

                    const data =
                        chatDoc.data();


                    if (
                        !Array.isArray(
                            data.participants
                        )
                    ) {
                        continue;
                    }


                    const otherUserId =
                        data.participants.find(
                            id =>
                                id !==
                                user.uid
                        );


                    if (!otherUserId) {
                        continue;
                    }


                    activeChatIds.add(
                        chatDoc.id
                    );


                    chats.push({

                        id:
                            chatDoc.id,

                        ...data,

                        otherUserId,

                        fullName:
                            "Loading...",

                        profilePic:
                            ""

                    });

                }


                // ============================================
                // SHOW CHATS
                // ============================================

                allChats =
                    chats;

                renderChats();


                // ============================================
                // REMOVE OLD LISTENERS
                // ============================================

                for (
                    const [
                        chatId,
                        unsubscribe
                    ]
                    of chatListeners
                ) {

                    if (
                        !activeChatIds.has(
                            chatId
                        )
                    ) {

                        unsubscribe();

                        chatListeners.delete(
                            chatId
                        );

                    }

                }


                // ============================================
                // LOAD PROFILES
                // ============================================

                for (
                    const chat of chats
                ) {

                    try {

                        const userSnap =
                            await getDoc(
                                doc(
                                    db,
                                    "users",
                                    chat.otherUserId
                                )
                            );


                        if (
                            userSnap.exists()
                        ) {

                            const userData =
                                userSnap.data();


                            chat.fullName =
                                userData.fullName ||
                                userData.username ||
                                "Unknown User";


                            chat.profilePic =
                                getProfilePicture(
                                    userData
                                );

                        } else {

                            chat.fullName =
                                "Unknown User";

                        }

                    } catch (error) {

                        console.error(
                            "Profile loading error:",
                            error
                        );


                        chat.fullName =
                            "Unknown User";

                    }


                    renderChats();

                }


                // ============================================
                // LIVE MESSAGE LISTENERS
                // ============================================

                for (
                    const chat of chats
                ) {

                    listenToChat(
                        chat.id
                    );

                }


                // ============================================
                // LOADING FINISHED
                // ============================================

                hideVitalStarLoader();

            },


            error => {

                console.error(
                    "Chats error:",
                    error
                );


                showEmptyState(
                    "⚠️",
                    "Unable to load messages",
                    "Check your connection and try again."
                );


                hideVitalStarLoader();

            }

        );

    }

);


// ============================================================
// EMPTY STATE
// ============================================================

function showEmptyState(
    icon,
    title,
    text
) {

    if (!messageList) {
        return;
    }


    messageList.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                ${icon}
            </div>

            <h2>
                ${escapeHtml(title)}
            </h2>

            <p>
                ${escapeHtml(text)}
            </p>

        </div>

    `;

}


// ============================================================
// SEARCH
// ============================================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderChats();

        }
    );

}