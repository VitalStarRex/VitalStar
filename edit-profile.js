import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc,
    deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged,
    verifyBeforeUpdateEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    reload
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ============================================================
// VITALSTAR — EDIT PROFILE
// ============================================================
// Features:
// - Profile picture
// - Cover photo
// - Personal information
// - Verified email change
// - Automatic Firestore email synchronization
// - Pending email support
// - Password change
// - Profile privacy
// - Submit/loading indicator
// - Dark theme support
// ============================================================


// ============================================================
// DARK THEME
// ============================================================

document.documentElement.classList.add("dark-theme");

if (document.body) {
    document.body.classList.add("dark-theme");
}


// ============================================================
// IMAGES
// ============================================================

const profileImage = document.getElementById("profileImage");
const profilePreview = document.getElementById("profilePreview");

const coverImage = document.getElementById("coverImage");
const coverPreview = document.getElementById("coverPreview");


// ============================================================
// FORM FIELDS
// ============================================================

const fullName = document.getElementById("fullName");
const gender = document.getElementById("gender");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const country = document.getElementById("country");
const bio = document.getElementById("bio");
const password = document.getElementById("password");

const profilePrivacy = document.getElementById("profilePrivacy");

const form = document.getElementById("editProfileForm");


// ============================================================
// SUBMIT BUTTON
// ============================================================

const submitButton = form?.querySelector(
    'button[type="submit"], input[type="submit"]'
);


// ============================================================
// SELECTED FILES
// ============================================================

let imageFile = null;
let coverFile = null;


// ============================================================
// PROFILE PICTURE PREVIEW
// ============================================================

if (profileImage) {

    profileImage.addEventListener("change", (e) => {

        imageFile = e.target.files[0];

        if (imageFile && profilePreview) {
            profilePreview.src = URL.createObjectURL(imageFile);
        }

    });

}


// ============================================================
// COVER PHOTO PREVIEW
// ============================================================

if (coverImage) {

    coverImage.addEventListener("change", (e) => {

        coverFile = e.target.files[0];

        if (coverFile && coverPreview) {
            coverPreview.src = URL.createObjectURL(coverFile);
        }

    });

}


// ============================================================
// LOAD USER PROFILE + SYNCHRONIZE EMAIL
// ============================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        await reload(user);

        const userRef = doc(db, "users", user.uid);

        const snap = await getDoc(userRef);

        if (!snap.exists()) {

            alert("Profile not found.");
            return;

        }

        const data = snap.data();

        // ====================================================
        // AUTOMATIC EMAIL SYNCHRONIZATION
        // ====================================================

        if (
            user.email &&
            data.email !== user.email
        ) {

            await updateDoc(userRef, {
                email: user.email,
                pendingEmail: deleteField()
            });

        }


        // ====================================================
        // LOAD BASIC INFORMATION
        // ====================================================

        if (fullName) {
            fullName.value = data.fullName || "";
        }

        if (gender) {
            gender.value = data.gender || "";
        }

        if (email) {
            email.value = user.email || "";
        }

        if (dob) {
            dob.value = data.dob || "";
        }

        if (country) {
            country.value = data.country || "";
        }

        if (bio) {
            bio.value = data.bio || "";
        }


        // ====================================================
        // LOAD PROFILE PRIVACY
        // ====================================================

        if (profilePrivacy) {

            profilePrivacy.value =
                data.profilePrivacy || "public";

        }


        // ====================================================
        // LOAD PROFILE PICTURE
        // ====================================================

        if (data.profilePicture && profilePreview) {

            profilePreview.src = data.profilePicture;

        }


        // ====================================================
        // LOAD COVER PHOTO
        // ====================================================

        if (data.coverPhoto && coverPreview) {

            coverPreview.src = data.coverPhoto;

        }

    } catch (err) {

        console.error("Load Profile Error:", err);

        alert("Failed to load profile.");

    }

});


// ============================================================
// UPLOAD IMAGE TO CLOUDINARY
// ============================================================

async function uploadImage(file) {

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        "vitalstar_upload"
    );

    const response = await fetch(
        "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const result = await response.json();

    if (!response.ok) {

        throw new Error(
            result.error?.message ||
            "Image upload failed."
        );

    }

    return result.secure_url;

}


// ============================================================
// SUBMIT INDICATOR
// ============================================================

function setSubmitting(isSubmitting) {

    if (!submitButton) {
        return;
    }

    if (isSubmitting) {

        submitButton.disabled = true;

        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent = "Saving...";

        submitButton.classList.add("submitting");

    } else {

        submitButton.disabled = false;

        if (submitButton.dataset.originalText) {

            submitButton.textContent =
                submitButton.dataset.originalText;

        }

        submitButton.classList.remove("submitting");

    }

}


// ============================================================
// SAVE PROFILE
// ============================================================

if (form) {

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const user = auth.currentUser;

        if (!user) {

            alert("Please log in first.");

            return;

        }

        if (submitButton && submitButton.disabled) {
            return;
        }

        setSubmitting(true);

        let emailVerificationSent = false;

        try {

            await reload(user);

            // =================================================
            // CURRENT IMAGE URLS
            // =================================================

            let profilePicture =
                profilePreview?.src || "";

            let coverPhoto =
                coverPreview?.src || "";


            // =================================================
            // UPLOAD NEW PROFILE PICTURE
            // =================================================

            if (imageFile) {

                profilePicture = await uploadImage(imageFile);

            }


            // =================================================
            // UPLOAD NEW COVER PHOTO
            // =================================================

            if (coverFile) {

                coverPhoto = await uploadImage(coverFile);

            }


            // =================================================
            // PROFILE PRIVACY
            // =================================================

            const privacyValue =
                profilePrivacy?.value || "public";

            const profilePrivacyValue =
                privacyValue === "friends"
                    ? "friends"
                    : "public";


            // =================================================
            // UPDATE FIRESTORE PROFILE
            // =================================================

            const userRef = doc(db, "users", user.uid);

            await updateDoc(userRef, {

                fullName:
                    fullName?.value.trim() || "",

                gender:
                    gender?.value.trim() || "",

                dob:
                    dob?.value || "",

                country:
                    country?.value.trim() || "",

                bio:
                    bio?.value.trim() || "",

                profilePicture,

                coverPhoto,

                profilePrivacy: profilePrivacyValue

            });


            // =================================================
            // CHANGE EMAIL — VERIFIED
            // =================================================

            const newEmail = email?.value.trim() || "";

            const currentEmail = user.email || "";

            if (
                newEmail &&
                newEmail.toLowerCase() !==
                currentEmail.toLowerCase()
            ) {

                const currentPassword = prompt(
                    "Enter your current password to change your email:"
                );

                if (!currentPassword) {

                    alert(
                        "Email change cancelled. Your other profile changes were saved."
                    );

                } else {

                    try {

                        // Re-authenticate existing account

                        const credential =
                            EmailAuthProvider.credential(
                                currentEmail,
                                currentPassword
                            );

                        await reauthenticateWithCredential(
                            user,
                            credential
                        );


                        // Save pending email first.
                        // Do NOT replace the active email yet.

                        await updateDoc(userRef, {

                            pendingEmail: newEmail

                        });


                        // Send verification to the new email

                        await verifyBeforeUpdateEmail(
                            user,
                            newEmail
                        );

                        emailVerificationSent = true;

                    } catch (err) {

                        console.error(
                            "Email Update Error:",
                            err
                        );

                        // Remove pending email if request failed

                        if (!emailVerificationSent) {

                            try {

                                await updateDoc(userRef, {
                                    pendingEmail: deleteField()
                                });

                            } catch (cleanupError) {

                                console.error(
                                    "Pending Email Cleanup Error:",
                                    cleanupError
                                );

                            }

                        }


                        if (
                            err.code === "auth/wrong-password" ||
                            err.code === "auth/invalid-credential"
                        ) {

                            alert(
                                "Your current password is incorrect. Your email was not changed."
                            );

                        } else if (
                            err.code === "auth/invalid-email"
                        ) {

                            alert(
                                "The new email address is invalid."
                            );

                        } else if (
                            err.code === "auth/email-already-in-use"
                        ) {

                            alert(
                                "That email is already being used by another account."
                            );

                        } else if (
                            err.code === "auth/requires-recent-login"
                        ) {

                            alert(
                                "Please log out and log in again before changing your email."
                            );

                        } else {

                            alert(
                                err.message ||
                                "Email change failed."
                            );

                        }

                    }

                }

            }


            // =================================================
            // CHANGE PASSWORD
            // =================================================

            if (password?.value) {

                try {

                    await updatePassword(
                        user,
                        password.value
                    );

                    password.value = "";

                } catch (err) {

                    console.error(
                        "Password Update Error:",
                        err
                    );

                    if (
                        err.code === "auth/requires-recent-login"
                    ) {

                        alert(
                            "Your password could not be changed. Please log out and log in again, then try again."
                        );

                    } else if (
                        err.code === "auth/weak-password"
                    ) {

                        alert(
                            "Your new password is too weak. Please choose a stronger password."
                        );

                    } else {

                        alert(
                            err.message ||
                            "Password could not be updated."
                        );

                    }

                }

            }


            // =================================================
            // SUCCESS MESSAGE
            // =================================================

            if (emailVerificationSent) {

                alert(
                    "Profile saved! A verification link has been sent to your new email. After verifying, log in with your username and password. VitalStar will synchronize your email automatically."
                );

            } else {

                alert("Profile updated successfully!");

            }


            // =================================================
            // REDIRECT
            // =================================================

            window.location.href = "profile.html";


        } catch (err) {

            console.error(
                "Profile Update Error:",
                err
            );

            alert(
                err.message ||
                "Failed to update profile."
            );

        } finally {

            setSubmitting(false);

        }

    });

}