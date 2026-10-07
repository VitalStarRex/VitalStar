// ============================================================
// VITALSTAR — GROUP REALS
// groupvids.js
// Groups tab = GROUP VIDEOS ONLY
// Firebase v10.12.2
// ============================================================

import { auth, db } from "../firebase.js";

import {
    collectionGroup,
    query,
    limit,
    onSnapshot,
    getDoc,
    doc
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

let groupVideos = [];
let unsubscribe = null;
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

    if (
        mediaType === "video" ||
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

    let result =
        String(url);

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

        <div class="group-loading">

            <div class="vs-loader">

                <div class="vs-ring"></div>

                <div class="vs-logo">
                    VS
                </div>

            </div>

            <div class="vs-loading-title">
                Loading Group Videos...
            </div>

            <div class="vs-loading-text">
                Preparing VitalStar groups
            </div>

        </div>
    `;
}


// ============================================================
// EMPTY
// ============================================================

function showEmpty() {

    if (!container) return;

    container.innerHTML = `

        <div class="group-empty">

            <div class="empty-icon">
                ▶
            </div>

            <div class="empty-title">
                No group videos yet
            </div>

            <div class="empty-text">
                Videos posted inside VitalStar groups will appear here.
            </div>

        </div>
    `;
}


// ============================================================
// ERROR
// ============================================================

function showError(
    message = "Unable to load group videos."
) {

    if (!container) return;

    container.innerHTML = `

        <div class="group-error">

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
                id="groupRetryButton"
                type="button"
            >
                Try Again
            </button>

        </div>
    `;

    container
        .querySelector("#groupRetryButton")
        ?.addEventListener(
            "click",
            initializeFeed
        );
}


// ============================================================
// NORMALIZE GROUP VIDEO
// ============================================================

function normalizeGroupVideo(
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
// GROUP INFORMATION
// ============================================================

async function loadGroupInformation(video) {

    if (
        !video ||
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
            "VitalStar group information error:",
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
                        src="${escapeHTML(video.groupPhoto)}"
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
            "VitalStar Group Reals: feed container not found."
        );

        return () => {};
    }

    addStyles();

    showLoading();

    initializeFeed();

    return destroyGroupVids;
}


// ============================================================
// ALIAS
// ============================================================

export function initGroupVids(options = {}) {

    return init(options);
}


// ============================================================
// FIREBASE LOAD
// ONLY groups/*/posts
// NO normal posts collection
// ============================================================

function initializeFeed() {

    if (
        !container ||
        destroyed
    ) {
        return;
    }

    cleanupListeners();

    groupVideos = [];

    showLoading();

    try {

        const groupsQuery =
            query(
                collectionGroup(
                    db,
                    "posts"
                ),
                limit(500)
            );

        unsubscribe =
            onSnapshot(
                groupsQuery,
                async snapshot => {

                    const unique =
                        new Map();

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

                            const video =
                                normalizeGroupVideo(
                                    snap.id,
                                    data,
                                    groupId
                                );

                            if (!video.video) {
                                return;
                            }

                            const uniqueKey =
                                `group:${groupId}:${snap.id}`;

                            if (
                                !unique.has(
                                    uniqueKey
                                )
                            ) {

                                unique.set(
                                    uniqueKey,
                                    video
                                );
                            }
                        }
                    );

                    groupVideos =
                        Array.from(
                            unique.values()
                        );

                    groupVideos.sort(
                        (a, b) =>
                            b.createdAt -
                            a.createdAt
                    );

                    if (
                        !groupVideos.length
                    ) {

                        showEmpty();

                        return;
                    }

                    renderFeed();

                    await Promise.allSettled(
                        groupVideos.map(
                            video =>
                                loadGroupInformation(
                                    video
                                )
                        )
                    );

                },
                error => {

                    console.error(
                        "VitalStar Group Reals error:",
                        error
                    );

                    showError(
                        "Unable to load group videos."
                    );
                }
            );

    } catch (error) {

        console.error(
            "VitalStar Group query error:",
            error
        );

        showError(
            "Unable to load group videos."
        );
    }
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
        "group-reals-feed";

    groupVideos.forEach(
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

    const name =
        video.groupName ||
        "VitalStar Group";

    const photo =
        video.groupPhoto;

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


        <!-- PLAY / PAUSE -->

        <button
            class="video-play-indicator"
            type="button"
            aria-label="Play or pause video"
        >
            ▶
        </button>


        <!-- DRAGGABLE VIDEO PROGRESS -->

        <div
            class="video-progress-container"
            aria-label="Video progress"
        >

            <div class="video-progress-track">

                <div
                    class="video-progress-fill"
                ></div>

                <div
                    class="video-progress-thumb"
                ></div>

            </div>

        </div>


        <!-- ACTIONS -->

        <div class="video-actions">

            <button
                class="reals-action"
                type="button"
                data-action="like"
            >
                <span class="action-icon">
                    ♡
                </span>

                <span class="action-count">
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

                <span class="action-count">
                    ${formatCount(video.comments)}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="repost"
            >
                <span class="action-icon">
                    ↻
                </span>

                <span class="action-count">
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

                <span class="action-count">
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


        <!-- GROUP INFORMATION -->

        <div class="video-info">

            <div class="video-source-label">
                Group
            </div>


            <div class="creator-row">

                <button
                    class="creator-avatar"
                    type="button"
                    data-action="group"
                >
                    ${avatar}
                </button>


                <div class="creator-details">

                    <button
                        class="creator-name-button"
                        type="button"
                        data-action="group"
                    >

                        <span class="creator-name">
                            ${escapeHTML(name)}
                        </span>

                    </button>


                    <div class="creator-username">
                        Group
                    </div>

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
    // VIDEO
    // ========================================================

    const videoElement =
        card.querySelector(
            ".reals-video"
        );


    // ========================================================
    // PROGRESS BAR
    // ========================================================

    const progressContainer =
        card.querySelector(
            ".video-progress-container"
        );

    const progressTrack =
        card.querySelector(
            ".video-progress-track"
        );

    const progressFill =
        card.querySelector(
            ".video-progress-fill"
        );

    const progressThumb =
        card.querySelector(
            ".video-progress-thumb"
        );

    let dragging =
        false;


    function updateProgress() {

        if (!videoElement) return;

        const duration =
            Number(
                videoElement.duration
            );

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            return;
        }

        const percent =
            Math.min(
                100,
                Math.max(
                    0,
                    (
                        videoElement.currentTime /
                        duration
                    ) * 100
                )
            );

        if (progressFill) {

            progressFill.style.width =
                `${percent}%`;
        }

        if (progressThumb) {

            progressThumb.style.left =
                `${percent}%`;
        }
    }


    function seekFromPointer(event) {

        if (
            !videoElement ||
            !progressTrack
        ) {
            return;
        }

        const duration =
            Number(
                videoElement.duration
            );

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            return;
        }

        const rect =
            progressTrack.getBoundingClientRect();

        if (!rect.width) return;

        let position =
            (
                event.clientX -
                rect.left
            ) / rect.width;

        position =
            Math.min(
                1,
                Math.max(
                    0,
                    position
                )
            );

        videoElement.currentTime =
            duration * position;

        updateProgress();
    }


    videoElement?.addEventListener(
        "timeupdate",
        updateProgress
    );


    videoElement?.addEventListener(
        "loadedmetadata",
        updateProgress
    );


    videoElement?.addEventListener(
        "durationchange",
        updateProgress
    );


    progressContainer?.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();
            event.stopPropagation();

            dragging = true;

            progressContainer.setPointerCapture?.(
                event.pointerId
            );

            seekFromPointer(
                event
            );
        }
    );


    progressContainer?.addEventListener(
        "pointermove",
        event => {

            if (!dragging) return;

            event.preventDefault();
            event.stopPropagation();

            seekFromPointer(
                event
            );
        }
    );


    progressContainer?.addEventListener(
        "pointerup",
        event => {

            if (!dragging) return;

            event.preventDefault();
            event.stopPropagation();

            dragging = false;

            try {

                progressContainer.releasePointerCapture?.(
                    event.pointerId
                );

            } catch {}
        }
    );


    progressContainer?.addEventListener(
        "pointercancel",
        event => {

            dragging = false;

            try {

                progressContainer.releasePointerCapture?.(
                    event.pointerId
                );

            } catch {}
        }
    );


    // ========================================================
    // ACTIONS
    // ========================================================

    card.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    ".video-progress-container"
                )
            ) {
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
    // PLAY BUTTON
    // ========================================================

    card
        .querySelector(
            ".video-play-indicator"
        )
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                if (!videoElement) return;

                if (
                    videoElement.paused
                ) {

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
// ACTION HANDLER
// ============================================================

function handleAction(
    action,
    video,
    card
) {

    switch (action) {

        case "like":
        case "comment":
        case "repost":
        case "share":
        case "more":

            showGroupOnlyMessage();

            return;


        case "mute":

            toggleMute(
                card
            );

            return;


        case "group":

            openGroup(
                video
            );

            return;
    }
}


// ============================================================
// GROUP ACTION MESSAGE
// ============================================================

function showGroupOnlyMessage() {

    showToast(
        "This action can only be taken inside the group."
    );
}


// ============================================================
// MUTE
// ============================================================

function toggleMute(card) {

    const video =
        card?.querySelector(
            ".reals-video"
        );

    if (!video) return;

    video.muted =
        !video.muted;

    settings.muted =
        video.muted;

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
            video.muted
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
// OPEN GROUP
// ============================================================

function openGroup(video) {

    if (!video.groupId) {
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

            playVideo(
                first
            );
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
                observer.observe(
                    video
                )
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
        typeof unsubscribe ===
        "function"
    ) {

        unsubscribe();

        unsubscribe =
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


// ============================================================
// DESTROY
// ============================================================

export function destroyGroupVids() {

    destroyed = true;

    cleanupListeners();

    groupVideos = [];

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
            "vitalstar-group-reals-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "vitalstar-group-reals-styles";

    style.textContent = `

        /* =====================================================
           GROUP REALS FEED
           NO SPACE ABOVE / BELOW VIDEOS
           ===================================================== */

        .group-reals-feed {

            width:100%;
            height:100%;

            margin:0;
            padding:0;

            overflow-y:auto;
            overflow-x:hidden;

            scroll-snap-type:y mandatory;

            background:#050914;

            scrollbar-width:none;

            box-sizing:border-box;
        }


        .group-reals-feed::-webkit-scrollbar {
            display:none;
        }


        /* =====================================================
           FULL SCREEN VIDEO CARD
           ===================================================== */

        .reals-video-card {

            position:relative;

            width:100%;

            height:100dvh;
            min-height:100dvh;

            margin:0;
            padding:0;

            overflow:hidden;

            background:#050914;

            border-radius:0;

            box-sizing:border-box;

            scroll-snap-align:start;

            scroll-snap-stop:always;
        }


        .reals-video {

            position:absolute;

            inset:0;

            width:100%;
            height:100%;

            object-fit:cover;

            background:#050914;

            display:block;
        }


        .video-top-gradient {

            position:absolute;

            top:0;
            left:0;
            right:0;

            height:16%;

            pointer-events:none;

            background:
                linear-gradient(
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

            background:
                linear-gradient(
                    to top,
                    rgba(0,0,0,.78),
                    rgba(0,0,0,.28),
                    transparent
                );
        }


        /* =====================================================
           PLAY / PAUSE
           ===================================================== */

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


        /* =====================================================
           VIDEO PROGRESS
           ===================================================== */

        .video-progress-container {

            position:absolute;

            left:0;
            right:0;
            bottom:0;

            height:24px;

            z-index:15;

            display:flex;

            align-items:flex-end;

            padding:0 0 5px;

            cursor:pointer;

            touch-action:none;

            pointer-events:auto;
        }


        .video-progress-track {

            position:relative;

            width:100%;

            height:3px;

            background:
                rgba(255,255,255,.42);

            overflow:visible;
        }


        .video-progress-fill {

            position:absolute;

            left:0;
            top:0;

            width:0%;
            height:100%;

            background:#ffffff;
        }


        .video-progress-thumb {

            position:absolute;

            top:50%;
            left:0%;

            width:9px;
            height:9px;

            border-radius:50%;

            background:#ffffff;

            transform:
                translate(-50%,-50%);

            box-shadow:
                0 1px 5px
                rgba(0,0,0,.35);
        }


        .video-progress-container:hover
        .video-progress-thumb {

            width:13px;
            height:13px;
        }


        .video-progress-container:active
        .video-progress-thumb {

            width:15px;
            height:15px;
        }


        /* =====================================================
           ACTIONS
           ===================================================== */

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


        /* =====================================================
           VIDEO INFORMATION
           ===================================================== */

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


        /* =====================================================
           LOADING / EMPTY / ERROR
           ===================================================== */

        .group-loading,
        .group-empty,
        .group-error {

            width:100%;

            height:100dvh;

            min-height:100dvh;

            margin:0;
            padding:20px;

            display:flex;

            flex-direction:column;

            align-items:center;

            justify-content:center;

            text-align:center;

            background:#050914;

            color:white;

            box-sizing:border-box;
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
                vitalstarGroupSpin
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

            cursor:pointer;
        }


        /* =====================================================
           TOAST
           ===================================================== */

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


        /* =====================================================
           ANIMATION
           ===================================================== */

        @keyframes vitalstarGroupSpin {

            to {
                transform:rotate(360deg);
            }
        }


        /* =====================================================
           MOBILE
           IMPORTANT: NO SPACE BELOW
           ===================================================== */

        @media(max-width:480px) {

            .group-reals-feed {

                width:100%;

                height:100%;

                padding:0;

                margin:0;
            }


            .reals-video-card {

                width:100%;

                height:100dvh;

                min-height:100dvh;

                margin:0;

                padding:0;

                border-radius:0;
            }


            .reals-video {

                width:100%;
                height:100%;

                object-fit:cover;
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

    initGroupVids,

    onSettingChange,

    destroyGroupVids

};
