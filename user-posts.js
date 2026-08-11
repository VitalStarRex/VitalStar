// ============================================================
// VITALSTAR — user-posts.js
// User profile posts
// Matches the main VitalStar post system.
// Includes:
// - User posts
// - Likes
// - Comments
// - Shares
// - Notifications
// - Profile links
// - Images
// - Videos
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// FIND FEED
// Supports #feed used by your existing post system.
// Also supports #posts as a fallback.
// ============================================================

const feed =
    document.getElementById("feed") ||
    document.getElementById("posts");


// ============================================================
// GET PROFILE USER ID
// ============================================================

function getProfileUid() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return (
        params.get("uid") ||
        params.get("userId") ||
        params.get("id")
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// GET POST DATE
// ============================================================

function getPostDate(post) {

    let date = "Just now";

    if (post.createdAt) {

        try {

            date =
                post.createdAt
                    .toDate()
                    .toLocaleString();

        } catch (e) {}

    }

    return date;

}


// ============================================================
// LOAD USER POSTS
// ============================================================

function loadUserPosts(profileUid) {

    if (!feed) {

        console.error(
            "user-posts.js: #feed or #posts was not found."
        );

        return;

    }


    /*
     * We intentionally use ONLY where().
     *
     * This avoids requiring a composite Firestore index.
     * Posts are sorted below in JavaScript.
     */

    const postsQuery = query(
        collection(db, "posts"),
        where("uid", "==", profileUid)
    );


    onSnapshot(
        postsQuery,

        async (snapshot) => {

            feed.innerHTML = "";


            if (snapshot.empty) {

                feed.innerHTML = `
                    <p style="
                        text-align:center;
                        padding:20px;
                    ">
                        No posts yet. Be the first to post ⭐
                    </p>
                `;

                return;

            }


            const posts = [];


            snapshot.forEach((docSnap) => {

                posts.push({

                    id: docSnap.id,

                    ...docSnap.data()

                });

            });


            // ------------------------------------------------
            // Newest first
            // ------------------------------------------------

            posts.sort((a, b) => {

                const aTime =
                    a.createdAt
                        ? a.createdAt.toMillis()
                        : 0;

                const bTime =
                    b.createdAt
                        ? b.createdAt.toMillis()
                        : 0;

                return bTime - aTime;

            });


            // ------------------------------------------------
            // Latest 10 posts
            // ------------------------------------------------

            const latestPosts =
                posts.slice(0, 10);


            for (const post of latestPosts) {

                const postId =
                    post.id;


                const date =
                    getPostDate(post);


                // ------------------------------------------------
                // PROFILE IMAGE
                // ------------------------------------------------

                let profilePicture =
                    post.profilePicture ||
                    post.avatarURL ||
                    post.photoURL ||
                    "";


                /*
                 * If the post doesn't contain the profile
                 * picture, get it from users/{uid}.
                 */

                if (!profilePicture && post.uid) {

                    try {

                        const userSnap =
                            await getDoc(
                                doc(
                                    db,
                                    "users",
                                    post.uid
                                )
                            );


                        if (userSnap.exists()) {

                            const userData =
                                userSnap.data();


                            profilePicture =
                                userData.profilePicture ||
                                userData.avatarURL ||
                                userData.photoURL ||
                                "";

                        }

                    } catch (error) {

                        console.log(
                            "Profile image unavailable.",
                            error
                        );

                    }

                }


                // ------------------------------------------------
                // AVATAR
                // ------------------------------------------------

                const avatarHTML =
                    profilePicture

                    ? `
                        <img
                            class="post-avatar"
                            src="${escapeHTML(profilePicture)}"
                            alt="Profile picture"
                            onerror="this.style.display='none'">
                      `

                    : `
                        <div class="post-avatar-fallback">
                            👤
                        </div>
                      `;


                // ------------------------------------------------
                // POST
                // ------------------------------------------------

                feed.innerHTML += `

                    <div class="post-card">


                        <div class="user-info">


                            <a
                                href="profile.html?uid=${encodeURIComponent(post.uid || "")}"
                                class="post-profile-link"
                            >

                                ${avatarHTML}

                            </a>


                            <div>

                                <h3>

                                    <a
                                        href="profile.html?uid=${encodeURIComponent(post.uid || "")}"
                                    >

                                        ${escapeHTML(
                                            post.fullName ||
                                            "VitalStar User"
                                        )}

                                    </a>

                                </h3>


                                ${
                                    post.username
                                    ?
                                    `
                                    <small>
                                        @${escapeHTML(post.username)}
                                    </small>
                                    `
                                    :
                                    ""
                                }


                                <small>
                                    ${escapeHTML(date)}
                                </small>


                            </div>


                        </div>


                        ${
                            post.text
                            ?
                            `
                            <p>
                                ${escapeHTML(post.text)}
                            </p>
                            `
                            :
                            ""
                        }


                        ${
                            post.image
                            ?
                            `
                            <img
                                class="post-photo"
                                src="${escapeHTML(post.image)}"
                                alt="Post Image"
                            >
                            `
                            :
                            ""
                        }


                        ${
                            post.video
                            ?
                            `
                            <video
                                class="post-video"
                                controls
                                preload="metadata"
                            >

                                <source
                                    src="${escapeHTML(post.video)}"
                                    type="video/mp4"
                                >

                                Your browser does not support video.

                            </video>
                            `
                            :
                            ""
                        }


                        <div class="post-buttons">


                            <button
                                onclick="likePost('${postId}')"
                            >

                                ❤️ ${post.likes || 0}

                            </button>


                            <button
                                onclick="openComments('${postId}')"
                            >

                                💬 ${post.comments || 0}

                            </button>


                            <button
                                onclick="repostPost('${postId}')"
                            >

                                🔁 ${post.reposts || 0}

                            </button>


                            <button
                                onclick="sharePost('${postId}')"
                            >

                                🔗 ${post.shares || 0}

                            </button>


                        </div>


                    </div>

                `;

            }

        },


        (error) => {

            console.error(
                "Unable to load user posts:",
                error
            );


            feed.innerHTML = `

                <p style="
                    color:red;
                    text-align:center;
                    padding:20px;
                ">

                    Unable to load posts.

                </p>

            `;

        }

    );

}


// ============================================================
// LIKE SYSTEM
// ============================================================

window.likePost = async function(postId) {

    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please login first"
        );

        return;

    }


    try {

        const likeId =
            postId + "_" + user.uid;


        const likeRef =
            doc(
                db,
                "likes",
                likeId
            );


        const likeSnap =
            await getDoc(
                likeRef
            );


        const postRef =
            doc(
                db,
                "posts",
                postId
            );


        const postSnap =
            await getDoc(
                postRef
            );


        if (!postSnap.exists()) {

            alert(
                "Post not found."
            );

            return;

        }


        const postData =
            postSnap.data();


        // ----------------------------------------------------
        // UNLIKE
        // ----------------------------------------------------

        if (likeSnap.exists()) {

            await deleteDoc(
                likeRef
            );


            await updateDoc(
                postRef,
                {
                    likes:
                        increment(-1)
                }
            );


            return;

        }


        // ----------------------------------------------------
        // LIKE
        // ----------------------------------------------------

        await setDoc(
            likeRef,
            {

                uid:
                    user.uid,

                postId:
                    postId,

                createdAt:
                    new Date()

            }
        );


        await updateDoc(
            postRef,
            {

                likes:
                    increment(1)

            }
        );


        // ----------------------------------------------------
        // NOTIFICATION
        // ----------------------------------------------------

        if (
            postData.uid &&
            postData.uid !== user.uid
        ) {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (userSnap.exists()) {

                const currentUser =
                    userSnap.data();


                await addDoc(
                    collection(
                        db,
                        "notifications"
                    ),
                    {

                        receiverId:
                            postData.uid,

                        senderId:
                            user.uid,

                        senderName:
                            currentUser.fullName ||
                            currentUser.username ||
                            "VitalStar User",

                        senderPhoto:
                            currentUser.profilePicture ||
                            currentUser.avatarURL ||
                            "",

                        text:
                            "liked your post ❤️",

                        type:
                            "like",

                        postId:
                            postId,

                        read:
                            false,

                        createdAt:
                            serverTimestamp()

                    }
                );

            }

        }


    } catch (error) {

        console.error(
            "Like error:",
            error
        );

        alert(
            "Unable to like this post."
        );

    }

};


// ============================================================
// COMMENTS
// ============================================================

window.openComments = function(postId) {

    window.location.href =
        "comments.html?postId=" +
        encodeURIComponent(postId);

};


// ============================================================
// REPOST
// ============================================================

window.repostPost = async function(postId) {

    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please login first"
        );

        return;

    }


    try {

        const postRef =
            doc(
                db,
                "posts",
                postId
            );


        const postSnap =
            await getDoc(
                postRef
            );


        if (!postSnap.exists()) {

            alert(
                "Post not found."
            );

            return;

        }


        await updateDoc(
            postRef,
            {

                reposts:
                    increment(1)

            }
        );


        const post =
            postSnap.data();


        // ----------------------------------------------------
        // REPOST NOTIFICATION
        // ----------------------------------------------------

        if (
            post.uid &&
            post.uid !== user.uid
        ) {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (userSnap.exists()) {

                const currentUser =
                    userSnap.data();


                await addDoc(
                    collection(
                        db,
                        "notifications"
                    ),
                    {

                        receiverId:
                            post.uid,

                        senderId:
                            user.uid,

                        senderName:
                            currentUser.fullName ||
                            currentUser.username ||
                            "VitalStar User",

                        senderPhoto:
                            currentUser.profilePicture ||
                            currentUser.avatarURL ||
                            "",

                        text:
                            "reposted your post 🔁",

                        type:
                            "repost",

                        postId:
                            postId,

                        read:
                            false,

                        createdAt:
                            serverTimestamp()

                    }
                );

            }

        }


    } catch (error) {

        console.error(
            "Repost error:",
            error
        );

    }

};


// ============================================================
// SHARE POST
// ============================================================

window.sharePost = async function(postId) {

    try {

        const postRef =
            doc(
                db,
                "posts",
                postId
            );


        const postSnap =
            await getDoc(
                postRef
            );


        if (!postSnap.exists()) {

            alert(
                "Post not found."
            );

            return;

        }


        const post =
            postSnap.data();


        const shareUrl =
            `${window.location.origin}/post.html?id=${postId}`;


        let shared =
            false;


        // ----------------------------------------------------
        // NATIVE SHARE
        // ----------------------------------------------------

        if (
            navigator.share
        ) {

            try {

                await navigator.share({

                    title:
                        post.fullName ||
                        "VitalStar Post",

                    text:
                        post.text ||
                        "Check out this post!",

                    url:
                        shareUrl

                });


                shared = true;

            } catch (error) {

                console.log(
                    "Share cancelled."
                );

                return;

            }

        }


        // ----------------------------------------------------
        // CLIPBOARD FALLBACK
        // ----------------------------------------------------

        else {

            await navigator.clipboard.writeText(
                shareUrl
            );


            alert(
                "Post link copied to clipboard."
            );


            shared = true;

        }


        // ----------------------------------------------------
        // COUNT SHARE
        // ----------------------------------------------------

        if (shared) {

            await updateDoc(
                postRef,
                {

                    shares:
                        increment(1)

                }
            );

        }


    } catch (error) {

        console.error(
            "Share error:",
            error
        );

    }

};


// ============================================================
// NOTIFICATION BADGE
// ============================================================

function setupNotificationBadge(user) {

    const notificationBadge =
        document.getElementById(
            "notificationBadge"
        );


    if (!notificationBadge) {

        console.log(
            "notificationBadge not found on this page."
        );

        return;

    }


    const notificationQuery =
        query(
            collection(db, "notifications"),
            where(
                "receiverId",
                "==",
                user.uid
            )
        );


    onSnapshot(
        notificationQuery,
        (snapshot) => {

            let unreadNotifications = 0;


            snapshot.forEach(
                (notificationDoc) => {

                    const notification =
                        notificationDoc.data();


                    if (
                        notification.read === false
                    ) {

                        unreadNotifications++;

                    }

                }
            );


            notificationBadge.textContent =
                unreadNotifications > 0
                    ? unreadNotifications
                    : "0";

        },
        (error) => {

            console.error(
                "Notification badge error:",
                error
            );

        }
    );

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    (user) => {

        if (!user) {

            if (feed) {

                feed.innerHTML = `
                    <p style="
                        text-align:center;
                        padding:20px;
                    ">
                        Please login to view posts.
                    </p>
                `;

            }

            return;

        }


        const profileUid =
            getProfileUid();


        /*
         * If profile.html?uid=XXXX exists,
         * show that user's posts.
         *
         * Otherwise show the logged-in user's posts.
         */

        const uid =
            profileUid ||
            user.uid;


        loadUserPosts(
            uid
        );


        // Notification badge
        setupNotificationBadge(
            user
        );

    }
);