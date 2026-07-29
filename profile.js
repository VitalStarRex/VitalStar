import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

try {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    document.getElementById("name").textContent = "UID: " + uid;

    const userSnap = await getDoc(doc(db, "users", uid));

    if (userSnap.exists()) {
        const user = userSnap.data();

        document.getElementById("name").textContent = user.username;
        document.getElementById("bio").textContent = user.bio || "No bio yet.";
        document.getElementById("posts").textContent = user.posts || 0;
        document.getElementById("followers").textContent = user.followers || 0;
        document.getElementById("following").textContent = user.following || 0;
    } else {
        document.getElementById("name").textContent = "User not found";
    }

} catch (error) {
    document.getElementById("name").textContent = error.message;
}