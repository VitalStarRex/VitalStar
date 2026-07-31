import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const chatList = document.getElementById("chatList");

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const chatsRef = collection(db, "chats");

    const q = query(
        chatsRef,
        orderBy("lastTimestamp", "desc")
    );

    onSnapshot(q, async (snapshot) => {

        chatList.innerHTML = "";

        for (const chatDoc of snapshot.docs) {

            const chat = chatDoc.data();

            if (!chat.participants || !chat.participants.includes(user.uid)) {
                continue;
            }

            const otherUid = chat.participants.find(uid => uid !== user.uid);

            const userSnap = await getDoc(doc(db, "users", otherUid));

            if (!userSnap.exists()) continue;

            const userData = userSnap.data();