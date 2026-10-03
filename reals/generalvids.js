// ============================================================
// VITALSTAR — GENERAL REALS VIDEOS
// ALL PUBLIC VIDEOS FROM POSTS + GROUPS
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

let videos = [];
let container = null;
let unsubscribePosts = null;
let unsubscribeGroups = null;

let settings = {
    autoplay: localStorage.getItem("vitalstar_reals_autoplay") !== "false",
    muted: localStorage.getItem("vitalstar_reals_muted") !== "false",
    dataSaver: localStorage.getItem("vitalstar_reals_dataSaver") === "true"
};


// ============================================================
// INITIALIZE
// ============================================================

export function init(root) {

    container = root;

    if (!container) return;

    container.innerHTML = `
        <div class="reals-loading">
            <div class="vs-loader">
                <span>VS</span>
            </div>
            <div class="loading-text">Loading VitalStar...</div>
        </div>
    `;

    injectStyles();

    loadVideos();
}


// ============================================================
// SETTINGS
// ============================================================

export function onSettingChange(nextSettings = {}) {

    settings = {
        ...settings,
        ...nextSettings
    };

    document.querySelectorAll(".reals-video").forEach(video => {

        video.muted = settings.muted;

        if (settings.dataSaver) {
            video.preload = "metadata";
        } else {
            video.preload = "auto";
        }
    });
}


// ============================================================
// LOAD ALL GENERAL VIDEOS
// ============================================================

async function loadVideos() {

    const normalPosts = [];
    const groupPosts = [];

    let normalLoaded = false;
    let groupsLoaded = false;

    const finish = () => {

        if (!normalLoaded || !groupsLoaded) return;

        videos = [
            ...normalPosts,
            ...groupPosts
        ]
            .filter(Boolean)
            .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

        renderFeed();
    };


    // ========================================================
    // NORMAL POSTS
    // ========================================================

    try {

        const postsQuery = query(
            collection(db, "posts"),
            orderBy("createdAt", "desc"),
            limit(100)
        );

        unsubscribePosts = onSnapshot(
            postsQuery,
            async snapshot => {

                normalPosts.length = 0;

                for (const item of snapshot.docs) {

                    const data = item.data();

                    const videoURL =
                        data.video ||
                        data.videoUrl ||
                        data.videoURL ||
                        "";

                    if (!videoURL) continue;

                    if (!isPublicPost(data)) continue;

                    normalPosts.push({
                        id: item.id,
                        type: "post",
                        postId: item.id,

                        creatorId:
                            data.uid ||
                            data.userId ||
                            data.authorId ||
                            data.creatorId ||
                            "",

                        fullName:
                            data.fullName ||
                            data.authorName ||
                            data.name ||
                            "VitalStar User",

                        username:
                            data.username ||
                            "",

                        profilePicture:
                            data.profilePicture ||
                            data.profilePhoto ||
                            data.photoURL ||
                            data.avatarURL ||
                            data.avatarUrl ||
                            "",

                        text:
                            data.text ||
                            data.caption ||
                            "",

                        video: videoURL,

                        likes:
                            Number(data.likes || 0),

                        comments:
                            Number(data.comments || 0),

                        reposts:
                            Number(data.reposts || 0),

                        shares:
                            Number(data.shares || 0),

                        createdAt:
                            data.createdAt || null
                    });
                }

                normalLoaded = true;
                finish();
            },
            error => {

                console.error(
                    "VitalStar normal videos error:",
                    error
                );

                normalLoaded = true;
                finish();
            }
        );

    } catch (error) {

        console.error(error);

        normalLoaded = true;
        finish();
    }


    // ========================================================
    // GROUP POSTS
    // ========================================================

    try {

        const groupsQuery = query(
            collectionGroup(db, "posts"),
            limit(500)
        );

        unsubscribeGroups = onSnapshot(
            groupsQuery,
            async snapshot => {

                groupPosts.length = 0;

                for (const item of snapshot.docs) {

                    const data = item.data();

                    const videoURL =
                        data.mediaURL ||
                        data.video ||
                        data.videoUrl ||
                        data.videoURL ||
                        "";

                    if (!videoURL) continue;

                    if (!isGroupVideo(data)) continue;

                    const pathParts = item.ref.path.split("/");

                    const groupIndex =
                        pathParts.indexOf("groups");

                    const groupId =
                        groupIndex >= 0
                            ? pathParts[groupIndex + 1]
                            : "";

                    if (!groupId) continue;

                    let groupName =
                        data.groupName ||
                        data.groupTitle ||
                        data.groupDisplayName ||
                        "";

                    let groupPhoto =
                        data.groupPhoto ||
                        data.groupAvatar ||
                        data.groupAvatarURL ||
                        data.groupAvatarUrl ||
                        "";

                    groupPosts.push({
                        id: item.id,
                        type: "group",
                        postId: item.id,
                        groupId,

                        groupName,
                        groupPhoto,

                        creatorId:
                            data.authorId ||
                            data.uid ||
                            "",

                        fullName:
                            data.authorName ||
                            "VitalStar Group",

                        username: "",

                        profilePicture:
                            data.authorPhotoURL ||
                            data.authorPhoto ||
                            "",

                        text:
                            data.text ||
                            data.caption ||
                            "",

                        video: videoURL,

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
                            ),

                        createdAt:
                            data.createdAt || null
                    });
                }

                // Load the actual group identity.
                await Promise.all(
                    groupPosts.map(loadGroupInformation)
                );

                groupsLoaded = true;
                finish();
            },
            error => {

                console.error(
                    "VitalStar group videos error:",
                    error
                );

                groupsLoaded = true;
                finish();
            }
        );

    } catch (error) {

        console.error(error);

        groupsLoaded = true;
        finish();
    }
}


// ============================================================
// PUBLIC POST CHECK
// ============================================================

function isPublicPost(data) {

    const privacy = String(
        data.privacy ||
        data.visibility ||
        "Public"
    ).toLowerCase().trim();

    if (
        privacy === "only me" ||
        privacy === "onlyme" ||
        privacy === "private" ||
        privacy === "friends" ||
        privacy === "friends only"
    ) {
        return false;
    }

    return true;
}


// ============================================================
// GROUP VIDEO CHECK
// ============================================================

function isGroupVideo(data) {

    const mediaType =
        String(data.mediaType || "").toLowerCase();

    return (
        mediaType === "video" ||
        !!data.groupId ||
        !!data.groupName ||
        !!data.groupTitle ||
        !!data.groupDisplayName
    );
}


// ============================================================
// LOAD GROUP INFORMATION
// ============================================================

async function loadGroupInformation(video) {

    if (!video.groupId) return;

    try {

        const snap = await getDoc(
            doc(db, "groups", video.groupId)
        );

        if (!snap.exists()) return;

        const data = snap.data();

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

    } catch (error) {

        console.error(
            "Group information error:",
            error
        );
    }
}


// ============================================================
// RENDER FEED
// ============================================================

async function renderFeed() {

    if (!container) return;

    if (!videos.length) {

        container.innerHTML = `
            <div class="reals-empty">
                <div class="empty-icon">🎬</div>
                <div>No public videos yet.</div>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="reals-feed">
            ${videos.map((video, index) =>
                createVideoCard(video, index)
            ).join("")}
        </div>
    `;

    setupVideoObserver();
    setupNavigation();

    await restoreLikeStates();
}


// ============================================================
// VIDEO CARD
// ============================================================

function createVideoCard(video, index) {

    const isGroup = video.type === "group";

    const identityName = isGroup
        ? (video.groupName || "VitalStar Group")
        : (video.fullName || "VitalStar User");

    const identityPhoto = isGroup
        ? video.groupPhoto
        : video.profilePicture;

    const avatarHTML = identityPhoto
        ? `
            <img
                class="creator-avatar"
                src="${escapeAttr(identityPhoto)}"
                alt=""
            >
        `
        : `
            <div class="creator-avatar fallback-avatar">
                ${escapeHTML(identityName.charAt(0).toUpperCase())}
            </div>
        `;

    return `
        <article
            class="reals-card"
            data-index="${index}"
            data-id="${escapeAttr(video.id)}"
            data-type="${escapeAttr(video.type)}"
        >

            <video
                class="reals-video"
                src="${escapeAttr(video.video)}"
                playsinline
                preload="${settings.dataSaver ? "metadata" : "auto"}"
                ${settings.muted ? "muted" : ""}
            ></video>


            <!-- BIG PLAY BUTTON -->

            <button
                class="big-play"
                type="button"
                aria-label="Play video"
            >
                ▶
            </button>


            <!-- TOP CONTROLS -->

            <div class="video-top-controls">

                <button
                    class="video-nav-btn previous-video"
                    type="button"
                    aria-label="Previous video"
                >
                    ↑
                </button>

                <button
                    class="video-nav-btn next-video"
                    type="button"
                    aria-label="Next video"
                >
                    ↓
                </button>

            </div>


            <!-- VIDEO ACTIONS -->

            <div class="reals-actions">

                <button
                    class="reals-action like-action"
                    data-action="like"
                    type="button"
                >
                    <span class="action-icon">♡</span>
                    <span class="action-count like-count">
                        ${formatCount(video.likes)}
                    </span>
                </button>


                <button
                    class="reals-action comment-action"
                    data-action="comment"
                    type="button"
                >
                    <span class="action-icon">💬</span>
                    <span class="action-count">
                        ${formatCount(video.comments)}
                    </span>
                </button>


                <button
                    class="reals-action repost-action"
                    data-action="repost"
                    type="button"
                >
                    <span class="action-icon">↻</span>
                    <span class="action-count">
                        ${formatCount(video.reposts)}
                    </span>
                </button>


                <button
                    class="reals-action share-action"
                    data-action="share"
                    type="button"
                >
                    <span class="action-icon">↗</span>
                    <span class="action-count">
                        ${formatCount(video.shares)}
                    </span>
                </button>


                <button
                    class="reals-action mute-action"
                    data-action="mute"
                    type="button"
                >
                    <span class="action-icon">
                        ${settings.muted ? "🔇" : "🔊"}
                    </span>
                </button>


                <button
                    class="reals-action more-action"
                    data-action="more"
                    type="button"
                >
                    <span class="action-icon">⋮</span>
                </button>

            </div>


            <!-- CREATOR -->

            <div class="reals-info">

                <button
                    class="creator-row"
                    type="button"
                    data-action="identity"
                >
                    ${avatarHTML}

                    <span class="creator-name">
                        ${escapeHTML(identityName)}
                    </span>
                </button>


                <div class="reals-caption">
                    ${formatCaption(video.text)}
                </div>

            </div>

        </article>
    `;
}


// ============================================================
// EVENT SETUP
// ============================================================

function setupVideoObserver() {

    const cards =
        document.querySelectorAll(".reals-card");

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    const video =
                        entry.target.querySelector(".reals-video");

                    if (!video) return;

                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.65
                    ) {

                        document
                            .querySelectorAll(".reals-video")
                            .forEach(other => {

                                if (other !== video) {
                                    other.pause();
                                }

                            });

                        if (settings.autoplay) {

                            video.muted = settings.muted;

                            video.play().catch(() => {});

                            updatePlayButton(
                                entry.target,
                                true
                            );
                        }

                    } else {

                        video.pause();

                        updatePlayButton(
                            entry.target,
                            false
                        );
                    }
                });

            },
            {
                threshold: [0.25, 0.65, 0.9]
            }
        );


    cards.forEach(card => observer.observe(card));


    // Tap video to play/pause.

    cards.forEach(card => {

        const video =
            card.querySelector(".reals-video");

        const playButton =
            card.querySelector(".big-play");

        if (!video || !playButton) return;


        const toggleVideo = event => {

            event.preventDefault();
            event.stopPropagation();

            if (video.paused) {

                video.play().catch(() => {});

                updatePlayButton(card, true);

            } else {

                video.pause();

                updatePlayButton(card, false);
            }
        };


        video.addEventListener(
            "click",
            toggleVideo
        );

        playButton.addEventListener(
            "click",
            toggleVideo
        );


        video.addEventListener(
            "play",
            () => updatePlayButton(card, true)
        );

        video.addEventListener(
            "pause",
            () => updatePlayButton(card, false)
        );
    });
}


// ============================================================
// PLAY BUTTON
// ============================================================

function updatePlayButton(card, playing) {

    const button =
        card.querySelector(".big-play");

    if (!button) return;

    if (playing) {

        button.classList.add("playing");
        button.textContent = "❚❚";

    } else {

        button.classList.remove("playing");
        button.textContent = "▶";
    }
}


// ============================================================
// BACK / FORWARD NAVIGATION
// ============================================================

function setupNavigation() {

    const cards =
        [...document.querySelectorAll(".reals-card")];

    cards.forEach((card, index) => {

        const previous =
            card.querySelector(".previous-video");

        const next =
            card.querySelector(".next-video");


        previous?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                goToVideo(index - 1);
            }
        );


        next?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                goToVideo(index + 1);
            }
        );
    });
}


function goToVideo(index) {

    const cards =
        [...document.querySelectorAll(".reals-card")];

    if (!cards.length) return;

    if (index < 0) {
        index = cards.length - 1;
    }

    if (index >= cards.length) {
        index = 0;
    }

    cards[index].scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================================
// ACTION EVENTS
// ============================================================

function setupActionEvents() {

    document
        .querySelectorAll(".reals-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                event => {

                    const button =
                        event.target.closest(
                            ".reals-action"
                        );

                    const identity =
                        event.target.closest(
                            ".creator-row"
                        );

                    if (identity) {

                        event.preventDefault();
                        event.stopPropagation();

                        const index =
                            Number(
                                card.dataset.index
                            );

                        openIdentity(
                            videos[index]
                        );

                        return;
                    }

                    if (!button) return;

                    event.preventDefault();
                    event.stopPropagation();

                    const index =
                        Number(
                            card.dataset.index
                        );

                    const video =
                        videos[index];

                    if (!video) return;

                    const action =
                        button.dataset.action;

                    handleAction(
                        action,
                        video,
                        card
                    );
                }
            );
        });
}


// ============================================================
// ACTION HANDLER
// ============================================================

async function handleAction(
    action,
    video,
    card
) {

    if (action === "like") {

        if (video.type === "group") {

            showGroupOnlyMessage();
            return;
        }

        await toggleNormalLike(
            video,
            card
        );

        return;
    }


    if (
        action === "comment" ||
        action === "repost" ||
        action === "share" ||
        action === "more"
    ) {

        if (video.type === "group") {

            showGroupOnlyMessage();
            return;
        }
    }


    if (action === "comment") {

        window.location.href =
            `../comments.html?postId=${encodeURIComponent(
                video.postId
            )}`;

        return;
    }


    if (action === "repost") {

        await toggleNormalRepost(
            video,
            card
        );

        return;
    }


    if (action === "share") {

        await shareNormalPost(
            video,
            card
        );

        return;
    }


    if (action === "mute") {

        const videoElement =
            card.querySelector(".reals-video");

        if (!videoElement) return;

        videoElement.muted =
            !videoElement.muted;

        settings.muted =
            videoElement.muted;

        localStorage.setItem(
            "vitalstar_reals_muted",
            String(settings.muted)
        );

        const icon =
            card.querySelector(
                ".mute-action .action-icon"
            );

        if (icon) {

            icon.textContent =
                videoElement.muted
                    ? "🔇"
                    : "🔊";
        }

        return;
    }


    if (action === "more") {

        showMoreMenu(video);
    }
}


// ============================================================
// NORMAL POST LIKE
// ============================================================
// IMPORTANT:
// This only updates the current video/card.
// It does NOT reload the page.
// ============================================================

async function toggleNormalLike(
    video,
    card
) {

    const user = auth.currentUser;

    if (!user) {

        showMessage(
            "Please sign in to like this video."
        );

        return;
    }

    const likeRef = doc(
        db,
        "postLikes",
        `${video.postId}_${user.uid}`
    );

    const likeButton =
        card.querySelector(".like-action");

    const countElement =
        card.querySelector(".like-count");

    if (!likeButton || !countElement) return;


    // Prevent double taps while request is running.

    if (
        likeButton.dataset.processing === "true"
    ) {
        return;
    }

    likeButton.dataset.processing = "true";


    try {

        const existing =
            await getDoc(likeRef);

        const currentlyLiked =
            existing.exists();


        // ================================================
        // UNLIKE
        // ================================================

        if (currentlyLiked) {

            await deleteDoc(likeRef);

            await updateDoc(
                doc(db, "posts", video.postId),
                {
                    likes: increment(-1)
                }
            );

            video.likes =
                Math.max(
                    0,
                    Number(video.likes || 0) - 1
                );

            setLikeButtonState(
                card,
                false,
                video.likes
            );

            return;
        }


        // ================================================
        // LIKE
        // ================================================

        await setDoc(
            likeRef,
            {
                postId: video.postId,
                uid: user.uid,
                createdAt: serverTimestamp()
            }
        );


        await updateDoc(
            doc(db, "posts", video.postId),
            {
                likes: increment(1)
            }
        );


        video.likes =
            Number(video.likes || 0) + 1;


        // INSTANTLY update ONLY this card.

        setLikeButtonState(
            card,
            true,
            video.likes
        );


        // Notification happens separately.
        // It does NOT reload the feed.

        await sendLikeNotification(
            video,
            user
        );


    } catch (error) {

        console.error(
            "Like error:",
            error
        );

        showMessage(
            "Unable to update your like."
        );

    } finally {

        likeButton.dataset.processing =
            "false";
    }
}


// ============================================================
// LIKE BUTTON UI
// ============================================================

function setLikeButtonState(
    card,
    liked,
    count
) {

    const button =
        card.querySelector(".like-action");

    const icon =
        card.querySelector(
            ".like-action .action-icon"
        );

    const countElement =
        card.querySelector(".like-count");

    if (!button) return;

    button.classList.toggle(
        "liked",
        liked
    );

    if (icon) {

        icon.textContent =
            liked ? "♥" : "♡";
    }

    if (countElement) {

        countElement.textContent =
            formatCount(count);
    }
}


// ============================================================
// RESTORE LIKE STATES
// ============================================================

async function restoreLikeStates() {

    const user = auth.currentUser;

    if (!user) {

        setupActionEvents();
        return;
    }

    for (const video of videos) {

        if (video.type !== "post") continue;

        try {

            const snap =
                await getDoc(
                    doc(
                        db,
                        "postLikes",
                        `${video.postId}_${user.uid}`
                    )
                );

            const card =
                document.querySelector(
                    `.reals-card[data-id="${CSS.escape(
                        video.id
                    )}"][data-type="post"]`
                );

            if (!card) continue;

            setLikeButtonState(
                card,
                snap.exists(),
                video.likes
            );

        } catch (error) {

            console.error(
                "Like state error:",
                error
            );
        }
    }

    setupActionEvents();
}


// ============================================================
// LIKE NOTIFICATION
// ============================================================

async function sendLikeNotification(
    video,
    user
) {

    if (!video.creatorId) return;

    if (
        video.creatorId === user.uid
    ) {
        return;
    }

    try {

        const userData =
            await getCurrentUserData();

        await addDoc(
            collection(db, "notifications"),
            {
                receiverId:
                    video.creatorId,

                senderId:
                    user.uid,

                senderName:
                    userData.fullName ||
                    user.displayName ||
                    "VitalStar User",

                senderPhoto:
                    userData.profilePicture ||
                    user.photoURL ||
                    "",

                type:
                    "post_like",

                postId:
                    video.postId,

                text:
                    "liked your post.",

                read:
                    false,

                createdAt:
                    serverTimestamp()
            }
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );
    }
}


// ============================================================
// REPOST
// ============================================================

async function toggleNormalRepost(
    video,
    card
) {

    const user = auth.currentUser;

    if (!user) {

        showMessage(
            "Please sign in to repost."
        );

        return;
    }

    const repostRef = doc(
        db,
        "postReposts",
        `${video.postId}_${user.uid}`
    );

    try {

        const existing =
            await getDoc(repostRef);

        const repostButton =
            card.querySelector(
                ".repost-action"
            );

        const countElement =
            repostButton?.querySelector(
                ".action-count"
            );


        if (existing.exists()) {

            await deleteDoc(repostRef);

            await updateDoc(
                doc(db, "posts", video.postId),
                {
                    reposts: increment(-1)
                }
            );

            video.reposts =
                Math.max(
                    0,
                    Number(video.reposts || 0) - 1
                );

            repostButton?.classList.remove(
                "reposted"
            );

        } else {

            await setDoc(
                repostRef,
                {
                    postId: video.postId,
                    uid: user.uid,
                    createdAt: serverTimestamp()
                }
            );

            await updateDoc(
                doc(db, "posts", video.postId),
                {
                    reposts: increment(1)
                }
            );

            video.reposts =
                Number(video.reposts || 0) + 1;

            repostButton?.classList.add(
                "reposted"
            );

            if (
                video.creatorId &&
                video.creatorId !== user.uid
            ) {

                const userData =
                    await getCurrentUserData();

                await addDoc(
                    collection(db, "notifications"),
                    {
                        receiverId:
                            video.creatorId,

                        senderId:
                            user.uid,

                        senderName:
                            userData.fullName ||
                            user.displayName ||
                            "VitalStar User",

                        senderPhoto:
                            userData.profilePicture ||
                            user.photoURL ||
                            "",

                        type:
                            "post_repost",

                        postId:
                            video.postId,

                        text:
                            "reposted your post.",

                        read:
                            false,

                        createdAt:
                            serverTimestamp()
                    }
                );
            }
        }


        if (countElement) {

            countElement.textContent =
                formatCount(
                    video.reposts
                );
        }

    } catch (error) {

        console.error(
            "Repost error:",
            error
        );

        showMessage(
            "Unable to repost this video."
        );
    }
}


// ============================================================
// SHARE
// ============================================================

async function shareNormalPost(
    video,
    card
) {

    const shareURL =
        new URL(
            "../comments.html",
            window.location.href
        );

    shareURL.searchParams.set(
        "postId",
        video.postId
    );

    const url =
        shareURL.toString();


    try {

        if (
            navigator.share
        ) {

            await navigator.share({
                title: "VitalStar",
                text:
                    video.text ||
                    "Check out this video on VitalStar.",
                url
            });

        } else {

            await navigator.clipboard.writeText(
                url
            );

            showMessage(
                "Video link copied."
            );
        }


        await updateDoc(
            doc(db, "posts", video.postId),
            {
                shares: increment(1)
            }
        );


        video.shares =
            Number(video.shares || 0) + 1;


        const count =
            card.querySelector(
                ".share-action .action-count"
            );

        if (count) {

            count.textContent =
                formatCount(
                    video.shares
                );
        }

    } catch (error) {

        if (
            error?.name !== "AbortError"
        ) {

            console.error(
                "Share error:",
                error
            );
        }
    }
}


// ============================================================
// IDENTITY
// ============================================================

function openIdentity(video) {

    if (video.type === "group") {

        openGroup(video);
        return;
    }

    if (!video.creatorId) return;

    window.location.href =
        `../profile.html?uid=${encodeURIComponent(
            video.creatorId
        )}`;
}


// ============================================================
// GROUP OPEN
// ============================================================

function openGroup(video) {

    if (!video.groupId) return;

    window.location.href =
        `../group.html?id=${encodeURIComponent(
            video.groupId
        )}`;
}


// ============================================================
// MORE MENU
// ============================================================

function showMoreMenu(video) {

    if (video.type === "group") {

        showGroupOnlyMessage();
        return;
    }

    if (!video.creatorId) return;

    window.location.href =
        `../profile.html?uid=${encodeURIComponent(
            video.creatorId
        )}`;
}


// ============================================================
// GROUP ACTION MESSAGE
// ============================================================

function showGroupOnlyMessage() {

    showMessage(
        "This action can only be taken inside the group."
    );
}


// ============================================================
// MESSAGE POPUP
// ============================================================

function showMessage(text) {

    const old =
        document.querySelector(
            ".reals-message"
        );

    old?.remove();


    const message =
        document.createElement("div");

    message.className =
        "reals-message";

    message.textContent = text;

    document.body.appendChild(
        message
    );


    requestAnimationFrame(() => {

        message.classList.add(
            "show"
        );
    });


    setTimeout(() => {

        message.classList.remove(
            "show"
        );

        setTimeout(
            () => message.remove(),
            250
        );

    }, 2500);
}


// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUserData() {

    const user = auth.currentUser;

    if (!user) return {};

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
            return {};
        }

        const data = snap.data();

        return {
            fullName:
                data.fullName ||
                data.displayName ||
                "",

            username:
                data.username ||
                "",

            profilePicture:
                data.profilePicture ||
                data.profilePhoto ||
                data.photoURL ||
                ""
        };

    } catch (error) {

        console.error(
            "User profile error:",
            error
        );

        return {};
    }
}


// ============================================================
// HELPERS
// ============================================================

function getTime(timestamp) {

    if (!timestamp) return 0;

    if (
        typeof timestamp.toMillis ===
        "function"
    ) {
        return timestamp.toMillis();
    }

    if (
        timestamp.seconds
    ) {
        return (
            timestamp.seconds * 1000 +
            Math.floor(
                (timestamp.nanoseconds || 0) /
                1000000
            )
        );
    }

    const date =
        new Date(timestamp);

    return isNaN(date.getTime())
        ? 0
        : date.getTime();
}


function formatCount(number) {

    number =
        Number(number || 0);

    if (number >= 1000000) {

        return (
            (number / 1000000)
                .toFixed(1)
                .replace(".0", "") +
            "M"
        );
    }

    if (number >= 1000) {

        return (
            (number / 1000)
                .toFixed(1)
                .replace(".0", "") +
            "K"
        );
    }

    return String(number);
}


function escapeHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttr(value) {

    return escapeHTML(value);
}


function formatCaption(text) {

    if (!text) return "";

    return escapeHTML(text)
        .replace(
            /(#\w+)/g,
            '<span class="hashtag">$1</span>'
        );
}


// ============================================================
// STYLES
// ============================================================

function injectStyles() {

    if (
        document.getElementById(
            "vitalstar-general-reals-styles"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");

    style.id =
        "vitalstar-general-reals-styles";


    style.textContent = `

        .reals-feed {
            width:100%;
            height:100%;
            overflow-y:auto;
            scroll-snap-type:y mandatory;
            background:#050914;
        }


        .reals-card {
            position:relative;
            width:100%;
            height:100dvh;
            min-height:100vh;
            overflow:hidden;
            scroll-snap-align:start;
            scroll-snap-stop:always;
            background:#050914;
        }


        .reals-video {
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            object-fit:cover;
            background:#050914;
            cursor:pointer;
        }


        /* ================================================
           BIGGER PLAY BUTTON
           ================================================ */

        .big-play {
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%, -50%);

            width:92px;
            height:92px;

            border:0;
            border-radius:50%;

            display:flex;
            align-items:center;
            justify-content:center;

            background:rgba(0,0,0,.48);
            color:#fff;

            font-size:48px;
            line-height:1;

            padding-left:6px;

            cursor:pointer;
            z-index:12;

            backdrop-filter:blur(5px);

            transition:
                transform .18s ease,
                opacity .2s ease;
        }


        .big-play:hover {
            transform:
                translate(-50%, -50%)
                scale(1.08);
        }


        .big-play.playing {
            opacity:0;
            pointer-events:none;
        }


        .reals-card:hover
        .big-play.playing {
            opacity:.35;
        }


        /* ================================================
           BACK / FORWARD
           ================================================ */

        .video-top-controls {
            position:absolute;
            top:18px;
            left:18px;

            display:flex;
            gap:10px;

            z-index:20;
        }


        .video-nav-btn {
            width:42px;
            height:42px;

            border:1px solid
                rgba(255,255,255,.22);

            border-radius:50%;

            background:
                rgba(0,0,0,.48);

            color:#fff;

            font-size:23px;
            font-weight:600;

            display:flex;
            align-items:center;
            justify-content:center;

            cursor:pointer;

            backdrop-filter:blur(7px);

            transition:
                transform .15s ease,
                background .15s ease;
        }


        .video-nav-btn:active {
            transform:scale(.88);
        }


        .video-nav-btn:hover {
            background:
                rgba(20,100,255,.55);
        }


        /* ================================================
           ACTIONS
           ================================================ */

        .reals-actions {
            position:absolute;
            right:12px;
            bottom:145px;

            display:flex;
            flex-direction:column;
            align-items:center;
            gap:16px;

            z-index:15;
        }


        .reals-action {
            width:52px;
            min-height:52px;

            padding:4px 0;

            border:0;
            background:transparent;

            color:#fff;

            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;

            cursor:pointer;

            text-shadow:
                0 1px 4px rgba(0,0,0,.7);
        }


        .action-icon {
            font-size:28px;
            line-height:30px;
        }


        .action-count {
            margin-top:3px;

            font-size:12px;
            font-weight:500;

            color:#fff;
        }


        .like-action.liked
        .action-icon {
            color:#ff315d;
        }


        .repost-action.reposted
        .action-icon {
            color:#45d7ff;
        }


        /* ================================================
           CREATOR / CAPTION
           ================================================ */

        .reals-info {
            position:absolute;
            left:16px;
            right:85px;
            bottom:28px;

            z-index:14;

            color:#fff;

            text-shadow:
                0 2px 8px rgba(0,0,0,.8);
        }


        .creator-row {
            display:flex;
            align-items:center;
            gap:9px;

            border:0;
            background:transparent;

            color:#fff;

            padding:0;
            margin:0 0 10px;

            cursor:pointer;
        }


        .creator-avatar {
            width:42px;
            height:42px;

            border-radius:50%;

            object-fit:cover;

            border:2px solid
                rgba(255,255,255,.85);

            background:#10182a;
        }


        .fallback-avatar {
            display:flex;
            align-items:center;
            justify-content:center;

            font-size:17px;
            font-weight:700;
        }


        .creator-name {
            font-size:15px;
            font-weight:600;
        }


        .reals-caption {
            font-size:14px;
            line-height:1.4;

            max-width:90%;

            color:#f2f5ff;
        }


        .hashtag {
            color:#4ca8ff;
        }


        /* ================================================
           LOADING
           ================================================ */

        .reals-loading {
            width:100%;
            height:100dvh;

            display:flex;
            flex-direction:column;

            align-items:center;
            justify-content:center;

            background:#050914;
            color:#fff;
        }


        .vs-loader {
            width:72px;
            height:72px;

            border-radius:50%;

            border:4px solid
                rgba(255,255,255,.12);

            border-top-color:#3d8bff;
            border-right-color:#8c4dff;

            display:flex;
            align-items:center;
            justify-content:center;

            animation:
                vsSpin 1s linear infinite;

            box-shadow:
                0 0 22px
                rgba(66,110,255,.28);
        }


        .vs-loader span {
            font-size:20px;
            font-weight:700;

            animation:
                vsCounterSpin 1s linear infinite;
        }


        .loading-text {
            margin-top:15px;
            font-size:13px;
            opacity:.75;
        }


        @keyframes vsSpin {
            to {
                transform:rotate(360deg);
            }
        }


        @keyframes vsCounterSpin {
            to {
                transform:rotate(-360deg);
            }
        }


        /* ================================================
           EMPTY
           ================================================ */

        .reals-empty {
            height:100dvh;

            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;

            background:#050914;
            color:#fff;

            font-size:15px;
        }


        .empty-icon {
            font-size:42px;
            margin-bottom:10px;
        }


        /* ================================================
           POPUP
           ================================================ */

        .reals-message {
            position:fixed;

            left:50%;
            bottom:90px;

            transform:
                translate(-50%, 20px);

            max-width:85%;

            padding:12px 18px;

            border-radius:12px;

            background:
                rgba(5,10,25,.94);

            border:1px solid
                rgba(80,140,255,.35);

            color:#fff;

            font-size:13px;
            text-align:center;

            z-index:99999;

            opacity:0;

            transition:
                opacity .2s ease,
                transform .2s ease;

            box-shadow:
                0 8px 30px
                rgba(0,0,0,.35);
        }


        .reals-message.show {
            opacity:1;

            transform:
                translate(-50%, 0);
        }


        @media (max-width:600px) {

            .reals-actions {
                bottom:135px;
                right:8px;
                gap:13px;
            }


            .reals-action {
                width:48px;
            }


            .action-icon {
                font-size:27px;
            }


            .big-play {
                width:86px;
                height:86px;
                font-size:45px;
            }


            .video-top-controls {
                top:15px;
                left:12px;
            }

        }

    `;


    document.head.appendChild(style);
}


// ============================================================
// CLEANUP
// ============================================================

export function destroy() {

    if (unsubscribePosts) {
        unsubscribePosts();
        unsubscribePosts = null;
    }

    if (unsubscribeGroups) {
        unsubscribeGroups();
        unsubscribeGroups = null;
    }

    videos = [];

    if (container) {
        container.innerHTML = "";
    }
}
