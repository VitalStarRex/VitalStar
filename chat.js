// ============================================================
// VITALSTAR CHAT.JS
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
// LOADER
// ============================================================

const loader = document.createElement("div");

loader.id = "vitalStarChatLoader";

loader.innerHTML = `
    <div class="vs-chat-loader-content">
        <div class="vs-chat-spinner">VS</div>
        <div class="vs-chat-loading-text">Loading chat...</div>
    </div>
`;

document.body.appendChild(loader);

const loaderStyle = document.createElement("style");

loaderStyle.textContent = `
#vitalStarChatLoader {
    position: fixed;
    inset: 0;
    background: #05030b;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    transition: opacity .35s ease;
}

.vs-chat-loader-content {
    text-align: center;
}

.vs-chat-spinner {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 4px solid rgba(255,255,255,.15);
    border-top-color: #00ff88;
    border-right-color: #7b2cff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
    font-weight: 900;
    animation: vsChatSpin 1s linear infinite;
    margin: auto;
}

.vs-chat-loading-text {
    color: white;
    margin-top: 15px;
    font-size: 14px;
    opacity: .8;
}

@keyframes vsChatSpin {
    to {
        transform: rotate(360deg);
    }
}

/* ============================================================
   CHAT FORM FIX
   ============================================================ */

#messageForm {
    position: relative !important;
    z-index: 100 !important;
    visibility: visible !important;
    opacity: 1 !important;
}

/* Keep the form above a fixed footer */
#messageForm,
#messageForm * {
    box-sizing: border-box;
}

/* ============================================================
   ATTACHMENT MENU
   ============================================================ */

.vs-media-wrapper {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    z-index: 200;
}

.vs-media-main-button {
    width: 42px;
    height: 42px;
    border: 0;
    border-radius: 50%;
    background: linear-gradient(135deg,#7b2cff,#00bfff);
    color: white;
    font-size: 23px;
    cursor: pointer;
}

.vs-media-menu {
    position: absolute;
    left: 0;
    bottom: 48px;
    min-width: 175px;
    padding: 7px;
    background: #171322;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px;
    box-shadow: 0 12px 35px rgba(0,0,0,.5);
    z-index: 99999;
}

.vs-media-menu button {
    display: block;
    width: 100%;
    border: 0;
    background: transparent;
    color: white;
    padding: 11px;
    border-radius: 9px;
    text-align: left;
    cursor: pointer;
}

.vs-media-menu button:hover {
    background: rgba(255,255,255,.08);
}

/* ============================================================
   CHAT OPTIONS
   ============================================================ */

.vs-chat-options {
    position: absolute;
    right: 5px;
    top: 42px;
    min-width: 170px;
    padding: 7px;
    background: #171322;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 13px;
    box-shadow: 0 12px 35px rgba(0,0,0,.5);
    z-index: 99999;
}

.vs-chat-options button {
    width: 100%;
    border: 0;
    background: transparent;
    color: white;
    padding: 11px;
    border-radius: 9px;
    text-align: left;
}

.vs-chat-options button:hover {
    background: rgba(255,255,255,.08);
}

/* ============================================================
   MESSAGE DELETE
   ============================================================ */

.vs-message-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
}

.vs-delete-message {
    border: 0;
    background: transparent;
    color: #ff7373;
    font-size: 11px;
    padding: 2px 0;
    cursor: pointer;
}

.vs-delete-message:disabled {
    opacity: .5;
    cursor: wait;
}

.vs-blocked-input {
    opacity: .7;
}

.vs-sending-status {
    display: none;
    color: #aaa;
    font-size: 12px;
    padding: 3px 8px;
}

.vs-media-preview {
    display: none;
    margin: 5px 8px;
    padding: 7px 10px;
    border-radius: 9px;
    background: rgba(255,255,255,.06);
    color: #ddd;
    font-size: 12px;
}
`;

document.head.appendChild(loaderStyle);


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


// ============================================================
// BACK BUTTON
// ============================================================

backBtn?.addEventListener("click", () => {
    window.history.back();
});


// ============================================================
// PREVIEW
// ============================================================

const mediaPreview = document.createElement("div");

mediaPreview.className = "vs-media-preview";

const sendingStatus = document.createElement("div");

sendingStatus.className = "vs-sending-status";

if (messageForm?.parentElement) {
    messageForm.parentElement.insertBefore(
        mediaPreview,
        messageForm
    );

    messageForm.parentElement.insertBefore(
        sendingStatus,
        messageForm
    );
}


// ============================================================
// SEND BUTTON
// ============================================================

const sendButton =
    messageForm?.querySelector(
        'button[type="submit"]'
    );

const originalSendText =
    sendButton?.textContent || "Send";

function setSendingState(sending) {

    if (sendButton) {
        sendButton.disabled = sending;
        sendButton.textContent =
            sending
                ? "⏳ Sending..."
                : originalSendText;
    }

    sendingStatus.style.display =
        sending
            ? "block"
            : "none";

    sendingStatus.textContent =
        sending
            ? "Sending message..."
            : "";
}


// ============================================================
// FILE PREVIEW
// ============================================================

function showFilePreview(file) {

    if (!file) {
        mediaPreview.style.display = "none";
        mediaPreview.textContent = "";
        return;
    }

    mediaPreview.style.display = "block";

    mediaPreview.textContent =
        `📎 ${file.name}`;
}


// ============================================================
// ORIGINAL INPUTS
// ============================================================

imageInput?.addEventListener(
    "change",
    () => {
        showFilePreview(
            imageInput.files?.[0]
        );
    }
);

videoInput?.addEventListener(
    "change",
    () => {
        showFilePreview(
            videoInput.files?.[0]
        );
    }
);


// ============================================================
// ATTACHMENT MENU
// ============================================================

const mediaWrapper =
    document.createElement("div");

mediaWrapper.className =
    "vs-media-wrapper";

const mediaMainButton =
    document.createElement("button");

mediaMainButton.type = "button";
mediaMainButton.className =
    "vs-media-main-button";

mediaMainButton.textContent = "＋";
mediaMainButton.title =
    "Attachments";

const mediaMenu =
    document.createElement("div");

mediaMenu.className =
    "vs-media-menu";

mediaMenu.style.display =
    "none";

const photoButton =
    document.createElement("button");

photoButton.type = "button";
photoButton.textContent =
    "🖼️ Photo";

const videoButton =
    document.createElement("button");

videoButton.type = "button";
videoButton.textContent =
    "🎥 Video";

const voiceButton =
    document.createElement("button");

voiceButton.type = "button";
voiceButton.textContent =
    "🎤 Voice note";

mediaMenu.appendChild(photoButton);
mediaMenu.appendChild(videoButton);
mediaMenu.appendChild(voiceButton);

mediaWrapper.appendChild(mediaMainButton);
mediaWrapper.appendChild(mediaMenu);


// ============================================================
// INSERT MENU WITHOUT CHANGING FORM DISPLAY
// ============================================================

if (messageForm) {

    messageForm.insertBefore(
        mediaWrapper,
        sendButton || null
    );
}

mediaMainButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        mediaMenu.style.display =
            mediaMenu.style.display === "none"
                ? "block"
                : "none";
    }
);

document.addEventListener(
    "click",
    () => {
        mediaMenu.style.display = "none";
    }
);

mediaMenu.addEventListener(
    "click",
    event => {
        event.stopPropagation();
    }
);

photoButton.addEventListener(
    "click",
    () => {
        imageInput?.click();
        mediaMenu.style.display = "none";
    }
);

videoButton.addEventListener(
    "click",
    () => {
        videoInput?.click();
        mediaMenu.style.display = "none";
    }
);


// Hide only the old visible buttons.
// The actual inputs remain available.
if (imageBtn) {
    imageBtn.style.display = "none";
}

if (videoBtn) {
    videoBtn.style.display = "none";
}

if (recordBtn) {
    recordBtn.style.display = "none";
}


// ============================================================
// VOICE RECORDING
// ============================================================

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

voiceButton.addEventListener(
    "click",
    async () => {

        mediaMenu.style.display = "none";

        if (
            mediaRecorder &&
            mediaRecorder.state === "recording"
        ) {

            mediaRecorder.stop();

            voiceButton.textContent =
                "🎤 Voice note";

            return;
        }

        try {

            recordingStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            mediaRecorder =
                new MediaRecorder(
                    recordingStream
                );

            audioChunks = [];

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

                    try {

                        const blob =
                            new Blob(
                                audioChunks,
                                {
                                    type:
                                        "audio/webm"
                                }
                            );

                        sendingStatus.style.display =
                            "block";

                        sendingStatus.textContent =
                            "Uploading voice note...";

                        const url =
                            await uploadToCloudinary(
                                blob,
                                "video"
                            );

                        window.voiceUrl =
                            url;

                        mediaPreview.style.display =
                            "block";

                        mediaPreview.textContent =
                            "🎤 Voice note ready";

                    } catch (error) {

                        console.error(
                            error
                        );

                        alert(
                            "Unable to upload voice note."
                        );

                    } finally {

                        sendingStatus.style.display =
                            "none";

                        recordingStream
                            ?.getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );
                    }
                };

            mediaRecorder.start();

            voiceButton.textContent =
                "⏹️ Stop recording";

            mediaMenu.style.display =
                "none";

        } catch (error) {

            console.error(error);

            alert(
                "Microphone permission is required."
            );
        }
    }
);


// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(
    file,
    resourceType = "auto"
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
            `https://api.cloudinary.com/v1_1/m0scmqqv/${resourceType}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

    const data =
        await response.json();

    if (
        !response.ok ||
        !data.secure_url
    ) {

        console.error(
            "Cloudinary error:",
            data
        );

        throw new Error(
            data.error?.message ||
            "Upload failed."
        );
    }

    return data.secure_url;
}


// ============================================================
// URL
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const receiverUid =
    params.get("uid");


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let chatId = null;

let blockedByMe = false;
let blockedMe = false;


// ============================================================
// LAST SEEN
// ============================================================

function formatRelativeTime(timestamp) {

    if (!timestamp) {
        return "Last seen unavailable";
    }

    let time = null;

    if (typeof timestamp === "number") {

        time = timestamp;

    } else if (timestamp instanceof Date) {

        time = timestamp.getTime();

    } else if (
        typeof timestamp?.toDate ===
        "function"
    ) {

        time =
            timestamp.toDate().getTime();

    } else if (
        typeof timestamp === "object" &&
        timestamp.seconds
    ) {

        time =
            timestamp.seconds * 1000;

    } else {

        time =
            new Date(timestamp).getTime();
    }

    if (!Number.isFinite(time)) {
        return "Last seen unavailable";
    }

    const seconds =
        Math.max(
            0,
            Math.floor(
                (Date.now() - time) / 1000
            )
        );

    if (seconds < 60) {

        return `Last seen ${seconds} ${
            seconds === 1
                ? "second"
                : "seconds"
        } ago`;
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {

        return `Last seen ${minutes} ${
            minutes === 1
                ? "minute"
                : "minutes"
        } ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {

        return `Last seen ${hours} ${
            hours === 1
                ? "hour"
                : "hours"
        } ago`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {

        return `Last seen ${days} ${
            days === 1
                ? "day"
                : "days"
        } ago`;
    }

    const weeks =
        Math.floor(days / 7);

    if (weeks < 4) {

        return `Last seen ${weeks} ${
            weeks === 1
                ? "week"
                : "weeks"
        } ago`;
    }

    const months =
        Math.floor(days / 30);

    if (months < 12) {

        return `Last seen ${months} ${
            months === 1
                ? "month"
                : "months"
        } ago`;
    }

    const years =
        Math.floor(days / 365);

    return `Last seen ${years} ${
        years === 1
            ? "year"
            : "years"
    } ago`;
}


// ============================================================
// AUTH
// ============================================================

auth.onAuthStateChanged(
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        if (!receiverUid) {

            loader.style.display =
                "none";

            return;
        }

        currentUser = user;

        chatId =
            user.uid < receiverUid
                ? `${user.uid}_${receiverUid}`
                : `${receiverUid}_${user.uid}`;

        try {

            // ==================================================
            // CHAT
            // ==================================================

            const chatRef =
                doc(
                    db,
                    "chats",
                    chatId
                );

            await setDoc(
                chatRef,
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


            // ==================================================
            // USER
            // ==================================================

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

                chatAvatar.src =
                    data.profilePicture ||
                    "https://via.placeholder.com/50";
            }


            chatName?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `profile.html?uid=${receiverUid}`;
                }
            );


            // ==================================================
            // REAL TIME PRESENCE
            // ==================================================

            const rtdb =
                getDatabase();

            const statusRef =
                ref(
                    rtdb,
                    `status/${receiverUid}`
                );

            onValue(
                statusRef,
                snapshot => {

                    const status =
                        snapshot.val();

                    if (!status) {

                        chatStatus.textContent =
                            "Last seen unavailable";

                        return;
                    }

                    if (
                        status.online === true
                    ) {

                        chatStatus.textContent =
                            "🟢 Online";

                    } else {

                        chatStatus.textContent =
                            formatRelativeTime(
                                status.lastSeen
                            );
                    }
                }
            );


            // ==================================================
            // BLOCK STATUS
            // ==================================================

            await checkBlockStatus();

            createChatOptions();


            // ==================================================
            // SEND MESSAGE
            // ==================================================

            messageForm?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    if (
                        blockedByMe ||
                        blockedMe
                    ) {

                        alert(
                            blockedByMe
                                ? "You blocked this user."
                                : "This user has blocked you."
                        );

                        return;
                    }

                    const text =
                        messageInput?.value
                            .trim() || "";

                    const imageFile =
                        imageInput
                            ?.files?.[0];

                    const videoFile =
                        videoInput
                            ?.files?.[0];

                    const voiceUrl =
                        window.voiceUrl || "";

                    if (
                        !text &&
                        !imageFile &&
                        !videoFile &&
                        !voiceUrl
                    ) {
                        return;
                    }

                    try {

                        setSendingState(true);

                        let imageUrl = "";
                        let videoUrl = "";

                        if (imageFile) {

                            imageUrl =
                                await uploadToCloudinary(
                                    imageFile,
                                    "image"
                                );
                        }

                        if (videoFile) {

                            videoUrl =
                                await uploadToCloudinary(
                                    videoFile,
                                    "video"
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
                                    user.uid,

                                receiverId:
                                    receiverUid,

                                text,

                                image:
                                    imageUrl,

                                video:
                                    videoUrl,

                                audio:
                                    voiceUrl,

                                timestamp:
                                    serverTimestamp(),

                                sent: true,

                                delivered: false,

                                read: false
                            }
                        );


                        // =========================================
                        // CHAT PREVIEW
                        // =========================================

                        let preview =
                            text;

                        if (!preview) {

                            if (imageUrl) {
                                preview =
                                    "📷 Photo";

                            } else if (
                                videoUrl
                            ) {
                                preview =
                                    "🎥 Video";

                            } else if (
                                voiceUrl
                            ) {
                                preview =
                                    "🎤 Voice note";
                            }
                        }

                        await updateDoc(
                            chatRef,
                            {
                                lastMessage:
                                    preview,

                                lastImage:
                                    imageUrl,

                                lastVideo:
                                    videoUrl,

                                lastAudio:
                                    voiceUrl,

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
                            }
                        );


                        // =========================================
                        // CLEAR
                        // =========================================

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

                        window.voiceUrl =
                            "";

                        mediaPreview.style.display =
                            "none";

                        mediaPreview.textContent =
                            "";

                    } catch (error) {

                        console.error(
                            "Send error:",
                            error
                        );

                        alert(
                            error.message ||
                            "Unable to send message."
                        );

                    } finally {

                        setSendingState(false);
                    }
                }
            );


            // ==================================================
            // LOAD MESSAGES
            // ==================================================

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
                    limit(15)
                );

            onSnapshot(
                messagesQuery,
                async snapshot => {

                    if (!messages) {
                        return;
                    }

                    messages.innerHTML =
                        "";

                    const messageDocs =
                        [...snapshot.docs]
                            .reverse();


                    // ==========================================
                    // READ / DELIVERED
                    // ==========================================

                    for (
                        const messageDoc
                        of messageDocs
                    ) {

                        const msg =
                            messageDoc.data();

                        if (
                            msg.receiverId ===
                            user.uid &&
                            (
                                !msg.read ||
                                !msg.delivered
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

                            } catch (
                                error
                            ) {

                                console.error(
                                    "Read update error:",
                                    error
                                );
                            }
                        }
                    }


                    // ==========================================
                    // DISPLAY
                    // ==========================================

                    messageDocs.forEach(
                        messageDoc => {

                            const msg =
                                messageDoc.data();

                            const messageId =
                                messageDoc.id;

                            const isSent =
                                msg.senderId ===
                                user.uid;

                            const messageDiv =
                                document.createElement(
                                    "div"
                                );

                            messageDiv.className =
                                isSent
                                    ? "message sent"
                                    : "message received";


                            const content =
                                document.createElement(
                                    "div"
                                );

                            content.className =
                                "message-content";


                            // ==================================
                            // TEXT
                            // ==================================

                            if (msg.text) {

                                const text =
                                    document.createElement(
                                        "div"
                                    );

                                text.textContent =
                                    msg.text;

                                content.appendChild(
                                    text
                                );
                            }


                            // ==================================
                            // IMAGE
                            // ==================================

                            if (msg.image) {

                                const image =
                                    document.createElement(
                                        "img"
                                    );

                                image.src =
                                    msg.image;

                                image.loading =
                                    "lazy";

                                image.style.cssText = `
                                    max-width:100%;
                                    border-radius:12px;
                                    display:block;
                                    margin-top:6px;
                                `;

                                content.appendChild(
                                    image
                                );
                            }


                            // ==================================
                            // VIDEO
                            // ==================================

                            if (msg.video) {

                                const video =
                                    document.createElement(
                                        "video"
                                    );

                                video.src =
                                    msg.video;

                                video.controls =
                                    true;

                                video.playsInline =
                                    true;

                                video.style.cssText = `
                                    max-width:100%;
                                    border-radius:12px;
                                    display:block;
                                    margin-top:6px;
                                `;

                                content.appendChild(
                                    video
                                );
                            }


                            // ==================================
                            // AUDIO
                            // ==================================

                            if (msg.audio) {

                                const audio =
                                    document.createElement(
                                        "audio"
                                    );

                                audio.src =
                                    msg.audio;

                                audio.controls =
                                    true;

                                audio.style.cssText = `
                                    max-width:100%;
                                    margin-top:6px;
                                `;

                                content.appendChild(
                                    audio
                                );
                            }


                            // ==================================
                            // META
                            // ==================================

                            const meta =
                                document.createElement(
                                    "div"
                                );

                            meta.style.cssText = `
                                display:flex;
                                align-items:center;
                                justify-content:flex-end;
                                gap:6px;
                                margin-top:5px;
                                font-size:10px;
                                opacity:.65;
                            `;

                            const time =
                                document.createElement(
                                    "span"
                                );

                            if (
                                msg.timestamp &&
                                typeof msg.timestamp
                                    .toDate ===
                                    "function"
                            ) {

                                time.textContent =
                                    msg.timestamp
                                        .toDate()
                                        .toLocaleTimeString(
                                            [],
                                            {
                                                hour:
                                                    "numeric",
                                                minute:
                                                    "2-digit"
                                            }
                                        );
                            }

                            meta.appendChild(
                                time
                            );


                            // ==================================
                            // MESSAGE STATUS
                            // ==================================

                            if (isSent) {

                                const status =
                                    document.createElement(
                                        "span"
                                    );

                                if (msg.read) {

                                    status.textContent =
                                        "✓✓";

                                    status.style.color =
                                        "#00d9ff";

                                } else if (
                                    msg.delivered
                                ) {

                                    status.textContent =
                                        "✓✓";

                                } else {

                                    status.textContent =
                                        "✓";
                                }

                                meta.appendChild(
                                    status
                                );
                            }

                            content.appendChild(
                                meta
                            );


                            // ==================================
                            // DELETE ONLY THIS MESSAGE
                            // ==================================

                            if (isSent) {

                                const actionRow =
                                    document.createElement(
                                        "div"
                                    );

                                actionRow.className =
                                    "vs-message-actions";

                                const deleteButton =
                                    document.createElement(
                                        "button"
                                    );

                                deleteButton.type =
                                    "button";

                                deleteButton.className =
                                    "vs-delete-message";

                                deleteButton.textContent =
                                    "Delete";

                                deleteButton.dataset.messageId =
                                    messageId;

                                deleteButton.addEventListener(
                                    "click",
                                    async event => {

                                        event.preventDefault();
                                        event.stopPropagation();

                                        const exactMessageId =
                                            deleteButton
                                                .dataset
                                                .messageId;

                                        if (
                                            !exactMessageId
                                        ) {
                                            return;
                                        }

                                        const confirmed =
                                            window.confirm(
                                                "Delete this message?"
                                            );

                                        if (
                                            !confirmed
                                        ) {
                                            return;
                                        }

                                        deleteButton.disabled =
                                            true;

                                        try {

                                            // IMPORTANT:
                                            // Delete ONLY the clicked
                                            // message document.
                                            const exactMessageRef =
                                                doc(
                                                    db,
                                                    "chats",
                                                    chatId,
                                                    "messages",
                                                    exactMessageId
                                                );

                                            await deleteDoc(
                                                exactMessageRef
                                            );

                                        } catch (
                                            error
                                        ) {

                                            console.error(
                                                "Delete message error:",
                                                error
                                            );

                                            alert(
                                                "Unable to delete this message."
                                            );

                                            deleteButton.disabled =
                                                false;
                                        }
                                    }
                                );

                                actionRow.appendChild(
                                    deleteButton
                                );

                                content.appendChild(
                                    actionRow
                                );
                            }


                            messageDiv.appendChild(
                                content
                            );

                            messages.appendChild(
                                messageDiv
                            );
                        }
                    );


                    // ==========================================
                    // SCROLL
                    // ==========================================

                    messages.scrollTop =
                        messages.scrollHeight;


                    // ==========================================
                    // HIDE LOADER
                    // ==========================================

                    loader.style.opacity =
                        "0";

                    setTimeout(
                        () => {
                            loader.style.display =
                                "none";
                        },
                        350
                    );
                },

                error => {

                    console.error(
                        "Messages error:",
                        error
                    );

                    messages.innerHTML = `
                        <div style="
                            color:#aaa;
                            text-align:center;
                            padding:30px;
                        ">
                            Unable to load messages.
                        </div>
                    `;

                    loader.style.display =
                        "none";
                }
            );

        } catch (error) {

            console.error(
                "Chat initialization error:",
                error
            );

            loader.style.display =
                "none";

            alert(
                error.message ||
                "Unable to open chat."
            );
        }
    }
);


// ============================================================
// BLOCK STATUS
// ============================================================

async function checkBlockStatus() {

    if (
        !currentUser ||
        !receiverUid
    ) {
        return;
    }

    try {

        const myBlockRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "blockedUsers",
                receiverUid
            );

        const theirBlockRef =
            doc(
                db,
                "users",
                receiverUid,
                "blockedUsers",
                currentUser.uid
            );

        const [
            myBlockSnap,
            theirBlockSnap
        ] = await Promise.all([
            getDoc(myBlockRef),
            getDoc(theirBlockRef)
        ]);

        blockedByMe =
            myBlockSnap.exists();

        blockedMe =
            theirBlockSnap.exists();

        updateBlockedUI();

    } catch (error) {

        console.error(
            "Block status error:",
            error
        );
    }
}


// ============================================================
// BLOCK / UNBLOCK
// ============================================================

async function toggleBlockUser() {

    if (
        !currentUser ||
        !receiverUid
    ) {
        return;
    }

    const blockRef =
        doc(
            db,
            "users",
            currentUser.uid,
            "blockedUsers",
            receiverUid
        );

    try {

        if (blockedByMe) {

            await deleteDoc(
                blockRef
            );

            blockedByMe =
                false;

        } else {

            await setDoc(
                blockRef,
                {
                    blockedAt:
                        serverTimestamp()
                }
            );

            blockedByMe =
                true;
        }

        updateBlockedUI();

    } catch (error) {

        console.error(
            "Block error:",
            error
        );

        alert(
            "Unable to change block status."
        );
    }
}


// ============================================================
// BLOCK UI
// ============================================================

function updateBlockedUI() {

    if (!messageInput) {
        return;
    }

    if (
        blockedByMe ||
        blockedMe
    ) {

        messageInput.disabled =
            true;

        messageInput.classList.add(
            "vs-blocked-input"
        );

        messageInput.placeholder =
            blockedByMe
                ? "You blocked this user"
                : "You can't message this user";

        if (sendButton) {
            sendButton.disabled =
                true;
        }

    } else {

        messageInput.disabled =
            false;

        messageInput.classList.remove(
            "vs-blocked-input"
        );

        messageInput.placeholder =
            "Type a message...";

        if (sendButton) {
            sendButton.disabled =
                false;
        }
    }
}


// ============================================================
// CHAT OPTIONS
// ============================================================

function createChatOptions() {

    if (
        !chatName ||
        !chatName.parentElement
    ) {
        return;
    }

    const parent =
        chatName.parentElement;

    if (
        document.getElementById(
            "vitalStarChatOptionsButton"
        )
    ) {
        return;
    }

    parent.style.position =
        parent.style.position ||
        "relative";

    const optionsButton =
        document.createElement(
            "button"
        );

    optionsButton.id =
        "vitalStarChatOptionsButton";

    optionsButton.type =
        "button";

    optionsButton.textContent =
        "⋮";

    optionsButton.style.cssText = `
        position:absolute;
        right:0;
        top:50%;
        transform:translateY(-50%);
        border:0;
        background:transparent;
        color:white;
        font-size:25px;
        padding:4px 8px;
        cursor:pointer;
        z-index:20;
    `;

    const optionsMenu =
        document.createElement(
            "div"
        );

    optionsMenu.className =
        "vs-chat-options";

    optionsMenu.style.display =
        "none";

    const blockButton =
        document.createElement(
            "button"
        );

    blockButton.type =
        "button";

    blockButton.textContent =
        blockedByMe
            ? "🚫 Unblock User"
            : "🚫 Block User";

    optionsMenu.appendChild(
        blockButton
    );

    parent.appendChild(
        optionsButton
    );

    parent.appendChild(
        optionsMenu
    );

    optionsButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            optionsMenu.style.display =
                optionsMenu.style.display ===
                "none"
                    ? "block"
                    : "none";

            blockButton.textContent =
                blockedByMe
                    ? "🚫 Unblock User"
                    : "🚫 Block User";
        }
    );

    blockButton.addEventListener(
        "click",
        async event => {

            event.stopPropagation();

            optionsMenu.style.display =
                "none";

            const action =
                blockedByMe
                    ? "unblock"
                    : "block";

            if (
                !window.confirm(
                    `Are you sure you want to ${action} this user?`
                )
            ) {
                return;
            }

            await toggleBlockUser();

            blockButton.textContent =
                blockedByMe
                    ? "🚫 Unblock User"
                    : "🚫 Block User";
        }
    );
}