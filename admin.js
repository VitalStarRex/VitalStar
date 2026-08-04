import { auth } from "./firebase.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const panel = document.getElementById("adminPanel");
const error = document.getElementById("error");

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    const token = await user.getIdTokenResult();

    if (token.claims.admin) {
        panel.style.display = "block";
    } else {
        error.textContent = "Access denied.";
    }

});