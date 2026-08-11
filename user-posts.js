// ============================================================
// VITALSTAR — user-posts.js
// User profile posts
//
// FEATURES
// - Shows ALL posts belonging to the profile user
// - Newest posts first
// - Text posts
// - Images
// - Videos
// - Likes
// - Comments
// - Reposts
// - Shares
// - Like notifications
// - Repost notifications
// - Notification badge
// - Profile links
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
// FEED
// ============================================================

const feed =
    document.getElementById("feed") ||
    document.getElementById("posts");


// ============================================================
// GET PROFILE UID
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

    if (!post.createdAt) {

        return "Just now";

    }


    try {

        return post.createdAt
            .toDate()
            .toLocaleString();

    } catch (error) {

        return "Just now";

    }

}


// ============================================================
// GET PROFILE DATA
// ============================================================

async function getProfileData(uid, post) {

    let profile = {

        fullName:
            post.fullName ||
            "VitalStar User",

        username:
            post.username ||
            "",

        profilePicture:
            post.profilePicture ||
            post.avatarURL ||
            post.photoURL ||
            ""

    };


    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    uid
                )
            );


        if (userSnap.exists()) {

            const user =
                userSnap.data();


            profile.fullName =
                user.fullName ||
                user.displayName ||
                user.name ||
                profile.fullName;


            profile.username =
                user.username ||
                profile.username;


            profile.profilePicture =
                user.profilePicture ||
                user.avatarURL ||
                user.photoURL ||
                profile.profilePicture;

        }

    } catch (error) {

        console.log(
            "Could not load profile:",
            error
        );

    }


    return profile;

}


// ============================================================
// LOAD USER POSTS
// ============================================================

function loadUserPosts(profileUid) {

    if (!feed) {

        console.error(
            "user-posts.js: #feed or #posts not found."
        );

        return;

    }


    feed.innerHTML = `

        <p style="
            text-align:center;
            padding:20px;
        ">

            Loading posts...

        </p>

    `;


    /*
     * Only filter by uid.
     *
     * We sort the posts in JavaScript so that
     * no composite Firestore index is required.
     */

    const postsQuery =
        query(
            collection(db, "posts"),
            where(
                "uid",
                "==",
                profileUid
            )
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


            // ------------------------------------------------
            // CONVERT SNAPSHOT TO ARRAY
            // ------------------------------------------------

            const posts = [];


            snapshot.forEach(
                (docSnap) => {

                    posts.push({

                        id:
                            docSnap.id,

                        ...docSnap.data()

                    });

                }
            );


            // ------------------------------------------------
            // NEWEST FIRST
            // ------------------------------------------------

            posts.sort(
                (a, b) => {

                    const aTime =
                        a.createdAt
                            ? getTime(
                                a.createdAt
                            )
                            : 0;


                    const bTime =
                        b.createdAt
                            ? getTime(
                                b.createdAt
                            )
                            : 0;


                    return bTime - aTime;

                }
            );


            // ------------------------------------------------
            // SHOW ALL POSTS
            // NO LIMIT
            // ------------------------------------------------

            for (
                const post
                of posts
            ) {


                const postId =
                    post.id;


                const date =
                    getPostDate(post);


                // ------------------------------------------------
                // PROFILE
                // ------------------------------------------------

                const profile =
                    await getProfileData(
                        profileUid,
                        post
                    );


                // ------------------------------------------------
                // AVATAR
                // ------------------------------------------------

                let avatarHTML;


                if (
                    profile.profilePicture
                ) {

                    avatarHTML = `

                        <img
                            class="post-avatar"
                            src="${escapeHTML(
                                profile.profilePicture
                            )}"
                            alt="Profile picture"
                            onerror="
                                this.style.display='none';
                            "
                        >

                    `;

                } else {

                    avatarHTML = `

                        <div class="post-avatar-fallback">

                            👤

                        </div>

                    `;

                }


                // ------------------------------------------------
                // POST CARD
                // ------------------------------------------------

                feed.innerHTML += `

                    <div class="post-card">


                        <!-- USER -->

                        <div class="user-info">


                            <a
                                href="profile.html?uid=${encodeURIComponent(
                                    post.uid || profileUid
                                )}"
                                class="post-profile-link"
                            >

                                ${avatarHTML}

                            </a>


                            <div>

                                <h3>

                                    <a
                                        href="profile.html?uid=${encodeURIComponent(
                                            post.uid || profileUid
                                        )}"
                                    >

                                        ${escapeHTML(
                                            profile.fullName
                                        )}

                                    </a>

                                </h3>


                                ${
                                    profile.username
                                    ?

                                    `

                                    <small>
                                        @${escapeHTML(
                                            profile.username
                                        )}
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


                        <!-- TEXT -->

                        ${
                            post.text
                            ?

                            `

                            <p>
                                ${escapeHTML(
                                    post.text
                                )}
                            </p>

                            `

                            :

                            ""
                        }


                        <!-- IMAGE -->

                        ${
                            post.image
                            ?

                            `

                            <img
                                class="post-photo"
                                src="${escapeHTML(
                                    post.image
                                )}"
                                alt="Post Image"
                            >

                            `

                            :

                            ""
                        }


                        <!-- VIDEO -->

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
                                    src="${escapeHTML(
                                        post.video
                                    )}"
                                    type="video/mp4"
                                >

                                Your browser does not support video.

                            </video>

                            `

                            :

                            ""
                        }


                        <!-- BUTTONS -->

                        <div class="post-buttons">


                            <button
                                type="button"
                                onclick="likePost('${postId}')"
                            >

                                ❤️
                                ${post.likes || 0}

                            </button>


                            <button
                                type="button"
                                onclick="openComments('${postId}')"
                            >

                                💬
                                ${post.comments || 0}

                            </button>


                            <button
                                type="button"
                                onclick="repostPost('${postId}')"
                            >

                                🔁
                                ${post.reposts || 0}

                            </button>


                            <button
                                type="button"
                                onclick="sharePost('${postId}')"
                            >

                                🔗
                                ${post.shares || 0}

                            </button>


                        </div>


                    </div>

                `;

            }

        },


        (error) => {

            console.error(
                "USER POSTS ERROR:",
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
// FIRESTORE TIMESTAMP
// ============================================================

function getTime(value) {

    try {

        if (
            typeof value.toMillis ===
            "function"
        ) {

            return value.toMillis();

        }


        if (
            typeof value.toDate ===
            "function"
        ) {

            return value.toDate().getTime();

        }

    } catch (error) {}



    return 0;

}


// ============================================================
// LIKE SYSTEM
// ============================================================

window.likePost =
async function(postId) {


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
            postId +
            "_" +
            user.uid;


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


        // ------------------------------------------------
        // UNLIKE
        // ------------------------------------------------

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


        // ------------------------------------------------
        // LIKE
        // ------------------------------------------------

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


        // ------------------------------------------------
        // NOTIFICATION
        // ------------------------------------------------

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


            if (
                userSnap.exists()
            ) {


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

    }

};


// ============================================================
// COMMENTS
// ============================================================

window.openComments =
function(postId) {

    window.location.href =
        "comments.html?postId=" +
        encodeURIComponent(
            postId
        );

};


// ============================================================
// REPOST
// ============================================================

window.repostPost =
async function(postId) {


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


        const post =
            postSnap.data();


        await updateDoc(
            postRef,
            {

                reposts:
                    increment(1)

            }
        );


        // ------------------------------------------------
        // REPOST NOTIFICATION
        // ------------------------------------------------

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


            if (
                userSnap.exists()
            ) {


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
// SHARE
// ============================================================

window.sharePost =
async function(postId) {


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


        if (
            navigator.share
        ) {


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


        } else {


            await navigator.clipboard.writeText(
                shareUrl
            );


            alert(
                "Post link copied to clipboard."
            );

        }


        await updateDoc(
            postRef,
            {

                shares:
                    increment(1)

            }
        );


    } catch (error) {

        console.log(
            "Share cancelled.",
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

        return;

    }


    const notificationQuery =
        query(
            collection(
                db,
                "notifications"
            ),

            where(
                "receiverId",
                "==",
                user.uid
            )
        );


    onSnapshot(
        notificationQuery,

        (snapshot) => {


            let unreadNotifications =
                0;


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
         * Profile page:
         *
         * profile.html?uid=USER_UID
         *
         * If no UID exists, the logged-in user's
         * own UID is used.
         */

        const uid =
            profileUid ||
            user.uid;


        loadUserPosts(
            uid
        );


        // ----------------------------------------------------
        // NOTIFICATION BADGE
        // ----------------------------------------------------

        setupNotificationBadge(
            user
        );

    }

);