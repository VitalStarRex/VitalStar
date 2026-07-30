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
const profilePreview = document.getElementById("profilePreview");

const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const password = document.getElementById("password");
const bio = document.getElementById("bio");

const form = document.getElementById("editProfileForm");

let imageFile = null;

// Preview selected image
profileImage.addEventListener("change", e => {
    imageFile = e.target.files[0];

    if (imageFile) {
        profilePreview.src = URL.createObjectURL(imageFile);
    }
});

// Load current profile
auth.onAuthStateChanged(async user => {

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

});

// Upload image to Cloudinary
async function uploadImage(file) {

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", "YOUR_UPLOAD_PRESET");

    const res = await fetch(
        "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const data = await res.json();

    return data.secure_url;
}

// Save profile
form.addEventListener("submit", async e => {

    e.preventDefault();

    const user = auth.currentUser;

    if (!user) return;

    let profilePicture = profilePreview.src;

    if (imageFile) {
        profilePicture = await uploadImage(imageFile);
    }

    await updateDoc(doc(db, "users", user.uid), {

        fullName: fullName.value.trim(),
        username: username.value.trim(),
        dob: dob.value,
        bio: bio.value.trim(),
        profilePicture: profilePicture

    });

    if (email.value !== user.email) {

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

    alert("Profile updated successfully.");

    location.href = "profile.html";

}); 