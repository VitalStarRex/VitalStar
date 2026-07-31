import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  updateEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Images
const profileImage = document.getElementById("profileImage");
const profilePreview = document.getElementById("profilePreview");

const coverImage = document.getElementById("coverImage");
const coverPreview = document.getElementById("coverPreview");

// Form Fields
const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const country = document.getElementById("country");
const bio = document.getElementById("bio");
const password = document.getElementById("password");

const form = document.getElementById("editProfileForm");

// Selected Files
let imageFile = null;
let coverFile = null;

// Profile Picture Preview
profileImage.addEventListener("change", (e) => {
    imageFile = e.target.files[0];

    if (imageFile) {
        profilePreview.src = URL.createObjectURL(imageFile);
    }
});

// Cover Photo Preview
coverImage.addEventListener("change", (e) => {
    coverFile = e.target.files[0];

    if (coverFile) {
        coverPreview.src = URL.createObjectURL(coverFile);
    }
});

// Load User Profile
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            alert("Profile not found.");
            return;
        }

        const data = snap.data();

        fullName.value = data.fullName || "";
        username.value = data.username || "";
        email.value = user.email || "";
        dob.value = data.dob || "";
        country.value = data.country || "";
        bio.value = data.bio || "";

        if (data.profilePicture) {
            profilePreview.src = data.profilePicture;
        }

        if (data.coverPhoto) {
            coverPreview.src = data.coverPhoto;
        }

    } catch (err) {
        console.error("Load Profile Error:", err);
        alert("Failed to load profile.");
    }

});

// Upload image to Cloudinary
async function uploadImage(file) {

    const formData = new FormData();

    formData.append("file", file);

    // Correct upload preset
    formData.append("upload_preset", "vitalstar-upload");

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








// Save Profile
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        alert("Please log in first.");
        return;
    }

    try {

        let profilePicture = profilePreview.src;
        let coverPhoto = coverPreview.src;

        // Upload new profile picture
        if (imageFile) {
            profilePicture = await uploadImage(imageFile);
        }

        // Upload new cover photo
        if (coverFile) {
            coverPhoto = await uploadImage(coverFile);
        }

        // Update Firestore profile
        await updateDoc(doc(db, "users", user.uid), {
            fullName: fullName.value.trim(),
            username: username.value.trim(),
            dob: dob.value,
            country: country.value.trim(),
            bio: bio.value.trim(),
            profilePicture,
            coverPhoto
        });

        // Update email if changed
        if (
            email.value.trim() &&
            email.value.trim() !== user.email
        ) {
            try {
                await updateEmail(user, email.value.trim());
            } catch (err) {
                console.error("Email Update Error:", err);
                alert(
                    "Email could not be updated. Please log out and log in again before changing your email."
                );
            }
        }

        // Update password if entered
        if (password.value.trim()) {
            try {
                await updatePassword(user, password.value.trim());
            } catch (err) {
                console.error("Password Update Error:", err);
                alert(
                    "Password could not be updated. Please log out and log in again before changing your password."
                );
            }
        }

        alert("Profile updated successfully!");

        window.location.href = "profile.html";

    } catch (err) {
        console.error("Profile Update Error:", err);
        alert(err.message || "Failed to update profile.");
    }

});