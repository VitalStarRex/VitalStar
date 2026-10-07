/* ============================================================
VITALSTAR — POST REALS
postvids.js

Shows ONLY videos from the normal "posts" collection.
No group videos.
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

let videos = [];
let currentVideos = [];

let destroyed = false;

let autoplayEnabled = true;
let startMuted = true;
let dataSaverEnabled = false;

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
VIDEO URL
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

    finalUrl = finalUrl.replace(
        "/video/upload/",
        "/video/upload/f_mp4/"
    );
}

return finalUrl;

}

/* ============================================================
CHECK NORMAL POST VIDEO
============================================================ */

function isNormalPostVideo(data) {

if (!data || typeof data !== "object") {
    return false;
}

const privacy = String(
    data.privacy ||
    data.visibility ||
    "public"
).toLowerCase();

/*
   Only public posts appear in Reals.
*/

if (
    privacy === "only me" ||
    privacy === "onlyme" ||
    privacy === "private" ||
    privacy === "friends" ||
    privacy === "friends only"
) {
    return false;
}

const videoUrl =
    data.video ||
    data.videoUrl ||
    data.videoURL ||
    (
        data.mediaType &&
        String(data.mediaType).toLowerCase().startsWith("video")
            ? data.mediaURL
            : ""
    );

if (!videoUrl) {
    return false;
}

const mediaType = String(
    data.mediaType || ""
).toLowerCase();

const lowerUrl = String(videoUrl).toLowerCase();

const isVideoType =
    mediaType === "video" ||
    mediaType.startsWith("video/");

const isVideoExtension =
    /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(lowerUrl);

const isCloudinaryVideo =
    lowerUrl.includes("res.cloudinary.com") &&
    lowerUrl.includes("/video/upload/");

return (
    isVideoType ||
    isVideoExtension ||
    isCloudinaryVideo ||
    !!data.video ||
    !!data.videoUrl ||
    !!data.videoURL
);

}

/* ============================================================
NORMALIZE POST
============================================================ */

function normalizePost(id, data) {

if (!isNormalPostVideo(data)) {
    return null;
}

const video =
    data.video ||
    data.videoUrl ||
    data.videoURL ||
    data.mediaURL ||
    "";

if (!video) {
    return null;
}

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

    likes:
        Number(data.likes || 0),

    comments:
        Number(data.comments || 0),

    reposts:
        Number(data.reposts || 0),

    shares:
        Number(data.shares || 0),

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
LOAD POSTS
============================================================ */

function initializeFeed() {

if (destroyed) {
    return;
}

showLoader();

const postsRef = collection(db, "posts");

const postsQuery = query(
    postsRef,
    orderBy("createdAt", "desc"),
    limit(200)
);

unsubscribePosts = onSnapshot(
    postsQuery,
    async snapshot => {

        if (destroyed) {
            return;
        }

        const loaded = [];

        snapshot.forEach(postDoc => {

            const data = postDoc.data();

            const normalized =
                normalizePost(
                    postDoc.id,
                    data
                );

            if (normalized) {
                loaded.push(normalized);
            }
        });

        /*
           Extra protection against duplicates.
        */

        const unique = new Map();

        loaded.forEach(video => {

            if (!unique.has(video.originalId)) {
                unique.set(
                    video.originalId,
                    video
                );
            }
        });

        videos = Array.from(
            unique.values()
        ).sort(
            (a, b) =>
                b.createdAt - a.createdAt
        );

        await loadMissingProfiles();

        if (!destroyed) {
            renderFeed();
        }
    },

    error => {

        console.error(
            "VitalStar Post Reals error:",
            error
        );

        if (!destroyed) {
            showError(
                "Unable to load post videos."
            );
        }
    }
);

}

/* ============================================================
LOAD MISSING PROFILES
============================================================ */

async function loadMissingProfiles() {

const cache = new Map();

const tasks = videos.map(
    async video => {

        if (!video.uid) {
            return;
        }

        /*
           If the post already has profile information,
           still use it. Only fetch when important
           information is missing.
        */

        if (
            video.fullName !== "VitalStar User" &&
            video.profilePicture
        ) {
            return;
        }

        if (cache.has(video.uid)) {

            const cached =
                cache.get(video.uid);

            Object.assign(
                video,
                cached
            );

            return;
        }

        try {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        video.uid
                    )
                );

            if (!userSnap.exists()) {
                return;
            }

            const data =
                userSnap.data();

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

            cache.set(
                video.uid,
                profile
            );

            Object.assign(
                video,
                profile
            );

        } catch (error) {

            console.warn(
                "Profile load failed:",
                error
            );
        }
    }
);

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

container.className =
    "reals-feed post-reals-feed";

if (!videos.length) {

    showEmpty();

    return;
}

const fragment =
    document.createDocumentFragment();

currentVideos = [];

videos.forEach(
    (video, index) => {

        const card =
            createVideoCard(
                video,
                index
            );

        fragment.appendChild(card);

        currentVideos.push({
            data: video,
            card
        });
    }
);

container.appendChild(fragment);

setupObserver();

requestAnimationFrame(() => {

    if (
        autoplayEnabled &&
        currentVideos.length
    ) {

        const first =
            currentVideos[0]
                .card
                .querySelector("video");

        if (first) {
            first.muted = startMuted;

            first.play()
                .catch(() => {});
        }
    }
});

}

/* ============================================================
CREATE VIDEO CARD
============================================================ */

function createVideoCard(video, index) {

const card =
    document.createElement("article");

card.className =
    "reals-video-card post-video-card";

card.dataset.index = index;

const videoElement =
    document.createElement("video");

videoElement.className =
    "reals-video";

videoElement.src =
    video.video;

videoElement.playsInline = true;

videoElement.preload =
    dataSaverEnabled
        ? "metadata"
        : "auto";

videoElement.muted =
    startMuted;

videoElement.loop = true;

videoElement.setAttribute(
    "webkit-playsinline",
    ""
);

if (dataSaverEnabled) {
    videoElement.setAttribute(
        "preload",
        "metadata"
    );
}


/* ========================================================
   VIDEO EVENTS
   ======================================================== */

videoElement.addEventListener(
    "timeupdate",
    () => {

        updateProgress(
            card,
            videoElement
        );
    }
);

videoElement.addEventListener(
    "loadedmetadata",
    () => {

        updateProgress(
            card,
            videoElement
        );
    }
);


/* ========================================================
   BACKGROUND GRADIENTS
   ======================================================== */

const topGradient =
    document.createElement("div");

topGradient.className =
    "reals-top-gradient";


const bottomGradient =
    document.createElement("div");

bottomGradient.className =
    "reals-bottom-gradient";


/* ========================================================
   CENTER PLAY BUTTON
   ======================================================== */

const playIndicator =
    document.createElement("button");

playIndicator.className =
    "reals-play-indicator";

playIndicator.type =
    "button";

playIndicator.innerHTML =
    "▶";

playIndicator.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        togglePlay(
            videoElement,
            playIndicator
        );
    }
);


/* ========================================================
   VIDEO CLICK
   ======================================================== */

videoElement.addEventListener(
    "click",
    () => {

        togglePlay(
            videoElement,
            playIndicator
        );
    }
);


/* ========================================================
   PROGRESS BAR
   ======================================================== */

const progressContainer =
    document.createElement("div");

progressContainer.className =
    "video-progress-container";

const progressTrack =
    document.createElement("div");

progressTrack.className =
    "video-progress-track";

const progressFill =
    document.createElement("div");

progressFill.className =
    "video-progress-fill";

const progressThumb =
    document.createElement("div");

progressThumb.className =
    "video-progress-thumb";

progressTrack.appendChild(
    progressFill
);

progressTrack.appendChild(
    progressThumb
);

progressContainer.appendChild(
    progressTrack
);


let dragging = false;


function seekFromPointer(event) {

    const rect =
        progressTrack.getBoundingClientRect();

    let position =
        (event.clientX - rect.left) /
        rect.width;

    position =
        Math.max(
            0,
            Math.min(1, position)
        );

    if (
        Number.isFinite(
            videoElement.duration
        ) &&
        videoElement.duration > 0
    ) {

        videoElement.currentTime =
            position *
            videoElement.duration;

        updateProgress(
            card,
            videoElement
        );
    }
}


progressTrack.addEventListener(
    "pointerdown",
    event => {

        event.preventDefault();
        event.stopPropagation();

        dragging = true;

        progressTrack.setPointerCapture?.(
            event.pointerId
        );

        seekFromPointer(event);
    }
);


progressTrack.addEventListener(
    "pointermove",
    event => {

        if (!dragging) {
            return;
        }

        event.preventDefault();

        seekFromPointer(event);
    }
);


progressTrack.addEventListener(
    "pointerup",
    event => {

        dragging = false;

        progressTrack.releasePointerCapture?.(
            event.pointerId
        );
    }
);


progressTrack.addEventListener(
    "pointercancel",
    () => {

        dragging = false;
    }
);


/* ========================================================
   RIGHT ACTIONS
   ======================================================== */

const actions =
    document.createElement("div");

actions.className =
    "reals-actions";


const likeButton =
    createActionButton(
        "♡",
        formatCount(video.likes),
        "Like"
    );


const commentButton =
    createActionButton(
        "💬",
        formatCount(video.comments),
        "Comment"
    );


const repostButton =
    createActionButton(
        "⟳",
        formatCount(video.reposts),
        "Repost"
    );


const shareButton =
    createActionButton(
        "↗",
        formatCount(video.shares),
        "Share"
    );


const muteButton =
    createActionButton(
        startMuted ? "🔇" : "🔊",
        "",
        "Mute"
    );


const moreButton =
    createActionButton(
        "⋮",
        "",
        "More"
    );


actions.appendChild(
    likeButton
);

actions.appendChild(
    commentButton
);

actions.appendChild(
    repostButton
);

actions.appendChild(
    shareButton
);

actions.appendChild(
    muteButton
);

actions.appendChild(
    moreButton
);


/* ========================================================
   LIKE
   ======================================================== */

likeButton.addEventListener(
    "click",
    async event => {

        event.stopPropagation();

        await toggleLike(
            video,
            likeButton
        );
    }
);


/* ========================================================
   COMMENT
   ======================================================== */

commentButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        window.location.href =
            `../comments.html?postId=${encodeURIComponent(
                video.originalId
            )}`;
    }
);


/* ========================================================
   REPOST
   ======================================================== */

repostButton.addEventListener(
    "click",
    async event => {

        event.stopPropagation();

        await toggleRepost(
            video,
            repostButton
        );
    }
);


/* ========================================================
   SHARE
   ======================================================== */

shareButton.addEventListener(
    "click",
    async event => {

        event.stopPropagation();

        await sharePost(
            video,
            shareButton
        );
    }
);


/* ========================================================
   MUTE
   ======================================================== */

muteButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        videoElement.muted =
            !videoElement.muted;

        muteButton.querySelector(
            ".action-icon"
        ).textContent =
            videoElement.muted
                ? "🔇"
                : "🔊";
    }
);


/* ========================================================
   MORE
   ======================================================== */

moreButton.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        showToast(
            "More options coming soon."
        );
    }
);


/* ========================================================
   CREATOR INFO
   ======================================================== */

const info =
    document.createElement("div");

info.className =
    "reals-info";


const creatorRow =
    document.createElement("div");

creatorRow.className =
    "reals-creator-row";


const avatar =
    document.createElement("img");

avatar.className =
    "reals-avatar";

avatar.src =
    video.profilePicture ||
    createAvatarFallback(
        video.fullName
    );

avatar.alt =
    video.fullName;

avatar.onerror =
    () => {

        avatar.src =
            createAvatarFallback(
                video.fullName
            );
    };


const creatorText =
    document.createElement("div");

creatorText.className =
    "reals-creator-text";


const name =
    document.createElement("button");

name.type =
    "button";

name.className =
    "reals-creator-name";

name.textContent =
    video.fullName;


const username =
    document.createElement("div");

username.className =
    "reals-username";

username.textContent =
    video.username
        ? `@${video.username}`
        : "VitalStar";


creatorText.appendChild(
    name
);

creatorText.appendChild(
    username
);


creatorRow.appendChild(
    avatar
);

creatorRow.appendChild(
    creatorText
);


/*
   Open the normal user's profile.
*/

creatorRow.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        if (!video.uid) {
            return;
        }

        window.location.href =
            `../profile.html?uid=${encodeURIComponent(
                video.uid
            )}`;
    }
);


info.appendChild(
    creatorRow
);


if (video.text) {

    const caption =
        document.createElement("div");

    caption.className =
        "reals-caption";

    caption.textContent =
        video.text;

    info.appendChild(
        caption
    );
}


/* ========================================================
   CARD ASSEMBLY
   ======================================================== */

card.appendChild(
    videoElement
);

card.appendChild(
    topGradient
);

card.appendChild(
    bottomGradient
);

card.appendChild(
    playIndicator
);

card.appendChild(
    progressContainer
);

card.appendChild(
    actions
);

card.appendChild(
    info
);


/* ========================================================
   VIDEO ERROR
   ======================================================== */

videoElement.addEventListener(
    "error",
    () => {

        showToast(
            "This video could not be played."
        );
    }
);


return card;

}

/* ============================================================
ACTION BUTTON
============================================================ */

function createActionButton(
icon,
count,
label
) {

const button =
    document.createElement("button");

button.type =
    "button";

button.className =
    "reals-action";

button.setAttribute(
    "aria-label",
    label
);

const iconElement =
    document.createElement("span");

iconElement.className =
    "action-icon";

iconElement.textContent =
    icon;


const countElement =
    document.createElement("span");

countElement.className =
    "action-count";

countElement.textContent =
    count;


button.appendChild(
    iconElement
);

if (count !== "") {

    button.appendChild(
        countElement
    );
}

return button;

}

/* ============================================================
PLAY / PAUSE
============================================================ */

function togglePlay(
video,
indicator
) {

if (video.paused) {

    video.play()
        .then(() => {

            indicator.style.opacity =
                "0";

        })
        .catch(() => {});

} else {

    video.pause();

    indicator.textContent =
        "▶";

    indicator.style.opacity =
        "1";
}

}

/* ============================================================
PROGRESS
============================================================ */

function updateProgress(
card,
video
) {

const fill =
    card.querySelector(
        ".video-progress-fill"
    );

const thumb =
    card.querySelector(
        ".video-progress-thumb"
    );

if (!fill || !thumb) {
    return;
}

if (
    !Number.isFinite(
        video.duration
    ) ||
    video.duration <= 0
) {
    fill.style.width =
        "0%";

    thumb.style.left =
        "0%";

    return;
}

const percent =
    Math.max(
        0,
        Math.min(
            100,
            (video.currentTime /
                video.duration) *
                100
        )
    );

fill.style.width =
    `${percent}%`;

thumb.style.left =
    `${percent}%`;

}

/* ============================================================
INTERSECTION OBSERVER
============================================================ */

function setupObserver() {

if (observer) {
    observer.disconnect();
}

observer =
    new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                const video =
                    entry.target.querySelector(
                        "video"
                    );

                if (!video) {
                    return;
                }

                if (
                    entry.isIntersecting &&
                    entry.intersectionRatio >= 0.65
                ) {

                    if (autoplayEnabled) {

                        video.muted =
                            startMuted;

                        video.play()
                            .catch(() => {});
                    }

                    entry.target
                        .querySelector(
                            ".reals-play-indicator"
                        )
                        ?.style
                        .setProperty(
                            "opacity",
                            "0"
                        );

                } else {

                    video.pause();
                }
            });
        },
        {
            threshold: [
                0,
                0.35,
                0.65,
                0.9
            ]
        }
    );


currentVideos.forEach(item => {

    observer.observe(
        item.card
    );
});

}

/* ============================================================
STOP ALL VIDEOS
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
LIKE SYSTEM
============================================================ */

async function toggleLike(
video,
button
) {

const user =
    auth.currentUser;

if (!user) {

    showToast(
        "Please sign in to like this post."
    );

    return;
}

const likeId =
    `${video.originalId}_${user.uid}`;

const likeRef =
    doc(
        db,
        "postLikes",
        likeId
    );

try {

    const likeSnap =
        await getDoc(likeRef);

    const icon =
        button.querySelector(
            ".action-icon"
        );

    const count =
        button.querySelector(
            ".action-count"
        );

    if (likeSnap.exists()) {

        await deleteDoc(
            likeRef
        );

        await updateDoc(
            doc(
                db,
                "posts",
                video.originalId
            ),
            {
                likes:
                    increment(-1)
            }
        );

        video.likes =
            Math.max(
                0,
                video.likes - 1
            );

        icon.textContent =
            "♡";

    } else {

        await setDoc(
            likeRef,
            {
                uid: user.uid,
                postId:
                    video.originalId,
                createdAt:
                    serverTimestamp()
            }
        );

        await updateDoc(
            doc(
                db,
                "posts",
                video.originalId
            ),
            {
                likes:
                    increment(1)
            }
        );

        video.likes++;

        icon.textContent =
            "♥";

        /*
           Notification to post owner.
        */

        if (
            video.uid &&
            video.uid !== user.uid
        ) {

            try {

                await addDoc(
                    collection(
                        db,
                        "notifications"
                    ),
                    {
                        recipientId:
                            video.uid,

                        senderId:
                            user.uid,

                        type:
                            "like",

                        postId:
                            video.originalId,

                        read:
                            false,

                        createdAt:
                            serverTimestamp()
                    }
                );

            } catch (notificationError) {

                console.warn(
                    "Like notification failed:",
                    notificationError
                );
            }
        }
    }

    if (count) {
        count.textContent =
            formatCount(
                video.likes
            );
    }

} catch (error) {

    console.error(
        "Like error:",
        error
    );

    showToast(
        "Unable to update like."
    );
}

}

/* ============================================================
REPOST SYSTEM
============================================================ */

async function toggleRepost(
video,
button
) {

const user =
    auth.currentUser;

if (!user) {

    showToast(
        "Please sign in to repost."
    );

    return;
}

const repostId =
    `${video.originalId}_${user.uid}`;

const repostRef =
    doc(
        db,
        "postReposts",
        repostId
    );

try {

    const repostSnap =
        await getDoc(
            repostRef
        );

    const icon =
        button.querySelector(
            ".action-icon"
        );

    const count =
        button.querySelector(
            ".action-count"
        );

    if (repostSnap.exists()) {

        await deleteDoc(
            repostRef
        );

        await updateDoc(
            doc(
                db,
                "posts",
                video.originalId
            ),
            {
                reposts:
                    increment(-1)
            }
        );

        video.reposts =
            Math.max(
                0,
                video.reposts - 1
            );

        icon.textContent =
            "⟳";

    } else {

        await setDoc(
            repostRef,
            {
                uid: user.uid,
                postId:
                    video.originalId,
                createdAt:
                    serverTimestamp()
            }
        );

        await updateDoc(
            doc(
                db,
                "posts",
                video.originalId
            ),
            {
                reposts:
                    increment(1)
            }
        );

        video.reposts++;

        icon.textContent =
            "✓";


        if (
            video.uid &&
            video.uid !== user.uid
        ) {

            try {

                await addDoc(
                    collection(
                        db,
                        "notifications"
                    ),
                    {
                        recipientId:
                            video.uid,

                        senderId:
                            user.uid,

                        type:
                            "repost",

                        postId:
                            video.originalId,

                        read:
                            false,

                        createdAt:
                            serverTimestamp()
                    }
                );

            } catch (notificationError) {

                console.warn(
                    "Repost notification failed:",
                    notificationError
                );
            }
        }
    }

    if (count) {

        count.textContent =
            formatCount(
                video.reposts
            );
    }

} catch (error) {

    console.error(
        "Repost error:",
        error
    );

    showToast(
        "Unable to repost."
    );
}

}

/* ============================================================
SHARE
============================================================ */

async function sharePost(
video,
button
) {

const shareUrl =
    new URL(
        `../comments.html?postId=${encodeURIComponent(
            video.originalId
        )}`,
        window.location.href
    ).href;

try {

    if (
        navigator.share
    ) {

        await navigator.share({
            title:
                "VitalStar Post",
            text:
                video.text ||
                "Check out this video on VitalStar.",
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
            "Video link copied."
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

    video.shares++;

    const count =
        button.querySelector(
            ".action-count"
        );

    if (count) {

        count.textContent =
            formatCount(
                video.shares
            );
    }

} catch (error) {

    /*
       User cancelling the native share sheet
       should not show an error.
    */

    if (
        error?.name !==
        "AbortError"
    ) {

        console.warn(
            "Share error:",
            error
        );
    }
}

}

/* ============================================================
COUNT FORMAT
============================================================ */

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

/* ============================================================
AVATAR FALLBACK
============================================================ */

function createAvatarFallback(
name
) {

const letter =
    String(name || "V")
        .trim()
        .charAt(0)
        .toUpperCase() ||
    "V";

return (
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="100"
             height="100"
             viewBox="0 0 100 100">
            <rect width="100"
                  height="100"
                  rx="50"
                  fill="#101a35"/>
            <text x="50"
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

container.className =
    "reals-feed post-reals-feed";

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
        <div class="empty-icon">▶</div>
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
        <div class="empty-icon">!</div>
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

let toast =
    document.querySelector(
        ".reals-toast"
    );

if (!toast) {

    toast =
        document.createElement("div");

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
        2400
    );

}

/* ============================================================
ESCAPE HTML
============================================================ */

function escapeHtml(value) {

return String(value || "")
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

/* ============================================================
SETTINGS CHANGE
============================================================ */

export function onSettingChange(
nextSettings = {}
) {

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

        video.muted =
            startMuted;
    });

container
    .querySelectorAll(
        ".reals-action"
    )
    .forEach(button => {

        const label =
            button.getAttribute(
                "aria-label"
            );

        if (label === "Mute") {

            const video =
                button
                    .closest(
                        ".reals-video-card"
                    )
                    ?.querySelector(
                        "video"
                    );

            const icon =
                button.querySelector(
                    ".action-icon"
                );

            if (icon && video) {

                icon.textContent =
                    video.muted
                        ? "🔇"
                        : "🔊";
            }
        }
    });

}

/* ============================================================
DESTROY
============================================================ */

export function destroyPostVids() {

destroyed = true;

if (unsubscribePosts) {

    unsubscribePosts();

    unsubscribePosts =
        null;
}

if (observer) {

    observer.disconnect();

    observer =
        null;
}

stopAllVideos();

currentVideos = [];

videos = [];

if (container) {
    container.innerHTML = "";
}

container = null;

}

/* ============================================================
INIT
============================================================ */

export function initPostVids(
options = {}
) {

destroyPostVids();

destroyed = false;

container =
    options.container ||
    document.querySelector(
        "#realsFeed"
    ) ||
    document.querySelector(
        ".reals-feed"
    );

settings =
    options.settings || {};

if (!container) {

    console.error(
        "VitalStar Post Reals: #realsFeed not found."
    );

    return () => {};
}

loadSettings();

injectStyles();

initializeFeed();

return destroyPostVids;

}

/* ============================================================
COMPATIBILITY INIT
============================================================ */

export function init(
options = {}
) {

return initPostVids(
    options
);

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
STYLES
============================================================ */

function injectStyles() {

if (
    document.getElementById(
        "vitalstar-post-reals-styles"
    )
) {
    return;
}

const style =
    document.createElement("style");

style.id =
    "vitalstar-post-reals-styles";

style.textContent = `

.post-reals-feed{
    width:100%;
    height:100%;
    overflow-y:auto;
    overflow-x:hidden;
    scroll-snap-type:y mandatory;
    overscroll-behavior-y:contain;
    background:#050914;
    scrollbar-width:none;
    padding:2dvh 0;
}

.post-reals-feed::-webkit-scrollbar{
    display:none;
}

.post-video-card{
    position:relative;
    width:100%;
    height:94dvh;
    margin:0 0 2dvh;
    overflow:hidden;
    background:#050914;
    border-radius:10px;
    scroll-snap-align:center;
    isolation:isolate;
}

.post-video-card video{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    background:#050914;
    z-index:1;
    cursor:pointer;
}

.reals-top-gradient{
    position:absolute;
    inset:0 0 auto 0;
    height:28%;
    background:linear-gradient(
        to bottom,
        rgba(0,0,0,.45),
        transparent
    );
    pointer-events:none;
    z-index:2;
}

.reals-bottom-gradient{
    position:absolute;
    inset:auto 0 0 0;
    height:48%;
    background:linear-gradient(
        to top,
        rgba(0,0,0,.82),
        rgba(0,0,0,.20),
        transparent
    );
    pointer-events:none;
    z-index:2;
}

.reals-play-indicator{
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    width:88px;
    height:88px;
    border:none;
    border-radius:50%;
    background:rgba(0,0,0,.46);
    color:#fff;
    font-size:30px;
    display:flex;
    align-items:center;
    justify-content:center;
    padding-left:4px;
    z-index:7;
    opacity:0;
    transition:opacity .16s ease;
    backdrop-filter:blur(4px);
    cursor:pointer;
}

.video-progress-container{
    position:absolute;
    left:0;
    right:0;
    bottom:0;
    height:25px;
    padding:10px 8px;
    z-index:10;
    cursor:pointer;
    touch-action:none;
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
    height:100%;
    width:0%;
    border-radius:10px;
    background:#fff;
}

.video-progress-thumb{
    position:absolute;
    top:50%;
    left:0%;
    width:11px;
    height:11px;
    border-radius:50%;
    background:#fff;
    transform:translate(-50%,-50%);
    box-shadow:0 1px 5px rgba(0,0,0,.4);
}

.reals-actions{
    position:absolute;
    right:11px;
    bottom:72px;
    width:55px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:13px;
    z-index:8;
}

.reals-action{
    width:52px;
    min-height:48px;
    border:none;
    background:transparent;
    color:#fff;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    cursor:pointer;
    text-shadow:0 1px 5px rgba(0,0,0,.75);
}

.action-icon{
    font-size:27px;
    line-height:1;
    font-weight:400;
}

.action-count{
    font-size:11px;
    line-height:1;
    font-weight:500;
}

.reals-info{
    position:absolute;
    left:13px;
    right:72px;
    bottom:18px;
    z-index:8;
    color:#fff;
}

.reals-creator-row{
    display:flex;
    align-items:center;
    gap:9px;
    width:max-content;
    max-width:100%;
    cursor:pointer;
}

.reals-avatar{
    width:38px;
    height:38px;
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
    border:none;
    background:transparent;
    padding:0;
    color:#fff;
    font-size:14px;
    line-height:18px;
    font-weight:650;
    text-align:left;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:220px;
    cursor:pointer;
}

.reals-username{
    color:rgba(255,255,255,.75);
    font-size:11px;
    line-height:15px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:220px;
}

.reals-caption{
    margin-top:7px;
    font-size:13px;
    line-height:19px;
    color:#fff;
    max-width:100%;
    display:-webkit-box;
    -webkit-line-clamp:3;
    -webkit-box-orient:vertical;
    overflow:hidden;
    text-shadow:0 1px 5px rgba(0,0,0,.7);
}

.reals-loader,
.reals-empty{
    width:100%;
    min-height:100%;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:30px;
    box-sizing:border-box;
    color:#fff;
    background:#050914;
}

.vs-loader{
    width:62px;
    height:62px;
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
    animation:vitalstarPostCounterSpin .9s linear infinite;
}

.loader-title{
    margin-top:18px;
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
    margin-bottom:15px;
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
    transition:
        opacity .2s ease,
        transform .2s ease;
    z-index:99999;
    box-shadow:0 8px 30px rgba(0,0,0,.35);
}

.reals-toast.show{
    opacity:1;
    transform:translate(-50%,0);
}

@keyframes vitalstarPostSpin{
    to{
        transform:rotate(360deg);
    }
}

@keyframes vitalstarPostCounterSpin{
    to{
        transform:rotate(-360deg);
    }
}

@media(max-width:600px){

    .post-video-card{
        height:94dvh;
        border-radius:8px;
    }

    .reals-play-indicator{
        width:82px;
        height:82px;
        font-size:28px;
    }

    .reals-actions{
        right:8px;
        bottom:70px;
        gap:11px;
    }

    .reals-action{
        width:49px;
    }

    .action-icon{
        font-size:25px;
    }

    .reals-info{
        left:11px;
        right:67px;
        bottom:17px;
    }

    .reals-avatar{
        width:36px;
        height:36px;
    }

    .reals-creator-name{
        font-size:13px;
        max-width:190px;
    }

    .reals-caption{
        font-size:12.5px;
        line-height:18px;
    }
}

`;

document.head.appendChild(
    style
);

}