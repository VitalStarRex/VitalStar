// ============================================================
// VITALSTAR — MODERN NEON SOCIAL FEED
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
// MODERN FEED STYLES
// ============================================================

const style =
    document.createElement("style");

style.textContent = `

/* =========================================================
   FEED
   ========================================================= */

#feed{
    width:100%;
    max-width:900px;
    margin:0 auto;
    padding:0 0 110px;
}


/* =========================================================
   POST CARD
   ========================================================= */

.post-card{

    position:relative;

    width:100%;

    margin:
        0 0 16px;

    padding:
        14px;

    border-radius:
        20px;

    background:
        linear-gradient(
            145deg,
            #11172a 0%,
            #0d1221 100%
        );

    border:
        1px solid
        rgba(255,255,255,.075);

    color:#f5f7ff;

    box-shadow:
        0 10px 30px
        rgba(0,0,0,.30);

    overflow:hidden;

    animation:
        vsPostIn .35s ease both;

    transition:
        transform .2s ease,
        border-color .2s ease,
        box-shadow .2s ease;
}


.post-card::before{

    content:"";

    position:absolute;

    top:0;
    left:15%;

    width:70%;
    height:1px;

    background:
        linear-gradient(
            90deg,
            transparent,
            rgba(0,217,255,.55),
            rgba(139,63,255,.65),
            transparent
        );

}


.post-card:hover{

    transform:
        translateY(-2px);

    border-color:
        rgba(116,77,255,.22);

    box-shadow:
        0 15px 38px
        rgba(0,0,0,.38),

        0 0 25px
        rgba(104,63,255,.06);

}


@keyframes vsPostIn{

    from{
        opacity:0;
        transform:
            translateY(10px);
    }

    to{
        opacity:1;
        transform:
            translateY(0);
    }

}


/* =========================================================
   USER HEADER
   ========================================================= */

.user-info{

    display:flex;

    align-items:center;

    gap:10px;

    padding:
        1px 1px 7px;

}


.avatar{

    width:46px;
    height:46px;

    min-width:46px;

    border-radius:50%;

    overflow:hidden;

    background:
        linear-gradient(
            135deg,
            #7b35ff,
            #00cfff,
            #ff269f
        );

    padding:2px;

}


.avatar img{

    width:100%;
    height:100%;

    object-fit:cover;

    display:block;

    border-radius:50%;

    background:#101528;

}


.avatar-fallback{

    width:100%;
    height:100%;

    border-radius:50%;

    display:flex;

    align-items:center;

    justify-content:center;

    background:
        linear-gradient(
            135deg,
            #7639ff,
            #00cfff
        );

    color:#fff;

    font-size:18px;

    font-weight:900;

}


.user-details{

    min-width:0;

    flex:1;

}


.user-details h3{

    margin:0;

    color:#f4f6ff;

    font-size:15px;

    font-weight:850;

    line-height:1.25;

}


.user-details h3 a{

    color:#f4f6ff;

    text-decoration:none;

}


.user-details h3 a:hover{

    color:#00d9ff;

}


.post-meta{

    display:flex;

    align-items:center;

    gap:5px;

    margin-top:4px;

    color:#8993b2;

    font-size:10px;

}


.post-privacy{

    display:inline-flex;

    align-items:center;

    gap:3px;

}


.online-dot{

    width:7px;
    height:7px;

    border-radius:50%;

    background:#32df72;

    box-shadow:
        0 0 8px
        rgba(50,223,114,.75);

}


.post-menu{

    width:34px;
    height:34px;

    border:0;

    border-radius:50%;

    background:transparent;

    color:#9ba5c4;

    font-size:19px;

    cursor:pointer;

}


.post-menu:hover{

    background:
        rgba(255,255,255,.06);

    color:#fff;

}


/* =========================================================
   POST TEXT
   ========================================================= */

.post-text{

    margin:
        8px 1px 13px;

    color:#eef1ff;

    font-size:15px;

    line-height:1.55;

    white-space:pre-wrap;

    overflow-wrap:anywhere;

}


.post-text .hashtag{

    color:#728cff;

    font-weight:700;

}


/* =========================================================
   MEDIA
   ========================================================= */

.post-media{

    width:100%;

    margin:
        8px 0 12px;

    overflow:hidden;

    border-radius:16px;

    background:#080b16;

    border:
        1px solid
        rgba(255,255,255,.05);

}


.post-photo,
.post-video{

    width:100% !important;

    max-width:100% !important;

    max-height:620px;

    display:block;

    object-fit:cover;

    border-radius:16px !important;

}


.post-video{

    background:#000;

}


/* =========================================================
   STATS
   ========================================================= */

.post-stats{

    display:flex;

    align-items:center;

    justify-content:space-between;

    padding:
        0 3px 9px;

    color:#8f98b6;

    font-size:11px;

}


.stat-left{

    display:flex;

    align-items:center;

    gap:7px;

}


.like-dot{

    width:19px;
    height:19px;

    border-radius:50%;

    display:flex;

    align-items:center;

    justify-content:center;

    background:
        linear-gradient(
            135deg,
            #ff3d78,
            #ff1763
        );

    font-size:10px;

}


.stat-right{

    display:flex;

    gap:10px;

}


/* =========================================================
   ACTION BAR
   ========================================================= */

.post-buttons{

    display:grid !important;

    grid-template-columns:
        repeat(4,1fr);

    gap:4px !important;

    width:100%;

    padding:
        8px 0 0;

    border-top:
        1px solid
        rgba(255,255,255,.07);

}


.post-buttons button{

    min-width:0;

    border:0;

    border-radius:11px;

    padding:
        9px 3px;

    background:transparent;

    color:#aab3d0;

    font-size:12px;

    font-weight:750;

    cursor:pointer;

    transition:
        background .18s ease,
        color .18s ease,
        transform .18s ease;

}


.post-buttons button:hover{

    background:
        rgba(255,255,255,.055);

    color:#fff;

    transform:
        translateY(-1px);

}


.post-buttons button:active{

    transform:
        scale(.94);

}


.post-buttons button:nth-child(1):hover{

    color:#ff4b7c;

}


.post-buttons button:nth-child(2):hover{

    color:#00d9ff;

}


.post-buttons button:nth-child(3):hover{

    color:#9b6aff;

}


.post-buttons button:nth-child(4):hover{

    color:#21e6c1;

}


/* =========================================================
   HEART ANIMATION
   ========================================================= */

@keyframes vsHeart{

    0%{
        transform:scale(1);
    }

    35%{
        transform:scale(1.28);
    }

    70%{
        transform:scale(.92);
    }

    100%{
        transform:scale(1);
    }

}


/* =========================================================
   EMPTY FEED
   ========================================================= */

.vs-empty{

    padding:
        50px 20px;

    text-align:center;

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius:22px;

    background:
        linear-gradient(
            145deg,
            #11172a,
            #0d1221
        );

}


.vs-empty-icon{

    font-size:42px;

    margin-bottom:12px;

}


.vs-empty-title{

    color:#fff;

    font-size:18px;

    font-weight:850;

    margin-bottom:6px;

}


.vs-empty-text{

    color:#8791af;

    font-size:13px;

}


/* =========================================================
   ERROR
   ========================================================= */

.vs-error{

    padding:20px;

    text-align:center;

    border-radius:18px;

    color:#ff9292;

    background:
        rgba(255,50,80,.08);

    border:
        1px solid
        rgba(255,50,80,.16);

}


/* =========================================================
   LOADER
   ========================================================= */

#vitalStarLoader{

    position:fixed;

    inset:0;

    z-index:999999;

    display:flex;

    align-items:center;

    justify-content:center;

    background:
        radial-gradient(
            circle at center,
            #26105d 0%,
            #0b071b 42%,
            #03040a 100%
        );

    transition:
        opacity .45s ease,
        visibility .45s ease;

}


#vitalStarLoader.hide{

    opacity:0;

    visibility:hidden;

    pointer-events:none;

}


.vs-loader-content{

    display:flex;

    flex-direction:column;

    align-items:center;

}


.vs-spinner{

    width:82px;
    height:82px;

    border-radius:50%;

    border:
        4px solid
        rgba(255,255,255,.08);

    border-top-color:#00d9ff;

    border-right-color:#8b42ff;

    border-bottom-color:#ff2ca8;

    display:flex;

    align-items:center;

    justify-content:center;

    animation:
        vsRotate .8s linear infinite;

    box-shadow:
        0 0 28px
        rgba(110,57,255,.28);

}


.vs-spinner span{

    color:#fff;

    font-size:22px;

    font-weight:900;

    letter-spacing:2px;

    animation:
        vsCounterRotate .8s linear infinite;

}


.vs-loading-text{

    margin-top:17px;

    color:#bfc7e3;

    font-size:13px;

    font-weight:700;

}


@keyframes vsRotate{

    to{
        transform:rotate(360deg);
    }

}


@keyframes vsCounterRotate{

    to{
        transform:rotate(-360deg);
    }

}


/* =========================================================
   MOBILE
   ========================================================= */

@media(max-width:600px){

    #feed{

        padding:
            0 0 95px;

    }

    .post-card{

        padding:12px;

        border-radius:18px;

    }

    .post-text{

        font-size:14px;

    }

    .post-buttons button{

        font-size:11px;

    }

}

`;

document.head.appendChild(style);


// ============================================================
// LOADER
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


function hideVitalStarLoader(){

    if(loaderHidden)
        return;

    loaderHidden = true;

    loader.classList.add("hide");

    setTimeout(() => {

        if(loader)
            loader.remove();

    }, 500);

}


// ============================================================
// DATE
// ============================================================

function formatPostDate(timestamp){

    if(!timestamp)
        return "Just now";

    try{

        const date =
            timestamp.toDate();

        const now =
            new Date();

        const seconds =
            Math.floor(
                (now - date) / 1000
            );


        if(seconds < 60)
            return "Just now";


        const minutes =
            Math.floor(seconds / 60);


        if(minutes < 60)
            return `${minutes}m ago`;


        const hours =
            Math.floor(minutes / 60);


        if(hours < 24)
            return `${hours}h ago`;


        const days =
            Math.floor(hours / 24);


        if(days < 7)
            return `${days}d ago`;


        return date.toLocaleDateString(
            undefined,
            {
                day:"numeric",
                month:"short"
            }
        );

    }catch{

        return "Just now";

    }

}


// ============================================================
// TEXT WITH HASHTAGS
// ============================================================

function formatPostText(text){

    const escaped =
        escapeHTML(text);

    return escaped.replace(
        /(^|\s)(#[a-zA-Z0-9_]+)/g,
        '$1<span class="hashtag">$2</span>'
    );

}


// ============================================================
// AVATAR
// ============================================================

function createAvatar(
    profilePicture,
    fullName
){

    const safeName =
        escapeHTML(fullName);

    const firstLetter =
        escapeHTML(
            (fullName || "V")
                .charAt(0)
                .toUpperCase()
        );


    if(profilePicture){

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
                ${firstLetter}
            </div>

        `;

    }


    return `

        <div class="avatar-fallback">
            ${firstLetter}
        </div>

    `;

}


// ============================================================
// POST VISIBILITY
// ============================================================

function getPrivacy(post){

    const value =
        String(
            post.privacy ||
            post.visibility ||
            "Public"
        ).toLowerCase();


    if(value === "friends")
        return "👥 Friends";

    if(value === "private")
        return "🔒 Only me";

    return "🌐 Public";

}


// ============================================================
// MEDIA
// ============================================================

function createMedia(post){

    let html = "";


    if(post.image){

        html += `

            <div class="post-media">

                <img
                    class="post-photo"
                    src="${escapeHTML(post.image)}"
                    alt="Post image"
                    loading="lazy"
                >

            </div>

        `;

    }


    if(post.video){

        html += `

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

                    Your browser does not support video.

                </video>

            </div>

        `;

    }


    return html;

}


// ============================================================
// FEED QUERY
// ============================================================

const postsQuery =
    query(
        collection(db,"posts"),

        orderBy(
            "createdAt",
            "desc"
        ),

        limit(10)
    );


// ============================================================
// LOAD FEED
// ============================================================

onSnapshot(

    postsQuery,

    async snapshot => {

        if(!feed){

            hideVitalStarLoader();

            return;

        }


        if(snapshot.empty){

            feed.innerHTML = `

                <div class="vs-empty">

                    <div class="vs-empty-icon">
                        ⭐
                    </div>

                    <div class="vs-empty-title">
                        Your feed is waiting
                    </div>

                    <div class="vs-empty-text">
                        Be the first to share something with VitalStar.
                    </div>

                </div>

            `;

            hideVitalStarLoader();

            return;

        }


        try{

            const profileResults =
                await Promise.all(

                    snapshot.docs.map(
                        async postDoc => {

                            const post =
                                postDoc.data();

                            let fullName =
                                post.fullName ||
                                post.username ||
                                "VitalStar User";

                            let username =
                                post.username ||
                                "";

                            let profilePicture =
                                post.profilePicture ||
                                "";


                            try{

                                if(post.uid){

                                    const userSnap =
                                        await getDoc(
                                            doc(
                                                db,
                                                "users",
                                                post.uid
                                            )
                                        );


                                    if(
                                        userSnap.exists()
                                    ){

                                        const userData =
                                            userSnap.data();


                                        fullName =
                                            userData.fullName ||
                                            userData.username ||
                                            fullName;


                                        username =
                                            userData.username ||
                                            username;


                                        profilePicture =
                                            userData.profilePicture ||
                                            profilePicture;

                                    }

                                }

                            }catch(error){

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

                                username,

                                profilePicture

                            };

                        }
                    )

                );


            let html = "";


            for(
                const item
                of profileResults
            ){

                const {
                    post,
                    postId,
                    fullName,
                    username,
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
                        ? formatPostText(post.text)
                        : "";


                const date =
                    formatPostDate(
                        post.createdAt
                    );


                const privacy =
                    getPrivacy(post);


                const avatar =
                    createAvatar(
                        profilePicture,
                        fullName
                    );


                const media =
                    createMedia(post);


                const likes =
                    Number(post.likes) || 0;


                const comments =
                    Number(post.comments) || 0;


                const reposts =
                    Number(post.reposts) || 0;


                const shares =
                    Number(post.shares) || 0;


                html += `

<article
    class="post-card"
    data-post-id="${escapeHTML(postId)}"
>

    <!-- USER -->

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


            <div class="post-meta">

                <span>
                    ${escapeHTML(date)}
                </span>

                <span>•</span>

                <span class="post-privacy">
                    ${escapeHTML(privacy)}
                </span>

            </div>

        </div>


        <button
            class="post-menu"
            type="button"
            aria-label="Post options"
            onclick="postOptions('${escapeHTML(postId)}')"
        >
            •••
        </button>

    </div>


    <!-- TEXT -->

    ${
        text
            ? `
                <div class="post-text">
                    ${text}
                </div>
            `
            : ""
    }


    <!-- MEDIA -->

    ${media}


    <!-- STATS -->

    <div class="post-stats">

        <div class="stat-left">

            ${
                likes > 0
                    ? `
                        <span class="like-dot">
                            ♥
                        </span>

                        <span>
                            ${likes}
                        </span>
                    `
                    : ""
            }

        </div>


        <div class="stat-right">

            ${
                comments > 0
                    ? `<span>${comments} comments</span>`
                    : ""
            }

            ${
                reposts > 0
                    ? `<span>${reposts} reposts</span>`
                    : ""
            }

        </div>

    </div>


    <!-- ACTIONS -->

    <div class="post-buttons">

        <button
            type="button"
            onclick="likePost('${escapeHTML(postId)}')"
        >
            ❤️ ${likes}
        </button>


        <button
            type="button"
            onclick="openComments('${escapeHTML(postId)}')"
        >
            💬 ${comments}
        </button>


        <button
            type="button"
            onclick="repostPost('${escapeHTML(postId)}')"
        >
            🔄 ${reposts}
        </button>


        <button
            type="button"
            onclick="sharePost('${escapeHTML(postId)}')"
        >
            ↗️ Share
        </button>

    </div>

</article>

`;

            }


            feed.innerHTML =
                html;


            hideVitalStarLoader();


        }catch(error){

            console.error(
                "Feed rendering error:",
                error
            );


            feed.innerHTML = `

                <div class="vs-error">
                    Unable to load your feed right now.
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


        if(feed){

            feed.innerHTML = `

                <div class="vs-error">
                    Unable to load posts right now.
                </div>

            `;

        }


        hideVitalStarLoader();

    }

);


// ============================================================
// POST OPTIONS
// ============================================================

window.postOptions =
    function(postId){

        const choice =
            confirm(
                "Post options\n\nOK = Delete (only if it is your post)\nCancel = Close"
            );


        if(!choice)
            return;


        deletePost(postId);

    };


// ============================================================
// DELETE POST
// ============================================================

async function deletePost(postId){

    const user =
        auth.currentUser;


    if(!user){

        alert("Please login first.");

        return;

    }


    try{

        const postRef =
            doc(
                db,
                "posts",
                postId
            );


        const postSnap =
            await getDoc(postRef);


        if(!postSnap.exists()){

            alert("Post not found.");

            return;

        }


        const post =
            postSnap.data();


        if(post.uid !== user.uid){

            alert(
                "You can only delete your own posts."
            );

            return;

        }


        const confirmed =
            confirm(
                "Delete this post?"
            );


        if(!confirmed)
            return;


        await deleteDoc(postRef);


    }catch(error){

        console.error(
            "Delete post error:",
            error
        );

        alert(
            "Unable to delete post."
        );

    }

}


// ============================================================
// LIKE
// ============================================================

window.likePost =
    async function(postId){

        const user =
            auth.currentUser;


        if(!user){

            alert(
                "Please login first."
            );

            return;

        }


        const button =
            document.querySelector(
                `[data-post-id="${CSS.escape(postId)}"] .post-buttons button:first-child`
            );


        if(button){

            button.style.animation =
                "vsHeart .35s ease";

            setTimeout(
                () => {
                    button.style.animation = "";
                },
                400
            );

        }


        try{

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


            if(likeSnap.exists()){

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


            if(!postSnap.exists())
                return;


            const postData =
                postSnap.data();


            if(
                postData.uid ===
                user.uid
            ){

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


            if(!userSnap.exists())
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

                    read:false,

                    createdAt:
                        serverTimestamp()

                }
            );


        }catch(error){

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
    function(postId){

        window.location.href =
            `comments.html?postId=${encodeURIComponent(postId)}`;

    };


// ============================================================
// REPOST
// ============================================================

window.repostPost =
    async function(postId){

        const user =
            auth.currentUser;


        if(!user){

            alert(
                "Please login first."
            );

            return;

        }


        try{

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


            if(!postSnap.exists()){

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


        }catch(error){

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
    async function(postId){

        try{

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


            if(!postSnap.exists()){

                alert(
                    "Post not found."
                );

                return;

            }


            const post =
                postSnap.data();


            const shareUrl =
                `${window.location.origin}/comments.html?postId=${encodeURIComponent(postId)}`;


            if(
                navigator.share
            ){

                await navigator.share({

                    title:
                        "VitalStar Post",

                    text:
                        post.text ||
                        "Check out this post on VitalStar!",

                    url:
                        shareUrl

                });

            }else if(
                navigator.clipboard
            ){

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


        }catch(error){

            if(
                error.name !==
                "AbortError"
            ){

                console.error(
                    "Share error:",
                    error
                );

            }

        }

    };


// ============================================================
// AUTH / WELCOME / ONLINE COUNT
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if(!user)
            return;


        const onlineUsersCount =
            document.getElementById(
                "onlineUsersCount"
            );


        /* ONLINE USERS */

        if(rtdb){

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


                            if(
                                status &&
                                status.online === true
                            ){

                                count++;

                            }

                        }
                    );


                    if(onlineUsersCount){

                        onlineUsersCount.textContent =
                            `🟢 ${count} online`;

                    }

                }
            );

        }


        /* USER PROFILE */

        try{

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if(!userSnap.exists())
                return;


            const userData =
                userSnap.data();


            const fullName =
                userData.fullName ||
                userData.username ||
                "User";


            const composerAvatar =
                document.getElementById(
                    "composerAvatar"
                );


            if(
                composerAvatar &&
                userData.profilePicture
            ){

                composerAvatar.innerHTML = `

                    <img
                        src="${escapeHTML(userData.profilePicture)}"
                        alt="Your profile"
                        style="
                            width:100%;
                            height:100%;
                            object-fit:cover;
                            border-radius:50%;
                        "
                    >

                `;

            }


            const hour =
                new Date().getHours();


            let greeting =
                "Good Evening";


            if(hour < 12){

                greeting =
                    "Good Morning";

            }else if(hour < 17){

                greeting =
                    "Good Afternoon";

            }


            const welcome =
                document.getElementById(
                    "welcomeText"
                );


            if(welcome){

                welcome.innerHTML =
                    `${escapeHTML(greeting)}, ${escapeHTML(fullName)} 👋`;

            }


        }catch(error){

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

if(notificationBadge){

    notificationBadge.textContent =
        "0";

    notificationBadge.style.display =
        "inline-flex";

}


onAuthStateChanged(
    auth,
    user => {

        if(!user){

            if(notificationBadge){

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


                        if(
                            data.read === false
                        ){

                            unread++;

                        }

                    }
                );


                if(notificationBadge){

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