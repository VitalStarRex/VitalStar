import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const coverPhoto = document.getElementById("coverPhoto");
const profilePicture = document.getElementById("profilePicture");

const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const country = document.getElementById("country");
const dob = document.getElementById("dob");
const bio = document.getElementById("bio");

const posts = document.getElementById("posts");
const followers = document.getElementById("followers");
const following = document.getElementById("following");

const editProfileBtn = document.getElementById("editProfileBtn");

auth.onAuthStateChanged(async (user) => {
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

    fullName.textContent = data.fullName || "No Name";
    username.textContent = "@" + (data.username || "username");
    country.textContent = "🌍 " + (data.country || "Country not set");
    dob.textContent = "🎂 " + (data.dob || "Birthday not set");
    bio.textContent = data.bio || "No bio yet.";

    profilePicture.src = data.profilePicture || "https://via.placeholder.com/180";
    coverPhoto.src = data.coverPhoto || "https://via.placeholder.com/1200x350";

    posts.textContent = data.postsCount || 0;
    followers.textContent = data.followersCount || 0;
    following.textContent = data.followingCount || 0;

  } catch (err) {
    console.error("Profile Error:", err);
    alert("Failed to load profile.");
  }
});

editProfileBtn.addEventListener("click", () => {
  window.location.href = "edit-profile.html";
});