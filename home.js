// ============================================================
// VITALSTAR — MODERN FEED
// Firebase v10.12.2
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
// ELEMENTS
// ============================================================

const feed =
    document.getElementById("feed");

const notificationBadge =
    document.getElementById("notificationBadge");


// ============================================================
// SAFE HTML
// ============================================================

function escapeHTML(value = "") {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// MODERN VITALSTAR STYLES
// ============================================================

const style =
    document.createElement("style");

style.textContent = `

/* ==========================================================
   ROOT
   ========================================================== */

:root {

    --vs-gold: #FFD54F;
    --vs-purple: #8B5CF6;
    --vs-blue: #00D9FF;
    --vs-pink: #FF4FD8;

    --vs-bg: #060711;
    --vs-card: #1d1d1d;
    --vs-card-border: rgba(255,255,255,0.10);

    --vs-text: #ffffff;
    --vs-muted: rgba(255,255,255,0.58);

}


/* ==========================================================
   FEED
   ========================================================== */

#feed {

    width: 100%;
    max-width: 720px;

    margin:
        0 auto;

    padding:
        12px 12px 100px;

}


/* ==========================================================
   POST CARD
   (always dark, regardless of light/dark mode)
   ========================================================== */

.post-card {

    position: relative;

    width: 100%;

    margin:
        0 auto 18px;

    padding:
        16px;

    border:
        1px solid
        var(--vs-card-border);

    border-radius:
        24px;

    background:
        var(--vs-card);

    box-shadow:
        0 15px 50px
        rgba(0,0,0,0.22),

        inset 0 1px 0
        rgba(255,255,255,0.08);

    overflow:
        hidden;

    animation:
        vsPostIn .45s ease both;

    transition:
        transform .25s ease,
        border-color .25s ease,
        box-shadow .25s ease;

}

.post-card::before {

    content: "";

    position: absolute;

    top: 0;
    left: 20%;

    width: 60%;
    height: 1px;

    background:
        linear-gradient(
            90deg,
            transparent,
            rgba(255,213,79,.55),
            transparent
        );

}

.post-card:hover {

    transform:
        translateY(-2px);

    border-color:
        rgba(255,213,79,.22);

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.28),

        0 0 35px
        rgba(139,92,246,.06);

}

@keyframes vsPostIn {

    from {

        opacity: 0;

        transform:
            translateY(12px)
            scale(.985);

    }

    to {

        opacity: 1;

        transform:
            translateY(0)
            scale(1);

    }

}


/* ==========================================================
   USER HEADER
   ========================================================== */

.user-info {

    display:
        flex;

    align-items:
        center;

    gap:
        11px;

    margin-bottom:
        12px;

}

.avatar {

    width:
        48px;

    height:
        48px;

    flex:
        0 0 48px;

    position:
        relative;

}

.avatar img,
.avatar-fallback {

    width:
        48px;

    height:
        48px;

    border-radius:
        50%;

    object-fit:
        cover;

}

.avatar img {

    display:
        block;

    border:
        2px solid
        rgba(255,255,255,.15);

    box-shadow:
        0 5px 18px
        rgba(0,0,0,.25);

}

.avatar-fallback {

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    background:
        linear-gradient(
            135deg,
            #8B5CF6,
            #00D9FF
        );

    color:
        white;

    font-size:
        20px;

    font-weight:
        800;

}

.user-details {

    min-width:
        0;

    flex:
        1;

}

.user-details h3 {

    margin:
        0;

    font-size:
        15px;

    font-weight:
        750;

    line-height:
        1.25;

}

.user-details h3 a {

    color:
        var(--vs-text);

    text-decoration:
        none;

}

.user-details h3 a:hover {

    color:
        var(--vs-gold);

}

.post-time {

    display:
        block;

    margin-top:
        4px;

    color:
        var(--vs-muted);

    font-size:
        11px;

}


/* ==========================================================
   ONLINE DOT
   ========================================================== */

.user-online-dot {

    width:
        8px;

    height:
        8px;

    border-radius:
        50%;

    background:
        #22c55e;

    box-shadow:
        0 0 10px
        rgba(34,197,94,.8);

}


/* ==========================================================
   POST TEXT
   ========================================================== */

.post-text {

    margin:
        14px 2px 16px;

    color:
        rgba(255,255,255,.91);

    font-size:
        15px;

    line-height:
        1.7;

    text-align:
        left;

    white-space:
        pre-wrap;

    overflow-wrap:
        anywhere;

}


/* ==========================================================
   MEDIA
   ========================================================== */

.post-media {

    position:
        relative;

    margin:
        12px auto;

    overflow:
        hidden;

    border-radius:
        19px;

    background:
        rgba(0,0,0,.25);

}

.post-photo,
.post-video {

    width:
        100% !important;

    max-width:
        100% !important;

    max-height:
        560px;

    height:
        auto !important;

    display:
        block;

    object-fit:
        cover;

    border-radius:
        19px !important;

}

.post-photo {

    transition:
        transform .4s ease;

}

.post-media:hover .post-photo {

    transform:
        scale(1.015);

}


/* ==========================================================
   ACTION BAR
   ========================================================== */

.post-buttons {

    display:
        grid !important;

    grid-template-columns:
        repeat(4, 1fr);

    gap:
        7px !important;

    width:
        100%;

    margin-top:
        15px !important;

    padding-top:
        12px;

    border-top:
        1px solid
        rgba(255,255,255,.075);

}

.post-buttons button {

    min-width:
        0;

    border:
        1px solid
        transparent;

    border-radius:
        13px;

    padding:
        10px 5px;

    background:
        rgba(255,255,255,.045);

    color:
        rgba(255,255,255,.75);

    font:
        inherit;

    font-size:
        12px;

    font-weight:
        650;

    cursor:
        pointer;

    transition:
        transform .18s ease,
        background .18s ease,
        color .18s ease,
        border-color .18s ease;

}

.post-buttons button:hover {

    transform:
        translateY(-2px);

    background:
        rgba(255,213,79,.10);

    color:
        var(--vs-gold);

    border-color:
        rgba(255,213,79,.16);

}

.post-buttons button:active {

    transform:
        scale(.94);

}


/* ==========================================================
   LIKE EFFECT
   ========================================================== */

.post-buttons button:first-child:hover {

    color:
        #ff5577;

    background:
        rgba(255,85,119,.09);

}

@keyframes vsHeart {

    0% {
        transform:
            scale(1);
    }

    35% {
        transform:
            scale(1.25);
    }

    70% {
        transform:
            scale(.92);
    }

    100% {
        transform:
            scale(1);
    }

}


/* ==========================================================
   LOADING SCREEN
   ========================================================== */

#vitalStarLoader {

    position:
        fixed;

    inset:
        0;

    z-index:
        999999;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    background:
        radial-gradient(
            circle at center,
            #29105f 0%,
            #0b061c 43%,
            #03030a 100%
        );

    transition:
        opacity .4s ease,
        visibility .4s ease;

}

#vitalStarLoader.hide {

    opacity:
        0;

    visibility:
        hidden;

    pointer-events:
        none;

}

.vs-loader-content {

    display:
        flex;

    flex-direction:
        column;

    align-items:
        center;

}

.vs-spinner {

    width:
        82px;

    height:
        82px;

    border-radius:
        50%;

    border:
        4px solid
        rgba(255,255,255,.08);

    border-top-color:
        var(--vs-gold);

    border-right-color:
        var(--vs-purple);

    border-bottom-color:
        var(--vs-blue);

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    animation:
        vsRotate .85s linear infinite;

    box-shadow:
        0 0 30px
        rgba(139,92,246,.25);

}

.vs-spinner span {

    font-size:
        23px;

    font-weight:
        900;

    color:
        var(--vs-gold);

    letter-spacing:
        2px;

    animation:
        vsCounterRotate .85s linear infinite;

}

.vs-loading-text {

    margin-top:
        17px;

    color:
        rgba(255,255,255,.8);

    font-size:
        13px;

    font-weight:
        600;

}

@keyframes vsRotate {

    to {

        transform:
            rotate(360deg);

    }

}

@keyframes vsCounterRotate {

    to {

        transform:
            rotate(-360deg);

    }

}


/* ==========================================================
   EMPTY FEED
   ========================================================== */

.vs-empty {

    padding:
        45px 20px;

    text-align:
        center;

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius:
        22px;

    background:
        var(--vs-card);

}

.vs-empty-icon {

    font-size:
        38px;

    margin-bottom:
        10px;

}

.vs-empty-title {

    margin:
        0 0 5px;

    font-size:
        17px;

    font-weight:
        750;

    color:
        var(--vs-text);

}

.vs-empty-text {

    margin:
        0;

    color:
        var(--vs-muted);

    font-size:
        13px;

}


/* ==========================================================
   ERROR
   ========================================================== */

.vs-error {

    margin:
        20px 0;

    padding:
        18px;

    text-align:
        center;

    border-radius:
        18px;

    background:
        rgba(239,68,68,.08);

    border:
        1px solid
        rgba(239,68,68,.18);

    color:
        #ff8d8d;

}


/* ==========================================================
   NOTIFICATION BADGE
   ========================================================== */

#notificationBadge {

    min-width:
        18px;

    height:
        18px;

    padding:
        0 5px;

    align-items:
        center;

    justify-content:
        center;

    border-radius:
        999px;

    background:
        linear-gradient(
            135deg,
            #ff416c,
            #ff4b2b
        );

    color:
        white;

    font-size:
        10px;

    font-weight:
        800;

    box-shadow:
        0 4px 12px
        rgba(255,65,108,.35);

}


/* ==========================================================
   MOBILE
   ========================================================== */

@media (max-width: 600px) {

    #feed {

        padding:
            8px 8px 90px;

    }

    .post-card {

        padding:
            14px;

        border-radius:
            21px;

    }

    .post-buttons {

        gap:
            5px !important;

    }

    .post-buttons button {

        font-size:
            11px;

        padding:
            10px 2px;

    }

    .post-text {

        font-size:
            14px;

    }

}

`;

document.head.appendChild(style);


// ============================================================
// LOADING SCREEN
// ============================================================

const loader =
    document.createElement("div");

loader.id =
    "vitalStarLoader";

loader.innerHTML = `

    <div class="vs-loader-content">

        <div class="vs-spinner">

            <span>VS</span>

        </div>

        <div class="vs-loading-text">
            Loading VitalStar...
        </div>

    </div>

`;

document.body.appendChild(loader);


let loaderHidden = false;


function hideVitalStarLoader() {

    if (loaderHidden) return;

    loaderHidden = true;

    loader.classList.add("hide");

    setTimeout(() => {

        loader.remove();

    }, 450);

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatPostDate(timestamp) {

    if (!timestamp) {

        return "Just now";

    }

    try {

        const date =
            timestamp.toDate();

        const now =
            new Date();

        const seconds =
            Math.floor(
                (now - date) / 1000
            );

        if (seconds < 60) {

            return "Just now";

        }

        const minutes =
            Math.floor(
                seconds / 60
            );

        if (minutes < 60) {

            return `${minutes}m ago`;

        }

        const hours =
            Math.floor(
                minutes / 60
            );

        if (hours < 24) {

            return `${hours}h ago`;

        }

        const days =
            Math.floor(
                hours / 24
            );

        if (days < 7) {

            return `${days}d ago`;

        }

        return date.toLocaleDateString(
            undefined,
            {
                day:
                    "numeric",

                month:
                    "short",

                year:
                    "numeric"
            }
        );

    } catch {

        return "Just now";

    }

}


// ============================================================
// AVATAR
// ============================================================

function createAvatar(
    profilePicture,
    fullName
) {

    const safeName =
        escapeHTML(fullName);

    if (profilePicture) {

        return `

            <img
                src="${escapeHTML(profilePicture)}"
                alt="${safeName}"
                loading="lazy"
                onerror="
                    this.style.display='none';
                    this.nextElementSibling.style.display='flex';
                "
            >

            <div
                class="avatar-fallback"
                style="display:none;"
            >
                ${safeName.charAt(0).toUpperCase() || "V"}
            </div>

        `;

    }

    return `

        <div class="avatar-fallback">

            ${safeName.charAt(0).toUpperCase() || "V"}

        </div>

    `;

}


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

        if (snapshot.empty) {

            feed.innerHTML = `

                <div class="vs-empty">

                    <div class="vs-empty-icon">
                        ⭐
                    </div>

                    <p class="vs-empty-title">
                        No posts yet
                    </p>

                    <p class="vs-empty-text">
                        Be the first person to share something.
                    </p>

                </div>

            `;

            hideVitalStarLoader();

            return;

        }


        try {

            const profileResults =
                await Promise.all(

                    snapshot.docs.map(
                        async postDoc => {

                            const post =
                                postDoc.data();

                            let fullName =
                                post.fullName ||
                                "VitalStar User";

                            let profilePicture =
                                "";

                            try {

                                if (post.uid) {

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
                                            fullName;

                                        profilePicture =
                                            userData.profilePicture ||
                                            "";

                                    }

                                }

                            } catch (error) {

                                console.error(
                                    "Profile loading error:",
                                    error
                                );

                            }

                            return {

                                post,

                                postId:
                                    postDoc.id,

                                fullName,

                                profilePicture

                            };

                        }
                    )

                );


            let html = "";


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


                const safeName =
                    escapeHTML(fullName);

                const safeUid =
                    escapeHTML(
                        post.uid || ""
                    );


                const text =
                    post.text
                        ? escapeHTML(post.text)
                        : "";


                const date =
                    formatPostDate(
                        post.createdAt
                    );


                const avatar =
                    createAvatar(
                        profilePicture,
                        fullName
                    );


                const imageHTML =
                    post.image
                        ? `

                            <div class="post-media">

                                <img
                                    class="post-photo"
                                    src="${escapeHTML(post.image)}"
                                    alt="Post image"
                                    loading="lazy"
                                >

                            </div>

                        `
                        : "";


                const videoHTML =
                    post.video
                        ? `

                            <div class="post-media">

                                <video
                                    class="post-video"
                                    controls
                                    preload="metadata"
                                    playsinline
                                >

                                    <source
                                        src="${escapeHTML(post.video)}"
                                        type="video/mp4"
                                    >

                                    Your browser does not
                                    support video.

                                </video>

                            </div>

                        `
                        : "";


                html += `

                    <article
                        class="post-card"
                        data-post-id="${escapeHTML(postId)}"
                    >

                        <div class="user-info">

                            <div class="avatar">

                                ${avatar}

                            </div>


                            <div class="user-details">

                                <h3>

                                    <a
                                        href="profile.html?uid=${encodeURIComponent(safeUid)}"
                                    >

                                        ${safeName}

                                    </a>

                                </h3>


                                <small class="post-time">

                                    ${escapeHTML(date)}

                                </small>

                            </div>

                        </div>


                        ${
                            text
                                ? `

                                    <div class="post-text">

                                        ${text}

                                    </div>

                                `
                                : ""
                        }


                        ${imageHTML}

                        ${videoHTML}


                        <div class="post-buttons">

                            <button
                                type="button"
                                onclick="likePost('${escapeHTML(postId)}')"
                                aria-label="Like post"
                            >

                                ❤️

                                <span>
                                    ${Number(post.likes) || 0}
                                </span>

                            </button>


                            <button
                                type="button"
                                onclick="openComments('${escapeHTML(postId)}')"
                                aria-label="Comments"
                            >

                                💬

                                <span>
                                    ${Number(post.comments) || 0}
                                </span>

                            </button>


                            <button
                                type="button"
                                onclick="repostPost('${escapeHTML(postId)}')"
                                aria-label="Repost"
                            >

                                🔁

                                <span>
                                    ${Number(post.reposts) || 0}
                                </span>

                            </button>


                            <button
                                type="button"
                                onclick="sharePost('${escapeHTML(postId)}')"
                                aria-label="Share post"
                            >

                                🔗

                                <span>
                                    ${Number(post.shares) || 0}
                                </span>

                            </button>

                        </div>

                    </article>

                `;

            }


            feed.innerHTML =
                html;

            hideVitalStarLoader();


        } catch (error) {

            console.error(
                "Feed rendering error:",
                error
            );

            feed.innerHTML = `

                <div class="vs-error">
                    Unable to load posts right now.
                </div>

            `;

            hideVitalStarLoader();

        }

    },

    error => {

        console.error(
            "Post loading error:",
            error
        );

        if (feed) {

            feed.innerHTML = `

                <div class="vs-error">
                    Unable to load posts.
                </div>

            `;

        }

        hideVitalStarLoader();

    }

);


// ============================================================
// LIKE
// ============================================================

window.likePost =
    async function(postId) {

        const user =
            auth.currentUser;


        if (!user) {

            alert(
                "Please login first."
            );

            return;

        }


        const button =
            document.querySelector(
                `[data-post-id="${CSS.escape(postId)}"] .post-buttons button:first-child`
            );


        if (button) {

            button.style.animation =
                "vsHeart .35s ease";

            setTimeout(() => {

                button.style.animation =
                    "";

            }, 400);

        }


        try {

            const likeId =
                `${postId}_${user.uid}`;


            const likeRef =
                doc(
                    db,
                    "likes",
                    likeId
                );


            const postRef =
                doc(
                    db,
                    "posts",
                    postId
                );


            const likeSnap =
                await getDoc(
                    likeRef
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

                    postId,

                    createdAt:
                        serverTimestamp()

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


            if (!postSnap.exists())
                return;


            const postData =
                postSnap.data();


            if (
                postData.uid ===
                user.uid
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


            if (!userSnap.exists())
                return;


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

                    postId,

                    read:
                        false,

                    createdAt:
                        serverTimestamp()

                }
            );


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
            `comments.html?postId=${encodeURIComponent(postId)}`;

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
                "Please login first."
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


            alert(
                "Post reposted 🔁"
            );


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
                `${window.location.origin}/comments.html?postId=${encodeURIComponent(postId)}`;


            if (
                navigator.share
            ) {

                await navigator.share({

                    title:
                        "VitalStar Post",

                    text:
                        post.text ||
                        "Check out this post on VitalStar!",

                    url:
                        shareUrl

                });

            } else if (
                navigator.clipboard
            ) {

                await navigator.clipboard.writeText(
                    shareUrl
                );

                alert(
                    "Post link copied 🔗"
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

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(
                    "Share error:",
                    error
                );

            }

        }

    };


// ============================================================
// WELCOME + ONLINE USERS
// ============================================================

auth.onAuthStateChanged(
    async user => {

        if (!user)
            return;


        const onlineUsersCount =
            document.getElementById(
                "onlineUsersCount"
            );


        onValue(
            ref(
                rtdb,
                "status"
            ),
            snapshot => {

                let count = 0;


                snapshot.forEach(
                    child => {

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
                        `🟢 ${count} online`;

                }

            }
        );


        try {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (!userSnap.exists())
                return;


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


            if (hour < 12) {

                greeting =
                    "Good Morning";

            } else if (hour < 17) {

                greeting =
                    "Good Afternoon";

            }


            const welcome =
                document.getElementById(
                    "welcomeText"
                );


            if (welcome) {

                welcome.innerHTML = `

                    ${escapeHTML(greeting)},

                    <span
                        style="
                            color:#FFD54F;
                            font-weight:800;
                        "
                    >

                        ${escapeHTML(fullName)}

                    </span>

                    👋

                `;

            }


        } catch (error) {

            console.error(
                "Welcome error:",
                error
            );

        }

    }
);


// ============================================================
// NOTIFICATION BADGE
// ============================================================

if (notificationBadge) {

    notificationBadge.textContent =
        "0";

    notificationBadge.style.display =
        "inline-flex";

}


onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            if (notificationBadge) {

                notificationBadge.textContent =
                    "0";

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

            snapshot => {

                let unread =
                    0;


                snapshot.forEach(
                    notificationDoc => {

                        const data =
                            notificationDoc.data();


                        if (
                            data.read === false
                        ) {

                            unread++;

                        }

                    }
                );


                if (
                    notificationBadge
                ) {

                    notificationBadge.textContent =
                        unread > 99
                            ? "99+"
                            : String(unread);

                    notificationBadge.style.display =
                        "inline-flex";

                }

            },

            error => {

                console.error(
                    "Notification error:",
                    error
                );

            }

        );

    }
);
