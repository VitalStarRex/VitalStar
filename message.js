import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const messages = document.getElementById("messages");

// Send message
window.sendMessage = async function () {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  await addDoc(collection(db, "messages"), {
    text: text,
    createdAt: serverTimestamp()
  });

  input.value = "";
};

// Display messages in real time
const q = query(collection(db, "messages"), orderBy("createdAt"));

onSnapshot(q, (snapshot) => {
  messages.innerHTML = "";

  snapshot.forEach((doc) => {
    const data = doc.data();

    messages.innerHTML += `
      <div class="message">
        ${data.text}
      </div>
    `;
  });

  messages.scrollTop = messages.scrollHeight;
});