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
// Theme is controlled entirely by theme.js (data-theme on <html>).
// ============================================================

const NAME_LOCK_DAYS = 30;
const NAME_LOCK_MS = NAME_LOCK_DAYS * 24 * 60 * 60 * 1000;

// ============================================================
// ELEMENTS
// ============================================================

const profileImage = document.getElementById("profileImage");
const profilePreview = document.getElementById("profilePreview");
const coverImage = document.getElementById("coverImage");
const coverPreview = document.getElementById("coverPreview");

const fullName = document.getElementById("fullName");
const nameHint = document.getElementById("nameHint");
const gender = document.getElementById("gender");
const email = document.getElementById("email");
const dob = document.getElementById("dob");
const country = document.getElementById("country");
const bio = document.getElementById("bio");
const password = document.getElementById("password");
const profilePrivacy = document.getElementById("profilePrivacy");

const form = document.getElementById("editProfileForm");
const submitButton = document.getElementById("saveProfileButton");
const loadStatus = document.getElementById("loadStatus");
const profileLoader = document.getElementById("profileLoader");
const coverLoader = document.getElementById("coverLoader");

// ============================================================
// STATE
// ============================================================

let imageFile = null;
let coverFile = null;

let currentProfileUrl = "";   // saved profile picture URL
let currentCoverUrl = "";     // saved cover photo URL
let originalName = "";        // name loaded from Firestore
let nameLocked = false;       // true while the 30-day rule applies

// ============================================================
// SMALL LOADING INDICATORS
// ============================================================

function setPageLoading(isLoading) {
if (loadStatus) loadStatus.hidden = !isLoading;
}

function setSubmitting(isSubmitting, label) {

if (!submitButton) return;

if (isSubmitting) {
    submitButton.disabled = true;
    submitButton.classList.add("submitting");
    submitButton.innerHTML =
        '<span class="spinner on-btn"></span>' + (label || "Saving...");
} else {
    submitButton.disabled = false;
    submitButton.classList.remove("submitting");
    submitButton.innerHTML = "<span id=\"saveButtonText\">Save Changes</span>";
}

}

// ============================================================
// IMAGE PREVIEWS
// ============================================================

profileImage?.addEventListener("change", (e) => {
imageFile = e.target.files[0] || null;
if (imageFile && profilePreview) {
    profilePreview.src = URL.createObjectURL(imageFile);
}
});

coverImage?.addEventListener("change", (e) => {
coverFile = e.target.files[0] || null;
if (coverFile && coverPreview) {
    coverPreview.src = URL.createObjectURL(coverFile);
}
});

// ============================================================
// DATE OF BIRTH — MODERN CALENDAR
// ============================================================

const MONTHS = [
"January","February","March","April","May","June",
"July","August","September","October","November","December"
];

const calOverlay = document.getElementById("calOverlay");
const calGrid = document.getElementById("calGrid");
const calMonth = document.getElementById("calMonth");
const calYear = document.getElementById("calYear");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const dobButton = document.getElementById("dobButton");
const dobText = document.getElementById("dobText");

const todayDate = new Date();
const TODAY_Y = todayDate.getFullYear();
const TODAY_M = todayDate.getMonth();
const TODAY_D = todayDate.getDate();
const MIN_YEAR = 1920;

let viewY = 2000;
let viewM = 0;

function pad(n) {
return String(n).padStart(2, "0");
}

function parseDob(value) {
const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
if (!m) return null;
return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}

// Updates the hidden #dob (YYYY-MM-DD) and the visible label.
function setDob(value) {

dob.value = value || "";
const p = parseDob(value);

if (p) {
    dobText.textContent = p.d + " " + MONTHS[p.m] + " " + p.y;
    dobText.classList.remove("placeholder");
} else {
    dobText.textContent = "Select your date of birth";
    dobText.classList.add("placeholder");
}

}

function buildCalendarSelects() {

calMonth.innerHTML = MONTHS
    .map((name, i) => '<option value="' + i + '">' + name + "</option>")
    .join("");

let years = "";
for (let y = TODAY_Y; y >= MIN_YEAR; y--) {
    years += '<option value="' + y + '">' + y + "</option>";
}
calYear.innerHTML = years;

}

function renderCalendar() {

// never show a future month
if (viewY > TODAY_Y || (viewY === TODAY_Y && viewM > TODAY_M)) {
    viewY = TODAY_Y;
    viewM = TODAY_M;
}

calMonth.value = String(viewM);
calYear.value = String(viewY);

calPrev.disabled = viewY === MIN_YEAR && viewM === 0;
calNext.disabled = viewY === TODAY_Y && viewM === TODAY_M;

const selected = parseDob(dob.value);
const firstDay = new Date(viewY, viewM, 1).getDay();
const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();

let html = "";

for (let i = 0; i < firstDay; i++) {
    html += '<button type="button" class="blank" tabindex="-1" aria-hidden="true"></button>';
}

for (let d = 1; d <= daysInMonth; d++) {

    const isFuture =
        viewY === TODAY_Y && viewM === TODAY_M && d > TODAY_D;
    const isToday =
        viewY === TODAY_Y && viewM === TODAY_M && d === TODAY_D;
    const isSelected =
        selected && selected.y === viewY && selected.m === viewM && selected.d === d;

    html +=
        '<button type="button" data-day="' + d + '"' +
        ' class="' + (isToday ? "today " : "") + (isSelected ? "selected" : "") + '"' +
        (isFuture ? " disabled" : "") + ">" + d + "</button>";
}

calGrid.innerHTML = html;

}

function openCalendar() {

const p = parseDob(dob.value);

if (p) {
    viewY = p.y;
    viewM = p.m;
} else {
    viewY = 2000;
    viewM = 0;
}

renderCalendar();
calOverlay.hidden = false;

}

function closeCalendar() {
calOverlay.hidden = true;
}

if (calOverlay && dobButton) {

buildCalendarSelects();

dobButton.addEventListener("click", openCalendar);

calPrev.addEventListener("click", () => {
    viewM--;
    if (viewM < 0) { viewM = 11; viewY--; }
    renderCalendar();
});

calNext.addEventListener("click", () => {
    viewM++;
    if (viewM > 11) { viewM = 0; viewY++; }
    renderCalendar();
});

calMonth.addEventListener("change", () => {
    viewM = +calMonth.value;
    renderCalendar();
});

calYear.addEventListener("change", () => {
    viewY = +calYear.value;
    renderCalendar();
});

calGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-day]");
    if (!btn || btn.disabled) return;
    setDob(viewY + "-" + pad(viewM + 1) + "-" + pad(+btn.dataset.day));
    closeCalendar();
});

document.getElementById("calClear").addEventListener("click", () => {
    setDob("");
    closeCalendar();
});

document.getElementById("calClose").addEventListener("click", closeCalendar);

calOverlay.addEventListener("click", (e) => {
    if (e.target === calOverlay) closeCalendar();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !calOverlay.hidden) closeCalendar();
});

}

// ============================================================
// NICK NAME — ONCE EVERY 30 DAYS
// ============================================================

function formatDate(ms) {
const d = new Date(ms);
return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function applyNameRule(changedAt) {

nameLocked = false;
fullName.disabled = false;
nameHint.className = "hint";

if (changedAt) {
    const unlockAt = Number(changedAt) + NAME_LOCK_MS;

    if (Date.now() < unlockAt) {
        nameLocked = true;
        fullName.disabled = true;
        nameHint.classList.add("locked");
        nameHint.textContent =
            "🔒 You changed your nick name recently. You can change it again on " +
            formatDate(unlockAt) + ".";
        return;
    }
}

nameHint.classList.add("free");
nameHint.textContent =
    "You can change your nick name once every " + NAME_LOCK_DAYS + " days.";

}

// ============================================================
// LOAD USER PROFILE + SYNCHRONIZE EMAIL
// ============================================================

setPageLoading(true);

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

    // Automatic email synchronization
    if (user.email && data.email !== user.email) {
        await updateDoc(userRef, {
            email: user.email,
            pendingEmail: deleteField()
        });
    }

    // Basic information
    originalName = data.fullName || "";
    fullName.value = originalName;
    applyNameRule(data.nameChangedAt);

    // Gender: normalise old free-text values to Male / Female
    const g = (data.gender || "").trim().toLowerCase();
    gender.value = g === "male" ? "Male" : g === "female" ? "Female" : "";

    email.value = user.email || "";
    setDob(data.dob || "");
    country.value = data.country || "";
    bio.value = data.bio || "";

    // Profile privacy
    profilePrivacy.value = data.profilePrivacy || "public";

    // Images
    if (data.profilePicture) {
        currentProfileUrl = data.profilePicture;
        profilePreview.src = data.profilePicture;
    }

    if (data.coverPhoto) {
        currentCoverUrl = data.coverPhoto;
        coverPreview.src = data.coverPhoto;
    }

} catch (err) {

    console.error("Load Profile Error:", err);
    alert("Failed to load profile.");

} finally {

    setPageLoading(false);

}

});

// ============================================================
// UPLOAD IMAGE TO CLOUDINARY
// ============================================================

async function uploadImage(file, loaderEl) {

if (loaderEl) loaderEl.hidden = false;

try {

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "vitalstar_upload");

    const response = await fetch(
        "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload",
        { method: "POST", body: formData }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error?.message || "Image upload failed.");
    }

    return result.secure_url;

} finally {

    if (loaderEl) loaderEl.hidden = true;

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

    if (submitButton.disabled) return;

    setSubmitting(true, "Saving...");

    let emailVerificationSent = false;

    try {

        await reload(user);

        // Current image URLs
        let profilePicture = currentProfileUrl || profilePreview?.src || "";
        let coverPhoto = currentCoverUrl || "";

        // Upload new images (small badge on each image while uploading)
        if (imageFile || coverFile) {
            setSubmitting(true, "Uploading...");
        }

        if (imageFile) {
            profilePicture = await uploadImage(imageFile, profileLoader);
        }

        if (coverFile) {
            coverPhoto = await uploadImage(coverFile, coverLoader);
        }

        setSubmitting(true, "Saving...");

        // Profile privacy
        const profilePrivacyValue =
            profilePrivacy?.value === "friends" ? "friends" : "public";

        // Build the update
        const updates = {
            gender: gender?.value || "",
            dob: dob?.value || "",
            country: country?.value.trim() || "",
            bio: bio?.value.trim() || "",
            profilePicture,
            coverPhoto,
            profilePrivacy: profilePrivacyValue
        };

        // Nick name: only when changed AND not locked (once per 30 days)
        const newName = fullName?.value.trim() || "";

        if (newName !== originalName) {

            if (nameLocked) {
                alert("You can't change your nick name yet. Your other changes will still be saved.");
            } else {
                updates.fullName = newName;
                updates.nameChangedAt = Date.now();
            }

        }

        const userRef = doc(db, "users", user.uid);

        await updateDoc(userRef, updates);

        // Change email — verified
        const newEmail = email?.value.trim() || "";
        const currentEmail = user.email || "";

        if (
            newEmail &&
            newEmail.toLowerCase() !== currentEmail.toLowerCase()
        ) {

            const currentPassword = prompt(
                "Enter your current password to change your email:"
            );

            if (!currentPassword) {

                alert("Email change cancelled. Your other profile changes were saved.");

            } else {

                try {

                    const credential = EmailAuthProvider.credential(
                        currentEmail,
                        currentPassword
                    );

                    await reauthenticateWithCredential(user, credential);

                    // Save pending email first; do NOT replace the active email yet
                    await updateDoc(userRef, { pendingEmail: newEmail });

                    await verifyBeforeUpdateEmail(user, newEmail);

                    emailVerificationSent = true;

                } catch (err) {

                    console.error("Email Update Error:", err);

                    if (!emailVerificationSent) {
                        try {
                            await updateDoc(userRef, { pendingEmail: deleteField() });
                        } catch (cleanupError) {
                            console.error("Pending Email Cleanup Error:", cleanupError);
                        }
                    }

                    if (
                        err.code === "auth/wrong-password" ||
                        err.code === "auth/invalid-credential"
                    ) {
                        alert("Your current password is incorrect. Your email was not changed.");
                    } else if (err.code === "auth/invalid-email") {
                        alert("The new email address is invalid.");
                    } else if (err.code === "auth/email-already-in-use") {
                        alert("That email is already being used by another account.");
                    } else if (err.code === "auth/requires-recent-login") {
                        alert("Please log out and log in again before changing your email.");
                    } else {
                        alert(err.message || "Email change failed.");
                    }

                }

            }

        }

        // Change password
        if (password?.value) {

            try {

                await updatePassword(user, password.value);
                password.value = "";

            } catch (err) {

                console.error("Password Update Error:", err);

                if (err.code === "auth/requires-recent-login") {
                    alert("Your password could not be changed. Please log out and log in again, then try again.");
                } else if (err.code === "auth/weak-password") {
                    alert("Your new password is too weak. Please choose a stronger password.");
                } else {
                    alert(err.message || "Password could not be updated.");
                }

            }

        }

        // Success message
        if (emailVerificationSent) {
            alert(
                "Profile saved! A verification link has been sent to your new email. After verifying, log in with your username and password. VitalStar will synchronize your email automatically."
            );
        } else {
            alert("Profile updated successfully!");
        }

        window.location.href = "profile.html";

    } catch (err) {

        console.error("Profile Update Error:", err);
        alert(err.message || "Failed to update profile.");

    } finally {

        setSubmitting(false);

    }

});

}
