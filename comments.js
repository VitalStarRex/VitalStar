import { db } from "./firebase.js";

import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

alert("comments.js loaded");

const commentList = document.getElementById("commentList");

onSnapshot(collection(db, "comments"), (snapshot) => {

    commentList.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const comment = docSnap.data();

        commentList.innerHTML += `
            <div class="comment">
                <b>${comment.username}</b><br>
                ${comment.text}
            </div>
        `;

    });

}, (error) => {
    alert(error.message);
    console.error(error);
});