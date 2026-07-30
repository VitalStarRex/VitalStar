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

// Load comments
const q = query(
    collection(db, "comments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
);

onSnapshot(q, (snapshot) => {

    commentList.innerHTML = "";

    if (snapshot.empty) {
        commentList.innerHTML = "<p>No comments yet.</p>";
        return;
    }

    snapshot.forEach((docSnap) => {

        const comment = docSnap.data();

        commentList.innerHTML += `
            <div class="comment">
                <b>${comment.username}</b><br>
                ${comment.text}
            </div>
        `;
    });

});

// Send comment
async function sendComment() {

    try {

        const text = document.getElementById("commentText").value.trim();

        if (text === "") return;

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
            postId: postId,
            uid: user.uid,
            username: username,
            text: text,
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