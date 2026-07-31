

import { auth, db } from "./firebase.js";

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
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

async function uploadToCloudinary(file){
    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", "vitalstar_upload");

    const response = await fetch(
        "https://api.cloudinary.com/v1_1/m0scmqqv/auto/upload",
        {
            method:"POST",
            body:formData
        }
    );

    const data = await response.json();
    return data.secure_url;
}

imageBtn.onclick = () => imageInput.click();
videoBtn.onclick = () => videoInput.click();

const params = new URLSearchParams(window.location.search);
const receiverUid = params.get("uid");

backBtn.onclick = () => history.back();

auth.onAuthStateChanged(async(user)=>{

    if(!user){
        window.location.href="login.html";
        return;
    }

    const chatId =
        user.uid < receiverUid
        ? user.uid+"_"+receiverUid
        : receiverUid+"_"+user.uid;

    const userSnap = await getDoc(doc(db,"users",receiverUid));

    if(userSnap.exists()){

        const data = userSnap.data();

        chatName.textContent =
        data.fullName || data.username || "User";




        chatAvatar.src =
        data.profilePicture || "https://via.placeholder.com/50";

        chatStatus.textContent = "Online";
    }

    const messagesRef =
    collection(db, "chats", chatId, "messages");

    messageForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const text = messageInput.value.trim();

        if (!text && !imageInput.files[0] && !videoInput.files[0])
            return;

        let image = "";
        let video = "";

        if (imageInput.files[0])
            image = await uploadToCloudinary(imageInput.files[0]);

        if (videoInput.files[0])
            video = await uploadToCloudinary(videoInput.files[0]);

        await addDoc(messagesRef, {

            senderId: user.uid,
            receiverId: receiverUid,

            text,
            image,
            video,

            timestamp: serverTimestamp(),

            delivered: false,
            read: false
        });

        await setDoc(
            doc(db, "chats", chatId),
            {

                participants: [
                    user.uid,
                    receiverUid
                ],

                lastMessage:
                text ||
                (image ? "📷 Photo" :
                video ? "🎥 Video" : ""),

                lastImage: image,
                lastVideo: video,

                lastTimestamp: serverTimestamp(),

                lastSenderId: user.uid,
                lastReceiverId: receiverUid,

                lastRead: false,
                lastDelivered: false

            },
            { merge: true }
        );

        messageInput.value = "";
        imageInput.value = "";
        videoInput.value = "";

    });





    const q = query(
        messagesRef,
        orderBy("timestamp", "asc")
    );

    onSnapshot(q, async (snapshot) => {

        messages.innerHTML = "";

        for (const messageDoc of snapshot.docs) {

            const msg = messageDoc.data();

            if (
                msg.receiverId === user.uid &&
                (!msg.delivered || !msg.read)
            ) {

                await updateDoc(messageDoc.ref, {

                    delivered: true,
                    read: true

                });

                await updateDoc(doc(db, "chats", chatId), {

                    lastDelivered: true,
                    lastRead: true

                });

                msg.delivered = true;
                msg.read = true;

            }

            const div = document.createElement("div");

            div.className =
            msg.senderId === user.uid
            ? "message sent"
            : "message received";

            let status = "✓ Sent";

            if (msg.delivered)
                status = "✓✓ Delivered";

            if (msg.read)
                status = "✓✓ Read";

            div.innerHTML = `

            ${msg.text ? `<p>${msg.text}</p>` : ""}

            ${msg.image ? `<img src="${msg.image}" width="200">` : ""}

            ${msg.video ? `
            <video controls width="220">
            <source src="${msg.video}">
            </video>` : ""}

            <div class="message-footer">

            <span class="message-status">
            ${status}
            </span>

            </div>

            `;

            messages.appendChild(div);

        }

        messages.scrollTop = messages.scrollHeight;

    });

});