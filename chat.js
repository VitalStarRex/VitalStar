// ============================================================
// VITALSTAR — CUSTOM CHAT
// Firebase v10.12.2
// Navy Theme + Custom Chat Bubbles + Chat Appearance Settings
// ============================================================

import { auth, db, rtdb } from "./firebase.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// DOM
// ============================================================

const backBtn = document.getElementById("backBtn");
const chatAvatar = document.getElementById("chatAvatar");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");
const messages = document.getElementById("messages");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");

const imageBtn = document.getElementById("imageBtn");
const videoBtn = document.getElementById("videoBtn");
const recordBtn = document.getElementById("recordBtn");


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let receiverUid = new URLSearchParams(location.search).get("uid");

let chatId = null;
let receiverData = null;

let unsubscribeMessages = null;
let unsubscribeStatus = null;
let unsubscribeIncomingCalls = null;

let selectedImage = null;
let selectedVideo = null;

let mediaRecorder = null;
let audioChunks = [];
let voiceUrl = null;

let activeCall = null;
let currentAudio = null;


// ============================================================
// DEFAULT CHAT APPEARANCE
// ============================================================

const DEFAULT_CHAT_SETTINGS = {
    theme: "navy",

    background: "#00152f",

    sentBubble: "#0757a8",

    receivedBubble: "#102746",

    sentText: "#ffffff",

    receivedText: "#ffffff",

    accent: "#ffd400"
};


// ============================================================
// CHAT THEMES
// ============================================================

const CHAT_THEMES = {

    navy: {
        name: "VitalStar Navy",
        background: "#00152f",
        sentBubble: "#0757a8",
        receivedBubble: "#102746",
        sentText: "#ffffff",
        receivedText: "#ffffff",
        accent: "#ffd400"
    },

    midnight: {
        name: "Midnight",
        background: "#05070d",
        sentBubble: "#182338",
        receivedBubble: "#111827",
        sentText: "#ffffff",
        receivedText: "#ffffff",
        accent: "#ffd400"
    },

    ocean: {
        name: "Ocean",
        background: "#002b3d",
        sentBubble: "#006b8f",
        receivedBubble: "#073b4c",
        sentText: "#ffffff",
        receivedText: "#ffffff",
        accent: "#00e5ff"
    },

    purple: {
        name: "Purple",
        background: "#160d2b",
        sentBubble: "#6537a8",
        receivedBubble: "#291746",
        sentText: "#ffffff",
        receivedText: "#ffffff",
        accent: "#d79cff"
    },

    black: {
        name: "Black",
        background: "#000000",
        sentBubble: "#242424",
        receivedBubble: "#151515",
        sentText: "#ffffff",
        receivedText: "#ffffff",
        accent: "#ffd400"
    }

};


// ============================================================
// LOAD SETTINGS
// ============================================================

let chatSettings = loadChatSettings();

function loadChatSettings() {

    try {

        const saved = localStorage.getItem(
            "vitalstar_chat_settings"
        );

        if (!saved) {
            return {
                ...DEFAULT_CHAT_SETTINGS
            };
        }

        return {
            ...DEFAULT_CHAT_SETTINGS,
            ...JSON.parse(saved)
        };

    } catch {

        return {
            ...DEFAULT_CHAT_SETTINGS
        };

    }

}


// ============================================================
// SAVE SETTINGS
// ============================================================

function saveChatSettings() {

    localStorage.setItem(
        "vitalstar_chat_settings",
        JSON.stringify(chatSettings)
    );

}


// ============================================================
// APPLY CHAT SETTINGS
// ============================================================

function applyChatSettings() {

    const root = document.documentElement;

    root.style.setProperty(
        "--chat-background",
        chatSettings.background
    );

    root.style.setProperty(
        "--sent-bubble",
        chatSettings.sentBubble
    );

    root.style.setProperty(
        "--received-bubble",
        chatSettings.receivedBubble
    );

    root.style.setProperty(
        "--sent-text",
        chatSettings.sentText
    );

    root.style.setProperty(
        "--received-text",
        chatSettings.receivedText
    );

    root.style.setProperty(
        "--chat-accent",
        chatSettings.accent
    );

    document.body.style.background =
        chatSettings.background;

}


// ============================================================
// CHAT APPEARANCE CSS
// ============================================================

function injectChatStyles() {

    if (document.getElementById("vitalstar-chat-style")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "vitalstar-chat-style";

    style.textContent = `

    :root {
        --chat-background: #00152f;
        --sent-bubble: #0757a8;
        --received-bubble: #102746;
        --sent-text: #ffffff;
        --received-text: #ffffff;
        --chat-accent: #ffd400;
    }

    /* =========================================
       MAIN CHAT
       ========================================= */

    body {
        background: var(--chat-background) !important;
        color: #ffffff;
        transition:
            background .25s ease,
            color .25s ease;
    }

    #messages {
        background:
            radial-gradient(
                circle at top,
                rgba(255,255,255,.035),
                transparent 40%
            ),
            var(--chat-background) !important;

        transition: background .25s ease;
    }

    /* =========================================
       SENT MESSAGE
       ========================================= */

    .message.sent .bubble,
    .message.sent .message-bubble,
    .sent .bubble,
    .sent .message-bubble {

        background:
            linear-gradient(
                135deg,
                var(--sent-bubble),
                color-mix(
                    in srgb,
                    var(--sent-bubble) 75%,
                    #000000
                )
            ) !important;

        color: var(--sent-text) !important;

        border: 1px solid
            color-mix(
                in srgb,
                var(--chat-accent) 30%,
                transparent
            );

        box-shadow:
            0 4px 14px rgba(0,0,0,.28);

    }

    /* =========================================
       RECEIVED MESSAGE
       ========================================= */

    .message.received .bubble,
    .message.received .message-bubble,
    .received .bubble,
    .received .message-bubble {

        background:
            linear-gradient(
                135deg,
                var(--received-bubble),
                color-mix(
                    in srgb,
                    var(--received-bubble) 82%,
                    #000000
                )
            ) !important;

        color: var(--received-text) !important;

        border: 1px solid
            rgba(255,255,255,.06);

        box-shadow:
            0 4px 14px rgba(0,0,0,.25);

    }

    /* =========================================
       SETTINGS BUTTON
       ========================================= */

    #chatSettingsBtn {

        width: 42px;
        height: 42px;

        border-radius: 50%;

        border: 1px solid
            rgba(255,212,0,.45);

        background:
            rgba(0,31,77,.95);

        color: var(--chat-accent);

        display: flex;
        align-items: center;
        justify-content: center;

        font-size: 20px;

        cursor: pointer;

        box-shadow:
            0 0 12px
            rgba(255,212,0,.15);

        transition:
            transform .2s ease,
            box-shadow .2s ease;

    }

    #chatSettingsBtn:hover {

        transform: rotate(25deg);

        box-shadow:
            0 0 18px
            rgba(255,212,0,.4);

    }

    /* =========================================
       APPEARANCE PANEL
       ========================================= */

    #chatAppearancePanel {

        position: fixed;

        top: 0;
        right: 0;

        width: min(360px, 92vw);
        height: 100vh;

        background:
            linear-gradient(
                180deg,
                #001f4d,
                #000d20
            );

        z-index: 999999;

        padding: 22px;

        box-sizing: border-box;

        transform:
            translateX(105%);

        transition:
            transform .3s ease;

        overflow-y: auto;

        border-left:
            1px solid
            rgba(255,212,0,.25);

        box-shadow:
            -12px 0 40px
            rgba(0,0,0,.55);

    }

    #chatAppearancePanel.open {
        transform: translateX(0);
    }

    .appearance-header {

        display: flex;
        align-items: center;
        justify-content: space-between;

        margin-bottom: 25px;

    }

    .appearance-title {

        font-size: 20px;
        font-weight: 800;

        color: #ffffff;

    }

    .appearance-close {

        width: 38px;
        height: 38px;

        border-radius: 50%;

        border: none;

        background: rgba(255,255,255,.08);

        color: #ffffff;

        font-size: 20px;

        cursor: pointer;

    }

    .appearance-section {

        margin-bottom: 25px;

    }

    .appearance-label {

        display: block;

        font-size: 13px;

        font-weight: 700;

        color: #aebed4;

        margin-bottom: 12px;

        text-transform: uppercase;

        letter-spacing: .7px;

    }

    .theme-grid {

        display: grid;

        grid-template-columns:
            repeat(2, 1fr);

        gap: 10px;

    }

    .theme-option {

        padding: 13px;

        border-radius: 14px;

        border: 1px solid
            rgba(255,255,255,.1);

        background:
            rgba(255,255,255,.04);

        color: #ffffff;

        cursor: pointer;

        text-align: left;

        transition:
            .2s ease;

    }

    .theme-option:hover {

        border-color:
            var(--chat-accent);

        transform: translateY(-2px);

    }

    .theme-option.active {

        border-color:
            var(--chat-accent);

        box-shadow:
            0 0 12px
            rgba(255,212,0,.2);

    }

    .theme-preview {

        height: 45px;

        border-radius: 10px;

        margin-bottom: 8px;

    }

    .theme-name {

        font-size: 13px;

        font-weight: 700;

    }

    .color-row {

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 13px;

        margin-bottom: 10px;

        border-radius: 13px;

        background:
            rgba(255,255,255,.045);

    }

    .color-row span {

        color: #ffffff;

        font-size: 14px;

        font-weight: 600;

    }

    .color-row input[type="color"] {

        width: 48px;
        height: 36px;

        padding: 0;

        border: none;

        background: transparent;

        cursor: pointer;

    }

    .reset-chat-btn {

        width: 100%;

        padding: 14px;

        border-radius: 13px;

        border:
            1px solid
            rgba(255,212,0,.45);

        background:
            rgba(255,212,0,.08);

        color: #ffd400;

        font-weight: 800;

        cursor: pointer;

    }

    /* =========================================
       SETTINGS OVERLAY
       ========================================= */

    #chatAppearanceOverlay {

        position: fixed;

        inset: 0;

        background:
            rgba(0,0,0,.55);

        z-index: 999998;

        opacity: 0;

        pointer-events: none;

        transition: opacity .25s ease;

    }

    #chatAppearanceOverlay.open {

        opacity: 1;

        pointer-events: auto;

    }

    /* =========================================
       NAVY COMPOSER
       ========================================= */

    #messageForm {

        background:
            #001f4d !important;

        border-top:
            1px solid
            var(--chat-accent) !important;

        box-shadow:
            0 -4px 18px
            rgba(0,0,0,.3);

    }

    /* =========================================
       MESSAGE TIME
       ========================================= */

    .message-time {

        color:
            rgba(255,255,255,.58);

        font-size: 10px;

    }

    `;

    document.head.appendChild(style);

}


// ============================================================
// LOADER
// ============================================================

function createLoader() {

    if (document.getElementById("vitalstarChatLoader")) {
        return;
    }

    const loader = document.createElement("div");

    loader.id = "vitalstarChatLoader";

    loader.innerHTML = `

        <div style="
            position:fixed;
            inset:0;
            z-index:9999999;
            background:
                radial-gradient(
                    circle at center,
                    #063b34 0%,
                    #001f4d 42%,
                    #000814 100%
                );
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
        ">

            <div style="
                width:90px;
                height:90px;
                border-radius:50%;
                border:4px solid rgba(255,212,0,.15);
                border-top-color:#35ff88;
                border-right-color:#ffd400;
                animation:vitalstarChatSpin 1s linear infinite;
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow:
                    0 0 35px rgba(53,255,136,.3);
            ">

                <div style="
                    font-size:25px;
                    font-weight:900;
                    color:#ffffff;
                    animation:vitalstarChatPulse 1.2s ease-in-out infinite;
                ">
                    VS
                </div>

            </div>

            <div style="
                margin-top:20px;
                color:#ffffff;
                font-size:14px;
                font-weight:700;
            ">
                Loading chat...
            </div>

        </div>
    `;

    document.body.appendChild(loader);

    const style = document.createElement("style");

    style.textContent = `

        @keyframes vitalstarChatSpin {
            to {
                transform:rotate(360deg);
            }
        }

        @keyframes vitalstarChatPulse {
            50% {
                transform:scale(1.12);
                opacity:.7;
            }
        }

    `;

    document.head.appendChild(style);

}


function hideLoader() {

    const loader =
        document.getElementById(
            "vitalstarChatLoader"
        );

    if (!loader) return;

    loader.style.opacity = "0";
    loader.style.transition = "opacity .35s ease";

    setTimeout(() => {
        loader.remove();
    }, 350);

}


// ============================================================
// APPEARANCE SETTINGS UI
// ============================================================

function createAppearanceSettings() {

    if (document.getElementById("chatAppearancePanel")) {
        return;
    }

    const overlay =
        document.createElement("div");

    overlay.id =
        "chatAppearanceOverlay";

    const panel =
        document.createElement("div");

    panel.id =
        "chatAppearancePanel";

    panel.innerHTML = `

        <div class="appearance-header">

            <div class="appearance-title">
                Chat Appearance
            </div>

            <button
                class="appearance-close"
                id="closeChatAppearance"
            >
                ×
            </button>

        </div>


        <div class="appearance-section">

            <span class="appearance-label">
                Chat Theme
            </span>

            <div
                class="theme-grid"
                id="chatThemeGrid"
            ></div>

        </div>


        <div class="appearance-section">

            <span class="appearance-label">
                Chat Bubbles
            </span>

            <div class="color-row">

                <span>
                    Sent bubble
                </span>

                <input
                    type="color"
                    id="sentBubbleColor"
                    value="${chatSettings.sentBubble}"
                >

            </div>


            <div class="color-row">

                <span>
                    Received bubble
                </span>

                <input
                    type="color"
                    id="receivedBubbleColor"
                    value="${chatSettings.receivedBubble}"
                >

            </div>

        </div>


        <div class="appearance-section">

            <span class="appearance-label">
                Chat Background
            </span>

            <div class="color-row">

                <span>
                    Background
                </span>

                <input
                    type="color"
                    id="chatBackgroundColor"
                    value="${chatSettings.background}"
                >

            </div>

        </div>


        <button
            class="reset-chat-btn"
            id="resetChatAppearance"
        >
            Reset to VitalStar Default
        </button>

    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);


    const grid =
        document.getElementById(
            "chatThemeGrid"
        );


    Object.entries(CHAT_THEMES)
        .forEach(([key, theme]) => {

            const button =
                document.createElement("button");

            button.className =
                "theme-option";

            if (
                chatSettings.theme === key
            ) {
                button.classList.add("active");
            }

            button.dataset.theme = key;

            button.innerHTML = `

                <div
                    class="theme-preview"
                    style="
                        background:
                            ${theme.background};
                        border:
                            1px solid
                            ${theme.accent};
                    "
                ></div>

                <div class="theme-name">
                    ${theme.name}
                </div>

            `;

            button.addEventListener(
                "click",
                () => {

                    applyTheme(key);

                    document
                        .querySelectorAll(
                            ".theme-option"
                        )
                        .forEach(item => {

                            item.classList.remove(
                                "active"
                            );

                        });

                    button.classList.add(
                        "active"
                    );

                }
            );

            grid.appendChild(button);

        });


    document
        .getElementById(
            "closeChatAppearance"
        )
        .addEventListener(
            "click",
            closeAppearanceSettings
        );


    overlay.addEventListener(
        "click",
        closeAppearanceSettings
    );


    document
        .getElementById(
            "sentBubbleColor"
        )
        .addEventListener(
            "input",
            e => {

                chatSettings.sentBubble =
                    e.target.value;

                saveChatSettings();
                applyChatSettings();

            }
        );


    document
        .getElementById(
            "receivedBubbleColor"
        )
        .addEventListener(
            "input",
            e => {

                chatSettings.receivedBubble =
                    e.target.value;

                saveChatSettings();
                applyChatSettings();

            }
        );


    document
        .getElementById(
            "chatBackgroundColor"
        )
        .addEventListener(
            "input",
            e => {

                chatSettings.background =
                    e.target.value;

                saveChatSettings();
                applyChatSettings();

            }
        );


    document
        .getElementById(
            "resetChatAppearance"
        )
        .addEventListener(
            "click",
            resetChatAppearance
        );

}


// ============================================================
// THEME
// ============================================================

function applyTheme(themeName) {

    const theme =
        CHAT_THEMES[themeName];

    if (!theme) return;

    chatSettings = {
        ...chatSettings,

        theme: themeName,

        background:
            theme.background,

        sentBubble:
            theme.sentBubble,

        receivedBubble:
            theme.receivedBubble,

        sentText:
            theme.sentText,

        receivedText:
            theme.receivedText,

        accent:
            theme.accent
    };

    saveChatSettings();
    applyChatSettings();


    const sent =
        document.getElementById(
            "sentBubbleColor"
        );

    const received =
        document.getElementById(
            "receivedBubbleColor"
        );

    const background =
        document.getElementById(
            "chatBackgroundColor"
        );

    if (sent) {
        sent.value =
            chatSettings.sentBubble;
    }

    if (received) {
        received.value =
            chatSettings.receivedBubble;
    }

    if (background) {
        background.value =
            chatSettings.background;
    }

}


function resetChatAppearance() {

    chatSettings = {
        ...DEFAULT_CHAT_SETTINGS
    };

    saveChatSettings();
    applyChatSettings();

    createAppearanceSettings();

    const sent =
        document.getElementById(
            "sentBubbleColor"
        );

    const received =
        document.getElementById(
            "receivedBubbleColor"
        );

    const background =
        document.getElementById(
            "chatBackgroundColor"
        );

    if (sent) {
        sent.value =
            chatSettings.sentBubble;
    }

    if (received) {
        received.value =
            chatSettings.receivedBubble;
    }

    if (background) {
        background.value =
            chatSettings.background;
    }

    document
        .querySelectorAll(
            ".theme-option"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.theme === "navy"
            );

        });

}


function openAppearanceSettings() {

    createAppearanceSettings();

    document
        .getElementById(
            "chatAppearanceOverlay"
        )
        .classList.add("open");

    document
        .getElementById(
            "chatAppearancePanel"
        )
        .classList.add("open");

}


function closeAppearanceSettings() {

    const overlay =
        document.getElementById(
            "chatAppearanceOverlay"
        );

    const panel =
        document.getElementById(
            "chatAppearancePanel"
        );

    if (overlay) {
        overlay.classList.remove("open");
    }

    if (panel) {
        panel.classList.remove("open");
    }

}


// ============================================================
// ADD SETTINGS BUTTON TO HEADER
// ============================================================

function addSettingsButton() {

    if (
        document.getElementById(
            "chatSettingsBtn"
        )
    ) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "chatSettingsBtn";

    button.type =
        "button";

    button.title =
        "Chat appearance";

    button.innerHTML =
        "⚙️";

    button.addEventListener(
        "click",
        openAppearanceSettings
    );


    const header =
        chatName?.parentElement?.parentElement ||
        document.querySelector(
            "header"
        );


    if (header) {

        header.appendChild(button);

    } else {

        document.body.appendChild(button);

        button.style.position =
            "fixed";

        button.style.top =
            "12px";

        button.style.right =
            "12px";

        button.style.zIndex =
            "9999";

    }

}


// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function randomId(length = 12) {

    return Math.random()
        .toString(36)
        .substring(2, 2 + length);

}


function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    let date;

    if (
        typeof timestamp.toDate ===
        "function"
    ) {

        date =
            timestamp.toDate();

    } else {

        date =
            new Date(timestamp);

    }

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );

}


function formatAudioTime(seconds) {

    if (!Number.isFinite(seconds)) {
        return "0:00";
    }

    const mins =
        Math.floor(seconds / 60);

    const secs =
        Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");

    return `${mins}:${secs}`;

}


// ============================================================
// LAST SEEN
// ============================================================

function getStatusTimestamp(status) {

    if (!status) {
        return null;
    }

    if (
        status.lastSeen &&
        typeof status.lastSeen.toDate ===
        "function"
    ) {

        return status.lastSeen.toDate();

    }

    if (
        status.lastSeen?.seconds
    ) {

        return new Date(
            status.lastSeen.seconds * 1000
        );

    }

    if (
        typeof status.lastSeen ===
        "number"
    ) {

        return new Date(
            status.lastSeen
        );

    }

    return null;

}


function relativeLastSeen(date) {

    if (!date) {
        return "last seen recently";
    }

    const diff =
        Date.now() - date.getTime();

    const seconds =
        Math.floor(diff / 1000);

    if (seconds < 60) {
        return "last seen just now";
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {

        return `last seen ${minutes} ${
            minutes === 1
                ? "minute"
                : "minutes"
        } ago`;

    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {

        return `last seen ${hours} ${
            hours === 1
                ? "hour"
                : "hours"
        } ago`;

    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {

        return `last seen ${days} ${
            days === 1
                ? "day"
                : "days"
        } ago`;

    }

    const weeks =
        Math.floor(days / 7);

    return `last seen ${weeks} ${
        weeks === 1
            ? "week"
            : "weeks"
    } ago`;

}


function updateChatStatus(status) {

    if (!chatStatus) return;

    if (status?.online) {

        chatStatus.innerHTML = `
            <span style="
                display:inline-block;
                width:8px;
                height:8px;
                border-radius:50%;
                background:#35ff88;
                box-shadow:0 0 10px #35ff88;
                margin-right:6px;
            "></span>
            Online
        `;

        return;

    }

    const date =
        getStatusTimestamp(status);

    chatStatus.textContent =
        relativeLastSeen(date);

}


// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(
    file,
    resourceType = "auto"
) {

    const form =
        new FormData();

    form.append(
        "file",
        file
    );

    form.append(
        "upload_preset",
        "vitalstar_upload"
    );

    const response =
        await fetch(
            `https://api.cloudinary.com/v1_1/m0scmqqv/${resourceType}/upload`,
            {
                method: "POST",
                body: form
            }
        );

    if (!response.ok) {
        throw new Error(
            "Cloudinary upload failed"
        );
    }

    const data =
        await response.json();

    return data.secure_url;

}


// ============================================================
// MEDIA MENU
// ============================================================

function setupMediaMenu() {

    if (
        document.getElementById(
            "mediaMenu"
        )
    ) {
        return;
    }

    const menu =
        document.createElement("div");

    menu.id =
        "mediaMenu";

    menu.innerHTML = `

        <button
            type="button"
            id="openImagePicker"
        >
            🖼️ Image
        </button>

        <button
            type="button"
            id="openVideoPicker"
        >
            🎬 Video
        </button>

        <button
            type="button"
            id="openVoiceRecorder"
        >
            🎙️ Voice note
        </button>

    `;

    document.body.appendChild(menu);

}


// ============================================================
// INPUT FILES
// ============================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        event => {

            selectedImage =
                event.target.files?.[0] ||
                null;

        }
    );

}


if (videoInput) {

    videoInput.addEventListener(
        "change",
        event => {

            selectedVideo =
                event.target.files?.[0] ||
                null;

        }
    );

}


// ============================================================
// VOICE RECORDER
// ============================================================

async function startVoiceRecording() {

    if (mediaRecorder) {
        return;
    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus"
        ];


        let selectedMime = "";

        for (const type of mimeTypes) {

            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {

                selectedMime = type;
                break;

            }

        }


        mediaRecorder =
            selectedMime
                ? new MediaRecorder(
                    stream,
                    {
                        mimeType:
                            selectedMime
                    }
                )
                : new MediaRecorder(
                    stream
                );


        audioChunks = [];


        mediaRecorder.ondataavailable =
            event => {

                if (event.data.size > 0) {
                    audioChunks.push(
                        event.data
                    );
                }

            };


        mediaRecorder.onstop =
            async () => {

                try {

                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    mediaRecorder.mimeType ||
                                    "audio/webm"
                            }
                        );


                    const file =
                        new File(
                            [blob],
                            `voice-${Date.now()}.webm`,
                            {
                                type:
                                    blob.type
                            }
                        );


                    voiceUrl =
                        await uploadToCloudinary(
                            file,
                            "video"
                        );


                    messageInput.value =
                        "🎙️ Voice note ready";

                } catch (error) {

                    console.error(
                        "Voice upload error:",
                        error
                    );

                }


                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                mediaRecorder = null;

            };


        mediaRecorder.start();

        recordBtn?.classList.add(
            "recording"
        );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        alert(
            "Microphone permission is required for voice notes."
        );

    }

}


function stopVoiceRecording() {

    if (!mediaRecorder) {
        return;
    }

    mediaRecorder.stop();

    recordBtn?.classList.remove(
        "recording"
    );

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        createLoader();

        if (!user) {

            location.href =
                "login.html";

            return;

        }

        currentUser =
            user;


        if (
            !receiverUid ||
            receiverUid === user.uid
        ) {

            location.href =
                "home.html";

            return;

        }


        const ids = [
            user.uid,
            receiverUid
        ].sort();


        chatId =
            ids.join("_");


        injectChatStyles();
        applyChatSettings();
        addSettingsButton();
        setupMediaMenu();


        try {

            await initializeChat();

            setupMessages();

            setupStatus();

            setupComposer();

            setupMediaControls();

            setupBlockSystem();

            setupCallSystem();

            setupIncomingCalls();

        } catch (error) {

            console.error(
                "Chat initialization error:",
                error
            );

        }


        hideLoader();

    }
);


// ============================================================
// INITIALIZE CHAT
// ============================================================

async function initializeChat() {

    const userRef =
        doc(
            db,
            "users",
            receiverUid
        );


    const snapshot =
        await getDoc(userRef);


    if (snapshot.exists()) {

        receiverData =
            snapshot.data();

    } else {

        receiverData = {};

    }


    if (chatName) {

        chatName.textContent =
            receiverData.fullName ||
            receiverData.username ||
            "VitalStar User";

    }


    if (chatAvatar) {

        chatAvatar.src =
            receiverData.profilePicture ||
            "https://via.placeholder.com/100/001f4d/ffd400?text=VS";

        chatAvatar.onerror =
            () => {

                chatAvatar.src =
                    "https://via.placeholder.com/100/001f4d/ffd400?text=VS";

            };

    }


    if (chatName) {

        chatName.style.cursor =
            "pointer";

        chatName.onclick =
            () => {

                location.href =
                    `profile.html?uid=${encodeURIComponent(
                        receiverUid
                    )}`;

            };

    }


    await setDoc(
        doc(
            db,
            "chats",
            chatId
        ),
        {
            participants: [
                currentUser.uid,
                receiverUid
            ],
            updatedAt:
                serverTimestamp()
        },
        {
            merge: true
        }
    );

}


// ============================================================
// PRESENCE
// ============================================================

function setupStatus() {

    const statusRef =
        ref(
            rtdb,
            `status/${receiverUid}`
        );


    unsubscribeStatus =
        onValue(
            statusRef,
            snapshot => {

                updateChatStatus(
                    snapshot.val()
                );

            }
        );

}


// ============================================================
// MESSAGES
// ============================================================

function setupMessages() {

    if (!messages) {
        return;
    }


    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );


    // NO MESSAGE LIMIT
    const messageQuery =
        query(
            messagesRef,
            orderBy(
                "timestamp",
                "asc"
            )
        );


    unsubscribeMessages =
        onSnapshot(
            messageQuery,
            async snapshot => {

                messages.innerHTML = "";


                if (snapshot.empty) {

                    messages.innerHTML = `

                        <div style="
                            text-align:center;
                            padding:60px 20px;
                            color:#8fa5c0;
                        ">

                            <div style="
                                font-size:42px;
                                margin-bottom:12px;
                            ">
                                💬
                            </div>

                            <div style="
                                font-weight:700;
                            ">
                                Start your conversation
                            </div>

                            <div style="
                                font-size:13px;
                                margin-top:6px;
                            ">
                                Send a message to get started.
                            </div>

                        </div>

                    `;

                    return;

                }


                const updates = [];


                snapshot.docs.forEach(
                    messageDoc => {

                        const data =
                            messageDoc.data();


                        if (
                            data.receiverId ===
                                currentUser.uid &&
                            data.senderId ===
                                receiverUid &&
                            !data.read
                        ) {

                            updates.push(
                                updateDoc(
                                    messageDoc.ref,
                                    {
                                        read: true,
                                        delivered: true
                                    }
                                )
                            );

                        }


                        renderMessage(
                            messageDoc.id,
                            data
                        );

                    }
                );


                if (updates.length) {

                    Promise.all(
                        updates
                    ).catch(
                        console.error
                    );

                }


                requestAnimationFrame(
                    () => {

                        messages.scrollTop =
                            messages.scrollHeight;

                    }
                );

            },
            error => {

                console.error(
                    "Messages error:",
                    error
                );

            }
        );

}


// ============================================================
// RENDER MESSAGE
// ============================================================

function renderMessage(
    messageId,
    data
) {

    const isMine =
        data.senderId ===
        currentUser.uid;


    const wrapper =
        document.createElement("div");


    wrapper.className =
        `message ${
            isMine
                ? "sent"
                : "received"
        }`;


    wrapper.style.cssText = `
        display:flex;
        flex-direction:column;
        align-items:${isMine ? "flex-end" : "flex-start"};
        margin:8px 12px;
    `;


    let content = "";


    if (data.text) {

        content += `
            <div class="message-bubble bubble"
                 style="
                    max-width:78%;
                    padding:10px 13px;
                    border-radius:${
                        isMine
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px"
                    };
                    word-break:break-word;
                 ">
                ${escapeHTML(data.text)}
            </div>
        `;

    }


    if (data.image) {

        content += `
            <img
                src="${escapeHTML(data.image)}"
                alt="Image"
                style="
                    max-width:78%;
                    border-radius:16px;
                    margin-top:5px;
                    cursor:pointer;
                "
                loading="lazy"
            >
        `;

    }


    if (data.video) {

        content += `
            <video
                src="${escapeHTML(data.video)}"
                controls
                playsinline
                style="
                    max-width:82%;
                    border-radius:16px;
                    margin-top:5px;
                "
            ></video>
        `;

    }


    if (data.audio) {

        content += `
            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                    padding:10px 14px;
                    border-radius:18px;
                    background:${
                        isMine
                            ? "var(--sent-bubble)"
                            : "var(--received-bubble)"
                    };
                    color:white;
                    margin-top:5px;
                "
            >

                <button
                    type="button"
                    class="audio-play-btn"
                    data-audio="${escapeHTML(data.audio)}"
                    style="
                        width:38px;
                        height:38px;
                        border-radius:50%;
                        border:none;
                        background:var(--chat-accent);
                        color:#00152f;
                        font-weight:900;
                        cursor:pointer;
                    "
                >
                    ▶
                </button>

                <div style="
                    width:100px;
                    height:4px;
                    background:rgba(255,255,255,.2);
                    border-radius:10px;
                    overflow:hidden;
                ">
                    <div
                        class="audio-progress"
                        style="
                            width:0%;
                            height:100%;
                            background:var(--chat-accent);
                        "
                    ></div>
                </div>

                <span
                    class="audio-duration"
                    style="font-size:11px;"
                >
                    0:00
                </span>

            </div>
        `;

    }


    wrapper.innerHTML =
        content;


    const footer =
        document.createElement("div");


    footer.style.cssText = `
        display:flex;
        align-items:center;
        gap:6px;
        margin-top:3px;
        font-size:10px;
        color:rgba(255,255,255,.5);
    `;


    footer.innerHTML = `
        <span>
            ${formatTime(data.timestamp)}
        </span>

        ${
            isMine
                ? `
                    <span>
                        ${
                            data.read
                                ? "✓✓"
                                : data.delivered
                                    ? "✓✓"
                                    : "✓"
                        }
                    </span>
                `
                : ""
        }
    `;


    wrapper.appendChild(
        footer
    );


    if (isMine) {

        const deleteButton =
            document.createElement(
                "button"
            );

        deleteButton.textContent =
            "Delete";

        deleteButton.style.cssText = `
            border:none;
            background:transparent;
            color:#ff7777;
            font-size:10px;
            cursor:pointer;
            margin-top:2px;
        `;


        deleteButton.onclick =
            async () => {

                if (
                    !confirm(
                        "Delete this message?"
                    )
                ) {
                    return;
                }


                try {

                    await deleteDoc(
                        doc(
                            db,
                            "chats",
                            chatId,
                            "messages",
                            messageId
                        )
                    );

                } catch (error) {

                    console.error(
                        "Delete error:",
                        error
                    );

                }

            };


        wrapper.appendChild(
            deleteButton
        );

    }


    messages.appendChild(
        wrapper
    );


    setupAudioPlayers(
        wrapper
    );

}


// ============================================================
// AUDIO PLAYER
// ============================================================

function setupAudioPlayers(container) {

    const buttons =
        container.querySelectorAll(
            ".audio-play-btn"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const url =
                    button.dataset.audio;


                if (
                    currentAudio &&
                    !currentAudio.paused
                ) {

                    currentAudio.pause();

                }


                const audio =
                    new Audio(url);

                currentAudio =
                    audio;


                const progress =
                    button
                        .parentElement
                        .querySelector(
                            ".audio-progress"
                        );


                const duration =
                    button
                        .parentElement
                        .querySelector(
                            ".audio-duration"
                        );


                button.textContent =
                    "⏸";


                audio.addEventListener(
                    "loadedmetadata",
                    () => {

                        duration.textContent =
                            formatAudioTime(
                                audio.duration
                            );

                    }
                );


                audio.addEventListener(
                    "timeupdate",
                    () => {

                        if (
                            audio.duration
                        ) {

                            progress.style.width =
                                `${
                                    (
                                        audio.currentTime /
                                        audio.duration
                                    ) * 100
                                }%`;

                        }

                    }
                );


                audio.addEventListener(
                    "ended",
                    () => {

                        button.textContent =
                            "▶";

                        progress.style.width =
                            "0%";

                    }
                );


                audio.play()
                    .catch(
                        console.error
                    );

            }
        );

    });

}


// ============================================================
// COMPOSER
// ============================================================

function setupComposer() {

    if (!messageForm) {
        return;
    }


    messageForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const text =
                messageInput?.value
                    ?.trim() || "";


            if (
                !text &&
                !selectedImage &&
                !selectedVideo &&
                !voiceUrl
            ) {

                return;

            }


            const sendButton =
                messageForm.querySelector(
                    "button[type='submit']"
                );


            if (sendButton) {
                sendButton.disabled = true;
            }


            try {

                let imageUrl = null;
                let videoUrl = null;
                let audioUrl =
                    voiceUrl || null;


                if (selectedImage) {

                    imageUrl =
                        await uploadToCloudinary(
                            selectedImage,
                            "image"
                        );

                }


                if (selectedVideo) {

                    videoUrl =
                        await uploadToCloudinary(
                            selectedVideo,
                            "video"
                        );

                }


                const messageRef =
                    collection(
                        db,
                        "chats",
                        chatId,
                        "messages"
                    );


                await addDoc(
                    messageRef,
                    {

                        senderId:
                            currentUser.uid,

                        receiverId:
                            receiverUid,

                        text:
                            text || null,

                        image:
                            imageUrl,

                        video:
                            videoUrl,

                        audio:
                            audioUrl,

                        timestamp:
                            serverTimestamp(),

                        sent:
                            true,

                        delivered:
                            false,

                        read:
                            false

                    }
                );


                await setDoc(
                    doc(
                        db,
                        "chats",
                        chatId
                    ),
                    {

                        participants: [
                            currentUser.uid,
                            receiverUid
                        ],

                        lastMessage:
                            text ||
                            (
                                imageUrl
                                    ? "📷 Image"
                                    : videoUrl
                                        ? "🎬 Video"
                                        : audioUrl
                                            ? "🎙️ Voice note"
                                            : ""
                            ),

                        lastMessageSender:
                            currentUser.uid,

                        updatedAt:
                            serverTimestamp()

                    },
                    {
                        merge: true
                    }
                );


                if (messageInput) {
                    messageInput.value = "";
                }


                selectedImage = null;
                selectedVideo = null;
                voiceUrl = null;


                if (imageInput) {
                    imageInput.value = "";
                }

                if (videoInput) {
                    videoInput.value = "";
                }


            } catch (error) {

                console.error(
                    "Send message error:",
                    error
                );

                alert(
                    "Unable to send message."
                );

            } finally {

                if (sendButton) {
                    sendButton.disabled = false;
                }

            }

        }
    );

}


// ============================================================
// MEDIA CONTROLS
// ============================================================

function setupMediaControls() {

    const imagePicker =
        document.getElementById(
            "openImagePicker"
        );

    const videoPicker =
        document.getElementById(
            "openVideoPicker"
        );

    const voiceButton =
        document.getElementById(
            "openVoiceRecorder"
        );


    imagePicker?.addEventListener(
        "click",
        () => {

            imageInput?.click();

        }
    );


    videoPicker?.addEventListener(
        "click",
        () => {

            videoInput?.click();

        }
    );


    voiceButton?.addEventListener(
        "click",
        async () => {

            if (mediaRecorder) {

                stopVoiceRecording();

            } else {

                await startVoiceRecording();

            }

        }
    );


    recordBtn?.addEventListener(
        "click",
        async () => {

            if (mediaRecorder) {

                stopVoiceRecording();

            } else {

                await startVoiceRecording();

            }

        }
    );

}


// ============================================================
// BLOCK SYSTEM
// ============================================================

async function setupBlockSystem() {

    // Block system remains available
    // without changing the chat UI.

}


// ============================================================
// CALL SYSTEM
// ============================================================

function setupCallSystem() {

    // Existing call buttons can continue
    // using the existing call implementation
    // from your chat HTML if present.

}


// ============================================================
// INCOMING CALLS
// ============================================================

function setupIncomingCalls() {

    const callsRef =
        collection(
            db,
            "calls"
        );


    const callQuery =
        query(
            callsRef,
            where(
                "receiverId",
                "==",
                currentUser.uid
            ),
            where(
                "status",
                "==",
                "ringing"
            )
        );


    unsubscribeIncomingCalls =
        onSnapshot(
            callQuery,
            snapshot => {

                snapshot.docChanges()
                    .forEach(change => {

                        if (
                            change.type !==
                            "added"
                        ) {
                            return;
                        }


                        const data =
                            change.doc.data();


                        if (
                            data.callerId ===
                            currentUser.uid
                        ) {
                            return;
                        }


                        showIncomingCall(
                            change.doc.id,
                            data
                        );

                    });

            },
            error => {

                console.error(
                    "Incoming call listener:",
                    error
                );

            }
        );

}


// ============================================================
// INCOMING CALL UI
// ============================================================

function showIncomingCall(
    callId,
    data
) {

    if (
        document.getElementById(
            "incomingCallModal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement("div");


    modal.id =
        "incomingCallModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:999999;
        background:rgba(0,0,0,.78);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
    `;


    modal.innerHTML = `

        <div style="
            width:min(350px,100%);
            background:#001f4d;
            border:1px solid #ffd400;
            border-radius:24px;
            padding:28px;
            text-align:center;
            box-shadow:
                0 0 35px rgba(255,212,0,.2);
        ">

            <div style="
                font-size:50px;
                margin-bottom:15px;
            ">
                📞
            </div>

            <h3 style="
                margin:0;
                color:#ffffff;
            ">
                Incoming Call
            </h3>

            <p style="
                color:#aebed4;
            ">
                ${escapeHTML(
                    data.callerName ||
                    "VitalStar User"
                )}
            </p>

            <div style="
                display:flex;
                gap:10px;
                margin-top:20px;
            ">

                <button
                    id="declineIncomingCall"
                    style="
                        flex:1;
                        padding:13px;
                        border:none;
                        border-radius:13px;
                        background:#5b1820;
                        color:#ffffff;
                        font-weight:700;
                    "
                >
                    Decline
                </button>

                <button
                    id="acceptIncomingCall"
                    style="
                        flex:1;
                        padding:13px;
                        border:none;
                        border-radius:13px;
                        background:#35c978;
                        color:#00152f;
                        font-weight:800;
                    "
                >
                    Accept
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    document
        .getElementById(
            "declineIncomingCall"
        )
        ?.addEventListener(
            "click",
            async () => {

                try {

                    await updateDoc(
                        doc(
                            db,
                            "calls",
                            callId
                        ),
                        {
                            status:
                                "declined"
                        }
                    );

                } catch (error) {

                    console.error(
                        error
                    );

                }

                modal.remove();

            }
        );


    document
        .getElementById(
            "acceptIncomingCall"
        )
        ?.addEventListener(
            "click",
            async () => {

                modal.remove();

                await updateDoc(
                    doc(
                        db,
                        "calls",
                        callId
                    ),
                    {
                        status:
                            "accepted"
                    }
                );

            }
        );

}


// ============================================================
// FIX COMPOSER POSITION
// ============================================================

function fixComposerPosition() {

    if (!messageForm) {
        return;
    }


    messageForm.style.position =
        "fixed";

    messageForm.style.left =
        "0";

    messageForm.style.right =
        "0";

    messageForm.style.bottom =
        "0";

    messageForm.style.zIndex =
        "5000";


    if (messages) {

        messages.style.paddingBottom =
            "100px";

    }

}


fixComposerPosition();


// ============================================================
// BACK BUTTON
// ============================================================

backBtn?.addEventListener(
    "click",
    () => {

        if (
            history.length > 1
        ) {

            history.back();

        } else {

            location.href =
                "home.html";

        }

    }
);


// ============================================================
// CLEANUP
// ============================================================

function cleanupChat() {

    try {

        unsubscribeMessages?.();
        unsubscribeStatus?.();
        unsubscribeIncomingCalls?.();

    } catch (error) {

        console.error(
            "Cleanup error:",
            error
        );

    }

}


window.addEventListener(
    "beforeunload",
    cleanupChat
);


// ============================================================
// INITIALIZE UI
// ============================================================

injectChatStyles();
applyChatSettings();
createAppearanceSettings();