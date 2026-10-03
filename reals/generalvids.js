// ============================================================
// VITALSTAR — GENERAL REALS
// All Public Videos from Posts + Groups
// Firebase v10.12.2
// ============================================================

import { auth, db } from "../firebase.js";

import {
    collection,
    collectionGroup,
    query,
    orderBy,
    limit,
    onSnapshot,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let container = null;
let unsubscribePosts = null;
let unsubscribeGroups = null;

let allVideos = [];

let settings = {
    autoplay: true,
    muted: true,
    dataSaver: false
};


// ============================================================
// STYLES
// ============================================================

const style = document.createElement("style");

style.textContent = `

.general-reals-feed{
    width:100%;
    height:100%;
    overflow-y:auto;
    scroll-snap-type:y mandatory;
    background:#050914;
}

.general-real-card{
    position:relative;
    width:100%;
    height:100vh;
    min-height:100vh;
    scroll-snap-align:start;
    scroll-snap-stop:always;
    background:#000;
    overflow:hidden;
}

.general-real-video{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
    background:#000;
}

.general-real-overlay{
    position:absolute;
    inset:0;
    pointer-events:none;
    background:
        linear-gradient(
            to top,
            rgba(0,0,0,.82),
            rgba(0,0,0,.18) 45%,
            rgba(0,0,0,.08)
        );
}

.general-real-bottom{
    position:absolute;
    left:16px;
    right:82px;
    bottom:28px;
    z-index:5;
    color:#fff;
}

.general-real-creator{
    display:flex;
    align-items:center;
    gap:9px;
    margin-bottom:9px;
    pointer-events:auto;
}

.creator-avatar{
    width:38px;
    height:38px;
    min-width:38px;
    border-radius:50%;
    background:#111827;
    background-size:cover;
    background-position:center;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:13px;
    font-weight:700;
    color:#fff;
    border:1px solid rgba(255,255,255,.3);
    overflow:hidden;
}

.creator-info{
    min-width:0;
}

.creator-name-button{
    appearance:none;
    border:0;
    padding:0;
    margin:0;
    background:none;
    color:#fff;
    font-size:14px;
    font-weight:700;
    cursor:pointer;
    text-align:left;
}

.creator-username{
    color:rgba(255,255,255,.68);
    font-size:11px;
    margin-top:2px;
}

.general-real-caption{
    font-size:14px;
    line-height:1.4;
    color:#fff;
    word-break:break-word;
}

.general-real-actions{
    position:absolute;
    right:13px;
    bottom:88px;
    z-index:8;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:17px;
}

.real-action{
    border:0;
    background:none;
    color:#fff;
    padding:0;
    width:46px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:4px;
    cursor:pointer;
    text-shadow:0 1px 5px rgba(0,0,0,.8);
}

.real-action i{
    font-size:23px;
}

.real-action span{
    font-size:10px;
    color:rgba(255,255,255,.82);
}

.real-action.liked i{
    color:#ff3b81;
}

.real-loading{
    width:100%;
    min-height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#050914;
    color:#fff;
}

.real-loading-inner{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:13px;
}

.vs-loader{
    width:42px;
    height:42px;
    border-radius:50%;
    border:3px solid rgba(255,255,255,.12);
    border-top-color:#7c3aed;
    border-right-color:#2563eb;
    animation:vsSpin .9s linear infinite;
}

.vs-loader-text{
    font-size:13px;
    color:rgba(255,255,255,.7);
}

.real-empty{
    min-height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:30px;
    color:rgba(255,255,255,.65);
}

.real-empty i{
    font-size:32px;
    margin-bottom:12px;
    display:block;
    color:#7c3aed;
}

.real-top-label{
    position:absolute;
    top:20px;
    left:16px;
    z-index:6;
    padding:6px 10px;
    border-radius:999px;
    background:rgba(0,0,0,.42);
    backdrop-filter:blur(8px);
    color:rgba(255,255,255,.88);
    font-size:10px;
    pointer-events:none;
}

.real-more-menu{
    position:absolute;
    right:62px;
    bottom:86px;
    z-index:20;
    background:#101827;
    border:1px solid rgba(255,255,255,.1);
    border-radius:12px;
    padding:6px;
    min-width:145px;
    box-shadow:0 10px 30px rgba(0,0,0,.45);
}

.real-more-menu button{
    width:100%;
    border:0;
    background:none;
    color:#fff;
    text-align:left;
    padding:10px;
    border-radius:8px;
    cursor:pointer;
}

.real-more-menu button:hover{
    background:rgba(255,255,255,.08);
}

@keyframes vsSpin{
    to{
        transform:rotate(360deg);
    }
}

`;

document.head.appendChild(style);


// ============================================================
// INITIALIZER
// ============================================================

export async function init(ctx = {}) {

    container =
        ctx.container ||
        document.querySelector(
            "#realsFeed, #generalRealsFeed, .reals-feed"
        );

    if (!container) {
        console.error(
            "General Reals container not found."
        );
        return;
    }

    currentUser =
        auth.currentUser;

    readSettings();

    cleanup();

    renderLoading();

    startPostListener();

    startGroupListener();
}


// ============================================================
// SETTINGS
// ============================================================

function readSettings() {

    settings.autoplay =
        localStorage.getItem(
            "vitalstar_reals_autoplay"
        ) !== "false";

    settings.muted =
        localStorage.getItem(
            "vitalstar_reals_muted"
        ) !== "false";

    settings.dataSaver =
        localStorage.getItem(
            "vitalstar_reals_dataSaver"
        ) === "true";
}


// ============================================================
// LOADING
// ============================================================

function renderLoading() {

    container.innerHTML = `
        <div class="real-loading">
            <div class="real-loading-inner">
                <div class="vs-loader"></div>
                <div class="vs-loader-text">
                    Loading VitalStar...
                </div>
            </div>
        </div>
    `;
}


// ============================================================
// POSTS
// ============================================================

function startPostListener() {

    try {

        const postsQuery =
            query(
                collection(
                    db,
                    "posts"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(100)
            );


        unsubscribePosts =
            onSnapshot(
                postsQuery,
                snapshot => {

                    const videos = [];


                    snapshot.forEach(
                        postDoc => {

                            const data =
                                postDoc.data();


                            if (
                                !isPublicNormalVideo(
                                    data
                                )
                            ) {
                                return;
                            }


                            const videoUrl =
                                getPostVideoUrl(
                                    data
                                );


                            if (!videoUrl) {
                                return;
                            }


                            videos.push({

                                id:
                                    postDoc.id,

                                source:
                                    "post",

                                videoUrl,

                                createdAt:
                                    data.createdAt ||
                                    null,

                                creatorId:
                                    data.uid ||
                                    data.userId ||
                                    data.authorId ||
                                    "",

                                creatorName:
                                    data.fullName ||
                                    data.displayName ||
                                    data.name ||
                                    data.username ||
                                    "VitalStar Member",

                                username:
                                    data.username ||
                                    "",

                                creatorPhoto:
                                    data.profilePicture ||
                                    data.profilePhoto ||
                                    data.photoURL ||
                                    data.photoUrl ||
                                    "",

                                text:
                                    data.text ||
                                    data.caption ||
                                    "",

                                likes:
                                    data.likes ||
                                    0,

                                comments:
                                    data.comments ||
                                    0,

                                reposts:
                                    data.reposts ||
                                    0,

                                shares:
                                    data.shares ||
                                    0

                            });

                        }
                    );


                    replaceSourceVideos(
                        "post",
                        videos
                    );

                },
                error => {

                    console.error(
                        "General Reals posts error:",
                        error
                    );

                }
            );

    } catch (error) {

        console.error(
            "Post listener error:",
            error
        );

    }

}


// ============================================================
// GROUP POSTS
// ============================================================

function startGroupListener() {

    try {

        const groupsQuery =
            query(
                collectionGroup(
                    db,
                    "posts"
                ),
                limit(500)
            );


        unsubscribeGroups =
            onSnapshot(
                groupsQuery,
                snapshot => {

                    const videos = [];


                    snapshot.forEach(
                        postDoc => {

                            const data =
                                postDoc.data();


                            if (
                                !isGroupVideo(
                                    data,
                                    postDoc
                                )
                            ) {
                                return;
                            }


                            const groupId =
                                extractGroupId(
                                    postDoc
                                );


                            if (!groupId) {
                                return;
                            }


                            const videoUrl =
                                data.mediaURL ||
                                data.videoURL ||
                                data.videoUrl ||
                                data.video ||
                                "";


                            if (!videoUrl) {
                                return;
                            }


                            videos.push({

                                id:
                                    postDoc.id,

                                source:
                                    "group",

                                groupId,

                                videoUrl,

                                createdAt:
                                    data.createdAt ||
                                    null,

                                creatorId:
                                    data.authorId ||
                                    data.uid ||
                                    "",

                                creatorName:
                                    data.authorName ||
                                    "VitalStar Group",

                                username:
                                    "",

                                creatorPhoto:
                                    data.authorPhotoURL ||
                                    data.authorPhoto ||
                                    "",

                                groupName:
                                    data.groupName ||
                                    data.groupTitle ||
                                    data.groupDisplayName ||
                                    "",

                                groupPhoto:
                                    data.groupPhotoURL ||
                                    data.groupProfilePicture ||
                                    data.groupPhoto ||
                                    data.groupImage ||
                                    "",

                                text:
                                    data.text ||
                                    data.caption ||
                                    "",

                                likes:
                                    data.likesCount ||
                                    data.likes ||
                                    0,

                                comments:
                                    data.commentsCount ||
                                    data.comments ||
                                    0,

                                reposts:
                                    data.repostsCount ||
                                    data.reposts ||
                                    0,

                                shares:
                                    data.sharesCount ||
                                    data.shares ||
                                    0

                            });

                        }
                    );


                    replaceSourceVideos(
                        "group",
                        videos
                    );


                    loadAllGroupInformation();

                },
                error => {

                    console.error(
                        "General Reals group error:",
                        error
                    );

                }
            );

    } catch (error) {

        console.error(
            "Group listener error:",
            error
        );

    }

}


// ============================================================
// VIDEO FILTERS
// ============================================================

function isPublicNormalVideo(data) {

    if (!data) {
        return false;
    }


    const privacy =
        String(
            data.privacy ||
            data.visibility ||
            "Public"
        )
            .trim()
            .toLowerCase();


    if (
        privacy === "only me" ||
        privacy === "onlyme" ||
        privacy === "private" ||
        privacy === "friends" ||
        privacy === "friends only"
    ) {
        return false;
    }


    if (
        privacy !== "public"
    ) {
        return false;
    }


    return Boolean(
        getPostVideoUrl(data)
    );

}


function getPostVideoUrl(data) {

    return (
        data?.video ||
        data?.videoUrl ||
        data?.videoURL ||
        ""
    );

}


function isGroupVideo(data, postDoc) {

    if (!data) {
        return false;
    }


    const mediaType =
        String(
            data.mediaType ||
            ""
        ).toLowerCase();


    const videoUrl =
        data.mediaURL ||
        data.videoURL ||
        data.videoUrl ||
        data.video ||
        "";


    const path =
        postDoc?.ref?.path ||
        "";


    return (
        mediaType === "video" ||
        Boolean(videoUrl) &&
        path.startsWith("groups/")
    );

}


function extractGroupId(postDoc) {

    const path =
        postDoc?.ref?.path ||
        "";


    const parts =
        path.split("/");


    if (
        parts.length >= 4 &&
        parts[0] === "groups" &&
        parts[2] === "posts"
    ) {
        return parts[1];
    }


    return "";

}


// ============================================================
// SOURCE MANAGEMENT
// ============================================================

function replaceSourceVideos(
    source,
    videos
) {

    allVideos =
        allVideos.filter(
            video =>
                video.source !==
                source
        );


    allVideos.push(
        ...videos
    );


    allVideos.sort(
        (a, b) =>
            getTimestamp(
                b.createdAt
            ) -
            getTimestamp(
                a.createdAt
            )
    );


    renderFeed();

}


function getTimestamp(timestamp) {

    if (
        timestamp &&
        typeof timestamp.toMillis ===
            "function"
    ) {
        return timestamp.toMillis();
    }


    if (
        timestamp &&
        typeof timestamp.toDate ===
            "function"
    ) {
        return timestamp.toDate().getTime();
    }


    if (
        timestamp instanceof Date
    ) {
        return timestamp.getTime();
    }


    if (
        typeof timestamp ===
        "number"
    ) {
        return timestamp;
    }


    return 0;

}


// ============================================================
// GROUP INFORMATION
// ============================================================

async function loadAllGroupInformation() {

    const groupVideos =
        allVideos.filter(
            video =>
                video.source ===
                "group"
        );


    await Promise.all(
        groupVideos.map(
            video =>
                loadGroupInformation(
                    video
                )
        )
    );


    renderFeed();

}


async function loadGroupInformation(video) {

    if (
        !video?.groupId
    ) {
        return;
    }


    try {

        const groupSnap =
            await getDoc(
                doc(
                    db,
                    "groups",
                    video.groupId
                )
            );


        if (
            !groupSnap.exists()
        ) {
            return;
        }


        const data =
            groupSnap.data();


        // ----------------------------------------------------
        // EXACT GROUP.JS SCHEMA
        // ----------------------------------------------------

        video.groupName =
            data.name ||
            data.groupName ||
            data.title ||
            data.displayName ||
            data.groupTitle ||
            video.groupName ||
            "VitalStar Group";


        // IMPORTANT:
        // group.js stores the group avatar as avatarURL
        // or avatarUrl.
        video.groupPhoto =
            data.avatarURL ||
            data.avatarUrl ||
            data.profilePicture ||
            data.profilePhoto ||
            data.profilePictureURL ||
            data.photoURL ||
            data.photoUrl ||
            data.avatar ||
            data.groupImage ||
            data.image ||
            video.groupPhoto ||
            "";


        // Keep a backup in case the group document
        // contains one of these fields.
        video.groupCover =
            data.coverURL ||
            data.coverUrl ||
            "";

    } catch (error) {

        console.error(
            `Unable to load group ${video.groupId}:`,
            error
        );

    }

}


// ============================================================
// RENDER FEED
// ============================================================

function renderFeed() {

    if (!container) {
        return;
    }


    if (!allVideos.length) {

        container.innerHTML = `
            <div class="real-empty">
                <div>
                    <i class="fa-solid fa-video"></i>
                    <div>
                        No public videos available yet.
                    </div>
                </div>
            </div>
        `;

        return;
    }


    container.innerHTML = "";


    const fragment =
        document.createDocumentFragment();


    allVideos.forEach(
        video => {

            fragment.appendChild(
                createVideoCard(
                    video
                )
            );

        }
    );


    container.appendChild(
        fragment
    );


    setupVideoObserver();

}


// ============================================================
// CREATE CARD
// ============================================================

function createVideoCard(video) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "general-real-card";


    card.dataset.videoId =
        video.id;


    card.dataset.source =
        video.source;


    if (video.groupId) {

        card.dataset.groupId =
            video.groupId;

    }


    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    const videoEl =
        document.createElement(
            "video"
        );


    videoEl.className =
        "general-real-video";


    videoEl.src =
        video.videoUrl;


    videoEl.playsInline =
        true;


    videoEl.preload =
        settings.dataSaver
            ? "metadata"
            : "auto";


    videoEl.muted =
        settings.muted;


    videoEl.loop =
        true;


    videoEl.setAttribute(
        "playsinline",
        ""
    );


    videoEl.addEventListener(
        "click",
        () => {

            if (videoEl.paused) {

                videoEl.play()
                    .catch(() => {});

            } else {

                videoEl.pause();

            }

        }
    );


    // --------------------------------------------------------
    // OVERLAY
    // --------------------------------------------------------

    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "general-real-overlay";


    // --------------------------------------------------------
    // CREATOR
    // --------------------------------------------------------

    const creator =
        document.createElement(
            "div"
        );


    creator.className =
        "general-real-creator";


    creator.dataset.action =
        video.source === "group"
            ? "group"
            : "profile";


    creator.dataset.id =
        video.source === "group"
            ? video.groupId
            : video.creatorId;


    creator.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                video.source ===
                "group"
            ) {

                openGroup(video);

            } else {

                openProfile(video);

            }

        }
    );


    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "creator-avatar";


    if (
        video.source ===
        "group"
    ) {

        applyAvatar(
            avatar,
            video.groupPhoto,
            video.groupName ||
            "Group"
        );

    } else {

        applyAvatar(
            avatar,
            video.creatorPhoto,
            video.creatorName ||
            "VitalStar Member"
        );

    }


    // --------------------------------------------------------
    // CREATOR INFO
    // --------------------------------------------------------

    const info =
        document.createElement(
            "div"
        );


    info.className =
        "creator-info";


    const name =
        document.createElement(
            "button"
        );


    name.type =
        "button";


    name.className =
        "creator-name-button";


    name.textContent =
        video.source === "group"
            ? (
                video.groupName ||
                "VitalStar Group"
            )
            : (
                video.creatorName ||
                "VitalStar Member"
            );


    name.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            if (
                video.source ===
                "group"
            ) {

                openGroup(video);

            } else {

                openProfile(video);

            }

        }
    );


    const username =
        document.createElement(
            "div"
        );


    username.className =
        "creator-username";


    if (
        video.source ===
        "group"
    ) {

        username.textContent =
            "VitalStar Group";

    } else {

        username.textContent =
            video.username
                ? `@${video.username}`
                : "VitalStar";

    }


    info.append(
        name,
        username
    );


    creator.append(
        avatar,
        info
    );


    // --------------------------------------------------------
    // CAPTION
    // --------------------------------------------------------

    const caption =
        document.createElement(
            "div"
        );


    caption.className =
        "general-real-caption";


    caption.textContent =
        video.text ||
        "";


    // --------------------------------------------------------
    // BOTTOM
    // --------------------------------------------------------

    const bottom =
        document.createElement(
            "div"
        );


    bottom.className =
        "general-real-bottom";


    bottom.append(
        creator,
        caption
    );


    // --------------------------------------------------------
    // LABEL
    // --------------------------------------------------------

    const label =
        document.createElement(
            "div"
        );


    label.className =
        "real-top-label";


    label.textContent =
        video.source === "group"
            ? "Group"
            : "Post";


    // --------------------------------------------------------
    // ACTIONS
    // --------------------------------------------------------

    const actions =
        createActions(
            video
        );


    card.append(
        videoEl,
        overlay,
        label,
        bottom,
        actions
    );


    return card;

}


// ============================================================
// AVATAR
// ============================================================

function applyAvatar(
    element,
    url,
    name
) {

    if (!element) {
        return;
    }


    const cleanUrl =
        String(
            url ||
            ""
        ).trim();


    if (cleanUrl) {

        element.style.backgroundImage =
            `url("${cleanUrl
                .replace(/"/g, '\\"')}")`;

        element.textContent =
            "";

        return;

    }


    element.style.backgroundImage =
        "";


    element.textContent =
        initials(
            name
        );

}


// ============================================================
// UPDATE GROUP IDENTITY
// ============================================================

function updateGroupIdentity(
    card,
    video
) {

    if (
        !card ||
        video.source !== "group"
    ) {
        return;
    }


    const avatar =
        card.querySelector(
            ".creator-avatar"
        );


    const name =
        card.querySelector(
            ".creator-name-button"
        );


    const username =
        card.querySelector(
            ".creator-username"
        );


    applyAvatar(
        avatar,
        video.groupPhoto,
        video.groupName ||
        "Group"
    );


    if (name) {

        name.textContent =
            video.groupName ||
            "VitalStar Group";

    }


    if (username) {

        username.textContent =
            "VitalStar Group";

    }

}


// ============================================================
// INITIALS
// ============================================================

function initials(name) {

    return String(
        name ||
        "V"
    )
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(
            part =>
                part.charAt(0)
        )
        .join("")
        .toUpperCase();

}


// ============================================================
// ACTIONS
// ============================================================

function createActions(video) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "general-real-actions";


    // LIKE
    const like =
        createAction(
            "fa-heart",
            formatCount(
                video.likes
            ),
            "Like"
        );


    like.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            like.classList.toggle(
                "liked"
            );

        }
    );


    // COMMENT
    const comment =
        createAction(
            "fa-comment",
            formatCount(
                video.comments
            ),
            "Comment"
        );


    comment.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            openComments(
                video
            );

        }
    );


    // REPOST
    const repost =
        createAction(
            "fa-retweet",
            formatCount(
                video.reposts
            ),
            "Repost"
        );


    repost.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            showToast(
                "Repost selected.",
                "info"
            );

        }
    );


    // SHARE
    const share =
        createAction(
            "fa-share",
            formatCount(
                video.shares
            ),
            "Share"
        );


    share.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            shareVideo(
                video
            );

        }
    );


    // MUTE
    const mute =
        createAction(
            settings.muted
                ? "fa-volume-xmark"
                : "fa-volume-high",
            "",
            "Mute"
        );


    mute.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            toggleMuteAll(
                mute
            );

        }
    );


    // MORE
    const more =
        createAction(
            "fa-ellipsis",
            "",
            "More"
        );


    more.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            toggleMoreMenu(
                more,
                video
            );

        }
    );


    wrapper.append(
        like,
        comment,
        repost,
        share,
        mute,
        more
    );


    return wrapper;

}


function createAction(
    icon,
    count,
    label
) {

    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.className =
        "real-action";


    button.title =
        label;


    button.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        ${
            count
                ? `<span>${count}</span>`
                : ""
        }
    `;


    return button;

}


// ============================================================
// GROUP / PROFILE NAVIGATION
// ============================================================

function openGroup(video) {

    if (
        !video?.groupId
    ) {
        return;
    }


    window.location.href =
        `../group.html?id=${
            encodeURIComponent(
                video.groupId
            )
        }`;

}


function openProfile(video) {

    if (
        !video?.creatorId
    ) {
        return;
    }


    window.location.href =
        `../profile.html?uid=${
            encodeURIComponent(
                video.creatorId
            )
        }`;

}


// ============================================================
// COMMENTS
// ============================================================

function openComments(video) {

    if (
        video.source ===
        "group"
    ) {

        window.location.href =
            `../group.html?id=${
                encodeURIComponent(
                    video.groupId
                )
            }&tab=posts&postId=${
                encodeURIComponent(
                    video.id
                )
            }`;

        return;
    }


    window.location.href =
        `../home.html?post=${
            encodeURIComponent(
                video.id
            )
        }`;

}


// ============================================================
// SHARE
// ============================================================

async function shareVideo(video) {

    const url =
        window.location.origin +
        window.location.pathname +
        `?video=${
            encodeURIComponent(
                video.id
            )
        }`;


    try {

        if (
            typeof navigator.share ===
            "function"
        ) {

            await navigator.share({

                title:
                    video.source === "group"
                        ? video.groupName ||
                          "VitalStar Group"
                        : video.creatorName ||
                          "VitalStar",

                text:
                    video.text ||
                    "Watch this video on VitalStar.",

                url

            });

            return;
        }


        if (
            navigator.clipboard
        ) {

            await navigator.clipboard.writeText(
                url
            );

            showToast(
                "Video link copied.",
                "success"
            );

            return;
        }


        showToast(
            "Unable to share this video.",
            "error"
        );

    } catch (error) {

        if (
            error?.name !==
            "AbortError"
        ) {

            console.error(
                "Share error:",
                error
            );

        }

    }

}


// ============================================================
// MORE MENU
// ============================================================

function toggleMoreMenu(
    button,
    video
) {

    document
        .querySelectorAll(
            ".real-more-menu"
        )
        .forEach(
            menu =>
                menu.remove()
        );


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "real-more-menu";


    const report =
        document.createElement(
            "button"
        );


    report.type =
        "button";


    report.textContent =
        "Report video";


    report.addEventListener(
        "click",
        () => {

            menu.remove();

            showToast(
                "Report option selected.",
                "info"
            );

        }
    );


    const close =
        document.createElement(
            "button"
        );


    close.type =
        "button";


    close.textContent =
        "Close";


    close.addEventListener(
        "click",
        () => {

            menu.remove();

        }
    );


    menu.append(
        report,
        close
    );


    const card =
        button.closest(
            ".general-real-card"
        );


    if (card) {

        card.appendChild(
            menu
        );

    }

}


// ============================================================
// MUTE
// ============================================================

function toggleMuteAll(
    button
) {

    settings.muted =
        !settings.muted;


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(
            settings.muted
        )
    );


    document
        .querySelectorAll(
            ".general-real-video"
        )
        .forEach(
            video => {

                video.muted =
                    settings.muted;

            }
        );


    const icon =
        button.querySelector(
            "i"
        );


    if (icon) {

        icon.className =
            settings.muted
                ? "fa-solid fa-volume-xmark"
                : "fa-solid fa-volume-high";

    }

}


// ============================================================
// VIDEO OBSERVER
// ============================================================

let videoObserver = null;


function setupVideoObserver() {

    if (videoObserver) {

        videoObserver.disconnect();

    }


    const cards =
        container.querySelectorAll(
            ".general-real-card"
        );


    videoObserver =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        const video =
                            entry.target.querySelector(
                                ".general-real-video"
                            );


                        if (!video) {
                            return;
                        }


                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >=
                                0.65
                        ) {

                            if (
                                settings.autoplay
                            ) {

                                video.muted =
                                    settings.muted;

                                video.play()
                                    .catch(
                                        () => {}
                                    );

                            }

                        } else {

                            video.pause();

                        }

                    }
                );

            },
            {
                threshold: [
                    0,
                    0.65,
                    1
                ]
            }
        );


    cards.forEach(
        card =>
            videoObserver.observe(
                card
            )
    );

}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "info"
) {

    const existing =
        document.getElementById(
            "generalRealsToast"
        );


    if (existing) {
        existing.remove();
    }


    const toast =
        document.createElement(
            "div"
        );


    toast.id =
        "generalRealsToast";


    toast.textContent =
        message;


    toast.style.position =
        "fixed";

    toast.style.left =
        "50%";

    toast.style.bottom =
        "80px";

    toast.style.transform =
        "translateX(-50%)";

    toast.style.zIndex =
        "99999";

    toast.style.padding =
        "10px 15px";

    toast.style.borderRadius =
        "999px";

    toast.style.background =
        "rgba(10,15,30,.94)";

    toast.style.border =
        "1px solid rgba(255,255,255,.12)";

    toast.style.color =
        "#fff";

    toast.style.fontSize =
        "12px";

    toast.style.boxShadow =
        "0 8px 25px rgba(0,0,0,.4)";


    document.body.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.remove();

        },
        2200
    );

}


// ============================================================
// CLEANUP
// ============================================================

function cleanup() {

    if (unsubscribePosts) {

        unsubscribePosts();

        unsubscribePosts =
            null;

    }


    if (unsubscribeGroups) {

        unsubscribeGroups();

        unsubscribeGroups =
            null;

    }


    if (videoObserver) {

        videoObserver.disconnect();

        videoObserver =
            null;

    }


    allVideos =
        [];

}


// ============================================================
// SETTINGS CHANGE SUPPORT
// ============================================================

export function onSettingChange(
    key,
    value
) {

    if (
        key ===
        "autoplay"
    ) {

        settings.autoplay =
            Boolean(value);

    }


    if (
        key ===
        "muted"
    ) {

        settings.muted =
            Boolean(value);


        document
            .querySelectorAll(
                ".general-real-video"
            )
            .forEach(
                video => {

                    video.muted =
                        settings.muted;

                }
            );

    }


    if (
        key ===
        "dataSaver"
    ) {

        settings.dataSaver =
            Boolean(value);

    }

}


// ============================================================
// END OF GENERALVIDS.JS
// ============================================================
