import { auth, db, rtdb } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";




import {
    doc,
    getDoc,
    limit,
    setDoc,
    deleteDoc,
    updateDoc,
    increment,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
     


                                                

const coverPhoto = document.getElementById("coverPhoto");
const profilePicture = document.getElementById("profilePicture");

const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const country = document.getElementById("country");
const dob = document.getElementById("dob");
const bio = document.getElementById("bio");

const gender = document.getElementById("gender");
const rank = document.getElementById("rank");
const lastSeen = document.getElementById("lastSeen");

const posts = document.getElementById("posts");
const followers = document.getElementById("followers");
const following = document.getElementById("following");

const editProfileBtn = document.getElementById("editProfileBtn");
const followBtn = document.getElementById("followBtn");
const messageBtn = document.getElementById("messageBtn");
const gallery = document.getElementById("gallery");

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {

        const params = new URLSearchParams(window.location.search);
        const profileUid = params.get("uid") || user.uid;

        const userRef = doc(db, "users", profileUid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            alert("Profile not found.");
            return;
        }

        const data = snap.data();






// Show correct buttons
if (profileUid === user.uid) {

    editProfileBtn.style.display = "inline-block";
    followBtn.style.display = "none";
    messageBtn.style.display = "none";

} else {

    editProfileBtn.style.display = "none";
    followBtn.style.display = "inline-block";
    messageBtn.style.display = "inline-block";

    // Check if current user already follows this profile
    const followingRef = doc(
        db,
        "users",
        user.uid,
        "following",
        profileUid
    );

    const followingSnap = await getDoc(followingRef);

    if (followingSnap.exists()) {
        followBtn.textContent = "✓ Following";
    } else {
        followBtn.textContent = "➕ Follow";
    }

}

// Display profile information
fullName.textContent = data.fullName || "No Name";

username.textContent =
    "@" + (data.username || "username");

country.textContent =
    "🌍 " + (data.country || "Country not set");

dob.textContent =
    "🎂 " + (data.dob || "Birthday not set");

gender.textContent =
    "🚻 " + (data.gender || "Not specified");



const followerCount = data.followersCount || 0;

let userRank = "🌱 New Member";

if (followerCount >= 1000) {
    userRank = "🌍 Legend";
} else if (followerCount >= 500) {
    userRank = "👑 Celebrity";
} else if (followerCount >= 100) {
    userRank = "🔥 Influencer";
} else if (followerCount >= 50) {
    userRank = "💎 Popular";
} else if (followerCount >= 10) {
    userRank = "⭐ Rising Star";
} else if (profileUid >= "FvbfTXi65VgpuPtBxr8kGzBRLRr1") {
    userRank = "👑 Owner";
}

rank.textContent = userRank;





const statusRef = ref(rtdb, "status/" + profileUid);



onValue(statusRef, (snapshot) => {

    console.log("Profile UID:", profileUid);
    console.log("Realtime status:", snapshot.val());

    const status = snapshot.val();



    if (!status) {
        lastSeen.textContent = "⚪ Offline";
        return;
    }

    if (status.online === true) {

        lastSeen.textContent = "🟢 Online";

    } else if (status.lastSeen) {

        const date = new Date(status.lastSeen);

        lastSeen.textContent =
            "🕒 Last seen: " + date.toLocaleString();

    }

});




bio.textContent =
    data.bio || "No bio yet.";

profilePicture.src =
    data.profilePicture ||
    "https://via.placeholder.com/180";

coverPhoto.src =
    data.coverPhoto ||
    "https://via.placeholder.com/1200x350";

posts.textContent =
    data.postsCount || 0;

followers.textContent =
    data.followersCount || 0;

following.textContent =
    data.followingCount || 0;



try {
    await loadUserPosts(profileUid);
} catch (err) {
    console.error("Load posts error:", err);
}








} catch (err) {
    console.error("Profile Error:", err);

    // Only show the popup if the profile document itself couldn't be loaded
    if (err.code === "permission-denied" || err.code === "unavailable") {
        alert("Failed to load profile.");
    }
}

});

editProfileBtn.addEventListener("click", () => {
    window.location.href = "edit-profile.html";
});









          




async function loadUserPosts(profileUid) {

    gallery.innerHTML = "";

    const q = query(
    collection(db, "posts"),
    where("uid", "==", profileUid),
    orderBy("createdAt", "desc"),
    limit(10)
);

    


let snap;

try {
    snap = await getDocs(q);
} catch (error) {
    console.error("Post query error:", error);
    alert(error.message);
    return;
}




    let count = 0;

    if (snap.empty) {
        gallery.innerHTML = "<p>No posts yet.</p>";
        posts.textContent = "0";
        return;
    }

    snap.forEach((docSnap) => {

        count++;

        const post = docSnap.data();

        const card = document.createElement("div");

        card.style.background = "#fff";
        card.style.marginBottom = "15px";
        card.style.padding = "15px";
        card.style.borderRadius = "12px";
        card.style.boxShadow = "0 2px 5px rgba(0,0,0,.15)";

        let image = "";

        if (post.image) {
            image = `
                <img src="${post.image}"
                style="width:100%;border-radius:10px;margin-top:10px;">
            `;
        }

        let time = "";

        if (post.createdAt?.toDate) {
            time = post.createdAt.toDate().toLocaleString();
        }

        card.innerHTML = `
            <h3>${post.fullName || fullName.textContent}</h3>

            <p>${post.text || ""}</p>

            ${image}

            <br>

            <small style="color:gray;">
                ${time}
            </small>
        `;

        gallery.appendChild(card);

    });

    posts.textContent = count;

}




messageBtn.addEventListener("click", () => {

    alert("Message button clicked!");

    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("uid");

    if (!profileUid) {
        alert("No profile UID found.");
        return;
    }

    window.location.href = "chat.html?uid=" + profileUid;

});