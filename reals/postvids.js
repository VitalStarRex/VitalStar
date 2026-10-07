/* ============================================================
VITALSTAR — POST REALS
postvids.js

NORMAL POST VIDEOS ONLY
============================================================ */

import { auth, db } from "../firebase.js";

import {
    collection,
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

/* ============================================================
STATE
============================================================ */

let container = null;
let settings = {};

let unsubscribePosts = null;
let observer = null;

let postVideos = [];
let currentVideos = [];

let destroyed = false;

let autoplayEnabled = true;
let startMuted = true;
let dataSaverEnabled = false;

let resizeHandler = null;

/* FIX: remembers which videos are on screen so a like/comment
   count change does NOT rebuild the feed and reset scrolling */
let lastFeedSignature = "";

/* ============================================================
SETTINGS
============================================================ */

function loadSettings() {

    autoplayEnabled =
        localStorage.getItem("vitalstar_reals_autoplay") !== "false";

    startMuted =
        localStorage.getItem("vitalstar_reals_muted") !== "false";

    dataSaverEnabled =
        localStorage.getItem("vitalstar_reals_dataSaver") === "true";

    if (settings) {

        if (typeof settings.autoplay === "boolean") {
            autoplayEnabled = settings.autoplay;
        }

        if (typeof settings.muted === "boolean") {
            startMuted = settings.muted;
        }

        if (typeof settings.dataSaver === "boolean") {
            dataSaverEnabled = settings.dataSaver;
        }
    }
}

/* ============================================================
CALCULATE THE REAL AVAILABLE HEIGHT
============================================================ */

function setFeedHeight() {

    if (!container || destroyed) {
        return;
    }

    const rect = container.getBoundingClientRect();

    const viewportHeight =
        window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;

    let availableHeight = viewportHeight - rect.top;

    if (
        !Number.isFinite(availableHeight) ||
        availableHeight < 200
    ) {
        availableHeight = viewportHeight;
    }

    container.style.height = `${availableHeight}px`;
    container.style.minHeight = `${availableHeight}px`;
    container.style.maxHeight = `${availableHeight}px`;

    /* Like groupvids.js: the container never scrolls itself,
       the inner feed div does. */
    container.style.overflow = "hidden";

    const feedEl = container.querySelector(".post-reals-feed");

    if (feedEl) {
        feedEl.style.height = `${availableHeight}px`;
    }

    /* FIX: give every card a real pixel height.
       height:100% can silently fail. */
    container
        .querySelectorAll(".post-video-card")
        .forEach(card => {
            card.style.height = `${availableHeight}px`;
            card.style.minHeight = `${availableHeight}px`;
        });
}

/* ============================================================
PUBLIC NORMAL VIDEO CHECK
============================================================ */

function isPublicNormalVideo(data) {

    if (!data || typeof data !== "object") {
        return false;
    }

    const privacy =
        String(
            data.privacy ||
            data.visibility ||
            "public"
        )
            .trim()
            .toLowerCase();

    if (
        privacy === "only me" ||
        privacy === "onlyme" ||
        privacy === "private" ||
        privacy === "friends" ||
        privacy === "friends only" ||
        privacy === "friend"
    ) {
        return false;
    }

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    return !!video;
}

/* ============================================================
PLAYABLE URL
============================================================ */

function getPlayableVideoUrl(url) {

    if (!url || typeof url !== "string") {
        return "";
    }

    let finalUrl = url.trim();

    if (
        finalUrl.includes("res.cloudinary.com") &&
        finalUrl.includes("/video/upload/") &&
        !finalUrl.includes("/f_mp4/")
    ) {
        finalUrl =
            finalUrl.replace(
                "/video/upload/",
                "/video/upload/f_mp4/"
            );
    }

    return finalUrl;
}

/* ============================================================
NORMALIZE POST
============================================================ */

function normalizePost(id, data) {

    if (!isPublicNormalVideo(data)) {
        return null;
    }

    const video =
        data.video ||
        data.videoUrl ||
        data.videoURL ||
        "";

    return {

        id,

        originalId: id,

        type: "post",

        video: getPlayableVideoUrl(video),

        text:
            data.text ||
            data.caption ||
            data.description ||
            "",

        fullName:
            data.fullName ||
            data.displayName ||
            data.name ||
            "VitalStar User",

        username:
            data.username ||
            data.userName ||
            "",

        profilePicture:
            data.profilePicture ||
            data.profilePhoto ||
            data.profilePictureURL ||
            data.photoURL ||
            data.avatarURL ||
            data.avatarUrl ||
            data.avatar ||
            "",

        uid:
            data.uid ||
            data.userId ||
            data.authorId ||
            data.createdBy ||
            "",

        likes: Number(data.likes || 0),

        comments: Number(data.comments || 0),

        reposts: Number(data.reposts || 0),

        shares: Number(data.shares || 0),

        createdAt:
            data.createdAt?.toMillis?.() ||
            (
                data.createdAt
                    ? new Date(data.createdAt).getTime()
                    : 0
            )
    };
}

/* ============================================================
INITIALIZE FIREBASE FEED
============================================================ */

function initializeFeed() {

    if (destroyed) {
        return;
    }

    showLoader();

    const postsRef = collection(db, "posts");

    const postsQuery =
        query(
            postsRef,
            orderBy("createdAt", "desc"),
            limit(100)
        );

    unsubscribePosts =
        onSnapshot(
            postsQuery,

            async snapshot => {

                if (destroyed) {
                    return;
                }

                const loaded = [];

                snapshot.forEach(postDoc => {

                    const normalized =
                        normalizePost(
                            postDoc.id,
                            postDoc.data()
                        );

                    if (normalized) {
                        loaded.push(normalized);
                    }
                });

                const unique = new Map();

                loaded.forEach(video => {

                    const key = `post:${video.originalId}`;

                    if (!unique.has(key)) {
                        unique.set(key, video);
                    }
                });

                const nextVideos =
                    Array.from(unique.values())
                        .sort((a, b) => b.createdAt - a.createdAt);

                /* FIX: if the same videos are already on screen
                   (only a like/comment count changed), do NOT
                   rebuild the feed. Rebuilding sends the user
                   back to the first video and looks like
                   "scrolling is broken". */
                const signature =
                    nextVideos
                        .map(v => v.originalId + "|" + v.video)
                        .join(",");

                if (
                    signature === lastFeedSignature &&
                    currentVideos.length
                ) {
                    return;
                }

                lastFeedSignature = signature;

                postVideos = nextVideos;

                await loadMissingProfiles();

                if (!destroyed) {
                    renderFeed();
                }
            },

            error => {

                console.error("VitalStar Post Reals:", error);

                if (!destroyed) {
                    showError("Unable to load post videos.");
                }
            }
        );
}

/* ============================================================
LOAD USER PROFILE
============================================================ */

async function loadMissingProfiles() {

    const cache = new Map();

    const tasks =
        postVideos.map(async video => {

            if (!video.uid) {
                return;
            }

            if (
                video.fullName !== "VitalStar User" &&
                video.profilePicture
            ) {
                return;
            }

            if (cache.has(video.uid)) {
                Object.assign(video, cache.get(video.uid));
                return;
            }

            try {

                const snap =
                    await getDoc(doc(db, "users", video.uid));

                if (!snap.exists()) {
                    return;
                }

                const data = snap.data();

                const profile = {

                    fullName:
                        data.fullName ||
                        data.displayName ||
                        data.name ||
                        video.fullName,

                    username:
                        data.username ||
                        data.userName ||
                        video.username,

                    profilePicture:
                        data.profilePicture ||
                        data.profilePhoto ||
                        data.profilePictureURL ||
                        data.photoURL ||
                        data.avatarURL ||
                        data.avatarUrl ||
                        data.avatar ||
                        video.profilePicture
                };

                cache.set(video.uid, profile);

                Object.assign(video, profile);

            } catch (error) {

                console.warn("Profile load failed:", error);
            }
        });

    await Promise.all(tasks);
}

/* ============================================================
RENDER FEED
============================================================ */

function renderFeed() {

    if (!container || destroyed) {
        return;
    }

    stopAllVideos();

    container.innerHTML = "";

    if (!postVideos.length) {

        showEmpty();

        requestAnimationFrame(setFeedHeight);

        return;
    }

    const feed = document.createElement("div");

    feed.className = "post-reals-feed";

    currentVideos = [];

    postVideos.forEach((video, index) => {

        const card = createVideoCard(video, index);

        feed.appendChild(card);

        currentVideos.push({
            data: video,
            card: card
        });
    });

    container.appendChild(feed);

    /* Set height AFTER the feed is inserted into the DOM. */

    requestAnimationFrame(() => {

        setFeedHeight();

        setupObserver();

        /* TEMPORARY DIAGNOSTIC: shows a popup with the real numbers.
           Delete this whole setTimeout block once scrolling works. */
        setTimeout(() => {

            if (!container) {
                return;
            }

            const f = container.querySelector(".post-reals-feed");

            if (!f) {
                return;
            }

            const cs = getComputedStyle(f);

            alert(
                "clientHeight: " + f.clientHeight +
                "\nscrollHeight: " + f.scrollHeight +
                "\ndisplay: " + cs.display +
                "\noverflowY: " + cs.overflowY +
                "\ncards: " + f.children.length
            );

        }, 1000);

        if (autoplayEnabled && currentVideos.length) {

            const first =
                currentVideos[0].card.querySelector("video");

            if (first) {

                first.muted = startMuted;

                first.play().catch(() => {});
            }
        }
    });
}

/* ============================================================
VIDEO CARD
============================================================ */

function createVideoCard(video, index) {

    const card = document.createElement("article");

    card.className = "reals-video-card post-video-card";

    card.dataset.index = index;

    const videoElement = document.createElement("video");

    videoElement.className = "reals-video";

    videoElement.src = video.video;

    videoElement.playsInline = true;

    videoElement.setAttribute("webkit-playsinline", "");

    videoElement.preload = dataSaverEnabled ? "metadata" : "auto";

    videoElement.muted = startMuted;

    videoElement.loop = true;

    const topGradient = document.createElement("div");
    topGradient.className = "reals-top-gradient";

    const bottomGradient = document.createElement("div");
    bottomGradient.className = "reals-bottom-gradient";

    /* ---------------- PLAY INDICATOR ---------------- */

    const playIndicator = document.createElement("button");

    playIndicator.type = "button";

    playIndicator.className = "reals-play-indicator";

    playIndicator.innerHTML = "▶";

    playIndicator.addEventListener("click", event => {

        event.stopPropagation();

        togglePlay(videoElement, playIndicator);
    });

    videoElement.addEventListener("click", () => {

        togglePlay(videoElement, playIndicator);
    });

    /* ---------------- PROGRESS BAR ---------------- */

    const progressContainer = document.createElement("div");
    progressContainer.className = "video-progress-container";

    const progressTrack = document.createElement("div");
    progressTrack.className = "video-progress-track";

    const progressFill = document.createElement("div");
    progressFill.className = "video-progress-fill";

    const progressThumb = document.createElement("div");
    progressThumb.className = "video-progress-thumb";

    progressTrack.appendChild(progressFill);
    progressTrack.appendChild(progressThumb);
    progressContainer.appendChild(progressTrack);

    let dragging = false;

    function seekFromPointer(event) {

        const rect = progressTrack.getBoundingClientRect();

        if (
            !rect.width ||
            !Number.isFinite(videoElement.duration)
        ) {
            return;
        }

        let position = (event.clientX - rect.left) / rect.width;

        position = Math.max(0, Math.min(1, position));

        videoElement.currentTime = position * videoElement.duration;

        updateProgress(card, videoElement);
    }

    progressTrack.addEventListener("pointerdown", event => {

        event.preventDefault();
        event.stopPropagation();

        dragging = true;

        progressTrack.setPointerCapture?.(event.pointerId);

        seekFromPointer(event);
    });

    progressTrack.addEventListener("pointermove", event => {

        if (!dragging) {
            return;
        }

        event.preventDefault();

        seekFromPointer(event);
    });

    progressTrack.addEventListener("pointerup", event => {

        dragging = false;

        progressTrack.releasePointerCapture?.(event.pointerId);
    });

    progressTrack.addEventListener("pointercancel", () => {

        dragging = false;
    });

    videoElement.addEventListener("timeupdate", () => {

        updateProgress(card, videoElement);
    });

    videoElement.addEventListener("loadedmetadata", () => {

        updateProgress(card, videoElement);
    });

    /* ---------------- ACTIONS ---------------- */

    const actions = document.createElement("div");

    actions.className = "reals-actions";

    const likeButton =
        createActionButton("♡", formatCount(video.likes), "Like");

    const commentButton =
        createActionButton("💬", formatCount(video.comments), "Comment");

    const repostButton =
        createActionButton("⟳", formatCount(video.reposts), "Repost");

    const shareButton =
        createActionButton("↗", formatCount(video.shares), "Share");

    const muteButton =
        createActionButton(startMuted ? "🔇" : "🔊", "", "Mute");

    const moreButton =
        createActionButton("⋮", "", "More");

    actions.append(
        likeButton,
        commentButton,
        repostButton,
        shareButton,
        muteButton,
        moreButton
    );

    likeButton.addEventListener("click", event => {

        event.stopPropagation();

        /* Likes are only given inside the comment section,
           so here we just show a message. No Firebase write,
           no count change. */
        showToast("Enter comment section to like.");
    });

    commentButton.addEventListener("click", event => {

        event.stopPropagation();

        window.location.href =
            `../comments.html?postId=${encodeURIComponent(video.originalId)}`;
    });

    repostButton.addEventListener("click", async event => {

        event.stopPropagation();

        await toggleRepost(video, repostButton);
    });

    shareButton.addEventListener("click", async event => {

        event.stopPropagation();

        await sharePost(video, shareButton);
    });

    muteButton.addEventListener("click", event => {

        event.stopPropagation();

        videoElement.muted = !videoElement.muted;

        const icon = muteButton.querySelector(".action-icon");

        if (icon) {
            icon.textContent = videoElement.muted ? "🔇" : "🔊";
        }
    });

    moreButton.addEventListener("click", event => {

        event.stopPropagation();

        showToast("More options coming soon.");
    });

    /* ---------------- CREATOR ---------------- */

    const info = document.createElement("div");
    info.className = "reals-info";

    const creatorRow = document.createElement("div");
    creatorRow.className = "reals-creator-row";

    const avatar = document.createElement("img");

    avatar.className = "reals-avatar";

    avatar.src =
        video.profilePicture ||
        createAvatarFallback(video.fullName);

    avatar.alt = video.fullName;

    avatar.onerror = () => {

        avatar.src = createAvatarFallback(video.fullName);
    };

    const creatorText = document.createElement("div");
    creatorText.className = "reals-creator-text";

    const name = document.createElement("button");
    name.type = "button";
    name.className = "reals-creator-name";
    name.textContent = video.fullName;

    const username = document.createElement("div");
    username.className = "reals-username";
    username.textContent =
        video.username ? `@${video.username}` : "VitalStar";

    creatorText.append(name, username);

    creatorRow.append(avatar, creatorText);

    creatorRow.addEventListener("click", event => {

        event.stopPropagation();

        if (!video.uid) {
            return;
        }

        window.location.href =
            `../profile.html?uid=${encodeURIComponent(video.uid)}`;
    });

    info.appendChild(creatorRow);

    if (video.text) {

        const caption = document.createElement("div");

        caption.className = "reals-caption";

        caption.textContent = video.text;

        info.appendChild(caption);
    }

    card.append(
        videoElement,
        topGradient,
        bottomGradient,
        playIndicator,
        progressContainer,
        actions,
        info
    );

    return card;
}

/* ============================================================
ACTION BUTTON
============================================================ */

function createActionButton(icon, count, label) {

    const button = document.createElement("button");

    button.type = "button";

    button.className = "reals-action";

    button.setAttribute("aria-label", label);

    const iconElement = document.createElement("span");

    iconElement.className = "action-icon";

    iconElement.textContent = icon;

    button.appendChild(iconElement);

    if (count !== "") {

        const countElement = document.createElement("span");

        countElement.className = "action-count";

        countElement.textContent = count;

        button.appendChild(countElement);
    }

    return button;
}

/* ============================================================
PLAY / PAUSE
============================================================ */

function togglePlay(video, indicator) {

    if (video.paused) {

        video.play()
            .then(() => {
                indicator.style.opacity = "0";
            })
            .catch(() => {});

    } else {

        video.pause();

        indicator.textContent = "▶";

        indicator.style.opacity = "1";
    }
}

/* ============================================================
PROGRESS
============================================================ */

function updateProgress(card, video) {

    const fill = card.querySelector(".video-progress-fill");

    const thumb = card.querySelector(".video-progress-thumb");

    if (!fill || !thumb) {
        return;
    }

    if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0
    ) {
        return;
    }

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                (video.currentTime / video.duration) * 100
            )
        );

    fill.style.width = `${percent}%`;

    thumb.style.left = `${percent}%`;
}

/* ============================================================
TIKTOK-STYLE OBSERVER
============================================================ */

function setupObserver() {

    if (observer) {
        observer.disconnect();
    }

    observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    const video = entry.target.querySelector("video");

                    if (!video) {
                        return;
                    }

                    const playButton =
                        entry.target.querySelector(".reals-play-indicator");

                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.65
                    ) {

                        if (autoplayEnabled) {

                            video.muted = startMuted;

                            video.play()
                                .then(() => {

                                    if (playButton) {
                                        playButton.style.opacity = "0";
                                    }
                                })
                                .catch(() => {});
                        }

                    } else {

                        video.pause();
                    }
                });
            },
            {
                root: container.querySelector(".post-reals-feed"),

                threshold: [0.1, 0.5, 0.65, 0.9]
            }
        );

    currentVideos.forEach(item => {

        observer.observe(item.card);
    });
}

/* ============================================================
STOP VIDEOS
============================================================ */

function stopAllVideos() {

    if (!container) {
        return;
    }

    container
        .querySelectorAll("video")
        .forEach(video => {

            video.pause();

            try {
                video.currentTime = 0;
            } catch {}
        });
}

/* ============================================================
LIKE
============================================================ */

async function toggleLike(video, button) {

    const user = auth.currentUser;

    if (!user) {

        showToast("Please sign in to like this post.");

        return;
    }

    const likeId = `${video.originalId}_${user.uid}`;

    const likeRef = doc(db, "postLikes", likeId);

    try {

        const likeSnap = await getDoc(likeRef);

        const icon = button.querySelector(".action-icon");

        const count = button.querySelector(".action-count");

        if (likeSnap.exists()) {

            await deleteDoc(likeRef);

            await updateDoc(
                doc(db, "posts", video.originalId),
                { likes: increment(-1) }
            );

            video.likes = Math.max(0, video.likes - 1);

            icon.textContent = "♡";

        } else {

            await setDoc(likeRef, {
                uid: user.uid,
                postId: video.originalId,
                createdAt: serverTimestamp()
            });

            await updateDoc(
                doc(db, "posts", video.originalId),
                { likes: increment(1) }
            );

            video.likes++;

            icon.textContent = "♥";

            if (video.uid && video.uid !== user.uid) {

                try {

                    await addDoc(collection(db, "notifications"), {
                        recipientId: video.uid,
                        senderId: user.uid,
                        type: "like",
                        postId: video.originalId,
                        read: false,
                        createdAt: serverTimestamp()
                    });

                } catch (error) {

                    console.warn("Notification failed:", error);
                }
            }
        }

        if (count) {
            count.textContent = formatCount(video.likes);
        }

    } catch (error) {

        console.error("Like error:", error);

        showToast("Unable to update like.");
    }
}

/* ============================================================
REPOST
============================================================ */

async function toggleRepost(video, button) {

    const user = auth.currentUser;

    if (!user) {

        showToast("Please sign in to repost.");

        return;
    }

    const repostId = `${video.originalId}_${user.uid}`;

    const repostRef = doc(db, "postReposts", repostId);

    try {

        const repostSnap = await getDoc(repostRef);

        const icon = button.querySelector(".action-icon");

        const count = button.querySelector(".action-count");

        if (repostSnap.exists()) {

            await deleteDoc(repostRef);

            await updateDoc(
                doc(db, "posts", video.originalId),
                { reposts: increment(-1) }
            );

            video.reposts = Math.max(0, video.reposts - 1);

            icon.textContent = "⟳";

        } else {

            await setDoc(repostRef, {
                uid: user.uid,
                postId: video.originalId,
                createdAt: serverTimestamp()
            });

            await updateDoc(
                doc(db, "posts", video.originalId),
                { reposts: increment(1) }
            );

            video.reposts++;

            icon.textContent = "✓";

            if (video.uid && video.uid !== user.uid) {

                try {

                    await addDoc(collection(db, "notifications"), {
                        recipientId: video.uid,
                        senderId: user.uid,
                        type: "repost",
                        postId: video.originalId,
                        read: false,
                        createdAt: serverTimestamp()
                    });

                } catch (error) {

                    console.warn("Notification failed:", error);
                }
            }
        }

        if (count) {
            count.textContent = formatCount(video.reposts);
        }

    } catch (error) {

        console.error("Repost error:", error);

        showToast("Unable to repost.");
    }
}

/* ============================================================
SHARE
============================================================ */

async function sharePost(video, button) {

    const shareUrl =
        new URL(
            `../comments.html?postId=${encodeURIComponent(video.originalId)}`,
            window.location.href
        ).href;

    try {

        if (navigator.share) {

            await navigator.share({
                title: "VitalStar Post",
                text: video.text || "Check out this video on VitalStar.",
                url: shareUrl
            });

        } else if (navigator.clipboard) {

            await navigator.clipboard.writeText(shareUrl);

            showToast("Video link copied.");
        }

        await updateDoc(
            doc(db, "posts", video.originalId),
            { shares: increment(1) }
        );

        video.shares++;

        const count = button.querySelector(".action-count");

        if (count) {
            count.textContent = formatCount(video.shares);
        }

    } catch (error) {

        if (error?.name !== "AbortError") {

            console.warn("Share error:", error);
        }
    }
}

/* ============================================================
COUNT
============================================================ */

function formatCount(number) {

    number = Number(number || 0);

    if (number >= 1000000) {

        return (
            (number / 1000000)
                .toFixed(1)
                .replace(".0", "") + "M"
        );
    }

    if (number >= 1000) {

        return (
            (number / 1000)
                .toFixed(1)
                .replace(".0", "") + "K"
        );
    }

    return String(number);
}

/* ============================================================
AVATAR FALLBACK
============================================================ */

function createAvatarFallback(name) {

    const letter =
        String(name || "V")
            .trim()
            .charAt(0)
            .toUpperCase() || "V";

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="100"
                 height="100"
                 viewBox="0 0 100 100">
                <rect
                    width="100"
                    height="100"
                    rx="50"
                    fill="#101a35"/>
                <text
                    x="50"
                    y="58"
                    text-anchor="middle"
                    font-size="42"
                    font-family="Arial"
                    fill="#ffffff">${letter}</text>
            </svg>
        `)
    );
}

/* ============================================================
LOADER
============================================================ */

function showLoader() {

    if (!container) {
        return;
    }

    container.innerHTML = `

        <div class="reals-loader">

            <div class="vs-loader">
                <span>VS</span>
            </div>

            <div class="loader-title">
                Loading VitalStar...
            </div>

            <div class="loader-subtitle">
                Loading post videos
            </div>

        </div>

    `;

    requestAnimationFrame(setFeedHeight);
}

/* ============================================================
EMPTY
============================================================ */

function showEmpty() {

    if (!container) {
        return;
    }

    container.innerHTML = `

        <div class="reals-empty">

            <div class="empty-icon">
                ▶
            </div>

            <div class="empty-title">
                No post videos yet
            </div>

            <div class="empty-text">
                Public videos from VitalStar posts will appear here.
            </div>

        </div>

    `;
}

/* ============================================================
ERROR
============================================================ */

function showError(message) {

    if (!container) {
        return;
    }

    container.innerHTML = `

        <div class="reals-empty">

            <div class="empty-icon">
                !
            </div>

            <div class="empty-title">
                Something went wrong
            </div>

            <div class="empty-text">
                ${escapeHtml(message)}
            </div>

        </div>

    `;
}

/* ============================================================
TOAST
============================================================ */

function showToast(message) {

    let toast = document.querySelector(".reals-toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.className = "reals-toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2400);
}

/* ============================================================
ESCAPE HTML
============================================================ */

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ============================================================
SETTINGS CHANGE
============================================================ */

export function onSettingChange(nextSettings = {}) {

    settings = {
        ...settings,
        ...nextSettings
    };

    loadSettings();

    if (!container) {
        return;
    }

    container
        .querySelectorAll("video")
        .forEach(video => {

            video.muted = startMuted;
        });
}

/* ============================================================
DESTROY
============================================================ */

export function destroyPostVids() {

    destroyed = true;

    lastFeedSignature = "";

    if (unsubscribePosts) {

        unsubscribePosts();

        unsubscribePosts = null;
    }

    if (observer) {

        observer.disconnect();

        observer = null;
    }

    if (resizeHandler) {

        window.removeEventListener("resize", resizeHandler);

        window.visualViewport
            ?.removeEventListener("resize", resizeHandler);

        resizeHandler = null;
    }

    stopAllVideos();

    currentVideos = [];

    postVideos = [];

    if (container) {

        container.innerHTML = "";

        container.style.height = "";

        container.style.minHeight = "";

        container.style.maxHeight = "";

        container.style.overflow = "";
    }

    container = null;
}

/* ============================================================
INIT
============================================================ */

export function initPostVids(options = {}) {

    destroyPostVids();

    destroyed = false;

    container =
        options.container ||
        document.querySelector("#realsFeed") ||
        document.querySelector(".reals-feed");

    settings = options.settings || {};

    if (!container) {

        console.error("VitalStar Post Reals: #realsFeed not found.");

        return () => {};
    }

    loadSettings();

    injectStyles();

    resizeHandler = () => {

        requestAnimationFrame(setFeedHeight);
    };

    window.addEventListener(
        "resize",
        resizeHandler,
        { passive: true }
    );

    window.visualViewport
        ?.addEventListener(
            "resize",
            resizeHandler,
            { passive: true }
        );

    initializeFeed();

    requestAnimationFrame(setFeedHeight);

    return destroyPostVids;
}

/* ============================================================
STANDARD INIT
============================================================ */

export function init(options = {}) {

    return initPostVids(options);
}

/* ============================================================
DEFAULT EXPORT
============================================================ */

export default {

    init,

    initPostVids,

    destroyPostVids,

    onSettingChange
};

/* ============================================================
CSS
============================================================ */

function injectStyles() {

    if (document.getElementById("vitalstar-post-reals-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "vitalstar-post-reals-styles";

    style.textContent = `

/* FEED */

.post-reals-feed{
    position:relative !important;
    display:block !important;
    width:100%;
    height:100%;
    min-width:0;
    min-height:0;
    margin:0;
    padding:0;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior-y:contain;
    scroll-snap-type:y mandatory;
    touch-action:pan-y;
    scrollbar-width:none;
    background:#050914;
    box-sizing:border-box;
}

.post-reals-feed::-webkit-scrollbar{
    width:0;
    height:0;
    display:none;
}

/* VIDEO CARD */

.post-video-card{
    position:relative;
    display:block !important;
    width:100%;
    height:100%;
    min-height:100%;
    margin:0;
    padding:0;
    overflow:hidden;
    box-sizing:border-box;
    background:#050914;
    border-radius:0;
    scroll-snap-align:start;
    scroll-snap-stop:always;
    isolation:isolate;
    flex:none;
}

/* VIDEO */

.post-video-card video{
    position:absolute;
    inset:0;
    display:block;
    width:100%;
    height:100%;
    object-fit:cover;
    background:#050914;
    z-index:1;
    cursor:pointer;
    touch-action:pan-y;
}

/* GRADIENTS */

.reals-top-gradient{
    position:absolute;
    top:0;
    left:0;
    right:0;
    height:28%;
    background:linear-gradient(to bottom, rgba(0,0,0,.42), transparent);
    pointer-events:none;
    z-index:2;
}

.reals-bottom-gradient{
    position:absolute;
    left:0;
    right:0;
    bottom:0;
    height:48%;
    background:linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.18), transparent);
    pointer-events:none;
    z-index:2;
}

/* PLAY */

.reals-play-indicator{
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    width:82px;
    height:82px;
    border:0;
    border-radius:50%;
    background:rgba(0,0,0,.46);
    color:#fff;
    font-size:28px;
    display:flex;
    align-items:center;
    justify-content:center;
    padding-left:4px;
    z-index:8;
    opacity:0;
    transition:opacity .16s ease;
    backdrop-filter:blur(4px);
    touch-action:manipulation;
}

/* PROGRESS BAR */

.video-progress-container{
    position:absolute;
    left:0;
    right:0;
    bottom:0;
    height:28px;
    padding:11px 8px;
    box-sizing:border-box;
    z-index:30;
    touch-action:none;
    cursor:pointer;
}

.video-progress-track{
    position:relative;
    width:100%;
    height:4px;
    border-radius:10px;
    background:rgba(255,255,255,.32);
}

.video-progress-fill{
    position:absolute;
    left:0;
    top:0;
    width:0;
    height:100%;
    border-radius:10px;
    background:#fff;
}

.video-progress-thumb{
    position:absolute;
    left:0;
    top:50%;
    width:11px;
    height:11px;
    border-radius:50%;
    background:#fff;
    transform:translate(-50%,-50%);
}

/* ACTIONS */

.reals-actions{
    position:absolute;
    right:8px;
    bottom:72px;
    width:54px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:11px;
    z-index:20;
}

.reals-action{
    width:50px;
    min-height:47px;
    border:0;
    padding:0;
    background:transparent;
    color:#fff;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    text-shadow:0 1px 5px rgba(0,0,0,.75);
    touch-action:manipulation;
}

.action-icon{
    font-size:26px;
    line-height:1;
}

.action-count{
    font-size:11px;
    line-height:1;
    font-weight:500;
}

/* USER INFO */

.reals-info{
    position:absolute;
    left:11px;
    right:67px;
    bottom:17px;
    z-index:20;
    color:#fff;
    pointer-events:none;
}

.reals-creator-row{
    display:flex;
    align-items:center;
    gap:9px;
    width:max-content;
    max-width:100%;
    pointer-events:auto;
    cursor:pointer;
}

.reals-avatar{
    width:37px;
    height:37px;
    border-radius:50%;
    object-fit:cover;
    background:#101a35;
    border:1px solid rgba(255,255,255,.75);
    flex-shrink:0;
}

.reals-creator-text{
    min-width:0;
    display:flex;
    flex-direction:column;
}

.reals-creator-name{
    border:0;
    padding:0;
    background:transparent;
    color:#fff;
    font-size:14px;
    line-height:18px;
    font-weight:650;
    text-align:left;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:220px;
}

.reals-username{
    color:rgba(255,255,255,.72);
    font-size:11px;
    line-height:15px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:220px;
}

.reals-caption{
    margin-top:7px;
    color:#fff;
    font-size:13px;
    line-height:18px;
    max-width:100%;
    display:-webkit-box;
    -webkit-line-clamp:3;
    -webkit-box-orient:vertical;
    overflow:hidden;
    text-shadow:0 1px 5px rgba(0,0,0,.7);
}

/* LOADER / EMPTY */

.reals-loader,
.reals-empty{
    width:100%;
    height:100%;
    min-height:100%;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    box-sizing:border-box;
    text-align:center;
    padding:25px;
    background:#050914;
    color:#fff;
}

.vs-loader{
    width:60px;
    height:60px;
    border-radius:50%;
    border:3px solid rgba(255,255,255,.15);
    border-top-color:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
    animation:vitalstarPostSpin .9s linear infinite;
}

.vs-loader span{
    font-size:17px;
    font-weight:800;
    letter-spacing:1px;
}

.loader-title{
    margin-top:16px;
    font-size:16px;
    font-weight:650;
}

.loader-subtitle{
    margin-top:6px;
    font-size:12px;
    color:rgba(255,255,255,.58);
}

.empty-icon{
    width:58px;
    height:58px;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#101a35;
    font-size:25px;
    margin-bottom:14px;
}

.empty-title{
    font-size:17px;
    font-weight:650;
}

.empty-text{
    margin-top:7px;
    max-width:300px;
    font-size:13px;
    line-height:19px;
    color:rgba(255,255,255,.6);
}

/* TOAST */

.reals-toast{
    position:fixed;
    left:50%;
    bottom:28px;
    transform:translate(-50%,20px);
    max-width:calc(100vw - 36px);
    padding:11px 15px;
    border-radius:10px;
    background:rgba(10,16,34,.94);
    border:1px solid rgba(255,255,255,.12);
    color:#fff;
    font-size:13px;
    text-align:center;
    opacity:0;
    pointer-events:none;
    transition:opacity .2s ease, transform .2s ease;
    z-index:99999;
}

.reals-toast.show{
    opacity:1;
    transform:translate(-50%,0);
}

@keyframes vitalstarPostSpin{
    to{ transform:rotate(360deg); }
}

@media(max-width:600px){

    .post-reals-feed{
        overflow-y:auto !important;
        overflow-x:hidden !important;
        touch-action:pan-y;
        scroll-snap-type:y mandatory;
        -webkit-overflow-scrolling:touch;
    }

    .post-video-card{
        width:100%;
        height:100%;
        min-height:100%;
        margin:0;
        padding:0;
        border-radius:0;
        scroll-snap-align:start;
        scroll-snap-stop:always;
    }
}

`;

    document.head.appendChild(style);
}
