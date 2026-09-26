// ============================================================
// VITALSTAR — chat.js
// Handles:
// - Full-screen VS loading screen
// - Beautiful modern chat UI
// - Chat messages
// - Image/video preview
// - Image/video uploads
// - Voice notes
// - Sending state
// - Message read/delivered status
// - Delete own messages
// - Block / unblock user
// - Real-time online status
// - Real last seen time
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
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// FULL-SCREEN VITALSTAR LOADER
// ============================================================

const vitalStarChatLoader =
    document.createElement("div");

vitalStarChatLoader.id =
    "vitalStarChatLoader";

vitalStarChatLoader.innerHTML = `
    <div class="vs-chat-loader-content">

        <div class="vs-chat-spinner">
            <span>VS</span>
        </div>

        <div class="vs-chat-loading-text">
            Loading Chat...
        </div>

    </div>
`;

const vitalStarChatLoaderStyle =
    document.createElement("style");

vitalStarChatLoaderStyle.textContent = `

#vitalStarChatLoader {
    position: fixed;
    inset: 0;
    z-index: 999999;
    background:
        radial-gradient(
            circle at center,
            #17103d 0%,
            #090616 48%,
            #03020a 100%
        );

    display: flex;
    align-items: center;
    justify-content: center;

    opacity: 1;
    visibility: visible;

    transition:
        opacity 0.55s ease,
        visibility 0.55s ease;
}

#vitalStarChatLoader.hide {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.vs-chat-loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.vs-chat-spinner {
    width: 90px;
    height: 90px;

    border-radius: 50%;

    border:
        5px solid
        rgba(255,255,255,0.10);

    border-top-color: #FFD54F;
    border-right-color: #9C4DFF;
    border-bottom-color: #7C4DFF;

    display: flex;
    align-items: center;
    justify-content: center;

    animation:
        vsChatRotate
        1s linear infinite;

    box-shadow:
        0 0 18px
        rgba(255,213,79,0.25),

        0 0 35px
        rgba(124,77,255,0.18);
}

.vs-chat-spinner span {
    font-size: 25px;
    font-weight: 900;
    letter-spacing: 2px;

    color: #FFD54F;

    text-shadow:
        0 0 12px
        rgba(255,213,79,0.45);

    animation:
        vsChatCounterRotate
        1s linear infinite;
}

.vs-chat-loading-text {
    margin-top: 18px;

    color:
        rgba(255,255,255,0.88);

    font-size: 14px;
    font-weight: 600;

    letter-spacing: 0.5px;
}

@keyframes vsChatRotate {

    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }

}

@keyframes vsChatCounterRotate {

    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(-360deg);
    }

}

`;

document.head.appendChild(
    vitalStarChatLoaderStyle
);

document.body.appendChild(
    vitalStarChatLoader
);


let chatLoaderHidden = false;

function hideChatLoader() {

    if (chatLoaderHidden) return;

    chatLoaderHidden = true;

    const loader =
        document.getElementById(
            "vitalStarChatLoader"
        );

    if (!loader) return;

    loader.classList.add("hide");

    setTimeout(() => {
        loader.remove();
    }, 650);
}


// ============================================================
// HTML ELEMENTS
// ============================================================

const backBtn =
    document.getElementById("backBtn");

const chatAvatar =
    document.getElementById("chatAvatar");

const chatName =
    document.getElementById("chatName");

const chatStatus =
    document.getElementById("chatStatus");

const messages =
    document.getElementById("messages");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const imageInput =
    document.getElementById("imageInput");

const videoInput =
    document.getElementById("videoInput");

const imageBtn =
    document.getElementById("imageBtn");

const videoBtn =
    document.getElementById("videoBtn");

const recordBtn =
    document.getElementById("recordBtn");


// ============================================================
// GET RECEIVER UID
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const receiverUid =
    params.get("uid");


// ============================================================
// BACK BUTTON
// ============================================================

if (backBtn) {

    backBtn.onclick = () => {
        history.back();
    };

}


// ============================================================
// CHAT UI STYLE
// ============================================================

const modernChatStyle =
    document.createElement("style");

modernChatStyle.textContent = `

/* =========================================================
   CHAT HEADER
   ========================================================= */

#chatStatus {
    transition:
        color .25s ease,
        opacity .25s ease;
}

.vs-online-dot {
    display: inline-block;

    width: 8px;
    height: 8px;

    margin-right: 5px;

    border-radius: 50%;

    background: #35e889;

    box-shadow:
        0 0 8px
        rgba(53,232,137,.75);
}

.vs-offline-dot {
    display: inline-block;

    width: 8px;
    height: 8px;

    margin-right: 5px;

    border-radius: 50%;

    background: #888;
}


/* =========================================================
   ATTACHMENT BUTTON
   ========================================================= */

.vs-attachment-wrapper {
    position: relative;

    display: flex;
    align-items: center;

    flex-shrink: 0;
}

.vs-attachment-button {
    width: 42px;
    height: 42px;

    border: none;
    border-radius: 50%;

    background:
        linear-gradient(
            135deg,
            #7c4dff,
            #9c4dff
        );

    color: white;

    font-size: 25px;
    font-weight: 700;

    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    box-shadow:
        0 5px 18px
        rgba(124,77,255,.35);

    transition:
        transform .2s ease,
        box-shadow .2s ease;
}

.vs-attachment-button:active {
    transform: scale(.9);
}

.vs-attachment-button.active {
    transform: rotate(45deg);
}

.vs-attachment-menu {
    position: absolute;

    left: 0;
    bottom: 52px;

    width: 190px;

    padding: 7px;

    background:
        rgba(20,16,35,.98);

    border:
        1px solid
        rgba(255,255,255,.10);

    border-radius: 17px;

    box-shadow:
        0 18px 45px
        rgba(0,0,0,.45);

    backdrop-filter:
        blur(18px);

    display: none;

    z-index: 9999;

    animation:
        vsAttachmentOpen
        .18s ease;
}

.vs-attachment-menu.show {
    display: block;
}

@keyframes vsAttachmentOpen {

    from {
        opacity: 0;
        transform:
            translateY(8px)
            scale(.96);
    }

    to {
        opacity: 1;
        transform:
            translateY(0)
            scale(1);
    }

}

.vs-attachment-item {
    width: 100%;

    border: none;

    background: transparent;

    color: white;

    padding: 11px;

    border-radius: 12px;

    display: flex;
    align-items: center;

    gap: 12px;

    cursor: pointer;

    text-align: left;

    font-size: 14px;

    transition:
        background .18s ease;
}

.vs-attachment-item:hover {
    background:
        rgba(255,255,255,.08);
}

.vs-attachment-icon {
    width: 35px;
    height: 35px;

    border-radius: 11px;

    display: flex;
    align-items: center;
    justify-content: center;

    background:
        rgba(124,77,255,.18);

    font-size: 18px;
}


/* =========================================================
   MESSAGE DESIGN
   ========================================================= */

.message {
    position: relative;

    animation:
        vsMessageIn
        .18s ease;
}

@keyframes vsMessageIn {

    from {
        opacity: 0;
        transform:
            translateY(5px);
    }

    to {
        opacity: 1;
        transform:
            translateY(0);
    }

}

.message.sent {
    position: relative;
}

.message.received {
    position: relative;
}

.message p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}


/* =========================================================
   MESSAGE ACTION BUTTON
   ========================================================= */

.vs-message-more {
    position: absolute;

    top: 4px;
    right: -35px;

    width: 28px;
    height: 28px;

    border: none;
    border-radius: 50%;

    background:
        rgba(30,30,40,.92);

    color: white;

    font-size: 18px;

    cursor: pointer;

    display: flex;
    align-items: center;
    justify-content: center;

    opacity: .65;

    transition:
        opacity .2s ease,
        transform .2s ease;
}

.vs-message-more:hover {
    opacity: 1;
    transform: scale(1.05);
}


/* =========================================================
   MESSAGE ACTION MENU
   ========================================================= */

.vs-message-actions {
    position: absolute;

    right: -5px;
    top: 35px;

    min-width: 125px;

    background:
        rgba(25,21,36,.98);

    border:
        1px solid
        rgba(255,255,255,.10);

    border-radius: 12px;

    padding: 5px;

    box-shadow:
        0 15px 35px
        rgba(0,0,0,.45);

    z-index: 5000;
}

.vs-message-action {
    width: 100%;

    border: none;

    background: transparent;

    color: white;

    padding: 10px 12px;

    border-radius: 8px;

    text-align: left;

    cursor: pointer;
}

.vs-message-action:hover {
    background:
        rgba(255,255,255,.08);
}

.vs-message-action.delete {
    color: #ff6978;
}


/* =========================================================
   BLOCK MENU
   ========================================================= */

.vs-chat-options {
    position: absolute;

    top: 55px;
    right: 12px;

    width: 170px;

    padding: 6px;

    background:
        rgba(20,16,35,.98);

    border:
        1px solid
        rgba(255,255,255,.10);

    border-radius: 14px;

    box-shadow:
        0 15px 40px
        rgba(0,0,0,.45);

    display: none;

    z-index: 10000;
}

.vs-chat-options.show {
    display: block;

    animation:
        vsAttachmentOpen
        .18s ease;
}

.vs-chat-option {
    width: 100%;

    border: none;

    background: transparent;

    color: white;

    padding: 11px 12px;

    border-radius: 9px;

    text-align: left;

    cursor: pointer;
}

.vs-chat-option:hover {
    background:
        rgba(255,255,255,.08);
}

.vs-chat-option.block {
    color: #ff6978;
}


/* =========================================================
   BLOCKED CHAT
   ========================================================= */

.vs-blocked-message {
    width: 100%;

    box-sizing: border-box;

    text-align: center;

    padding: 12px 15px;

    margin-bottom: 5px;

    color: #ff8995;

    font-size: 13px;

    background:
        rgba(255,80,100,.08);

    border-top:
        1px solid
        rgba(255,80,100,.12);
}


/* =========================================================
   SENDING STATUS
   ========================================================= */

#messageSendingStatus {
    animation:
        vsPulse
        1.2s ease-in-out infinite;
}

@keyframes vsPulse {

    0%,
    100% {
        opacity: .55;
    }

    50% {
        opacity: 1;
    }

}


/* =========================================================
   DELETE CONFIRMATION
   ========================================================= */

.vs-delete-overlay {
    position: fixed;

    inset: 0;

    z-index: 100000;

    background:
        rgba(0,0,0,.68);

    display: none;

    align-items: center;
    justify-content: center;

    padding: 20px;
}

.vs-delete-box {
    width: min(340px, 100%);

    background:
        #181522;

    color: white;

    border-radius: 20px;

    padding: 22px;

    box-shadow:
        0 25px 70px
        rgba(0,0,0,.55);
}

.vs-delete-box h3 {
    margin:
        0 0 8px;
}

.vs-delete-box p {
    margin:
        0;

    opacity: .7;

    font-size: 14px;

    line-height: 1.5;
}

.vs-delete-buttons {
    display: flex;

    gap: 10px;

    margin-top: 20px;
}

.vs-delete-buttons button {
    flex: 1;

    border: none;

    border-radius: 11px;

    padding: 11px;

    cursor: pointer;
}

.vs-delete-cancel {
    background: #30303a;
    color: white;
}

.vs-delete-confirm {
    background: #e53955;
    color: white;
}


/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 600px) {

    .vs-message-more {
        right: -31px;
    }

    .message.received
    .vs-message-more {
        left: -31px;
        right: auto;
    }

    .vs-attachment-menu {
        width: 175px;
    }

}

`;

document.head.appendChild(
    modernChatStyle
);


// ============================================================
// CREATE MEDIA PREVIEW AREA
// ============================================================

const mediaPreview =
    document.createElement("div");

mediaPreview.id =
    "chatMediaPreview";

mediaPreview.style.display =
    "none";

mediaPreview.style.width =
    "100%";

mediaPreview.style.margin =
    "8px 0";

mediaPreview.style.textAlign =
    "left";

mediaPreview.style.minHeight =
    "0";

if (messageForm) {

    messageForm.parentNode.insertBefore(
        mediaPreview,
        messageForm
    );

}


// ============================================================
// CREATE SENDING STATUS
// ============================================================

const sendingStatus =
    document.createElement("div");

sendingStatus.id =
    "messageSendingStatus";

sendingStatus.style.display =
    "none";

sendingStatus.style.textAlign =
    "center";

sendingStatus.style.fontSize =
    "13px";

sendingStatus.style.fontWeight =
    "bold";

sendingStatus.style.color =
    "#1877f2";

sendingStatus.style.padding =
    "6px";

if (messageForm) {

    messageForm.parentNode.insertBefore(
        sendingStatus,
        messageForm
    );

}


// ============================================================
// FIND SEND BUTTON
// ============================================================

let sendButton =
    messageForm?.querySelector(
        'button[type="submit"]'
    );


// ============================================================
// SENDING STATE
// ============================================================

function setSendingState(isSending) {

    if (sendButton) {

        sendButton.disabled =
            isSending;

        if (isSending) {

            sendButton.dataset.originalText =
                sendButton.textContent;

            sendButton.textContent =
                "⏳ Sending...";

        } else {

            sendButton.textContent =
                sendButton.dataset.originalText ||
                "Send";
        }
    }

    sendingStatus.style.display =
        isSending
            ? "block"
            : "none";

    sendingStatus.textContent =
        isSending
            ? "Uploading, please wait..."
            : "";
}


// ============================================================
// CLEAR MEDIA PREVIEW
// ============================================================

function clearMediaPreview() {

    mediaPreview.innerHTML =
        "";

    mediaPreview.style.display =
        "none";
}


// ============================================================
// IMAGE PREVIEW
// ============================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        () => {

            const file =
                imageInput.files[0];

            if (!file) return;

            if (videoInput) {

                videoInput.value =
                    "";
            }

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

            image.style.display =
                "block";

            mediaPreview.appendChild(
                image
            );

            mediaPreview.style.display =
                "block";

        }
    );

}


// ============================================================
// VIDEO PREVIEW
// ============================================================

if (videoInput) {

    videoInput.addEventListener(
        "change",
        () => {

            const file =
                videoInput.files[0];

            if (!file) return;

            if (imageInput) {

                imageInput.value =
                    "";
            }

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

            video.style.display =
                "block";

            mediaPreview.appendChild(
                video
            );

            mediaPreview.style.display =
                "block";

        }
    );

}


// ============================================================
// CLOUDINARY UPLOAD
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
                method: "POST",
                body: formData
            }
        );

    const data =
        await response.json();

    console.log(data);

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
// CREATE ATTACHMENT MENU
// ============================================================

let attachmentWrapper = null;
let attachmentMenu = null;
let attachmentButton = null;

function createAttachmentMenu() {

    if (!messageForm) return;

    attachmentWrapper =
        document.createElement("div");

    attachmentWrapper.className =
        "vs-attachment-wrapper";


    attachmentButton =
        document.createElement("button");

    attachmentButton.type =
        "button";

    attachmentButton.className =
        "vs-attachment-button";

    attachmentButton.textContent =
        "+";


    attachmentMenu =
        document.createElement("div");

    attachmentMenu.className =
        "vs-attachment-menu";


    attachmentMenu.innerHTML = `

        <button
            type="button"
            class="vs-attachment-item"
            data-action="image">

            <span class="vs-attachment-icon">
                📷
            </span>

            <span>
                Photo
            </span>

        </button>


        <button
            type="button"
            class="vs-attachment-item"
            data-action="video">

            <span class="vs-attachment-icon">
                🎥
            </span>

            <span>
                Video
            </span>

        </button>


        <button
            type="button"
            class="vs-attachment-item"
            data-action="voice">

            <span class="vs-attachment-icon">
                🎙️
            </span>

            <span class="vs-voice-label">
                Voice note
            </span>

        </button>

    `;


    attachmentWrapper.appendChild(
        attachmentButton
    );

    attachmentWrapper.appendChild(
        attachmentMenu
    );


    if (sendButton) {

        messageForm.insertBefore(
            attachmentWrapper,
            sendButton
        );

    } else {

        messageForm.appendChild(
            attachmentWrapper
        );

    }


    attachmentButton.onclick =
        (event) => {

            event.stopPropagation();

            attachmentMenu.classList.toggle(
                "show"
            );

            attachmentButton.classList.toggle(
                "active"
            );
        };


    attachmentMenu.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    ".vs-attachment-item"
                );

            if (!button) return;

            const action =
                button.dataset.action;


            if (action === "image") {

                attachmentMenu.classList.remove(
                    "show"
                );

                attachmentButton.classList.remove(
                    "active"
                );

                imageInput?.click();

            }


            if (action === "video") {

                attachmentMenu.classList.remove(
                    "show"
                );

                attachmentButton.classList.remove(
                    "active"
                );

                videoInput?.click();

            }


            if (action === "voice") {

                if (
                    recorder &&
                    recorder.state !==
                    "inactive"
                ) {

                    stopVoiceRecording();

                } else {

                    startVoiceRecording();

                }

            }

        }
    );

}


createAttachmentMenu();


// ============================================================
// HIDE OLD MEDIA BUTTONS
// ============================================================

if (imageBtn) {

    imageBtn.style.display =
        "none";
}

if (videoBtn) {

    videoBtn.style.display =
        "none";
}

if (recordBtn) {

    recordBtn.style.display =
        "none";
}


// ============================================================
// VOICE RECORDING
// ============================================================

let recorder;

let audioChunks = [];


async function startVoiceRecording() {

    try {

        const stream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        recorder =
            new MediaRecorder(
                stream
            );

        audioChunks =
            [];


        recorder.ondataavailable =
            (event) => {

                if (
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


                const audioBlob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                "audio/webm"
                        }
                    );


                try {

                    setSendingState(
                        true
                    );


                    const url =
                        await uploadToCloudinary(
                            audioBlob
                        );


                    window.voiceUrl =
                        url;


                    alert(
                        "Voice note ready 🎤"
                    );

                } catch (error) {

                    console.error(
                        error
                    );

                    alert(
                        "Voice note upload failed."
                    );

                } finally {

                    setSendingState(
                        false
                    );
                }

            };


        recorder.start();


        const label =
            attachmentMenu?.querySelector(
                ".vs-voice-label"
            );

        if (label) {

            label.textContent =
                "⏹ Stop recording";
        }


        attachmentButton?.classList.add(
            "active"
        );


    } catch (error) {

        console.error(
            error
        );

        alert(
            "Microphone permission is required."
        );
    }

}


function stopVoiceRecording() {

    if (
        recorder &&
        recorder.state !==
        "inactive"
    ) {

        recorder.stop();
    }


    const label =
        attachmentMenu?.querySelector(
            ".vs-voice-label"
        );

    if (label) {

        label.textContent =
            "Voice note";
    }

}


// ============================================================
// CHAT ID / STATE
// ============================================================

let currentUser = null;

let currentChatId = null;

let currentMessagesRef = null;

let currentUserBlocked = false;

let receiverBlockedMe = false;


// ============================================================
// BLOCK STORAGE
// ============================================================

function blockedUserRef(uid, blockedUid) {

    return doc(
        db,
        "users",
        uid,
        "blockedUsers",
        blockedUid
    );
}


async function checkBlockStatus() {

    if (
        !currentUser ||
        !receiverUid
    ) {
        return;
    }


    try {

        const myBlock =
            await getDoc(
                blockedUserRef(
                    currentUser.uid,
                    receiverUid
                )
            );


        currentUserBlocked =
            myBlock.exists();


    } catch (error) {

        console.error(
            "My block status error:",
            error
        );

        currentUserBlocked =
            false;
    }


    try {

        const theirBlock =
            await getDoc(
                blockedUserRef(
                    receiverUid,
                    currentUser.uid
                )
            );


        receiverBlockedMe =
            theirBlock.exists();


    } catch (error) {

        console.error(
            "Receiver block status error:",
            error
        );

        receiverBlockedMe =
            false;
    }


    updateBlockedUI();
}


// ============================================================
// BLOCK / UNBLOCK UI
// ============================================================

let chatOptionsButton = null;

let chatOptionsMenu = null;


function createChatOptions() {

    if (!chatName) return;


    chatOptionsButton =
        document.createElement("button");

    chatOptionsButton.type =
        "button";

    chatOptionsButton.textContent =
        "⋮";

    chatOptionsButton.style.cssText = `

        border:none;
        background:transparent;
        color:white;
        font-size:25px;
        cursor:pointer;
        padding:5px 10px;

    `;


    chatOptionsMenu =
        document.createElement("div");

    chatOptionsMenu.className =
        "vs-chat-options";


    const header =
        chatName.parentElement;


    if (header) {

        header.style.position =
            "relative";

        header.appendChild(
            chatOptionsButton
        );

        header.appendChild(
            chatOptionsMenu
        );
    }


    chatOptionsButton.onclick =
        (event) => {

            event.stopPropagation();

            chatOptionsMenu.classList.toggle(
                "show"
            );

            updateBlockOption();
        };


    document.addEventListener(
        "click",
        () => {

            chatOptionsMenu?.classList.remove(
                "show"
            );

        }
    );

}


function updateBlockOption() {

    if (!chatOptionsMenu) return;


    chatOptionsMenu.innerHTML = `

        <button
            type="button"
            class="vs-chat-option block"
            id="vsBlockUserButton">

            ${
                currentUserBlocked
                    ? "🔓 Unblock User"
                    : "🚫 Block User"
            }

        </button>

    `;


    const blockButton =
        document.getElementById(
            "vsBlockUserButton"
        );


    if (blockButton) {

        blockButton.onclick =
            async (event) => {

                event.stopPropagation();

                if (
                    currentUserBlocked
                ) {

                    await unblockUser();

                } else {

                    await blockUser();

                }

            };
    }

}


async function blockUser() {

    if (
        !currentUser ||
        !receiverUid
    ) {
        return;
    }


    const confirmed =
        confirm(
            "Block this user? You can unblock them later."
        );


    if (!confirmed) {
        return;
    }


    try {

        await setDoc(
            blockedUserRef(
                currentUser.uid,
                receiverUid
            ),
            {
                blockedAt:
                    serverTimestamp()
            }
        );


        currentUserBlocked =
            true;


        updateBlockedUI();


        chatOptionsMenu?.classList.remove(
            "show"
        );


    } catch (error) {

        console.error(
            "Block user error:",
            error
        );

        alert(
            error.message ||
            "Unable to block this user."
        );
    }

}


async function unblockUser() {

    if (
        !currentUser ||
        !receiverUid
    ) {
        return;
    }


    try {

        await deleteDoc(
            blockedUserRef(
                currentUser.uid,
                receiverUid
            )
        );


        currentUserBlocked =
            false;


        updateBlockedUI();


        chatOptionsMenu?.classList.remove(
            "show"
        );


    } catch (error) {

        console.error(
            "Unblock user error:",
            error
        );

        alert(
            error.message ||
            "Unable to unblock this user."
        );
    }

}


// ============================================================
// BLOCKED UI
// ============================================================

let blockedNotice = null;


function updateBlockedUI() {

    const blocked =
        currentUserBlocked ||
        receiverBlockedMe;


    if (blocked) {

        if (!blockedNotice) {

            blockedNotice =
                document.createElement("div");

            blockedNotice.className =
                "vs-blocked-message";

            if (messageForm) {

                messageForm.parentNode.insertBefore(
                    blockedNotice,
                    messageForm
                );
            }
        }


        if (
            currentUserBlocked
        ) {

            blockedNotice.textContent =
                "🚫 You blocked this user. Unblock them to continue chatting.";

        } else {

            blockedNotice.textContent =
                "🚫 You cannot send messages to this user.";
        }


        if (messageForm) {

            messageForm.style.opacity =
                "0.55";
        }


        if (sendButton) {

            sendButton.disabled =
                true;
        }


        if (messageInput) {

            messageInput.disabled =
                true;

            messageInput.placeholder =
                "Messaging is unavailable";
        }


    } else {

        if (blockedNotice) {

            blockedNotice.remove();

            blockedNotice =
                null;
        }


        if (messageForm) {

            messageForm.style.opacity =
                "1";
        }


        if (messageInput) {

            messageInput.disabled =
                false;

            messageInput.placeholder =
                messageInput.dataset.originalPlaceholder ||
                "Write a message...";
        }


        if (sendButton) {

            sendButton.disabled =
                false;
        }
    }


    updateBlockOption();
}


// ============================================================
// REAL ONLINE / LAST SEEN
// ============================================================

let stopPresenceListener = null;


function formatLastSeen(timestamp) {

    if (!timestamp) {
        return "Offline";
    }


    const date =
        new Date(timestamp);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Offline";
    }


    const now =
        new Date();


    const today =
        now.toDateString() ===
        date.toDateString();


    const yesterday =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1
        ).toDateString() ===
        date.toDateString();


    const time =
        date.toLocaleTimeString(
            [],
            {
                hour:
                    "numeric",
                minute:
                    "2-digit"
            }
        );


    if (today) {

        return `Last seen today at ${time}`;

    }


    if (yesterday) {

        return `Last seen yesterday at ${time}`;

    }


    return `Last seen ${date.toLocaleDateString(
        [],
        {
            day:
                "numeric",
            month:
                "short"
        }
    )} at ${time}`;

}


function updateChatStatus(
    online,
    lastSeen
) {

    if (!chatStatus) return;


    if (online) {

        chatStatus.innerHTML = `

            <span class="vs-online-dot"></span>
            Online

        `;

        chatStatus.style.color =
            "#35e889";


    } else {

        chatStatus.innerHTML = `

            <span class="vs-offline-dot"></span>
            ${formatLastSeen(lastSeen)}

        `;

        chatStatus.style.color =
            "rgba(255,255,255,.60)";
    }

}


function listenToPresence() {

    try {

        const database =
            getDatabase();


        const presenceRef =
            ref(
                database,
                `status/${receiverUid}`
            );


        stopPresenceListener =
            onValue(
                presenceRef,
                snapshot => {

                    const status =
                        snapshot.val();


                    if (!status) {

                        updateChatStatus(
                            false,
                            null
                        );

                        return;
                    }


                    updateChatStatus(
                        status.online === true,
                        status.lastSeen
                    );

                },
                error => {

                    console.error(
                        "Presence error:",
                        error
                    );

                    updateChatStatus(
                        false,
                        null
                    );
                }
            );


    } catch (error) {

        console.error(
            "Presence setup error:",
            error
        );

        updateChatStatus(
            false,
            null
        );
    }

}


// ============================================================
// DELETE CONFIRMATION
// ============================================================

const deleteOverlay =
    document.createElement("div");

deleteOverlay.className =
    "vs-delete-overlay";


deleteOverlay.innerHTML = `

    <div class="vs-delete-box">

        <h3>
            Delete message?
        </h3>

        <p>
            This message will be permanently removed from this chat.
        </p>

        <div class="vs-delete-buttons">

            <button
                type="button"
                class="vs-delete-cancel">

                Cancel

            </button>

            <button
                type="button"
                class="vs-delete-confirm">

                Delete

            </button>

        </div>

    </div>

`;


document.body.appendChild(
    deleteOverlay
);


let messageToDelete =
    null;


function showDeleteDialog(
    messageId
) {

    messageToDelete =
        messageId;

    deleteOverlay.style.display =
        "flex";
}


function hideDeleteDialog() {

    messageToDelete =
        null;

    deleteOverlay.style.display =
        "none";
}


deleteOverlay
    .querySelector(
        ".vs-delete-cancel"
    )
    .onclick =
    hideDeleteDialog;


deleteOverlay
    .querySelector(
        ".vs-delete-confirm"
    )
    .onclick =
    async () => {

        if (!messageToDelete) {
            return;
        }


        try {

            await deleteDoc(
                doc(
                    currentMessagesRef,
                    messageToDelete
                )
            );


            hideDeleteDialog();


        } catch (error) {

            console.error(
                "Delete message error:",
                error
            );

            hideDeleteDialog();


            alert(
                error.message ||
                "Unable to delete message."
            );
        }

    };


// ============================================================
// MESSAGE MENU CLOSE
// ============================================================

document.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".vs-message-actions"
            )
            .forEach(
                menu => menu.remove()
            );

    }
);


// ============================================================
// DISPLAY MESSAGES
// ============================================================

function displayMessage(
    messageDoc,
    user
) {

    const msg =
        messageDoc.data();


    const div =
        document.createElement(
            "div"
        );


    div.className =
        msg.senderId === user.uid
            ? "message sent"
            : "message received";


    // ========================================================
    // TIME
    // ========================================================

    let messageTime =
        "";


    const date =
        msg.timestamp?.toDate?.();


    if (date) {

        messageTime =
            date.toLocaleTimeString(
                [],
                {
                    hour:
                        "numeric",
                    minute:
                        "2-digit"
                }
            );
    }


    // ========================================================
    // MESSAGE STATUS
    // ========================================================

    let status =
        "";


    if (
        msg.senderId ===
        user.uid
    ) {

        status =
            "✓ Sent";


        if (
            msg.delivered
        ) {

            status =
                "✓✓ Delivered";
        }


        if (
            msg.read
        ) {

            status =
                "✓✓ Read";
        }
    }


    // ========================================================
    // BUILD MESSAGE SAFELY
    // ========================================================

    if (msg.text) {

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            msg.text;

        div.appendChild(
            paragraph
        );
    }


    if (msg.image) {

        const image =
            document.createElement(
                "img"
            );

        image.src =
            msg.image;

        image.alt =
            "Image";

        image.loading =
            "lazy";

        image.style.maxWidth =
            "200px";

        image.style.maxHeight =
            "220px";

        image.style.objectFit =
            "contain";

        image.style.borderRadius =
            "10px";

        image.style.display =
            "block";

        div.appendChild(
            image
        );
    }


    if (msg.video) {

        const video =
            document.createElement(
                "video"
            );

        video.controls =
            true;

        video.preload =
            "metadata";

        video.style.maxWidth =
            "220px";

        video.style.maxHeight =
            "220px";

        video.style.borderRadius =
            "10px";

        video.style.display =
            "block";


        const source =
            document.createElement(
                "source"
            );

        source.src =
            msg.video;


        video.appendChild(
            source
        );


        div.appendChild(
            video
        );
    }


    if (msg.audio) {

        const audio =
            document.createElement(
                "audio"
            );

        audio.controls =
            true;

        audio.style.maxWidth =
            "230px";


        const source =
            document.createElement(
                "source"
            );

        source.src =
            msg.audio;


        audio.appendChild(
            source
        );


        div.appendChild(
            audio
        );
    }


    // ========================================================
    // MESSAGE FOOTER
    // ========================================================

    const footer =
        document.createElement(
            "div"
        );

    footer.className =
        "message-footer";


    const timeSpan =
        document.createElement(
            "span"
        );

    timeSpan.className =
        "message-time";

    timeSpan.textContent =
        messageTime;


    const statusSpan =
        document.createElement(
            "span"
        );

    statusSpan.className =
        "message-status";

    statusSpan.textContent =
        status;


    footer.appendChild(
        timeSpan
    );

    footer.appendChild(
        statusSpan
    );


    div.appendChild(
        footer
    );


    // ========================================================
    // DELETE BUTTON
    // ========================================================

    if (
        msg.senderId ===
        user.uid
    ) {

        const moreButton =
            document.createElement(
                "button"
            );


        moreButton.type =
            "button";

        moreButton.className =
            "vs-message-more";

        moreButton.textContent =
            "⋮";


        moreButton.onclick =
            (event) => {

                event.stopPropagation();


                document
                    .querySelectorAll(
                        ".vs-message-actions"
                    )
                    .forEach(
                        menu => menu.remove()
                    );


                const menu =
                    document.createElement(
                        "div"
                    );


                menu.className =
                    "vs-message-actions";


                const deleteButton =
                    document.createElement(
                        "button"
                    );


                deleteButton.type =
                    "button";

                deleteButton.className =
                    "vs-message-action delete";

                deleteButton.textContent =
                    "🗑 Delete";


                deleteButton.onclick =
                    (deleteEvent) => {

                        deleteEvent.stopPropagation();

                        menu.remove();

                        showDeleteDialog(
                            messageDoc.id
                        );
                    };


                menu.appendChild(
                    deleteButton
                );


                div.appendChild(
                    menu
                );

            };


        div.appendChild(
            moreButton
        );
    }


    messages.appendChild(
        div
    );
}


// ============================================================
// AUTHENTICATION
// ============================================================

auth.onAuthStateChanged(
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentUser =
            user;


        if (!receiverUid) {

            alert(
                "No chat recipient found."
            );

            hideChatLoader();

            return;
        }


        // ====================================================
        // CHAT ID
        // ====================================================

        currentChatId =
            user.uid < receiverUid
                ? `${user.uid}_${receiverUid}`
                : `${receiverUid}_${user.uid}`;


        // ====================================================
        // MESSAGES REFERENCE
        // ====================================================

        currentMessagesRef =
            collection(
                db,
                "chats",
                currentChatId,
                "messages"
            );


        // ====================================================
        // CREATE CHAT DOCUMENT
        // ====================================================

        try {

            await setDoc(
                doc(
                    db,
                    "chats",
                    currentChatId
                ),
                {
                    participants: [
                        user.uid,
                        receiverUid
                    ]
                },
                {
                    merge: true
                }
            );

        } catch (error) {

            console.error(
                "Chat setup error:",
                error
            );
        }


        // ====================================================
        // GET RECEIVER
        // ====================================================

        try {

            const receiverRef =
                doc(
                    db,
                    "users",
                    receiverUid
                );


            const receiverSnap =
                await getDoc(
                    receiverRef
                );


            if (
                receiverSnap.exists()
            ) {

                const data =
                    receiverSnap.data();


                chatName.textContent =
                    data.fullName ||
                    data.username ||
                    "User";


                chatName.style.cursor =
                    "pointer";


                chatName.onclick =
                    () => {

                        window.location.href =
                            `profile.html?uid=${receiverUid}`;

                    };


                chatAvatar.src =
                    data.profilePicture ||
                    "https://via.placeholder.com/50";


                chatStatus.textContent =
                    "Checking status...";
            }


        } catch (error) {

            console.error(
                "Receiver loading error:",
                error
            );
        }


        // ====================================================
        // CHAT OPTIONS
        // ====================================================

        createChatOptions();


        // ====================================================
        // BLOCK STATUS
        // ====================================================

        await checkBlockStatus();


        // ====================================================
        // REAL-TIME PRESENCE
        // ====================================================

        listenToPresence();


        // ====================================================
        // SEND MESSAGE
        // ====================================================

        if (messageForm) {

            messageForm.addEventListener(
                "submit",
                async (e) => {

                    e.preventDefault();


                    if (
                        currentUserBlocked ||
                        receiverBlockedMe
                    ) {

                        alert(
                            currentUserBlocked
                                ? "You blocked this user."
                                : "You cannot message this user."
                        );

                        return;
                    }


                    const text =
                        messageInput.value.trim();


                    let image =
                        "";

                    let video =
                        "";

                    let audio =
                        "";


                    if (
                        sendButton?.disabled
                    ) {

                        return;
                    }


                    try {

                        setSendingState(
                            true
                        );


                        // ========================================
                        // IMAGE
                        // ========================================

                        if (
                            imageInput?.files[0]
                        ) {

                            image =
                                await uploadToCloudinary(
                                    imageInput.files[0]
                                );
                        }


                        // ========================================
                        // VIDEO
                        // ========================================

                        if (
                            videoInput?.files[0]
                        ) {

                            video =
                                await uploadToCloudinary(
                                    videoInput.files[0]
                                );
                        }


                        // ========================================
                        // VOICE
                        // ========================================

                        if (
                            window.voiceUrl
                        ) {

                            audio =
                                window.voiceUrl;

                            window.voiceUrl =
                                "";
                        }


                        // ========================================
                        // CHECK EMPTY
                        // ========================================

                        if (
                            !text &&
                            !image &&
                            !video &&
                            !audio
                        ) {

                            return;
                        }


                        // ========================================
                        // ADD MESSAGE
                        // ========================================

                        await addDoc(
                            currentMessagesRef,
                            {

                                senderId:
                                    user.uid,

                                receiverId:
                                    receiverUid,

                                text:
                                    text,

                                image:
                                    image,

                                video:
                                    video,

                                audio:
                                    audio,

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


                        // ========================================
                        // CHAT PREVIEW
                        // ========================================

                        const preview =
                            text ||
                            (
                                image
                                    ? "📷 Photo"
                                    : video
                                        ? "🎥 Video"
                                        : audio
                                            ? "🎤 Voice message"
                                            : "New message"
                            );


                        // ========================================
                        // UPDATE CHAT
                        // ========================================

                        await setDoc(
                            doc(
                                db,
                                "chats",
                                currentChatId
                            ),
                            {

                                participants: [
                                    user.uid,
                                    receiverUid
                                ],

                                lastMessage:
                                    preview,

                                lastImage:
                                    image || "",

                                lastVideo:
                                    video || "",

                                lastAudio:
                                    audio || "",

                                lastTimestamp:
                                    serverTimestamp(),

                                lastSenderId:
                                    user.uid,

                                lastReceiverId:
                                    receiverUid,

                                lastDelivered:
                                    false,

                                lastRead:
                                    false

                            },
                            {
                                merge: true
                            }
                        );


                        // ========================================
                        // CLEAR FORM
                        // ========================================

                        messageInput.value =
                            "";

                        imageInput.value =
                            "";

                        videoInput.value =
                            "";

                        clearMediaPreview();


                    } catch (err) {

                        console.error(
                            "Send message error:",
                            err
                        );

                        alert(
                            err.message ||
                            "Failed to send message."
                        );


                    } finally {

                        setSendingState(
                            false
                        );

                    }

                }
            );

        }


        // ====================================================
        // DISPLAY MESSAGES
        // ====================================================

        const q =
            query(
                currentMessagesRef,

                orderBy(
                    "timestamp",
                    "desc"
                ),

                limit(15)
            );


        onSnapshot(
            q,

            async (snapshot) => {

                messages.innerHTML =
                    "";


                const messageDocs =
                    snapshot.docs.reverse();


                for (
                    const messageDoc
                    of messageDocs
                ) {

                    const msg =
                        messageDoc.data();


                    let delivered =
                        msg.delivered ||
                        false;


                    let read =
                        msg.read ||
                        false;


                    // ========================================
                    // MARK RECEIVED AS READ
                    // ========================================

                    if (
                        msg.receiverId ===
                            user.uid &&
                        (
                            !msg.delivered ||
                            !msg.read
                        )
                    ) {

                        try {

                            await updateDoc(
                                messageDoc.ref,
                                {

                                    delivered:
                                        true,

                                    read:
                                        true

                                }
                            );


                            await setDoc(
                                doc(
                                    db,
                                    "chats",
                                    currentChatId
                                ),
                                {

                                    lastDelivered:
                                        true,

                                    lastRead:
                                        true

                                },
                                {
                                    merge:
                                        true
                                }
                            );


                        } catch (error) {

                            console.error(
                                "Read status error:",
                                error
                            );

                        }


                        delivered =
                            true;

                        read =
                            true;
                    }


                    // ========================================
                    // DISPLAY MESSAGE
                    // ========================================

                    displayMessage(
                        messageDoc,
                        user
                    );

                }


                messages.scrollTop =
                    messages.scrollHeight;


                // ========================================
                // HIDE LOADER
                // ========================================

                hideChatLoader();

            },


            (error) => {

                console.error(
                    "Messages loading error:",
                    error
                );


                hideChatLoader();


                messages.innerHTML = `

                    <div
                        style="
                            text-align:center;
                            padding:20px;
                            color:#999;
                        "
                    >

                        Unable to load messages.

                    </div>

                `;

            }
        );

    }
);