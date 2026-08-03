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





followBtn.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("uid");

    if (!profileUid || profileUid === user.uid) return;

    try {

        const followingRef = doc(
            db,
            "users",
            user.uid,
            "following",
            profileUid
        );

        const followerRef = doc(
            db,
            "users",
            profileUid,
            "followers",
            user.uid
        );

        const followingSnap = await getDoc(followingRef);

        if (followingSnap.exists()) {

            // Unfollow
            await deleteDoc(followingRef);
            await deleteDoc(followerRef);

            await updateDoc(doc(db, "users", user.uid), {
                followingCount: increment(-1)
            });

            await updateDoc(doc(db, "users", profileUid), {
                followersCount: increment(-1)
            });

            followBtn.textContent = "➕ Follow";

            followers.textContent = Number(followers.textContent) - 1;

        } else {

            // Follow
            await setDoc(followingRef, {
                followedAt: new Date()
            });

            await setDoc(followerRef, {
                followedAt: new Date()
            });

            await updateDoc(doc(db, "users", user.uid), {
                followingCount: increment(1)
            });

            await updateDoc(doc(db, "users", profileUid), {
                followersCount: increment(1)
            });

            followBtn.textContent = "✓ Following";

            followers.textContent = Number(followers.textContent) + 1;

// Get current user's details
const currentUserSnap = await getDoc(doc(db, "users", user.uid));
const currentUser = currentUserSnap.data();

// Create follow notification
await addDoc(collection(db, "notifications"), {
    userId: profileUid,              // Receiver
    senderId: user.uid,              // Follower
    type: "follow",
    message: `${currentUser.fullName} started following you.`,
    read: false,
    createdAt: serverTimestamp()
});


        }

    } catch (err) {
        console.error("Follow Error:", err);
        alert("Failed to follow user.");
    }

});











async function loadUserPosts(profileUid) {

    gallery.innerHTML = "";

    const q = query(
        collection(db, "posts"),
        where("uid", "==", profileUid),
        orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    let count = 0;

    snap.forEach((doc) => {

        count++;

        const post = doc.data();

        const img = document.createElement("img");

        img.src = post.image || "https://via.placeholder.com/300";

        img.onclick = () => {
            window.location.href =
                "comments.html?postId=" + doc.id;
        };

        gallery.appendChild(img);

    });

    posts.textContent = count;

    if (count === 0) {
        gallery.innerHTML =
            "<p>No posts yet.</p>";
    }

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