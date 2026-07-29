import { db, auth } from "./firebase.js";

import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.createPost = async function () {

    const text = document.getElementById("postText").value.trim();

    if (!text) {
        alert("Write something first.");
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        alert("Please login first.");
        return;
    }

    // Get user's profile
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let username = "VitalStar User";

    if (userSnap.exists()) {
        username = userSnap.data().username || "VitalStar User";
    }

    await addDoc(collection(db, "posts"), {
        uid: user.uid,
        username: username,
        text: text,
        likes: 0,
        comments: 0,
        shares: 0,
        reposts: 0,
        createdAt: serverTimestamp()
    });

    document.getElementById("postText").value = "";

    alert("Post created successfully!");
};