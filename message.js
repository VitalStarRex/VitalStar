import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
    console.error("chatList element not found.");
} else {

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

        onSnapshot(
            q,
            async (snapshot) => {

                chatList.innerHTML = "";

                for (const chatDoc of snapshot.docs) {

                    const chat = chatDoc.data();

                    if (
                        !chat.participants ||
                        !Array.isArray(chat.participants) ||
                        !chat.participants.includes(user.uid)
                    ) {
                        continue;
                    }

                    const otherUid = chat.participants.find(
                        uid => uid !== user.uid
                    );

                    if (!otherUid) continue;

                    try {

                        const userSnap = await getDoc(doc(db, "users", otherUid));

                        if (!userSnap.exists()) continue;

                        const userData = userSnap.data();

                        const chatDiv = document.createElement("div");
                        chatDiv.className = "chat";

                        const profileImage = userData.profilePicture
                            ? `<img src="${userData.profilePicture}" alt="Profile">`
                            : (userData.fullName || userData.username || "?")
                                  .charAt(0)
                                  .toUpperCase();

                        let time = "";

                        if (
                            chat.lastTimestamp &&
                            typeof chat.lastTimestamp.toDate === "function"
                        ) {
                            time = chat.lastTimestamp.toDate().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                            });
                        }

                        chatDiv.innerHTML = `
                            <div class="avatar">
                                ${profileImage}
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
                                ${time}
                            </div>
                        `;

                        chatDiv.addEventListener("click", () => {
                            window.location.href = `chat.html?uid=${otherUid}`;
                        });

                        chatList.appendChild(chatDiv);

                    } catch (err) {
                        console.error("User Load Error:", err);
                    }
                }

                if (!chatList.children.length) {
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

            },
            (error) => {
                console.error("Firestore Error:", error);

                chatList.innerHTML = `
                    <div style="
                        text-align:center;
                        padding:40px;
                        color:red;
                    ">
                        Failed to load messages.
                    </div>
                `;
            }
        );

    });

}