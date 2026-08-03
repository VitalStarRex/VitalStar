import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const container = document.getElementById("postContainer");

const postId = new URLSearchParams(window.location.search).get("id");

if (!postId) {
    container.innerHTML = `
        <p style="text-align:center;color:red;">
            Invalid post link.
        </p>
    `;
} else {

    loadPost();

}

async function loadPost() {

    try {

        const postSnap = await getDoc(doc(db, "posts", postId));

        if (!postSnap.exists()) {

            container.innerHTML = `
                <p style="text-align:center;">
                    Post not found.
                </p>
            `;
            return;

        }

        const post = postSnap.data();

        let date = "Just now";

        if (post.createdAt) {

            try {
                date = post.createdAt.toDate().toLocaleString();
            } catch (e) {}

        }

        container.innerHTML = `

<div class="post-card">

    <h2>${post.fullName || "VitalStar User"}</h2>

    <small>${date}</small>

    <p>${post.text || ""}</p>

    ${post.image ? `
        <img class="post-photo"
             src="${post.image}"
             alt="Post Image">
    ` : ""}

    ${post.video ? `
        <video class="post-video" controls>
            <source src="${post.video}" type