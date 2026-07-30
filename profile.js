import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    updateEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const profileImage = document.getElementById("profileImage");
const coverImage = document.getElementById("coverImage");

const profilePreview = document.getElementById("profilePreview");
const coverPreview = document.getElementById("coverPreview");

const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const password = document.getElementById("password");
const bio = document.getElementById("bio");

const form = document.getElementById("editProfileForm");

let profileFile = null;
let coverFile = null;

profileImage.addEventListener("change", (e) => {

    profileFile = e.target.files[0];

    if (profileFile) {
        profilePreview.src = URL.createObjectURL(profileFile);
    }

});

coverImage.addEventListener("change", (e) => {

    coverFile = e.target.files[0];

    if (coverFile) {
        coverPreview.src = URL.createObjectURL(coverFile);
    }

});

auth.onAuthStateChanged(async (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) return;

    const data = snap.data();

    fullName.value = data.fullName || "";
    username.value = data.username || "";
    email.value = user.email || "";
    dob.value = data.dob || "";
    bio.value = data.bio || "";

    if (data.profilePicture) {
        profilePreview.src = data.profilePicture;
    }

    if (data.coverPhoto) {
        coverPreview.src = data.coverPhoto;
    }
});

async function uploadImage(file) {

    const formData = new FormData();

    formData.append("file", file);

    formData.append("upload_preset", "vitalstar_upload");


    const response = await fetch(
        "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error?.message || "Upload failed");
    }

    return result.secure_url;
}

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const user = auth.currentUser;

    if (!user) return;

    try {

        let profilePicture = profilePreview.src;
        let coverPhoto = coverPreview.src;

        if (profileFile) {
            profilePicture = await uploadImage(profileFile);
        }

        if (coverFile) {
            coverPhoto = await uploadImage(coverFile);
        }

        await updateDoc(doc(db, "users", user.uid), {

            fullName: fullName.value.trim(),
            username: username.value.trim(),
            dob: dob.value,
            bio: bio.value.trim(),
            profilePicture: profilePicture,
            coverPhoto: coverPhoto

        });

        if (email.value.trim() !== user.email) {

            try {
                await updateEmail(user, email.value.trim());
            } catch (err) {
                alert(err.message);
            }

        }

        if (password.value.trim() !== "") {

            try {
                await updatePassword(user, password.value.trim());
            } catch (err) {
                alert(err.message);
            }

        }

        alert("Profile updated successfully!");

        window.location.href = "profile.html";

    } catch (error) {

        console.error(error);
        alert(error.message);

    }

});