// ============================================================
// VITALSTAR — GENERAL REALS
// generalvids.js
//
// ALL PUBLIC VIDEOS FROM:
// 1. Normal VitalStar posts
// 2. All VitalStar group posts
//
// GROUP VIDEOS SHOW:
// - Group name
// - Group profile picture
//
// NORMAL VIDEOS SHOW:
// - User name
// - User profile picture
//
// EXCLUDES:
// - Private / Only Me videos
// - Friends-only normal posts
// - DM / chat videos
// - Voice notes
//
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

    if (
        mediaType === "video"
    ) {
        return true;
    }

    if (
        mediaType === "video/mp4" ||
        mediaType.startsWith("video/")
    ) {
        return true;
    }

    const url =
        String(mediaURL)
            .toLowerCase();

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
        result.includes(
            "res.cloudinary.com"
        )
    ) {

        if (
            result.includes(
                "/video/upload/"
            ) &&
            !result.includes(
                "/f_mp4/"
            )
        ) {

            result =
                result.replace(
                    "/video/upload/",
                    "/video/upload/f_mp4/"
                );
        }
    }

    return result;
}


// ============================================================
// LOADING INDICATOR
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
            () => {
                initializeFeed();
            }
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

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    return {

        id:
            `post_${id}`,

        originalId:
            id,

        type:
            "post",

        video:
            getPlayableVideoUrl(
                video
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
            Number(
                data.likes || 0
            ),

        comments:
            Number(
                data.comments || 0
            ),

        reposts:
            Number(
                data.reposts || 0
            ),

        shares:
            Number(
                data.shares || 0
            )
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

    const video =
        data.mediaURL ||
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

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
                video
            ),

        text:
            data.text ||
            data.caption ||
            "",

        // ----------------------------------------------------
        // AUTHOR DETAILS
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // GROUP IDENTITY
        // ----------------------------------------------------

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

async function loadGroupInformation(
    video
) {

    if (
        !video ||
        video.type !== "group" ||
        !video.groupId
    ) {
        return;
    }

    try {

        const groupRef =
            doc(
                db,
                "groups",
                video.groupId
            );

        const groupSnap =
            await getDoc(
                groupRef
            );

        if (
            !groupSnap.exists()
        ) {
            return;
        }

        const data =
            groupSnap.data() || {};


        // ----------------------------------------------------
        // GROUP NAME
        // ----------------------------------------------------

        const groupName =
            data.name ||
            data.groupName ||
            data.title ||
            data.displayName ||
            data.groupTitle ||
            "";

        if (groupName) {

            video.groupName =
                groupName;
        }


        // ----------------------------------------------------
        // GROUP PROFILE PICTURE
        //
        // group.js uses:
        // group.avatarURL || group.avatarUrl
        // ----------------------------------------------------

        const groupPhoto =
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
            "";

        if (groupPhoto) {

            video.groupPhoto =
                groupPhoto;
        }


        // ----------------------------------------------------
        // UPDATE ONLY THE EXISTING CARD
        // ----------------------------------------------------

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
            "VitalStar Reals: unable to load group information:",
            video.groupId,
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

    if (
        !card ||
        !video ||
        video.type !== "group"
    ) {
        return;
    }

    const nameElement =
        card.querySelector(
            ".creator-name"
        );

    const usernameElement =
        card.querySelector(
            ".creator-username"
        );

    const avatarElement =
        card.querySelector(
            ".creator-avatar"
        );


    if (nameElement) {

        nameElement.textContent =
            video.groupName ||
            "VitalStar Group";
    }


    if (usernameElement) {

        usernameElement.textContent =
            "Group";

        usernameElement.style.display =
            "block";
    }


    if (avatarElement) {

        if (video.groupPhoto) {

            avatarElement.innerHTML = `

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

            `;

        } else {

            avatarElement.innerHTML = `

                <div class="default-avatar">
                    VS
                </div>

            `;
        }
    }
}


// ============================================================
// LOAD ALL GROUP INFORMATION
// ============================================================

async function loadAllGroupInformation() {

    if (
        !groupPosts.length
    ) {
        return;
    }

    const videos =
        [...groupPosts];

    await Promise.allSettled(
        videos.map(
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

    const merged = [
        ...normalPosts,
        ...groupPosts
    ];

    const unique =
        new Map();

    for (
        const item of merged
    ) {

        if (!item.video) {
            continue;
        }

        if (
            !unique.has(item.id)
        ) {

            unique.set(
                item.id,
                item
            );
        }
    }

    return Array.from(
        unique.values()
    ).sort(
        (a, b) =>
            b.createdAt -
            a.createdAt
    );
}


// ============================================================
// INIT
// ============================================================

export function init(
    options = {}
) {

    destroyed = false;

    container =
        options.container ||
        document.querySelector(
            "#realsFeed"
        ) ||
        document.querySelector(
            ".reals-feed"
        );

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

export function initGeneralVids(
    options = {}
) {

    return init(
        options
    );
}


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

function initializeFeed() {

    if (
        !container ||
        destroyed
    ) {
        return;
    }

    normalLoaded = false;
    groupsLoaded = false;

    normalPosts = [];
    groupPosts = [];

    showLoading();

    cleanupListeners();


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
                        docSnap => {

                            const data =
                                docSnap.data();

                            if (
                                isPublicNormalVideo(
                                    data
                                )
                            ) {

                                normalPosts.push(
                                    normalizeNormalPost(
                                        docSnap.id,
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
    // ALL GROUP POSTS
    //
    // groups/{groupId}/posts/{postId}
    //
    // We intentionally do not require createdAt in Firestore.
    // Everything is loaded and sorted locally.
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
                        docSnap => {

                            const data =
                                docSnap.data();


                            // --------------------------------
                            // ONLY VIDEO GROUP POSTS
                            // --------------------------------

                            if (
                                !isGroupVideo(
                                    data
                                )
                            ) {
                                return;
                            }


                            // --------------------------------
                            // FIND GROUP ID
                            //
                            // Expected:
                            //
                            // groups/{groupId}/posts/{postId}
                            // --------------------------------

                            const path =
                                docSnap.ref.path
                                    .split("/");


                            const groupIndex =
                                path.indexOf(
                                    "groups"
                                );


                            let groupId =
                                "";


                            if (
                                groupIndex !== -1
                            ) {

                                groupId =
                                    path[
                                        groupIndex + 1
                                    ] || "";
                            }


                            if (!groupId) {

                                console.warn(
                                    "VitalStar Reals: group ID not found:",
                                    docSnap.ref.path
                                );

                                return;
                            }


                            const groupVideo =
                                normalizeGroupPost(
                                    docSnap.id,
                                    data,
                                    groupId
                                );


                            if (
                                groupVideo.video
                            ) {

                                groupPosts.push(
                                    groupVideo
                                );
                            }
                        }
                    );


                    // --------------------------------
                    // SORT NEWEST FIRST
                    // --------------------------------

                    groupPosts.sort(
                        (a, b) =>
                            b.createdAt -
                            a.createdAt
                    );


                    console.log(
                        `VitalStar Reals: ${groupPosts.length} group video(s) loaded.`
                    );


                    groupsLoaded = true;

                    rebuildFeed();


                    // --------------------------------
                    // LOAD GROUP NAME + PHOTO
                    // AFTER THE VIDEOS ARE RENDERED
                    // --------------------------------

                    await loadAllGroupInformation();

                },

                error => {

                    console.error(
                        "VitalStar group Reals error:",
                        error
                    );

                    groupsLoaded = true;

                    rebuildFeed();

                    if (
                        !normalLoaded &&
                        !normalPosts.length
                    ) {

                        showError(
                            getFirebaseErrorMessage(
                                error
                            )
                        );
                    }
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
// FIREBASE ERROR MESSAGE
// ============================================================

function getFirebaseErrorMessage(
    error
) {

    const code =
        error?.code || "";


    if (
        code.includes(
            "failed-precondition"
        )
    ) {

        return "A Firestore index is required for the General Reals feed.";
    }


    if (
        code.includes(
            "permission-denied"
        )
    ) {

        return "Firebase permission rules are preventing the videos from loading.";
    }


    if (
        code.includes(
            "unavailable"
        )
    ) {

        return "Firebase is temporarily unavailable. Check your internet connection.";
    }


    if (
        code.includes(
            "unauthenticated"
        )
    ) {

        return "Please sign in to VitalStar and try again.";
    }


    return "The videos could not be loaded. Please try again.";
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


    if (
        !currentVideos.length
    ) {

        showEmpty();

        return;
    }


    renderFeed();
}


// ============================================================
// RENDER
// ============================================================

function renderFeed() {

    if (
        !container ||
        destroyed
    ) {
        return;
    }


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


    setupObserver(
        feed
    );

    setupVideoBehavior(
        feed
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


    // ========================================================
    // IDENTITY
    // ========================================================

    const isGroup =
        video.type === "group";


    const creatorName =
        escapeHTML(
            isGroup
                ? (
                    video.groupName ||
                    "VitalStar Group"
                )
                : (
                    video.creatorName ||
                    "VitalStar User"
                )
        );


    const username =
        isGroup

            ? "Group"

            : (
                video.username
                    ? `@${escapeHTML(
                        video.username
                    )}`
                    : ""
            );


    const caption =
        escapeHTML(
            video.text || ""
        );


    const photo =
        isGroup
            ? (
                video.groupPhoto ||
                ""
            )
            : (
                video.creatorPhoto ||
                ""
            );


    // ========================================================
    // PROFILE / GROUP AVATAR
    // ========================================================

    const avatar =
        photo

            ? `
                <img
                    src="${escapeHTML(
                        photo
                    )}"
                    alt="${creatorName}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                >
            `

            : `
                <div class="default-avatar">
                    VS
                </div>
            `;


    const sourceLabel =
        isGroup
            ? "Group"
            : "Post";


    const muted =
        settings.muted
            ? "muted"
            : "";


    const autoplay =
        settings.autoplay
            ? "autoplay"
            : "";


    const preload =
        settings.dataSaver
            ? "metadata"
            : "auto";


    card.innerHTML = `

        <video
            class="reals-video"
            src="${escapeHTML(
                video.video
            )}"
            playsinline
            webkit-playsinline
            ${autoplay}
            ${muted}
            preload="${preload}"
        ></video>


        <div class="video-top-gradient"></div>

        <div class="video-bottom-gradient"></div>


        <button
            class="video-play-indicator"
            type="button"
            aria-label="Play or pause"
        >
            ▶
        </button>


        <!-- RIGHT ACTIONS -->

        <div class="video-actions">

            <button
                class="reals-action like-action"
                type="button"
                data-action="like"
                aria-label="Like"
            >
                <span class="action-icon">
                    ♡
                </span>

                <span class="action-count">
                    ${formatCount(
                        video.likes
                    )}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="comment"
                aria-label="Comments"
            >
                <span class="action-icon">
                    💬
                </span>

                <span class="action-count">
                    ${formatCount(
                        video.comments
                    )}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="repost"
                aria-label="Repost"
            >
                <span class="action-icon">
                    ↻
                </span>

                <span class="action-count">
                    ${formatCount(
                        video.reposts
                    )}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="share"
                aria-label="Share"
            >
                <span class="action-icon">
                    ↗
                </span>

                <span class="action-count">
                    ${formatCount(
                        video.shares
                    )}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="mute"
                aria-label="Mute"
            >
                <span class="action-icon mute-icon">
                    ${settings.muted
                        ? "🔇"
                        : "🔊"}
                </span>
            </button>


            <button
                class="reals-action"
                type="button"
                data-action="more"
                aria-label="More"
            >
                <span class="action-icon">
                    •••
                </span>
            </button>

        </div>


        <!-- CREATOR / GROUP INFORMATION -->

        <div class="video-info">

            <div class="video-source-label">
                ${sourceLabel}
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
                    aria-label="${
                        isGroup
                            ? "Open group"
                            : "Open profile"
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
                        aria-label="${
                            isGroup
                                ? "Open group"
                                : "Open profile"
                        }"
                    >

                        <span class="creator-name">
                            ${creatorName}
                        </span>

                    </button>


                    ${
                        username
                            ? `
                                <div class="creator-username">
                                    ${username}
                                </div>
                            `
                            : ""
                    }

                </div>

            </div>


            ${
                caption
                    ? `
                        <div class="video-caption">
                            ${caption}
                        </div>
                    `
                    : ""
            }

        </div>

    `;


    card.addEventListener(
        "click",
        event => {

            const actionButton =
                event.target.closest(
                    "[data-action]"
                );


            if (!actionButton) {
                return;
            }


            const action =
                actionButton.dataset.action;


            handleAction(
                action,
                video,
                card
            );
        }
    );


    return card;
}


// ============================================================
// FORMAT COUNT
// ============================================================

function formatCount(
    number
) {

    number =
        Number(number) || 0;


    if (
        number >= 1000000
    ) {

        return (
            (
                number / 1000000
            )
                .toFixed(1)
                .replace(".0", "")
            + "M"
        );
    }


    if (
        number >= 1000
    ) {

        return (
            (
                number / 1000
            )
                .toFixed(1)
                .replace(".0", "")
            + "K"
        );
    }


    return String(
        number
    );
}


// ============================================================
// VIDEO BEHAVIOR
// ============================================================

function setupVideoBehavior(
    feed
) {

    const videos =
        feed.querySelectorAll(
            ".reals-video"
        );


    videos.forEach(
        video => {

            video.addEventListener(
                "play",
                () => {

                    video
                        .closest(
                            ".reals-video-card"
                        )
                        ?.classList.add(
                            "is-playing"
                        );
                }
            );


            video.addEventListener(
                "pause",
                () => {

                    video
                        .closest(
                            ".reals-video-card"
                        )
                        ?.classList.remove(
                            "is-playing"
                        );
                }
            );


            video.addEventListener(
                "error",
                () => {

                    console.warn(
                        "VitalStar Reals video failed:",
                        video.src
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
// INTERSECTION OBSERVER
// ============================================================

function setupObserver(
    feed
) {

    if (
        !(
            "IntersectionObserver"
            in window
        )
    ) {

        const firstVideo =
            feed.querySelector(
                ".reals-video"
            );


        if (
            firstVideo &&
            settings.autoplay
        ) {

            playVideo(
                firstVideo
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
                            entry.intersectionRatio >= 0.65
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
                    0.65,
                    0.9
                ]
            }
        );


    feed
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            video => {

                observer.observe(
                    video
                );
            }
        );
}


// ============================================================
// PLAY VIDEO
// ============================================================

function playVideo(
    video
) {

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


    if (
        settings.muted
    ) {

        video.muted =
            true;
    }


    const promise =
        video.play();


    if (
        promise &&
        typeof promise.catch ===
            "function"
    ) {

        promise.catch(
            () => {
                // Browser autoplay restriction.
            }
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

    switch (action) {

        case "like":
            handleLike(card);
            break;

        case "comment":
            handleComment(video);
            break;

        case "repost":
            handleRepost(video);
            break;

        case "share":
            handleShare(video);
            break;

        case "mute":
            toggleMute(
                video,
                card
            );
            break;

        case "profile":
            openProfile(video);
            break;

        case "group":
            openGroup(video);
            break;

        case "more":
            showMoreMenu(video);
            break;
    }
}


// ============================================================
// LIKE
// ============================================================

function handleLike(
    card
) {

    const button =
        card.querySelector(
            ".like-action"
        );


    if (!button) return;


    const icon =
        button.querySelector(
            ".action-icon"
        );


    const count =
        button.querySelector(
            ".action-count"
        );


    const active =
        button.classList.toggle(
            "liked"
        );


    if (icon) {

        icon.textContent =
            active
                ? "♥"
                : "♡";
    }


    if (count) {

        const current =
            Number(
                count.dataset.value ||
                count.textContent.replace(
                    /[^\d]/g,
                    ""
                ) ||
                0
            );


        const next =
            Math.max(
                0,
                current +
                (
                    active
                        ? 1
                        : -1
                )
            );


        count.dataset.value =
            String(next);


        count.textContent =
            formatCount(
                next
            );
    }
}


// ============================================================
// COMMENTS
// ============================================================

function handleComment(
    video
) {

    if (
        video.type === "group"
    ) {

        window.location.href =
            `../group.html?id=${
                encodeURIComponent(
                    video.groupId
                )
            }&post=${
                encodeURIComponent(
                    video.originalId
                )
            }`;

        return;
    }


    window.location.href =
        `../post.html?id=${
            encodeURIComponent(
                video.originalId
            )
        }`;
}


// ============================================================
// REPOST
// ============================================================

function handleRepost(
    video
) {

    showToast(
        "Repost selected"
    );
}


// ============================================================
// SHARE
// ============================================================

async function handleShare(
    video
) {

    const url =
        new URL(
            window.location.href
        );


    url.searchParams.set(
        "video",
        video.originalId
    );


    const shareData = {

        title:
            "VitalStar Reals",

        text:
            video.text ||
            `Watch ${
                video.creatorName
            }'s video on VitalStar.`,

        url:
            url.toString()
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


        if (
            navigator.clipboard
        ) {

            await navigator.clipboard.writeText(
                url.toString()
            );


            showToast(
                "Video link copied"
            );

            return;
        }

    } catch (error) {

        if (
            error?.name !==
            "AbortError"
        ) {

            console.warn(
                "Share failed:",
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
        card.querySelector(
            ".reals-video"
        );


    if (!element) return;


    element.muted =
        !element.muted;


    settings.muted =
        element.muted;


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(
            settings.muted
        )
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

function openProfile(
    video
) {

    if (
        !video.creatorId
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
// GROUP
// ============================================================

function openGroup(
    video
) {

    if (
        !video ||
        video.type !== "group" ||
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

function showMoreMenu(
    video
) {

    const choice =
        window.confirm(
            video.type === "group"
                ? "Open this group?"
                : "Open this creator's profile?"
        );


    if (!choice) {
        return;
    }


    if (
        video.type === "group"
    ) {

        openGroup(
            video
        );

        return;
    }


    if (
        video.creatorId
    ) {

        openProfile(
            video
        );
    }
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message
) {

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
            2200
        );
}


// ============================================================
// SETTINGS
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
        String(
            settings.autoplay
        )
    );


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(
            settings.muted
        )
    );


    localStorage.setItem(
        "vitalstar_reals_dataSaver",
        String(
            settings.dataSaver
        )
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
// DESTROY
// ============================================================

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

        * {
            box-sizing: border-box;
        }


        .general-reals-feed {

            width: 100%;
            height: 100%;

            overflow-y: auto;
            overflow-x: hidden;

            scroll-snap-type: y mandatory;

            background:
                #050914;

            scrollbar-width: none;

            padding:
                2dvh 0;
        }


        .general-reals-feed::-webkit-scrollbar {
            display: none;
        }


        .reals-video-card {

            position: relative;

            width: 100%;

            height: 94dvh;
            min-height: 0;

            margin-bottom: 2dvh;

            overflow: hidden;

            background:
                #050914;

            border-radius: 10px;

            scroll-snap-align: center;
            scroll-snap-stop: always;
        }


        .reals-video {

            position: absolute;

            inset: 0;

            width: 100%;
            height: 100%;

            object-fit: cover;

            background:
                #050914;
        }


        .video-top-gradient {

            position: absolute;

            top: 0;
            left: 0;
            right: 0;

            height: 16%;

            pointer-events: none;

            background:
                linear-gradient(
                    to bottom,
                    rgba(0,0,0,.48),
                    transparent
                );
        }


        .video-bottom-gradient {

            position: absolute;

            left: 0;
            right: 0;
            bottom: 0;

            height: 42%;

            pointer-events: none;

            background:
                linear-gradient(
                    to top,
                    rgba(0,0,0,.78),
                    rgba(0,0,0,.28),
                    transparent
                );
        }


        .video-play-indicator {

            position: absolute;

            top: 50%;
            left: 50%;

            transform:
                translate(
                    -50%,
                    -50%
                );

            width: 54px;
            height: 54px;

            border: 0;
            border-radius: 50%;

            background:
                rgba(
                    5,
                    9,
                    20,
                    .64
                );

            color: white;

            font-size: 21px;

            display: flex;
            align-items: center;
            justify-content: center;

            opacity: 0;

            pointer-events: none;

            transition:
                opacity .2s ease;
        }


        .reals-video-card:not(.is-playing)
        .video-play-indicator {

            opacity: .82;
        }


        .video-info {

            position: absolute;

            left: 13px;
            right: 72px;
            bottom: 20px;

            z-index: 5;
        }


        .video-source-label {

            display: inline-flex;

            align-items: center;
            justify-content: center;

            width: fit-content;

            margin-bottom: 7px;

            padding:
                4px 8px;

            border-radius: 13px;

            background:
                rgba(
                    8,
                    15,
                    35,
                    .78
                );

            border:
                1px solid
                rgba(
                    100,
                    150,
                    255,
                    .22
                );

            color:
                #e9efff;

            font-size: 9px;

            font-weight: 650;

            letter-spacing: .2px;
        }


        .creator-row {

            display: flex;

            align-items: center;

            gap: 8px;
        }


        .creator-avatar {

            width: 38px;
            height: 38px;

            padding: 0;

            border:
                1px solid
                rgba(
                    255,
                    255,
                    255,
                    .28
                );

            border-radius: 50%;

            overflow: hidden;

            background:
                #101a35;

            flex-shrink: 0;

            cursor: pointer;
        }


        .creator-avatar img {

            width: 100%;
            height: 100%;

            object-fit: cover;

            display: block;
        }


        .default-avatar {

            width: 100%;
            height: 100%;

            display: flex;
            align-items: center;
            justify-content: center;

            background:
                linear-gradient(
                    135deg,
                    #1d4ed8,
                    #6d28d9
                );

            color: white;

            font-weight: 800;

            font-size: 12px;
        }


        .creator-details {

            min-width: 0;

            flex: 1;
        }


        .creator-name-button {

            display: inline-flex;

            align-items: center;

            max-width: 100%;

            padding: 0;

            margin: 0;

            border: 0;

            background: transparent;

            color: white;

            cursor: pointer;

            text-align: left;
        }


        .creator-name {

            color: white;

            font-size: 13px;

            font-weight: 650;

            white-space: nowrap;

            overflow: hidden;

            text-overflow: ellipsis;
        }


        .creator-username {

            margin-top: 1px;

            color:
                rgba(
                    255,
                    255,
                    255,
                    .68
                );

            font-size: 10px;
        }


        .video-caption {

            margin-top: 7px;

            color:
                rgba(
                    255,
                    255,
                    255,
                    .91
                );

            font-size: 12.5px;

            line-height: 1.38;

            max-width: 100%;

            word-break: break-word;
        }


        .video-actions {

            position: absolute;

            right: 7px;
            bottom: 74px;

            z-index: 10;

            display: flex;

            flex-direction: column;

            align-items: center;

            gap: 9px;
        }


        .reals-action {

            width: 40px;
            min-height: 40px;

            padding: 2px;

            border: 0;

            background:
                transparent;

            color: white;

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

            gap: 2px;
        }


        .action-icon {

            font-size: 20px;

            line-height: 1;

            text-shadow:
                0 1px 3px
                rgba(
                    0,
                    0,
                    0,
                    .65
                );
        }


        .action-count {

            color:
                rgba(
                    255,
                    255,
                    255,
                    .84
                );

            font-size: 9px;

            font-weight: 650;
        }


        .like-action.liked
        .action-icon {

            color:
                #ff4f7b;
        }


        .general-loading {

            width: 100%;

            height: 100dvh;

            min-height: 100vh;

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

            background:
                #050914;

            color: white;
        }


        .vs-loader {

            position: relative;

            width: 68px;
            height: 68px;

            display: flex;

            align-items: center;

            justify-content: center;
        }


        .vs-ring {

            position: absolute;

            inset: 0;

            border-radius: 50%;

            border:
                3px solid
                rgba(
                    255,
                    255,
                    255,
                    .10
                );

            border-top-color:
                #3b82f6;

            border-right-color:
                #8b5cf6;

            animation:
                vitalstarSpin
                1s linear infinite;
        }


        .vs-logo {

            width: 42px;
            height: 42px;

            border-radius: 50%;

            display: flex;

            align-items: center;

            justify-content: center;

            background:
                linear-gradient(
                    135deg,
                    #123b8f,
                    #54209a
                );

            color: white;

            font-size: 13px;

            font-weight: 900;
        }


        .vs-loading-title {

            margin-top: 18px;

            font-size: 15px;

            font-weight: 650;

            color: white;
        }


        .vs-loading-text {

            margin-top: 6px;

            color:
                rgba(
                    255,
                    255,
                    255,
                    .52
                );

            font-size: 11px;
        }


        .general-empty,
        .general-error {

            width: 100%;

            height: 100dvh;

            min-height: 100vh;

            padding: 20px;

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

            text-align: center;

            background:
                #050914;

            color: white;
        }


        .empty-icon,
        .error-icon {

            width: 56px;
            height: 56px;

            border-radius: 50%;

            display: flex;

            align-items: center;

            justify-content: center;

            background:
                #101a35;

            border:
                1px solid
                rgba(
                    100,
                    150,
                    255,
                    .22
                );

            font-size: 21px;

            font-weight: 750;
        }


        .error-icon {

            color:
                #ff7b91;
        }


        .empty-title,
        .error-title {

            margin-top: 15px;

            font-size: 17px;

            font-weight: 750;
        }


        .empty-text,
        .error-message {

            margin-top: 7px;

            max-width: 300px;

            color:
                rgba(
                    255,
                    255,
                    255,
                    .56
                );

            font-size: 12px;

            line-height: 1.45;
        }


        .retry-button {

            margin-top: 17px;

            padding:
                9px 18px;

            border: 0;

            border-radius: 20px;

            background:
                linear-gradient(
                    135deg,
                    #2563eb,
                    #6d28d9
                );

            color: white;

            font-size: 12px;

            font-weight: 650;
        }


        .vitalstar-reals-toast {

            position: fixed;

            left: 50%;

            bottom: 24px;

            transform:
                translate(
                    -50%,
                    20px
                );

            z-index: 99999;

            padding:
                9px 14px;

            border-radius: 20px;

            background:
                rgba(
                    10,
                    17,
                    36,
                    .94
                );

            border:
                1px solid
                rgba(
                    100,
                    150,
                    255,
                    .22
                );

            color: white;

            font-size: 12px;

            opacity: 0;

            pointer-events: none;

            transition:
                opacity .2s ease,
                transform .2s ease;
        }


        .vitalstar-reals-toast.show {

            opacity: 1;

            transform:
                translate(
                    -50%,
                    0
                );
        }


        @keyframes vitalstarSpin {

            to {

                transform:
                    rotate(360deg);
            }
        }


        @media (
            max-width: 480px
        ) {

            .general-reals-feed {

                padding:
                    1.5dvh 0;
            }


            .reals-video-card {

                height: 94dvh;

                margin-bottom:
                    1.5dvh;

                border-radius:
                    8px;
            }


            .video-info {

                bottom: 18px;

                left: 11px;

                right: 68px;
            }


            .video-actions {

                right: 5px;

                bottom: 70px;

                gap: 7px;
            }


            .reals-action {

                width: 38px;

                min-height: 38px;
            }


            .action-icon {

                font-size: 19px;
            }


            .action-count {

                font-size: 8px;
            }


            .video-source-label {

                margin-bottom: 6px;

                font-size: 9px;

                padding:
                    4px 8px;
            }


            .creator-avatar {

                width: 36px;
                height: 36px;
            }


            .creator-name {

                font-size: 12.5px;
            }


            .creator-username {

                font-size: 9.5px;
            }


            .video-caption {

                margin-top: 6px;

                font-size: 12px;

                line-height: 1.35;
            }


            .video-play-indicator {

                width: 50px;
                height: 50px;

                font-size: 19px;
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