import { auth } from "./firebase.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        try {

            await signOut(auth);

            alert("Logged out successfully.");

            window.location.replace("index.html");

        } catch (error) {

            console.error(error);

            alert("Logout failed. Please try again.");

        }

    });

}