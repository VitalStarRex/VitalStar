import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where,
    getDoc,
    doc
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


    onSnapshot(q, async (snapshot) => {

        messageList.innerHTML = "";


        for (const chatDoc of snapshot.docs) {

            const chat = chatDoc.data();


            const otherUserId = chat.participants.find(
                id => id !== user.uid
            );


            let fullName = "Unknown User";
            let profilePic = "default.png";


            // Get user profile
            const userSnap = await getDoc(
                doc(db, "users", otherUserId)
            );


            if (userSnap.exists()) {

                const userData = userSnap.data();

                fullName = userData.fullName || "Unknown User";

                profilePic = userData.profilePic || "default.png";

            }


            // Message status
            let status = "Sent ✓";


            if (chat.read === true) {
                status = "Read ✓✓";
            }


            if (chat.read === false) {
                status = "Unread 🔴";
            }


            const div = document.createElement("div");

            div.className = "message-card";


            div.innerHTML = `

                <img 
                src="${profilePic}"
                style="
                width:45px;
                height:45px;
                border-radius:50%;
                object-fit:cover;
                vertical-align:middle;
                margin-right:10px;
                ">

                <span class="name">
                ${fullName}
                </span>


                <div class="last-message">
                ${chat.lastMessage || ""}
                </div>


                <div class="time">
                ${status}
                </div>

            `;


            div.onclick = () => {

                window.location.href =
                `chat.html?uid=${otherUserId}`;

            };


            messageList.appendChild(div);

        }

    });

});