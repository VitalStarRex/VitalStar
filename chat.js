// ============================================================
// VITALSTAR CHAT.JS
// Modern chat UI + attachment menu + voice recorder + delete
// ============================================================

import { auth, db } from "./firebase.js";

import {
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// VS LOADER
// ============================================================

const loader = document.createElement("div");

loader.innerHTML = `
    <div class="vs-loader">
        <div class="vs-loader-logo">VS</div>
    </div>
`;

document.body.appendChild(loader);

const loaderStyle = document.createElement("style");

loaderStyle.textContent = `
    .vs-loader {
        position: fixed;
        inset: 0;
        background: #080510;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    }

    .vs-loader-logo {
        width: 65px;
        height: 65px;
        border: 4px solid #222;
        border-top-color: #00ff88;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 22px;
        font-weight: 900;
        animation: vsSpin 1s linear infinite;
        box-shadow: 0 0 25px rgba(0,255,136,.25);
    }

    @keyframes vsSpin {
        to {
            transform: rotate(360deg);
        }
    }
`;

document.head.appendChild(loaderStyle);


// ============================================================
// ELEMENTS
// ============================================================

const messagesContainer =
    document.getElementById("messages") ||
    document.getElementById("chatMessages");

const messageInput =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

const imageBtn =
    document.getElementById("imageBtn");

const videoBtn =
    document.getElementById("videoBtn");

const recordBtn =
    document.getElementById("recordBtn");

const imageInput =
    document.getElementById("imageInput");

const videoInput =
    document.getElementById("videoInput");

const chatForm =
    document.getElementById("chatForm") ||
    messageInput?.closest("form");


// ============================================================
// GET RECEIVER
// ============================================================

const params = new URLSearchParams(location.search);

const receiverId =
    params.get("uid") ||
    params.get("userId") ||
    params.get("id");

const currentUser =
    auth.currentUser;

if (!currentUser || !receiverId) {
    loader.remove();
    throw new Error("Chat user not found.");
}

const currentUid =
    currentUser.uid;


// ============================================================
// CHAT ID
// ============================================================

const chatId = [
    currentUid,
    receiverId
].sort().join("_");

const chatRef =
    doc(db, "chats", chatId);

const messagesRef =
    collection(db, "chats", chatId, "messages");


// ============================================================
// CLOUDINARY
// ============================================================

const CLOUDINARY_CLOUD =
    "m0scmqqv";

const CLOUDINARY_PRESET =
    "vitalstar_upload";


// ============================================================
// STATE
// ============================================================

let imageUrl = "";
let videoUrl = "";
let voiceUrl = "";

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

let attachmentMenu = null;


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}


function formatTime(timestamp) {
    if (!timestamp) return "";

    const date =
        timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}


function scrollToBottom() {
    if (!messagesContainer) return;

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


// ============================================================
// CHAT STYLE
// ============================================================

const chatStyle = document.createElement("style");

chatStyle.textContent = `

    .vs-attachment-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .vs-plus-button {
        width: 42px;
        height: 42px;
        border: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed, #00d084);
        color: white;
        font-size: 25px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: .2s;
        flex-shrink: 0;
    }

    .vs-plus-button:active {
        transform: scale(.9);
    }

    .vs-plus-button.active {
        transform: rotate(45deg);
    }

    .vs-attachment-menu {
        position: absolute;
        bottom: 52px;
        left: 0;
        width: 190px;
        padding: 8px;
        background: rgba(18, 14, 32, .98);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        box-shadow: 0 15px 40px rgba(0,0,0,.4);
        display: none;
        z-index: 9999;
        backdrop-filter: blur(15px);
    }

    .vs-attachment-menu.show {
        display: block;
        animation: vsMenu .16s ease;
    }

    @keyframes vsMenu {
        from {
            opacity: 0;
            transform: translateY(8px) scale(.96);
        }

        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .vs-attachment-item {
        width: 100%;
        border: none;
        background: transparent;
        color: white;
        padding: 12px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        font-size: 14px;
        text-align: left;
    }

    .vs-attachment-item:hover {
        background: rgba(255,255,255,.08);
    }

    .vs-attachment-icon {
        width: 35px;
        height: 35px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        background: rgba(124,58,237,.2);
    }

    .vs-message-container {
        position: relative;
        margin: 6px 10px;
        display: flex;
        flex-direction: column;
    }

    .vs-message-container.mine {
        align-items: flex-end;
    }

    .vs-message-container.theirs {
        align-items: flex-start;
    }

    .vs-message-bubble {
        position: relative;
        max-width: min(78%, 500px);
        padding: 10px 12px;
        border-radius: 17px;
        word-break: break-word;
    }

    .mine .vs-message-bubble {
        background: linear-gradient(135deg, #6336d8, #4325a8);
        color: white;
        border-bottom-right-radius: 5px;
    }

    .theirs .vs-message-bubble {
        background: #20202b;
        color: white;
        border-bottom-left-radius: 5px;
    }

    .vs-message-text {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.4;
    }

    .vs-message-time {
        font-size: 10px;
        opacity: .65;
        margin-top: 4px;
        text-align: right;
    }

    .vs-message-media {
        max-width: 240px;
        max-height: 300px;
        border-radius: 12px;
        display: block;
        margin-bottom: 5px;
    }

    .vs-audio-player {
        max-width: 230px;
    }

    .vs-message-more {
        position: absolute;
        top: 3px;
        right: -32px;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 50%;
        background: rgba(30,30,40,.9);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: .65;
    }

    .theirs .vs-message-more {
        left: -32px;
        right: auto;
    }

    .vs-message-more:hover {
        opacity: 1;
    }

    .vs-message-actions {
        position: absolute;
        right: 0;
        top: 32px;
        min-width: 110px;
        background: #191522;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 10px;
        overflow: hidden;
        z-index: 1000;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
    }

    .vs-message-action {
        width: 100%;
        padding: 10px 13px;
        border: none;
        background: transparent;
        color: white;
        text-align: left;
        cursor: pointer;
    }

    .vs-message-action:hover {
        background: rgba(255,255,255,.08);
    }

    .vs-message-action.delete {
        color: #ff6b6b;
    }

    .vs-recording {
        color: #ff5b6e !important;
    }

    .vs-upload-status {
        position: fixed;
        left: 50%;
        bottom: 90px;
        transform: translateX(-50%);
        background: rgba(20,18,28,.96);
        color: white;
        padding: 10px 16px;
        border-radius: 20px;
        font-size: 13px;
        z-index: 99999;
        display: none;
    }

    .vs-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.65);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        padding: 20px;
    }

    .vs-confirm-box {
        width: min(330px, 100%);
        background: #181522;
        border-radius: 18px;
        padding: 22px;
        color: white;
        box-shadow: 0 20px 60px rgba(0,0,0,.5);
    }

    .vs-confirm-box h3 {
        margin: 0 0 8px;
    }

    .vs-confirm-box p {
        opacity: .7;
        font-size: 14px;
    }

    .vs-confirm-buttons {
        display: flex;
        gap: 10px;
        margin-top: 18px;
    }

    .vs-confirm-buttons button {
        flex: 1;
        border: none;
        padding: 11px;
        border-radius: 10px;
        cursor: pointer;
    }

    .vs-cancel-delete {
        background: #30303a;
        color: white;
    }

    .vs-confirm-delete {
        background: #e53955;
        color: white;
    }

`;

document.head.appendChild(chatStyle);


// ============================================================
// UPLOAD STATUS
// ============================================================

const uploadStatus =
    document.createElement("div");

uploadStatus.className =
    "vs-upload-status";

document.body.appendChild(uploadStatus);


function showStatus(text) {
    uploadStatus.textContent = text;
    uploadStatus.style.display = "block";
}


function hideStatus() {
    uploadStatus.style.display = "none";
}


// ============================================================
// HIDE OLD BUTTONS
// ============================================================

if (imageBtn) imageBtn.style.display = "none";
if (videoBtn) videoBtn.style.display = "none";
if (recordBtn) recordBtn.style.display = "none";


// ============================================================
// FILE INPUTS
// ============================================================

const hiddenImageInput =
    imageInput || document.createElement("input");

const hiddenVideoInput =
    videoInput || document.createElement("input");

if (!imageInput) {
    hiddenImageInput.type = "file";
    hiddenImageInput.accept = "image/*";
    hiddenImageInput.style.display = "none";
    document.body.appendChild(hiddenImageInput);
}

if (!videoInput) {
    hiddenVideoInput.type = "file";
    hiddenVideoInput.accept = "video/*";
    hiddenVideoInput.style.display = "none";
    document.body.appendChild(hiddenVideoInput);
}


// ============================================================
// ATTACHMENT MENU
// ============================================================

function createAttachmentMenu() {

    if (!chatForm || attachmentMenu) return;

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "vs-attachment-wrapper";

    const plusButton =
        document.createElement("button");

    plusButton.type = "button";
    plusButton.className =
        "vs-plus-button";

    plusButton.textContent = "+";

    attachmentMenu =
        document.createElement("div");

    attachmentMenu.className =
        "vs-attachment-menu";

    attachmentMenu.innerHTML = `

        <button type="button"
            class="vs-attachment-item"
            data-action="photo">

            <span class="vs-attachment-icon">📷</span>
            <span>Photo</span>

        </button>

        <button type="button"
            class="vs-attachment-item"
            data-action="video">

            <span class="vs-attachment-icon">🎥</span>
            <span>Video</span>

        </button>

        <button type="button"
            class="vs-attachment-item"
            data-action="voice">

            <span class="vs-attachment-icon">🎙️</span>
            <span class="voice-label">Voice note</span>

        </button>

    `;

    wrapper.appendChild(plusButton);
    wrapper.appendChild(attachmentMenu);

    if (sendBtn && sendBtn.parentElement) {
        sendBtn.parentElement.insertBefore(
            wrapper,
            sendBtn
        );
    } else {
        chatForm.prepend(wrapper);
    }

    plusButton.addEventListener("click", e => {

        e.stopPropagation();

        attachmentMenu.classList.toggle("show");
        plusButton.classList.toggle("active");

    });


    attachmentMenu.addEventListener("click", async e => {

        const button =
            e.target.closest(".vs-attachment-item");

        if (!button) return;

        const action =
            button.dataset.action;

        if (action === "photo") {

            hiddenImageInput.click();

        }

        if (action === "video") {

            hiddenVideoInput.click();

        }

        if (action === "voice") {

            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }

        }

    });

    document.addEventListener("click", e => {

        if (!wrapper.contains(e.target)) {
            attachmentMenu.classList.remove("show");
            plusButton.classList.remove("active");
        }

    });
}

createAttachmentMenu();


// ============================================================
// IMAGE SELECTED
// ============================================================

hiddenImageInput.addEventListener("change", async () => {

    const file =
        hiddenImageInput.files?.[0];

    if (!file) return;

    try {

        showStatus("Uploading photo...");

        imageUrl =
            await uploadToCloudinary(file);

        showStatus("Photo ready ✓");

        setTimeout(hideStatus, 1200);

    } catch (error) {

        console.error(error);

        showStatus("Photo upload failed");

        setTimeout(hideStatus, 1800);

    }

    hiddenImageInput.value = "";

});


// ============================================================
// VIDEO SELECTED
// ============================================================

hiddenVideoInput.addEventListener("change", async () => {

    const file =
        hiddenVideoInput.files?.[0];

    if (!file) return;

    try {

        showStatus("Uploading video...");

        videoUrl =
            await uploadToCloudinary(file);

        showStatus("Video ready ✓");

        setTimeout(hideStatus, 1200);

    } catch (error) {

        console.error(error);

        showStatus("Video upload failed");

        setTimeout(hideStatus, 1800);

    }

    hiddenVideoInput.value = "";

});


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
        CLOUDINARY_PRESET
    );

    const response =
        await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,
            {
                method: "POST",
                body: formData
            }
        );

    const data =
        await response.json();

    if (!response.ok || !data.secure_url) {

        console.error(
            "Cloudinary error:",
            data
        );

        throw new Error(
            data?.error?.message ||
            "Cloudinary upload failed"
        );
    }

    return data.secure_url;
}


// ============================================================
// VOICE RECORDER
// ============================================================

async function startRecording() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        audioChunks = [];

        mediaRecorder =
            new MediaRecorder(stream);

        isRecording = true;

        const voiceButton =
            attachmentMenu?.querySelector(
                '[data-action="voice"]'
            );

        if (voiceButton) {

            voiceButton.classList.add(
                "vs-recording"
            );

            voiceButton.querySelector(
                ".voice-label"
            ).textContent =
                "Stop recording";
        }


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

                stream
                    .getTracks()
                    .forEach(track =>
                        track.stop()
                    );

                const blob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "audio/webm"
                        }
                    );

                try {

                    showStatus(
                        "Uploading voice note..."
                    );

                    voiceUrl =
                        await uploadToCloudinary(
                            blob
                        );

                    showStatus(
                        "Voice note ready ✓"
                    );

                    setTimeout(
                        hideStatus,
                        1200
                    );

                } catch (error) {

                    console.error(error);

                    showStatus(
                        "Voice upload failed"
                    );

                    setTimeout(
                        hideStatus,
                        1800
                    );
                }

            };

        mediaRecorder.start();

        showStatus(
            "Recording voice note..."
        );

    } catch (error) {

        console.error(error);

        showStatus(
            "Microphone permission is required"
        );

        setTimeout(
            hideStatus,
            2000
        );
    }
}


function stopRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {
        mediaRecorder.stop();
    }

    isRecording = false;

    const voiceButton =
        attachmentMenu?.querySelector(
            '[data-action="voice"]'
        );

    if (voiceButton) {

        voiceButton.classList.remove(
            "vs-recording"
        );

        voiceButton.querySelector(
            ".voice-label"
        ).textContent =
            "Voice note";
    }

}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const text =
        messageInput?.value.trim() || "";

    if (
        !text &&
        !imageUrl &&
        !videoUrl &&
        !voiceUrl
    ) {
        return;
    }

    if (sendBtn) {
        sendBtn.disabled = true;
    }

    try {

        const messageData = {

            senderId: currentUid,

            receiverId: receiverId,

            text: text,

            image: imageUrl || "",

            video: videoUrl || "",

            audio: voiceUrl || "",

            timestamp:
                serverTimestamp(),

            sent: true,

            delivered: false,

            read: false
        };


        await addDoc(
            messagesRef,
            messageData
        );


        await setDoc(
            chatRef,
            {
                participants: [
                    currentUid,
                    receiverId
                ],

                lastMessage:
                    text ||
                    (
                        imageUrl
                            ? "📷 Photo"
                            : videoUrl
                                ? "🎥 Video"
                                : "🎙️ Voice note"
                    ),

                lastMessageAt:
                    serverTimestamp(),

                lastSenderId:
                    currentUid
            },
            {
                merge: true
            }
        );


        if (messageInput) {
            messageInput.value = "";
        }

        imageUrl = "";
        videoUrl = "";
        voiceUrl = "";

        scrollToBottom();

    } catch (error) {

        console.error(
            "Send message error:",
            error
        );

        showStatus(
            "Message failed to send"
        );

        setTimeout(
            hideStatus,
            1800
        );

    } finally {

        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
}


// ============================================================
// SEND BUTTON
// ============================================================

if (sendBtn) {

    sendBtn.addEventListener(
        "click",
        e => {

            e.preventDefault();

            sendMessage();

        }
    );

}


// ============================================================
// FORM SUBMIT
// ============================================================

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        e => {

            e.preventDefault();

            sendMessage();

        }
    );

}


// ============================================================
// ENTER TO SEND
// ============================================================

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        e => {

            if (
                e.key === "Enter" &&
                !e.shiftKey
            ) {

                e.preventDefault();

                sendMessage();
            }

        }
    );

}


// ============================================================
// DELETE CONFIRMATION
// ============================================================

const confirmOverlay =
    document.createElement("div");

confirmOverlay.className =
    "vs-confirm-overlay";

confirmOverlay.innerHTML = `

    <div class="vs-confirm-box">

        <h3>Delete message?</h3>

        <p>
            This message will be removed from the chat.
        </p>

        <div class="vs-confirm-buttons">

            <button
                class="vs-cancel-delete">
                Cancel
            </button>

            <button
                class="vs-confirm-delete">
                Delete
            </button>

        </div>

    </div>

`;

document.body.appendChild(
    confirmOverlay
);

let messageToDelete = null;


function askDelete(messageId) {

    messageToDelete =
        messageId;

    confirmOverlay.style.display =
        "flex";
}


function closeDeleteDialog() {

    messageToDelete =
        null;

    confirmOverlay.style.display =
        "none";
}


confirmOverlay
    .querySelector(".vs-cancel-delete")
    .addEventListener(
        "click",
        closeDeleteDialog
    );


confirmOverlay
    .querySelector(".vs-confirm-delete")
    .addEventListener(
        "click",
        async () => {

            if (!messageToDelete) {
                return;
            }

            try {

                await deleteDoc(
                    doc(
                        messagesRef,
                        messageToDelete
                    )
                );

                closeDeleteDialog();

            } catch (error) {

                console.error(
                    "Delete message error:",
                    error
                );

                closeDeleteDialog();

                showStatus(
                    "Could not delete message"
                );

                setTimeout(
                    hideStatus,
                    1800
                );
            }

        }
    );


// ============================================================
// MESSAGE MENU
// ============================================================

document.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".vs-message-actions"
            )
            .forEach(menu => {
                menu.remove();
            });

    }
);


// ============================================================
// DISPLAY MESSAGE
// ============================================================

function renderMessage(
    message,
    messageId
) {

    if (!messagesContainer) return;

    const data =
        message.data();

    const mine =
        data.senderId === currentUid;

    const container =
        document.createElement("div");

    container.className =
        `vs-message-container ${
            mine ? "mine" : "theirs"
        }`;


    const bubble =
        document.createElement("div");

    bubble.className =
        "vs-message-bubble";


    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    if (data.text) {

        const text =
            document.createElement("p");

        text.className =
            "vs-message-text";

        text.textContent =
            data.text;

        bubble.appendChild(
            text
        );
    }


    // --------------------------------------------------------
    // IMAGE
    // --------------------------------------------------------

    if (data.image) {

        const image =
            document.createElement("img");

        image.className =
            "vs-message-media";

        image.src =
            data.image;

        image.alt =
            "Photo";

        image.loading =
            "lazy";

        bubble.appendChild(
            image
        );
    }


    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    if (data.video) {

        const video =
            document.createElement("video");

        video.className =
            "vs-message-media";

        video.src =
            data.video;

        video.controls =
            true;

        video.preload =
            "metadata";

        bubble.appendChild(
            video
        );
    }


    // --------------------------------------------------------
    // AUDIO
    // --------------------------------------------------------

    if (data.audio) {

        const audio =
            document.createElement("audio");

        audio.className =
            "vs-audio-player";

        audio.src =
            data.audio;

        audio.controls =
            true;

        bubble.appendChild(
            audio
        );
    }


    // --------------------------------------------------------
    // TIME
    // --------------------------------------------------------

    const time =
        document.createElement("div");

    time.className =
        "vs-message-time";

    time.textContent =
        formatTime(data.timestamp);

    bubble.appendChild(
        time
    );


    // --------------------------------------------------------
    // DELETE MENU
    // --------------------------------------------------------

    if (mine) {

        const moreButton =
            document.createElement("button");

        moreButton.className =
            "vs-message-more";

        moreButton.type =
            "button";

        moreButton.textContent =
            "⋮";


        moreButton.addEventListener(
            "click",
            e => {

                e.stopPropagation();

                document
                    .querySelectorAll(
                        ".vs-message-actions"
                    )
                    .forEach(menu => {
                        menu.remove();
                    });


                const actions =
                    document.createElement("div");

                actions.className =
                    "vs-message-actions";


                const deleteButton =
                    document.createElement("button");

                deleteButton.className =
                    "vs-message-action delete";

                deleteButton.textContent =
                    "🗑 Delete";


                deleteButton.addEventListener(
                    "click",
                    e => {

                        e.stopPropagation();

                        actions.remove();

                        askDelete(
                            messageId
                        );

                    }
                );


                actions.appendChild(
                    deleteButton
                );

                container.appendChild(
                    actions
                );

            }
        );


        container.appendChild(
            moreButton
        );
    }


    container.appendChild(
        bubble
    );

    messagesContainer.appendChild(
        container
    );
}


// ============================================================
// LOAD MESSAGES
// ============================================================

const messagesQuery =
    query(
        messagesRef,
        orderBy(
            "timestamp",
            "asc"
        )
    );


onSnapshot(
    messagesQuery,
    snapshot => {

        messagesContainer.innerHTML = "";

        snapshot.forEach(
            message => {

                renderMessage(
                    message,
                    message.id
                );

            }
        );

        scrollToBottom();

    },
    error => {

        console.error(
            "Messages listener error:",
            error
        );

    }
);


// ============================================================
// LOAD RECEIVER PROFILE
// ============================================================

async function loadReceiverProfile() {

    try {

        const userRef =
            doc(
                db,
                "users",
                receiverId
            );

        const userSnap =
            await getDoc(
                userRef
            );

        if (!userSnap.exists()) {
            return;
        }

        const user =
            userSnap.data();


        const name =
            user.fullName ||
            user.username ||
            "VitalStar User";


        const avatar =
            user.photoURL ||
            user.profileImage ||
            user.photo ||
            "";


        const nameElements =
            document.querySelectorAll(
                "[data-chat-name], #chatName, .chat-name"
            );


        nameElements.forEach(
            element => {
                element.textContent =
                    name;
            }
        );


        const avatarElements =
            document.querySelectorAll(
                "[data-chat-avatar], #chatAvatar, .chat-avatar"
            );


        avatarElements.forEach(
            element => {

                if (avatar) {
                    element.src =
                        avatar;
                }

            }
        );

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

    }

}


// ============================================================
// START
// ============================================================

loadReceiverProfile();


// ============================================================
// REMOVE LOADER
// ============================================================

window.addEventListener(
    "load",
    () => {

        setTimeout(
            () => {

                loader.remove();

            },
            350
        );

    }
);