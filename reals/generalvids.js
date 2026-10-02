
// ============================================================
// VITALSTAR REALS — GENERAL VIDEO FEED
// TikTok-style vertical video experience
// Firebase v10.12.2
// ============================================================

import {
    auth,
    db
} from "../firebase.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// STATE
// ============================================================

let unsubscribe = null;
let observer = null;

let currentContainer = null;

let currentSettings = {
    autoplay: true,
    muted: true,
    dataSaver: false
};

let videos = [];


// ============================================================
// INITIALIZER
// ============================================================

export function initGeneralVids({
    container,
    settings = {}
} = {}) {

    if (!container) {
        throw new Error(
            "VitalStar Reals: container is required."
        );
    }

    destroyGeneralVids();

    currentContainer = container;

    currentSettings = {
        autoplay:
            settings.autoplay !== false,

        muted:
            settings.muted !== false,

        dataSaver:
            settings.dataSaver === true
    };

    renderFeedShell();

    loadVideos();

    return destroyGeneralVids;
}


// ============================================================
// OPTIONAL GENERIC INITIALIZER
// ============================================================

export const init = initGeneralVids;


// ============================================================
// LOAD VIDEOS
// ============================================================

function loadVideos() {

    const postsRef =
        collection(db, "posts");


    const videosQuery =
        query(
            postsRef,
            orderBy("createdAt", "desc"),
            limit(
                currentSettings.dataSaver
                    ? 15
                    : 40
            )
        );


    unsubscribe =
        onSnapshot(
            videosQuery,

            (snapshot) => {

                const loaded = [];


                snapshot.forEach((docSnap) => {

                    const data =
                        docSnap.data();


                    const videoUrl =
                        getVideoUrl(data);


                    if (!videoUrl) {
                        return;
                    }


                    /*
                     * Ignore private posts.
                     */

                    const visibility =
                        data.visibility ??
                        data.privacy ??
                        "Public";


                    if (
                        String(visibility)
                            .toLowerCase()
                            .includes("only")
                    ) {
                        return;
                    }


                    loaded.push({

                        id:
                            docSnap.id,

                        ...data,

                        videoUrl:
                            videoUrl

                    });

                });


                videos = loaded;

                renderVideos();

            },

            (error) => {

                console.error(
                    "VitalStar General Reals error:",
                    error
                );


                showError();

            }
        );

}


// ============================================================
// GET VIDEO URL
// ============================================================

function getVideoUrl(data) {

    if (!data) {
        return null;
    }


    /*
     * Supports the common VitalStar
     * video field names.
     */

    const possibleFields = [

        "video",

        "videoUrl",

        "videoURL",

        "videoURL",

        "mediaUrl",

        "mediaURL",

        "fileUrl",

        "fileURL"

    ];


    for (
        const field of possibleFields
    ) {

        const value =
            data[field];


        if (
            typeof value === "string" &&
            value.trim() !== ""
        ) {

            const lower =
                value.toLowerCase();


            /*
             * Make sure this actually
             * looks like a video.
             */

            if (
                lower.includes(".mp4") ||
                lower.includes(".webm") ||
                lower.includes(".mov") ||
                lower.includes("video") ||
                lower.includes("cloudinary")
            ) {

                return value;

            }

        }

    }


    return null;

}


// ============================================================
// FEED SHELL
// ============================================================

function renderFeedShell() {

    if (!currentContainer) {
        return;
    }


    currentContainer.innerHTML = `

        <div
            class="reals-feed general-reals-feed"
            id="generalRealsFeed"
        ></div>

    `;


    injectStyles();

}


// ============================================================
// RENDER VIDEOS
// ============================================================

function renderVideos() {

    const feed =
        document.getElementById(
            "generalRealsFeed"
        );


    if (!feed) {
        return;
    }


    disconnectObserver();


    if (!videos.length) {

        feed.innerHTML = `

            <div class="reals-empty">

                <div class="reals-empty-icon">
                    🎬
                </div>

                <div class="reals-empty-title">
                    No Reals yet
                </div>

                <div class="reals-empty-text">
                    Video posts from VitalStar will appear here.
                </div>

            </div>

        `;

        return;
    }


    feed.innerHTML =
        videos
            .map(
                (video, index) =>
                    createVideoItem(
                        video,
                        index
                    )
            )
            .join("");


    setupVideoBehavior(feed);

}


// ============================================================
// CREATE VIDEO ITEM
// ============================================================

function createVideoItem(
    video,
    index
) {

    const user =
        getUserData(video);


    const caption =
        escapeHTML(
            video.text ??
            video.caption ??
            ""
        );


    const name =
        escapeHTML(
            user.name ||
            "VitalStar User"
        );


    const username =
        escapeHTML(
            user.username
                ? `@${removeAt(user.username)}`
                : ""
        );


    const avatar =
        escapeAttribute(
            user.avatar ||
            "https://via.placeholder.com/100"
        );


    const videoUrl =
        escapeAttribute(
            video.videoUrl
        );


    const likes =
        formatCount(
            video.likes
        );


    const comments =
        formatCount(
            video.comments
        );


    const shares =
        formatCount(
            video.shares
        );


    const reposts =
        formatCount(
            video.reposts
        );


    return `

        <article
            class="real-item"
            data-real-id="${escapeAttribute(video.id)}"
        >

            <video
                class="real-video"
                src="${videoUrl}"
                playsinline
                preload="${currentSettings.dataSaver ? "none" : "metadata"}"
                ${currentSettings.muted ? "muted" : ""}
                loop
            ></video>


            <div class="real-gradient"></div>


            <!-- PLAY BUTTON -->

            <button
                type="button"
                class="real-center-play"
                aria-label="Play video"
                data-action="play"
            >
                ▶
            </button>


            <!-- TOP VIDEO NUMBER -->

            <div class="real-index">
                ${index + 1}
            </div>


            <!-- CREATOR INFORMATION -->

            <div class="real-info">

                <div class="real-user">

                    <img
                        class="real-avatar"
                        src="${avatar}"
                        alt=""
                        loading="lazy"
                    >

                    <div class="real-user-text">

                        <div class="real-name">
                            ${name}
                        </div>

                        ${
                            username
                                ? `
                                    <div class="real-username">
                                        ${username}
                                    </div>
                                `
                                : ""
                        }

                    </div>

                    <button
                        type="button"
                        class="real-follow"
                        data-action="follow"
                    >
                        Follow
                    </button>

                </div>


                ${
                    caption
                        ? `
                            <div class="real-caption">
                                ${caption}
                            </div>
                        `
                        : ""
                }

            </div>


            <!-- RIGHT SIDE ACTIONS -->

            <div class="real-actions">

                <button
                    type="button"
                    class="real-action"
                    data-action="like"
                >

                    <span class="real-action-icon">
                        ❤️
                    </span>

                    <span class="real-action-count">
                        ${likes}
                    </span>

                </button>


                <button
                    type="button"
                    class="real-action"
                    data-action="comment"
                >

                    <span class="real-action-icon">
                        💬
                    </span>

                    <span class="real-action-count">
                        ${comments}
                    </span>

                </button>


                <button
                    type="button"
                    class="real-action"
                    data-action="repost"
                >

                    <span class="real-action-icon">
                        🔁
                    </span>

                    <span class="real-action-count">
                        ${reposts}
                    </span>

                </button>


                <button
                    type="button"
                    class="real-action"
                    data-action="share"
                >

                    <span class="real-action-icon">
                        ↗️
                    </span>

                    <span class="real-action-count">
                        ${shares}
                    </span>

                </button>


                <button
                    type="button"
                    class="real-action"
                    data-action="mute"
                >

                    <span class="real-action-icon">
                        ${
                            currentSettings.muted
                                ? "🔇"
                                : "🔊"
                        }
                    </span>

                </button>


                <button
                    type="button"
                    class="real-action"
                    data-action="more"
                >

                    <span class="real-action-icon">
                        ⋮
                    </span>

                </button>

            </div>

        </article>

    `;

}


// ============================================================
// GET USER DATA
// ============================================================

function getUserData(video) {

    return {

        name:
            video.fullName ??
            video.displayName ??
            video.name ??
            "VitalStar User",

        username:
            video.username ??
            "",

        avatar:
            video.profilePicture ??
            video.profilePic ??
            video.avatar ??
            video.photoURL ??
            ""

    };

}


// ============================================================
// VIDEO BEHAVIOR
// ============================================================

function setupVideoBehavior(feed) {

    const items =
        feed.querySelectorAll(
            ".real-item"
        );


    const videosElements =
        feed.querySelectorAll(
            ".real-video"
        );


    /*
     * IntersectionObserver gives the
     * TikTok-style auto-play behavior.
     */

    observer =
        new IntersectionObserver(
            (entries) => {

                entries.forEach(
                    (entry) => {

                        const item =
                            entry.target;

                        const video =
                            item.querySelector(
                                ".real-video"
                            );


                        if (!video) {
                            return;
                        }


                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= 0.65
                        ) {

                            pauseOtherVideos(
                                video
                            );


                            if (
                                currentSettings
                                    .autoplay
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
                    0.25,
                    0.65,
                    0.85
                ]
            }
        );


    items.forEach(
        (item) => {

            observer.observe(item);

            attachItemEvents(item);

        }
    );


    /*
     * Set the initial mute state.
     */

    videosElements.forEach(
        (video) => {

            video.muted =
                currentSettings.muted;

        }
    );


    /*
     * Try to start the first visible
     * video immediately.
     */

    if (
        currentSettings.autoplay &&
        videosElements.length
    ) {

        playVideo(
            videosElements[0]
        );

    }

}


// ============================================================
// ITEM EVENTS
// ============================================================

function attachItemEvents(item) {

    const video =
        item.querySelector(
            ".real-video"
        );


    const playButton =
        item.querySelector(
            '[data-action="play"]'
        );


    if (!video) {
        return;
    }


    /*
     * Tap the actual video.
     */

    video.addEventListener(
        "click",
        () => {

            togglePlay(video);

        }
    );


    /*
     * Center play button.
     */

    if (playButton) {

        playButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                togglePlay(video);

            }
        );

    }


    /*
     * Right-side actions.
     */

    item
        .querySelectorAll(
            ".real-action"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.stopPropagation();

                        handleAction(
                            button.dataset.action,
                            item,
                            video
                        );

                    }
                );

            }
        );


    /*
     * Hide center play button
     * after video starts.
     */

    video.addEventListener(
        "play",
        () => {

            playButton?.classList.remove(
                "show"
            );

        }
    );


    video.addEventListener(
        "pause",
        () => {

            playButton?.classList.add(
                "show"
            );

        }
    );

}


// ============================================================
// PLAY / PAUSE
// ============================================================

function togglePlay(video) {

    if (video.paused) {

        pauseOtherVideos(video);

        playVideo(video);

    } else {

        video.pause();

    }

}


function playVideo(video) {

    if (!video) {
        return;
    }


    video.muted =
        currentSettings.muted;


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


function pauseOtherVideos(currentVideo) {

    document
        .querySelectorAll(
            ".general-reals-feed .real-video"
        )
        .forEach(
            (video) => {

                if (
                    video !== currentVideo
                ) {

                    video.pause();

                }

            }
        );

}


// ============================================================
// ACTION HANDLER
// ============================================================

function handleAction(
    action,
    item,
    video
) {

    const postId =
        item.dataset.realId;


    switch (action) {

        case "like":

            toggleLike(
                item
            );

            break;


        case "comment":

            openComments(
                postId
            );

            break;


        case "repost":

            repostVideo(
                postId
            );

            break;


        case "share":

            shareVideo(
                postId,
                video
            );

            break;


        case "follow":

            followCreator(
                item
            );

            break;


        case "mute":

            toggleMute(
                video,
                item
            );

            break;


        case "more":

            showMoreMenu(
                postId
            );

            break;

    }

}


// ============================================================
// LIKE UI
// ============================================================

function toggleLike(item) {

    const button =
        item.querySelector(
            '[data-action="like"]'
        );


    const icon =
        button?.querySelector(
            ".real-action-icon"
        );


    if (!icon) {
        return;
    }


    const liked =
        item.dataset.liked === "true";


    item.dataset.liked =
        liked
            ? "false"
            : "true";


    icon.textContent =
        liked
            ? "❤️"
            : "❤️";


    if (!liked) {

        button.classList.add(
            "liked"
        );

    } else {

        button.classList.remove(
            "liked"
        );

    }

}


// ============================================================
// COMMENTS
// ============================================================

function openComments(postId) {

    window.dispatchEvent(
        new CustomEvent(
            "vitalstar:reals-comments",
            {
                detail: {
                    postId: postId
                }
            }
        )
    );


    /*
     * If your comments system is already
     * listening for openComments, it can
     * handle this event.
     */

}


// ============================================================
// REPOST
// ============================================================

function repostVideo(postId) {

    window.dispatchEvent(
        new CustomEvent(
            "vitalstar:reals-repost",
            {
                detail: {
                    postId: postId
                }
            }
        )
    );

}


// ============================================================
// SHARE
// ============================================================

async function shareVideo(
    postId,
    video
) {

    const shareData = {

        title:
            "VitalStar Reals",

        text:
            "Check out this Real on VitalStar.",

        url:
            window.location.origin +
            window.location.pathname +
            "?real=" +
            encodeURIComponent(postId)

    };


    try {

        if (
            navigator.share
        ) {

            await navigator.share(
                shareData
            );

            return;

        }


        await navigator.clipboard.writeText(
            shareData.url
        );


        showToast(
            "Real link copied"
        );

    } catch (error) {

        console.log(
            "Share cancelled."
        );

    }

}


// ============================================================
// FOLLOW
// ============================================================

function followCreator(item) {

    const button =
        item.querySelector(
            '[data-action="follow"]'
        );


    if (!button) {
        return;
    }


    if (
        button.dataset.following ===
        "true"
    ) {

        button.dataset.following =
            "false";

        button.textContent =
            "Follow";

    } else {

        button.dataset.following =
            "true";

        button.textContent =
            "Following";

    }


    /*
     * This only changes the UI.
     *
     * Your existing Firebase friendship/
     * follow system can be connected here.
     */

}


// ============================================================
// MUTE
// ============================================================

function toggleMute(
    video,
    item
) {

    video.muted =
        !video.muted;


    const icon =
        item.querySelector(
            '[data-action="mute"] .real-action-icon'
        );


    if (icon) {

        icon.textContent =
            video.muted
                ? "🔇"
                : "🔊";

    }


    currentSettings.muted =
        video.muted;


    localStorage.setItem(
        "vitalstar_reals_muted",
        video.muted
            ? "true"
            : "false"
    );

}


// ============================================================
// MORE MENU
// ============================================================

function showMoreMenu(postId) {

    window.dispatchEvent(
        new CustomEvent(
            "vitalstar:reals-options",
            {
                detail: {
                    postId: postId
                }
            }
        )
    );


    showToast(
        "More options"
    );

}


// ============================================================
// SETTINGS CHANGE
// ============================================================

export function onSettingChange(
    setting,
    enabled
) {

    currentSettings[
        setting
    ] = enabled;


    const videoElements =
        document.querySelectorAll(
            ".general-reals-feed .real-video"
        );


    if (
        setting === "muted"
    ) {

        videoElements.forEach(
            (video) => {

                video.muted =
                    enabled;

            }
        );

    }


    if (
        setting === "autoplay" &&
        enabled
    ) {

        const visible =
            getVisibleVideo();


        if (visible) {

            playVideo(
                visible
            );

        }

    }

}


// ============================================================
// FIND VISIBLE VIDEO
// ============================================================

function getVisibleVideo() {

    const feed =
        document.getElementById(
            "generalRealsFeed"
        );


    if (!feed) {
        return null;
    }


    const items =
        feed.querySelectorAll(
            ".real-item"
        );


    let bestVideo = null;
    let bestRatio = 0;


    items.forEach(
        (item) => {

            const rect =
                item.getBoundingClientRect();


            const visibleTop =
                Math.max(
                    rect.top,
                    0
                );


            const visibleBottom =
                Math.min(
                    rect.bottom,
                    window.innerHeight
                );


            const visibleHeight =
                Math.max(
                    0,
                    visibleBottom -
                    visibleTop
                );


            const ratio =
                visibleHeight /
                rect.height;


            if (
                ratio > bestRatio
            ) {

                bestRatio =
                    ratio;

                bestVideo =
                    item.querySelector(
                        ".real-video"
                    );

            }

        }
    );


    return bestVideo;

}


// ============================================================
// DESTROY
// ============================================================

export function destroyGeneralVids() {

    disconnectObserver();


    if (
        typeof unsubscribe ===
        "function"
    ) {

        unsubscribe();

    }


    unsubscribe =
        null;


    document
        .querySelectorAll(
            ".general-reals-feed .real-video"
        )
        .forEach(
            (video) => {

                video.pause();

                video.removeAttribute(
                    "src"
                );

                video.load();

            }
        );


    videos = [];


    currentContainer =
        null;

}


// ============================================================
// OBSERVER CLEANUP
// ============================================================

function disconnectObserver() {

    if (observer) {

        observer.disconnect();

        observer =
            null;

    }

}


// ============================================================
// ERROR STATE
// ============================================================

function showError() {

    if (!currentContainer) {
        return;
    }


    currentContainer.innerHTML = `

        <div class="reals-empty">

            <div class="reals-empty-icon">
                ⚠️
            </div>

            <div class="reals-empty-title">
                Couldn't load Reals
            </div>

            <div class="reals-empty-text">
                Please check your connection and try again.
            </div>

        </div>

    `;

}


// ============================================================
// TOAST
// ============================================================

function showToast(message) {

    let toast =
        document.getElementById(
            "realsToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "realsToast";

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
            1800
        );

}


// ============================================================
// HELPERS
// ============================================================

function formatCount(value) {

    if (
        typeof value ===
        "object" &&
        value !== null
    ) {

        if (
            Array.isArray(value)
        ) {

            return value.length;

        }

        if (
            typeof value.size ===
            "number"
        ) {

            return value.size;

        }

    }


    if (
        typeof value ===
        "number"
    ) {

        if (value >= 1000000) {

            return (
                (value / 1000000)
                    .toFixed(1)
                    .replace(".0", "") +
                "M"
            );

        }


        if (value >= 1000) {

            return (
                (value / 1000)
                    .toFixed(1)
                    .replace(".0", "") +
                "K"
            );

        }


        return String(value);

    }


    return "0";

}


function removeAt(value) {

    return String(value)
        .replace(/^@/, "");

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


// ============================================================
// REALS-ONLY STYLES
// ============================================================

function injectStyles() {

    if (
        document.getElementById(
            "generalRealsStyles"
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "generalRealsStyles";


    style.textContent = `

        .general-reals-feed {
            position: relative;
            width: 100%;
            height: 100%;
            background: #050914;
        }


        .general-reals-feed
        .real-item {
            position: relative;
        }


        .general-reals-feed
        .real-video {
            cursor: pointer;
            touch-action: manipulation;
        }


        .general-reals-feed
        .real-center-play {
            position: absolute;

            left: 50%;
            top: 50%;

            transform: translate(
                -50%,
                -50%
            );

            width: 62px;
            height: 62px;

            border: 0;
            border-radius: 50%;

            display: flex;
            align-items: center;
            justify-content: center;

            color: #ffffff;

            background:
                rgba(
                    0,
                    0,
                    0,
                    0.48
                );

            backdrop-filter:
                blur(8px);

            font-size: 25px;

            cursor: pointer;

            opacity: 0;
            pointer-events: none;

            transition:
                opacity 0.18s ease,
                transform 0.18s ease;

            z-index: 15;
        }


        .general-reals-feed
        .real-center-play.show {
            opacity: 1;
            pointer-events: auto;
        }


        .general-reals-feed
        .real-center-play:active {
            transform:
                translate(
                    -50%,
                    -50%
                )
                scale(0.9);
        }


        .general-reals-feed
        .real-index {
            position: absolute;

            top: 78px;
            right: 15px;

            z-index: 8;

            padding: 5px 9px;

            border-radius: 12px;

            background:
                rgba(
                    0,
                    0,
                    0,
                    0.35
                );

            color:
                rgba(
                    255,
                    255,
                    255,
                    0.8
                );

            font-size: 10px;

            backdrop-filter:
                blur(6px);
        }


        .general-reals-feed
        .real-user-text {
            min-width: 0;
        }


        .general-reals-feed
        .real-follow {
            margin-left: 4px;

            padding: 6px 11px;

            border: 1px solid
                rgba(
                    255,
                    255,
                    255,
                    0.45
                );

            border-radius: 9px;

            color: #ffffff;

            background:
                rgba(
                    0,
                    0,
                    0,
                    0.28
                );

            font-size: 10px;
            font-weight: 800;

            cursor: pointer;
        }


        .general-reals-feed
        .real-follow:active {
            transform:
                scale(0.94);
        }


        .general-reals-feed
        .real-action {
            transition:
                transform 0.15s ease;
        }


        .general-reals-feed
        .real-action:active {
            transform:
                scale(0.9);
        }


        .general-reals-feed
        .real-action.liked
        .real-action-icon {
            transform:
                scale(1.12);
        }


        #realsToast {
            position: fixed;

            left: 50%;
            bottom: 30px;

            transform:
                translate(
                    -50%,
                    15px
                );

            z-index: 5000;

            padding: 10px 16px;

            border-radius: 20px;

            color: #ffffff;

            background:
                rgba(
                    10,
                    18,
                    35,
                    0.94
                );

            border: 1px solid
                rgba(
                    0,
                    140,
                    255,
                    0.35
                );

            font-size: 12px;

            opacity: 0;
            pointer-events: none;

            transition:
                opacity 0.2s ease,
                transform 0.2s ease;

            backdrop-filter:
                blur(10px);
        }


        #realsToast.show {
            opacity: 1;

            transform:
                translate(
                    -50%,
                    0
                );
        }

    `;


    document.head.appendChild(
        style
    );

}