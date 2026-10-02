// ============================================================
// VITALSTAR — GENERAL REELS
// ============================================================
// General Reals contains:
//
// 1. Public videos from normal VitalStar posts
// 2. Video posts from all VitalStar groups
//
// GROUP VIDEO:
//    → Shows GROUP name
//    → Shows GROUP profile picture
//    → Tap group name/photo → opens group
//
// NORMAL VIDEO:
//    → Shows USER name
//    → Shows USER profile picture
//    → Tap user name/photo → opens profile
//
// No Follow button.
// Firebase v10.12.2
// ============================================================

import { auth, db } from "../firebase.js";

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

let normalLoaded = false;
let groupLoaded = false;

let normalPosts = [];
let groupPosts = [];

let currentVideos = [];

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
// HTML ESCAPE
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
// TIMESTAMP
// ============================================================

function getTimestamp(value) {

    if (!value) {
        return 0;
    }

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


// ============================================================
// COUNT FORMAT
// ============================================================

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


// ============================================================
// VIDEO URL
// ============================================================

function getPlayableVideoUrl(url) {

    if (!url) {
        return "";
    }

    return String(url).trim();
}


// ============================================================
// NORMAL POST VIDEO CHECK
// ============================================================

function isPublicNormalVideo(data) {

    if (!data) {
        return false;
    }

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    if (!video) {
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

    // Only public videos belong in General Reals.
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
// GROUP VIDEO CHECK
// ============================================================

function isGroupVideo(data) {

    if (!data) {
        return false;
    }

    const mediaType =
        String(
            data.mediaType || ""
        )
            .trim()
            .toLowerCase();

    const mediaURL =
        data.mediaURL ||
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    if (!mediaURL) {
        return false;
    }

    return (
        mediaType === "video" ||
        mediaType.startsWith("video/")
    );
}


// ============================================================
// LOADING SCREEN
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
                class="reals-retry"
                id="realsRetry"
                type="button"
            >
                Retry
            </button>

        </div>
    `;

    document
        .getElementById("realsRetry")
        ?.addEventListener(
            "click",
            () => {

                destroyGeneralVids();

                init(container);
            }
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
            `post_${docSnap.id}`,

        type:
            "post",

        postId:
            docSnap.id,

        video:
            getPlayableVideoUrl(
                video
            ),

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
// EXTRACT GROUP ID
// ============================================================

function getGroupIdFromPost(docSnap) {

    try {

        // groups/{groupId}/posts/{postId}

        const parent =
            docSnap.ref.parent;

        if (
            parent &&
            parent.parent
        ) {

            const groupDocument =
                parent.parent;

            if (
                groupDocument.id
            ) {

                return groupDocument.id;
            }
        }

    } catch (error) {

        console.warn(
            "Group ID parent lookup failed:",
            error
        );
    }


    // Fallback path method.

    try {

        const path =
            docSnap.ref.path.split("/");

        const groupIndex =
            path.indexOf("groups");

        if (
            groupIndex !== -1 &&
            path[groupIndex + 1]
        ) {

            return path[
                groupIndex + 1
            ];
        }

    } catch (error) {

        console.warn(
            "Group ID path lookup failed:",
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
        getGroupIdFromPost(
            docSnap
        );

    if (!groupId) {

        console.warn(
            "Group video has no group ID:",
            docSnap.ref.path
        );

        return null;
    }


    return {

        id:
            `group_${groupId}_${docSnap.id}`,

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

        // Kept internally only.
        // The UI does NOT display this user
        // as the creator of a group video.
        creatorId:
            data.authorId || "",

        creatorName:
            data.authorName ||
            "VitalStar User",

        creatorPhoto:
            data.authorPhotoURL ||
            data.profilePicture ||
            data.photoURL ||
            "",

        authorRole:
            data.authorRole ||
            "",

        // These are filled from the group document.
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
// LOAD GROUP INFORMATION
// ============================================================

async function loadGroupDetails(video) {

    if (
        !video ||
        video.type !== "group" ||
        !video.groupId
    ) {

        return video;
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

            console.warn(
                "Group document not found:",
                video.groupId
            );

            return video;
        }


        const group =
            groupSnap.data() || {};


        // ----------------------------------------------------
        // GROUP NAME
        // ----------------------------------------------------

        video.groupName =
            group.name ||
            group.groupName ||
            group.title ||
            group.displayName ||
            "VitalStar Group";


        // ----------------------------------------------------
        // GROUP PROFILE IMAGE
        // ----------------------------------------------------

        video.groupPhoto =
            group.profilePicture ||
            group.profilePhoto ||
            group.photoURL ||
            group.avatar ||
            group.groupImage ||
            group.image ||
            "";


    } catch (error) {

        console.error(
            "Error loading group:",
            video.groupId,
            error
        );
    }


    return video;
}


// ============================================================
// LOAD ALL GROUP DETAILS
// ============================================================

async function loadAllGroupDetails() {

    if (!currentVideos.length) {
        return;
    }


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
                loadGroupDetails(
                    video
                )
        )
    );


    // Update only the group
    // information in existing cards.

    updateGroupInformation();
}


// ============================================================
// UPDATE GROUP UI
// ============================================================

function updateGroupInformation() {

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


            const nameButton =
                card.querySelector(
                    ".reals-name-button"
                );


            if (nameButton) {

                nameButton.textContent =
                    video.groupName ||
                    "VitalStar Group";
            }


            const profileButton =
                card.querySelector(
                    ".reals-profile-button"
                );


            if (!profileButton) {
                return;
            }


            if (video.groupPhoto) {

                profileButton.innerHTML = `

                    <img
                        src="${escapeHTML(
                            video.groupPhoto
                        )}"
                        alt=""
                        class="reals-avatar"
                        loading="lazy"
                    >

                `;

            } else {

                profileButton.innerHTML = `

                    <div class="reals-avatar-fallback">
                        👥
                    </div>

                `;
            }

        }
    );
}


// ============================================================
// MERGE BOTH FEEDS
// ============================================================

function getMergedFeed() {

    const merged = [

        ...normalPosts,

        ...groupPosts

    ];


    const unique =
        new Map();


    merged.forEach(
        video => {

            if (
                !video ||
                !video.video
            ) {
                return;
            }

            unique.set(
                video.id,
                video
            );
        }
    );


    const result =
        Array.from(
            unique.values()
        );


    result.sort(
        (a, b) =>
            b.createdAt -
            a.createdAt
    );


    return result;
}


// ============================================================
// REBUILD FEED
// ============================================================

function rebuildFeed() {

    if (!container) {
        return;
    }


    if (
        !normalLoaded ||
        !groupLoaded
    ) {

        showLoading();

        return;
    }


    try {

        currentVideos =
            getMergedFeed();


        if (
            !currentVideos.length
        ) {

            showEmpty();

            return;
        }


        // Render immediately.
        renderFeed();


        // Load group information
        // AFTER videos appear.
        loadAllGroupDetails();


    } catch (error) {

        console.error(
            "Reals rebuild error:",
            error
        );

        showError(
            getFirebaseErrorMessage(
                error
            )
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


    container.innerHTML = "";


    currentVideos.forEach(
        (video, index) => {

            const card =
                createVideoCard(
                    video,
                    index
                );


            container.appendChild(
                card
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


    // --------------------------------------------------------
    // GROUP VIDEO
    // --------------------------------------------------------

    const displayName =
        isGroup

            ? (
                video.groupName ||
                "VitalStar Group"
            )

            : (
                video.creatorName ||
                "VitalStar User"
            );


    const displayPhoto =
        isGroup

            ? video.groupPhoto

            : video.creatorPhoto;


    const safeName =
        escapeHTML(
            displayName
        );


    const safePhoto =
        escapeHTML(
            displayPhoto || ""
        );


    const fallback =
        isGroup
            ? "👥"
            : "VS";


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
                    ${fallback}
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
            preload="${
                settings.dataSaver
                    ? "metadata"
                    : "auto"
            }"
            ${settings.muted ? "muted" : ""}
            loop
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


        <!-- ==================================================
             SOURCE
             GROUP = GROUP
             POST = USER
             ================================================== -->

        <div class="reals-video-info">

            <div class="reals-source">


                <button
                    class="reals-profile-button"
                    type="button"
                    data-action="${sourceAction}"
                    aria-label="${
                        isGroup
                            ? "Open group"
                            : "Open profile"
                    }"
                >

                    ${avatar}

                </button>


                <button
                    class="reals-name-button"
                    type="button"
                    data-action="${sourceAction}"
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


        <!-- ==================================================
             ACTIONS
             ================================================== -->

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
    // PROFILE BUTTON
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

    } else {

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
// VIDEO EVENTS
// ============================================================

function setupVideoBehavior() {

    if (!container) {
        return;
    }


    // --------------------------------------------------------
    // TAP VIDEO
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // PLAY BUTTON
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // ACTION BUTTONS
    // --------------------------------------------------------

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


                        const action =
                            button.dataset.action;


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


                        const video =
                            currentVideos[
                                index
                            ];


                        handleAction(
                            action,
                            video,
                            card
                        );

                    }
                );

            }
        );
}


// ============================================================
// INTERSECTION OBSERVER
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


                        const playButton =
                            entry.target.querySelector(
                                ".reals-play-button"
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

                            if (
                                playButton
                            ) {

                                playButton.textContent =
                                    "▶";
                            }
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
// ACTION HANDLER
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
                video
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
// LIKE
// ============================================================

function handleLike(
    video,
    card
) {

    showToast(
        "Like coming next."
    );
}


// ============================================================
// COMMENT
// ============================================================

function handleComment(
    video
) {

    showToast(
        "Comments coming next."
    );
}


// ============================================================
// REPOST
// ============================================================

function handleRepost(
    video
) {

    showToast(
        "Repost coming next."
    );
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

        // User cancelled sharing.
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


    card
        .querySelectorAll(
            '[data-action="mute"] .action-icon'
        )
        .forEach(
            icon => {

                icon.textContent =
                    settings.muted
                        ? "🔇"
                        : "🔊";
            }
        );
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
        `../profile.html?uid=${encodeURIComponent(
            uid
        )}`;
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


    // Group page.
    //
    // If your existing group page uses another filename,
    // only this URL needs to be changed.

    window.location.href =
        `../group.html?id=${encodeURIComponent(
            groupId
        )}`;
}


// ============================================================
// MORE MENU
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
// FIREBASE ERROR
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
            "Firebase permissions are preventing Reals from loading."
        );
    }


    if (
        error.code ===
        "failed-precondition"
    ) {

        return (
            "Firebase reported a query problem."
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

    // Prevent duplicate listeners.
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


                rebuildFeed();

            },

            error => {

                console.error(
                    "Normal Reals error:",
                    error
                );


                normalLoaded = true;


                if (
                    groupLoaded
                ) {

                    showError(
                        getFirebaseErrorMessage(
                            error
                        )
                    );
                }
            }
        );


    // ========================================================
    // ALL GROUP POSTS
    // ========================================================
    //
    // IMPORTANT:
    //
    // We intentionally do NOT use:
    //
    // where("mediaType", "==", "video")
    //
    // because the goal is to make General Reals robust
    // against existing group posts and different media
    // values.
    //
    // We load group posts and filter videos locally.
    //
    // This also fixes the previous problem where only the
    // first 100 group posts were checked.
    //
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


                rebuildFeed();

            },

            error => {

                console.error(
                    "Group Reals error:",
                    error
                );


                groupLoaded = true;


                // If normal posts loaded successfully,
                // still show them even if the group query
                // has a Firebase permissions problem.

                if (
                    normalLoaded
                ) {

                    rebuildFeed();
                }
            }
        );
}


// ============================================================
// ALIASES
// ============================================================

export function initGeneralVids(
    target
) {

    return init(
        target
    );
}


export function initializeFeed(
    target
) {

    return init(
        target
    );
}


// ============================================================
// SETTINGS CHANGE
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
// CLEANUP
// ============================================================

export function cleanupListeners() {

    if (
        normalUnsubscribe
    ) {

        normalUnsubscribe();

        normalUnsubscribe =
            null;
    }


    if (
        groupUnsubscribe
    ) {

        groupUnsubscribe();

        groupUnsubscribe =
            null;
    }
}


// ============================================================
// DISCONNECT OBSERVER
// ============================================================

export function disconnectObserver() {

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

    cleanupListeners();

    disconnectObserver();


    normalPosts = [];
    groupPosts = [];
    currentVideos = [];


    normalLoaded = false;
    groupLoaded = false;


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

            margin:2dvh 0;

            overflow:hidden;

            border-radius:14px;

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
                    rgba(0,0,0,.38),
                    transparent
                );
        }


        .reals-bottom-gradient{

            position:absolute;

            inset:auto 0 0 0;

            height:42%;

            pointer-events:none;

            background:
                linear-gradient(
                    to top,
                    rgba(0,0,0,.82),
                    transparent
                );
        }


        .reals-video-info{

            position:absolute;

            left:12px;

            right:72px;

            bottom:20px;

            z-index:5;
        }


        .reals-source{

            display:flex;

            align-items:center;

            gap:8px;
        }


        .reals-profile-button{

            width:38px;

            height:38px;

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

            margin-top:7px;

            color:#fff;

            font-size:12.5px;

            line-height:1.4;

            max-width:100%;
        }


        .reals-actions{

            position:absolute;

            right:7px;

            bottom:72px;

            z-index:8;

            display:flex;

            flex-direction:column;

            gap:9px;
        }


        .reals-action{

            width:40px;

            min-height:40px;

            padding:3px;

            border:0;

            background:rgba(0,0,0,.25);

            color:#fff;

            border-radius:12px;

            display:flex;

            flex-direction:column;

            align-items:center;

            justify-content:center;

            cursor:pointer;
        }


        .action-icon{

            font-size:20px;

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

            width:54px;

            height:54px;

            border:0;

            border-radius:50%;

            background:
                rgba(0,0,0,.45);

            color:#fff;

            font-size:21px;

            z-index:7;

            cursor:pointer;
        }


        .reals-source-badge{

            position:absolute;

            top:12px;

            left:12px;

            z-index:6;

            padding:4px 8px;

            border-radius:8px;

            background:
                rgba(0,0,0,.45);

            color:#fff;

            font-size:9px;

            font-weight:700;

            letter-spacing:.6px;
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

            width:62px;

            height:62px;

            display:flex;

            align-items:center;

            justify-content:center;
        }


        .vs-ring{

            position:absolute;

            inset:0;

            border:3px solid
                rgba(40,110,255,.2);

            border-top-color:
                #2870ff;

            border-radius:50%;

            animation:
                vsSpin 1s linear infinite;
        }


        .vs-logo{

            font-weight:800;

            font-size:18px;

            color:#fff;
        }


        .vs-loading-text{

            margin-top:14px;

            font-size:13px;
        }


        .empty-icon{

            font-size:38px;

            margin-bottom:12px;
        }


        .reals-empty h3{

            margin:
                0 0 7px;

            font-size:18px;
        }


        .reals-empty p{

            margin:0;

            color:#9ca8c5;

            font-size:13px;
        }


        .reals-retry{

            margin-top:16px;

            padding:9px 16px;

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

            padding:9px 14px;

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
                transform:
                    rotate(360deg);
            }
        }


        @media (max-width:600px){

            .reals-video-card{

                height:94dvh;

                margin:
                    1dvh 0;

                border-radius:12px;
            }


            .reals-video-info{

                left:10px;

                right:65px;

                bottom:17px;
            }


            .reals-actions{

                right:5px;

                bottom:68px;

                gap:7px;
            }


            .reals-action{

                width:38px;

                min-height:38px;

                border-radius:10px;
            }


            .reals-profile-button{

                width:36px;

                height:36px;
            }


            .reals-name-button{

                font-size:12.5px;
            }


            .reals-caption{

                font-size:12px;
            }
        }

    `;


    document.head.appendChild(
        style
    );
}


// ============================================================
// ADD STYLES
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