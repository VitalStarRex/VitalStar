import { db, auth } from "./firebase.js";

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const postId = params.get("postId");

const commentList = document.getElementById("commentList");

const q = query(
    collection(db, "comments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
);

onSnapshot(q, (snapshot) => {

    commentList.innerHTML = "";

    if (snapshot.empty) {
        commentList.innerHTML =
        "<p style='text-align:center;'>No comments yet.</p>";
        return;
    }

    snapshot.forEach((docSnap) => {

        const comment = docSnap.data();

        let date = "Just now";

        if (comment.createdAt) {
            try {
                date = comment.createdAt.toDate().toLocaleString();
            } catch (e) {}
        }

        commentList.innerHTML += `
        <div class="comment">

            <div style="display:flex;align-items:center;gap:10px;">

                <div style="
                width:45px;
                height:45px;
                border-radius:50%;
                background:#1877f2;
                color:white;
                display:flex;
                justify-content:center;
                align-items:center;
                font-size:22px;">
                👤
                </div>

                <div>
                    <b>${comment.username}</b><br>
                    <small style="color:gray;">${date}</small>
                </div>

            </div>

            <p style="margin-top:10px;">
                ${comment.text}
            </p>

        </div>
        `;

    });

});

async function sendComment() {

    try {

        const text = document.getElementById("commentText").value.trim();

        if (!text) {
            alert("Write a comment first.");
            return;
        }

        const user = auth.currentUser;

        if (!user) {
            alert("Please log in first.");
            return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));

        let username = "VitalStar User";

        if (userDoc.exists()) {
            username = userDoc.data().username || "VitalStar User";
        }

        await addDoc(collection(db, "comments"), {
            postId,
            uid: user.uid,
            username,
            text,
            createdAt: serverTimestamp()
        });

        await updateDoc(doc(db, "posts", postId), {
            comments: increment(1)
        });

        document.getElementById("commentText").value = "";

    } catch (error) {
        console.error(error);
        alert(error.message);
    }

}

window.sendComment = sendComment;