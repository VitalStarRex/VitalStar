import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const notifications = document.getElementById("notifications");


auth.onAuthStateChanged((user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }


    const q = query(
        collection(db, "notifications"),
        where("receiverId", "==", user.uid),
        orderBy("createdAt", "desc")
    );


    onSnapshot(q, (snapshot) => {

        notifications.innerHTML = "";


        if (snapshot.empty) {

            notifications.innerHTML = `
            <div class="loading">
                No notifications yet.
            </div>
            `;

            return;
        }


        snapshot.forEach((notificationDoc) => {

            const notification = notificationDoc.data();


            let time = "Just now";

            if (notification.createdAt) {

                time = notification.createdAt
                    .toDate()
                    .toLocaleString();

            }


            const card = document.createElement("div");

            card.className = "notification-card";


            card.innerHTML = `

                <img 
                src="${notification.senderPhoto || 'https://via.placeholder.com/50'}"
                class="notification-photo">


                <div class="notification-text">

                    <b>${notification.senderName || "Someone"}</b>

                    <br>

                    ${notification.text || "New notification"}

                    <br>

                    <small>${time}</small>

                </div>


                ${
                    notification.read
                    ? ""
                    : `<span class="unread-dot">●</span>`
                }

            `;



            card.onclick = async () => {

                try {

                    await updateDoc(
                        doc(db, "notifications", notificationDoc.id),
                        {
                            read: true
                        }
                    );


                    if (notification.postId) {

                        window.location.href =
                        "comments.html?postId=" + notification.postId;


                    } else if (notification.senderId) {

                        window.location.href =
                        "profile.html?uid=" + notification.senderId;

                    }


                } catch(error) {

                   alert(error.message);
                       
                        
             

                }

            };


            notifications.appendChild(card);


        });



    }, (error) => {


        console.log(
            "Notification loading error:",
            error
        );


        notifications.innerHTML = `

        <div class="loading">

            Failed to load notifications.

        </div>

        `;


    });


});