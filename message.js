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

if (!chatList) {
    console.error("chatList not found");
    return;
}







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








            const chatDiv = document.createElement("div");
            chatDiv.className = "chat";

            chatDiv.innerHTML = `
                <div class="avatar">
                    ${
                        userData.profilePicture
                        ? `<img src="${userData.profilePicture}" alt="${userData.fullName}">`
                        : (userData.fullName || "?").charAt(0).toUpperCase()
                    }
                </div>

                <div class="info">
                    <div class="name">
                        ${userData.fullName || userData.username || "Unknown User"}
                    </div>

                    <div class="last">
                        ${chat.lastMessage || "Start a conversation"}
                    </div>
                </div>

                <div class="time">
                    ${
                        chat.lastTimestamp
                        ? new Date(chat.lastTimestamp.toDate()).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                          })
                        : ""
                    }
                </div>
            `;

            chatDiv.onclick = () => {
                window.location.href = `chat.html?uid=${otherUid}`;
            };

            chatList.appendChild(chatDiv);
        }

        if (chatList.innerHTML === "") {
            chatList.innerHTML = `
                <div style="
                    text-align:center;
                    padding:40px;
                    color:gray;
                ">
                    No conversations yet.
                </div>
            `;
        }

    });

});