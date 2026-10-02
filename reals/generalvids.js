// ============================================================
// VITALSTAR — GENERAL REELS
// ============================================================
// PUBLIC NORMAL POST VIDEOS + GROUP VIDEOS
// Firebase v10.12.2
// ============================================================

import { db } from "../firebase.js";

import {
    collection,
    collectionGroup,
    query,
    limit,
    onSnapshot,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// SETTINGS
// ============================================================

let settings = {
    autoplay: true,
    muted: true,
    dataSaver: false
};


// ============================================================
// STATE
// ============================================================

let container = null;

let normalUnsubscribe = null;
let groupUnsubscribe = null;

let observer = null;

let normalPosts = [];
let groupPosts = [];

let currentVideos = [];

let normalLoaded = false;
let groupLoaded = false;

let normalError = null;
let groupError = null;

let initialized = false;


// ============================================================
// SETTINGS
// ============================================================

function getSettings() {

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
// HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getTimestamp(value) {

    if (!value) return 0;

    if (
        typeof value.toMillis === "function"
    ) {
        return value.toMillis();
    }

    if (
        typeof value.seconds === "number"
    ) {
        return value.seconds * 1000;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === "number") {
        return value;
    }

    return 0;
}


function formatCount(value) {

    const number =
        Number(value || 0);

    if (number >= 1000000) {

        return (
            number / 1000000
        )
            .toFixed(1)
            .replace(".0", "") + "M";
    }

    if (number >= 1000) {

        return (
            number / 1000
        )
            .toFixed(1)
            .replace(".0", "") + "K";
    }

    return String(number);
}


function getPlayableVideoUrl(url) {

    if (!url) return "";

    return String(url).trim();
}


// ============================================================
// NORMAL POST VIDEO
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
            data.privacy ||
            data.visibility ||
            "Public"
        )
            .trim()
            .toLowerCase();

    if (
        privacy === "friends" ||
        privacy === "friend" ||
        privacy === "only me" ||
        privacy === "onlyme" ||
        privacy === "private"
    ) {
        return false;
    }

    return true;
}


// ============================================================
// GROUP VIDEO
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

    return (
        mediaType === "video" ||
        mediaType.startsWith("video/")
    );
}


// ============================================================
// NORMAL POST
// ============================================================

function normalizeNormalPost(docSnap) {

    const data =
        docSnap.data() || {};

    if (
        !isPublicNormalVideo(data)
    ) {
        return null;
    }

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    return {

        id:
            "post_" +
            docSnap.id,

        type:
            "post",

        postId:
            docSnap.id,

        video:
            getPlayableVideoUrl(video),

        text:
            data.text || "",

        creatorId:
            data.uid ||
            data.userId ||
            data.authorId ||
            data.createdBy ||
            "",

        creatorName:
            data.fullName ||
            data.displayName ||
            data.name ||
            data.username ||
            "VitalStar User",

        username:
            data.username ||
            "",

        creatorPhoto:
            data.profilePicture ||
            data.profilePhoto ||
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
// GROUP ID
// ============================================================

function getGroupId(docSnap) {

    try {

        // Expected:
        // groups/{groupId}/posts/{postId}

        const parent =
            docSnap.ref.parent;

        if (
            parent &&
            parent.parent &&
            parent.parent.id
        ) {

            return parent.parent.id;
        }

    } catch (error) {

        console.warn(
            "Group parent lookup failed:",
            error
        );
    }


    try {

        const parts =
            docSnap.ref.path.split("/");

        const index =
            parts.indexOf("groups");

        if (
            index !== -1 &&
            parts[index + 1]
        ) {

            return parts[index + 1];
        }

    } catch (error) {

        console.warn(
            "Group path lookup failed:",
            error
        );
    }


    return "";
}


// ============================================================
// GROUP POST
// ============================================================

function normalizeGroupPost(docSnap) {

    const data =
        docSnap.data() || {};

    if (
        !isGroupVideo(data)
    ) {
        return null;
    }

    const groupId =
        getGroupId(docSnap);

    if (!groupId) {

        console.warn(
            "Skipped group video because group ID was missing:",
            docSnap.ref.path
        );

        return null;
    }


    return {

        id:
            "group_" +
            groupId +
            "_" +
            docSnap.id,

        type:
            "group",

        postId:
            docSnap.id,

        groupId:
            groupId,

        video:
            getPlayableVideoUrl(
                data.mediaURL ||
                data.video ||
                data.videoUrl ||
                data.videoURL
            ),

        text:
            data.text || "",

        // Original poster information is kept
        // internally but is NOT shown as the source.
        creatorId:
            data.authorId || "",

        creatorName:
            data.authorName || "",

        creatorPhoto:
            data.authorPhotoURL || "",

        groupName:
            "VitalStar Group",

        groupPhoto:
            "",

        createdAt:
            getTimestamp(
                data.createdAt
            ),

        likes:
            Number(
                data.likesCount || 0
            ),

        comments:
            Number(
                data.commentsCount || 0
            ),

        reposts:
            Number(
                data.repostsCount || 0
            ),

        shares:
            Number(
                data.sharesCount || 0
            )
    };
}


// ============================================================
// LOAD GROUP INFO
// ============================================================

async function loadGroupInfo(video) {

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


        const snap =
            await getDoc(
                groupRef
            );


        if (!snap.exists()) {

            console.warn(
                "Group not found:",
                video.groupId
            );

            return;
        }


        const data =
            snap.data() || {};


        video.groupName =
            data.name ||
            data.groupName ||
            data.title ||
            data.displayName ||
            "VitalStar Group";


        video.groupPhoto =
            data.profilePicture ||
            data.profilePhoto ||
            data.photoURL ||
            data.avatar ||
            data.groupImage ||
            data.image ||
            "";


    } catch (error) {

        console.warn(
            "Could not load group information:",
            video.groupId,
            error
        );
    }
}


// ============================================================
// LOAD GROUP INFORMATION AFTER RENDER
// ============================================================

async function updateGroupInformation() {

    const groups =
        new Map();


    currentVideos.forEach(
        video => {

            if (
                video.type === "group" &&
                video.groupId
            ) {

                if (
                    !groups.has(
                        video.groupId
                    )
                ) {

                    groups.set(
                        video.groupId,
                        video
                    );
                }
            }
        }
    );


    if (!groups.size) {
        return;
    }


    await Promise.all(
        Array.from(
            groups.values()
        ).map(
            video =>
                loadGroupInfo(video)
        )
    );


    if (!container) {
        return;
    }


    currentVideos.forEach(
        (video, index) => {

            if (
                video.type !== "group"
            ) {
                return;
            }


            const card =
                container.querySelector(
                    `.reals-video-card[data-index="${index}"]`
                );


            if (!card) {
                return;
            }


            const name =
                card.querySelector(
                    ".reals-name-button"
                );


            if (name) {

                name.textContent =
                    video.groupName ||
                    "VitalStar Group";
            }


            const avatar =
                card.querySelector(
                    ".reals-profile-button"
                );


            if (!avatar) {
                return;
            }


            if (video.groupPhoto) {

                avatar.innerHTML = `

                    <img
                        src="${escapeHTML(
                            video.groupPhoto
                        )}"
                        alt=""
                        class="reals-avatar"
                    >

                `;

            } else {

                avatar.innerHTML = `

                    <div class="reals-avatar-fallback">
                        👥
                    </div>

                `;
            }

        }
    );
}


// ============================================================
// BUILD FEED
// ============================================================

function rebuildFeed() {

    if (!container) {
        return;
    }


    currentVideos = [
        ...normalPosts,
        ...groupPosts
    ];


    // Remove duplicates.

    const unique =
        new Map();


    currentVideos.forEach(
        video => {

            if (
                video &&
                video.video
            ) {

                unique.set(
                    video.id,
                    video
                );
            }
        }
    );


    currentVideos =
        Array.from(
            unique.values()
        );


    // Newest first.

    currentVideos.sort(
        (a, b) =>
            b.createdAt -
            a.createdAt
    );


    // ========================================================
    // IMPORTANT:
    // Render whenever at least one source has loaded.
    // A group Firebase problem must NEVER block normal posts.
    // ========================================================

    const somethingLoaded =
        normalLoaded ||
        groupLoaded;


    if (
        !somethingLoaded
    ) {

        showLoading();

        return;
    }


    if (
        currentVideos.length === 0
    ) {

        // Only show the empty state after both
        // listeners have actually finished.

        if (
            normalLoaded &&
            groupLoaded
        ) {

            showEmpty();

        } else {

            showLoading();
        }

        return;
    }


    renderFeed();


    // Load group names/photos after videos
    // are already visible.

    updateGroupInformation();
}


// ============================================================
// LOADING
// ============================================================

function showLoading() {

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="reals-loading">

            <div class="vs-loader">

                <div class="vs-ring"></div>

                <div class="vs-logo">
                    VS
                </div>

            </div>

            <div class="vs-loading-text">
                Loading VitalStar...
            </div>

        </div>
    `;
}


// ============================================================
// EMPTY
// ============================================================

function showEmpty() {

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="reals-empty">

            <div class="empty-icon">
                🎬
            </div>

            <h3>
                No public videos yet
            </h3>

            <p>
                Videos from VitalStar posts and groups
                will appear here.
            </p>

        </div>
    `;
}


// ============================================================
// ERROR
// ============================================================

function showError(message) {

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="reals-empty">

            <div class="empty-icon">
                ⚠️
            </div>

            <h3>
                Couldn't load Reals
            </h3>

            <p>
                ${escapeHTML(
                    message ||
                    "Please try again."
                )}
            </p>

            <button
                id="realsRetry"
                class="reals-retry"
                type="button"
            >
                Retry
            </button>

        </div>
    `;


    document
        .getElementById(
            "realsRetry"
        )
        ?.addEventListener(
            "click",
            () => {

                destroyGeneralVids();

                init(container);
            }
        );
}


// ============================================================
// RENDER
// ============================================================

function renderFeed() {

    if (!container) {
        return;
    }


    if (!currentVideos.length) {
        showEmpty();
        return;
    }


    container.innerHTML = "";


    currentVideos.forEach(
        (video, index) => {

            container.appendChild(
                createVideoCard(
                    video,
                    index
                )
            );
        }
    );


    setupVideoBehavior();

    setupObserver();
}


// ============================================================
// CREATE VIDEO CARD
// ============================================================

function createVideoCard(
    video,
    index
) {

    const card =
        document.createElement(
            "section"
        );


    card.className =
        "reals-video-card";


    card.dataset.index =
        String(index);


    card.dataset.type =
        video.type;


    card.dataset.id =
        video.id;


    const isGroup =
        video.type === "group";


    // ========================================================
    // SOURCE IDENTITY
    // ========================================================

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


    const safeName =
        escapeHTML(name);


    const safePhoto =
        escapeHTML(photo || "");


    const avatar =
        safePhoto

            ? `

                <img
                    src="${safePhoto}"
                    alt=""
                    class="reals-avatar"
                    loading="lazy"
                >

            `

            : `

                <div class="reals-avatar-fallback">
                    ${
                        isGroup
                            ? "👥"
                            : "VS"
                    }
                </div>

            `;


    const sourceAction =
        isGroup
            ? "openGroup"
            : "openProfile";


    card.innerHTML = `

        <video
            class="reals-video"
            src="${escapeHTML(
                video.video
            )}"
            playsinline
            loop
            preload="${
                settings.dataSaver
                    ? "metadata"
                    : "auto"
            }"
            ${
                settings.muted
                    ? "muted"
                    : ""
            }
        ></video>


        <div class="reals-top-gradient"></div>

        <div class="reals-bottom-gradient"></div>


        <button
            class="reals-play-button"
            type="button"
            aria-label="Play video"
        >
            ▶
        </button>


        <div class="reals-video-info">

            <div class="reals-source">

                <button
                    class="reals-profile-button"
                    data-action="${sourceAction}"
                    type="button"
                    aria-label="${
                        isGroup
                            ? "Open group"
                            : "Open user profile"
                    }"
                >

                    ${avatar}

                </button>


                <button
                    class="reals-name-button"
                    data-action="${sourceAction}"
                    type="button"
                >

                    ${safeName}

                </button>

            </div>


            ${
                video.text

                    ? `

                        <div class="reals-caption">
                            ${escapeHTML(
                                video.text
                            )}
                        </div>

                    `

                    : ""
            }

        </div>


        <div class="reals-actions">

            <button
                class="reals-action"
                data-action="like"
                type="button"
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
                data-action="comment"
                type="button"
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
                data-action="repost"
                type="button"
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
                data-action="share"
                type="button"
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
                data-action="mute"
                type="button"
            >
                <span class="action-icon">
                    ${
                        settings.muted
                            ? "🔇"
                            : "🔊"
                    }
                </span>
            </button>


            <button
                class="reals-action"
                data-action="more"
                type="button"
            >
                <span class="action-icon">
                    •••
                </span>
            </button>

        </div>


        <div class="reals-source-badge">
            ${
                isGroup
                    ? "GROUP"
                    : "POST"
            }
        </div>

    `;


    // ========================================================
    // GROUP CLICK
    // ========================================================

    if (isGroup) {

        card
            .querySelectorAll(
                '[data-action="openGroup"]'
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openGroup(
                                video.groupId
                            );
                        }
                    );
                }
            );

    }


    // ========================================================
    // USER CLICK
    // ========================================================

    else {

        card
            .querySelectorAll(
                '[data-action="openProfile"]'
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openProfile(
                                video.creatorId
                            );
                        }
                    );
                }
            );
    }


    return card;
}


// ============================================================
// VIDEO BEHAVIOR
// ============================================================

function setupVideoBehavior() {

    if (!container) {
        return;
    }


    container
        .querySelectorAll(
            ".reals-video"
        )
        .forEach(
            video => {

                video.addEventListener(
                    "click",
                    () => {

                        if (
                            video.paused
                        ) {

                            video
                                .play()
                                .catch(
                                    () => {}
                                );

                        } else {

                            video.pause();
                        }
                    }
                );


                video.addEventListener(
                    "play",
                    () => {

                        const card =
                            video.closest(
                                ".reals-video-card"
                            );


                        const button =
                            card?.querySelector(
                                ".reals-play-button"
                            );


                        if (button) {
                            button.textContent =
                                "❚❚";
                        }
                    }
                );


                video.addEventListener(
                    "pause",
                    () => {

                        const card =
                            video.closest(
                                ".reals-video-card"
                            );


                        const button =
                            card?.querySelector(
                                ".reals-play-button"
                            );


                        if (button) {
                            button.textContent =
                                "▶";
                        }
                    }
                );
            }
        );


    container
        .querySelectorAll(
            ".reals-play-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        const card =
                            button.closest(
                                ".reals-video-card"
                            );


                        const video =
                            card?.querySelector(
                                ".reals-video"
                            );


                        if (!video) {
                            return;
                        }


                        if (
                            video.paused
                        ) {

                            video
                                .play()
                                .catch(
                                    () => {}
                                );

                        } else {

                            video.pause();
                        }
                    }
                );
            }
        );


    container
        .querySelectorAll(
            ".reals-action"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        const card =
                            button.closest(
                                ".reals-video-card"
                            );


                        if (!card) {
                            return;
                        }


                        const index =
                            Number(
                                card.dataset.index
                            );


                        handleAction(
                            button.dataset.action,
                            currentVideos[index],
                            card
                        );
                    }
                );
            }
        );
}


// ============================================================
// AUTOPLAY OBSERVER
// ============================================================

function setupObserver() {

    if (!container) {
        return;
    }


    if (observer) {
        observer.disconnect();
    }


    observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        const video =
                            entry.target.querySelector(
                                ".reals-video"
                            );


                        if (!video) {
                            return;
                        }


                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= 0.65
                        ) {

                            if (
                                settings.autoplay
                            ) {

                                video
                                    .play()
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
                    0.25,
                    0.65,
                    0.9
                ]
            }
        );


    container
        .querySelectorAll(
            ".reals-video-card"
        )
        .forEach(
            card => {

                observer.observe(
                    card
                );
            }
        );
}


// ============================================================
// ACTIONS
// ============================================================

function handleAction(
    action,
    video,
    card
) {

    if (!video) {
        return;
    }


    switch (action) {

        case "like":
            showToast(
                "Like coming next."
            );
            break;

        case "comment":
            showToast(
                "Comments coming next."
            );
            break;

        case "repost":
            showToast(
                "Repost coming next."
            );
            break;

        case "share":
            handleShare(
                video
            );
            break;

        case "mute":
            toggleMute(
                card
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
// SHARE
// ============================================================

async function handleShare(
    video
) {

    try {

        if (
            navigator.share
        ) {

            await navigator.share({

                title:
                    "VitalStar",

                text:
                    video.text ||
                    "Check out this video on VitalStar.",

                url:
                    window.location.href
            });

        } else {

            await navigator.clipboard.writeText(
                window.location.href
            );

            showToast(
                "Link copied."
            );
        }

    } catch (error) {
        // Sharing cancelled.
    }
}


// ============================================================
// MUTE
// ============================================================

function toggleMute(card) {

    const video =
        card?.querySelector(
            ".reals-video"
        );


    if (!video) {
        return;
    }


    video.muted =
        !video.muted;


    settings.muted =
        video.muted;


    localStorage.setItem(
        "vitalstar_reals_muted",
        String(
            settings.muted
        )
    );


    const icon =
        card.querySelector(
            '[data-action="mute"] .action-icon'
        );


    if (icon) {

        icon.textContent =
            settings.muted
                ? "🔇"
                : "🔊";
    }
}


// ============================================================
// OPEN USER PROFILE
// ============================================================

function openProfile(
    uid
) {

    if (!uid) {

        showToast(
            "User profile unavailable."
        );

        return;
    }


    window.location.href =
        "../profile.html?uid=" +
        encodeURIComponent(uid);
}


// ============================================================
// OPEN GROUP
// ============================================================

function openGroup(
    groupId
) {

    if (!groupId) {

        showToast(
            "Group unavailable."
        );

        return;
    }


    window.location.href =
        "../group.html?id=" +
        encodeURIComponent(groupId);
}


// ============================================================
// MORE
// ============================================================

function showMoreMenu(
    video
) {

    showToast(
        video.type === "group"
            ? "Group video options coming next."
            : "Post video options coming next."
    );
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message
) {

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


        toast.className =
            "reals-toast";


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
    key,
    value
) {

    if (
        key === "autoplay"
    ) {

        settings.autoplay =
            Boolean(value);
    }


    if (
        key === "muted"
    ) {

        settings.muted =
            Boolean(value);


        if (container) {

            container
                .querySelectorAll(
                    ".reals-video"
                )
                .forEach(
                    video => {

                        video.muted =
                            settings.muted;
                    }
                );
        }
    }


    if (
        key === "dataSaver"
    ) {

        settings.dataSaver =
            Boolean(value);
    }
}


// ============================================================
// ERROR MESSAGE
// ============================================================

function getFirebaseErrorMessage(
    error
) {

    if (!error) {
        return "Please try again.";
    }


    if (
        error.code ===
        "permission-denied"
    ) {

        return (
            "Firebase permissions are blocking this feed."
        );
    }


    if (
        error.code ===
        "unavailable"
    ) {

        return (
            "Firebase is temporarily unavailable."
        );
    }


    return (
        error.message ||
        "Please try again."
    );
}


// ============================================================
// INITIALIZE
// ============================================================

export function init(
    target
) {

    if (initialized) {
        return;
    }


    initialized = true;


    getSettings();


    container =
        typeof target === "string"

            ? document.querySelector(
                target
            )

            : target;


    if (!container) {

        console.error(
            "VitalStar Reals container not found."
        );

        initialized = false;

        return;
    }


    normalLoaded = false;
    groupLoaded = false;

    normalError = null;
    groupError = null;

    normalPosts = [];
    groupPosts = [];
    currentVideos = [];


    showLoading();


    // ========================================================
    // NORMAL POSTS
    // ========================================================

    const normalQuery =
        query(
            collection(
                db,
                "posts"
            ),
            limit(500)
        );


    normalUnsubscribe =
        onSnapshot(

            normalQuery,

            snapshot => {

                normalPosts = [];


                snapshot.forEach(
                    docSnap => {

                        const video =
                            normalizeNormalPost(
                                docSnap
                            );


                        if (video) {

                            normalPosts.push(
                                video
                            );
                        }
                    }
                );


                normalPosts.sort(
                    (a, b) =>
                        b.createdAt -
                        a.createdAt
                );


                normalLoaded = true;

                normalError = null;


                // NORMAL VIDEOS CAN NOW SHOW.
                rebuildFeed();
            },


            error => {

                console.error(
                    "VitalStar normal posts error:",
                    error
                );


                normalLoaded = true;

                normalError =
                    error;


                // Do NOT block the group feed.
                rebuildFeed();
            }
        );


    // ========================================================
    // GROUP POSTS
    // ========================================================

    const groupQuery =
        query(
            collectionGroup(
                db,
                "posts"
            ),
            limit(1000)
        );


    groupUnsubscribe =
        onSnapshot(

            groupQuery,

            snapshot => {

                groupPosts = [];


                snapshot.forEach(
                    docSnap => {

                        const video =
                            normalizeGroupPost(
                                docSnap
                            );


                        if (video) {

                            groupPosts.push(
                                video
                            );
                        }
                    }
                );


                groupPosts.sort(
                    (a, b) =>
                        b.createdAt -
                        a.createdAt
                );


                groupLoaded = true;

                groupError = null;


                // Add group videos to whatever
                // is already visible.
                rebuildFeed();
            },


            error => {

                console.error(
                    "VitalStar group posts error:",
                    error
                );


                groupLoaded = true;

                groupError =
                    error;


                // IMPORTANT:
                // A group query failure must NOT
                // stop normal posts from appearing.

                rebuildFeed();
            }
        );
}


// ============================================================
// ALIASES USED BY reals.html
// ============================================================

export function initGeneralVids(
    target
) {
    return init(target);
}


export function initializeFeed(
    target
) {
    return init(target);
}


// ============================================================
// CLEANUP
// ============================================================

export function cleanupListeners() {

    if (normalUnsubscribe) {

        normalUnsubscribe();

        normalUnsubscribe =
            null;
    }


    if (groupUnsubscribe) {

        groupUnsubscribe();

        groupUnsubscribe =
            null;
    }
}


export function disconnectObserver() {

    if (observer) {

        observer.disconnect();

        observer =
            null;
    }
}


export function destroyGeneralVids() {

    cleanupListeners();

    disconnectObserver();


    normalPosts = [];
    groupPosts = [];
    currentVideos = [];


    normalLoaded = false;
    groupLoaded = false;


    normalError = null;
    groupError = null;


    container = null;

    initialized = false;
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

        .reals-video-card{
            position:relative;
            height:94dvh;
            min-height:0;
            margin:1dvh 0;
            overflow:hidden;
            border-radius:13px;
            background:#050914;
            scroll-snap-align:center;
        }


        .reals-video{
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
            background:#050914;
        }


        .reals-top-gradient{
            position:absolute;
            inset:0 0 auto 0;
            height:18%;
            pointer-events:none;
            background:
                linear-gradient(
                    to bottom,
                    rgba(0,0,0,.4),
                    transparent
                );
        }


        .reals-bottom-gradient{
            position:absolute;
            inset:auto 0 0 0;
            height:43%;
            pointer-events:none;
            background:
                linear-gradient(
                    to top,
                    rgba(0,0,0,.84),
                    transparent
                );
        }


        .reals-video-info{
            position:absolute;
            left:11px;
            right:68px;
            bottom:18px;
            z-index:5;
        }


        .reals-source{
            display:flex;
            align-items:center;
            gap:8px;
        }


        .reals-profile-button{
            width:37px;
            height:37px;
            padding:0;
            border:0;
            border-radius:50%;
            overflow:hidden;
            background:#10182c;
            flex-shrink:0;
            cursor:pointer;
        }


        .reals-avatar{
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
        }


        .reals-avatar-fallback{
            width:100%;
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:15px;
            background:#10182c;
            color:#fff;
        }


        .reals-name-button{
            border:0;
            padding:0;
            background:none;
            color:#fff;
            font-size:13px;
            font-weight:600;
            cursor:pointer;
            text-align:left;
            max-width:220px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
        }


        .reals-caption{
            margin-top:6px;
            color:#fff;
            font-size:12px;
            line-height:1.4;
        }


        .reals-actions{
            position:absolute;
            right:6px;
            bottom:68px;
            z-index:8;
            display:flex;
            flex-direction:column;
            gap:7px;
        }


        .reals-action{
            width:39px;
            min-height:39px;
            padding:3px;
            border:0;
            background:rgba(0,0,0,.28);
            color:#fff;
            border-radius:10px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            cursor:pointer;
        }


        .action-icon{
            font-size:19px;
            line-height:1;
        }


        .action-count{
            margin-top:2px;
            font-size:9px;
        }


        .reals-play-button{
            position:absolute;
            left:50%;
            top:50%;
            transform:
                translate(-50%,-50%);
            width:52px;
            height:52px;
            border:0;
            border-radius:50%;
            background:rgba(0,0,0,.45);
            color:#fff;
            font-size:20px;
            z-index:7;
            cursor:pointer;
        }


        .reals-source-badge{
            position:absolute;
            top:11px;
            left:11px;
            z-index:6;
            padding:4px 7px;
            border-radius:7px;
            background:rgba(0,0,0,.42);
            color:#fff;
            font-size:8px;
            font-weight:700;
            letter-spacing:.5px;
        }


        .reals-loading,
        .reals-empty{
            min-height:100dvh;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            text-align:center;
            padding:25px;
            color:#fff;
        }


        .vs-loader{
            position:relative;
            width:60px;
            height:60px;
            display:flex;
            align-items:center;
            justify-content:center;
        }


        .vs-ring{
            position:absolute;
            inset:0;
            border:3px solid
                rgba(40,110,255,.2);
            border-top-color:#2870ff;
            border-radius:50%;
            animation:
                vsSpin 1s linear infinite;
        }


        .vs-logo{
            font-weight:800;
            font-size:17px;
            color:#fff;
        }


        .vs-loading-text{
            margin-top:13px;
            font-size:13px;
        }


        .empty-icon{
            font-size:36px;
            margin-bottom:11px;
        }


        .reals-empty h3{
            margin:0 0 7px;
            font-size:17px;
        }


        .reals-empty p{
            margin:0;
            color:#9ca8c5;
            font-size:12px;
        }


        .reals-retry{
            margin-top:15px;
            padding:9px 15px;
            border:0;
            border-radius:9px;
            background:#286fff;
            color:#fff;
            cursor:pointer;
        }


        .reals-toast{
            position:fixed;
            left:50%;
            bottom:85px;
            transform:
                translate(-50%,20px);
            opacity:0;
            pointer-events:none;
            z-index:99999;
            padding:9px 13px;
            border-radius:9px;
            background:#10182c;
            color:#fff;
            font-size:12px;
            transition:.2s ease;
        }


        .reals-toast.show{
            opacity:1;
            transform:
                translate(-50%,0);
        }


        @keyframes vsSpin{
            to{
                transform:rotate(360deg);
            }
        }

    `;


    document.head.appendChild(
        style
    );
}


// ============================================================
// INITIAL STYLES
// ============================================================

addStyles();


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {

    init,

    initGeneralVids,

    initializeFeed,

    onSettingChange,

    cleanupListeners,

    disconnectObserver,

    destroyGeneralVids

};