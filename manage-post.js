import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OWNER_UID = "FvbfTXi65VgpuPtBxr8kGzBRLRr1";

const postsContainer = document.getElementById("posts");
const searchInput = document.getElementById("search");

let allPosts = [];

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    if (user.uid !== OWNER_UID) {
        alert("Access Denied!");
        location.href = "index.html";
        return;
    }

    loadPosts();

});

async function loadPosts() {

    postsContainer.innerHTML = "<h3>Loading posts...</h3>";

    try {

        const q = query(
            collection(db, "posts"),
            orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        allPosts = [];

        snapshot.forEach(docSnap => {

            allPosts.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });

        renderPosts(allPosts);

    } catch (error) {

        console.error(error);
        postsContainer.innerHTML =
            "<h3>Failed to load posts.</h3>";

    }

}

function renderPosts(posts) {

    posts