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
profileImage.addEventListener("change", (e) => {
    imageFile = e.target.files[0];

    if (imageFile) {
        profilePreview.src = URL.createObjectURL(imageFile);
    }
});

// Load current user's profile
auth.onAuthStateChanged(async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {

            const data = snap.data();

            fullName.value = data.fullName || "";
            username.value = data.username || "";
            email.value = user.email || "";
            dob.value = data.dob || "";
            bio.value = data.bio || "";

            if (data.profilePicture) {
                profilePreview.src = data.profilePicture;
            }

        }

    } catch (err) {
        console.error(err);
        alert("Failed to load profile.");
    }

});

// Upload image to Cloudinary
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
        throw new Error(result.error?.message || "Image upload failed.");
    }

    return result.secure_url;
}

// Save profile
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        alert("Please log in first.");
        return;
    }

    try {

        let profilePicture = profilePreview.src;

        // Upload new image if selected
        if (imageFile) {
            profilePicture = await uploadImage(imageFile);
        }

        // Save to Firestore
        await updateDoc(doc(db, "users", user.uid), {
            fullName: fullName.value.trim(),
            username: username.value.trim(),
            dob: dob.value,
            bio: bio.value.trim(),
            profilePicture: profilePicture
        });

        // Update email if changed
        if (email.value.trim() !== user.email) {
            await updateEmail(user, email.value.trim());
        }

        // Update password if entered
        if (password.value.trim() !== "") {
            await updatePassword(user, password.value.trim());
        }

        alert("Profile updated successfully!");

        window.location.href = "profile.html";

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

});