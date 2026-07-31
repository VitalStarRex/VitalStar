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


        if (snapshot.empty) {
            messageList.innerHTML = "No messages yet";
            return;
        }


        for (const chatDoc of snapshot.docs) {

            const chat = chatDoc.data();


            const otherUserId = chat.participants.find(
                id => id !== user.uid
            );


            let fullName = "Unknown User";
            let profilePic = "default.png";


            const userSnap = await getDoc(
                doc(db, "users", otherUserId)
            );


            if (userSnap.exists()) {

                const userData = userSnap.data();


                fullName =
                userData.fullName ||
                userData.username ||
                "Unknown User";


                profilePic =
                userData.profilePic ||
                userData.photoURL ||
                userData.photoUrl ||
                userData.profileImage ||
                userData.imageUrl ||
                "default.png";

            }


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
            onerror="this.src='default.png'"
            class="profile-picture">


            <div class="message-info">

                <div class="name">
                    ${fullName}
                </div>


                <div class="last-message">
                    ${chat.lastMessage || "No message"}
                </div>


                <div class="time">
                    ${status}
                </div>

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