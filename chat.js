// ============================================================
// VITALSTAR — chat.js
// Handles:
// - Chat messages
// - Image/video preview
// - Image/video uploads
// - Voice notes
// - Sending state
// - Message read/delivered status
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
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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


// Put preview above message form

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


// Put status above form

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

    mediaPreview.innerHTML = "";

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

            if (!file) {
                return;
            }


            // Clear video selection
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


            // EXACT SIZE
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

            if (!file) {
                return;
            }


            // Clear image selection
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


            // EXACT SIZE
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


    if (!response.ok || !data.secure_url) {

        throw new Error(
            data?.error?.message ||
            "Upload failed."
        );

    }


    return data.secure_url;

}


// ============================================================
// OPEN FILE PICKERS
// ============================================================

if (imageBtn) {

    imageBtn.onclick = () => {

        imageInput.click();

    };

}


if (videoBtn) {

    videoBtn.onclick = () => {

        videoInput.click();

    };

}


// ============================================================
// VOICE RECORDING
// ============================================================

let recorder;

let audioChunks = [];


recordBtn.onclick = async () => {

    try {

        if (
            !recorder ||
            recorder.state === "inactive"
        ) {

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    audio: true
                });


            recorder =
                new MediaRecorder(stream);


            audioChunks = [];


            recorder.ondataavailable =
                (e) => {

                    audioChunks.push(
                        e.data
                    );

                };


            recorder.onstop =
                async () => {

                    const audioBlob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    "audio/webm"
                            }
                        );


                    try {

                        setSendingState(true);


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

                        setSendingState(false);

                    }

                };


            recorder.start();


            recordBtn.textContent =
                "⏹";

        } else {

            recorder.stop();


            recordBtn.textContent =
                "🎤";

        }

    } catch (error) {

        console.error(
            error
        );


        alert(
            "Microphone permission is required."
        );

    }

};


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
// AUTHENTICATION
// ============================================================

auth.onAuthStateChanged(
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        if (!receiverUid) {

            alert(
                "No chat recipient found."
            );

            return;

        }


        // ====================================================
        // CHAT ID
        // ====================================================

        const chatId =
            user.uid < receiverUid
                ? `${user.uid}_${receiverUid}`
                : `${receiverUid}_${user.uid}`;


        // ====================================================
        // CREATE CHAT DOCUMENT
        // ====================================================

        await setDoc(
            doc(
                db,
                "chats",
                chatId
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


        // ====================================================
        // GET RECEIVER
        // ====================================================

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


        if (receiverSnap.exists()) {

            const data =
                receiverSnap.data();


            chatName.textContent =
                data.fullName ||
                data.username ||
                "User";


            chatName.style.cursor =
                "pointer";


            chatName.onclick = () => {

                window.location.href =
                    `profile.html?uid=${receiverUid}`;

            };


            chatAvatar.src =
                data.profilePicture ||
                "https://via.placeholder.com/50";


            chatStatus.textContent =
                "Online";

        }


        // ====================================================
        // MESSAGES COLLECTION
        // ====================================================

        const messagesRef =
            collection(
                db,
                "chats",
                chatId,
                "messages"
            );


        // ====================================================
        // SEND MESSAGE
        // ====================================================

        messageForm.addEventListener(
            "submit",
            async (e) => {

                e.preventDefault();


                const text =
                    messageInput.value.trim();


                let image = "";

                let video = "";

                let audio = "";


                // Prevent duplicate sends
                if (
                    sendButton?.disabled
                ) {

                    return;

                }


                try {

                    // START SENDING STATE
                    setSendingState(true);


                    // ----------------------------------------
                    // IMAGE
                    // ----------------------------------------

                    if (
                        imageInput.files[0]
                    ) {

                        image =
                            await uploadToCloudinary(
                                imageInput.files[0]
                            );

                    }


                    // ----------------------------------------
                    // VIDEO
                    // ----------------------------------------

                    if (
                        videoInput.files[0]
                    ) {

                        video =
                            await uploadToCloudinary(
                                videoInput.files[0]
                            );

                    }


                    // ----------------------------------------
                    // VOICE
                    // ----------------------------------------

                    if (
                        window.voiceUrl
                    ) {

                        audio =
                            window.voiceUrl;


                        window.voiceUrl =
                            "";

                    }


                    // ----------------------------------------
                    // CHECK EMPTY MESSAGE
                    // ----------------------------------------

                    if (
                        !text &&
                        !image &&
                        !video &&
                        !audio
                    ) {

                        return;

                    }


                    // ----------------------------------------
                    // ADD MESSAGE
                    // ----------------------------------------

                    await addDoc(
                        messagesRef,
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


                    // ----------------------------------------
                    // CHAT PREVIEW
                    // ----------------------------------------

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


                    // ----------------------------------------
                    // UPDATE CHAT
                    // ----------------------------------------

                    await setDoc(
                        doc(
                            db,
                            "chats",
                            chatId
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


                    // ----------------------------------------
                    // CLEAR FORM
                    // ----------------------------------------

                    messageInput.value =
                        "";


                    imageInput.value =
                        "";


                    videoInput.value =
                        "";


                    clearMediaPreview();


                }
                catch (err) {

                    console.error(
                        "Send message error:",
                        err
                    );


                    alert(
                        err.message ||
                        "Failed to send message."
                    );

                }
                finally {

                    // STOP SENDING STATE
                    setSendingState(false);

                }

            }
        );


        // ====================================================
        // DISPLAY MESSAGES
        // ====================================================

        const q =
            query(
                messagesRef,
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


                    // ----------------------------------------
                    // MARK RECEIVED AS READ
                    // ----------------------------------------

                    if (
                        msg.receiverId ===
                            user.uid &&
                        (
                            !msg.delivered ||
                            !msg.read
                        )
                    ) {

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
                                chatId
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


                        delivered =
                            true;


                        read =
                            true;

                    }


                    // ----------------------------------------
                    // MESSAGE BUBBLE
                    // ----------------------------------------

                    const div =
                        document.createElement(
                            "div"
                        );


                    div.className =
                        msg.senderId ===
                            user.uid
                            ? "message sent"
                            : "message received";


                    // ----------------------------------------
                    // TIME
                    // ----------------------------------------

                    let messageTime =
                        "";


                    const date =
                        msg.timestamp
                            ?.toDate?.();


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


                    // ----------------------------------------
                    // STATUS
                    // ----------------------------------------

                    let status =
                        "";


                    if (
                        msg.senderId ===
                        user.uid
                    ) {

                        status =
                            "✓ Sent";


                        if (delivered) {

                            status =
                                "✓✓ Delivered";

                        }


                        if (read) {

                            status =
                                "✓✓ Read";

                        }

                    }


                    // ----------------------------------------
                    // MESSAGE HTML
                    // ----------------------------------------

                    div.innerHTML = `

                        ${
                            msg.text
                                ? `<p>${msg.text}</p>`
                                : ""
                        }


                        ${
                            msg.image
                                ? `
                                    <img
                                        src="${msg.image}"
                                        style="
                                            max-width:200px;
                                            max-height:220px;
                                            object-fit:contain;
                                            border-radius:10px;
                                            display:block;
                                        "
                                    >
                                  `
                                : ""
                        }


                        ${
                            msg.video
                                ? `
                                    <video
                                        controls
                                        style="
                                            max-width:220px;
                                            max-height:220px;
                                            border-radius:10px;
                                            display:block;
                                        "
                                    >
                                        <source src="${msg.video}">
                                    </video>
                                  `
                                : ""
                        }


                        ${
                            msg.audio
                                ? `
                                    <audio controls>
                                        <source src="${msg.audio}">
                                    </audio>
                                  `
                                : ""
                        }


                        <div class="message-footer">

                            <span class="message-time">
                                ${messageTime}
                            </span>


                            <span class="message-status">
                                ${status}
                            </span>

                        </div>

                    `;


                    messages.appendChild(
                        div
                    );

                }


                messages.scrollTop =
                    messages.scrollHeight;

            }
        );

    }
);