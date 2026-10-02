// ============================================================
// VITALSTAR — CHAT.JS
// Messages + Media Menu + Voice Notes + Delete + Block/Unblock
// Last Seen + Voice Call + Video Call
// WhatsApp-Style Voice Note Player
// Fixed Composer Above Footer
// Chat Appearance Settings (themes + custom colors, localStorage)
// Firebase JavaScript SDK v10.12.2
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
// HTML ELEMENTS
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
let receiverUid = null;
let chatId = null;
let receiverData = {};

let chatStarted = false;

let unsubscribeMessages = null;
let unsubscribeStatus = null;
let unsubscribeIncomingCalls = null;

let selectedImage = null;
let selectedVideo = null;
let voiceUrl = "";

let recorder = null;
let audioChunks = [];
let isUploadingVoice = false;
let voiceButton = recordBtn;

let activeCall = null;
let activeCallListener = null;
let activeCandidateListener = null;

let lastStatusData = {};
let statusTimer = null;

let stickToBottom = true;
let firstMessageSnapshot = true;
const messageElements = new Map();

let currentPreviewUrl = "";
let composerFixed = false;
let mediaMenuReady = false;

const params = new URLSearchParams(
    window.location.search
);

receiverUid = params.get("uid");

// ============================================================
// APPEARANCE — THEMES AND DEFAULTS
// ============================================================

const APPEARANCE_STORAGE_KEY = "vitalstar_chat_appearance_v1";
const DEFAULT_THEME_KEY = "navy";

const THEMES = {
    navy: {
        label: "VitalStar Navy",
        background: "#00152f",
        sent: "#0757a8",
        received: "#102746",
        header: "#001f4d",
        accent: "#ffd400"
    },
    midnight: {
        label: "Midnight",
        background: "#070a1f",
        sent: "#4338ca",
        received: "#161b3d",
        header: "#0b1030",
        accent: "#ffd400"
    },
    ocean: {
        label: "Ocean",
        background: "#032b3a",
        sent: "#0e7490",
        received: "#0d3d52",
        header: "#04384b",
        accent: "#ffd400"
    },
    purple: {
        label: "Purple",
        background: "#1a0b36",
        sent: "#7c3aed",
        received: "#2b1858",
        header: "#26104d",
        accent: "#ffd400"
    },
    black: {
        label: "Black",
        background: "#000000",
        sent: "#1d4ed8",
        received: "#1c1c1c",
        header: "#0b0b0b",
        accent: "#ffd400"
    }
};

let appearance = defaultAppearance(DEFAULT_THEME_KEY);

// ============================================================
// CHAT STYLE
// ============================================================

const chatStyle = document.createElement("style");

chatStyle.textContent = `

/* ============================================================
   THEME VARIABLES (JavaScript updates these instantly)
============================================================ */

:root {
    --vs-bg:#00152f;
    --vs-sent:#0757a8;
    --vs-received:#102746;
    --vs-header:#001f4d;
    --vs-accent:#ffd400;
    --vs-accent-rgb:255,212,0;
    --vs-lime:#bfff00;

    --vs-sent-glow:rgba(7,87,168,.35);

    --vs-sent-text:#f5f8ff;
    --vs-sent-meta:rgba(245,248,255,.72);
    --vs-sent-soft:rgba(255,255,255,.16);
    --vs-sent-danger:#ff9b9b;

    --vs-received-text:#f5f8ff;
    --vs-received-meta:rgba(245,248,255,.72);
    --vs-received-soft:rgba(255,255,255,.14);
    --vs-received-danger:#ff9b9b;
}

@keyframes vitalStarSpin {
    to {
        transform:rotate(360deg);
    }
}

@keyframes vitalStarPulse {
    0%, 100% {
        box-shadow:0 0 6px 1px rgba(191,255,0,.55);
    }
    50% {
        box-shadow:0 0 12px 3px rgba(191,255,0,.95);
    }
}

/* ============================================================
   PAGE BACKGROUND
============================================================ */

html.vs-chat-page,
body.vs-chat-page {
    background:var(--vs-bg) !important;
}

/* ============================================================
   LOADER
============================================================ */

#vitalStarChatLoader {
    position:fixed;
    inset:0;

    background:radial-gradient(
        circle at 50% 38%,
        #00265a 0%,
        #00152f 55%,
        #000b1a 100%
    );

    display:flex;
    align-items:center;
    justify-content:center;

    z-index:2147483647;

    font-family:Arial,sans-serif;
    color:#fff;
}

.vs-loader-box {
    text-align:center;
}

.vs-loader-badge {
    position:relative;

    width:86px;
    height:86px;

    margin:0 auto;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:24px;
    font-weight:900;
    letter-spacing:1px;

    color:#ffd400;
    text-shadow:0 0 12px rgba(255,212,0,.55);
}

.vs-loader-badge::before {
    content:"";

    position:absolute;
    inset:0;

    border-radius:50%;

    border:4px solid rgba(255,255,255,.08);
    border-top-color:#ffd400;
    border-right-color:#bfff00;

    box-shadow:
        0 0 22px rgba(191,255,0,.45),
        inset 0 0 14px rgba(191,255,0,.18);

    animation:vitalStarSpin .9s linear infinite;
}

.vs-loader-text {
    margin-top:18px;

    font-size:14px;
    letter-spacing:.3px;

    color:rgba(255,255,255,.82);
}

/* ============================================================
   HEADER
============================================================ */

.vs-chat-header {
    background:var(--vs-header) !important;
    color:#fff !important;

    border-bottom:1px solid rgba(var(--vs-accent-rgb),.28) !important;

    box-shadow:0 4px 18px rgba(0,0,0,.35) !important;

    padding-right:150px !important;
}

#backBtn {
    color:var(--vs-accent) !important;
}

#chatName {
    color:#fff !important;
    font-weight:800;

    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
}

#chatAvatar {
    object-fit:cover;

    border:2px solid var(--vs-accent);

    box-shadow:0 0 10px rgba(var(--vs-accent-rgb),.35);
}

#chatStatus {
    color:var(--vs-lime) !important;
    font-size:12px;
}

#chatStatus.is-online {
    font-weight:800;
    text-shadow:0 0 8px rgba(191,255,0,.7);
}

.vs-online-dot {
    display:inline-block;

    width:8px;
    height:8px;

    margin-right:6px;

    border-radius:50%;

    background:#bfff00;

    animation:vitalStarPulse 1.8s ease-in-out infinite;
}

/* ============================================================
   HEADER BUTTONS
============================================================ */

#vsHeaderActions {
    position:absolute;

    right:8px;
    top:50%;

    transform:translateY(-50%);

    display:flex;
    align-items:center;
    gap:5px;

    z-index:100;
}

#vsCallControls {
    order:1;

    display:flex;
    align-items:center;
    gap:5px;
}

#vsBlockUserBtn {
    order:2;
}

#vsSettingsBtn {
    order:3;
}

.vs-header-btn,
.vs-call-btn {
    width:34px;
    height:34px;

    flex:0 0 34px;

    padding:0;

    border:1px solid rgba(var(--vs-accent-rgb),.30);
    border-radius:50%;

    background:rgba(var(--vs-accent-rgb),.10);

    color:#fff;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:16px;
    line-height:1;

    cursor:pointer;

    transition:
        transform .15s ease,
        background .2s ease;
}

.vs-header-btn:active,
.vs-call-btn:active {
    transform:scale(.92);
}

.vs-block-btn {
    background:rgba(239,68,68,.16);
    border-color:rgba(239,68,68,.42);
}

.vs-block-btn.is-blocked {
    background:rgba(34,197,94,.20);
    border-color:rgba(34,197,94,.50);
}

/* ============================================================
   MESSAGE AREA
============================================================ */

#messages {
    background:var(--vs-bg) !important;

    padding-top:12px !important;
    padding-left:10px !important;
    padding-right:10px !important;
    padding-bottom:170px !important;

    scroll-padding-bottom:190px !important;

    transition:background .25s ease;
}

/* ============================================================
   MESSAGE BUBBLES
============================================================ */

#messages .message {
    position:relative;

    width:fit-content;
    max-width:min(82%,420px);

    box-sizing:border-box;

    margin-top:3px !important;
    margin-bottom:3px !important;

    padding:8px 11px 6px !important;

    font-size:15px;
    line-height:1.4;

    word-break:break-word;
    overflow-wrap:anywhere;

    border:1px solid rgba(255,255,255,.06) !important;
}

#messages .message.sent {
    margin-left:auto !important;
    margin-right:0 !important;

    background:var(--vs-sent) !important;
    color:var(--vs-sent-text) !important;

    border-radius:18px 18px 4px 18px !important;

    box-shadow:
        0 2px 10px rgba(0,0,0,.28),
        0 0 14px var(--vs-sent-glow) !important;
}

#messages .message.received {
    margin-right:auto !important;
    margin-left:0 !important;

    background:var(--vs-received) !important;
    color:var(--vs-received-text) !important;

    border-radius:18px 18px 18px 4px !important;

    box-shadow:0 2px 10px rgba(0,0,0,.28) !important;
}

#messages .message p {
    margin:0 !important;

    color:inherit !important;

    white-space:pre-wrap;
}

#messages .message img,
#messages .message video {
    max-width:100%;
}

.message-footer {
    display:flex;
    align-items:center;
    justify-content:flex-end;

    gap:6px;

    margin-top:3px;

    font-size:11px;
}

#messages .message.sent .message-footer,
#messages .message.sent .message-footer span {
    color:var(--vs-sent-meta) !important;
}

#messages .message.received .message-footer,
#messages .message.received .message-footer span {
    color:var(--vs-received-meta) !important;
}

.message-footer .vs-read {
    font-weight:700;
}

/* ============================================================
   DELETE
============================================================ */

.vs-delete-message {
    border:none;

    padding:1px 8px;

    border-radius:999px;

    background:rgba(239,68,68,.18);

    font-size:10px;
    font-weight:700;

    cursor:pointer;
}

#messages .message.sent .vs-delete-message {
    color:var(--vs-sent-danger) !important;
}

#messages .message.received .vs-delete-message {
    color:var(--vs-received-danger) !important;
}

/* ============================================================
   COMPOSER
============================================================ */

#messageForm {
    position:fixed !important;
    left:0 !important;
    right:0 !important;
    bottom:0 !important;

    width:100% !important;
    max-width:none !important;

    min-height:62px !important;

    margin:0 !important;
    padding:8px 10px !important;

    box-sizing:border-box !important;

    display:flex !important;
    align-items:center !important;

    gap:8px !important;

    visibility:visible !important;
    opacity:1 !important;

    overflow:visible !important;

    background:var(--vs-header) !important;

    backdrop-filter:blur(18px);
    -webkit-backdrop-filter:blur(18px);

    border:0 !important;
    border-top:2px solid rgba(var(--vs-accent-rgb),.70) !important;
    border-radius:18px 18px 0 0 !important;

    box-shadow:
        0 -4px 18px rgba(var(--vs-accent-rgb),.20),
        0 -8px 30px rgba(0,0,0,.35);

    z-index:2147483000 !important;

    isolation:isolate;
}

#messageForm * {
    box-sizing:border-box;
}

#messageForm input[type="text"],
#messageForm input:not([type]),
#messageForm textarea {
    flex:1 1 auto !important;
    min-width:0 !important;
    min-height:42px;

    padding:10px 16px !important;

    border:1px solid rgba(255,255,255,.14) !important;
    border-radius:22px !important;

    background:rgba(255,255,255,.08) !important;

    color:#fff !important;

    font-size:15px;

    outline:none !important;
}

#messageForm input[type="text"]:focus,
#messageForm input:not([type]):focus,
#messageForm textarea:focus {
    border-color:var(--vs-accent) !important;
}

#messageForm input::placeholder,
#messageForm textarea::placeholder {
    color:rgba(255,255,255,.5);
}

#messageForm button[type="submit"] {
    flex:0 0 auto;

    min-height:42px;

    padding:0 16px !important;

    border:none !important;
    border-radius:21px !important;

    background:var(--vs-accent) !important;
    color:#111 !important;

    font-weight:800;

    cursor:pointer;

    box-shadow:0 0 14px rgba(var(--vs-accent-rgb),.35);
}

#messageForm button[type="submit"]:disabled {
    opacity:.6;
}

/* ============================================================
   MEDIA MENU
============================================================ */

.vs-media-wrapper {
    position:relative;
    flex:0 0 auto;
    z-index:2147483001;
}

.vs-media-toggle {
    width:42px;
    height:42px;

    border:1px solid rgba(var(--vs-accent-rgb),.40);
    border-radius:50%;

    background:rgba(var(--vs-accent-rgb),.14);

    color:var(--vs-accent);

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:24px;
    font-weight:900;

    cursor:pointer;

    transition:
        transform .18s ease,
        background .18s ease;
}

.vs-media-toggle.open {
    background:rgba(var(--vs-accent-rgb),.28);
    transform:rotate(45deg);
}

.vs-media-menu {
    position:absolute;

    left:0;
    bottom:52px;

    width:175px;

    padding:8px;

    border-radius:16px;

    background:var(--vs-header);

    border:1px solid rgba(var(--vs-accent-rgb),.28);

    box-shadow:0 15px 45px rgba(0,0,0,.55);

    display:none;

    flex-direction:column;
    gap:5px;

    z-index:2147483002;
}

.vs-media-menu.open {
    display:flex;
}

.vs-media-menu button {
    width:100% !important;

    min-height:42px !important;

    border:none !important;

    border-radius:11px !important;

    background:rgba(255,255,255,.07) !important;

    color:#fff !important;

    text-align:left !important;

    padding:9px 12px !important;

    cursor:pointer;

    font-size:14px;

    display:flex !important;

    align-items:center;

    gap:8px;

    margin:0 !important;
}

.vs-media-menu button:active {
    background:rgba(var(--vs-accent-rgb),.22) !important;
}

/* ============================================================
   PREVIEW
============================================================ */

#chatMediaPreview {
    position:fixed !important;

    left:10px !important;
    right:10px !important;

    bottom:65px !important;

    padding:8px !important;

    border-radius:12px;

    background:var(--vs-header) !important;

    border:1px solid rgba(var(--vs-accent-rgb),.28);

    color:#ddd !important;

    z-index:2147482999;

    box-sizing:border-box !important;
}

/* ============================================================
   SENDING STATUS
============================================================ */

#messageSendingStatus {
    position:fixed !important;

    left:0 !important;
    right:0 !important;

    bottom:62px !important;

    z-index:2147482998;

    background:rgba(0,21,47,.95);

    color:var(--vs-accent) !important;
}

/* ============================================================
   WHATSAPP-STYLE VOICE PLAYER
============================================================ */

.vs-audio-player {
    width:250px;
    max-width:100%;

    min-height:58px;

    display:flex;
    align-items:center;

    gap:9px;

    padding:7px 9px;

    border-radius:18px;

    border:1px solid rgba(255,255,255,.10);

    user-select:none;
}

.message.sent .vs-audio-player {
    background:var(--vs-sent-soft);
    color:var(--vs-sent-text);
}

.message.received .vs-audio-player {
    background:var(--vs-received-soft);
    color:var(--vs-received-text);
}

.vs-audio-play {
    width:38px;
    height:38px;

    flex:0 0 38px;

    border:none;
    border-radius:50%;

    background:var(--vs-accent);
    color:#111;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:16px;
    line-height:1;

    cursor:pointer;

    box-shadow:
        0 0 0 2px rgba(0,0,0,.18),
        0 4px 12px rgba(0,0,0,.25);

    transition:
        transform .15s ease,
        filter .15s ease;
}

.vs-audio-play:active {
    transform:scale(.92);
}

.vs-audio-main {
    min-width:0;
    flex:1;

    display:flex;
    flex-direction:column;

    gap:4px;
}

.vs-audio-track {
    width:100%;
    height:5px;

    border-radius:999px;

    background:rgba(128,128,128,.40);

    cursor:pointer;

    overflow:hidden;

    position:relative;
}

.vs-audio-progress {
    position:absolute;

    left:0;
    top:0;
    bottom:0;

    width:0%;

    border-radius:999px;

    background:currentColor;

    pointer-events:none;

    transition:width .05s linear;
}

.vs-audio-bottom {
    display:flex;
    align-items:center;
    justify-content:space-between;

    gap:8px;

    font-size:10px;
}

.message.sent .vs-audio-bottom {
    color:var(--vs-sent-meta);
}

.message.received .vs-audio-bottom {
    color:var(--vs-received-meta);
}

.vs-audio-time {
    white-space:nowrap;
}

.vs-audio-bars {
    display:flex;
    align-items:center;
    gap:2px;

    height:15px;

    opacity:.55;
}

.vs-audio-bars span {
    width:2px;
    border-radius:2px;
    background:currentColor;
}

.vs-audio-bars span:nth-child(1) { height:5px; }
.vs-audio-bars span:nth-child(2) { height:9px; }
.vs-audio-bars span:nth-child(3) { height:13px; }
.vs-audio-bars span:nth-child(4) { height:8px; }
.vs-audio-bars span:nth-child(5) { height:15px; }
.vs-audio-bars span:nth-child(6) { height:10px; }
.vs-audio-bars span:nth-child(7) { height:6px; }
.vs-audio-bars span:nth-child(8) { height:12px; }
.vs-audio-bars span:nth-child(9) { height:8px; }
.vs-audio-bars span:nth-child(10) { height:14px; }
.vs-audio-bars span:nth-child(11) { height:7px; }
.vs-audio-bars span:nth-child(12) { height:11px; }

.vs-audio-player.playing
.vs-audio-bars span {
    animation:vsAudioBars .75s ease-in-out infinite alternate;
}

.vs-audio-player.playing
.vs-audio-bars span:nth-child(2) { animation-delay:.08s; }

.vs-audio-player.playing
.vs-audio-bars span:nth-child(3) { animation-delay:.16s; }

.vs-audio-player.playing
.vs-audio-bars span:nth-child(4) { animation-delay:.24s; }

.vs-audio-player.playing
.vs-audio-bars span:nth-child(5) { animation-delay:.32s; }

.vs-audio-player.playing
.vs-audio-bars span:nth-child(6) { animation-delay:.40s; }

@keyframes vsAudioBars {
    from {
        transform:scaleY(.55);
        opacity:.45;
    }

    to {
        transform:scaleY(1);
        opacity:1;
    }
}

.vs-hidden-audio {
    display:none !important;
}

/* ============================================================
   CALL SCREEN
============================================================ */

.vs-call-overlay {
    position:fixed;
    inset:0;

    background:linear-gradient(180deg,#001f4d 0%,#00152f 55%,#000b1a 100%);

    z-index:2147483640;

    display:none;

    flex-direction:column;

    color:#fff;

    font-family:Arial,sans-serif;
}

.vs-call-top {
    padding:15px;

    min-height:60px;

    display:flex;

    justify-content:space-between;

    align-items:center;
}

.vs-call-media {
    flex:1;

    min-height:0;

    position:relative;

    display:flex;

    align-items:center;

    justify-content:center;

    overflow:hidden;
}

.vs-remote-video {
    width:100%;
    height:100%;

    object-fit:contain;

    background:#000;
}

.vs-local-video {
    position:absolute;

    right:14px;
    bottom:14px;

    width:110px;
    height:155px;

    object-fit:cover;

    border-radius:14px;

    border:2px solid rgba(var(--vs-accent-rgb),.6);

    background:#111;
}

.vs-call-avatar {
    width:110px;
    height:110px;

    border-radius:50%;

    display:flex;

    align-items:center;

    justify-content:center;

    background:linear-gradient(
        135deg,
        #0757a8,
        #001f4d
    );

    border:3px solid var(--vs-accent);

    box-shadow:0 0 28px rgba(var(--vs-accent-rgb),.35);

    color:var(--vs-accent);

    font-size:42px;

    font-weight:900;
}

.vs-call-bottom {
    padding:20px;

    display:flex;

    justify-content:center;
}

.vs-end-call {
    width:62px;
    height:62px;

    border:none;

    border-radius:50%;

    background:#dc2626;

    color:#fff;

    font-size:24px;

    cursor:pointer;

    box-shadow:0 0 22px rgba(220,38,38,.5);
}

/* ============================================================
   INCOMING CALL
============================================================ */

.vs-incoming-call {
    position:fixed;

    left:50%;

    top:50%;

    transform:translate(-50%,-50%);

    width:min(90vw,360px);

    padding:25px;

    border-radius:22px;

    background:#001f4d;

    border:1px solid rgba(var(--vs-accent-rgb),.40);

    box-shadow:
        0 20px 70px rgba(0,0,0,.6),
        0 0 30px rgba(var(--vs-accent-rgb),.15);

    text-align:center;

    color:#fff;

    z-index:2147483641;
}

.vs-incoming-actions {
    display:flex;

    gap:12px;

    margin-top:20px;
}

.vs-incoming-actions button {
    flex:1;

    border:none;

    border-radius:12px;

    padding:13px;

    color:#fff;

    font-weight:800;
}

.vs-decline {
    background:#dc2626;
}

.vs-accept {
    background:#16a34a;
}

/* ============================================================
   SETTINGS PANEL — CHAT APPEARANCE
============================================================ */

.vs-settings-overlay {
    position:fixed;
    inset:0;

    z-index:2147483300;

    background:rgba(0,6,18,.62);

    backdrop-filter:blur(3px);
    -webkit-backdrop-filter:blur(3px);

    opacity:0;
    visibility:hidden;

    transition:
        opacity .25s ease,
        visibility .25s ease;
}

.vs-settings-overlay.open {
    opacity:1;
    visibility:visible;
}

.vs-settings-panel {
    position:absolute;

    top:0;
    right:0;
    bottom:0;

    width:min(88vw,350px);

    display:flex;
    flex-direction:column;

    background:linear-gradient(180deg,#00204f 0%,#001533 100%);

    border-left:2px solid #ffd400;

    box-shadow:-12px 0 40px rgba(0,0,0,.55);

    color:#fff;

    font-family:Arial,sans-serif;

    transform:translateX(105%);

    transition:transform .3s cubic-bezier(.22,.8,.3,1);
}

.vs-settings-overlay.open .vs-settings-panel {
    transform:translateX(0);
}

.vs-settings-head {
    display:flex;
    align-items:center;
    justify-content:space-between;

    gap:10px;

    padding:16px 16px 12px;

    border-bottom:1px solid rgba(255,212,0,.25);
}

.vs-settings-title {
    font-size:18px;
    font-weight:800;

    color:#ffd400;
}

.vs-settings-sub {
    margin-top:2px;

    font-size:12px;

    color:rgba(255,255,255,.6);
}

.vs-settings-close {
    width:36px;
    height:36px;

    flex:0 0 36px;

    border:1px solid rgba(255,212,0,.35);
    border-radius:50%;

    background:rgba(255,212,0,.10);

    color:#ffd400;

    font-size:16px;

    cursor:pointer;
}

.vs-settings-body {
    flex:1;

    overflow-y:auto;
    -webkit-overflow-scrolling:touch;

    padding:14px 16px calc(24px + env(safe-area-inset-bottom));
}

.vs-settings-label {
    margin:16px 0 8px;

    font-size:13px;
    font-weight:700;

    color:#ffd400;
}

.vs-settings-label:first-child {
    margin-top:0;
}

.vs-theme-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
}

.vs-theme-card {
    padding:6px;

    border:2px solid transparent;
    border-radius:14px;

    background:rgba(255,255,255,.05);

    color:#fff;

    cursor:pointer;

    display:flex;
    flex-direction:column;

    gap:6px;

    text-align:center;

    transition:
        border-color .2s ease,
        box-shadow .2s ease;
}

.vs-theme-card.active {
    border-color:#ffd400;

    box-shadow:0 0 14px rgba(255,212,0,.35);
}

.vs-theme-preview {
    position:relative;

    display:block;

    height:66px;

    border-radius:9px;

    overflow:hidden;

    border:1px solid rgba(255,255,255,.10);
}

.vs-theme-bar {
    position:absolute;

    left:0;
    right:0;
    top:0;

    height:13px;
}

.vs-theme-dot {
    position:absolute;

    right:6px;
    top:4px;

    width:5px;
    height:5px;

    border-radius:50%;

    background:#ffd400;
}

.vs-theme-bubble {
    position:absolute;

    height:12px;

    border-radius:7px;
}

.vs-theme-bubble.recv {
    left:7px;
    top:21px;

    width:52%;
}

.vs-theme-bubble.sent {
    right:7px;
    top:39px;

    width:46%;
}

.vs-theme-name {
    font-size:12px;
    font-weight:700;
}

.vs-color-row {
    display:flex;
    align-items:center;
    justify-content:space-between;

    gap:10px;

    padding:10px 12px;

    margin-bottom:8px;

    border-radius:12px;

    background:rgba(255,255,255,.05);

    border:1px solid rgba(255,255,255,.08);

    font-size:14px;
}

.vs-color-pick {
    display:flex;
    align-items:center;

    gap:10px;
}

.vs-color-pick code {
    font-size:12px;

    color:rgba(255,255,255,.7);
}

.vs-color-pick input[type="color"] {
    width:44px;
    height:34px;

    padding:0;

    border:2px solid rgba(255,255,255,.25);
    border-radius:10px;

    background:none;

    cursor:pointer;
}

.vs-live-preview {
    padding:12px;

    border-radius:14px;

    background:var(--vs-bg);

    border:1px solid rgba(255,255,255,.10);

    display:flex;
    flex-direction:column;

    gap:8px;
}

.vs-live-bubble {
    max-width:85%;

    padding:8px 12px;

    font-size:13px;
    line-height:1.35;
}

.vs-live-bubble.received {
    align-self:flex-start;

    background:var(--vs-received);
    color:var(--vs-received-text);

    border-radius:16px 16px 16px 4px;
}

.vs-live-bubble.sent {
    align-self:flex-end;

    background:var(--vs-sent);
    color:var(--vs-sent-text);

    border-radius:16px 16px 4px 16px;
}

.vs-reset-btn {
    width:100%;

    margin-top:18px;
    padding:13px;

    border:1px solid #ffd400;
    border-radius:12px;

    background:rgba(255,212,0,.12);

    color:#ffd400;

    font-size:14px;
    font-weight:800;

    cursor:pointer;
}

.vs-reset-btn:active {
    background:rgba(255,212,0,.28);
}

/* ============================================================
   MOBILE
============================================================ */

@media(max-width:600px) {

    #messageForm {
        padding:
            7px
            max(7px, env(safe-area-inset-right))
            calc(7px + env(safe-area-inset-bottom))
            max(7px, env(safe-area-inset-left))
            !important;
    }

    .vs-media-toggle {
        width:40px;
        height:40px;
    }

    .vs-media-menu {
        width:165px;
    }

    #vsHeaderActions {
        right:6px;
        gap:4px;
    }

    #vsCallControls {
        gap:4px;
    }

    .vs-header-btn,
    .vs-call-btn {
        width:32px;
        height:32px;

        flex-basis:32px;

        font-size:14px;
    }

    .vs-chat-header {
        padding-right:146px !important;
    }

    .vs-local-video {
        width:95px;
        height:135px;
    }

    .vs-audio-player {
        width:235px;
    }

    .vs-audio-play {
        width:36px;
        height:36px;
        flex-basis:36px;
    }
}

@media(max-width:360px) {

    .vs-header-btn,
    .vs-call-btn {
        width:30px;
        height:30px;

        flex-basis:30px;
    }

    .vs-chat-header {
        padding-right:134px !important;
    }
}
`;

document.head.appendChild(chatStyle);

// ============================================================
// LOADER
// ============================================================

const loader = document.createElement("div");

loader.id = "vitalStarChatLoader";

loader.innerHTML = `
    <div class="vs-loader-box">
        <div class="vs-loader-badge">VS</div>
        <div class="vs-loader-text">Loading chat...</div>
    </div>
`;

document.body.appendChild(loader);

function hideLoader() {

    loader.style.opacity = "0";
    loader.style.transition = "opacity .25s ease";

    setTimeout(() => {
        loader.remove();
    }, 300);
}

// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value = "") {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function randomId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return Date.now() + "_" +
        Math.random().toString(36).slice(2);
}

function formatTime(timestamp) {

    if (!timestamp) return "";

    const date =
        timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatAudioTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "0:00";
    }

    seconds = Math.floor(seconds);

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function scrollMessagesToBottom() {

    if (!messages) return;

    messages.scrollTop = messages.scrollHeight;
}

function isNearBottom() {

    if (!messages) return true;

    return (
        messages.scrollHeight -
        messages.scrollTop -
        messages.clientHeight
    ) < 160;
}

messages?.addEventListener(
    "scroll",
    () => {
        stickToBottom = isNearBottom();
    },
    { passive: true }
);

// ============================================================
// HEADER HELPERS
// ============================================================

function getChatHeader() {

    return (
        chatName?.closest("header") ||
        chatName?.parentElement?.parentElement ||
        chatName?.parentElement ||
        null
    );
}

// One container holds call, block and settings buttons together
// so they never overlap each other on small phones.
function getHeaderActions() {

    const header = getChatHeader();

    if (!header) return null;

    let actions = document.getElementById("vsHeaderActions");

    if (!actions) {

        header.classList.add("vs-chat-header");

        if (getComputedStyle(header).position === "static") {
            header.style.position = "relative";
        }

        actions = document.createElement("div");
        actions.id = "vsHeaderActions";

        header.appendChild(actions);
    }

    return actions;
}

// ============================================================
// APPEARANCE — COLOR HELPERS
// ============================================================

function isHexColor(value) {

    return (
        typeof value === "string" &&
        /^#[0-9a-f]{6}$/i.test(value)
    );
}

function hexToRgb(hex) {

    const match = /^#([0-9a-f]{6})$/i.exec(hex || "");

    if (!match) return null;

    const n = parseInt(match[1], 16);

    return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255
    };
}

function relativeLuminance(rgb) {

    const channels = [rgb.r, rgb.g, rgb.b].map(value => {

        const v = value / 255;

        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return (
        0.2126 * channels[0] +
        0.7152 * channels[1] +
        0.0722 * channels[2]
    );
}

function contrastRatio(l1, l2) {

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

// Returns true when WHITE text is easier to read on this color.
function lightTextIsReadable(hex) {

    const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };

    const luminance = relativeLuminance(rgb);

    const whiteContrast = contrastRatio(1, luminance);
    const darkContrast = contrastRatio(luminance, 0.006);

    return whiteContrast >= darkContrast;
}

// ============================================================
// APPEARANCE — LOAD / SAVE / APPLY
// ============================================================

function defaultAppearance(themeKey) {

    const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME_KEY];

    return {
        theme: THEMES[themeKey] ? themeKey : DEFAULT_THEME_KEY,
        sent: theme.sent,
        received: theme.received,
        background: theme.background
    };
}

function loadAppearance() {

    try {

        const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);

        if (raw) {

            const saved = JSON.parse(raw);

            const key = THEMES[saved.theme]
                ? saved.theme
                : DEFAULT_THEME_KEY;

            const base = defaultAppearance(key);

            return {
                theme: key,
                sent: isHexColor(saved.sent)
                    ? saved.sent.toLowerCase()
                    : base.sent,
                received: isHexColor(saved.received)
                    ? saved.received.toLowerCase()
                    : base.received,
                background: isHexColor(saved.background)
                    ? saved.background.toLowerCase()
                    : base.background
            };
        }

    } catch (error) {

        console.warn("Appearance load:", error);
    }

    return defaultAppearance(DEFAULT_THEME_KEY);
}

function saveAppearance() {

    try {

        localStorage.setItem(
            APPEARANCE_STORAGE_KEY,
            JSON.stringify(appearance)
        );

    } catch (error) {

        console.warn("Appearance save:", error);
    }
}

function applyBubbleVariables(name, hex) {

    const root = document.documentElement;

    const light = lightTextIsReadable(hex);

    root.style.setProperty(
        `--vs-${name}-text`,
        light ? "#f5f8ff" : "#0b1220"
    );

    root.style.setProperty(
        `--vs-${name}-meta`,
        light
            ? "rgba(245,248,255,.72)"
            : "rgba(11,18,32,.68)"
    );

    root.style.setProperty(
        `--vs-${name}-soft`,
        light
            ? "rgba(255,255,255,.16)"
            : "rgba(0,0,0,.12)"
    );

    root.style.setProperty(
        `--vs-${name}-danger`,
        light ? "#ff9b9b" : "#b91c1c"
    );
}

function applyAppearance() {

    const theme =
        THEMES[appearance.theme] ||
        THEMES[DEFAULT_THEME_KEY];

    const root = document.documentElement;

    root.style.setProperty("--vs-bg", appearance.background);
    root.style.setProperty("--vs-sent", appearance.sent);
    root.style.setProperty("--vs-received", appearance.received);
    root.style.setProperty("--vs-header", theme.header);
    root.style.setProperty("--vs-accent", theme.accent);

    const accent = hexToRgb(theme.accent) || { r: 255, g: 212, b: 0 };

    root.style.setProperty(
        "--vs-accent-rgb",
        `${accent.r},${accent.g},${accent.b}`
    );

    const sentRgb = hexToRgb(appearance.sent) || { r: 7, g: 87, b: 168 };

    root.style.setProperty(
        "--vs-sent-glow",
        `rgba(${sentRgb.r},${sentRgb.g},${sentRgb.b},.35)`
    );

    applyBubbleVariables("sent", appearance.sent);
    applyBubbleVariables("received", appearance.received);

    // Android browser bar color
    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {

        meta = document.createElement("meta");
        meta.name = "theme-color";

        document.head.appendChild(meta);
    }

    meta.content = theme.header;
}

function themeMatchesAppearance(key) {

    const theme = THEMES[key];

    return (
        theme.sent.toLowerCase() === appearance.sent &&
        theme.received.toLowerCase() === appearance.received &&
        theme.background.toLowerCase() === appearance.background
    );
}

// ============================================================
// APPEARANCE — SETTINGS PANEL
// ============================================================

let settingsOverlay = null;

function syncSettingsControls() {

    if (!settingsOverlay) return;

    const fields = [
        ["vsSentColor", "vsSentHex", appearance.sent],
        ["vsReceivedColor", "vsReceivedHex", appearance.received],
        ["vsBackgroundColor", "vsBackgroundHex", appearance.background]
    ];

    fields.forEach(([inputId, hexId, value]) => {

        const input = settingsOverlay.querySelector(`#${inputId}`);
        const hex = settingsOverlay.querySelector(`#${hexId}`);

        if (input && input.value !== value) {
            input.value = value;
        }

        if (hex) {
            hex.textContent = value;
        }
    });

    settingsOverlay
        .querySelectorAll(".vs-theme-card")
        .forEach(card => {

            card.classList.toggle(
                "active",
                themeMatchesAppearance(card.dataset.theme)
            );
        });
}

function selectTheme(key) {

    appearance = defaultAppearance(key);

    applyAppearance();
    saveAppearance();
    syncSettingsControls();
}

function updateCustomColor(field, value) {

    if (!isHexColor(value)) return;

    appearance[field] = value.toLowerCase();

    applyAppearance();
    saveAppearance();
    syncSettingsControls();
}

function resetAppearance() {

    appearance = defaultAppearance(DEFAULT_THEME_KEY);

    try {
        localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    } catch (error) {
        console.warn("Appearance reset:", error);
    }

    applyAppearance();
    syncSettingsControls();
}

function openSettingsPanel() {

    if (!settingsOverlay) return;

    syncSettingsControls();

    settingsOverlay.classList.add("open");
}

function closeSettingsPanel() {

    settingsOverlay?.classList.remove("open");
}

function toggleSettingsPanel() {

    if (settingsOverlay?.classList.contains("open")) {
        closeSettingsPanel();
    } else {
        openSettingsPanel();
    }
}

function createSettingsPanel() {

    if (document.getElementById("vsSettingsOverlay")) {
        return;
    }

    const overlay = document.createElement("div");

    overlay.id = "vsSettingsOverlay";
    overlay.className = "vs-settings-overlay";

    overlay.innerHTML = `
        <div
            class="vs-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Chat Appearance"
        >

            <div class="vs-settings-head">

                <div>
                    <div class="vs-settings-title">⚙️ Chat Appearance</div>
                    <div class="vs-settings-sub">Changes apply instantly</div>
                </div>

                <button
                    type="button"
                    id="vsSettingsClose"
                    class="vs-settings-close"
                    aria-label="Close settings"
                >
                    ✕
                </button>

            </div>

            <div class="vs-settings-body">

                <div class="vs-settings-label">Chat theme</div>

                <div class="vs-theme-grid" id="vsThemeGrid"></div>

                <div class="vs-settings-label">Sent message bubble</div>

                <div class="vs-color-row">
                    <span>Your messages</span>
                    <span class="vs-color-pick">
                        <code id="vsSentHex"></code>
                        <input type="color" id="vsSentColor">
                    </span>
                </div>

                <div class="vs-settings-label">Received message bubble</div>

                <div class="vs-color-row">
                    <span>Their messages</span>
                    <span class="vs-color-pick">
                        <code id="vsReceivedHex"></code>
                        <input type="color" id="vsReceivedColor">
                    </span>
                </div>

                <div class="vs-settings-label">Chat background</div>

                <div class="vs-color-row">
                    <span>Message area</span>
                    <span class="vs-color-pick">
                        <code id="vsBackgroundHex"></code>
                        <input type="color" id="vsBackgroundColor">
                    </span>
                </div>

                <div class="vs-settings-label">Preview</div>

                <div class="vs-live-preview">
                    <div class="vs-live-bubble received">Hey! How are you? 👋</div>
                    <div class="vs-live-bubble sent">All good, VitalStar looks great ✨</div>
                </div>

                <button
                    type="button"
                    id="vsResetAppearance"
                    class="vs-reset-btn"
                >
                    Reset to VitalStar Default
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    settingsOverlay = overlay;

    // ---------- Theme preview cards ----------

    const grid = overlay.querySelector("#vsThemeGrid");

    Object.keys(THEMES).forEach(key => {

        const theme = THEMES[key];

        const card = document.createElement("button");
        card.type = "button";
        card.className = "vs-theme-card";
        card.dataset.theme = key;

        const preview = document.createElement("span");
        preview.className = "vs-theme-preview";
        preview.style.background = theme.background;

        const bar = document.createElement("span");
        bar.className = "vs-theme-bar";
        bar.style.background = theme.header;

        const dot = document.createElement("span");
        dot.className = "vs-theme-dot";
        dot.style.background = theme.accent;

        const received = document.createElement("span");
        received.className = "vs-theme-bubble recv";
        received.style.background = theme.received;

        const sent = document.createElement("span");
        sent.className = "vs-theme-bubble sent";
        sent.style.background = theme.sent;

        preview.append(bar, dot, received, sent);

        const name = document.createElement("span");
        name.className = "vs-theme-name";
        name.textContent = theme.label;

        card.append(preview, name);

        card.addEventListener("click", () => selectTheme(key));

        grid.appendChild(card);
    });

    // ---------- Listeners (each added once) ----------

    // Clicking the dark area outside the panel closes it
    overlay.addEventListener("click", event => {

        if (event.target === overlay) {
            closeSettingsPanel();
        }
    });

    overlay
        .querySelector("#vsSettingsClose")
        .addEventListener("click", closeSettingsPanel);

    const sentInput = overlay.querySelector("#vsSentColor");
    const receivedInput = overlay.querySelector("#vsReceivedColor");
    const backgroundInput = overlay.querySelector("#vsBackgroundColor");

    sentInput.addEventListener(
        "input",
        () => updateCustomColor("sent", sentInput.value)
    );

    receivedInput.addEventListener(
        "input",
        () => updateCustomColor("received", receivedInput.value)
    );

    backgroundInput.addEventListener(
        "input",
        () => updateCustomColor("background", backgroundInput.value)
    );

    overlay
        .querySelector("#vsResetAppearance")
        .addEventListener("click", resetAppearance);

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closeSettingsPanel();
        }
    });

    syncSettingsControls();
}

function createSettingsButton() {

    const actions = getHeaderActions();

    if (!actions) return;

    if (document.getElementById("vsSettingsBtn")) {
        return;
    }

    const button = document.createElement("button");

    button.id = "vsSettingsBtn";
    button.type = "button";
    button.className = "vs-header-btn vs-settings-btn";
    button.textContent = "⚙️";
    button.title = "Chat appearance";

    button.setAttribute("aria-label", "Chat appearance");

    button.addEventListener("click", event => {

        event.stopPropagation();

        toggleSettingsPanel();
    });

    actions.appendChild(button);
}

// ============================================================
// APPEARANCE — START
// ============================================================

document.documentElement.classList.add("vs-chat-page");
document.body.classList.add("vs-chat-page");

appearance = loadAppearance();

applyAppearance();

createSettingsPanel();

createSettingsButton();

// ============================================================
// LAST SEEN — ROBUST TIMESTAMP READER
// ============================================================

function getStatusTimestamp(data = {}) {

    const possibleValues = [
        data.lastSeen,
        data.lastOnline,
        data.updatedAt,
        data.timestamp,
        data.lastSeenAt
    ];

    for (const value of possibleValues) {

        if (
            value === null ||
            value === undefined
        ) {
            continue;
        }

        let time = null;

        // Realtime Database / numeric timestamp
        if (typeof value === "number") {

            time =
                value < 10000000000
                    ? value * 1000
                    : value;

        // Firestore Timestamp
        } else if (typeof value?.toMillis === "function") {

            time = value.toMillis();

        // Timestamp-like object
        } else if (typeof value?.seconds === "number") {

            time = value.seconds * 1000;

        // JavaScript Date
        } else if (value instanceof Date) {

            time = value.getTime();

        // Date string
        } else if (typeof value === "string") {

            const parsed = Date.parse(value);

            if (!Number.isNaN(parsed)) {
                time = parsed;
            }
        }

        if (
            Number.isFinite(time) &&
            time > 0 &&
            time <= Date.now() + 60000
        ) {
            return time;
        }
    }

    return null;
}

// ============================================================
// LAST SEEN TEXT
// ============================================================

function relativeLastSeen(data = {}) {

    const time = getStatusTimestamp(data);

    if (!time) {
        return "Last seen recently";
    }

    const difference = Math.max(0, Date.now() - time);

    const minute = 60000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (difference < minute) {
        return "Last seen just now";
    }

    if (difference < hour) {

        const n = Math.floor(difference / minute);

        return `Last seen ${n} minute${n === 1 ? "" : "s"} ago`;
    }

    if (difference < day) {

        const n = Math.floor(difference / hour);

        return `Last seen ${n} hour${n === 1 ? "" : "s"} ago`;
    }

    if (difference < week) {

        const n = Math.floor(difference / day);

        return `Last seen ${n} day${n === 1 ? "" : "s"} ago`;
    }

    if (difference < month) {

        const n = Math.floor(difference / week);

        return `Last seen ${n} week${n === 1 ? "" : "s"} ago`;
    }

    if (difference < year) {

        const n = Math.floor(difference / month);

        return `Last seen ${n} month${n === 1 ? "" : "s"} ago`;
    }

    const n = Math.floor(difference / year);

    return `Last seen ${n} year${n === 1 ? "" : "s"} ago`;
}

// ============================================================
// UPDATE STATUS DISPLAY
// ============================================================

function updateChatStatus(data = {}) {

    if (!chatStatus) return;

    lastStatusData = data;

    // ONLINE
    if (data.online === true) {

        chatStatus.classList.add("is-online");

        chatStatus.innerHTML =
            '<span class="vs-online-dot"></span>Online';

        return;
    }

    // OFFLINE / LAST SEEN
    chatStatus.classList.remove("is-online");

    chatStatus.textContent = relativeLastSeen(data);
}

// ============================================================
// MEDIA PREVIEW
// ============================================================

const mediaPreview = document.createElement("div");

mediaPreview.id = "chatMediaPreview";

mediaPreview.style.display = "none";

document.body.appendChild(mediaPreview);

function clearMediaPreview() {

    if (currentPreviewUrl) {

        URL.revokeObjectURL(currentPreviewUrl);

        currentPreviewUrl = "";
    }

    mediaPreview.innerHTML = "";

    mediaPreview.style.display = "none";
}

function showImagePreview(file) {

    clearMediaPreview();

    currentPreviewUrl = URL.createObjectURL(file);

    const image = document.createElement("img");

    image.src = currentPreviewUrl;
    image.alt = "Image preview";

    image.style.width = "100px";
    image.style.height = "120px";
    image.style.objectFit = "cover";
    image.style.borderRadius = "10px";

    mediaPreview.appendChild(image);

    mediaPreview.style.display = "block";
}

function showVideoPreview(file) {

    clearMediaPreview();

    currentPreviewUrl = URL.createObjectURL(file);

    const video = document.createElement("video");

    video.src = currentPreviewUrl;
    video.controls = true;
    video.preload = "metadata";

    video.style.width = "100px";
    video.style.height = "120px";
    video.style.objectFit = "cover";
    video.style.borderRadius = "10px";

    mediaPreview.appendChild(video);

    mediaPreview.style.display = "block";
}

// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(file) {

    const formData = new FormData();

    formData.append("file", file);

    formData.append("upload_preset", "vitalstar_upload");

    const response = await fetch(
        "https://api.cloudinary.com/v1_1/m0scmqqv/auto/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    console.log("Cloudinary:", data);

    if (
        !response.ok ||
        !data.secure_url
    ) {

        throw new Error(
            data?.error?.message ||
            "Upload failed."
        );
    }

    return data.secure_url;
}

// ============================================================
// MEDIA MENU
// ============================================================

function setupMediaMenu() {

    if (!messageForm) return;

    if (
        mediaMenuReady ||
        document.getElementById("vsMediaWrapper")
    ) {
        return;
    }

    mediaMenuReady = true;

    const wrapper = document.createElement("div");

    wrapper.id = "vsMediaWrapper";
    wrapper.className = "vs-media-wrapper";

    const toggle = document.createElement("button");

    toggle.type = "button";
    toggle.className = "vs-media-toggle";
    toggle.textContent = "＋";
    toggle.title = "Media";

    const menu = document.createElement("div");

    menu.className = "vs-media-menu";

    // ---------- Image ----------

    if (imageBtn) {

        imageBtn.textContent = "📷 Image";
        imageBtn.style.display = "flex";

        menu.appendChild(imageBtn);

    } else {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "📷 Image";

        button.addEventListener(
            "click",
            () => imageInput?.click()
        );

        menu.appendChild(button);
    }

    // ---------- Video ----------

    if (videoBtn) {

        videoBtn.textContent = "🎥 Video";
        videoBtn.style.display = "flex";

        menu.appendChild(videoBtn);

    } else {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "🎥 Video";

        button.addEventListener(
            "click",
            () => videoInput?.click()
        );

        menu.appendChild(button);
    }

    // ---------- Voice note ----------

    if (recordBtn) {

        recordBtn.textContent = "🎤 Voice note";
        recordBtn.style.display = "flex";

        menu.appendChild(recordBtn);

    } else {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = "🎤 Voice note";

        button.addEventListener("click", startVoiceRecording);

        voiceButton = button;

        menu.appendChild(button);
    }

    wrapper.appendChild(toggle);
    wrapper.appendChild(menu);

    messageForm.insertBefore(
        wrapper,
        messageForm.firstChild
    );

    toggle.addEventListener("click", event => {

        event.stopPropagation();

        menu.classList.toggle("open");
        toggle.classList.toggle("open");
    });

    menu.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", () => {
        closeMediaMenu();
    });
}

function closeMediaMenu() {

    document
        .querySelector(".vs-media-menu")
        ?.classList.remove("open");

    document
        .querySelector(".vs-media-toggle")
        ?.classList.remove("open");
}

// ============================================================
// IMAGE INPUT
// ============================================================

imageInput?.addEventListener("change", () => {

    const file = imageInput.files?.[0];

    if (!file) return;

    if (videoInput) {
        videoInput.value = "";
    }

    selectedImage = file;
    selectedVideo = null;

    showImagePreview(file);

    closeMediaMenu();
});

// ============================================================
// VIDEO INPUT
// ============================================================

videoInput?.addEventListener("change", () => {

    const file = videoInput.files?.[0];

    if (!file) return;

    if (imageInput) {
        imageInput.value = "";
    }

    selectedVideo = file;
    selectedImage = null;

    showVideoPreview(file);

    closeMediaMenu();
});

// ============================================================
// BUTTON FALLBACKS
// ============================================================

imageBtn?.addEventListener("click", event => {

    event.preventDefault();

    imageInput?.click();
});

videoBtn?.addEventListener("click", event => {

    event.preventDefault();

    videoInput?.click();
});

// ============================================================
// VOICE RECORDING
// ============================================================

function setVoiceButtonText(text) {

    if (voiceButton) {
        voiceButton.textContent = text;
    }
}

async function startVoiceRecording() {

    if (isUploadingVoice) return;

    if (
        recorder &&
        recorder.state === "recording"
    ) {

        recorder.stop();

        return;
    }

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        audioChunks = [];

        recorder = new MediaRecorder(stream);

        recorder.ondataavailable = event => {

            if (
                event.data &&
                event.data.size > 0
            ) {
                audioChunks.push(event.data);
            }
        };

        recorder.onstop = async () => {

            stream
                .getTracks()
                .forEach(track => track.stop());

            try {

                isUploadingVoice = true;

                setVoiceButtonText("⏳ Uploading...");

                const blob = new Blob(
                    audioChunks,
                    { type: "audio/webm" }
                );

                const file = new File(
                    [blob],
                    `voice_${Date.now()}.webm`,
                    { type: "audio/webm" }
                );

                voiceUrl = await uploadToCloudinary(file);

                clearMediaPreview();

                mediaPreview.textContent = "🎤 Voice note ready";

                mediaPreview.style.display = "block";

            } catch (error) {

                console.error("Voice upload:", error);

                voiceUrl = "";

                alert(
                    error.message ||
                    "Voice note upload failed."
                );

            } finally {

                isUploadingVoice = false;

                setVoiceButtonText("🎤 Voice note");
            }
        };

        recorder.start();

        setVoiceButtonText("⏹ Stop recording");

    } catch (error) {

        console.error("Microphone:", error);

        alert("Microphone permission is required.");
    }
}

recordBtn?.addEventListener("click", event => {

    event.preventDefault();

    startVoiceRecording();
});

// ============================================================
// AUTHENTICATION
// ============================================================

auth.onAuthStateChanged(async user => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }

    currentUser = user;

    if (
        !receiverUid ||
        receiverUid === user.uid
    ) {

        window.location.href = "home.html";

        return;
    }

    // Prevents the chat from starting twice (duplicate listeners)
    if (chatStarted) return;

    chatStarted = true;

    chatId =
        user.uid < receiverUid
            ? `${user.uid}_${receiverUid}`
            : `${receiverUid}_${user.uid}`;

    try {

        await initializeChat();

        setupMediaMenu();

        setupMessages();

        setupIncomingCalls();

        createCallButtons();

        createBlockButton();

        createSettingsButton();

        fixComposer();

        hideLoader();

    } catch (error) {

        console.error("Chat initialization:", error);

        if (chatStatus) {
            chatStatus.textContent = "Unable to load chat";
        }

        hideLoader();
    }
});

// ============================================================
// INITIALIZE CHAT
// ============================================================

async function initializeChat() {

    await setDoc(
        doc(db, "chats", chatId),
        {
            participants: [
                currentUser.uid,
                receiverUid
            ]
        },
        {
            merge: true
        }
    );

    const receiverSnap = await getDoc(
        doc(db, "users", receiverUid)
    );

    receiverData =
        receiverSnap.exists()
            ? receiverSnap.data()
            : {};

    const name =
        receiverData.fullName ||
        receiverData.username ||
        "VitalStar User";

    if (chatName) {

        chatName.textContent = name;

        chatName.style.cursor = "pointer";

        chatName.onclick = () => {

            window.location.href =
                `profile.html?uid=${encodeURIComponent(receiverUid)}`;
        };
    }

    if (chatAvatar) {

        const fallbackAvatar =
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0757a8&color=fff`;

        const avatar =
            receiverData.profileImage ||
            receiverData.profilePicture ||
            receiverData.photoURL ||
            receiverData.avatar ||
            "";

        // If the picture fails to load, switch to the fallback once
        chatAvatar.onerror = () => {

            chatAvatar.onerror = null;

            chatAvatar.src = fallbackAvatar;
        };

        chatAvatar.style.objectFit = "cover";

        chatAvatar.src = avatar || fallbackAvatar;
    }

    listenToStatus();
}

// ============================================================
// STATUS — REALTIME DATABASE
// ============================================================

function listenToStatus() {

    if (unsubscribeStatus) {

        unsubscribeStatus();

        unsubscribeStatus = null;
    }

    if (
        !rtdb ||
        !receiverUid
    ) {

        updateChatStatus({});

        return;
    }

    const statusRef = ref(
        rtdb,
        `status/${receiverUid}`
    );

    unsubscribeStatus = onValue(
        statusRef,
        snapshot => {

            const data =
                snapshot.exists()
                    ? snapshot.val()
                    : {};

            updateChatStatus(data);
        },
        error => {

            console.error(
                "Realtime Database status:",
                error
            );

            updateChatStatus({});
        }
    );

    // Keeps "just now / minutes / hours" text fresh while chat is open
    if (!statusTimer) {

        statusTimer = setInterval(() => {

            if (lastStatusData.online !== true) {
                updateChatStatus(lastStatusData);
            }

        }, 30000);
    }
}

// ============================================================
// MESSAGES — REAL TIME, NO LIMIT
// ============================================================

function markAsDelivered(messageDoc, msg) {

    if (
        msg.receiverId === currentUser.uid &&
        (
            !msg.delivered ||
            !msg.read
        )
    ) {

        updateDoc(
            messageDoc.ref,
            {
                delivered: true,
                read: true
            }
        ).catch(() => {});
    }
}

// Adds a new bubble or refreshes an existing one.
function upsertMessage(messageId, msg, index) {

    const existing = messageElements.get(messageId);

    // Do not interrupt a voice note that is currently playing:
    // only refresh its time/status footer.
    if (
        existing &&
        existing.isConnected &&
        existing.querySelector(".vs-audio-player.playing")
    ) {

        const freshFooter =
            createMessageElement(messageId, msg)
                .querySelector(".message-footer");

        const oldFooter =
            existing.querySelector(".message-footer");

        if (oldFooter && freshFooter) {
            oldFooter.replaceWith(freshFooter);
        }

        return;
    }

    const element = createMessageElement(messageId, msg);

    if (existing) {
        existing.remove();
    }

    messageElements.set(messageId, element);

    const before = messages.children[index] || null;

    messages.insertBefore(element, before);
}

function setupMessages() {

    if (!messages) return;

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;
    }

    const messagesRef = collection(
        db,
        "chats",
        chatId,
        "messages"
    );

    // NO limit() — every message in the chat is loaded.
    const q = query(
        messagesRef,
        orderBy("timestamp", "asc")
    );

    firstMessageSnapshot = true;

    unsubscribeMessages = onSnapshot(
        q,
        snapshot => {

            if (firstMessageSnapshot) {

                messages.innerHTML = "";

                messageElements.clear();
            }

            const wasAtBottom = stickToBottom;

            let addedMine = false;

            snapshot.docChanges().forEach(change => {

                if (change.type === "removed") {

                    const element = messageElements.get(change.doc.id);

                    element?.remove();

                    messageElements.delete(change.doc.id);

                    return;
                }

                const msg = change.doc.data({
                    serverTimestamps: "estimate"
                });

                markAsDelivered(change.doc, msg);

                upsertMessage(
                    change.doc.id,
                    msg,
                    change.newIndex
                );

                if (
                    change.type === "added" &&
                    msg.senderId === currentUser.uid
                ) {
                    addedMine = true;
                }
            });

            if (
                firstMessageSnapshot ||
                wasAtBottom ||
                addedMine
            ) {

                stickToBottom = true;

                requestAnimationFrame(scrollMessagesToBottom);
            }

            if (firstMessageSnapshot) {

                // Second pass after images/videos settle
                setTimeout(scrollMessagesToBottom, 350);
            }

            firstMessageSnapshot = false;
        },
        error => {

            console.error("Messages error:", error);

            messages.innerHTML = `
                <div style="
                    text-align:center;
                    padding:20px;
                    color:#aaa;
                ">
                    Unable to load messages.
                </div>
            `;

            messageElements.clear();

            firstMessageSnapshot = true;
        }
    );
}

// ============================================================
// CREATE WHATSAPP-STYLE AUDIO PLAYER
// ============================================================

function createVoicePlayer(audioUrl) {

    const wrapper = document.createElement("div");

    wrapper.className = "vs-audio-player";

    const audio = document.createElement("audio");

    audio.src = audioUrl;
    audio.preload = "metadata";
    audio.className = "vs-hidden-audio";

    const playButton = document.createElement("button");

    playButton.type = "button";
    playButton.className = "vs-audio-play";
    playButton.textContent = "▶";

    playButton.setAttribute("aria-label", "Play voice note");

    const main = document.createElement("div");

    main.className = "vs-audio-main";

    const track = document.createElement("div");

    track.className = "vs-audio-track";

    const progress = document.createElement("div");

    progress.className = "vs-audio-progress";

    track.appendChild(progress);

    const bottom = document.createElement("div");

    bottom.className = "vs-audio-bottom";

    const time = document.createElement("span");

    time.className = "vs-audio-time";
    time.textContent = "0:00";

    const bars = document.createElement("div");

    bars.className = "vs-audio-bars";

    for (let i = 0; i < 12; i++) {
        bars.appendChild(document.createElement("span"));
    }

    bottom.appendChild(time);
    bottom.appendChild(bars);

    main.appendChild(track);
    main.appendChild(bottom);

    wrapper.appendChild(playButton);
    wrapper.appendChild(main);
    wrapper.appendChild(audio);

    function updateProgress() {

        if (
            !audio.duration ||
            !Number.isFinite(audio.duration)
        ) {
            return;
        }

        const percent = Math.min(
            100,
            Math.max(
                0,
                (audio.currentTime / audio.duration) * 100
            )
        );

        progress.style.width = `${percent}%`;

        time.textContent =
            `${formatAudioTime(audio.currentTime)} / ${formatAudioTime(audio.duration)}`;
    }

    audio.addEventListener("loadedmetadata", () => {

        time.textContent =
            `0:00 / ${formatAudioTime(audio.duration)}`;
    });

    audio.addEventListener("timeupdate", updateProgress);

    audio.addEventListener("play", () => {

        document
            .querySelectorAll(".vs-hidden-audio")
            .forEach(otherAudio => {

                if (
                    otherAudio !== audio &&
                    !otherAudio.paused
                ) {
                    otherAudio.pause();
                }
            });

        document
            .querySelectorAll(".vs-audio-player")
            .forEach(player => {

                if (player !== wrapper) {

                    player.classList.remove("playing");

                    const button =
                        player.querySelector(".vs-audio-play");

                    if (button) {
                        button.textContent = "▶";
                    }
                }
            });

        wrapper.classList.add("playing");

        playButton.textContent = "❚❚";

        playButton.setAttribute(
            "aria-label",
            "Pause voice note"
        );
    });

    audio.addEventListener("pause", () => {

        wrapper.classList.remove("playing");

        playButton.textContent = "▶";

        playButton.setAttribute(
            "aria-label",
            "Play voice note"
        );
    });

    audio.addEventListener("ended", () => {

        wrapper.classList.remove("playing");

        playButton.textContent = "▶";

        progress.style.width = "0%";

        time.textContent =
            `0:00 / ${formatAudioTime(audio.duration)}`;
    });

    audio.addEventListener("error", () => {

        playButton.textContent = "⚠";

        playButton.title = "Unable to play this voice note";
    });

    playButton.addEventListener("click", async event => {

        event.stopPropagation();

        try {

            if (audio.paused) {

                await audio.play();

            } else {

                audio.pause();
            }

        } catch (error) {

            console.error("Audio playback:", error);
        }
    });

    track.addEventListener("click", event => {

        if (
            !audio.duration ||
            !Number.isFinite(audio.duration)
        ) {
            return;
        }

        const rect = track.getBoundingClientRect();

        const position = Math.min(
            1,
            Math.max(
                0,
                (event.clientX - rect.left) / rect.width
            )
        );

        audio.currentTime = position * audio.duration;

        updateProgress();
    });

    return wrapper;
}

// ============================================================
// CREATE MESSAGE BUBBLE
// ============================================================

function createMessageElement(messageId, msg) {

    const mine = msg.senderId === currentUser.uid;

    const div = document.createElement("div");

    div.className =
        mine
            ? "message sent"
            : "message received";

    div.dataset.messageId = messageId;

    const content = document.createElement("div");

    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    if (msg.text) {

        const text = document.createElement("p");

        text.textContent = msg.text;

        content.appendChild(text);
    }

    // --------------------------------------------------------
    // IMAGE
    // --------------------------------------------------------

    if (msg.image) {

        const image = document.createElement("img");

        image.src = msg.image;
        image.alt = "Image";
        image.loading = "lazy";

        image.style.maxWidth = "220px";
        image.style.maxHeight = "260px";
        image.style.objectFit = "contain";
        image.style.borderRadius = "12px";
        image.style.display = "block";
        image.style.cursor = "pointer";

        image.addEventListener("load", () => {

            if (stickToBottom) {
                scrollMessagesToBottom();
            }
        });

        image.addEventListener("click", () => {

            window.open(msg.image, "_blank");
        });

        content.appendChild(image);
    }

    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    if (msg.video) {

        const video = document.createElement("video");

        video.src = msg.video;
        video.controls = true;
        video.preload = "metadata";

        video.style.width = "240px";
        video.style.maxWidth = "100%";
        video.style.borderRadius = "12px";
        video.style.display = "block";

        content.appendChild(video);
    }

    // --------------------------------------------------------
    // WHATSAPP-STYLE VOICE NOTE
    // --------------------------------------------------------

    if (msg.audio) {

        content.appendChild(
            createVoicePlayer(msg.audio)
        );
    }

    // --------------------------------------------------------
    // TIME / STATUS
    // --------------------------------------------------------

    const footer = document.createElement("div");

    footer.className = "message-footer";

    const time = document.createElement("span");

    time.textContent = formatTime(msg.timestamp);

    footer.appendChild(time);

    if (mine) {

        const status = document.createElement("span");

        status.textContent =
            msg.read
                ? "✓✓ Read"
                : msg.delivered
                    ? "✓✓ Delivered"
                    : msg.sent
                        ? "✓ Sent"
                        : "";

        if (msg.read) {
            status.className = "vs-read";
        }

        footer.appendChild(status);

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "vs-delete-message";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async event => {

            event.stopPropagation();

            if (!confirm("Delete this message?")) {
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

                console.error("Delete message:", error);

                alert("Unable to delete message.");
            }
        });

        footer.appendChild(deleteButton);
    }

    content.appendChild(footer);

    div.appendChild(content);

    return div;
}

// ============================================================
// SEND MESSAGE
// ============================================================

messageForm?.addEventListener("submit", async event => {

    event.preventDefault();

    if (
        !currentUser ||
        !chatId
    ) {
        return;
    }

    const sendButton =
        messageForm.querySelector('button[type="submit"]');

    if (sendButton?.disabled) {
        return;
    }

    const text =
        messageInput?.value.trim() || "";

    if (
        !text &&
        !selectedImage &&
        !selectedVideo &&
        !voiceUrl
    ) {
        return;
    }

    if (sendButton) {

        sendButton.disabled = true;

        sendButton.dataset.originalText =
            sendButton.textContent;

        sendButton.textContent = "⏳ Sending...";
    }

    try {

        let imageUrl = "";
        let videoUrl = "";
        let audioUrl = voiceUrl || "";

        if (selectedImage) {
            imageUrl = await uploadToCloudinary(selectedImage);
        }

        if (selectedVideo) {
            videoUrl = await uploadToCloudinary(selectedVideo);
        }

        await addDoc(
            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),
            {
                senderId: currentUser.uid,
                receiverId: receiverUid,

                text,

                image: imageUrl,
                video: videoUrl,
                audio: audioUrl,

                timestamp: serverTimestamp(),

                sent: true,
                delivered: false,
                read: false
            }
        );

        const preview =
            text ||
            (
                imageUrl
                    ? "📷 Photo"
                    : videoUrl
                        ? "🎥 Video"
                        : audioUrl
                            ? "🎤 Voice message"
                            : "New message"
            );

        await setDoc(
            doc(db, "chats", chatId),
            {
                participants: [
                    currentUser.uid,
                    receiverUid
                ],

                lastMessage: preview,

                lastImage: imageUrl,
                lastVideo: videoUrl,
                lastAudio: audioUrl,

                lastTimestamp: serverTimestamp(),

                lastSenderId: currentUser.uid,
                lastReceiverId: receiverUid,

                lastDelivered: false,
                lastRead: false
            },
            {
                merge: true
            }
        );

        if (messageInput) {
            messageInput.value = "";
        }

        if (imageInput) {
            imageInput.value = "";
        }

        if (videoInput) {
            videoInput.value = "";
        }

        selectedImage = null;
        selectedVideo = null;
        voiceUrl = "";

        clearMediaPreview();

        closeMediaMenu();

        stickToBottom = true;

        requestAnimationFrame(scrollMessagesToBottom);

    } catch (error) {

        console.error("Send message error:", error);

        alert(
            error.message ||
            "Failed to send message."
        );

    } finally {

        if (sendButton) {

            sendButton.disabled = false;

            sendButton.textContent =
                sendButton.dataset.originalText ||
                "Send";
        }
    }
});

// ============================================================
// BLOCK / UNBLOCK
// ============================================================

function createBlockButton() {

    const actions = getHeaderActions();

    if (!actions) return;

    if (document.getElementById("vsBlockUserBtn")) {
        return;
    }

    const button = document.createElement("button");

    button.id = "vsBlockUserBtn";
    button.type = "button";
    button.className = "vs-header-btn vs-block-btn";

    async function updateBlockButton() {

        try {

            const blockedSnap = await getDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid,
                    "blocked",
                    receiverUid
                )
            );

            if (blockedSnap.exists()) {

                button.textContent = "🔓";
                button.title = "Unblock user";

                button.classList.add("is-blocked");

            } else {

                button.textContent = "🚫";
                button.title = "Block user";

                button.classList.remove("is-blocked");
            }

        } catch (error) {

            console.error("Block status:", error);
        }
    }

    button.addEventListener("click", async () => {

        try {

            const blockedRef = doc(
                db,
                "users",
                currentUser.uid,
                "blocked",
                receiverUid
            );

            const blockedSnap = await getDoc(blockedRef);

            if (blockedSnap.exists()) {

                if (!confirm("Unblock this user?")) {
                    return;
                }

                await deleteDoc(blockedRef);

                alert("User unblocked.");

            } else {

                if (!confirm("Block this user?")) {
                    return;
                }

                await setDoc(
                    blockedRef,
                    {
                        blockedUid: receiverUid,
                        createdAt: serverTimestamp()
                    }
                );

                alert("User blocked.");
            }

            updateBlockButton();

        } catch (error) {

            console.error("Block/unblock:", error);

            alert("Unable to update block status.");
        }
    });

    actions.appendChild(button);

    updateBlockButton();
}

// ============================================================
// CALL BUTTONS
// ============================================================

function createCallButtons() {

    const actions = getHeaderActions();

    if (!actions) return;

    if (document.getElementById("vsCallControls")) {
        return;
    }

    const controls = document.createElement("div");

    controls.id = "vsCallControls";
    controls.className = "vs-call-controls";

    controls.innerHTML = `
        <button
            class="vs-call-btn"
            id="vsVoiceCallBtn"
            type="button"
            title="Voice call"
        >
            📞
        </button>

        <button
            class="vs-call-btn"
            id="vsVideoCallBtn"
            type="button"
            title="Video call"
        >
            📹
        </button>
    `;

    actions.appendChild(controls);

    document
        .getElementById("vsVoiceCallBtn")
        ?.addEventListener("click", () => startCall("voice"));

    document
        .getElementById("vsVideoCallBtn")
        ?.addEventListener("click", () => startCall("video"));
}

// ============================================================
// CALL SCREEN
// ============================================================

function createCallScreen(type) {

    document
        .getElementById("vsCallOverlay")
        ?.remove();

    const name =
        receiverData.fullName ||
        receiverData.username ||
        "VitalStar User";

    const overlay = document.createElement("div");

    overlay.id = "vsCallOverlay";
    overlay.className = "vs-call-overlay";

    overlay.innerHTML = `

        <div class="vs-call-top">

            <div>

                <div style="
                    font-size:17px;
                    font-weight:800;
                ">
                    ${type === "video" ? "📹 Video call" : "📞 Voice call"}
                </div>

                <div style="
                    font-size:12px;
                    opacity:.65;
                ">
                    ${escapeHTML(name)}
                </div>

            </div>

            <div
                id="vsCallStatus"
                style="
                    font-size:12px;
                    opacity:.7;
                "
            >
                Calling...
            </div>

        </div>

        <div class="vs-call-media">

            <div
                id="vsCallAvatar"
                class="vs-call-avatar"
            >
                ${escapeHTML(name.charAt(0))}
            </div>

            <video
                id="vsRemoteVideo"
                class="vs-remote-video"
                autoplay
                playsinline
                style="display:${type === "video" ? "block" : "none"};"
            ></video>

            <video
                id="vsLocalVideo"
                class="vs-local-video"
                autoplay
                muted
                playsinline
                style="display:${type === "video" ? "block" : "none"};"
            ></video>

            <audio
                id="vsRemoteAudio"
                autoplay
            ></audio>

        </div>

        <div class="vs-call-bottom">

            <button
                id="vsEndCall"
                class="vs-end-call"
                type="button"
            >
                📵
            </button>

        </div>
    `;

    document.body.appendChild(overlay);

    overlay.style.display = "flex";

    document
        .getElementById("vsEndCall")
        ?.addEventListener("click", endCall);
}

function setCallStatus(text) {

    const status = document.getElementById("vsCallStatus");

    if (status) {
        status.textContent = text;
    }
}

// ============================================================
// WEBRTC
// ============================================================

const rtcConfiguration = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};

async function createPeer(call) {

    const type = call.type;

    const peer = new RTCPeerConnection(rtcConfiguration);

    const stream =
        await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === "video"
        });

    call.localStream = stream;

    const localVideo = document.getElementById("vsLocalVideo");

    if (
        localVideo &&
        type === "video"
    ) {
        localVideo.srcObject = stream;
    }

    stream
        .getTracks()
        .forEach(track => {
            peer.addTrack(track, stream);
        });

    peer.ontrack = event => {

        let remoteStream =
            event.streams && event.streams[0];

        // Some browsers do not attach a stream: build one ourselves
        if (!remoteStream) {

            if (!call.remoteStream) {
                call.remoteStream = new MediaStream();
            }

            call.remoteStream.addTrack(event.track);

            remoteStream = call.remoteStream;
        }

        const remoteVideo = document.getElementById("vsRemoteVideo");
        const remoteAudio = document.getElementById("vsRemoteAudio");

        if (
            remoteVideo &&
            type === "video"
        ) {

            remoteVideo.srcObject = remoteStream;

            // Sound plays through the audio element,
            // so mute the video element to avoid double audio.
            remoteVideo.muted = true;
        }

        if (remoteAudio) {

            remoteAudio.srcObject = remoteStream;

            remoteAudio.play().catch(() => {});
        }

        document
            .getElementById("vsCallAvatar")
            ?.remove();
    };

    peer.onicecandidate = async event => {

        if (!event.candidate) {
            return;
        }

        try {

            await addDoc(
                collection(
                    db,
                    "calls",
                    call.callId,
                    "candidates"
                ),
                {
                    senderId: currentUser.uid,
                    candidate: event.candidate.toJSON()
                }
            );

        } catch (error) {

            console.error("ICE error:", error);
        }
    };

    peer.onconnectionstatechange = () => {

        if (peer.connectionState === "connected") {

            setCallStatus("Connected");
        }

        if (
            peer.connectionState === "failed" ||
            peer.connectionState === "disconnected"
        ) {

            setCallStatus("Connection lost");
        }
    };

    return peer;
}

// ============================================================
// ICE CANDIDATE QUEUE
// Candidates that arrive BEFORE setRemoteDescription() are
// saved in call.pendingCandidates and added right afterwards.
// ============================================================

async function flushPendingCandidates(call, peer) {

    const pending = call.pendingCandidates.splice(
        0,
        call.pendingCandidates.length
    );

    for (const candidate of pending) {

        try {

            await peer.addIceCandidate(candidate);

        } catch (error) {

            console.error("Queued ICE:", error);
        }
    }
}

async function applyRemoteDescription(call, peer, description) {

    await peer.setRemoteDescription(
        new RTCSessionDescription(description)
    );

    await flushPendingCandidates(call, peer);
}

// ============================================================
// ICE LISTENER
// ============================================================

function listenForCandidates(call, peer) {

    if (activeCandidateListener) {

        activeCandidateListener();

        activeCandidateListener = null;
    }

    activeCandidateListener = onSnapshot(
        collection(
            db,
            "calls",
            call.callId,
            "candidates"
        ),
        async snapshot => {

            for (const change of snapshot.docChanges()) {

                if (change.type !== "added") {
                    continue;
                }

                const data = change.doc.data();

                if (data.senderId === currentUser.uid) {
                    continue;
                }

                if (!data.candidate) {
                    continue;
                }

                try {

                    const candidate = new RTCIceCandidate(data.candidate);

                    if (peer.remoteDescription) {

                        await peer.addIceCandidate(candidate);

                    } else {

                        // Remote description not ready yet: queue it
                        call.pendingCandidates.push(candidate);
                    }

                } catch (error) {

                    console.error("Remote ICE:", error);
                }
            }
        }
    );
}

// ============================================================
// START CALL
// ============================================================

async function startCall(type) {

    if (activeCall) {

        alert("You are already in a call.");

        return;
    }

    if (
        !window.RTCPeerConnection ||
        !navigator.mediaDevices
    ) {

        alert("Calling is not supported on this browser.");

        return;
    }

    const callId = randomId();

    const call = {
        callId,
        type,
        pendingCandidates: [],
        pc: null,
        localStream: null,
        remoteStream: null,
        answered: false,
        remoteDescriptionApplied: false,
        ringTimeout: null
    };

    activeCall = call;

    createCallScreen(type);

    const callRef = doc(db, "calls", callId);

    try {

        await setDoc(
            callRef,
            {
                callerId: currentUser.uid,
                receiverId: receiverUid,
                type,
                status: "ringing",
                createdAt: serverTimestamp()
            }
        );

        const peer = await createPeer(call);

        call.pc = peer;

        listenForCandidates(call, peer);

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        await updateDoc(
            callRef,
            {
                offer: peer.localDescription.toJSON()
            }
        );

        activeCallListener = onSnapshot(
            callRef,
            async snapshot => {

                if (
                    !snapshot.exists() ||
                    activeCall !== call
                ) {
                    return;
                }

                const data = snapshot.data();

                if (
                    data.answer &&
                    !call.remoteDescriptionApplied
                ) {

                    // Flag first so repeated snapshots do not apply it twice
                    call.remoteDescriptionApplied = true;

                    try {

                        await applyRemoteDescription(
                            call,
                            peer,
                            data.answer
                        );

                        call.answered = true;

                        setCallStatus("Connecting...");

                    } catch (error) {

                        console.error("Apply answer:", error);
                    }
                }

                if (data.status === "declined") {

                    setCallStatus("Call declined");

                    setTimeout(() => {

                        if (activeCall === call) {
                            cleanupCall();
                        }

                    }, 1000);
                }

                if (data.status === "ended") {

                    cleanupCall();
                }
            }
        );

        // Stop ringing after 60 seconds if nobody answered
        call.ringTimeout = setTimeout(async () => {

            if (
                activeCall === call &&
                !call.answered
            ) {

                try {

                    await updateDoc(
                        callRef,
                        { status: "ended" }
                    );

                } catch {}

                cleanupCall();
            }

        }, 60000);

    } catch (error) {

        console.error("Start call:", error);

        alert(
            "Unable to start the call. Check microphone/camera permission and Firebase permissions."
        );

        updateDoc(callRef, { status: "ended" }).catch(() => {});

        cleanupCall();
    }
}

// ============================================================
// INCOMING CALLS
// ============================================================

function removeIncomingCallBox(callId) {

    document
        .querySelectorAll(".vs-incoming-call")
        .forEach(box => {

            if (box.dataset.callId === callId) {
                box.remove();
            }
        });
}

function isStaleCall(data) {

    const created =
        typeof data.createdAt?.toMillis === "function"
            ? data.createdAt.toMillis()
            : null;

    // Ignore calls older than 2 minutes (abandoned calls)
    return Boolean(
        created &&
        Date.now() - created > 120000
    );
}

function setupIncomingCalls() {

    if (unsubscribeIncomingCalls) {

        unsubscribeIncomingCalls();

        unsubscribeIncomingCalls = null;
    }

    const q = query(
        collection(db, "calls"),
        where(
            "receiverId",
            "==",
            currentUser.uid
        )
    );

    unsubscribeIncomingCalls = onSnapshot(
        q,
        snapshot => {

            snapshot.docChanges().forEach(change => {

                if (change.type === "removed") {
                    return;
                }

                const data = change.doc.data();

                if (data.callerId === currentUser.uid) {
                    return;
                }

                // Caller hung up or call was answered elsewhere
                if (data.status !== "ringing") {

                    removeIncomingCallBox(change.doc.id);

                    return;
                }

                if (!data.offer) {
                    return;
                }

                if (activeCall) {
                    return;
                }

                if (isStaleCall(data)) {
                    return;
                }

                showIncomingCall(change.doc.id, data);
            });
        },
        error => {

            console.error("Incoming calls:", error);
        }
    );
}

// ============================================================
// INCOMING CALL UI
// ============================================================

async function showIncomingCall(callId, data) {

    if (document.querySelector(".vs-incoming-call")) {
        return;
    }

    let callerName = "VitalStar User";

    try {

        const callerSnap = await getDoc(
            doc(db, "users", data.callerId)
        );

        if (callerSnap.exists()) {

            const caller = callerSnap.data();

            callerName =
                caller.fullName ||
                caller.username ||
                "VitalStar User";
        }

    } catch {}

    // Another call box may have appeared while we were loading
    if (document.querySelector(".vs-incoming-call")) {
        return;
    }

    const box = document.createElement("div");

    box.className = "vs-incoming-call";

    box.dataset.callId = callId;

    box.innerHTML = `

        <div style="
            font-size:42px;
            margin-bottom:10px;
        ">
            ${data.type === "video" ? "📹" : "📞"}
        </div>

        <div style="
            font-size:19px;
            font-weight:900;
        ">
            Incoming ${data.type === "video" ? "video" : "voice"} call
        </div>

        <div style="
            margin-top:6px;
            opacity:.7;
            font-size:13px;
        ">
            ${escapeHTML(callerName)}
        </div>

        <div class="vs-incoming-actions">

            <button
                class="vs-decline"
                type="button"
                id="vsDeclineCall"
            >
                Decline
            </button>

            <button
                class="vs-accept"
                type="button"
                id="vsAcceptCall"
            >
                Accept
            </button>

        </div>
    `;

    document.body.appendChild(box);

    box
        .querySelector("#vsDeclineCall")
        ?.addEventListener("click", async () => {

            try {

                await updateDoc(
                    doc(db, "calls", callId),
                    { status: "declined" }
                );

            } catch {}

            box.remove();
        });

    box
        .querySelector("#vsAcceptCall")
        ?.addEventListener("click", () => {

            box.remove();

            acceptCall(callId, data);
        });
}

// ============================================================
// ACCEPT CALL
// ============================================================

async function acceptCall(callId, data) {

    if (activeCall) return;

    const call = {
        callId,
        type: data.type,
        pendingCandidates: [],
        pc: null,
        localStream: null,
        remoteStream: null,
        answered: true,
        remoteDescriptionApplied: false,
        ringTimeout: null
    };

    activeCall = call;

    createCallScreen(data.type);

    setCallStatus("Connecting...");

    try {

        const callRef = doc(db, "calls", callId);

        const peer = await createPeer(call);

        call.pc = peer;

        // Start listening first; early candidates are queued
        listenForCandidates(call, peer);

        await applyRemoteDescription(
            call,
            peer,
            data.offer
        );

        call.remoteDescriptionApplied = true;

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        await updateDoc(
            callRef,
            {
                answer: peer.localDescription.toJSON(),
                status: "accepted"
            }
        );

        activeCallListener = onSnapshot(
            callRef,
            snapshot => {

                if (
                    !snapshot.exists() ||
                    activeCall !== call
                ) {
                    return;
                }

      