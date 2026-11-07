
import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc,
    deleteField,
    serverTimestamp
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

const COOLDOWN = 30 * 24 * 60 * 60 * 1000;

const profileImage = document.getElementById("profileImage");
const profilePreview = document.getElementById("profilePreview");
const profileUploadStatus = document.getElementById("profileUploadStatus");

const coverImage = document.getElementById("coverImage");
const coverPreview = document.getElementById("coverPreview");
const coverUploadStatus = document.getElementById("coverUploadStatus");

const fullName = document.getElementById("fullName");
const gender = document.getElementById("gender");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const country = document.getElementById("country");
const bio = document.getElementById("bio");
const password = document.getElementById("password");

const profilePrivacy = document.getElementById("profilePrivacy");
const form = document.getElementById("editProfileForm");

const submitButton = document.getElementById("saveProfileButton");
const saveButtonText = document.getElementById("saveButtonText");

const nicknameStatus = document.getElementById("nicknameStatus");

let imageFile = null;
let coverFile = null;

let originalNickname = "";
let nicknameChangedAt = null;
let nicknameLockedUntil = 0;
let loadedUserData = null;


// ============================================================
// SMALL STATUS MESSAGE
// ============================================================

function setStatus(element, message, loading = false) {
    if (!element) return;

    element.innerHTML = loading
        ? '<span class="mini-spinner"></span>' + message
        : message;
}


// ============================================================
// NICKNAME COOLDOWN
// ============================================================

function getTimestampMillis(timestamp) {

    if (!timestamp) return 0;

    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }

    if (typeof timestamp === "number") {
        return timestamp;
    }

    return 0;
}


function updateNicknameStatus() {

    if (!fullName || !nicknameStatus) return;

    const now = Date.now();

    const locked = nicknameLockedUntil > now;

    fullName.disabled = locked;

    if (locked) {

        const remaining = Math.ceil(
            (nicknameLockedUntil - now) / (24 * 60 * 60 * 1000)
        );

        const availableDate = new Date(nicknameLockedUntil);

        nicknameStatus.className =
            "nickname-info nickname-locked";

        nicknameStatus.textContent =
            "🔒 Nickname changes are locked. You can edit again on " +
            availableDate.toLocaleDateString() +
            " (" + remaining + " days remaining).";

    } else {

        nicknameStatus.className =
            "nickname-info nickname-available";

        nicknameStatus.textContent =
            nicknameChangedAt
                ? "✓ Your nickname can now be changed."
                : "You can change your nickname once every 30 days.";

    }
}


// ============================================================
// PROFILE PICTURE PREVIEW
// ============================================================

profileImage?.addEventListener("change", (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        profileImage.value = "";
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        alert("Profile picture must be smaller than 8MB.");
        profileImage.value = "";
        return;
    }

    imageFile = file;

    profilePreview.src = URL.createObjectURL(file);

    setStatus(profileUploadStatus, "✓ New picture selected");

});


// ============================================================
// COVER PHOTO PREVIEW
// ============================================================

coverImage?.addEventListener("change", (event) => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        coverImage.value = "";
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        alert("Cover photo must be smaller than 8MB.");
        coverImage.value = "";
        return;
    }

    coverFile = file;

    coverPreview.src = URL.createObjectURL(file);

    setStatus(coverUploadStatus, "✓ New cover selected");

});


// ============================================================
// MODERN CUSTOM CALENDAR
// ============================================================

const calendarToggle = document.getElementById("calendarToggle");
const calendarPopup = document.getElementById("calendarPopup");
const calendarDays = document.getElementById("calendarDays");
const calendarMonthYear = document.getElementById("calendarMonthYear");

const dobDisplay = document.getElementById("dobDisplay");

let calendarDate = new Date();
calendarDate.setDate(1);

function dateToISO(date) {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function setDob(value) {

    if (!dob) return;

    dob.value = value || "";

    if (!value) {

        dobDisplay.textContent = "Choose your date of birth";

        return;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    dobDisplay.textContent = date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

    calendarDate = new Date(year, month - 1, 1);
}


function renderCalendar() {

    if (!calendarDays || !calendarMonthYear) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selected = dob.value;

    calendarMonthYear.textContent =
        calendarDate.toLocaleDateString(
            undefined,
            {
                month: "long",
                year: "numeric"
            }
        );

    calendarDays.innerHTML = "";

    for (let i = 0; i < firstDay; i++) {

        const blank = document.createElement("span");

        calendarDays.appendChild(blank);

    }

    for (let day = 1; day <= daysInMonth; day++) {

        const current = new Date(year, month, day);

        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";
        button.textContent = day;

        const value = dateToISO(current);

        if (value === selected) {
            button.classList.add("selected");
        }

        if (current > today) {
            button.disabled = true;
        }

        button.addEventListener("click", () => {

            setDob(value);

            calendarPopup.hidden = true;

        });

        calendarDays.appendChild(button);

    }

}


calendarToggle?.addEventListener("click", () => {

    calendarPopup.hidden = !calendarPopup.hidden;

    if (!calendarPopup.hidden) {
        renderCalendar();
    }

});


document.getElementById("prevMonth")?.addEventListener("click", () => {

    calendarDate.setMonth(calendarDate.getMonth() - 1);

    renderCalendar();

});


document.getElementById("nextMonth")?.addEventListener("click", () => {

    const next = new Date(calendarDate);

    next.setMonth(next.getMonth() + 1);

    const currentMonth = new Date();

    if (
        next.getFullYear() > currentMonth.getFullYear() ||
        (
            next.getFullYear() === currentMonth.getFullYear() &&
            next.getMonth() > currentMonth.getMonth()
        )
    ) {
        return;
    }

    calendarDate = next;

    renderCalendar();

});


document.getElementById("clearDob")?.addEventListener("click", () => {

    setDob("");

    calendarPopup.hidden = true;

});


document.getElementById("todayDob")?.addEventListener("click", () => {

    const today = new Date();

    setDob(dateToISO(today));

    calendarPopup.hidden = true;

});


document.addEventListener("click", (event) => {

    if (
        calendarPopup &&
        !calendarPopup.hidden &&
        !event.target.closest(".calendar-wrap")
    ) {
        calendarPopup.hidden = true;
    }

});


// ============================================================
// LOAD USER PROFILE
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

        loadedUserData = data;

        // EMAIL SYNCHRONIZATION

        if (user.email && data.email !== user.email) {

            await updateDoc(userRef, {
                email: user.email,
                pendingEmail: deleteField()
            });

        }

        // BASIC INFORMATION

        originalNickname = data.fullName || "";

        if (fullName) {
            fullName.value = originalNickname;
        }

        nicknameChangedAt = data.fullNameLastChangedAt || null;

        const lastChange = getTimestampMillis(nicknameChangedAt);

        nicknameLockedUntil = lastChange
            ? lastChange + COOLDOWN
            : 0;

        updateNicknameStatus();

        if (gender) {

            const savedGender = data.gender || "";

            gender.value =
                ["Male", "Female"].includes(savedGender)
                    ? savedGender
                    : "";

        }

        if (email) {
            email.value = user.email || "";
        }

        if (country) {
            country.value = data.country || "";
        }

        if (bio) {
            bio.value = data.bio || "";
        }

        if (profilePrivacy) {
            profilePrivacy.value = data.profilePrivacy || "public";
        }

        setDob(data.dob || "");

        // PROFILE IMAGE

        if (data.profilePicture && profilePreview) {
            profilePreview.src = data.profilePicture;
        }

        // COVER IMAGE

        if (data.coverPhoto && coverPreview) {
            coverPreview.src = data.coverPhoto;
        }

    } catch (error) {

        console.error("Load Profile Error:", error);

        alert("Failed to load profile.");

    }

});


// ============================================================
// CLOUDINARY IMAGE UPLOAD
// ============================================================

async function uploadImage(file, statusElement, label) {

    setStatus(statusElement, "Uploading " + label + "...", true);

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

        throw new Error(
            result.error?.message || label + " upload failed."
        );

    }

    setStatus(statusElement, "✓ " + label + " uploaded");

    return result.secure_url;

}


// ============================================================
// SUBMIT INDICATOR
// ============================================================

function setSubmitting(isSubmitting) {

    if (!submitButton || !saveButtonText) return;

    submitButton.disabled = isSubmitting;

    if (isSubmitting) {

        saveButtonText.innerHTML =
            '<span class="save-spinner"></span> Saving...';

    } else {

        saveButtonText.textContent = "Save Changes";

    }

}


// ============================================================
// SAVE PROFILE
// ============================================================

if (form) {

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const user = auth.currentUser;

        if (!user) {
            alert("Please log in first.");
            return;
        }

        if (submitButton.disabled) return;

        const newNickname = fullName.value.trim();

        if (!newNickname) {
            alert("Please enter a nickname.");
            return;
        }

        if (!["Male", "Female"].includes(gender.value)) {
            alert("Please select Male or Female.");
            return;
        }

        // NICKNAME COOLDOWN CHECK

        const nicknameChanged = newNickname !== originalNickname;

        if (nicknameChanged && Date.now() < nicknameLockedUntil) {

            updateNicknameStatus();

            alert(
                "You can only change your nickname once every 30 days."
            );

            return;

        }

        setSubmitting(true);

        let emailVerificationSent = false;

        try {

            await reload(user);

            const userRef = doc(db, "users", user.uid);

            // GET CURRENT IMAGE URLS

            let profilePicture = profilePreview.src;
            let coverPhoto = coverPreview.src;

            // PROFILE IMAGE UPLOAD

            if (imageFile) {

                profilePicture = await uploadImage(
                    imageFile,
                    profileUploadStatus,
                    "Profile picture"
                );

            }

            // COVER IMAGE UPLOAD

            if (coverFile) {

                coverPhoto = await uploadImage(
                    coverFile,
                    coverUploadStatus,
                    "Cover photo"
                );

            }

            // PRIVACY

            const profilePrivacyValue =
                profilePrivacy.value === "friends"
                    ? "friends"
                    : "public";

            // PROFILE UPDATE

            const updates = {

                gender: gender.value,

                dob: dob.value,

                country: country.value.trim(),

                bio: bio.value.trim(),

                profilePicture,

                coverPhoto,

                profilePrivacy: profilePrivacyValue

            };

            // Only update nickname when it actually changes.

            if (nicknameChanged) {

                updates.fullName = newNickname;

                updates.fullNameLastChangedAt = serverTimestamp();

            }

            await updateDoc(userRef, updates);

            // EMAIL CHANGE

            const newEmail = email.value.trim();

            const currentEmail = user.email || "";

            if (
                newEmail &&
                newEmail.toLowerCase() !== currentEmail.toLowerCase()
            ) {

                const currentPassword = prompt(
                    "Enter your current password to change your email:"
                );

                if (!currentPassword) {

                    alert(
                        "Email change cancelled. Other profile changes were saved."
                    );

                } else {

                    try {

                        const credential =
                            EmailAuthProvider.credential(
                                currentEmail,
                                currentPassword
                            );

                        await reauthenticateWithCredential(
                            user,
                            credential
                        );

                        await updateDoc(userRef, {
                            pendingEmail: newEmail
                        });

                        await verifyBeforeUpdateEmail(user, newEmail);

                        emailVerificationSent = true;

                    } catch (error) {

                        console.error("Email Update Error:", error);

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

                        if (
                            error.code === "auth/wrong-password" ||
                            error.code === "auth/invalid-credential"
                        ) {

                            alert("Your current password is incorrect.");

                        } else if (error.code === "auth/invalid-email") {

                            alert("The new email address is invalid.");

                        } else if (
                            error.code === "auth/email-already-in-use"
                        ) {

                            alert("That email is already in use.");

                        } else if (
                            error.code === "auth/requires-recent-login"
                        ) {

                            alert("Please log out and log in again before changing your email.");

                        } else {

                            alert(error.message || "Email change failed.");

                        }

                    }

                }

            }

            // PASSWORD CHANGE

            if (password.value) {

                try {

                    await updatePassword(user, password.value);

                    password.value = "";

                } catch (error) {

                    console.error("Password Update Error:", error);

                    if (
                        error.code === "auth/requires-recent-login"
                    ) {

                        alert(
                            "Please log out and log in again before changing your password."
                        );

                    } else if (
                        error.code === "auth/weak-password"
                    ) {

                        alert("Your new password is too weak.");

                    } else {

                        alert(error.message || "Password update failed.");

                    }

                }

            }

            // SUCCESS

            if (emailVerificationSent) {

                alert(
                    "Profile saved! A verification link has been sent to your new email."
                );

            } else {

                alert("Profile updated successfully!");

            }

            window.location.href = "profile.html";

        } catch (error) {

            console.error("Profile Update Error:", error);

            if (error.code === "permission-denied") {

                alert(
                    "Your profile could not be updated. Check your nickname change eligibility and Firestore permissions."
                );

            } else {

                alert(error.message || "Failed to update profile.");

            }

        } finally {

            setSubmitting(false);

        }

    });

}
