// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// Send text message
window.sendMessage = async function () {
  const input = document.getElementById("messageInput");

  if (input.value.trim() === "") return;

  await addDoc(collection(db, "messages"), {
    type: "text",
    text: input.value,
    time: serverTimestamp()
  });

  input.value = "";
};

// Upload image/video/audio
document.getElementById("fileInput").addEventListener("change", async (e) => {

  const file = e.target.files[0];

  if (!file) return;

  const fileName = Date.now() + "_" + file.name;

  const storageRef = ref(storage, "chatFiles/" + fileName);

  try {

    await uploadBytes(storageRef, file);

    const downloadURL = await getDownloadURL(storageRef);

    let type = "file";

    if (file.type.startsWith("image/")) {
      type = "image";
    } else if (file.type.startsWith("video/")) {
      type = "video";
    } else if (file.type.startsWith("audio/")) {
      type = "audio";
    }

    await addDoc(collection(db, "messages"), {
      type: type,
      fileUrl: downloadURL,
      fileName: file.name,
      time: serverTimestamp()
    });

    alert("File sent successfully!");

  } catch (err) {
    console.error(err);
    alert("Upload failed!");
  }

});