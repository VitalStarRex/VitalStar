// ============================================================
// VITALSTAR CHAT.JS
// Messages + Media Menu + Voice Notes + Delete + Block
// Last Seen + Voice Call + Video Call
// ============================================================

import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// ELEMENTS
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

let currentUser = null;
let receiverUid = null;
let chatId = null;
let receiverData = {};

let unsubscribeMessages = null;
let unsubscribeStatus = null;
let unsubscribeIncomingCalls = null;

let selectedImage = null;
let selectedVideo = null;
let voiceUrl = "";

let mediaRecorder = null;
let audioChunks = [];

let activeCall = null;
let activeCallListener = null;
let activeCandidateListener = null;

// ============================================================
// LOADER
// ============================================================

const loader = document.createElement("div");

loader.id = "vitalStarChatLoader";

loader.innerHTML = `
    <div class="vs-loader-box">
        <div class="vs-loader-logo">VS</div>
        <div class="vs-loader-text">Loading chat...</div>
    </div>
`;

Object.assign(loader.style, {
    position: "fixed",
    inset: "0",
    background: "#080611",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2147483647"
});

document.body.appendChild(loader);

const chatStyle = document.createElement("style");

chatStyle.textContent = `

/* ============================================================
   LOADER
   ============================================================ */

#vitalStarChatLoader .vs-loader-box {
    text-align:center;
    color:white;
    font-family:Arial,sans-serif;
}

#vitalStarChatLoader .vs-loader-logo {
    width:72px;
    height:72px;
    border-radius:50%;
    margin:auto;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:22px;
    font-weight:900;
    border:4px solid rgba(255,255,255,.15);
    border-top-color:#7c3aed;
    border-right-color:#22c55e;
    animation:vsChatSpin .9s linear infinite;
}

#vitalStarChatLoader .vs-loader-text {
    margin-top:15px;
    font-size:14px;
    opacity:.8;
}

@keyframes vsChatSpin {
    to {
        transform:rotate(360deg);
    }
}

/* ============================================================
   MESSAGE AREA
   ============================================================ */

#messages {
    padding-bottom:150px !important;
    scroll-padding-bottom:170px !important;
}

/* ============================================================
   FIXED MESSAGE COMPOSER
   ============================================================ */

#messageForm {
    position:fixed !important;

    left:0 !important;
    right:0 !important;
    bottom:0 !important;

    width:100% !important;
    max-width:none !important;

    min-height:58px !important;

    margin:0 !important;
    padding:8px 10px !important;

    box-sizing:border-box !important;

    display:flex !important;
    flex-direction:row !important;
    align-items:center !important;
    gap:7px !important;

    visibility:visible !important;
    opacity:1 !important;

    overflow:visible !important;

    background:rgba(9,6,17,.98) !important;

    backdrop-filter:blur(18px);
    -webkit-backdrop-filter:blur(18px);

    border-top:1px solid rgba(255,255,255,.12);

    box-shadow:
        0 -8px 30px rgba(0,0,0,.45);

    z-index:2147483646 !important;

    isolation:isolate;
}

#messageForm * {
    box-sizing:border-box;
}

/* ============================================================
   INPUT
   ============================================================ */

#messageForm input[type="text"],
#messageForm input:not([type]),
#messageForm textarea {
    flex:1 1 auto !important;
    min-width:0 !important;
}

/* ============================================================
   MEDIA MENU
   ============================================================ */

.vs-media-wrapper {
    position:relative;
    flex:0 0 auto;
    z-index:50;
}

.vs-media-toggle {
    width:42px;
    height:42px;

    border:none;
    border-radius:50%;

    background:rgba(124,58,237,.2);
    color:#fff;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:23px;
    font-weight:900;

    cursor:pointer;

    transition:
        transform .18s ease,
        background .18s ease;
}

.vs-media-toggle:active {
    transform:scale(.9);
}

.vs-media-toggle.open {
    background:rgba(124,58,237,.4);
    transform:rotate(45deg);
}

.vs-media-menu {
    position:absolute;

    left:0;
    bottom:52px;

    width:170px;

    padding:8px;

    border-radius:16px;

    background:rgba(22,17,31,.98);

    border:1px solid rgba(255,255,255,.12);

    box-shadow:
        0 15px 45px rgba(0,0,0,.55);

    display:none;

    flex-direction:column;
    gap:5px;

    z-index:2147483647;
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

.vs-media-menu button:hover {
    background:rgba(124,58,237,.25) !important;
}

.vs-original-media-hidden {
    display:flex !important;
}

/* ============================================================
   MEDIA PREVIEW
   ============================================================ */

#mediaPreview {
    position:absolute !important;

    left:10px !important;
    right:10px !important;
    bottom:100% !important;

    padding:7px 10px !important;

    border-radius:10px 10px 0 0;

    background:rgba(20,15,28,.97) !important;

    color:#ddd !important;

    font-size:12px;

    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;

    z-index:2147483645;
}

/* ============================================================
   CALL BUTTONS
   ============================================================ */

.vs-call-controls {
    position:absolute;

    right:45px;
    top:50%;

    transform:translateY(-50%);

    display:flex;
    gap:5px;

    z-index:100;
}

.vs-call-btn {
    width:34px;
    height:34px;

    border:none;
    border-radius:50%;

    background:rgba(124,58,237,.18);

    color:#fff;

    cursor:pointer;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:16px;
}

.vs-call-btn:active {
    transform:scale(.92);
}

/* ============================================================
   CALL SCREEN
   ============================================================ */

.vs-call-overlay {
    position:fixed;
    inset:0;

    background:#05030a;

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

.vs-call-title {
    font-size:17px;
    font-weight:800;
}

.vs-call-status {
    font-size:12px;
    opacity:.7;
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

    border:2px solid rgba(255,255,255,.3);

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
        #7c3aed,
        #22c55e
    );

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

    color:white;

    font-size:24px;

    cursor:pointer;
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

    background:#17121f;

    border:1px solid rgba(255,255,255,.12);

    box-shadow:
        0 20px 70px rgba(0,0,0,.6);

    text-align:center;

    color:white;

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

    color:white;

    font-weight:800;
}

.vs-decline {
    background:#dc2626;
}

.vs-accept {
    background:#16a34a;
}

/* ============================================================
   DELETE BUTTON
   ============================================================ */

.vs-delete-message {
    border:none;
    background:transparent;

    color:#ef4444;

    font-size:11px;

    cursor:pointer;

    margin-left:7px;
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

    .vs-call-controls {
        right:42px;
    }

    .vs-call-btn {
        width:31px;
        height:31px;
        font-size:14px;
    }

    .vs-local-video {
        width:95px;
        height:135px;
    }
}
`;

document.head.appendChild(chatStyle);

// ============================================================
// HELPERS
// ============================================================

function hideLoader() {

    if (!loader) return;

    loader.style.opacity = "0";
    loader.style.transition = "opacity .25s ease";

    setTimeout(() => {
        loader.remove();
    }, 300);
}

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
        crypto &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return Date.now() + "_" +
        Math.random()
            .toString(36)
            .slice(2);
}

function formatTime(timestamp) {

    if (!timestamp) return "";

    const date =
        timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);

    return date.toLocaleTimeString([], {
        hour:"numeric",
        minute:"2-digit"
    });
}

// ============================================================
// RELATIVE LAST SEEN
// ============================================================

function relativeLastSeen(value) {

    if (!value) {
        return "Last seen recently";
    }

    let time = 0;

    if (typeof value === "number") {

        time = value;

    } else if (value.toMillis) {

        time = value.toMillis();

    } else if (value.seconds) {

        time =
            value.seconds * 1000;

    } else {

        time =
            new Date(value).getTime();
    }

    if (
        !time ||
        Number.isNaN(time)
    ) {
        return "Last seen recently";
    }

    const difference =
        Math.max(
            0,
            Date.now() - time
        );

    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (difference < minute) {

        const n =
            Math.max(
                1,
                Math.floor(
                    difference / second
                )
            );

        return `Last seen ${n} second${n === 1 ? "" : "s"} ago`;
    }

    if (difference < hour) {

        const n =
            Math.floor(
                difference / minute
            );

        return `Last seen ${n} minute${n === 1 ? "" : "s"} ago`;
    }

    if (difference < day) {

        const n =
            Math.floor(
                difference / hour
            );

        return `Last seen ${n} hour${n === 1 ? "" : "s"} ago`;
    }

    if (difference < week) {

        const n =
            Math.floor(
                difference / day
            );

        return `Last seen ${n} day${n === 1 ? "" : "s"} ago`;
    }

    if (difference < month) {

        const n =
            Math.floor(
                difference / week
            );

        return `Last seen ${n} week${n === 1 ? "" : "s"} ago`;
    }

    if (difference < year) {

        const n =
            Math.floor(
                difference / month
            );

        return `Last seen ${n} month${n === 1 ? "" : "s"} ago`;
    }

    const n =
        Math.floor(
            difference / year
        );

    return `Last seen ${n} year${n === 1 ? "" : "s"} ago`;
}

// ============================================================
// AUTH
// ============================================================

auth.onAuthStateChanged(async user => {

    if (!user) {

        window.location.href =
            "login.html";

        return;
    }

    currentUser = user;

    const params =
        new URLSearchParams(
            window.location.search
        );

    receiverUid =
        params.get("uid");

    if (
        !receiverUid ||
        receiverUid === currentUser.uid
    ) {

        window.location.href =
            "home.html";

        return;
    }

    chatId =
        currentUser.uid < receiverUid
            ? `${currentUser.uid}_${receiverUid}`
            : `${receiverUid}_${currentUser.uid}`;

    try {

        await initializeChat();

        setupMessageListener();

        setupIncomingCalls();

        setupMediaMenu();

        fixComposer();

        hideLoader();

    } catch (error) {

        console.error(
            "VitalStar chat initialization error:",
            error
        );

        hideLoader();

        if (chatStatus) {
            chatStatus.textContent =
                "Unable to load chat";
        }
    }
});

// ============================================================
// INITIALIZE CHAT
// ============================================================

async function initializeChat() {

    const receiverRef =
        doc(
            db,
            "users",
            receiverUid
        );

    const receiverSnap =
        await getDoc(receiverRef);

    receiverData =
        receiverSnap.exists()
            ? receiverSnap.data()
            : {};

    const name =
        receiverData.fullName ||
        receiverData.username ||
        "VitalStar User";

    if (chatName) {

        chatName.textContent =
            name;

        chatName.style.cursor =
            "pointer";

        chatName.onclick = () => {

            window.location.href =
                `profile.html?uid=${encodeURIComponent(receiverUid)}`;
        };
    }

    // KEEP EXISTING PROFILE IMAGE LOGIC
    if (chatAvatar) {

        const avatar =
            receiverData.profileImage ||
            receiverData.photoURL ||
            receiverData.avatar ||
            "";

        if (avatar) {

            chatAvatar.src =
                avatar;

            chatAvatar.style.objectFit =
                "cover";

        } else {

            chatAvatar.src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff`;
        }
    }

    await setDoc(
        doc(
            db,
            "chats",
            chatId
        ),
        {
            participants:[
                currentUser.uid,
                receiverUid
            ]
        },
        {
            merge:true
        }
    );

    listenToStatus();

    createCallButtons();

    createBlockButton();
}

// ============================================================
// STATUS
// ============================================================

function listenToStatus() {

    if (unsubscribeStatus) {
        unsubscribeStatus();
    }

    unsubscribeStatus =
        onSnapshot(
            doc(
                db,
                "status",
                receiverUid
            ),
            snapshot => {

                const data =
                    snapshot.exists()
                        ? snapshot.data()
                        : {};

                if (!chatStatus) return;

                if (data.online === true) {

                    chatStatus.textContent =
                        "🟢 Online";

                    chatStatus.style.color =
                        "#22c55e";

                } else {

                    chatStatus.textContent =
                        relativeLastSeen(
                            data.lastSeen ||
                            data.timestamp
                        );

                    chatStatus.style.color =
                        "";
                }
            }
        );
}

// ============================================================
// KEEP LAST SEEN TEXT FRESH
// ============================================================

setInterval(() => {

    if (!chatStatus) return;

    if (
        chatStatus.textContent
            .includes("Online")
    ) {
        return;
    }

    if (!receiverUid) return;

    getDoc(
        doc(
            db,
            "status",
            receiverUid
        )
    )
        .then(snapshot => {

            if (!snapshot.exists()) {
                return;
            }

            const data =
                snapshot.data();

            if (data.online === true) {

                chatStatus.textContent =
                    "🟢 Online";

                chatStatus.style.color =
                    "#22c55e";

            } else {

                chatStatus.textContent =
                    relativeLastSeen(
                        data.lastSeen ||
                        data.timestamp
                    );
            }
        })
        .catch(() => {});

}, 30000);

// ============================================================
// MESSAGES
// ============================================================

function setupMessageListener() {

    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );

    const messagesQuery =
        query(
            messagesRef,
            orderBy(
                "timestamp",
                "desc"
            ),
            limit(100)
        );

    unsubscribeMessages =
        onSnapshot(
            messagesQuery,
            snapshot => {

                if (!messages) return;

                messages.innerHTML =
                    "";

                const docs =
                    [...snapshot.docs]
                        .reverse();

                docs.forEach(
                    messageDoc => {

                        const data =
                            messageDoc.data();

                        if (
                            data.receiverId ===
                                currentUser.uid &&
                            (
                                !data.read ||
                                !data.delivered
                            )
                        ) {

                            updateDoc(
                                messageDoc.ref,
                                {
                                    delivered:true,
                                    read:true
                                }
                            ).catch(() => {});
                        }

                        renderMessage(
                            messageDoc.id,
                            data
                        );
                    }
                );

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

                messages.innerHTML = `
                    <div style="
                        text-align:center;
                        padding:20px;
                        color:#aaa;
                    ">
                        Unable to load messages.
                    </div>
                `;
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

    const mine =
        data.senderId ===
        currentUser.uid;

    const wrapper =
        document.createElement("div");

    wrapper.className =
        mine
            ? "message sent"
            : "message received";

    wrapper.dataset.messageId =
        messageId;

    let content = "";

    if (data.text) {

        content += `
            <div class="message-text">
                ${escapeHTML(data.text)}
            </div>
        `;
    }

    if (data.image) {

        content += `
            <img
                src="${escapeHTML(data.image)}"
                style="
                    display:block;
                    max-width:240px;
                    border-radius:12px;
                    margin-top:5px;
                    cursor:pointer;
                "
                loading="lazy"
                alt="Image"
            >
        `;
    }

    if (data.video) {

        content += `
            <video
                src="${escapeHTML(data.video)}"
                controls
                preload="metadata"
                style="
                    display:block;
                    max-width:260px;
                    width:100%;
                    border-radius:12px;
                    margin-top:5px;
                "
            ></video>
        `;
    }

    if (data.audio) {

        content += `
            <audio
                src="${escapeHTML(data.audio)}"
                controls
                style="
                    max-width:250px;
                    width:100%;
                    margin-top:5px;
                "
            ></audio>
        `;
    }

    if (!content) {

        content =
            `<div class="message-text">Message</div>`;
    }

    let status = "";

    if (mine) {

        status =
            data.read
                ? "✓✓"
                : data.delivered
                    ? "✓✓"
                    : data.sent
                        ? "✓"
                        : "";
    }

    wrapper.innerHTML = `
        <div class="message-bubble">

            ${content}

            <div
                class="message-meta"
                style="
                    display:flex;
                    align-items:center;
                    gap:3px;
                "
            >

                <span>
                    ${formatTime(data.timestamp)}
                </span>

                ${
                    status
                        ? `<span>${status}</span>`
                        : ""
                }

                ${
                    mine
                        ? `
                            <button
                                class="vs-delete-message"
                                data-delete-id="${messageId}"
                                type="button"
                            >
                                Delete
                            </button>
                        `
                        : ""
                }

            </div>

        </div>
    `;

    const image =
        wrapper.querySelector(
            "img"
        );

    if (image) {

        image.addEventListener(
            "click",
            () => {

                window.open(
                    data.image,
                    "_blank"
                );
            }
        );
    }

    const deleteButton =
        wrapper.querySelector(
            ".vs-delete-message"
        );

    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                const exactId =
                    event.currentTarget
                        .dataset
                        .deleteId;

                if (!exactId) {
                    return;
                }

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
                            exactId
                        )
                    );

                } catch (error) {

                    console.error(
                        "Delete message error:",
                        error
                    );

                    alert(
                        "Unable to delete this message."
                    );
                }
            }
        );
    }

    messages.appendChild(
        wrapper
    );
}

// ============================================================
// MEDIA PREVIEW
// ============================================================

let mediaPreview =
    document.getElementById(
        "mediaPreview"
    );

if (
    !mediaPreview &&
    messageForm
) {

    mediaPreview =
        document.createElement("div");

    mediaPreview.id =
        "mediaPreview";

    messageForm.appendChild(
        mediaPreview
    );
}

function updateMediaPreview() {

    if (!mediaPreview) {
        return;
    }

    let text = "";

    if (selectedImage) {

        text +=
            `📷 ${selectedImage.name}`;
    }

    if (selectedVideo) {

        text +=
            `${text ? " • " : ""}🎥 ${selectedVideo.name}`;
    }

    if (voiceUrl) {

        text +=
            `${text ? " • " : ""}🎤 Voice ready`;
    }

    mediaPreview.textContent =
        text;

    mediaPreview.style.display =
        text
            ? "block"
            : "none";
}

// ============================================================
// IMAGE
// ============================================================

imageInput?.addEventListener(
    "change",
    () => {

        selectedImage =
            imageInput.files?.[0] ||
            null;

        updateMediaPreview();

        closeMediaMenu();
    }
);

// ============================================================
// VIDEO
// ============================================================

videoInput?.addEventListener(
    "change",
    () => {

        selectedVideo =
            videoInput.files?.[0] ||
            null;

        updateMediaPreview();

        closeMediaMenu();
    }
);

// ============================================================
// MEDIA MENU
// ============================================================

function setupMediaMenu() {

    if (!messageForm) {
        return;
    }

    if (
        document.getElementById(
            "vsMediaWrapper"
        )
    ) {
        return;
    }

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "vsMediaWrapper";

    wrapper.className =
        "vs-media-wrapper";

    const toggle =
        document.createElement("button");

    toggle.type =
        "button";

    toggle.id =
        "vsMediaToggle";

    toggle.className =
        "vs-media-toggle";

    toggle.innerHTML =
        "＋";

    toggle.title =
        "Media";

    const menu =
        document.createElement("div");

    menu.id =
        "vsMediaMenu";

    menu.className =
        "vs-media-menu";

    if (imageBtn) {

        imageBtn.classList.add(
            "vs-original-media-hidden"
        );

        imageBtn.textContent =
            "📷 Image";

        menu.appendChild(
            imageBtn
        );
    }

    if (videoBtn) {

        videoBtn.classList.add(
            "vs-original-media-hidden"
        );

        videoBtn.textContent =
            "🎥 Video";

        menu.appendChild(
            videoBtn
        );
    }

    if (recordBtn) {

        recordBtn.classList.add(
            "vs-original-media-hidden"
        );

        if (
            !recordBtn.textContent.trim()
        ) {
            recordBtn.textContent =
                "🎤 Voice note";
        }

        menu.appendChild(
            recordBtn
        );
    }

    wrapper.appendChild(
        toggle
    );

    wrapper.appendChild(
        menu
    );

    messageForm.insertBefore(
        wrapper,
        messageForm.firstChild
    );

    toggle.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            menu.classList.toggle(
                "open"
            );

            toggle.classList.toggle(
                "open"
            );
        }
    );

    menu.addEventListener(
        "click",
        event => {
            event.stopPropagation();
        }
    );

    document.addEventListener(
        "click",
        event => {

            if (
                !wrapper.contains(
                    event.target
                )
            ) {
                closeMediaMenu();
            }
        }
    );
}

function closeMediaMenu() {

    const menu =
        document.getElementById(
            "vsMediaMenu"
        );

    const toggle =
        document.getElementById(
            "vsMediaToggle"
        );

    menu?.classList.remove(
        "open"
    );

    toggle?.classList.remove(
        "open"
    );
}

// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(
    file
) {

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "upload_preset",
        "vitalstar_upload"
    );

    const response =
        await fetch(
            "https://api.cloudinary.com/v1_1/m0scmqqv/auto/upload",
            {
                method:"POST",
                body:formData
            }
        );

    if (!response.ok) {

        throw new Error(
            "Cloudinary upload failed"
        );
    }

    const result =
        await response.json();

    if (!result.secure_url) {

        throw new Error(
            "Cloudinary URL missing"
        );
    }

    return result.secure_url;
}

// ============================================================
// VOICE RECORDING
// ============================================================

recordBtn?.addEventListener(
    "click",
    async () => {

        if (
            mediaRecorder &&
            mediaRecorder.state ===
                "recording"
        ) {

            mediaRecorder.stop();

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio:true
                    });

            audioChunks = [];

            mediaRecorder =
                new MediaRecorder(
                    stream
                );

            mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data.size > 0
                    ) {

                        audioChunks.push(
                            event.data
                        );
                    }
                };

            mediaRecorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    try {

                        recordBtn.textContent =
                            "⏳ Uploading...";

                        const blob =
                            new Blob(
                                audioChunks,
                                {
                                    type:
                                        "audio/webm"
                                }
                            );

                        const file =
                            new File(
                                [blob],
                                `voice_${Date.now()}.webm`,
                                {
                                    type:
                                        "audio/webm"
                                }
                            );

                        voiceUrl =
                            await uploadToCloudinary(
                                file
                            );

                        recordBtn.textContent =
                            "🎤 Voice note";

                        updateMediaPreview();

                    } catch (error) {

                        console.error(
                            "Voice upload:",
                            error
                        );

                        voiceUrl = "";

                        recordBtn.textContent =
                            "🎤 Voice note";

                        alert(
                            "Voice note upload failed."
                        );
                    }
                };

            mediaRecorder.start();

            recordBtn.textContent =
                "⏹️ Stop recording";

        } catch (error) {

            console.error(
                "Microphone:",
                error
            );

            alert(
                "Microphone permission is required."
            );
        }
    }
);

// ============================================================
// SEND MESSAGE
// ============================================================

messageForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (
            !currentUser ||
            !chatId
        ) {
            return;
        }

        const text =
            messageInput?.value.trim() ||
            "";

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
                'button[type="submit"]'
            );

        if (sendButton) {

            sendButton.disabled =
                true;

            sendButton.dataset.oldText =
                sendButton.textContent;

            sendButton.textContent =
                "Sending...";
        }

        try {

            let imageUrl = "";
            let videoUrl = "";

            if (selectedImage) {

                imageUrl =
                    await uploadToCloudinary(
                        selectedImage
                    );
            }

            if (selectedVideo) {

                videoUrl =
                    await uploadToCloudinary(
                        selectedVideo
                    );
            }

            const messagesRef =
                collection(
                    db,
                    "chats",
                    chatId,
                    "messages"
                );

            await addDoc(
                messagesRef,
                {
                    senderId:
                        currentUser.uid,

                    receiverId:
                        receiverUid,

                    text,

                    image:
                        imageUrl,

                    video:
                        videoUrl,

                    audio:
                        voiceUrl || "",

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
                    participants:[
                        currentUser.uid,
                        receiverUid
                    ],

                    lastMessage:
                        text ||
                        (
                            imageUrl
                                ? "📷 Image"
                                : videoUrl
                                    ? "🎥 Video"
                                    : voiceUrl
                                        ? "🎤 Voice note"
                                        : "Message"
                        ),

                    lastImage:
                        imageUrl,

                    lastVideo:
                        videoUrl,

                    lastAudio:
                        voiceUrl || "",

                    lastTimestamp:
                        serverTimestamp(),

                    lastSenderId:
                        currentUser.uid,

                    lastReceiverId:
                        receiverUid,

                    lastDelivered:
                        false,

                    lastRead:
                        false
                },
                {
                    merge:true
                }
            );

            if (messageInput) {
                messageInput.value =
                    "";
            }

            selectedImage =
                null;

            selectedVideo =
                null;

            voiceUrl =
                "";

            if (imageInput) {
                imageInput.value =
                    "";
            }

            if (videoInput) {
                videoInput.value =
                    "";
            }

            closeMediaMenu();

            updateMediaPreview();

            requestAnimationFrame(
                () => {

                    messages.scrollTop =
                        messages.scrollHeight;
                }
            );

        } catch (error) {

            console.error(
                "Send error:",
                error
            );

            alert(
                "Unable to send message."
            );

        } finally {

            if (sendButton) {

                sendButton.disabled =
                    false;

                sendButton.textContent =
                    sendButton.dataset.oldText ||
                    "Send";
            }
        }
    }
);

// ============================================================
// BACK
// ============================================================

backBtn?.addEventListener(
    "click",
    () => {

        if (history.length > 1) {

            history.back();

        } else {

            window.location.href =
                "home.html";
        }
    }
);

// ============================================================
// BLOCK / UNBLOCK USER
// ============================================================

function createBlockButton() {

    const header =
        chatName?.closest("header") ||
        chatName?.parentElement?.parentElement ||
        chatName?.parentElement;

    if (!header) return;

    let button =
        header.querySelector(
            "#vsBlockUserBtn"
        );

    if (
        getComputedStyle(header)
            .position ===
        "static"
    ) {

        header.style.position =
            "relative";
    }

    if (!button) {

        button =
            document.createElement("button");

        button.id =
            "vsBlockUserBtn";

        button.type =
            "button";

        Object.assign(
            button.style,
            {
                position:"absolute",
                right:"7px",
                top:"50%",
                transform:"translateY(-50%)",
                width:"34px",
                height:"34px",
                border:"none",
                borderRadius:"50%",
                color:"#fff",
                cursor:"pointer",
                zIndex:"60"
            }
        );

        header.appendChild(
            button
        );
    }

    const blockedRef =
        doc(
            db,
            "users",
            currentUser.uid,
            "blocked",
            receiverUid
        );

    async function updateBlockButton() {

        try {

            const blockedSnap =
                await getDoc(
                    blockedRef
                );

            if (
                blockedSnap.exists()
            ) {

                button.textContent =
                    "🔓";

                button.title =
                    "Unblock user";

                button.setAttribute(
                    "aria-label",
                    "Unblock user"
                );

                button.style.background =
                    "rgba(34,197,94,.18)";

            } else {

                button.textContent =
                    "🚫";

                button.title =
                    "Block user";

                button.setAttribute(
                    "aria-label",
                    "Block user"
                );

                button.style.background =
                    "rgba(239,68,68,.15)";
            }

        } catch (error) {

            console.error(
                "Check block status:",
                error
            );
        }
    }

    button.onclick =
        async () => {

            try {

                const blockedSnap =
                    await getDoc(
                        blockedRef
                    );

                if (
                    blockedSnap.exists()
                ) {

                    if (
                        !confirm(
                            "Unblock this user?"
                        )
                    ) {
                        return;
                    }

                    await deleteDoc(
                        blockedRef
                    );

                    alert(
                        "User unblocked."
                    );

                } else {

                    if (
                        !confirm(
                            "Block this user?"
                        )
                    ) {
                        return;
                    }

                    await setDoc(
                        blockedRef,
                        {
                            blockedUid:
                                receiverUid,

                            createdAt:
                                serverTimestamp()
                        }
                    );

                    alert(
                        "User blocked."
                    );
                }

                await updateBlockButton();

            } catch (error) {

                console.error(
                    "Block/unblock error:",
                    error
                );

                alert(
                    "Unable to update block status."
                );
            }
        };

    updateBlockButton();
}

// ============================================================
// CALL BUTTONS
// ============================================================

function createCallButtons() {

    const header =
        chatName?.closest("header") ||
        chatName?.parentElement?.parentElement ||
        chatName?.parentElement;

    if (!header) return;

    if (
        header.querySelector(
            "#vsCallControls"
        )
    ) {
        return;
    }

    if (
        getComputedStyle(header)
            .position ===
        "static"
    ) {

        header.style.position =
            "relative";
    }

    const controls =
        document.createElement("div");

    controls.id =
        "vsCallControls";

    controls.className =
        "vs-call-controls";

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

    header.appendChild(
        controls
    );

    document
        .getElementById(
            "vsVoiceCallBtn"
        )
        ?.addEventListener(
            "click",
            () => startCall("voice")
        );

    document
        .getElementById(
            "vsVideoCallBtn"
        )
        ?.addEventListener(
            "click",
            () => startCall("video")
        );
}

// ============================================================
// CALL SCREEN
// ============================================================

function createCallScreen(type) {

    document
        .getElementById(
            "vsCallOverlay"
        )
        ?.remove();

    const name =
        receiverData.fullName ||
        receiverData.username ||
        "VitalStar User";

    const overlay =
        document.createElement("div");

    overlay.id =
        "vsCallOverlay";

    overlay.className =
        "vs-call-overlay";

    overlay.innerHTML = `

        <div class="vs-call-top">

            <div>

                <div class="vs-call-title">
                    ${
                        type === "video"
                            ? "📹 Video call"
                            : "📞 Voice call"
                    }
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
                class="vs-call-status"
            >
                Calling...
            </div>

        </div>

        <div class="vs-call-media">

            <div
                id="vsCallAvatar"
                class="vs-call-avatar"
            >
                ${escapeHTML(
                    name.charAt(0)
                )}
            </div>

            <video
                id="vsRemoteVideo"
                class="vs-remote-video"
                autoplay
                playsinline
                style="
                    display:${
                        type === "video"
                            ? "block"
                            : "none"
                    };
                "
            ></video>

            <video
                id="vsLocalVideo"
                class="vs-local-video"
                autoplay
                muted
                playsinline
                style="
                    display:${
                        type === "video"
                            ? "block"
                            : "none"
                    };
                "
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

    document.body.appendChild(
        overlay
    );

    overlay.style.display =
        "flex";

    document
        .getElementById(
            "vsEndCall"
        )
        ?.addEventListener(
            "click",
            endCall
        );
}

function setCallStatus(text) {

    const element =
        document.getElementById(
            "vsCallStatus"
        );

    if (element) {
        element.textContent =
            text;
    }
}

// ============================================================
// WEBRTC
// ============================================================

const rtcConfiguration = {

    iceServers:[

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        }
    ]
};

async function createPeer(
    callId,
    type
) {

    const peer =
        new RTCPeerConnection(
            rtcConfiguration
        );

    const stream =
        await navigator.mediaDevices
            .getUserMedia({
                audio:true,
                video:
                    type === "video"
            });

    activeCall.localStream =
        stream;

    const localVideo =
        document.getElementById(
            "vsLocalVideo"
        );

    if (
        localVideo &&
        type === "video"
    ) {

        localVideo.srcObject =
            stream;
    }

    stream
        .getTracks()
        .forEach(
            track => {

                peer.addTrack(
                    track,
                    stream
                );
            }
        );

    peer.ontrack =
        event => {

            const remoteStream =
                event.streams[0];

            const remoteVideo =
                document.getElementById(
                    "vsRemoteVideo"
                );

            const remoteAudio =
                document.getElementById(
                    "vsRemoteAudio"
                );

            if (
                remoteVideo &&
                type === "video"
            ) {

                remoteVideo.srcObject =
                    remoteStream;
            }

            if (remoteAudio) {

                remoteAudio.srcObject =
                    remoteStream;
            }

            document
                .getElementById(
                    "vsCallAvatar"
                )
                ?.remove();
        };

    peer.onicecandidate =
        async event => {

            if (!event.candidate) {
                return;
            }

            try {

                await addDoc(
                    collection(
                        db,
                        "calls",
                        callId,
                        "candidates"
                    ),
                    {
                        senderId:
                            currentUser.uid,

                        candidate:
                            event.candidate.toJSON()
                    }
                );

            } catch (error) {

                console.error(
                    "ICE error:",
                    error
                );
            }
        };

    peer.onconnectionstatechange =
        () => {

            if (
                peer.connectionState ===
                "connected"
            ) {

                setCallStatus(
                    "Connected"
                );
            }

            if (
                peer.connectionState ===
                    "failed" ||
                peer.connectionState ===
                    "disconnected"
            ) {

                setCallStatus(
                    "Connection lost"
                );
            }
        };

    return peer;
}

// ============================================================
// ICE LISTENER
// ============================================================

function listenForCandidates(
    callId,
    peer
) {

    if (activeCandidateListener) {

        activeCandidateListener();
    }

    const candidates =
        collection(
            db,
            "calls",
            callId,
            "candidates"
        );

    activeCandidateListener =
        onSnapshot(
            candidates,
            async snapshot => {

                for (
                    const change
                    of snapshot.docChanges()
                ) {

                    if (
                        change.type !==
                        "added"
                    ) {
                        continue;
                    }

                    const data =
                        change.doc.data();

                    if (
                        data.senderId ===
                        currentUser.uid
                    ) {
                        continue;
                    }

                    if (
                        !data.candidate
                    ) {
                        continue;
                    }

                    try {

                        const candidate =
                            new RTCIceCandidate(
                                data.candidate
                            );

                        if (
                            peer.remoteDescription
                        ) {

                            await peer
                                .addIceCandidate(
                                    candidate
                                );

                        } else if (
                            activeCall
                        ) {

                            activeCall
                                .pendingCandidates
                                .push(
                                    candidate
                                );
                        }

                    } catch (error) {

                        console.error(
                            "Remote ICE:",
                            error
                        );
                    }
                }

                if (
                    peer.remoteDescription &&
                    activeCall?.pendingCandidates
                        ?.length
                ) {

                    for (
                        const candidate
                        of activeCall.pendingCandidates
                    ) {

                        try {

                            await peer
                                .addIceCandidate(
                                    candidate
                                );

                        } catch {}
                    }

                    activeCall
                        .pendingCandidates = [];
                }
            }
        );
}

// ============================================================
// START CALL
// ============================================================

async function startCall(type) {

    if (activeCall) {

        alert(
            "You are already in a call."
        );

        return;
    }

    if (
        !window.RTCPeerConnection ||
        !navigator.mediaDevices
    ) {

        alert(
            "Calling is not supported on this browser."
        );

        return;
    }

    const callId =
        randomId();

    activeCall = {

        callId,

        type,

        pendingCandidates:[],

        pc:null,

        localStream:null
    };

    createCallScreen(
        type
    );

    setCallStatus(
        "Calling..."
    );

    const callRef =
        doc(
            db,
            "calls",
            callId
        );

    try {

        await setDoc(
            callRef,
            {
                callerId:
                    currentUser.uid,

                receiverId:
                    receiverUid,

                type,

                status:
                    "ringing",

                createdAt:
                    serverTimestamp()
            }
        );

        const peer =
            await createPeer(
                callId,
                type
            );

        activeCall.pc =
            peer;

        listenForCandidates(
            callId,
            peer
        );

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(
            offer
        );

        await updateDoc(
            callRef,
            {
                offer:
                    peer.localDescription
                        .toJSON()
            }
        );

        activeCallListener =
            onSnapshot(
                callRef,
                async snapshot => {

                    if (
                        !snapshot.exists()
                    ) {
                        return;
                    }

                    const data =
                        snapshot.data();

                    if (
                        data.answer &&
                        !peer.currentRemoteDescription
                    ) {

                        await peer
                            .setRemoteDescription(
                                new RTCSessionDescription(
                                    data.answer
                                )
                            );

                        setCallStatus(
                            "Connecting..."
                        );

                        if (
                            activeCall
                                .pendingCandidates
                                .length
                        ) {

                            for (
                                const candidate
                                of activeCall.pendingCandidates
                            ) {

                                try {

                                    await peer
                                        .addIceCandidate(
                                            candidate
                                        );

                                } catch {}
                            }

                            activeCall
                                .pendingCandidates = [];
                        }
                    }

                    if (
                        data.status ===
                        "declined"
                    ) {

                        setCallStatus(
                            "Call declined"
                        );

                        setTimeout(
                            cleanupCall,
                            1000
                        );
                    }

                    if (
                        data.status ===
                        "ended"
                    ) {

                        cleanupCall();
                    }
                }
            );

        setTimeout(
            async () => {

                if (
                    activeCall &&
                    activeCall.callId ===
                    callId
                ) {

                    try {

                        await updateDoc(
                            callRef,
                            {
                                status:
                                    "ended"
                            }
                        );

                    } catch {}

                    cleanupCall();
                }

            },
            60000
        );

    } catch (error) {

        console.error(
            "Start call error:",
            error
        );

        alert(
            "Unable to start the call. Check microphone/camera permission and Firebase permissions."
        );

        cleanupCall();
    }
}

// ============================================================
// INCOMING CALL LISTENER
// ============================================================

function setupIncomingCalls() {

    const calls =
        collection(
            db,
            "calls"
        );

    const incomingQuery =
        query(
            calls,
            where(
                "receiverId",
                "==",
                currentUser.uid
            )
        );

    unsubscribeIncomingCalls =
        onSnapshot(
            incomingQuery,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        change => {

                            if (
                                change.type !==
                                    "added" &&
                                change.type !==
                                    "modified"
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

                            if (
                                data.status !==
                                "ringing"
                            ) {
                                return;
                            }

                            if (
                                !data.offer
                            ) {
                                return;
                            }

                            if (
                                activeCall
                            ) {
                                return;
                            }

                            showIncomingCall(
                                change.doc.id,
                                data
                            );
                        }
                    );
            },
            error => {

                console.error(
                    "Incoming calls:",
                    error
                );
            }
        );
}

// ============================================================
// INCOMING CALL UI
// ============================================================

async function showIncomingCall(
    callId,
    data
) {

    if (
        document.querySelector(
            ".vs-incoming-call"
        )
    ) {
        return;
    }

    let callerName =
        "VitalStar User";

    try {

        const callerSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    data.callerId
                )
            );

        if (callerSnap.exists()) {

            const caller =
                callerSnap.data();

            callerName =
                caller.fullName ||
                caller.username ||
                "VitalStar User";
        }

    } catch {}

    const box =
        document.createElement("div");

    box.className =
        "vs-incoming-call";

    box.innerHTML = `

        <div style="
            font-size:42px;
            margin-bottom:10px;
        ">
            ${
                data.type === "video"
                    ? "📹"
                    : "📞"
            }
        </div>

        <div style="
            font-size:19px;
            font-weight:900;
        ">
            Incoming ${
                data.type === "video"
                    ? "video"
                    : "voice"
            } call
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
                id="vsDeclineCall"
                type="button"
            >
                Decline
            </button>

            <button
                class="vs-accept"
                id="vsAcceptCall"
                type="button"
            >
                Accept
            </button>

        </div>
    `;

    document.body.appendChild(
        box
    );

    document
        .getElementById(
            "vsDeclineCall"
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

                } catch {}

                box.remove();
            }
        );

    document
        .getElementById(
            "vsAcceptCall"
        )
        ?.addEventListener(
            "click",
            () => {

                box.remove();

                acceptCall(
                    callId,
                    data
                );
            }
        );
}

// ============================================================
// ACCEPT CALL
// ============================================================

async function acceptCall(
    callId,
    data
) {

    if (activeCall) {
        return;
    }

    activeCall = {

        callId,

        type:
            data.type,

        pendingCandidates:[],

        pc:null,

        localStream:null
    };

    createCallScreen(
        data.type
    );

    setCallStatus(
        "Connecting..."
    );

    try {

        const callRef =
            doc(
                db,
                "calls",
                callId
            );

        const peer =
            await createPeer(
                callId,
                data.type
            );

        activeCall.pc =
            peer;

        listenForCandidates(
            callId,
            peer
        );

        await peer
            .setRemoteDescription(
                new RTCSessionDescription(
                    data.offer
                )
            );

        if (
            activeCall.pendingCandidates
                .length
        ) {

            for (
                const candidate
                of activeCall.pendingCandidates
            ) {

                try {

                    await peer
                        .addIceCandidate(
                            candidate
                        );

                } catch {}
            }

            activeCall
                .pendingCandidates = [];
        }

        const answer =
            await peer.createAnswer();

        await peer.setLocalDescription(
            answer
        );

        await updateDoc(
            callRef,
            {
                answer:
                    peer.localDescription
                        .toJSON(),

                status:
                    "accepted"
            }
        );

        activeCallListener =
            onSnapshot(
                callRef,
                snapshot => {

                    if (
                        !snapshot.exists()
                    ) {
                        return;
                    }

                    if (
                        snapshot.data()
                            .status ===
                        "ended"
                    ) {

                        cleanupCall();
                    }
                }
            );

    } catch (error) {

        console.error(
            "Accept call error:",
            error
        );

        try {

            await updateDoc(
                doc(
                    db,
                    "calls",
                    callId
                ),
                {
                    status:
                        "ended"
                }
            );

        } catch {}

        cleanupCall();

        alert(
            "Unable to answer the call."
        );
    }
}

// ============================================================
// END CALL
// ============================================================

async function endCall() {

    if (!activeCall) {
        return;
    }

    try {

        await updateDoc(
            doc(
                db,
                "calls",
                activeCall.callId
            ),
            {
                status:
                    "ended"
            }
        );

    } catch {}

    cleanupCall();
}

// ============================================================
// CLEANUP CALL
// ============================================================

function cleanupCall() {

    if (activeCall?.pc) {

        try {
            activeCall.pc.close();
        } catch {}
    }

    if (activeCall?.localStream) {

        activeCall.localStream
            .getTracks()
            .forEach(
                track => {

                    try {
                        track.stop();
                    } catch {}
                }
            );
    }

    if (activeCallListener) {

        activeCallListener();

        activeCallListener =
            null;
    }

    if (activeCandidateListener) {

        activeCandidateListener();

        activeCandidateListener =
            null;
    }

    document
        .getElementById(
            "vsCallOverlay"
        )
        ?.remove();

    activeCall =
        null;
}

// ============================================================
// FORCE COMPOSER ABOVE FOOTER
// ============================================================

function fixComposer() {

    if (!messageForm) {
        return;
    }

    /*
     * IMPORTANT:
     * Move the composer directly into BODY.
     * This prevents position:fixed from being trapped
     * inside a transformed/positioned parent or footer.
     */

    if (
        messageForm.parentElement !==
        document.body
    ) {

        document.body.appendChild(
            messageForm
        );
    }

    function findFooter() {

        const selectors = [
            "footer",
            "#footer",
            ".footer",
            ".bottom-nav",
            "#bottomNav",
            "[data-footer]",
            ".bottom-navigation",
            "#bottom-navigation",
            ".mobile-bottom-nav"
        ];

        for (
            const selector of selectors
        ) {

            const element =
                document.querySelector(
                    selector
                );

            if (!element) {
                continue;
            }

            const style =
                getComputedStyle(
                    element
                );

            if (
                style.position === "fixed" ||
                style.position === "sticky"
            ) {
                return element;
            }
        }

        return null;
    }

    function updateComposer() {

        const footer =
            findFooter();

        let footerHeight = 0;
        let footerFixed = false;

        if (footer) {

            const rect =
                footer.getBoundingClientRect();

            const style =
                getComputedStyle(
                    footer
                );

            footerHeight =
                Math.max(
                    0,
                    rect.height
                );

            footerFixed =
                style.position ===
                    "fixed" ||
                style.position ===
                    "sticky";
        }

        messageForm.style.setProperty(
            "position",
            "fixed",
            "important"
        );

        messageForm.style.setProperty(
            "left",
            "0px",
            "important"
        );

        messageForm.style.setProperty(
            "right",
            "0px",
            "important"
        );

        messageForm.style.setProperty(
            "width",
            "100%",
            "important"
        );

        messageForm.style.setProperty(
            "bottom",
            footerFixed
                ? `${footerHeight + 4}px`
                : "0px",
            "important"
        );

        messageForm.style.setProperty(
            "z-index",
            "2147483646",
            "important"
        );

        messageForm.style.setProperty(
            "display",
            "flex",
            "important"
        );

        messageForm.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        messageForm.style.setProperty(
            "opacity",
            "1",
            "important"
        );

        messageForm.style.setProperty(
            "margin",
            "0",
            "important"
        );

        messageForm.style.setProperty(
            "box-sizing",
            "border-box",
            "important"
        );

        const formHeight =
            messageForm
                .getBoundingClientRect()
                .height;

        if (messages) {

            const bottomSpace =
                formHeight +
                (footerFixed
                    ? footerHeight
                    : 0) +
                50;

            messages.style.setProperty(
                "padding-bottom",
                `${bottomSpace}px`,
                "important"
            );

            messages.style.setProperty(
                "scroll-padding-bottom",
                `${bottomSpace}px`,
                "important"
            );
        }
    }

    updateComposer();

    requestAnimationFrame(
        updateComposer
    );

    setTimeout(
        updateComposer,
        300
    );

    setTimeout(
        updateComposer,
        1000
    );

    window.addEventListener(
        "resize",
        updateComposer
    );

    window.addEventListener(
        "orientationchange",
        () => {
            setTimeout(
                updateComposer,
                200
            );
        }
    );

    if (window.visualViewport) {

        window.visualViewport.addEventListener(
            "resize",
            updateComposer
        );

        window.visualViewport.addEventListener(
            "scroll",
            updateComposer
        );
    }

    if (window.ResizeObserver) {

        const observer =
            new ResizeObserver(
                updateComposer
            );

        observer.observe(
            messageForm
        );

        const footer =
            findFooter();

        if (footer) {

            observer.observe(
                footer
            );
        }
    }
}

// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (activeCall) {

            updateDoc(
                doc(
                    db,
                    "calls",
                    activeCall.callId
                ),
                {
                    status:
                        "ended"
                }
            ).catch(() => {});
        }

        if (unsubscribeMessages) {
            unsubscribeMessages();
        }

        if (unsubscribeStatus) {
            unsubscribeStatus();
        }

        if (unsubscribeIncomingCalls) {
            unsubscribeIncomingCalls();
        }
    }
);