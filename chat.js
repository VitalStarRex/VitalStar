// ============================================================
// VITALSTAR — CHAT.JS
// Messages + Media Menu + Voice Notes + Delete + Block/Unblock
// Last Seen + Voice Call + Video Call
// Fixed Composer Above Footer
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

let unsubscribeMessages = null;
let unsubscribeStatus = null;
let unsubscribeIncomingCalls = null;

let selectedImage = null;
let selectedVideo = null;
let voiceUrl = "";

let recorder = null;
let audioChunks = [];

let activeCall = null;
let activeCallListener = null;
let activeCandidateListener = null;

const params = new URLSearchParams(
    window.location.search
);

receiverUid = params.get("uid");

// ============================================================
// LOADER
// ============================================================

const loader = document.createElement("div");

loader.id = "vitalStarChatLoader";

loader.innerHTML = `
    <div style="
        text-align:center;
        color:#fff;
        font-family:Arial,sans-serif;
    ">
        <div style="
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
            animation:vitalStarSpin .9s linear infinite;
        ">
            VS
        </div>

        <div style="
            margin-top:15px;
            font-size:14px;
            opacity:.8;
        ">
            Loading chat...
        </div>
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

// ============================================================
// CHAT STYLE
// ============================================================

const chatStyle = document.createElement("style");

chatStyle.textContent = `

@keyframes vitalStarSpin {
    to {
        transform:rotate(360deg);
    }
}

/* ============================================================
   MESSAGE AREA
   ============================================================ */

#messages {
    padding-bottom:170px !important;
    scroll-padding-bottom:190px !important;
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

    min-height:58px !important;

    margin:0 !important;
    padding:8px 10px !important;

    box-sizing:border-box !important;

    display:flex !important;
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

    border:none;
    border-radius:50%;

    background:rgba(124,58,237,.2);

    color:#fff;

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
    background:rgba(124,58,237,.4);
    transform:rotate(45deg);
}

.vs-media-menu {
    position:absolute;

    left:0;
    bottom:52px;

    width:175px;

    padding:8px;

    border-radius:16px;

    background:rgba(22,17,31,.99);

    border:1px solid rgba(255,255,255,.12);

    box-shadow:
        0 15px 45px rgba(0,0,0,.55);

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

/* ============================================================
   PREVIEW
   ============================================================ */

#chatMediaPreview {
    position:fixed !important;

    left:10px !important;
    right:10px !important;

    bottom:65px !important;

    padding:8px !important;

    border-radius:10px;

    background:rgba(20,15,28,.97) !important;

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

    background:rgba(8,6,17,.95);

    color:#8b5cf6 !important;
}

/* ============================================================
   CALL CONTROLS
   ============================================================ */

.vs-call-controls {
    position:absolute;

    right:48px;
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

    color:#fff;

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
   DELETE
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
        right:43px;
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

    return date.toLocaleTimeString([], {
        hour:"numeric",
        minute:"2-digit"
    });
}

// ============================================================
// LAST SEEN
// ============================================================

function relativeLastSeen(value) {

    if (!value) {
        return "Last seen recently";
    }

    let time = 0;

    if (typeof value === "number") {

        time = value;

    } else if (value?.toMillis) {

        time = value.toMillis();

    } else if (value?.seconds) {

        time = value.seconds * 1000;

    } else {

        time = new Date(value).getTime();
    }

    if (!time || Number.isNaN(time)) {
        return "Last seen recently";
    }

    const difference =
        Math.max(0, Date.now() - time);

    const minute = 60000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (difference < minute) {

        const n =
            Math.max(
                1,
                Math.floor(difference / 1000)
            );

        return `Last seen ${n} second${n === 1 ? "" : "s"} ago`;
    }

    if (difference < hour) {

        const n =
            Math.floor(difference / minute);

        return `Last seen ${n} minute${n === 1 ? "" : "s"} ago`;
    }

    if (difference < day) {

        const n =
            Math.floor(difference / hour);

        return `Last seen ${n} hour${n === 1 ? "" : "s"} ago`;
    }

    if (difference < week) {

        const n =
            Math.floor(difference / day);

        return `Last seen ${n} day${n === 1 ? "" : "s"} ago`;
    }

    if (difference < month) {

        const n =
            Math.floor(difference / week);

        return `Last seen ${n} week${n === 1 ? "" : "s"} ago`;
    }

    if (difference < year) {

        const n =
            Math.floor(difference / month);

        return `Last seen ${n} month${n === 1 ? "" : "s"} ago`;
    }

    const n =
        Math.floor(difference / year);

    return `Last seen ${n} year${n === 1 ? "" : "s"} ago`;
}

// ============================================================
// MEDIA PREVIEW
// ============================================================

const mediaPreview =
    document.createElement("div");

mediaPreview.id =
    "chatMediaPreview";

mediaPreview.style.display =
    "none";

document.body.appendChild(
    mediaPreview
);

function clearMediaPreview() {

    mediaPreview.innerHTML = "";

    mediaPreview.style.display =
        "none";
}

function showImagePreview(file) {

    clearMediaPreview();

    const image =
        document.createElement("img");

    image.src =
        URL.createObjectURL(file);

    image.alt =
        "Image preview";

    image.style.width =
        "100px";

    image.style.height =
        "120px";

    image.style.objectFit =
        "cover";

    image.style.borderRadius =
        "10px";

    mediaPreview.appendChild(
        image
    );

    mediaPreview.style.display =
        "block";
}

function showVideoPreview(file) {

    clearMediaPreview();

    const video =
        document.createElement("video");

    video.src =
        URL.createObjectURL(file);

    video.controls =
        true;

    video.preload =
        "metadata";

    video.style.width =
        "100px";

    video.style.height =
        "120px";

    video.style.objectFit =
        "cover";

    video.style.borderRadius =
        "10px";

    mediaPreview.appendChild(
        video
    );

    mediaPreview.style.display =
        "block";
}

// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(file) {

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

    const data =
        await response.json();

    console.log(
        "Cloudinary:",
        data
    );

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

    toggle.className =
        "vs-media-toggle";

    toggle.textContent =
        "＋";

    toggle.title =
        "Media";

    const menu =
        document.createElement("div");

    menu.className =
        "vs-media-menu";

    // --------------------------------------------------------
    // IMAGE BUTTON
    // --------------------------------------------------------

    if (imageBtn) {

        imageBtn.textContent =
            "📷 Image";

        imageBtn.style.display =
            "flex";

        menu.appendChild(
            imageBtn
        );

    } else {

        const button =
            document.createElement("button");

        button.type =
            "button";

        button.textContent =
            "📷 Image";

        button.onclick =
            () => imageInput?.click();

        menu.appendChild(
            button
        );
    }

    // --------------------------------------------------------
    // VIDEO BUTTON
    // --------------------------------------------------------

    if (videoBtn) {

        videoBtn.textContent =
            "🎥 Video";

        videoBtn.style.display =
            "flex";

        menu.appendChild(
            videoBtn
        );

    } else {

        const button =
            document.createElement("button");

        button.type =
            "button";

        button.textContent =
            "🎥 Video";

        button.onclick =
            () => videoInput?.click();

        menu.appendChild(
            button
        );
    }

    // --------------------------------------------------------
    // VOICE BUTTON
    // --------------------------------------------------------

    if (recordBtn) {

        recordBtn.textContent =
            "🎤 Voice note";

        recordBtn.style.display =
            "flex";

        menu.appendChild(
            recordBtn
        );

    } else {

        const button =
            document.createElement("button");

        button.type =
            "button";

        button.textContent =
            "🎤 Voice note";

        button.onclick =
            startVoiceRecording;

        menu.appendChild(
            button
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
        () => {
            closeMediaMenu();
        }
    );
}

function closeMediaMenu() {

    document
        .querySelector(
            ".vs-media-menu"
        )
        ?.classList.remove("open");

    document
        .querySelector(
            ".vs-media-toggle"
        )
        ?.classList.remove("open");
}

// ============================================================
// IMAGE INPUT
// ============================================================

imageInput?.addEventListener(
    "change",
    () => {

        const file =
            imageInput.files?.[0];

        if (!file) return;

        if (videoInput) {
            videoInput.value = "";
        }

        selectedImage =
            file;

        selectedVideo =
            null;

        showImagePreview(
            file
        );

        closeMediaMenu();
    }
);

// ============================================================
// VIDEO INPUT
// ============================================================

videoInput?.addEventListener(
    "change",
    () => {

        const file =
            videoInput.files?.[0];

        if (!file) return;

        if (imageInput) {
            imageInput.value = "";
        }

        selectedVideo =
            file;

        selectedImage =
            null;

        showVideoPreview(
            file
        );

        closeMediaMenu();
    }
);

// ============================================================
// BUTTON FALLBACKS
// ============================================================

imageBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        imageInput?.click();
    }
);

videoBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        videoInput?.click();
    }
);

// ============================================================
// VOICE RECORDING
// ============================================================

async function startVoiceRecording() {

    if (
        recorder &&
        recorder.state === "recording"
    ) {

        recorder.stop();

        return;
    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio:true
                });

        audioChunks = [];

        recorder =
            new MediaRecorder(
                stream
            );

        recorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            };

        recorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                try {

                    if (recordBtn) {
                        recordBtn.textContent =
                            "⏳ Uploading...";
                    }

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

                    clearMediaPreview();

                    mediaPreview.textContent =
                        "🎤 Voice note ready";

                    mediaPreview.style.display =
                        "block";

                } catch (error) {

                    console.error(
                        "Voice upload:",
                        error
                    );

                    voiceUrl =
                        "";

                    alert(
                        error.message ||
                        "Voice note upload failed."
                    );

                } finally {

                    if (recordBtn) {
                        recordBtn.textContent =
                            "🎤 Voice note";
                    }
                }
            };

        recorder.start();

        if (recordBtn) {

            recordBtn.textContent =
                "⏹ Stop recording";
        }

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

recordBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        startVoiceRecording();
    }
);

// ============================================================
// AUTHENTICATION
// ============================================================

auth.onAuthStateChanged(
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        currentUser =
            user;

        if (
            !receiverUid ||
            receiverUid === user.uid
        ) {

            window.location.href =
                "home.html";

            return;
        }

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

            fixComposer();

            hideLoader();

        } catch (error) {

            console.error(
                "Chat initialization:",
                error
            );

            if (chatStatus) {

                chatStatus.textContent =
                    "Unable to load chat";
            }

            hideLoader();
        }
    }
);

// ============================================================
// INITIALIZE CHAT
// ============================================================

async function initializeChat() {

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

    const receiverSnap =
        await getDoc(
            doc(
                db,
                "users",
                receiverUid
            )
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

        chatName.textContent =
            name;

        chatName.style.cursor =
            "pointer";

        chatName.onclick =
            () => {

                window.location.href =
                    `profile.html?uid=${encodeURIComponent(receiverUid)}`;
            };
    }

    // --------------------------------------------------------
    // PROFILE IMAGE
    // --------------------------------------------------------

    if (chatAvatar) {

        const avatar =
            receiverData.profileImage ||
            receiverData.profilePicture ||
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

    listenToStatus();
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

                if (!chatStatus) return;

                const data =
                    snapshot.exists()
                        ? snapshot.data()
                        : {};

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
// REFRESH LAST SEEN
// ============================================================

setInterval(
    () => {

        if (!receiverUid) return;

        getDoc(
            doc(
                db,
                "status",
                receiverUid
            )
        )
            .then(snapshot => {

                if (
                    !snapshot.exists() ||
                    !chatStatus
                ) {
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

                    chatStatus.style.color =
                        "";
                }
            })
            .catch(() => {});

    },
    30000
);

// ============================================================
// MESSAGES
// ============================================================

function setupMessages() {

    const messagesRef =
        collection(
            db,
            "chats",
            chatId,
            "messages"
        );

    const q =
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
            q,
            snapshot => {

                if (!messages) return;

                messages.innerHTML =
                    "";

                const docs =
                    [...snapshot.docs]
                        .reverse();

                docs.forEach(
                    messageDoc => {

                        const msg =
                            messageDoc.data();

                        if (
                            msg.receiverId ===
                                currentUser.uid &&
                            (
                                !msg.delivered ||
                                !msg.read
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
                            msg
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
    msg
) {

    const mine =
        msg.senderId ===
        currentUser.uid;

    const div =
        document.createElement("div");

    div.className =
        mine
            ? "message sent"
            : "message received";

    let content =
        document.createElement("div");

    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    if (msg.text) {

        const text =
            document.createElement("p");

        text.textContent =
            msg.text;

        content.appendChild(
            text
        );
    }

    // --------------------------------------------------------
    // IMAGE
    // --------------------------------------------------------

    if (msg.image) {

        const image =
            document.createElement("img");

        image.src =
            msg.image;

        image.alt =
            "Image";

        image.style.maxWidth =
            "220px";

        image.style.maxHeight =
            "260px";

        image.style.objectFit =
            "contain";

        image.style.borderRadius =
            "10px";

        image.style.display =
            "block";

        image.style.cursor =
            "pointer";

        image.onclick =
            () => {

                window.open(
                    msg.image,
                    "_blank"
                );
            };

        content.appendChild(
            image
        );
    }

    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    if (msg.video) {

        const video =
            document.createElement("video");

        video.src =
            msg.video;

        video.controls =
            true;

        video.preload =
            "metadata";

        video.style.maxWidth =
            "240px";

        video.style.width =
            "100%";

        video.style.borderRadius =
            "10px";

        video.style.display =
            "block";

        content.appendChild(
            video
        );
    }

    // --------------------------------------------------------
    // AUDIO
    // --------------------------------------------------------

    if (msg.audio) {

        const audio =
            document.createElement("audio");

        audio.src =
            msg.audio;

        audio.controls =
            true;

        audio.style.maxWidth =
            "250px";

        audio.style.width =
            "100%";

        content.appendChild(
            audio
        );
    }

    // --------------------------------------------------------
    // TIME / STATUS
    // --------------------------------------------------------

    const footer =
        document.createElement("div");

    footer.className =
        "message-footer";

    footer.style.display =
        "flex";

    footer.style.alignItems =
        "center";

    footer.style.gap =
        "4px";

    footer.style.fontSize =
        "11px";

    const time =
        document.createElement("span");

    time.textContent =
        formatTime(
            msg.timestamp
        );

    footer.appendChild(
        time
    );

    if (mine) {

        const status =
            document.createElement("span");

        status.textContent =
            msg.read
                ? "✓✓ Read"
                : msg.delivered
                    ? "✓✓ Delivered"
                    : msg.sent
                        ? "✓ Sent"
                        : "";

        footer.appendChild(
            status
        );

        // ----------------------------------------------------
        // DELETE
        // ----------------------------------------------------

        const deleteButton =
            document.createElement("button");

        deleteButton.type =
            "button";

        deleteButton.className =
            "vs-delete-message";

        deleteButton.textContent =
            "Delete";

        deleteButton.onclick =
            async event => {

                event.stopPropagation();

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
                        "Delete message:",
                        error
                    );

                    alert(
                        "Unable to delete message."
                    );
                }
            };

        footer.appendChild(
            deleteButton
        );
    }

    content.appendChild(
        footer
    );

    div.appendChild(
        content
    );

    messages.appendChild(
        div
    );
}

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

        const sendButton =
            messageForm.querySelector(
                'button[type="submit"]'
            );

        if (
            sendButton?.disabled
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

        if (sendButton) {

            sendButton.disabled =
                true;

            sendButton.dataset.originalText =
                sendButton.textContent;

            sendButton.textContent =
                "⏳ Sending...";
        }

        try {

            let imageUrl = "";
            let videoUrl = "";
            let audioUrl = voiceUrl || "";

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

            await addDoc(
                collection(
                    db,
                    "chats",
                    chatId,
                    "messages"
                ),
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
                        preview,

                    lastImage:
                        imageUrl,

                    lastVideo:
                        videoUrl,

                    lastAudio:
                        audioUrl,

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

            if (imageInput) {
                imageInput.value =
                    "";
            }

            if (videoInput) {
                videoInput.value =
                    "";
            }

            selectedImage =
                null;

            selectedVideo =
                null;

            voiceUrl =
                "";

            clearMediaPreview();

            closeMediaMenu();

            requestAnimationFrame(
                () => {

                    messages.scrollTop =
                        messages.scrollHeight;
                }
            );

        } catch (error) {

            console.error(
                "Send message error:",
                error
            );

            alert(
                error.message ||
                "Failed to send message."
            );

        } finally {

            if (sendButton) {

                sendButton.disabled =
                    false;

                sendButton.textContent =
                    sendButton.dataset.originalText ||
                    "Send";
            }
        }
    }
);

// ============================================================
// BLOCK / UNBLOCK
// ============================================================

function createBlockButton() {

    const header =
        chatName?.closest("header") ||
        chatName?.parentElement?.parentElement ||
        chatName?.parentElement;

    if (!header) return;

    if (
        header.querySelector(
            "#vsBlockUserBtn"
        )
    ) {
        return;
    }

    if (
        getComputedStyle(header)
            .position === "static"
    ) {

        header.style.position =
            "relative";
    }

    const button =
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

    async function updateBlockButton() {

        try {

            const blockedSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "blocked",
                        receiverUid
                    )
                );

            if (blockedSnap.exists()) {

                button.textContent =
                    "🔓";

                button.title =
                    "Unblock user";

                button.style.background =
                    "rgba(34,197,94,.18)";

            } else {

                button.textContent =
                    "🚫";

                button.title =
                    "Block user";

                button.style.background =
                    "rgba(239,68,68,.15)";
            }

        } catch (error) {

            console.error(
                "Block status:",
                error
            );
        }
    }

    button.onclick =
        async () => {

            try {

                const blockedRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "blocked",
                        receiverUid
                    );

                const blockedSnap =
                    await getDoc(
                        blockedRef
                    );

                if (blockedSnap.exists()) {

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

                updateBlockButton();

            } catch (error) {

                console.error(
                    "Block/unblock:",
                    error
                );

                alert(
                    "Unable to update block status."
                );
            }
        };

    header.appendChild(
        button
    );

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
            .position === "static"
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

                <div style="
                    font-size:17px;
                    font-weight:800;
                ">
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

    const status =
        document.getElementById(
            "vsCallStatus"
        );

    if (status) {
        status.textContent =
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

    if (activeCall) {
        activeCall.localStream =
            stream;
    }

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

    activeCandidateListener =
        onSnapshot(
            collection(
                db,
                "calls",
                callId,
                "candidates"
            ),
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

                    if (!data.candidate) {
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
                        !snapshot.exists() ||
                        !activeCall
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
            "Start call:",
            error
        );

        alert(
            "Unable to start the call. Check microphone/camera permission and Firebase permissions."
        );

        cleanupCall();
    }
}

// ============================================================
// INCOMING CALLS
// ============================================================

function setupIncomingCalls() {

    const q =
        query(
            collection(
                db,
                "calls"
            ),
            where(
                "receiverId",
                "==",
                currentUser.uid
            )
        );

    unsubscribeIncomingCalls =
        onSnapshot(
            q,
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

                            if (!data.offer) {
                                return;
                            }

                            if (activeCall) {
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

    document.body.appendChild(
        box
    );

    box.querySelector(
        "#vsDeclineCall"
    )?.addEventListener(
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

    box.querySelector(
        "#vsAcceptCall"
    )?.addEventListener(
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

    if (activeCall) return;

    activeCall = {
        callId,
        type:data.type,
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

        await peer.setRemoteDescription(
            new RTCSessionDescription(
                data.offer
            )
        );

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
                        !snapshot.exists() ||
                        !activeCall
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
            "Accept call:",
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

    if (!activeCall) return;

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

    if (!messageForm) return;

    function updateComposer() {

        const footer =
            document.querySelector(
                "footer, #footer, .footer, .bottom-nav, #bottomNav, [data-footer], nav"
            );

        let footerHeight = 0;
        let footerIsFixed = false;

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

            footerIsFixed =
                style.position === "fixed" ||
                style.position === "sticky";
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
            "z-index",
            "2147483000",
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
            "display",
            "flex",
            "important"
        );

        messageForm.style.setProperty(
            "bottom",
            footerIsFixed
                ? `${footerHeight + 4}px`
                : "0px",
            "important"
        );

        const formHeight =
            messageForm.getBoundingClientRect()
                .height;

        if (messages) {

            const bottomSpace =
                formHeight +
                (footerIsFixed
                    ? footerHeight
                    : 0) +
                45;

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

        mediaPreview.style.bottom =
            `${formHeight + 5}px`;
    }

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
            document.querySelector(
                "footer, #footer, .footer, .bottom-nav, #bottomNav, [data-footer], nav"
            );

        if (footer) {
            observer.observe(
                footer
            );
        }
    }
}

// ============================================================
// BACK BUTTON
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