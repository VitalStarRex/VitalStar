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

// HTML Elements
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

// Cloudinary Upload
async function uploadToCloudinary(file, type = "auto") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "vitalstar_upload"); // make this "Unsigned" in Cloudinary

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/m0scmqqv/${type}/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}

// Open file picker
imageBtn.onclick = () => { imageInput.click(); };
videoBtn.onclick = () => { videoInput.click(); };

// Voice recording
let recorder;
let audioChunks = [];

recordBtn.onclick = async () => {
  if (!recorder || recorder.state === "inactive") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    audioChunks = [];

    recorder.ondataavailable = (e) => { audioChunks.push(e.data); };

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const url = await uploadToCloudinary(audioBlob, "video"); // Cloudinary uses "video" for audio
      await sendMessage({ audio: url }); // send immediately
    };

    recorder.start();
    recordBtn.textContent = "⏹";
  } else {
    recorder.stop();
    recordBtn.textContent = "🎤";
  }
};

// Get receiver UID
const params = new URLSearchParams(window.location.search);
const receiverUid = params.get("uid");

// Back button
backBtn.onclick = () => { history.back(); };

// Login check
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const chatId = user.uid < receiverUid
    ? user.uid + "_" + receiverUid
    : receiverUid + "_" + user.uid;

  // Load receiver info
  const receiverRef = doc(db, "users", receiverUid);
  const receiverSnap = await getDoc(receiverRef);
  if (receiverSnap.exists()) {
    const data = receiverSnap.data();
    chatName.textContent = data.fullName || data.username || "User";
    chatName.style.cursor = "pointer";
    chatName.onclick = () => { window.location.href = `profile.html?uid=${receiverUid}`; };
    chatAvatar.src = data.profilePicture || "https://via.placeholder.com/50";
    chatStatus.textContent = "Online";
  }

  const messagesRef = collection(db, "chats", chatId, "messages");

  // Function to send message - used for text, image, video, audio
  async function sendMessage({ text = "", image = "", video = "", audio = "" }) {
    if (!text && !image && !video && !audio) return;

    try {
      await addDoc(messagesRef, {
        senderId: user.uid,
        receiverId: receiverUid,
        text: text,
        image: image,
        video: video,
        audio: audio,
        timestamp: serverTimestamp(),
        sent: true,
        delivered: false,
        read: false
      });

      await setDoc(doc(db, "chats", chatId), {
        participants: [user.uid, receiverUid],
        lastMessage: text || (image ? "📷 Photo" : video ? "🎥 Video" : audio ? "🎤 Voice message" : ""),
        lastImage: image,
        lastVideo: video,
        lastAudio: audio,
        lastTimestamp: serverTimestamp(),
        lastSenderId: user.uid,
        lastReceiverId: receiverUid,
        lastRead: false,
        lastDelivered: false
      }, { merge: true });

      // reset inputs
      messageInput.value = "";
      imageInput.value = "";
      videoInput.value = "";

    } catch