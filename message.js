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

/* ==========================================================
   DARK THEME + NEON LOADER STYLES
   ========================================================== */
const vitalStarThemeStyle = document.createElement("style");
vitalStarThemeStyle.textContent = `
:root {
    --vs-bg: #030712; --vs-bg-2: #07101f; --vs-card: #091426; --vs-card-2: #0d1a2d;
    --vs-border: rgba(255, 215, 0, .15); --vs-yellow: #ffd700; --vs-blue: #1683ff;
    --vs-blue-2: #0066ff; --vs-green: #00ff88; --vs-text: #ffffff; --vs-muted: #8fa4bd; --vs-nav: #050914;
}
html, body {
    margin: 0; padding: 0; min-height: 100%;
    background:
        radial-gradient(circle at top, rgba(0,105,255,.10), transparent 35%),
        linear-gradient(180deg, #02050c 0%, #030712 55%, #050914 100%) !important;
    color: var(--vs-text);
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color-scheme: dark;
}
body { padding-bottom: 90px !important; }
.message-page, .messages-page, .messages-container, main { color: var(--vs-text); }

#searchInput, .search-input, input[type="search"] {
    background: linear-gradient(145deg, rgba(12,27,48,.96), rgba(5,14,27,.96)) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255,215,0,.22) !important;
    box-shadow: 0 0 15px rgba(0,102,255,.08), inset 0 0 12px rgba(0,0,0,.25);
    outline: none;
}
#searchInput::placeholder, .search-input::placeholder { color: #71849d !important; }
#searchInput:focus, .search-input:focus {
    border-color: rgba(255,215,0,.65) !important;
    box-shadow: 0 0 0 2px rgba(255,215,0,.08), 0 0 20px rgba(0,102,255,.16);
}

.message-card {
    position: relative;
    background: linear-gradient(145deg, rgba(10,25,45,.98), rgba(4,12,25,.98)) !important;
    border: 1px solid rgba(255,215,0,.12) !important;
    border-radius: 18px !important;
    color: #ffffff !important;
    box-shadow: 0 8px 25px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.025);
    transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
    overflow: hidden;
}
.message-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255,215,0,.32) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.35), 0 0 18px rgba(0,102,255,.08);
}
.message-card:active { transform: scale(.985); }
.message-card.unread-card {
    border-color: rgba(0,255,136,.35) !important;
    box-shadow: 0 0 18px rgba(0,255,136,.07), 0 8px 25px rgba(0,0,0,.3);
}
.message-card .name { color: #ffffff !important; font-weight: 800; }
.message-card .last-message { color: #91a4bc !important; }
.message-card .time-text { color: #6f849e !important; }

.avatar-wrapper { position: relative; flex-shrink: 0; }
.profile-picture, .profile-letter {
    width: 54px !important; height: 54px !important; border-radius: 50% !important;
    object-fit: cover; border: 2px solid rgba(255,215,0,.42);
    box-shadow: 0 0 12px rgba(0,102,255,.18);
}
.profile-letter {
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #061a35, #092c54) !important;
    color: #ffffff !important; font-size: 21px; font-weight: 900;
}
.online-dot {
    position: absolute; width: 12px; height: 12px; right: 1px; bottom: 1px; border-radius: 50%;
    background: #00ff88; border: 2px solid #07101f;
    box-shadow: 0 0 7px #00ff88, 0 0 14px rgba(0,255,136,.8);
}
.unread-badge {
    min-width: 22px; height: 22px; padding: 0 7px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px;
    background: linear-gradient(135deg, #00ff88, #00c96b) !important;
    color: #001b10 !important; font-size: 11px; font-weight: 900;
    box-shadow: 0 0 9px rgba(0,255,136,.5);
}
.delete-chat-btn {
    color: #ff6575 !important; background: rgba(255,70,90,.07) !important;
    border: 1px solid rgba(255,70,90,.12) !important; border-radius: 10px;
    cursor: pointer; transition: .2s ease;
}
.delete-chat-btn:hover { background: rgba(255,70,90,.15) !important; box-shadow: 0 0 12px rgba(255,70,90,.15); }

.empty-state { color: #ffffff !important; background: radial-gradient(circle at center, rgba(0,102,255,.08), transparent 65%); }
.empty-state h2 { color: #ffffff !important; }
.empty-state p { color: #7f94ad !important; }
.empty-icon { filter: drop-shadow(0 0 12px rgba(0,102,255,.25)); }

/* BOTTOM NAV */
.vitalstar-bottom-nav {
    position: fixed; left: 0; right: 0; bottom: 0; width: 100%; height: 70px; z-index: 99990;
    display: flex; align-items: center; justify-content: space-around;
    background: rgba(5,9,20,.98);
    border-top: 1px solid rgba(0,102,255,.32);
    box-shadow: 0 -5px 25px rgba(0,0,0,.45), 0 -1px 12px rgba(0,102,255,.08);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    padding: 0 8px; box-sizing: border-box;
}
.vitalstar-bottom-nav a {
    position: relative; width: 20%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    text-decoration: none; color: #b8c7dc; font-size: 12px;
    transition: color .2s ease, transform .2s ease;
}
.vitalstar-bottom-nav a:hover, .vitalstar-bottom-nav a.active { color: #ffffff; }
.vitalstar-bottom-nav a.active::before {
    content: ""; position: absolute; top: 0; width: 32px; height: 3px; border-radius: 0 0 6px 6px;
    background: linear-gradient(90deg, #1683ff, #ffd700); box-shadow: 0 0 10px rgba(0,102,255,.7);
}
.vitalstar-bottom-nav .nav-icon { font-size: 21px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.vitalstar-bottom-nav small { font-size: 10px; font-weight: 700; letter-spacing: .15px; }
.vitalstar-bottom-nav .create-btn {
    width: 58px; height: 58px; margin-top: -28px; border-radius: 50%;
    background: linear-gradient(135deg, #1683ff, #6b35ff);
    color: #ffffff; border: 3px solid #050914;
    box-shadow: 0 0 18px rgba(0,102,255,.55), 0 7px 22px rgba(0,0,0,.4);
    display: flex; align-items: center; justify-content: center; font-size: 28px;
    transition: transform .2s ease, box-shadow .2s ease;
}
.vitalstar-bottom-nav .create-btn:hover {
    transform: translateY(-3px) scale(1.04);
    box-shadow: 0 0 24px rgba(0,102,255,.7), 0 9px 25px rgba(0,0,0,.5);
}
.vitalstar-bottom-nav .create-btn small { display: none; }

@media (max-width: 600px) {
    body { padding-bottom: 78px !important; }
    .vitalstar-bottom-nav { height: 65px; padding: 0 4px; }
    .vitalstar-bottom-nav .create-btn { width: 56px; height: 56px; margin-top: -26px; }
    .vitalstar-bottom-nav .nav-icon { font-size: 20px; }
    .vitalstar-bottom-nav small { font-size: 9px; }
}

* { scrollbar-width: thin; scrollbar-color: #17385e #030712; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #030712; }
::-webkit-scrollbar-thumb { background: #17385e; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #245989; }

/* ==========================================================
   SMALL NEON LOADER (replaces fullscreen loader)
   ========================================================== */
@keyframes vsNeonSpin { to { transform: rotate(360deg); } }
@keyframes vsNeonPulse {
    0%, 100% { box-shadow: 0 0 10px rgba(0,255,136,.25), 0 0 22px rgba(22,131,255,.18); }
    50%      { box-shadow: 0 0 16px rgba(0,255,136,.5),  0 0 34px rgba(22,131,255,.32); }
}
@keyframes vsNeonDots { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
.vs-neon-loader {
    position: fixed; left: 50%; bottom: 88px; z-index: 99980;
    transform: translateX(-50%) translateY(0);
    display: inline-flex; align-items: center; gap: 10px;
    padding: 8px 16px 8px 10px; border-radius: 999px;
    background: rgba(5,12,24,.92);
    border: 1px solid rgba(0,255,136,.35);
    color: #eafff5; font-size: 12px; font-weight: 700; letter-spacing: .3px;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    animation: vsNeonPulse 1.8s ease-in-out infinite;
    transition: opacity .25s ease, transform .25s ease, visibility .25s ease;
    pointer-events: none;
}
.vs-neon-loader.hide { opacity: 0; visibility: hidden; transform: translateX(-50%) translateY(8px); }
.vs-neon-ring {
    width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box;
    border: 2.5px solid transparent;
    border-top-color: #00ff88; border-right-color: #1683ff; border-bottom-color: #a855f7;
    filter: drop-shadow(0 0 4px rgba(0,255,136,.9));
    animation: vsNeonSpin .8s linear infinite;
}
.vs-neon-dots span { animation: vsNeonDots 1.2s infinite; }
.vs-neon-dots span:nth-child(2) { animation-delay: .2s; }
.vs-neon-dots span:nth-child(3) { animation-delay: .4s; }
@media (prefers-reduced-motion: reduce) {
    .vs-neon-ring, .vs-neon-loader, .vs-neon-dots span { animation-duration: 3s; }
}
`;
document.head.appendChild(vitalStarThemeStyle);

/* ==========================================================
   LIGHT THEME
   ========================================================== */
const vitalStarMessagesThemeStyle = document.createElement("style");
vitalStarMessagesThemeStyle.textContent = `
    html[data-theme="light"] body, body[data-theme="light"] {
        background: linear-gradient(180deg, #f8faff 0%, #eef3ff 55%, #ffffff 100%) !important;
        color: #182238 !important; color-scheme: light;
    }
    html[data-theme="light"] .header {
        background: linear-gradient(135deg, #ffffff, #eaf0ff) !important;
        color: #242044 !important;
        box-shadow: 0 5px 20px rgba(70,75,130,.10) !important;
        border-bottom: 1px solid rgba(90,85,170,.10);
    }
    html[data-theme="light"] .header-subtitle { color: #68718a !important; }
    html[data-theme="light"] .header-icon { background: rgba(105,75,210,.10) !important; color: #5130a8 !important; }
    html[data-theme="light"] #searchInput, html[data-theme="light"] input[type="search"] {
        background: #ffffff !important; color: #20263a !important;
        border: 1px solid #e1e6f2 !important; box-shadow: 0 3px 12px rgba(40,55,100,.07) !important;
    }
    html[data-theme="light"] #searchInput::placeholder { color: #8992a8 !important; }
    html[data-theme="light"] .message-card {
        background: rgba(255,255,255,.96) !important; color: #20263a !important;
        border: 1px solid #e6eaf4 !important; box-shadow: 0 5px 18px rgba(50,60,110,.08) !important;
    }
    html[data-theme="light"] .message-card .name { color: #351477 !important; }
    html[data-theme="light"] .message-card .last-message { color: #667085 !important; }
    html[data-theme="light"] .message-card .time-text { color: #8992a8 !important; }
    html[data-theme="light"] .profile-picture, html[data-theme="light"] .profile-letter { border-color: #ffffff !important; }
    html[data-theme="light"] .profile-letter { background: linear-gradient(135deg, #6a11cb, #2575fc) !important; color: #ffffff !important; }
    html[data-theme="light"] .online-dot { border-color: #ffffff !important; }
    html[data-theme="light"] .unread-badge {
        background: linear-gradient(135deg, #6a11cb, #2575fc) !important; color: #ffffff !important;
        box-shadow: 0 3px 8px rgba(75,60,200,.20) !important;
    }
    html[data-theme="light"] .delete-chat-btn { background: #fff1f3 !important; color: #e63950 !important; border-color: #ffe0e5 !important; }
    html[data-theme="light"] .empty-state {
        background: rgba(255,255,255,.86) !important; color: #20263a !important;
        box-shadow: 0 5px 20px rgba(40,55,100,.06) !important;
    }
    html[data-theme="light"] .empty-state h2 { color: #351477 !important; }
    html[data-theme="light"] .empty-state p { color: #778198 !important; }
    html[data-theme="light"] .vitalstar-bottom-nav {
        background: rgba(255,255,255,.97) !important;
        border-top: 1px solid rgba(40,50,90,.10) !important;
        box-shadow: 0 -5px 20px rgba(30,40,80,.08) !important;
    }
    html[data-theme="light"] .vitalstar-bottom-nav a { color: #727b91 !important; }
    html[data-theme="light"] .vitalstar-bottom-nav a.active { color: #5c32bb !important; }
    html[data-theme="light"] .vitalstar-bottom-nav .create-btn { border-color: #ffffff !important; color: #ffffff !important; }
    html[data-theme="light"] .vs-neon-loader {
        background: rgba(255,255,255,.96); color: #26304a; border-color: rgba(106,17,203,.28);
    }
`;
document.head.appendChild(vitalStarMessagesThemeStyle);

/* ==========================================================
   THEME SYNC
   ========================================================== */
const LIGHT_VALUES = ["light", "white", "bright"];
const DARK_VALUES = ["dark", "night"];

function readVitalStarTheme() {
    const rootTheme = document.documentElement.getAttribute("data-theme");
    const bodyTheme = document.body?.getAttribute("data-theme");
    let storedTheme = "";

    for (const key of ["vitalstar-theme", "vs-theme", "theme", "themeMode", "vitalstarTheme"]) {
        try {
            const value = localStorage.getItem(key);
            if (!value) continue;
            const normalized = String(value).toLowerCase();
            if (LIGHT_VALUES.includes(normalized)) storedTheme = "light";
            else if (DARK_VALUES.includes(normalized)) storedTheme = "dark";
            if (storedTheme) break;
            try {
                const parsed = JSON.parse(value);
                const mode = String(parsed?.theme || parsed?.mode || parsed?.value || "").toLowerCase();
                if (LIGHT_VALUES.includes(mode)) storedTheme = "light";
                else if (DARK_VALUES.includes(mode)) storedTheme = "dark";
                if (storedTheme) break;
            } catch (_) {}
        } catch (_) {}
    }

    const chosen = String(storedTheme || rootTheme || bodyTheme || "dark").toLowerCase();
    return LIGHT_VALUES.includes(chosen) ? "light" : "dark";
}

function syncVitalStarMessagesTheme() {
    const selectedTheme = readVitalStarTheme();
    if (document.documentElement.getAttribute("data-theme") !== selectedTheme) {
        document.documentElement.setAttribute("data-theme", selectedTheme);
    }
    document.documentElement.style.colorScheme = selectedTheme;
    document.body?.setAttribute("data-theme", selectedTheme);
}

syncVitalStarMessagesTheme();
window.addEventListener("vitalstar-theme-change", syncVitalStarMessagesTheme);
window.addEventListener("themechange", syncVitalStarMessagesTheme);
window.addEventListener("storage", event => {
    if (!event.key || /theme/i.test(event.key)) syncVitalStarMessagesTheme();
});
new MutationObserver(() => {
    if (document.documentElement.getAttribute("data-theme") !== readVitalStarTheme()) {
        syncVitalStarMessagesTheme();
    }
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

/* ==========================================================
   BOTTOM NAV
   ========================================================== */
function createHomeFooter() {
    document.querySelector(".bottom-nav")?.remove();
    document.querySelector(".vitalstar-bottom-nav")?.remove();

    const footer = document.createElement("nav");
    footer.className = "vitalstar-bottom-nav";
    footer.setAttribute("aria-label", "VitalStar navigation");
    footer.innerHTML = `
        <a href="home.html" class="home-nav" aria-label="Home">
            <span class="nav-icon">🏠</span><small>Home</small>
        </a>
        <a href="users.html" class="explore-nav" aria-label="Explore">
            <span class="nav-icon">👥</span><small>Explore</small>
        </a>
        <a href="create-post.html" class="create-btn" aria-label="Create post">
            <span class="nav-icon">+</span>
        </a>
        <a href="wallet.html" class="finance-nav" aria-label="Finance">
            <span class="nav-icon">💰</span><small>Finance</small>
        </a>
        <a href="profile.html" class="profile-nav" aria-label="Profile">
            <span class="nav-icon">👤</span><small>Profile</small>
        </a>
    `;
    document.body.appendChild(footer);
}
createHomeFooter();

/* ==========================================================
   SMALL NEON LOADER
   ========================================================== */
const neonLoader = document.createElement("div");
neonLoader.id = "vitalStarLoader";
neonLoader.className = "vs-neon-loader";
neonLoader.setAttribute("role", "status");
neonLoader.setAttribute("aria-live", "polite");
neonLoader.innerHTML = `
    <div class="vs-neon-ring"></div>
    <div>Loading<span class="vs-neon-dots"><span>.</span><span>.</span><span>.</span></span></div>
`;
document.body.appendChild(neonLoader);

let loaderHidden = false;
function hideVitalStarLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    neonLoader.classList.add("hide");
    setTimeout(() => neonLoader.remove(), 300);
}
// Safety net: never leave the indicator spinning forever
setTimeout(hideVitalStarLoader, 10000);

/* ==========================================================
   STATE
   ========================================================== */
const messageList = document.getElementById("messageList");
const searchInput = document.getElementById("searchInput");

const PROFILE_TTL = 5 * 60 * 1000;

let currentUser = null;
let allChats = [];
let unsubscribeChats = null;
let snapshotVersion = 0;

const chatListeners = new Map();
const unreadCounts = new Map();
const profileCache = new Map(); // uid -> { profile, at }

/* ==========================================================
   HELPERS
   ========================================================== */
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getTimestampValue(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (timestamp.seconds) return timestamp.seconds * 1000;
    if (timestamp instanceof Date) return timestamp.getTime();
    if (typeof timestamp === "number") return timestamp;
    return 0;
}

function formatTime(timestamp) {
    const time = getTimestampValue(timestamp);
    if (!time) return "";

    const date = new Date(time);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (sameDay) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function getLastMessageHtml(chat) {
    if (chat.lastMessage) return escapeHtml(chat.lastMessage);
    if (chat.lastImage) return "🖼️ Photo";
    if (chat.lastVideo) return "🎥 Video";
    if (chat.lastAudio) return "🎤 Voice message";
    return "Start a conversation";
}

function getProfilePicture(userData) {
    if (!userData || typeof userData !== "object") return "";

    const candidates = [
        userData.profilePic, userData.profilePicture, userData.photoURL, userData.photoUrl,
        userData.profileImage, userData.profileImageUrl, userData.profileImageURL,
        userData.profile_image, userData.profile_img, userData.profile_photo,
        userData.photo_url, userData.image_url, userData.avatar, userData.avatarUrl,
        userData.avatarURL, userData.photo, userData.image, userData.imageUrl,
        userData.imageURL, userData.picture, userData.userPhoto, userData.userImage,
        userData.profileUrl, userData.pictureURL, userData.avatar_url,
        userData.downloadURL, userData.downloadUrl,
        userData?.photos?.profile, userData?.images?.profile
    ];

    for (const candidate of candidates) {
        const value = typeof candidate === "string"
            ? candidate.trim()
            : candidate && typeof candidate === "object"
                ? String(candidate.url || candidate.downloadURL || candidate.src || "").trim()
                : "";
        if (value && /^(https?:|data:image\/|blob:)/i.test(value)) return value;
    }
    return "";
}

function getFirstLetter(name) {
    const cleanName = String(name || "U").trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "U";
}

function getCachedProfile(uid) {
    const entry = profileCache.get(uid);
    return entry ? entry.profile : null;
}

function isProfileFresh(uid) {
    const entry = profileCache.get(uid);
    return !!entry && Date.now() - entry.at < PROFILE_TTL;
}

/* ==========================================================
   RENDERING
   ========================================================== */
function createAvatar(chat) {
    const letter = getFirstLetter(chat.fullName);

    if (chat.profilePic) {
        return `
            <div class="avatar-wrapper">
                <img src="${escapeHtml(chat.profilePic)}" class="profile-picture"
                     alt="${escapeHtml(chat.fullName)}" loading="lazy" decoding="async"
                     referrerpolicy="no-referrer">
                <span class="online-dot"></span>
            </div>
        `;
    }

    return `
        <div class="avatar-wrapper">
            <div class="profile-letter">${escapeHtml(letter)}</div>
            <span class="online-dot"></span>
        </div>
    `;
}

function createChatCard(chat) {
    const unreadCount = unreadCounts.get(chat.id) || 0;

    const card = document.createElement("div");
    card.className = "message-card";
    card.dataset.chatId = chat.id;
    if (unreadCount > 0) card.classList.add("unread-card");

    const unreadBadge = unreadCount > 0
        ? `<span class="unread-badge">${unreadCount > 99 ? "99+" : unreadCount}</span>`
        : "";

    card.innerHTML = `
        ${createAvatar(chat)}
        <div class="message-info">
            <div class="top-row">
                <div class="name">${escapeHtml(chat.fullName)}</div>
                <div class="time-text">${formatTime(chat.lastTimestamp)}</div>
            </div>
            <div class="bottom-row">
                <div class="last-message">${getLastMessageHtml(chat)}</div>
                ${unreadBadge}
            </div>
        </div>
        <button class="delete-chat-btn" type="button" title="Delete chat" aria-label="Delete chat">🗑️</button>
    `;

    const image = card.querySelector(".profile-picture");
    if (image) {
        image.addEventListener("error", () => {
            const wrapper = image.closest(".avatar-wrapper");
            if (!wrapper) return;
            wrapper.innerHTML = `
                <div class="profile-letter">${escapeHtml(getFirstLetter(chat.fullName))}</div>
                <span class="online-dot"></span>
            `;
        });
    }

    card.addEventListener("click", () => {
        window.location.href = `chat.html?uid=${encodeURIComponent(chat.otherUserId)}`;
    });

    card.querySelector(".delete-chat-btn")?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        deleteChat(chat.id, card);
    });

    return card;
}

function renderEmptyState(icon, title, text) {
    if (!messageList) return;
    messageList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(text)}</p>
        </div>
    `;
}

function renderChats() {
    if (!messageList) return;

    const search = searchInput?.value?.trim().toLowerCase() || "";
    let chats = [...allChats];

    if (search) {
        chats = chats.filter(chat => {
            const name = (chat.fullName || "").toLowerCase();
            const message = (chat.lastMessage || "").toLowerCase();
            return name.includes(search) || message.includes(search);
        });
    }

    chats.sort((a, b) => getTimestampValue(b.lastTimestamp) - getTimestampValue(a.lastTimestamp));

    if (!chats.length) {
        renderEmptyState(
            search ? "🔎" : "💬",
            search ? "No results" : "No conversations",
            search ? "No conversations match your search." : "Start chatting with your friends."
        );
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const chat of chats) fragment.appendChild(createChatCard(chat));

    messageList.innerHTML = "";
    messageList.appendChild(fragment);
}

function updateUnreadBadge(chatId) {
    const count = unreadCounts.get(chatId) || 0;
    if (!allChats.some(item => item.id === chatId)) return;

    const card = messageList?.querySelector(`[data-chat-id="${CSS.escape(chatId)}"]`);
    if (!card) {
        renderChats();
        return;
    }

    const bottomRow = card.querySelector(".bottom-row");
    if (!bottomRow) return;

    bottomRow.querySelector(".unread-badge")?.remove();

    if (count > 0) {
        const badge = document.createElement("span");
        badge.className = "unread-badge";
        badge.textContent = count > 99 ? "99+" : count;
        bottomRow.appendChild(badge);
        card.classList.add("unread-card");
    } else {
        card.classList.remove("unread-card");
    }
}

/* ==========================================================
   LISTENERS
   ========================================================== */
// Only listens to this user's unread messages instead of downloading
// every message of every chat.
function listenToChat(chatId) {
    if (chatListeners.has(chatId) || !currentUser) return;

    const unreadQuery = query(
        collection(db, "chats", chatId, "messages"),
        where("receiverId", "==", currentUser.uid),
        where("read", "==", false)
    );

    const unsubscribe = onSnapshot(
        unreadQuery,
        snapshot => {
            unreadCounts.set(chatId, snapshot.size);
            updateUnreadBadge(chatId);
        },
        error => console.error("Message listener error:", error)
    );

    chatListeners.set(chatId, unsubscribe);
}

function stopListeningToChat(chatId) {
    const unsubscribe = chatListeners.get(chatId);
    if (unsubscribe) {
        unsubscribe();
        chatListeners.delete(chatId);
    }
}

function stopAllListeners() {
    if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
    }
    for (const unsubscribe of chatListeners.values()) unsubscribe();
    chatListeners.clear();
    unreadCounts.clear();
}

window.addEventListener("pagehide", stopAllListeners);

/* ==========================================================
   DELETE CHAT
   ========================================================== */
async function deleteChat(chatId, card) {
    const confirmed = confirm("Delete this conversation?\n\nAll messages in this chat will be deleted.");
    if (!confirmed) return;

    try {
        card.style.opacity = "0.45";
        card.style.pointerEvents = "none";

        // Stop the unread listener first so it doesn't error while docs disappear
        stopListeningToChat(chatId);

        const snapshot = await getDocs(collection(db, "chats", chatId, "messages"));

        let batch = writeBatch(db);
        let count = 0;

        for (const messageDoc of snapshot.docs) {
            batch.delete(messageDoc.ref);
            count++;
            if (count === 500) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) await batch.commit();

        await deleteDoc(doc(db, "chats", chatId));

        unreadCounts.delete(chatId);
        allChats = allChats.filter(chat => chat.id !== chatId);
        renderChats();
    } catch (error) {
        console.error("Delete chat error:", error);
        card.style.opacity = "1";
        card.style.pointerEvents = "auto";
        listenToChat(chatId); // restore listener after a failed delete
        alert("Unable to delete this conversation.");
    }
}

/* ==========================================================
   LOAD PROFILES
   ========================================================== */
async function loadProfile(uid) {
    try {
        const userSnap = await getDoc(doc(db, "users", uid));
        let profile = { fullName: "Unknown User", profilePic: "" };

        if (userSnap.exists()) {
            const userData = userSnap.data();
            profile = {
                fullName: userData.fullName || userData.username || "Unknown User",
                profilePic: getProfilePicture(userData)
            };
        }

        profileCache.set(uid, { profile, at: Date.now() });
        return profile;
    } catch (error) {
        console.error("Profile loading error:", error);
        return getCachedProfile(uid) || { fullName: "Unknown User", profilePic: "" };
    }
}

/* ==========================================================
   AUTH + CHAT LIST
   ========================================================== */
onAuthStateChanged(auth, user => {
    // Clean up anything from a previous auth state (prevents duplicate listeners)
    stopAllListeners();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid)
    );

    unsubscribeChats = onSnapshot(
        chatsQuery,
        async snapshot => {
            const version = ++snapshotVersion;
            const chats = [];
            const activeChatIds = new Set();

            for (const chatDoc of snapshot.docs) {
                const data = chatDoc.data();
                if (!Array.isArray(data.participants)) continue;

                const otherUserId = data.participants.find(id => id !== user.uid);
                if (!otherUserId) continue;

                activeChatIds.add(chatDoc.id);

                const cached = getCachedProfile(otherUserId);
                chats.push({
                    id: chatDoc.id,
                    ...data,
                    otherUserId,
                    fullName: cached?.fullName || "Loading...",
                    profilePic: cached?.profilePic || ""
                });
            }

            allChats = chats;
            renderChats();
            hideVitalStarLoader();

            // Drop listeners for chats that no longer exist
            for (const chatId of [...chatListeners.keys()]) {
                if (!activeChatIds.has(chatId)) {
                    stopListeningToChat(chatId);
                    unreadCounts.delete(chatId);
                }
            }

            // Start unread listeners right away (don't wait for profiles)
            for (const chat of chats) listenToChat(chat.id);

            // Fetch only missing/expired profiles, once per user
            const staleIds = [...new Set(
                chats.map(chat => chat.otherUserId).filter(uid => !isProfileFresh(uid))
            )];

            if (!staleIds.length) return;

            await Promise.all(staleIds.map(loadProfile));

            // A newer snapshot arrived while we were loading — it handles rendering
            if (version !== snapshotVersion) return;

            for (const chat of chats) {
                const profile = getCachedProfile(chat.otherUserId);
                if (profile) Object.assign(chat, profile);
            }
            renderChats();
        },
        error => {
            console.error("Chats error:", error);
            renderEmptyState("⚠️", "Unable to load messages", "Check your connection and try again.");
            hideVitalStarLoader();
        }
    );
});

/* ==========================================================
   SEARCH
   ========================================================== */
searchInput?.addEventListener("input", renderChats);
