import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const coverPhoto = document.getElementById("coverPhoto");
const profilePicture = document.getElementById("profilePicture");
const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const bio = document.getElementById("bio");
const dob = document.getElementById("dob");

const posts = document.getElementById("posts");
const followers = document.getElementById("followers");
const following = document.getElementById("following");

const editProfileBtn = document.getElementById("editProfileBtn");
const followBtn = document.getElementById("followBtn");
const messageBtn = document.getElementById("messageBtn");

auth.onAuthStateChanged(async (currentUser) => {

    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);

    const uid = params.get("uid") || currentUser.uid;

    const isMyProfile = uid === currentUser.uid;

    if (isMyProfile) {

        editProfileBtn.style.display = "inline-block";
        followBtn.style.display = "none";
        messageBtn.style.display = "none";

        editProfileBtn.onclick = () => {
            window.location.href = "edit-profile.html";
        };

    } else {

        editProfileBtn.style.display = "none";
        followBtn.style.display = "inline-block";
        messageBtn.style.display = "inline-block";

    }

    try {

        const snap = await getDoc(doc(db, "users", uid));

        if (!snap.exists()) {

            fullName.textContent = "User not found";

            return;

        }

        const user = snap.data();




        fullName.textContent = user.fullName || "Unknown User";
        username.textContent = "@" + (user.username || "username");
        bio.textContent = user.bio || "No bio yet.";

        if (user.dob) {
            dob.textContent = "Date of Birth: " + user.dob;
        } else {
            dob.textContent = "";
        }

        posts.textContent = user.posts || 0;
        followers.textContent = user.followers || 0;
        following.textContent = user.following || 0;

        if (user.profilePicture) {
            profilePicture.src = user.profilePicture;
        }

        if (user.coverPhoto) {
            coverPhoto.src = user.coverPhoto;
        }

    } catch (error) {

        console.error(error);

        fullName.textContent = "Error loading profile";

    }

});