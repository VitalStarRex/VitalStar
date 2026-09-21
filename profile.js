// ============================================================
// VITALSTAR — profile.js
// ============================================================

// ============================================================
// WHITE + GREEN VITALSTAR LOADER
// ============================================================

const vitalStarProfileLoader = document.createElement("div");

vitalStarProfileLoader.id = "vitalStarProfileLoader";

vitalStarProfileLoader.innerHTML = `
    <div class="vs-profile-loader-content">
        <div class="vs-profile-spinner">
            <span>VS</span>
        </div>

        <div class="vs-profile-loading-text">
            Loading Profile...
        </div>
    </div>
`;

const vitalStarProfileLoaderStyle =
    document.createElement("style");

vitalStarProfileLoaderStyle.textContent = `
    #vitalStarProfileLoader {
        position: fixed;
        inset: 0;
        z-index: 999999;

        background:
            radial-gradient(
                circle at center,
                #12351f 0%,
                #07150d 45%,
                #020604 100%
            );

        display: flex;
        align-items: center;
        justify-content: center;

        opacity: 1;
        visibility: visible;

        transition:
            opacity 0.55s ease,
            visibility 0.55s ease;
    }

    #vitalStarProfileLoader.hide {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }

    .vs-profile-loader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .vs-profile-spinner {
        width: 90px;
        height: 90px;

        border-radius: 50%;

        border:
            5px solid
            rgba(255,255,255,0.14);

        border-top-color: #ffffff;
        border-right-color: #20ff75;
        border-bottom-color: #20ff75;

        display: flex;
        align-items: center;
        justify-content: center;

        animation:
            vsProfileRotate
            1s linear infinite;

        box-shadow:
            0 0 18px
            rgba(32,255,117,0.35),

            0 0 40px
            rgba(32,255,117,0.20);
    }

    .vs-profile-spinner span {
        font-size: 25px;
        font-weight: 900;
        letter-spacing: 2px;

        color: #ffffff;

        text-shadow:
            0 0 12px
            rgba(255,255,255,0.75);

        animation:
            vsProfileCounterRotate
            1s linear infinite;
    }

    .vs-profile-loading-text {
        margin-top: 18px;

        color: #ffffff;

        font-size: 14px;
        font-weight: 700;

        letter-spacing: 0.5px;

        text-shadow:
            0 0 10px
            rgba(32,255,117,0.45);
    }

    @keyframes vsProfileRotate {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    @keyframes vsProfileCounterRotate {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(-360deg);
        }
    }
`;

document.head.appendChild(
    vitalStarProfileLoaderStyle
);

document.body.appendChild(
    vitalStarProfileLoader
);

let profileLoaderHidden = false;

function hideProfileLoader() {

    if (profileLoaderHidden) {
        return;
    }

    profileLoaderHidden = true;

    const loader =
        document.getElementById(
            "vitalStarProfileLoader"
        );

    if (!loader) {
        return;
    }

    loader.classList.add("hide");

    setTimeout(() => {
        loader.remove();
    }, 650);
}


// ============================================================
// FIREBASE IMPORTS
// ============================================================

import {
    auth,
    db,
    rtdb
} from "./firebase.js";

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


// ============================================================
// HTML ELEMENTS
// ============================================================

const coverPhoto =
    document.getElementById("coverPhoto");

const profilePicture =
    document.getElementById("profilePicture");

const fullName =
    document.getElementById("fullName");

const username =
    document.getElementById("username");

const country =
    document.getElementById("country");

const dob =
    document.getElementById("dob");

const bio =
    document.getElementById("bio");

const gender =
    document.getElementById("gender");

const rank =
    document.getElementById("rank");

const lastSeen =
    document.getElementById("lastSeen");

const posts =
    document.getElementById("posts");

const followers =
    document.getElementById("followers");

const following =
    document.getElementById("following");

const editProfileBtn =
    document.getElementById("editProfileBtn");

const followBtn =
    document.getElementById("followBtn");

const messageBtn =
    document.getElementById("messageBtn");

const gallery =
    document.getElementById("gallery");


// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        try {

            const params =
                new URLSearchParams(
                    window.location.search
                );

            const profileUid =
                params.get("uid") ||
                user.uid;

            // ====================================================
            // GET PROFILE
            // ====================================================

            const userRef =
                doc(
                    db,
                    "users",
                    profileUid
                );

            const snap =
                await getDoc(userRef);

            if (!snap.exists()) {

                alert(
                    "Profile not found."
                );

                hideProfileLoader();

                return;
            }

            const data =
                snap.data();

            // ====================================================
            // SHOW CORRECT BUTTONS
            // ====================================================

            if (
                profileUid ===
                user.uid
            ) {

                editProfileBtn.style.display =
                    "inline-block";

                followBtn.style.display =
                    "none";

                messageBtn.style.display =
                    "none";

            } else {

                editProfileBtn.style.display =
                    "none";

                followBtn.style.display =
                    "inline-block";

                messageBtn.style.display =
                    "inline-block";

                const followingRef =
                    doc(
                        db,
                        "users",
                        user.uid,
                        "following",
                        profileUid
                    );

                const followingSnap =
                    await getDoc(
                        followingRef
                    );

                if (
                    followingSnap.exists()
                ) {

                    followBtn.textContent =
                        "✓ Following";

                } else {

                    followBtn.textContent =
                        "➕ Follow";
                }
            }

            // ====================================================
            // PROFILE INFORMATION
            // ====================================================

            fullName.textContent =
                data.fullName ||
                "No Name";

            username.textContent =
                "@" +
                (
                    data.username ||
                    "username"
                );

            country.textContent =
                "🌍 " +
                (
                    data.country ||
                    "Country not set"
                );

            dob.textContent =
                "🎂 " +
                (
                    data.dob ||
                    "Birthday not set"
                );

            gender.textContent =
                "🚻 " +
                (
                    data.gender ||
                    "Not specified"
                );

            // ====================================================
            // OWNER RANK
            // ====================================================

            if (
                data.uid ===
                    "FvbfTXi65VgpuPtBxr8kGzBRLRr1" ||
                profileUid ===
                    "FvbfTXi65VgpuPtBxr1"
            ) {

                rank.textContent =
                    "👑 Owner";

            } else {

                const followerCount =
                    data.followersCount ||
                    0;

                let userRank =
                    "🌱 New Member";

                if (
                    followerCount >=
                    1000
                ) {

                    userRank =
                        "🌍 Legend";

                } else if (
                    followerCount >=
                    500
                ) {

                    userRank =
                        "👑 Celebrity";

                } else if (
                    followerCount >=
                    100
                ) {

                    userRank =
                        "🔥 Influencer";

                } else if (
                    followerCount >=
                    50
                ) {

                    userRank =
                        "💎 Popular";

                } else if (
                    followerCount >=
                    10
                ) {

                    userRank =
                        "⭐ Rising Star";
                }

                rank.textContent =
                    userRank;
            }

            bio.textContent =
                data.bio ||
                "No bio yet.";

            profilePicture.src =
                data.profilePicture ||
                "https://via.placeholder.com/180";

            coverPhoto.src =
                data.coverPhoto ||
                "https://via.placeholder.com/1200x350";

            posts.textContent =
                data.postsCount ||
                0;

            followers.textContent =
                data.followersCount ||
                0;

            following.textContent =
                data.followingCount ||
                0;

            // ====================================================
            // ONLINE / OFFLINE STATUS
            // ====================================================

            const statusRef =
                ref(
                    rtdb,
                    "status/" +
                    profileUid
                );

            onValue(
                statusRef,
                (snapshot) => {

                    const status =
                        snapshot.val();

                    if (!status) {

                        lastSeen.textContent =
                            "⚪ Offline";

                        return;
                    }

                    if (
                        status.online
                    ) {

                        lastSeen.textContent =
                            "🟢 Online";

                    } else if (
                        status.lastSeen
                    ) {

                        const date =
                            new Date(
                                Number(
                                    status.lastSeen
                                )
                            );

                        lastSeen.textContent =
                            "🕒 Last seen: " +
                            date.toLocaleString();

                    } else {

                        lastSeen.textContent =
                            "⚪ Offline";
                    }
                }
            );

            // ====================================================
            // LOAD USER POSTS
            // ====================================================

            try {

                await loadUserPosts(
                    profileUid
                );

            } catch (err) {

                console.error(
                    "Load posts error:",
                    err
                );
            }

            // ====================================================
            // EVERYTHING IS READY
            // ====================================================

            hideProfileLoader();

        } catch (err) {

            console.error(
                "Profile Error:",
                err
            );

            hideProfileLoader();

            if (
                err.code ===
                    "permission-denied" ||
                err.code ===
                    "unavailable"
            ) {

                alert(
                    "Failed to load profile."
                );
            }
        }
    }
);


// ============================================================
// EDIT PROFILE BUTTON
// ============================================================

if (editProfileBtn) {

    editProfileBtn.addEventListener(
        "click",
        () => {

            window.location.href =
                "edit-profile.html";
        }
    );
}


// ============================================================
// LOAD USER POSTS
// ============================================================

async function loadUserPosts(
    profileUid
) {

    gallery.innerHTML =
        "";

    const q =
        query(
            collection(
                db,
                "posts"
            ),

            where(
                "uid",
                "==",
                profileUid
            ),

            orderBy(
                "createdAt",
                "desc"
            )
        );

    const snap =
        await getDocs(q);

    // Real total
    posts.textContent =
        snap.size;

    if (snap.empty) {

        gallery.innerHTML =
            "<p>No posts yet.</p>";

        return;
    }

    // Maximum 10 gallery posts
    const MAX_GALLERY_POSTS =
        10;

    const docsToShow =
        snap.docs.slice(
            0,
            MAX_GALLERY_POSTS
        );

    docsToShow.forEach(
        (docSnap) => {

            const post =
                docSnap.data();

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "gallery-item";

            item.onclick =
                () => {

                    window.location.href =
                        "comments.html?postId=" +
                        docSnap.id;
                };

            // ====================================================
            // IMAGE POST
            // ====================================================

            if (post.image) {

                const img =
                    document.createElement(
                        "img"
                    );

                img.src =
                    post.image;

                img.alt =
                    "Post";

                item.appendChild(
                    img
                );

            }

            // ====================================================
            // VIDEO POST
            // ====================================================

            else if (post.video) {

                const video =
                    document.createElement(
                        "video"
                    );

                video.src =
                    post.video;

                video.muted =
                    true;

                video.preload =
                    "metadata";

                item.appendChild(
                    video
                );

                const playIcon =
                    document.createElement(
                        "div"
                    );

                playIcon.className =
                    "video-icon";

                playIcon.textContent =
                    "▶";

                item.appendChild(
                    playIcon
                );

            }

            // ====================================================
            // TEXT POST
            // ====================================================

            else {

                const text =
                    document.createElement(
                        "div"
                    );

                text.className =
                    "text-post-preview";

                text.textContent =
                    (
                        post.text ||
                        ""
                    ).substring(
                        0,
                        80
                    );

                item.appendChild(
                    text
                );
            }

            gallery.appendChild(
                item
            );
        }
    );

    // ============================================================
    // VIEW ALL POSTS
    // ============================================================

    if (
        snap.size >
        MAX_GALLERY_POSTS
    ) {

        const viewAllLink =
            document.createElement(
                "a"
            );

        viewAllLink.href =
            "user-posts.html?uid=" +
            profileUid;

        viewAllLink.textContent =
            "View All Posts →";

        viewAllLink.className =
            "view-all-posts-link";

        gallery.appendChild(
            viewAllLink
        );
    }
}


// ============================================================
// MESSAGE BUTTON
// ============================================================

if (messageBtn) {

    messageBtn.addEventListener(
        "click",
        () => {

            const params =
                new URLSearchParams(
                    window.location.search
                );

            const profileUid =
                params.get("uid");

            if (!profileUid) {

                alert(
                    "No profile UID found."
                );

                return;
            }

            window.location.href =
                "chat.html?uid=" +
                profileUid;
        }
    );
}