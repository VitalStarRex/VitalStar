import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// HTML Elements
const backBtn = document.getElementById("backBtn");
const chatAvatar = document.getElementById("chatAvatar");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");

const messages = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

// Get receiver UID
const params = new URLSearchParams(window.location.search);
const receiverUid = params.get("uid");

// Back button
backBtn.addEventListener("click", () => {
    history.back();
});

// Wait for login
auth.onAuthStateChanged(async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // Create conversation ID
    const chatId =
        user.uid < receiverUid
            ? user.uid + "_" + receiverUid
            : receiverUid + "_" + user.uid;

    // Load receiver profile
    const receiverRef = doc(db, "users", receiverUid);
    const receiverSnap = await getDoc(receiverRef);

    if (receiverSnap.exists()) {

        const data = receiverSnap.data();

        chatName.textContent =
            data.fullName || data.username;

        chatAvatar.src =
            data.profilePicture ||
            "https://via.placeholder.com/50";

        chatStatus.textContent = "Online";
    }








    // Messages collection
    const messagesRef = collection(db, "chats", chatId, "messages");

    // Send message
    messageForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const text = messageInput.value.trim();

        if (text === "") return;

        try {

            await addDoc(messagesRef, {
                senderId: user.uid,
                receiverId: receiverUid,
                text: text,
                timestamp: serverTimestamp()
            });

            messageInput.value = "";

        } catch (err) {
            console.error(err);
            alert("Failed to send message.");
        }

    });

    // Load messages in real time
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    onSnapshot(q, (snapshot) => {

        messages.innerHTML = "";

        snapshot.forEach((doc) => {

            const msg = doc.data();

            const div = document.createElement("div");

            div.className =
                msg.senderId === user.uid
                    ? "message sent"
                    : "message received";

            div.textContent = msg.text;

            messages.appendChild(div);

        });

        // Auto scroll to latest message
        messages.scrollTop = messages.scrollHeight;

    });

});







