import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.sendMessage = async function () {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  await addDoc(collection(db, "messages"), {
    text: text,
    createdAt: serverTimestamp()
  });

  input.value = "";
  alert("Message sent!");
}