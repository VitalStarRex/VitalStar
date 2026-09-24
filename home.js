// ============================================================
// FIREBASE IMPORTS
// ============================================================

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    getDoc,
    doc,
    deleteDoc,
    updateDoc,
    increment,
    setDoc,
    addDoc,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    auth,
    db,
    rtdb
} from "./firebase.js";


// ============================================================
// VITALSTAR LOADING SCREEN
// ============================================================

const vitalStarLoader = document.createElement("div");

vitalStarLoader.id = "vitalStarLoader";

vitalStarLoader.innerHTML = `

    <div class="vs-loader-content">

        <div class="vs-spinner">

            <span>VS</span>

        </div>

        <div class="vs-loading-text">
            Loading VitalStar...
        </div>

    </div>

`;


// ============================================================
// FAST CHANGING-COLOR LOADING SCREEN
// ============================================================

const vitalStarLoaderStyle =
    document.createElement("style");

vitalStarLoaderStyle.textContent = `

    #vitalStarLoader {

        position: fixed;

        inset: 0;

        z-index: 999999;

        display: flex;

        align-items: center;

        justify-content: center;

        opacity: 1;

        visibility: visible;

        pointer-events: all;

        background:
            radial-gradient(
                circle at center,
                #24105c 0%,
                #09051c 45%,
                #03020a 100%
            );

        animation:
            vsBackgroundColors 5s ease-in-out infinite;

        transition:
            opacity 0.35s ease,
            visibility 0.35s ease;

    }


    #vitalStarLoader.hide {

        opacity: 0;

        visibility: hidden;

        pointer-events: none;

    }


    .vs-loader-content {

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

    }


    .vs-spinner {

        width: 88px;

        height: 88px;

        border-radius: 50%;

        border:
            5px solid
            rgba(255,255,255,0.10);

        border-top-color:
            #FFD54F;

        border-right-color:
            #9C4DFF;

        border-bottom-color:
            #00E5FF;

        display: flex;

        align-items: center;

        justify-content: center;

        animation:
            vsRotate 0.9s linear infinite,
            vsSpinnerColors 5s ease-in-out infinite;

        box-shadow:
            0 0 18px
            rgba(255,213,79,0.30),

            0 0 35px
            rgba(124,77,255,0.25),

            0 0 55px
            rgba(0,229,255,0.12);

    }


    .vs-spinner span {

        font-size: 25px;

        font-weight: 900;

        letter-spacing: 2px;

        color: #FFD54F;

        text-shadow:
            0 0 12px
            rgba(255,213,79,0.60);

        animation:
            vsCounterRotate 0.9s linear infinite,
            vsTextColors 5s ease-in-out infinite;

    }


    .vs-loading-text {

        margin-top: 18px;

        color:
            rgba(255,255,255,0.92);

        font-size: 14px;

        font-weight: 600;

        letter-spacing: 0.5px;

        animation:
            vsTextGlow 5s ease-in-out infinite;

    }


    @keyframes vsRotate {

        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }

    }


    @keyframes vsCounterRotate {

        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(-360deg);
        }

    }


    /* ============================================
       CHANGING BACKGROUND COLORS
       ============================================ */

    @keyframes vsBackgroundColors {

        0% {

            background:
                radial-gradient(
                    circle at center,
                    #24105c 0%,
                    #09051c 45%,
                    #03020a 100%
                );

        }

        25% {

            background:
                radial-gradient(
                    circle at center,
                    #40105f 0%,
                    #12051f 45%,
                    #03020a 100%
                );

        }

        50% {

            background:
                radial-gradient(
                    circle at center,
                    #053b52 0%,
                    #06121f 45%,
                    #02060a 100%
                );

        }

        75% {

            background:
                radial-gradient(
                    circle at center,
                    #3b124f 0%,
                    #11051c 45%,
                    #03020a 100%
                );

        }

        100% {

            background:
                radial-gradient(
                    circle at center,
                    #24105c 0%,
                    #09051c 45%,
                    #03020a 100%
                );

        }

    }


    /* ============================================
       CHANGING SPINNER COLORS
       ============================================ */

    @keyframes vsSpinnerColors {

        0% {

            border-top-color: #FFD54F;
            border-right-color: #9C4DFF;
            border-bottom-color: #00E5FF;

        }

        25% {

            border-top-color: #FF4FD8;
            border-right-color: #FFD54F;
            border-bottom-color: #7C4DFF;

        }

        50% {

            border-top-color: #00E5FF;
            border-right-color: #00FF95;
            border-bottom-color: #FFD54F;

        }

        75% {

            border-top-color: #9C4DFF;
            border-right-color: #FF4FD8;
            border-bottom-color: #00E5FF;

        }

        100% {

            border-top-color: #FFD54F;
            border-right-color: #9C4DFF;
            border-bottom-color: #00E5FF;

        }

    }


    /* ============================================
       CHANGING VS TEXT COLOR
       ============================================ */

    @keyframes vsTextColors {

        0% {

            color: #FFD54F;

            text-shadow:
                0 0 12px
                rgba(255,213,79,0.70);

        }

        25% {

            color: #FF4FD8;

            text-shadow:
                0 0 15px
                rgba(255,79,216,0.70);

        }

        50% {

            color: #00E5FF;

            text-shadow:
                0 0 15px
                rgba(0,229,255,0.70);

        }

        75% {

            color: #9C4DFF;

            text-shadow:
                0 0 15px
                rgba(156,77,255,0.70);

        }

        100% {

            color: #FFD54F;

            text-shadow:
                0 0 12px
                rgba(255,213,79,0.70);

        }

    }


    @keyframes vsTextGlow {

        0% {

            opacity: 0.75;

        }

        50% {

            opacity: 1;

        }

        100% {

            opacity: 0.75;

        }

    }


    @media (max-width: 450px) {

        .vs-spinner {

            width: 82px;

            height: 82px;

        }


        .vs-spinner span {

            font-size: 23px;

        }


        .vs-loading-text {

            font-size: 13px;

        }

    }

`;

document.head.appendChild(
    vitalStarLoaderStyle
);

document.body.appendChild(
    vitalStarLoader
);


// ============================================================
// HIDE LOADING SCREEN
// ============================================================

let vitalStarLoaderHidden = false;

function hideVitalStarLoader() {

    if (vitalStarLoaderHidden) {
        return;
    }

    vitalStarLoaderHidden = true;

    const loader =
        document.getElementById(
            "vitalStarLoader"
        );

    if (!loader) {
        return;
    }

    loader.classList.add("hide");

    setTimeout(() => {

        loader.remove();

    }, 400);

}


// ============================================================
// PAGE ELEMENTS
// ============================================================

const feed =
    document.getElementById("feed");


// ============================================================
// POST FEED STYLES
// ============================================================

const postFeedStyle =
    document.createElement("style");

postFeedStyle.textContent = `

    .post-card {

        position: relative;

        width: min(100%, 680px);

        margin: 0 auto 18px;

        padding: 18px;

        text-align: center;

        background:
            linear-gradient(
                145deg,
                rgba(255,255,255,0.08),
                rgba(255,255,255,0.025)
            );

        border:
            1px solid
            rgba(255,255,255,0.10);

        border-radius: 22px;

        box-shadow:
            0 12px 35px
            rgba(0,0,0,0.14),

            inset 0 1px 0
            rgba(255,255,255,0.08);

        overflow: hidden;

        transition:
            transform 0.25s ease,
            box-shadow 0.25s ease,
            border-color 0.25s ease;

    }


    .post-card:hover {

        transform:
            translateY(-3px);

        box-shadow:
            0 18px 45px
            rgba(0,0,0,0.20),

            inset 0 1px 0
            rgba(255,255,255,0.10);

        border-color:
            rgba(255,213,79,0.35);

    }


    .user-info {

        display: flex;

        justify-content: center;

        align-items: center;

        gap: 12px;

        text-align: left;

        margin-bottom: 8px;

    }


    .avatar {

        flex-shrink: 0;

    }


    .user-info h3 {

        margin: 0 0 3px;

        font-size: 17px;

        line-height: 1.2;

    }


    .user-info h3 a {

        text-decoration: none;

        color: inherit;

        transition:
            opacity 0.2s ease;

    }


    .user-info h3 a:hover {

        opacity: 0.75;

    }


    .user-info small {

        opacity: 0.7;

        font-size: 12px;

    }


    .post-text {

        max-width: 580px;

        margin: 16px auto;

        line-height: 1.65;

        font-size: 15px;

        word-break: break-word;

        white-space: pre-wrap;

    }


    .post-photo,
    .post-video {

        width:
            min(100%, 420px) !important;

        max-height: 500px;

        height: auto !important;

        aspect-ratio: auto;

        object-fit: cover;

        border-radius:
            18px !important;

        display: block;

        margin:
            14px auto !important;

        background:
            rgba(0,0,0,0.15);

        box-shadow:
            0 10px 28px
            rgba(0,0,0,0.18);

    }


    .post-buttons {

        display: flex !important;

        justify-content:
            space-between;

        align-items: center;

        gap: 4px !important;

        flex-wrap: nowrap !important;

        margin-top:
            16px !important;

        padding-top: 14px;

        border-top:
            1px solid
            rgba(255,255,255,0.08);

        width: 100%;

    }


    .post-buttons button {

        flex: 1;

        min-width: 0;

        white-space: nowrap;

        border: none;

        border-radius: 12px;

        padding: 10px 4px;

        cursor: pointer;

        font: inherit;

        font-size: 13px;

        font-weight: 600;

        background:
            rgba(255,255,255,0.08);

        color: inherit;

        transition:
            transform 0.2s ease,
            background 0.2s ease;

    }


    .post-buttons button:hover {

        transform:
            translateY(-2px);

        background:
            rgba(255,213,79,0.16);

    }


    .post-buttons button:active {

        transform:
            scale(0.96);

    }


    @media (max-width: 450px) {

        .post-card {

            padding: 14px;

            border-radius: 18px;

        }


        .post-buttons {

            gap: 2px !important;

        }


        .post-buttons button {

            font-size: 12px;

            padding: 10px 2px;

        }

    }

`;

document.head.appendChild(
    postFeedStyle
);


// ============================================================
// LOAD POSTS
// ============================================================

const postsQuery =
    query(
        collection(db, "posts"),
        orderBy(
            "createdAt",
            "desc"
        ),
        limit(10)
    );


onSnapshot(

    postsQuery,

    async (snapshot) => {

        if (!feed) {

            hideVitalStarLoader();

            return;

        }


        feed.innerHTML = "";


        // ====================================================
        // NO POSTS
        // ====================================================

        if (snapshot.empty) {

            feed.innerHTML = `

                <p style="
                    text-align:center;
                    padding:25px;
                    opacity:0.8;
                ">

                    No posts yet.
                    Be the first to post ⭐

                </p>

            `;

            hideVitalStarLoader();

            return;

        }


        // ====================================================
        // LOAD ALL USER PROFILES IN PARALLEL
        // This is much faster than waiting for each one.
        // ====================================================

        const profileResults =
            await Promise.all(

                snapshot.docs.map(
                    async (docSnap) => {

                        const post =
                            docSnap.data();

                        let profilePicture = "";

                        let fullName =
                            post.fullName ||
                            "VitalStar User";

                        try {

                            const userSnap =
                                await getDoc(
                                    doc(
                                        db,
                                        "users",
                                        post.uid
                                    )
                                );

                            if (
                                userSnap.exists()
                            ) {

                                const userData =
                                    userSnap.data();

                                fullName =
                                    userData.fullName ||
                                    userData.username ||
                                    post.fullName ||
                                    "VitalStar User";

                                profilePicture =
                                    userData.profilePicture ||
                                    "";

                            }

                        } catch (error) {

                            console.error(
                                "Could not load profile:",
                                error
                            );

                        }

                        return {
                            post,
                            postId: docSnap.id,
                            fullName,
                            profilePicture
                        };

                    }
                )

            );


        // ====================================================
        // BUILD FEED
        // ====================================================

        let feedHTML = "";


        for (
            const item
            of profileResults
        ) {

            const {
                post,
                postId,
                fullName,
                profilePicture
            } = item;


            // ==================================================
            // POST DATE
            // ==================================================

            let date =
                "Just now";


            if (post.createdAt) {

                try {

                    date =
                        post.createdAt
                            .toDate()
                            .toLocaleString();

                } catch (e) {

                    console.log(
                        "Could not format post date:",
                        e
                    );

                }

            }


            // ==================================================
            // AVATAR
            // ==================================================

            const avatarHTML =
                profilePicture

                ? `

                    <img
                        src="${profilePicture}"
                        alt="${fullName}"
                        loading="lazy"
                        style="
                            width:50px;
                            height:50px;
                            border-radius:50%;
                            object-fit:cover;
                            display:block;
                            box-shadow:
                                0 4px 15px
                                rgba(0,0,0,0.15);
                        "
                        onerror="
                            this.style.display='none';
                            this.nextElementSibling.style.display='flex';
                        "
                    >

                    <div
                        style="
                            width:50px;
                            height:50px;
                            border-radius:50%;
                            background:#e5e7eb;
                            display:none;
                            align-items:center;
                            justify-content:center;
                            font-size:25px;
                        "
                    >
                        👤
                    </div>

                `

                : `

                    <div
                        style="
                            width:50px;
                            height:50px;
                            border-radius:50%;
                            background:#e5e7eb;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:25px;
                        "
                    >
                        👤
                    </div>

                `;


            // ==================================================
            // POST HTML
            // ==================================================

            feedHTML += `

                <div class="post-card">

                    <div class="user-info">

                        <div class="avatar">

                            ${avatarHTML}

                        </div>


                        <div>

                            <h3>

                                <a
                                    href="profile.html?uid=${post.uid}"
                                >

                                    ${fullName}

                                </a>

                            </h3>


                            <small>

                                ${date}

                            </small>

                        </div>

                    </div>


                    ${
                        post.text

                            ? `

                                <p
                                    class="post-text"
                                >

                                    ${post.text}

                                </p>

                            `

                            : ""
                    }


                    ${
                        post.image

                            ? `

                                <img
                                    class="post-photo"
                                    src="${post.image}"
                                    alt="Post Image"
                                    loading="lazy"
                                >

                            `

                            : ""
                    }


                    ${
                        post.video

                            ? `

                                <video
                                    class="post-video"
                                    controls
                                    preload="metadata"
                                    playsinline
                                >

                                    <source
                                        src="${post.video}"
                                        type="video/mp4"
                                    >

                                    Your browser does
                                    not support video.

                                </video>

                            `

                            : ""
                    }


                    <div
                        class="post-buttons"
                    >

                        <button
                            onclick="
                                likePost('${postId}')
                            "
                        >

                            ❤️
                            ${post.likes || 0}

                        </button>


                        <button
                            onclick="
                                openComments('${postId}')
                            "
                        >

                            💬
                            ${post.comments || 0}

                        </button>


                        <button>

                            🔁
                            ${post.reposts || 0}

                        </button>


                        <button
                            onclick="
                                sharePost('${postId}')
                            "
                        >

                            🔗
                            ${post.shares || 0}

                        </button>

                    </div>

                </div>

            `;

        }


        // ====================================================
        // INSERT EVERYTHING AT ONCE
        // Faster than repeatedly changing innerHTML.
        // ====================================================

        feed.innerHTML =
            feedHTML;


        // ====================================================
        // POSTS LOADED
        // ====================================================

        hideVitalStarLoader();

    },

    (error) => {

        console.error(
            "Post loading error:",
            error
        );


        if (feed) {

            feed.innerHTML = `

                <p
                    style="
                        color:red;
                        text-align:center;
                        padding:20px;
                    "
                >

                    Unable to load posts

                </p>

            `;

        }


        hideVitalStarLoader();

    }

);


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


    const postSnap =
        await getDoc(
            postRef
        );


    if (!postSnap.exists()) {
        return;
    }


    const postData =
        postSnap.data();


    if (
        postData.uid === user.uid
    ) {
        return;
    }


    const userSnap =
        await getDoc(
            doc(
                db,
                "users",
                user.uid
            )
        );


    if (!userSnap.exists()) {
        return;
    }


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

};


// ============================================================
// OPEN COMMENTS
// ============================================================

window.openComments =
function(postId) {

    window.location.href =
        "comments.html?postId=" +
        postId;

};


// ============================================================
// SHARE POST
// ============================================================

window.sharePost =
async function(postId) {

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
        `${window.location.origin}/comments.html?postId=${postId}`;


    try {

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
// WELCOME MESSAGE + ONLINE USERS
// ============================================================

auth.onAuthStateChanged(
async (user) => {

    if (!user) {
        return;
    }


    const onlineUsersCount =
        document.getElementById(
            "onlineUsersCount"
        );


    onValue(
        ref(
            rtdb,
            "status"
        ),
        (snapshot) => {

            let count =
                0;


            snapshot.forEach(
                (child) => {

                    const status =
                        child.val();


                    if (
                        status &&
                        status.online === true
                    ) {

                        count++;

                    }

                }
            );


            if (
                onlineUsersCount
            ) {

                onlineUsersCount.textContent =
                    `🟢 Online: ${count}`;

            }

        }
    );


    const userSnap =
        await getDoc(
            doc(
                db,
                "users",
                user.uid
            )
        );


    if (
        !userSnap.exists()
    ) {
        return;
    }


    const userData =
        userSnap.data();


    const fullName =
        userData.fullName ||
        userData.username ||
        "User";


    const hour =
        new Date().getHours();


    let greeting =
        "Good Evening";


    if (
        hour < 12
    ) {

        greeting =
            "Good Morning";

    } else if (
        hour < 17
    ) {

        greeting =
            "Good Afternoon";

    }


    const welcome =
        document.getElementById(
            "welcomeText"
        );


    if (welcome) {

        welcome.innerHTML =
            `${greeting},
            <span style="color:#FFD54F">
                ${fullName}
            </span> 👋`;

    }

});


// ============================================================
// UNREAD NOTIFICATION BADGE
// ============================================================

const notificationBadge =
    document.getElementById(
        "notificationBadge"
    );


if (
    notificationBadge
) {

    notificationBadge.textContent =
        "0";

    notificationBadge.style.display =
        "inline-flex";

}


// ============================================================
// LOAD UNREAD NOTIFICATIONS
// ============================================================

onAuthStateChanged(
    auth,
    (user) => {

        if (!user) {

            if (
                notificationBadge
            ) {

                notificationBadge.textContent =
                    "0";

                notificationBadge.style.display =
                    "inline-flex";

            }

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


                if (
                    notificationBadge
                ) {

                    notificationBadge.textContent =
                        unreadNotifications > 0
                            ? unreadNotifications
                            : "0";


                    notificationBadge.style.display =
                        "inline-flex";

                }

            },

            (error) => {

                console.error(
                    "Notification badge error:",
                    error
                );


                if (
                    notificationBadge
                ) {

                    notificationBadge.textContent =
                        "0";

                    notificationBadge.style.display =
                        "inline-flex";

                }

            }

        );

    }
);

This version removes a major bottleneck: the 10 profile requests now run at the same time, and the feed HTML is inserted once instead of repeatedly. Images are also lazy-loaded.

The loading screen now cycles through yellow → purple → pink → cyan → green/purple tones while the VS spinner keeps rotating.