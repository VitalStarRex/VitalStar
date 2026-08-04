import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OWNER_UID = "FvbfTXi65VgpuPtBxr8kGzBRLRr1";

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        alert("Please log in first.");
        window.location.href = "login.html";
        return;
    }

    // Only the owner can access
    if (user.uid !== OWNER_UID) {
        alert("Access Denied!");
        await auth.signOut();
        window.location.href = "index.html";
        return;
    }

    // Load owner profile (optional)
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            console.log("Owner:", userSnap.data());
        }

        console.log("Admin Dashboard Loaded");
    } catch (error) {
        console.error(error);
    }

});