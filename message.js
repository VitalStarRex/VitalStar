import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
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
        collection(db, "chats"),
        where("participants", "array-contains", user.uid)
    );


    onSnapshot(q, (snapshot) => {

        messageList.innerHTML = "";


        if (snapshot.empty) {

            messageList.innerHTML = "No messages yet";

            return;
        }


        snapshot.forEach((doc) => {

            const chat = doc.data();


            let otherUser = "Unknown user";


            if (chat.participants) {

                otherUser = chat.participants.find(
                    id => id !== user.uid
                ) || "Unknown user";

            }


            const div = document.createElement("div");

            div.className = "message-card";


            div.innerHTML = `

                <div class="name">
                    ${otherUser}
                </div>

                <div class="last-message">
                    ${chat.lastMessage || "No message"}
                </div>

            `;


            div.onclick = () => {

                window.location.href =
                `chat.html?uid=${otherUser}`;

            };


            messageList.appendChild(div);


        });


    }, (error) => {

        console.error(error);

        messageList.innerHTML =
        "Error loading messages";

    });


});