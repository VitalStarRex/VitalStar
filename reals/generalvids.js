// ============================================================
// VITALSTAR — GENERAL REALS
// generalvids.js
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
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    increment,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// STATE
// ============================================================

let container = null;

let settings = {
    autoplay: true,
    muted: true,
    dataSaver: false
};

let normalPosts = [];
let groupPosts = [];

let normalLoaded = false;
let groupsLoaded = false;

let normalUnsubscribe = null;
let groupsUnsubscribe = null;

let currentVideos = [];

let observer = null;

let destroyed = false;


// ============================================================
// SETTINGS
// ============================================================

function getSettings() {

    return {
        autoplay:
            localStorage.getItem(
                "vitalstar_reals_autoplay"
            ) !== "false",

        muted:
            localStorage.getItem(
                "vitalstar_reals_muted"
            ) !== "false",

        dataSaver:
            localStorage.getItem(
                "vitalstar_reals_dataSaver"
            ) === "true"
    };
}


// ============================================================
// ESCAPE HTML
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
// TIMESTAMP
// ============================================================

function getTimestamp(value) {

    if (!value) return 0;

    if (
        typeof value?.toMillis === "function"
    ) {
        return value.toMillis();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {

        const time =
            new Date(value).getTime();

        return Number.isNaN(time)
            ? 0
            : time;
    }

    return 0;
}


// ============================================================
// NORMAL PUBLIC VIDEO CHECK
// ============================================================

function isPublicNormalVideo(data) {

    if (!data) return false;

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    if (!video) return false;

    const privacy =
        String(
            data.privacy ??
            data.visibility ??
            "Public"
        )
            .trim()
            .toLowerCase();

    if (
        privacy === "only me" ||
        privacy === "onlyme" ||
        privacy === "private" ||
        privacy === "friends" ||
        privacy === "friends only" ||
        privacy === "friendsonly"
    ) {
        return false;
    }

    return (
        privacy === "public" ||
        privacy === ""
    );
}


// ============================================================
// GROUP VIDEO CHECK
// ============================================================

function isGroupVideo(data) {

    if (!data) return false;

    const mediaURL =
        data.mediaURL ||
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    if (!mediaURL) {
        return false;
    }

    const mediaType =
        String(
            data.mediaType || ""
        )
            .trim()
            .toLowerCase();

    if (mediaType === "video") {
        return true;
    }

    if (
        mediaType === "video/mp4" ||
        mediaType.startsWith("video/")
    ) {
        return true;
    }

    const url =
        String(mediaURL).toLowerCase();

    return (
        url.includes(".mp4") ||
        url.includes(".webm") ||
        url.includes(".mov") ||
        url.includes("video/upload")
    );
}


// ============================================================
// PLAYABLE VIDEO URL
// ============================================================

function getPlayableVideoUrl(url) {

    if (!url) return "";

    let result = String(url);

    if (
        result.includes("res.cloudinary.com") &&
        result.includes("/video/upload/") &&
        !result.includes("/f_mp4/")
    ) {

        result =
            result.replace(
                "/video/upload/",
                "/video/upload/f_mp4/"
            );
    }

    return result;
}


// ============================================================
// LOADING
// ============================================================

function showLoading() {

    if (!container) return;

    container.innerHTML = `

        <div class="general-loading">

            <div class="vs-loader">
                <div class="vs-ring"></div>

                <div class="vs-logo">
                    VS
                </div>
            </div>

            <div class="vs-loading-title">
                Loading VitalStar...
            </div>

            <div class="vs-loading-text">
                Preparing videos
            </div>

        </div>
    `;
}


// ============================================================
// ERROR
// ============================================================

function showError(
    message = "Unable to load videos."
) {

    if (!container) return;

    container.innerHTML = `

        <div class="general-error">

            <div class="error-icon">
                !
            </div>

            <div class="error-title">
                Something went wrong
            </div>

            <div class="error-message">
                ${escapeHTML(message)}
            </div>

            <button
                class="retry-button"
                id="generalRetryButton"
                type="button"
            >
                Try Again
            </button>

        </div>
    `;

    const retry =
        container.querySelector(
            "#generalRetryButton"
        );

    if (retry) {

        retry.addEventListener(
            "click",
            initializeFeed
        );
    }
}


// ============================================================
// EMPTY
// ============================================================

function showEmpty() {

    if (!container) return;

    container.innerHTML = `

        <div class="general-empty">

            <div class="empty-icon">
                ▶
            </div>

            <div class="empty-title">
                No videos yet
            </div>

            <div class="empty-text">
                Public videos from VitalStar will appear here.
            </div>

        </div>
    `;
}


// ============================================================
// NORMALIZE NORMAL POST
// ============================================================

function normalizeNormalPost(
    id,
    data
) {

    return {

        id:
            `post_${id}`,

        originalId:
            id,

        type:
            "post",

        video:
            getPlayableVideoUrl(
                data.video ||
                data.videoUrl ||
                data.videoURL ||
                ""
            ),

        text:
            data.text ||
            data.caption ||
            "",

        creatorId:
            data.uid ||
            data.userId ||
            data.authorId ||
            data.createdBy ||
            "",

        creatorName:
            data.fullName ||
            data.authorName ||
            data.name ||
            data.username ||
            "VitalStar User",

        username:
            data.username ||
            "",

        creatorPhoto:
            data.profilePicture ||
            data.authorPhotoURL ||
            data.photoURL ||
            data.avatar ||
            "",

        createdAt:
            getTimestamp(
                data.createdAt
            ),

        likes:
            Number(data.likes || 0),

        comments:
            Number(data.comments || 0),

        reposts:
            Number(data.reposts || 0),

        shares:
            Number(data.shares || 0)
    };
}


// ============================================================
// NORMALIZE GROUP POST
// ============================================================

function normalizeGroupPost(
    id,
    data,
    groupId
) {

    return {

        id:
            `group_${groupId}_${id}`,

        originalId:
            id,

        type:
            "group",

        groupId,

        video:
            getPlayableVideoUrl(
                data.mediaURL ||
                data.video ||
                data.videoUrl ||
                data.videoURL ||
                ""
            ),

        text:
            data.text ||
            data.caption ||
            "",

        creatorId:
            data.authorId ||
            data.uid ||
            data.userId ||
            "",

        creatorName:
            data.authorName ||
            data.fullName ||
            data.name ||
            data.username ||
            "VitalStar User",

        username:
            data.username ||
            data.authorUsername ||
            "",

        creatorPhoto:
            data.authorPhotoURL ||
            data.profilePicture ||
            data.photoURL ||
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

        authorRole:
            data.authorRole ||
            "",

        createdAt:
            getTimestamp(
                data.createdAt
            ),

        likes:
            Number(
                data.likesCount ??
                data.likes ??
                0
            ),

        comments:
            Number(
                data.commentsCount ??
                data.comments ??
                0
            ),

        reposts:
            Number(
                data.repostsCount ??
                data.reposts ??
                0
            ),

        shares:
            Number(
                data.sharesCount ??
                data.shares ??
                0
            )
    };
}


// ============================================================
// LOAD GROUP INFORMATION
// ============================================================

async function loadGroupInformation(video) {

    if (
        !video ||
        video.type !== "group" ||
        !video.groupId
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

        if (!groupSnap.exists()) {
            return;
        }

        const data =
            groupSnap.data() || {};

        video.groupName =
            data.name ||
            data.groupName ||
            data.title ||
            data.displayName ||
            data.groupTitle ||
            video.groupName ||
            "VitalStar Group";

        video.groupPhoto =
            data.avatarURL ||
            data.avatarUrl ||
            data.profilePicture ||
            data.profilePhoto ||
            data.profilePictureURL ||
            data.photoURL ||
            data.avatar ||
            data.groupImage ||
            data.image ||
            data.coverPhoto ||
            video.groupPhoto ||
            "";

        if (
            !destroyed &&
            container
        ) {

            const card =
                container.querySelector(
                    `[data-id="${CSS.escape(video.id)}"]`
                );

            if (card) {
                updateGroupIdentity(
                    card,
                    video
                );
            }
        }

    } catch (error) {

        console.warn(
            "VitalStar Reals group information error:",
            error
        );
    }
}


// ============================================================
// UPDATE GROUP IDENTITY
// ============================================================

function updateGroupIdentity(
    card,
    video
) {

    const name =
        card.querySelector(
            ".creator-name"
        );

    const avatar =
        card.querySelector(
            ".creator-avatar"
        );

    if (name) {

        name.textContent =
            video.groupName ||
            "VitalStar Group";
    }

    if (avatar) {

        avatar.innerHTML =
            video.groupPhoto

                ? `
                    <img
                        src="${escapeHTML(
                            video.groupPhoto
                        )}"
                        alt="${escapeHTML(
                            video.groupName ||
                            "VitalStar Group"
                        )}"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                    >
                `

                : `
                    <div class="default-avatar">
                        VS
                    </div>
                `;
    }
}


// ============================================================
// LOAD GROUP DATA
// ============================================================

async function loadAllGroupInformation() {

    await Promise.allSettled(
        groupPosts.map(
            video =>
                loadGroupInformation(
                    video
                )
        )
    );
}


// ============================================================
// MERGE FEED
// ============================================================

function getMergedFeed() {

    const map =
        new Map();

    [
        ...normalPosts,
        ...groupPosts
    ].forEach(video => {

        if (
            video.video &&
            !map.has(video.id)
        ) {

            map.set(
                video.id,
                video
            );
        }
    });

    return Array.from(
        map.values()
    ).sort(
        (a, b) =>
            b.createdAt -
            a.createdAt
    );
}


// ============================================================
// INIT
// ============================================================

export function init(options = {}) {

    destroyed = false;

    container =
        options.container ||
        document.querySelector("#realsFeed") ||
        document.querySelector(".reals-feed");

    settings = {
        ...getSettings(),
        ...(options.settings || {})
    };

    if (!container) {

        console.error(
            "VitalStar General Reals: feed container not found."
        );

        return () => {};
    }

    addStyles();

    showLoading();

    initializeFeed();

    return destroyGeneralVids;
}


// ============================================================
// ALIAS
// ============================================================

export function initGeneralVids(options = {}) {

    return init(options);
}


// ============================================================
// FIREBASE LOAD
// ============================================================

function initializeFeed() {

    if (
        !container ||
        destroyed
    ) {
        return;
    }

    cleanupListeners();

    normalPosts = [];
    groupPosts = [];

    normalLoaded = false;
    groupsLoaded = false;

    showLoading();


    // ========================================================
    // NORMAL POSTS
    // ========================================================

    try {

        const normalQuery =
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

        normalUnsubscribe =
            onSnapshot(
                normalQuery,
                snapshot => {

                    normalPosts = [];

                    snapshot.forEach(
                        snap => {

                            const data =
                                snap.data();

                            if (
                                isPublicNormalVideo(
                                    data
                                )
                            ) {

                                normalPosts.push(
                                    normalizeNormalPost(
                                        snap.id,
                                        data
                                    )
                                );
                            }
                        }
                    );

                    normalLoaded = true;

                    rebuildFeed();
                },
                error => {

                    console.error(
                        "VitalStar normal Reals error:",
                        error
                    );

                    normalLoaded = true;

                    rebuildFeed();
                }
            );

    } catch (error) {

        console.error(
            "VitalStar normal query error:",
            error
        );

        normalLoaded = true;

        rebuildFeed();
    }


    // ========================================================
    // GROUP POSTS
    // ========================================================

    try {

        const groupsQuery =
            query(
                collectionGroup(
                    db,
                    "posts"
                ),
                limit(500)
            );

        groupsUnsubscribe =
            onSnapshot(
                groupsQuery,
                async snapshot => {

                    groupPosts = [];

                    snapshot.forEach(
                        snap => {

                            const data =
                                snap.data();

                            if (
                                !isGroupVideo(
                                    data
                                )
                            ) {
                                return;
                            }

                            const path =
                                snap.ref.path.split("/");

                            const groupIndex =
                                path.indexOf(
                                    "groups"
                                );

                            const groupId =
                                groupIndex !== -1
                                    ? path[
                                        groupIndex + 1
                                    ]
                                    : "";

                            if (!groupId) {
                                return;
                            }

                            groupPosts.push(
                                normalizeGroupPost(
                                    snap.id,
                                    data,
                                    groupId
                                )
                            );
                        }
                    );

                    groupPosts.sort(
                        (a, b) =>
                            b.createdAt -
                            a.createdAt
                    );

                    groupsLoaded = true;

                    rebuildFeed();

                    await loadAllGroupInformation();
                },
                error => {

                    console.error(
                        "VitalStar group Reals error:",
                        error
                    );

                    groupsLoaded = true;

                    rebuildFeed();
                }
            );

    } catch (error) {

        console.error(
            "VitalStar group query error:",
            error
        );

        groupsLoaded = true;

        rebuildFeed();
    }
}


// ============================================================
// REBUILD
// ============================================================

function rebuildFeed() {

    if (
        !container ||
        destroyed
    ) {
        return;
    }

    if (
        !normalLoaded ||
        !groupsLoaded
    ) {

        showLoading();

        return;
    }

    currentVideos =
        getMergedFeed();

    if (!currentVideos.length) {

        showEmpty();

        return;
    }

    renderFeed();
}


// ============================================================
// RENDER
// ============================================================

function renderFeed() {

    disconnectObserver();

    container.innerHTML = "";

    const feed =
        document.createElement(
            "div"
        );

    feed.className =
        "general-reals-feed";

    currentVideos.forEach(
        (video, index) => {

            feed.appendChild(
                createVideoCard(
                    video,
                    index
                )
            );
        }
    );

    container.appendChild(
        feed
    );

    setupObserver(feed);

    setupVideoBehavior(feed);

    currentVideos.forEach(
        video => {

            if (
                video.type === "post"
            ) {

                updateRealsLikeState(
                    video
                );

                updateRealsRepostState(
                    video
                );
            }
        }
    );
}


// ============================================================
// VIDEO CARD
// ============================================================

function createVideoCard(
    video,
    index
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "reals-video-card";

    card.dataset.index =
        String(index);

    card.dataset.id =
        video.id;


    const isGroup =
        video.type === "group";


    const name =
        isGroup
            ? (
                video.groupName ||
                "VitalStar Group"
            )
            : (
                video.creatorName ||
                "VitalStar User"
            );


    const photo =
        isGroup
            ? video.groupPhoto
            : video.creatorPhoto;


    const username =
        isGroup
            ? "Group"
            : (
                video.username
                    ? `@${video.username}`
                    : ""
            );


    const avatar =
        photo

            ? `
                <img
                    src="${escapeHTML(photo)}"
                    alt="${escapeHTML(name)}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                >
            `

            : `
                <div class="default-avatar">
                    VS
                </div>
            `;


    card.innerHTML = `

        <video
            class="reals-video"
            src="${escapeHTML(video.video)}"
            playsinline
            webkit-playsinline
            ${settings.autoplay ? "autoplay" : ""}
            ${settings.muted ? "muted" : ""}
            preload="${
                settings.dataSaver
                    ? "metadata"
                    : "auto"
            }"
        ></video>


        <div class="video-top-gradient"></div>
        <div class="video-bottom-gradient"></div>


        <!-- LARGE PLAY / PAUSE -->

        <button
            class="video-play-indicator"
            type="button"
            aria-label="Play or pause video"
        >
            ▶
        </button>


        <!-- VIDEO SEEK CONTROLS -->

        <div class="video-seek-controls">

            <button
                class="video-seek-button"
                type="button"
                data-seek="-10"
                aria-label="Go back 10 seconds"
                title="Back 10 seconds"
            >
                ⏪
            </button>

            <button
                class="video-seek-button"
                type="button"
                data-seek="10"
                aria-label="Go forward 10 seconds"
                title="Forward 10 seconds"
            >
                ⏩
            </button>

        </div>


        <div class="video-actions">

            <button
                class="reals-action like-action"
                type="button"
                data-action="like"
            >
                <span class="action-icon">
                    ♡
                </span>

                <span
                    class="action-count"
                    data-value="${video.likes}"
                >
                    ${formatCount(video.likes)}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="comment"
            >
                <span class="action-icon">
                    💬
                </span>

                <span
                    class="action-count"
                    data-value="${video.comments}"
                >
                    ${formatCount(video.comments)}
                </span>
            </button>


            <button
                class="reals-action repost-action"
                type="button"
                data-action="repost"
            >
                <span class="action-icon">
                    ↻
                </span>

                <span
                    class="action-count"
                    data-value="${video.reposts}"
                >
                    ${formatCount(video.reposts)}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="share"
            >
                <span class="action-icon">
                    ↗
                </span>

                <span
                    class="action-count"
                    data-value="${video.shares}"
                >
                    ${formatCount(video.shares)}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="mute"
            >
                <span class="action-icon mute-icon">
                    ${settings.muted ? "🔇" : "🔊"}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="more"
            >
                <span class="action-icon">
                    •••
                </span>
            </button>

        </div>


        <div class="video-info">

            <div class="video-source-label">
                ${isGroup ? "Group" : "Post"}
            </div>


            <div class="creator-row">

                <button
                    class="creator-avatar"
                    type="button"
                    data-action="${
                        isGroup
                            ? "group"
                            : "profile"
                    }"
                >
                    ${avatar}
                </button>


                <div class="creator-details">

                    <button
                        class="creator-name-button"
                        type="button"
                        data-action="${
                            isGroup
                                ? "group"
                                : "profile"
                        }"
                    >

                        <span class="creator-name">
                            ${escapeHTML(name)}
                        </span>

                    </button>


                    ${
                        username
                            ? `
                                <div class="creator-username">
                                    ${escapeHTML(username)}
                                </div>
                            `
                            : ""
                    }

                </div>

            </div>


            ${
                video.text
                    ? `
                        <div class="video-caption">
                            ${escapeHTML(
                                video.text
                            )}
                        </div>
                    `
                    : ""
            }

        </div>
    `;


    // ========================================================
    // CARD ACTIONS
    // ========================================================

    card.addEventListener(
        "click",
        event => {

            const seekButton =
                event.target.closest(
                    "[data-seek]"
                );

            if (seekButton) {

                event.preventDefault();
                event.stopPropagation();

                const videoElement =
                    card.querySelector(
                        ".reals-video"
                    );

                if (!videoElement) {
                    return;
                }

                const seconds =
                    Number(
                        seekButton.dataset.seek
                    );

                seekVideo(
                    videoElement,
                    seconds
                );

                return;
            }


            const button =
                event.target.closest(
                    "[data-action]"
                );

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            handleAction(
                button.dataset.action,
                video,
                card
            );
        }
    );


    // ========================================================
    // BIG PLAY BUTTON
    // ========================================================

    const playButton =
        card.querySelector(
            ".video-play-indicator"
        );


    playButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            const videoElement =
                card.querySelector(
                    ".reals-video"
                );

            if (!videoElement) return;


            if (videoElement.paused) {

                playVideo(
                    videoElement
                );

            } else {

                videoElement.pause();
            }
        }
    );


    return card;
}


// ============================================================
// SEEK VIDEO
// ============================================================

function seekVideo(
    video,
    seconds
) {

    if (!video) {
        return;
    }


    if (
        !Number.isFinite(
            seconds
        )
    ) {
        return;
    }


    const currentTime =
        Number(
            video.currentTime || 0
        );


    const duration =
        Number(
            video.duration || 0
        );


    let newTime =
        currentTime + seconds;


    if (duration > 0) {

        newTime =
            Math.min(
                Math.max(
                    newTime,
                    0
                ),
                duration
            );

    } else {

        newTime =
            Math.max(
                newTime,
                0
            );
    }


    try {

        video.currentTime =
            newTime;

    } catch (error) {

        console.warn(
            "VitalStar Reals seek error:",
            error
        );
    }
}


// ============================================================
// ACTION HANDLER
// ============================================================

function handleAction(
    action,
    video,
    card
) {

    // ========================================================
    // GROUP VIDEO
    // ========================================================

    if (
        video.type === "group"
    ) {

        switch (action) {

            case "like":
            case "comment":
            case "repost":
            case "share":
            case "more":

                showGroupOnlyMessage();

                return;


            case "group":

                openGroup(
                    video
                );

                return;


            case "mute":

                toggleMute(
                    video,
                    card
                );

                return;
        }
    }


    // ========================================================
    // NORMAL POST
    // ========================================================

    switch (action) {

        case "like":

            handleLike(
                video,
                card
            );

            break;

        case "comment":

            handleComment(
                video
            );

            break;

        case "repost":

            handleRepost(
                video,
                card
            );

            break;

        case "share":

            handleShare(
                video,
                card
            );

            break;

        case "mute":

            toggleMute(
                video,
                card
            );

            break;

        case "profile":

            openProfile(
                video
            );

            break;

        case "group":

            openGroup(
                video
            );

            break;

        case "more":

            showMoreMenu(
                video
            );

            break;
    }
}


// ============================================================
// GROUP-ONLY ACTION MESSAGE
// ============================================================

function showGroupOnlyMessage() {

    showToast(
        "This action can only be taken inside the group."
    );
}


// ============================================================
// LIKE
// ============================================================

async function handleLike(
    video,
    card
) {

    if (
        video.type === "group"
    ) {

        showGroupOnlyMessage();

        return;
    }


    const user =
        auth.currentUser;


    if (!user) {

        window.location.href =
            "../login.html";

        return;
    }


    const postId =
        video.originalId;


    if (!postId) return;


    const postRef =
        doc(
            db,
            "posts",
            postId
        );


    const likeRef =
        doc(
            db,
            "postLikes",
            `${postId}_${user.uid}`
        );


    const button =
        card?.querySelector(
            ".like-action"
        );


    const icon =
        button?.querySelector(
            ".action-icon"
        );


    const count =
        button?.querySelector(
            ".action-count"
        );


    try {

        if (button) {
            button.disabled = true;
        }


        const likeSnap =
            await getDoc(
                likeRef
            );


        const postSnap =
            await getDoc(
                postRef
            );


        if (!postSnap.exists()) {

            showToast(
                "This post is no longer available."
            );

            return;
        }


        const post =
            postSnap.data() || {};


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


            const current =
                Number(
                    count?.dataset.value ??
                    video.likes ??
                    0
                );


            const next =
                Math.max(
                    0,
                    current - 1
                );


            video.likes =
                next;


            if (button) {

                button.classList.remove(
                    "liked"
                );
            }


            if (icon) {

                icon.textContent =
                    "♡";
            }


            if (count) {

                count.dataset.value =
                    String(next);

                count.textContent =
                    formatCount(next);
            }


        } else {

            await setDoc(
                likeRef,
                {
                    postId,

                    uid:
                        user.uid,

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


            const current =
                Number(
                    count?.dataset.value ??
                    video.likes ??
                    0
                );


            const next =
                current + 1;


            video.likes =
                next;


            if (button) {

                button.classList.add(
                    "liked"
                );
            }


            if (icon) {

                icon.textContent =
                    "♥";
            }


            if (count) {

                count.dataset.value =
                    String(next);

                count.textContent =
                    formatCount(next);
            }


            const receiverId =
                post.uid ||
                post.userId ||
                post.authorId ||
                post.createdBy ||
                "";


            if (
                receiverId &&
                receiverId !== user.uid
            ) {

                const sender =
                    await getCurrentUserData();


                await createNotification({

                    receiverId,

                    sender,

                    type:
                        "post_like",

                    postId,

                    text:
                        "liked your post."
                });
            }
        }

    } catch (error) {

        console.error(
            "VitalStar Reals like error:",
            error
        );

        showToast(
            "Unable to update reaction."
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUserData() {

    const user =
        auth.currentUser;


    if (!user) {
        return null;
    }


    try {

        const snap =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


        if (!snap.exists()) {

            return {

                uid:
                    user.uid,

                username:
                    "username",

                fullName:
                    "VitalStar User",

                profilePicture:
                    ""
            };
        }


        const data =
            snap.data();


        return {

            uid:
                user.uid,

            username:
                data.username ||
                "username",

            fullName:
                data.fullName ||
                "VitalStar User",

            profilePicture:
                data.profilePicture ||
                ""
        };

    } catch {

        return {

            uid:
                user.uid,

            username:
                "username",

            fullName:
                "VitalStar User",

            profilePicture:
                ""
        };
    }
}


// ============================================================
// NOTIFICATION
// ============================================================

async function createNotification({
    receiverId,
    sender,
    type,
    postId,
    text
}) {

    if (
        !receiverId ||
        !sender ||
        receiverId === sender.uid
    ) {
        return;
    }


    await addDoc(
        collection(
            db,
            "notifications"
        ),
        {

            receiverId,

            senderId:
                sender.uid,

            senderName:
                sender.fullName,

            senderPhoto:
                sender.profilePicture,

            type,

            postId,

            text,

            read:
                false,

            createdAt:
                serverTimestamp()
        }
    );
}


// ============================================================
// LIKE STATE
// ============================================================

async function updateRealsLikeState(
    video
) {

    if (
        video.type !== "post"
    ) {
        return;
    }


    const user =
        auth.currentUser;


    if (!user) return;


    try {

        const snap =
            await getDoc(
                doc(
                    db,
                    "postLikes",
                    `${video.originalId}_${user.uid}`
                )
            );


        const card =
            container?.querySelector(
                `[data-id="${CSS.escape(video.id)}"]`
            );


        const button =
            card?.querySelector(
                ".like-action"
            );


        const icon =
            button?.querySelector(
                ".action-icon"
            );


        if (snap.exists()) {

            button?.classList.add(
                "liked"
            );

            if (icon) {
                icon.textContent = "♥";
            }

        } else {

            button?.classList.remove(
                "liked"
            );

            if (icon) {
                icon.textContent = "♡";
            }
        }

    } catch (error) {

        console.warn(
            "Like state error:",
            error
        );
    }
}


// ============================================================
// REPOST STATE
// ============================================================

async function updateRealsRepostState(
    video
) {

    if (
        video.type !== "post"
    ) {
        return;
    }


    const user =
        auth.currentUser;


    if (!user) return;


    try {

        const snap =
            await getDoc(
                doc(
                    db,
                    "postReposts",
                    `${video.originalId}_${user.uid}`
                )
            );


        const card =
            container?.querySelector(
                `[data-id="${CSS.escape(video.id)}"]`
            );


        const button =
            card?.querySelector(
                ".repost-action"
            );


        const icon =
            button?.querySelector(
                ".action-icon"
            );


        if (snap.exists()) {

            button?.classList.add(
                "reposted"
            );

            if (icon) {
                icon.textContent = "⟳";
            }

        } else {

            button?.classList.remove(
                "reposted"
            );

            if (icon) {
                icon.textContent = "↻";
            }
        }

    } catch (error) {

        console.warn(
            "Repost state error:",
            error
        );
    }
}


// ============================================================
// COMMENT
// ============================================================

function handleComment(video) {

    if (
        video.type === "group"
    ) {

        showGroupOnlyMessage();

        return;
    }


    if (
        !video.originalId
    ) {
        return;
    }


    window.location.href =
        `../comments.html?postId=${
            encodeURIComponent(
                video.originalId
            )
        }`;
}


// ============================================================
// REPOST
// ============================================================

async function handleRepost(
    video,
    card
) {

    if (
        video.type === "group"
    ) {

        showGroupOnlyMessage();

        return;
    }


    const user =
        auth.currentUser;


    if (!user) {

        window.location.href =
            "../login.html";

        return;
    }


    const postId =
        video.originalId;


    if (!postId) return;


    const postRef =
        doc(
            db,
            "posts",
            postId
        );


    const repostRef =
        doc(
            db,
            "postReposts",
            `${postId}_${user.uid}`
        );


    const button =
        card?.querySelector(
            ".repost-action"
        );


    const count =
        button?.querySelector(
            ".action-count"
        );


    const icon =
        button?.querySelector(
            ".action-icon"
        );


    try {

        if (button) {
            button.disabled = true;
        }


        const repostSnap =
            await getDoc(
                repostRef
            );


        const postSnap =
            await getDoc(
                postRef
            );


        if (!postSnap.exists()) {

            showToast(
                "This post is no longer available."
            );

            return;
        }


        if (
            repostSnap.exists()
        ) {

            await deleteDoc(
                repostRef
            );


            await updateDoc(
                postRef,
                {
                    reposts:
                        increment(-1)
                }
            );


            const current =
                Number(
                    count?.dataset.value ??
                    video.reposts ??
                    0
                );


            const next =
                Math.max(
                    0,
                    current - 1
                );


            if (count) {

                count.dataset.value =
                    String(next);

                count.textContent =
                    formatCount(next);
            }


            video.reposts =
                next;


            button?.classList.remove(
                "reposted"
            );


            if (icon) {
                icon.textContent = "↻";
            }


            showToast(
                "Repost removed"
            );

        } else {

            await setDoc(
                repostRef,
                {
                    postId,

                    uid:
                        user.uid,

                    createdAt:
                        serverTimestamp()
                }
            );


            await updateDoc(
                postRef,
                {
                    reposts:
                        increment(1)
                }
            );


            const current =
                Number(
                    count?.dataset.value ??
                    video.reposts ??
                    0
                );


            const next =
                current + 1;


            if (count) {

                count.dataset.value =
                    String(next);

                count.textContent =
                    formatCount(next);
            }


            video.reposts =
                next;


            button?.classList.add(
                "reposted"
            );


            if (icon) {
                icon.textContent = "⟳";
            }


            showToast(
                "Post reposted"
            );


            const post =
                postSnap.data() || {};


            const receiverId =
                post.uid ||
                post.userId ||
                post.authorId ||
                post.createdBy ||
                "";


            if (
                receiverId &&
                receiverId !== user.uid
            ) {

                const sender =
                    await getCurrentUserData();


                await createNotification({

                    receiverId,

                    sender,

                    type:
                        "post_repost",

                    postId,

                    text:
                        "reposted your post."
                });
            }
        }

    } catch (error) {

        console.error(
            "VitalStar Reals repost error:",
            error
        );

        showToast(
            "Unable to repost this post."
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


// ============================================================
// SHARE
// ============================================================

async function handleShare(
    video,
    card
) {

    if (
        video.type === "group"
    ) {

        showGroupOnlyMessage();

        return;
    }


    if (
        !video.originalId
    ) {
        return;
    }


    const url =
        new URL(
            "../comments.html",
            window.location.href
        );


    url.searchParams.set(
        "postId",
        video.originalId
    );


    const shareUrl =
        url.toString();


    try {

        if (
            navigator.share
        ) {

            await navigator.share({

                title:
                    "VitalStar",

                text:
                    video.text ||
                    "Check out this post on VitalStar.",

                url:
                    shareUrl
            });

        } else if (
            navigator.clipboard
        ) {

            await navigator.clipboard.writeText(
                shareUrl
            );

            showToast(
                "Post link copied"
            );

        } else {

            showToast(
                "Share link ready"
            );
        }


        await updateDoc(
            doc(
                db,
                "posts",
                video.originalId
            ),
            {
                shares:
                    increment(1)
            }
        );


        video.shares =
            Number(
                video.shares || 0
            ) + 1;


        const cardCount =
            card?.querySelector(
                '[data-action="share"] .action-count'
            );


        if (cardCount) {

            cardCount.dataset.value =
                String(video.shares);

            cardCount.textContent =
                formatCount(
                    video.shares
                );
        }

    } catch (error) {

        if (
            error?.name !==
            "AbortError"
        ) {

            console.warn(
                "VitalStar share error:",
                error
            );
        }
    }
}


// ============================================================
// MUTE
// ============================================================

function toggleMute(
    video,
    card
) {

    const element =
        card?.querySelector(
            ".reals-video"
        );


    if (!element) return;


    element.muted =
        !element.muted;


    settings.muted =
        element.muted;


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(settings.muted)
    );


    const icon =
        card.querySelector(
            ".mute-icon"
        );


    if (icon) {

        icon.textContent =
            element.muted
                ? "🔇"
                : "🔊";
    }


    document
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            other => {

                other.muted =
                    settings.muted;
            }
        );
}


// ============================================================
// PROFILE
// ============================================================

function openProfile(video) {

    if (!video.creatorId) {
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
// GROUP PROFILE
// ============================================================

function openGroup(video) {

    if (
        !video.groupId
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


// ============================================================
// MORE
// ============================================================

function showMoreMenu(video) {

    if (
        video.type === "group"
    ) {

        showGroupOnlyMessage();

        return;
    }


    openProfile(video);
}


// ============================================================
// TOAST
// ============================================================

function showToast(message) {

    let toast =
        document.querySelector(
            ".vitalstar-reals-toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.className =
            "vitalstar-reals-toast";

        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toast._timer
    );


    toast._timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2400
        );
}


// ============================================================
// SETTINGS CHANGE
// ============================================================

export function onSettingChange(
    newSettings = {}
) {

    settings = {
        ...settings,
        ...newSettings
    };


    localStorage.setItem(
        "vitalstar_reals_autoplay",
        String(settings.autoplay)
    );


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(settings.muted)
    );


    localStorage.setItem(
        "vitalstar_reals_dataSaver",
        String(settings.dataSaver)
    );


    if (!container) {
        return;
    }


    container
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            video => {

                video.muted =
                    settings.muted;

                video.preload =
                    settings.dataSaver
                        ? "metadata"
                        : "auto";
            }
        );
}


// ============================================================
// VIDEO BEHAVIOR
// ============================================================

function setupVideoBehavior(feed) {

    feed
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            video => {

                video.addEventListener(
                    "play",
                    () => {

                        const card =
                            video.closest(
                                ".reals-video-card"
                            );

                        card?.classList.add(
                            "is-playing"
                        );

                        updatePlayIndicator(
                            card,
                            true
                        );
                    }
                );


                video.addEventListener(
                    "pause",
                    () => {

                        const card =
                            video.closest(
                                ".reals-video-card"
                            );

                        card?.classList.remove(
                            "is-playing"
                        );

                        updatePlayIndicator(
                            card,
                            false
                        );
                    }
                );


                video.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        if (
                            video.paused
                        ) {

                            playVideo(
                                video
                            );

                        } else {

                            video.pause();
                        }
                    }
                );
            }
        );
}


// ============================================================
// PLAY INDICATOR
// ============================================================

function updatePlayIndicator(
    card,
    playing
) {

    if (!card) return;

    const button =
        card.querySelector(
            ".video-play-indicator"
        );

    if (!button) return;


    if (playing) {

        button.textContent =
            "❚❚";

        button.classList.add(
            "playing"
        );

    } else {

        button.textContent =
            "▶";

        button.classList.remove(
            "playing"
        );
    }
}


// ============================================================
// OBSERVER
// ============================================================

function setupObserver(feed) {

    if (
        !("IntersectionObserver" in window)
    ) {

        const first =
            feed.querySelector(
                ".reals-video"
            );

        if (
            first &&
            settings.autoplay
        ) {
            playVideo(first);
        }

        return;
    }


    observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        const video =
                            entry.target;


                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= .65
                        ) {

                            if (
                                settings.autoplay
                            ) {

                                playVideo(
                                    video
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
                    .65,
                    .9
                ]
            }
        );


    feed
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            video =>
                observer.observe(video)
        );
}


// ============================================================
// PLAY VIDEO
// ============================================================

function playVideo(video) {

    if (!video) return;


    document
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            other => {

                if (
                    other !== video
                ) {

                    other.pause();
                }
            }
        );


    video.muted =
        settings.muted;


    const promise =
        video.play();


    if (
        promise &&
        typeof promise.catch ===
            "function"
    ) {

        promise.catch(
            () => {}
        );
    }
}


// ============================================================
// CLEANUP
// ============================================================

function cleanupListeners() {

    if (
        typeof normalUnsubscribe ===
        "function"
    ) {

        normalUnsubscribe();

        normalUnsubscribe =
            null;
    }


    if (
        typeof groupsUnsubscribe ===
        "function"
    ) {

        groupsUnsubscribe();

        groupsUnsubscribe =
            null;
    }


    disconnectObserver();
}


function disconnectObserver() {

    if (observer) {

        observer.disconnect();

        observer = null;
    }
}


export function destroyGeneralVids() {

    destroyed = true;

    cleanupListeners();

    normalPosts = [];
    groupPosts = [];
    currentVideos = [];

    if (container) {
        container.innerHTML = "";
    }

    container = null;
}


// ============================================================
// COUNT FORMAT
// ============================================================

function formatCount(number) {

    number =
        Number(number) || 0;


    if (number >= 1000000) {

        return (
            (number / 1000000)
                .toFixed(1)
                .replace(".0", "")
            + "M"
        );
    }


    if (number >= 1000) {

        return (
            (number / 1000)
                .toFixed(1)
                .replace(".0", "")
            + "K"
        );
    }


    return String(number);
}


// ============================================================
// STYLES
// ============================================================

function addStyles() {

    if (
        document.getElementById(
            "vitalstar-general-reals-styles"
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "vitalstar-general-reals-styles";


    style.textContent = `

        .general-reals-feed {
            width:100%;
            height:100%;
            overflow-y:auto;
            overflow-x:hidden;
            scroll-snap-type:y mandatory;
            background:#050914;
            scrollbar-width:none;
            padding:2dvh 0;
        }

        .general-reals-feed::-webkit-scrollbar {
            display:none;
        }


        .reals-video-card {
            position:relative;
            width:100%;
            height:94dvh;
            margin-bottom:2dvh;
            overflow:hidden;
            background:#050914;
            border-radius:10px;
            scroll-snap-align:center;
            scroll-snap-stop:always;
        }


        .reals-video {
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            object-fit:cover;
            background:#050914;
        }


        .video-top-gradient {
            position:absolute;
            top:0;
            left:0;
            right:0;
            height:16%;
            pointer-events:none;

            background:linear-gradient(
                to bottom,
                rgba(0,0,0,.48),
                transparent
            );
        }


        .video-bottom-gradient {
            position:absolute;
            left:0;
            right:0;
            bottom:0;
            height:42%;
            pointer-events:none;

            background:linear-gradient(
                to top,
                rgba(0,0,0,.78),
                rgba(0,0,0,.28),
                transparent
            );
        }


        /* ====================================================
           LARGE PLAY BUTTON
           ==================================================== */

        .video-play-indicator {
            position:absolute;

            top:50%;
            left:50%;

            transform:
                translate(-50%,-50%);

            width:88px;
            height:88px;

            border:0;
            border-radius:50%;

            background:
                rgba(5,9,20,.68);

            color:white;

            font-size:42px;
            font-weight:500;

            display:flex;
            align-items:center;
            justify-content:center;

            padding-left:6px;

            cursor:pointer;

            z-index:12;

            opacity:0;

            pointer-events:none;

            backdrop-filter:blur(5px);

            box-shadow:
                0 5px 25px
                rgba(0,0,0,.35);

            transition:
                opacity .18s ease,
                transform .18s ease;
        }


        .reals-video-card:not(.is-playing)
        .video-play-indicator {

            opacity:.9;

            pointer-events:auto;
        }


        .video-play-indicator.playing {

            opacity:0;

            pointer-events:none;
        }


        .reals-video-card:hover
        .video-play-indicator {

            transform:
                translate(-50%,-50%)
                scale(1.05);
        }


        /* ====================================================
           VIDEO SEEK CONTROLS
           ==================================================== */

        .video-seek-controls {

            position:absolute;

            left:50%;
            bottom:50%;

            transform:
                translateX(-50%);

            z-index:11;

            display:flex;

            align-items:center;

            gap:70px;

            pointer-events:none;
        }


        .video-seek-button {

            width:48px;
            height:48px;

            padding:0;

            border:1px solid
                rgba(255,255,255,.24);

            border-radius:50%;

            background:
                rgba(5,9,20,.58);

            color:white;

            display:flex;

            align-items:center;
            justify-content:center;

            font-size:22px;

            cursor:pointer;

            pointer-events:auto;

            backdrop-filter:blur(6px);

            box-shadow:
                0 4px 16px
                rgba(0,0,0,.25);

            transition:
                transform .15s ease,
                background .15s ease;
        }


        .video-seek-button:active {

            transform:
                scale(.86);
        }


        .video-seek-button:hover {

            background:
                rgba(37,99,235,.68);
        }


        /* ====================================================
           ACTIONS
           ==================================================== */

        .video-actions {
            position:absolute;

            right:7px;
            bottom:74px;

            z-index:10;

            display:flex;

            flex-direction:column;
            align-items:center;

            gap:9px;
        }


        .reals-action {
            width:40px;
            min-height:40px;

            padding:2px;

            border:0;

            background:transparent;

            color:white;

            display:flex;

            flex-direction:column;

            align-items:center;
            justify-content:center;

            gap:2px;

            cursor:pointer;
        }


        .reals-action:disabled {

            opacity:.6;

            cursor:wait;
        }


        .action-icon {

            font-size:20px;

            line-height:1;
        }


        .action-count {

            color:
                rgba(255,255,255,.84);

            font-size:9px;

            font-weight:650;
        }


        .like-action.liked
        .action-icon {

            color:#ff4f7b;
        }


        .repost-action.reposted
        .action-icon {

            color:#60a5fa;
        }


        /* ====================================================
           INFO
           ==================================================== */

        .video-info {

            position:absolute;

            left:13px;
            right:72px;
            bottom:20px;

            z-index:5;
        }


        .video-source-label {

            display:inline-flex;

            margin-bottom:7px;

            padding:4px 8px;

            border-radius:13px;

            background:
                rgba(8,15,35,.78);

            border:1px solid
                rgba(100,150,255,.22);

            color:#e9efff;

            font-size:9px;

            font-weight:650;
        }


        .creator-row {

            display:flex;

            align-items:center;

            gap:8px;
        }


        .creator-avatar {

            width:38px;
            height:38px;

            padding:0;

            border:1px solid
                rgba(255,255,255,.28);

            border-radius:50%;

            overflow:hidden;

            background:#101a35;

            flex-shrink:0;

            cursor:pointer;
        }


        .creator-avatar img {

            width:100%;
            height:100%;

            object-fit:cover;

            display:block;
        }


        .default-avatar {

            width:100%;
            height:100%;

            display:flex;

            align-items:center;
            justify-content:center;

            background:
                linear-gradient(
                    135deg,
                    #1d4ed8,
                    #6d28d9
                );

            color:white;

            font-weight:800;

            font-size:12px;
        }


        .creator-details {

            min-width:0;

            flex:1;
        }


        .creator-name-button {

            display:inline-flex;

            padding:0;

            border:0;

            background:transparent;

            color:white;

            cursor:pointer;

            text-align:left;
        }


        .creator-name {

            color:white;

            font-size:13px;

            font-weight:650;

            white-space:nowrap;

            overflow:hidden;

            text-overflow:ellipsis;
        }


        .creator-username {

            margin-top:1px;

            color:
                rgba(255,255,255,.68);

            font-size:10px;
        }


        .video-caption {

            margin-top:7px;

            color:
                rgba(255,255,255,.91);

            font-size:12.5px;

            line-height:1.38;

            word-break:break-word;
        }


        /* ====================================================
           LOADING / EMPTY / ERROR
           ==================================================== */

        .general-loading,
        .general-empty,
        .general-error {

            width:100%;

            height:100dvh;

            min-height:100vh;

            display:flex;

            flex-direction:column;

            align-items:center;

            justify-content:center;

            text-align:center;

            background:#050914;

            color:white;

            padding:20px;
        }


        .vs-loader {

            position:relative;

            width:68px;
            height:68px;

            display:flex;

            align-items:center;
            justify-content:center;
        }


        .vs-ring {

            position:absolute;

            inset:0;

            border-radius:50%;

            border:3px solid
                rgba(255,255,255,.10);

            border-top-color:#3b82f6;
            border-right-color:#8b5cf6;

            animation:
                vitalstarSpin
                1s linear infinite;
        }


        .vs-logo {

            width:42px;
            height:42px;

            border-radius:50%;

            display:flex;

            align-items:center;
            justify-content:center;

            background:
                linear-gradient(
                    135deg,
                    #123b8f,
                    #54209a
                );

            color:white;

            font-size:13px;

            font-weight:900;
        }


        .vs-loading-title {

            margin-top:18px;

            font-size:15px;

            font-weight:650;
        }


        .vs-loading-text {

            margin-top:6px;

            color:
                rgba(255,255,255,.52);

            font-size:11px;
        }


        .empty-icon,
        .error-icon {

            width:56px;
            height:56px;

            border-radius:50%;

            display:flex;

            align-items:center;
            justify-content:center;

            background:#101a35;

            border:1px solid
                rgba(100,150,255,.22);

            font-size:21px;

            font-weight:750;
        }


        .empty-title,
        .error-title {

            margin-top:15px;

            font-size:17px;

            font-weight:750;
        }


        .empty-text,
        .error-message {

            margin-top:7px;

            max-width:300px;

            color:
                rgba(255,255,255,.56);

            font-size:12px;

            line-height:1.45;
        }


        .retry-button {

            margin-top:17px;

            padding:9px 18px;

            border:0;

            border-radius:20px;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #6d28d9
                );

            color:white;

            font-size:12px;

            font-weight:650;
        }


        /* ====================================================
           TOAST
           ==================================================== */

        .vitalstar-reals-toast {

            position:fixed;

            left:50%;
            bottom:24px;

            transform:
                translate(-50%,20px);

            z-index:99999;

            padding:10px 15px;

            border-radius:20px;

            background:
                rgba(10,17,36,.96);

            border:1px solid
                rgba(100,150,255,.25);

            color:white;

            font-size:12px;

            opacity:0;

            pointer-events:none;

            transition:
                opacity .2s ease,
                transform .2s ease;

            max-width:85vw;

            text-align:center;
        }


        .vitalstar-reals-toast.show {

            opacity:1;

            transform:
                translate(-50%,0);
        }


        @keyframes vitalstarSpin {

            to {
                transform:rotate(360deg);
            }
        }


        /* ====================================================
           MOBILE
           ==================================================== */

        @media(max-width:480px) {

            .reals-video-card {

                height:94dvh;

                margin-bottom:1.5dvh;

                border-radius:8px;
            }


            .video-info {

                bottom:18px;

                left:11px;

                right:68px;
            }


            .video-actions {

                right:5px;

                bottom:70px;

                gap:7px;
            }


            .reals-action {

                width:38px;

                min-height:38px;
            }


            .action-icon {

                font-size:19px;
            }


            .action-count {

                font-size:8px;
            }


            .creator-avatar {

                width:36px;

                height:36px;
            }


            .creator-name {

                font-size:12.5px;
            }


            .video-caption {

                font-size:12px;
            }


            .video-play-indicator {

                width:82px;

                height:82px;

                font-size:39px;
            }


            .video-seek-controls {

                gap:45px;
            }


            .video-seek-button {

                width:44px;

                height:44px;

                font-size:20px;
            }
        }
    `;


    document.head.appendChild(
        style
    );
}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {

    init,

    initGeneralVids,

    onSettingChange,

    destroyGeneralVids

};