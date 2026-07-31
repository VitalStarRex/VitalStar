import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const messageList = document.getElementById("messageList");


onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }


   






const q = query(
    collection(db, "chats")
);








    onSnapshot(q, (snapshot) => {

        messageList.innerHTML = "";


        if (snapshot.empty) {
            messageList.innerHTML = "No messages yet";
            return;
        }


        snapshot.forEach((doc) => {

            const chat = doc.data();

            const otherUser = chat.participants.find(
                id => id !== user.uid
            );


            const div = document.createElement("div");

            div.className = "message-card";


            div.innerHTML = `
                <div class="name">
                    ${otherUser}
                </div>

                <div class="last-message">
                    ${chat.lastMessage || ""}
                </div>
            `;


            div.onclick = () => {

                window.location.href =
                `chat.html?uid=${otherUser}`;

            };


            messageList.appendChild(div);

        });

    });

});