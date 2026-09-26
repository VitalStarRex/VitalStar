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
// FULL SCREEN LOADER
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

.vs-chat-menu {
    position: absolute;
    right: 10px;
    bottom: 60px;
    min-width: 190px;
    background: #171322;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 14px;
    padding: 8px;
    box-shadow: 0 12px 35px rgba(0,0,0,.45);
    z-index: 9999;
}

.vs-chat-menu button {
    width: 100%;
    border: 0;
    background: transparent;
    color: white;
    padding: 12px;
    border-radius: 10px;
    text-align: left;
    font-size: 14px;
}

.vs-chat-menu button:hover {
    background: rgba(255,255,255,.08);
}

.vs-chat-delete {
    margin-left: 8px;
    border: 0;
    background: transparent;
    color: #ff6b6b;
    cursor: pointer;
    font-size: 13px;
}

.vs-chat-blocked {
    color: #ff7676 !important;
}

.vs-chat-status {
    font-size: 12px;
    opacity: .75;
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
// BASIC BUTTONS
// ============================================================

backBtn?.addEventListener("click", () => {
    window.history.back();
});


// ============================================================
// MEDIA PREVIEW
// ============================================================

const mediaPreview = document.createElement("div");

mediaPreview.id = "mediaPreview";

mediaPreview.style.cssText = `
    display:none;
    margin:6px 0;
    padding:8px;
    border-radius:10px;
    background:rgba(255,255,255,.06);
    color:white;
    font-size:13px;
`;

messageForm?.parentElement?.insertBefore(
    mediaPreview,
    messageForm
);


// ============================================================
// SENDING STATUS
// ============================================================

const sendingStatus = document.createElement("div");

sendingStatus.style.cssText = `
    display:none;
    color:#aaa;
    font-size:12px;
    margin:4px 8px;
`;

messageForm?.parentElement?.insertBefore(
    sendingStatus,
    messageForm
);


// ============================================================
// SEND BUTTON
// ============================================================

let sendButton = messageForm?.querySelector(
    'button[type="submit"]'
);

const originalSendText = sendButton?.textContent || "Send";

function setSendingState(isSending) {

    if (!sendButton) return;

    sendButton.disabled = isSending;

    sendButton.textContent = isSending
        ? "⏳ Sending..."
        : originalSendText;

    sendingStatus.style.display = isSending
        ? "block"
        : "none";

    sendingStatus.textContent = isSending
        ? "Sending message..."
        : "";
}


// ============================================================
// MEDIA PREVIEW FUNCTION
// ============================================================

function showMediaPreview(file) {

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
// IMAGE INPUT
// ============================================================

imageInput?.addEventListener("change", () => {

    const file = imageInput.files?.[0];

    showMediaPreview(file);
});


// ============================================================
// VIDEO INPUT
// ============================================================

videoInput?.addEventListener("change", () => {

    const file = videoInput.files?.[0];

    showMediaPreview(file);
});


// ============================================================
// IMAGE BUTTON
// ============================================================

imageBtn?.addEventListener("click", () => {
    imageInput?.click();
});


// ============================================================
// VIDEO BUTTON
// ============================================================

videoBtn?.addEventListener("click", () => {
    videoInput?.click();
});


// ============================================================
// MEDIA MENU
// ============================================================

const mediaMenuWrapper = document.createElement("div");

mediaMenuWrapper.style.cssText = `
    position:relative;
    display:inline-block;
`;

const mediaMenuButton = document.createElement("button");

mediaMenuButton.type = "button";
mediaMenuButton.textContent = "＋";
mediaMenuButton.title = "Attachments";

mediaMenuButton.style.cssText = `
    width:42px;
    height:42px;
    border:0;
    border-radius:50%;
    cursor:pointer;
    font-size:24px;
    color:white;
    background:linear-gradient(135deg,#7b2cff,#00bfff);
`;

const mediaMenu = document.createElement("div");

mediaMenu.className = "vs-chat-menu";

mediaMenu.style.display = "none";

const menuImage = document.createElement("button");
menuImage.type = "button";
menuImage.textContent = "🖼️ Photo";

const menuVideo = document.createElement("button");
menuVideo.type = "button";
menuVideo.textContent = "🎥 Video";

const menuVoice = document.createElement("button");
menuVoice.type = "button";
menuVoice.textContent = "🎤 Voice note";

mediaMenu.appendChild(menuImage);
mediaMenu.appendChild(menuVideo);
mediaMenu.appendChild(menuVoice);

mediaMenuWrapper.appendChild(mediaMenuButton);
mediaMenuWrapper.appendChild(mediaMenu);


// Put the menu beside the existing form controls without
// changing the form's display/layout.
if (messageForm) {

    messageForm.insertBefore(
        mediaMenuWrapper,
        sendButton || null
    );
}

mediaMenuButton.addEventListener("click", (event) => {

    event.stopPropagation();

    mediaMenu.style.display =
        mediaMenu.style.display === "none"
            ? "block"
            : "none";
});

document.addEventListener("click", () => {
    mediaMenu.style.display = "none";
});

mediaMenu.addEventListener("click", event => {
    event.stopPropagation();
});

menuImage.addEventListener("click", () => {
    imageInput?.click();
    mediaMenu.style.display = "none";
});

menuVideo.addEventListener("click", () => {
    videoInput?.click();
    mediaMenu.style.display = "none";
});


// Hide the old standalone buttons so they don't line up.
// Their functionality remains available through the menu.
if (imageBtn) imageBtn.style.display = "none";
if (videoBtn) videoBtn.style.display = "none";
if (recordBtn) recordBtn.style.display = "none";


// ============================================================
// VOICE RECORDING
// ============================================================

let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;

async function startVoiceRecording() {

    try {

        recordingStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        mediaRecorder =
            new MediaRecorder(recordingStream);

        audioChunks = [];

        mediaRecorder.ondataavailable = event => {

            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {

            const audioBlob =
                new Blob(audioChunks, {
                    type: "audio/webm"
                });

            try {

                sendingStatus.style.display = "block";
                sendingStatus.textContent =
                    "Uploading voice note...";

                const url =
                    await uploadToCloudinary(
                        audioBlob,
                        "video"
                    );

                window.voiceUrl = url;

                mediaPreview.style.display = "block";
                mediaPreview.textContent =
                    "🎤 Voice note ready";

            } catch (error) {

                console.error(error);

                alert(
                    "Unable to upload voice note."
                );

            } finally {

                sendingStatus.style.display = "none";

                recordingStream?.getTracks()
                    .forEach(track => track.stop());
            }
        };

        mediaRecorder.start();

        menuVoice.textContent =
            "⏹️ Stop recording";

        menuVoice.dataset.recording = "true";

    } catch (error) {

        console.error(error);

        alert(
            "Microphone permission is required."
        );
    }
}

function stopVoiceRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {
        mediaRecorder.stop();
    }

    menuVoice.textContent =
        "🎤 Voice note";

    menuVoice.dataset.recording = "false";
}

menuVoice.addEventListener("click", () => {

    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }

    mediaMenu.style.display = "none";
});


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

async function uploadToCloudinary(file, resourceType = "auto") {

    const formData = new FormData();

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

    const data = await response.json();

    if (!response.ok || !data.secure_url) {

        console.error(
            "Cloudinary error:",
            data
        );

        throw new Error(
            data.error?.message ||
            "Cloudinary upload failed."
        );
    }

    return data.secure_url;
}


// ============================================================
// URL PARAMETERS
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const receiverUid =
    params.get("uid");


// ============================================================
// CURRENT USER
// ============================================================

let currentUser = null;
let chatId = null;

let blockedByMe = false;
let blockedMe = false;


// ============================================================
// RELATIVE LAST-SEEN TIME
// ============================================================

function formatRelativeTime(timestamp) {

    if (!timestamp) {
        return "Last seen unavailable";
    }

    let time;

    if (
        typeof timestamp === "number"
    ) {
        time = timestamp;
    }

    else if (
        timestamp instanceof Date
    ) {
        time = timestamp.getTime();
    }

    else if (
        typeof timestamp?.toDate === "function"
    ) {
        time = timestamp.toDate().getTime();
    }

    else if (
        typeof timestamp === "object" &&
        timestamp.seconds
    ) {
        time = timestamp.seconds * 1000;
    }

    else {
        time = new Date(timestamp).getTime();
    }

    if (!Number.isFinite(time)) {
        return "Last seen unavailable";
    }

    const difference =
        Math.max(
            0,
            Date.now() - time
        );

    const seconds =
        Math.floor(difference / 1000);

    const minutes =
        Math.floor(seconds / 60);

    const hours =
        Math.floor(minutes / 60);

    const days =
        Math.floor(hours / 24);

    const weeks =
        Math.floor(days / 7);

    const months =
        Math.floor(days / 30);

    const years =
        Math.floor(days / 365);

    if (seconds < 60) {

        return `Last seen ${seconds} ${
            seconds === 1
                ? "second"
                : "seconds"
        } ago`;
    }

    if (minutes < 60) {

        return `Last seen ${minutes} ${
            minutes === 1
                ? "minute"
                : "minutes"
        } ago`;
    }

    if (hours < 24) {

        return `Last seen ${hours} ${
            hours === 1
                ? "hour"
                : "hours"
        } ago`;
    }

    if (days < 7) {

        return `Last seen ${days} ${
            days === 1
                ? "day"
                : "days"
        } ago`;
    }

    if (weeks < 4) {

        return `Last seen ${weeks} ${
            weeks === 1
                ? "week"
                : "weeks"
        } ago`;
    }

    if (months < 12) {

        return `Last seen ${months} ${
            months === 1
                ? "month"
                : "months"
        } ago`;
    }

    return `Last seen ${years} ${
        years === 1
            ? "year"
            : "years"
    } ago`;
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

    if (!receiverUid) {

        loader.style.display = "none";

        alert("User not found.");

        return;
    }

    currentUser = user;

    chatId =
        user.uid < receiverUid
            ? `${user.uid}_${receiverUid}`
            : `${receiverUid}_${user.uid}`;

    try {

        // ====================================================
        // CHAT DOCUMENT
        // ====================================================

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


        // ====================================================
        // RECEIVER PROFILE
        // ====================================================

        const receiverRef =
            doc(
                db,
                "users",
                receiverUid
            );

        const receiverSnap =
            await getDoc(receiverRef);

        if (receiverSnap.exists()) {

            const data =
                receiverSnap.data();

            const name =
                data.fullName ||
                data.username ||
                "User";

            if (chatName) {
                chatName.textContent = name;
            }

            if (chatAvatar) {

                chatAvatar.src =
                    data.profilePicture ||
                    "https://via.placeholder.com/50";
            }
        }


        // ====================================================
        // PROFILE CLICK
        // ====================================================

        chatName?.addEventListener(
            "click",
            () => {

                window.location.href =
                    `profile.html?uid=${receiverUid}`;
            }
        );


        // ====================================================
        // REAL-TIME LAST SEEN
        // ====================================================

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

                if (status.online === true) {

                    chatStatus.textContent =
                        "🟢 Online";

                    return;
                }

                chatStatus.textContent =
                    formatRelativeTime(
                        status.lastSeen
                    );
            }
        );


        // ====================================================
        // BLOCK STATUS
        // ====================================================

        await checkBlockStatus();

        createChatOptions();


        // ====================================================
        // MESSAGE FORM
        // ====================================================

        if (messageForm) {

            messageForm.addEventListener(
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
                        messageInput?.value.trim() ||
                        "";

                    const imageFile =
                        imageInput?.files?.[0];

                    const videoFile =
                        videoInput?.files?.[0];

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


                        // ========================================
                        // ADD MESSAGE
                        // ========================================

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


                        // ========================================
                        // UPDATE CHAT PREVIEW
                        // ========================================

                        let preview =
                            text;

                        if (!preview) {

                            if (imageUrl) {
                                preview = "📷 Photo";
                            }

                            else if (videoUrl) {
                                preview = "🎥 Video";
                            }

                            else if (voiceUrl) {
                                preview = "🎤 Voice note";
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


                        // ========================================
                        // CLEAR FORM
                        // ========================================

                        if (messageInput) {
                            messageInput.value = "";
                        }

                        if (imageInput) {
                            imageInput.value = "";
                        }

                        if (videoInput) {
                            videoInput.value = "";
                        }

                        window.voiceUrl = "";

                        mediaPreview.style.display =
                            "none";

                        mediaPreview.textContent =
                            "";

                    } catch (error) {

                        console.error(
                            "Send message error:",
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
        }


        // ====================================================
        // LOAD MESSAGES
        // ====================================================

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

                if (!messages) return;

                messages.innerHTML = "";

                const docs =
                    [...snapshot.docs].reverse();


                // ==============================================
                // MARK RECEIVED MESSAGES READ
                // ==============================================

                for (
                    const messageDoc of docs
                ) {

                    const msg =
                        messageDoc.data();

                    if (
                        msg.receiverId ===
                        user.uid
                    ) {

                        try {

                            await updateDoc(
                                messageDoc.ref,
                                {
                                    delivered: true,
                                    read: true
                                }
                            );

                        } catch (error) {

                            console.error(
                                "Read update error:",
                                error
                            );
                        }
                    }
                }


                // ==============================================
                // RENDER MESSAGES
                // ==============================================

                docs.forEach(
                    messageDoc => {

                        const msg =
                            messageDoc.data();

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


                        // ======================================
                        // CONTENT
                        // ======================================

                        const content =
                            document.createElement(
                                "div"
                            );

                        content.className =
                            "message-content";


                        if (msg.text) {

                            const textDiv =
                                document.createElement(
                                    "div"
                                );

                            textDiv.textContent =
                                msg.text;

                            content.appendChild(
                                textDiv
                            );
                        }


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


                        // ======================================
                        // TIME
                        // ======================================

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

                        let timeText = "";

                        if (
                            msg.timestamp &&
                            typeof msg.timestamp.toDate ===
                            "function"
                        ) {

                            timeText =
                                msg.timestamp
                                    .toDate()
                                    .toLocaleTimeString(
                                        [],
                                        {
                                            hour: "numeric",
                                            minute: "2-digit"
                                        }
                                    );
                        }

                        const time =
                            document.createElement(
                                "span"
                            );

                        time.textContent =
                            timeText;

                        meta.appendChild(
                            time
                        );


                        // ======================================
                        // SENT STATUS
                        // ======================================

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


                        // ======================================
                        // DELETE BUTTON
                        // ======================================

                        const deleteButton =
                            document.createElement(
                                "button"
                            );

                        deleteButton.type =
                            "button";

                        deleteButton.className =
                            "vs-chat-delete";

                        deleteButton.textContent =
                            "Delete";

                        deleteButton.addEventListener(
                            "click",
                            async event => {

                                event.stopPropagation();

                                const confirmDelete =
                                    confirm(
                                        "Delete this message?"
                                    );

                                if (
                                    !confirmDelete
                                ) {
                                    return;
                                }

                                try {

                                    await deleteDoc(
                                        messageDoc.ref
                                    );

                                } catch (error) {

                                    console.error(
                                        error
                                    );

                                    alert(
                                        "Unable to delete message."
                                    );
                                }
                            }
                        );

                        if (isSent) {
                            content.appendChild(
                                deleteButton
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


                // ==============================================
                // SCROLL TO BOTTOM
                // ==============================================

                messages.scrollTop =
                    messages.scrollHeight;


                // ==============================================
                // HIDE LOADER
                // ==============================================

                loader.style.opacity = "0";

                setTimeout(() => {

                    loader.style.display =
                        "none";

                }, 350);
            },

            error => {

                console.error(
                    "Messages error:",
                    error
                );

                if (messages) {

                    messages.innerHTML = `
                        <div style="
                            color:#aaa;
                            text-align:center;
                            padding:30px;
                        ">
                            Unable to load messages.
                        </div>
                    `;
                }

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
});


// ============================================================
// BLOCK FUNCTIONS
// ============================================================

async function checkBlockStatus() {

    if (!currentUser || !receiverUid) {
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
            "Block check error:",
            error
        );
    }
}


// ============================================================
// BLOCK / UNBLOCK USER
// ============================================================

async function toggleBlockUser() {

    if (!currentUser || !receiverUid) {
        return;
    }

    try {

        const blockRef =
            doc(
                db,
                "users",
                currentUser.uid,
                "blockedUsers",
                receiverUid
            );

        if (blockedByMe) {

            await deleteDoc(
                blockRef
            );

            blockedByMe = false;

        } else {

            await setDoc(
                blockRef,
                {
                    blockedAt:
                        serverTimestamp()
                }
            );

            blockedByMe = true;
        }

        updateBlockedUI();

    } catch (error) {

        console.error(
            "Block user error:",
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

        messageInput.placeholder =
            blockedByMe
                ? "You blocked this user"
                : "You can't message this user";

        if (sendButton) {
            sendButton.disabled =
                true;
        }

        chatStatus.classList.add(
            "vs-chat-blocked"
        );

    } else {

        messageInput.disabled =
            false;

        messageInput.placeholder =
            "Type a message...";

        if (sendButton) {
            sendButton.disabled =
                false;
        }

        chatStatus.classList.remove(
            "vs-chat-blocked"
        );
    }
}


// ============================================================
// CHAT OPTIONS MENU
// ============================================================

function createChatOptions() {

    if (!chatName?.parentElement) {
        return;
    }

    if (
        document.getElementById(
            "vitalStarChatOptions"
        )
    ) {
        return;
    }

    const parent =
        chatName.parentElement;

    parent.style.position =
        parent.style.position ||
        "relative";

    const optionsButton =
        document.createElement(
            "button"
        );

    optionsButton.id =
        "vitalStarChatOptions";

    optionsButton.type =
        "button";

    optionsButton.textContent =
        "⋮";

    optionsButton.title =
        "Chat options";

    optionsButton.style.cssText = `
        position:absolute;
        right:0;
        top:50%;
        transform:translateY(-50%);
        border:0;
        background:transparent;
        color:white;
        font-size:25px;
        cursor:pointer;
        padding:4px 8px;
        z-index:5;
    `;

    const optionsMenu =
        document.createElement(
            "div"
        );

    optionsMenu.className =
        "vs-chat-menu";

    optionsMenu.style.display =
        "none";

    optionsMenu.style.right =
        "0";

    optionsMenu.style.bottom =
        "auto";

    optionsMenu.style.top =
        "42px";

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
        async () => {

            optionsMenu.style.display =
                "none";

            const action =
                blockedByMe
                    ? "unblock"
                    : "block";

            if (
                !confirm(
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

    document.addEventListener(
        "click",
        () => {
            optionsMenu.style.display =
                "none";
        }
    );
}