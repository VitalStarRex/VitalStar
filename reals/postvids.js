// ============================================================
// VITALSTAR — POST REALS
// postvids.js
// ============================================================

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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// STATE
// ============================================================

let container = null;
let settings = null;

let unsubscribePosts = null;
let observer = null;

let postVideos = new Map();
let currentVideos = [];

let destroyed = false;

let autoplayEnabled = true;
let mutedEnabled = true;
let dataSaverEnabled = false;

let resizeHandler = null;
let lastFeedSignature = "";


// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {

    autoplayEnabled =
        localStorage.getItem("vitalstar_reals_autoplay") !== "false";

    mutedEnabled =
        localStorage.getItem("vitalstar_reals_muted") !== "false";

    dataSaverEnabled =
        localStorage.getItem("vitalstar_reals_dataSaver") === "true";
}


// ============================================================
// FEED HEIGHT
// ============================================================

function setFeedHeight() {

    if (!container) return;

    const viewportHeight = window.innerHeight;

    const header =
        document.querySelector(".reals-header");

    const tabs =
        document.querySelector(".reals-tabs");

    let occupiedHeight = 0;

    if (header) {
        occupiedHeight += header.getBoundingClientRect().height;
    }

    if (tabs) {
        occupiedHeight += tabs.getBoundingClientRect().height;
    }

    const feedHeight =
        Math.max(1, viewportHeight - occupiedHeight);

    container.style.height = `${feedHeight}px`;
    container.style.maxHeight = `${feedHeight}px`;
    container.style.minHeight = "0";

    const feed =
        container.querySelector(".post-reals-feed");

    if (feed) {
        feed.style.height = `${feedHeight}px`;
        feed.style.maxHeight = `${feedHeight}px`;
    }

    container
        .querySelectorAll(".post-real-card")
        .forEach(card => {

            card.style.height = `${feedHeight}px`;
            card.style.minHeight = `${feedHeight}px`;
            card.style.maxHeight = `${feedHeight}px`;

        });
}


// ============================================================
// PUBLIC VIDEO CHECK
// ============================================================

function isPublicNormalVideo(data) {

    if (!data) return false;

    const privacy =
        String(
            data.privacy ??
            data.visibility ??
            "Public"
        ).toLowerCase();

    if (
        privacy === "only me" ||
        privacy === "private" ||
        privacy === "friends"
    ) {
        return false;
    }

    const mediaType =
        String(data.mediaType || "").toLowerCase();

    const mediaURL =
        data.mediaURL ||
        data.videoURL ||
        data.videoUrl ||
        data.video ||
        "";

    if (!mediaURL) return false;

    return (
        mediaType === "video" ||
        mediaType.includes("video") ||
        /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(mediaURL)
    );
}


// ============================================================
// CLOUDINARY VIDEO URL
// ============================================================

function getPlayableVideoUrl(url) {

    if (!url) return "";

    try {

        if (
            url.includes("res.cloudinary.com") &&
            url.includes("/video/upload/") &&
            !url.includes("/f_mp4/")
        ) {

            return url.replace(
                "/video/upload/",
                "/video/upload/f_mp4/"
            );

        }

    } catch (error) {

        console.warn(
            "Cloudinary URL conversion failed:",
            error
        );

    }

    return url;
}


// ============================================================
// NORMALIZE POST
// ============================================================

function normalizePost(id, data) {

    const mediaURL =
        data.mediaURL ||
        data.videoURL ||
        data.videoUrl ||
        data.video ||
        "";

    return {

        ...data,

        originalId: id,

        mediaURL:
            getPlayableVideoUrl(mediaURL),

        mediaType:
            data.mediaType || "video",

        authorId:
            data.authorId ||
            data.uid ||
            data.userId ||
            data.ownerId ||
            "",

        text:
            data.text ||
            data.caption ||
            "",

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
// INITIALIZE FEED
// ============================================================

function initializeFeed() {

    if (!container || destroyed) return;

    showLoader();

    const postsRef =
        collection(db, "posts");

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

                if (destroyed) return;

                const videos = [];

                snapshot.forEach(item => {

                    const data = item.data();

                    if (
                        isPublicNormalVideo(data)
                    ) {

                        videos.push(
                            normalizePost(
                                item.id,
                                data
                            )
                        );

                    }

                });

                const uniqueVideos =
                    Array.from(
                        new Map(
                            videos.map(video => [
                                video.originalId,
                                video
                            ])
                        ).values()
                    );

                const signature =
                    uniqueVideos
                        .map(video => video.originalId)
                        .join("|");

                if (
                    signature === lastFeedSignature
                ) {
                    return;
                }

                lastFeedSignature =
                    signature;

                currentVideos =
                    uniqueVideos;

                if (!currentVideos.length) {

                    showEmpty();

                    return;
                }

                await loadMissingProfiles(
                    currentVideos
                );

                if (destroyed) return;

                renderFeed(
                    currentVideos
                );

            },

            error => {

                console.error(
                    "Post Reals error:",
                    error
                );

                showError(
                    "Unable to load Post Reals."
                );

            }
        );
}


// ============================================================
// LOAD PROFILES
// ============================================================

async function loadMissingProfiles(videos) {

    const ids =
        [
            ...new Set(
                videos
                    .map(video => video.authorId)
                    .filter(Boolean)
            )
        ];

    await Promise.all(
        ids.map(async uid => {

            try {

                const userSnap =
                    await getDoc(
                        doc(
                            db,
                            "users",
                            uid
                        )
                    );

                if (
                    userSnap.exists()
                ) {

                    const profile =
                        userSnap.data();

                    videos.forEach(video => {

                        if (
                            video.authorId === uid
                        ) {

                            video.profile =
                                profile;

                        }

                    });

                }

            } catch (error) {

                console.warn(
                    "Profile load failed:",
                    uid,
                    error
                );

            }

        })
    );
}


// ============================================================
// RENDER FEED
// ============================================================

function renderFeed(videos) {

    if (!container) return;

    container.innerHTML = "";

    const feed =
        document.createElement("div");

    feed.className =
        "post-reals-feed";

    container.appendChild(feed);

    videos.forEach(video => {

        feed.appendChild(
            createVideoCard(video)
        );

    });

    setFeedHeight();

    setupObserver();

    if (autoplayEnabled) {

        setTimeout(() => {

            if (!destroyed) {

                playFirstVisibleVideo();

            }

        }, 100);

    }
}


// ============================================================
// CREATE VIDEO CARD
// ============================================================

function createVideoCard(video) {

    const card =
        document.createElement("article");

    card.className =
        "post-real-card";

    card.dataset.postId =
        video.originalId;


    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    const videoElement =
        document.createElement("video");

    videoElement.className =
        "post-real-video";

    videoElement.src =
        video.mediaURL;

    videoElement.playsInline =
        true;

    videoElement.preload =
        dataSaverEnabled
            ? "metadata"
            : "auto";

    videoElement.muted =
        mutedEnabled;

    videoElement.loop =
        true;

    videoElement.setAttribute(
        "playsinline",
        ""
    );

    videoElement.setAttribute(
        "webkit-playsinline",
        ""
    );


    // --------------------------------------------------------
    // GRADIENT
    // --------------------------------------------------------

    const gradient =
        document.createElement("div");

    gradient.className =
        "post-real-gradient";


    // --------------------------------------------------------
    // PLAY INDICATOR
    // --------------------------------------------------------

    const playIndicator =
        document.createElement("div");

    playIndicator.className =
        "post-real-play";

    playIndicator.textContent =
        "▶";


    // --------------------------------------------------------
    // PROGRESS
    // --------------------------------------------------------

    const progress =
        document.createElement("div");

    progress.className =
        "post-real-progress";

    const progressBar =
        document.createElement("div");

    progressBar.className =
        "post-real-progress-bar";

    progress.appendChild(
        progressBar
    );


    // --------------------------------------------------------
    // ACTIONS
    // --------------------------------------------------------

    const actions =
        document.createElement("div");

    actions.className =
        "post-real-actions";


    // LIKE
    const likeButton =
        createActionButton(
            "♡",
            formatCount(video.likes),
            "Like"
        );


    // COMMENT
    const commentButton =
        createActionButton(
            "💬",
            formatCount(video.comments),
            "Comment"
        );


    // REPOST
    const repostButton =
        createActionButton(
            "⟳",
            formatCount(video.reposts),
            "Repost"
        );


    // SHARE
    const shareButton =
        createActionButton(
            "↗",
            "",
            "Share"
        );


    // MUTE
    const muteButton =
        createActionButton(
            videoElement.muted
                ? "🔇"
                : "🔊",
            "",
            "Mute"
        );


    // MORE
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


    // --------------------------------------------------------
    // CREATOR
    // --------------------------------------------------------

    const creator =
        document.createElement("div");

    creator.className =
        "post-real-creator";


    const avatar =
        document.createElement("div");

    avatar.className =
        "post-real-avatar";


    const profilePicture =
        video.profile?.profilePicture ||
        video.profile?.photoURL ||
        video.profile?.avatar ||
        "";


    if (profilePicture) {

        avatar.style.backgroundImage =
            `url("${profilePicture}")`;

        avatar.style.backgroundSize =
            "cover";

        avatar.style.backgroundPosition =
            "center";

    } else {

        avatar.appendChild(
            createAvatarFallback(
                video.profile
            )
        );

    }


    const creatorText =
        document.createElement("div");

    creatorText.className =
        "post-real-creator-text";


    const name =
        document.createElement("strong");

    name.textContent =
        video.profile?.fullName ||
        video.profile?.username ||
        "VitalStar User";


    const username =
        document.createElement("span");

    username.textContent =
        video.profile?.username
            ? `@${video.profile.username}`
            : "";


    creatorText.appendChild(
        name
    );

    creatorText.appendChild(
        username
    );


    creator.appendChild(
        avatar
    );

    creator.appendChild(
        creatorText
    );


    // --------------------------------------------------------
    // CAPTION
    // --------------------------------------------------------

    const caption =
        document.createElement("div");

    caption.className =
        "post-real-caption";

    caption.textContent =
        video.text || "";


    // --------------------------------------------------------
    // APPEND
    // --------------------------------------------------------

    card.appendChild(
        videoElement
    );

    card.appendChild(
        gradient
    );

    card.appendChild(
        playIndicator
    );

    card.appendChild(
        progress
    );

    card.appendChild(
        actions
    );

    card.appendChild(
        creator
    );

    if (video.text) {

        card.appendChild(
            caption
        );

    }


    // ========================================================
    // VIDEO PLAY / PAUSE
    // ========================================================

    videoElement.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            togglePlay(
                videoElement,
                playIndicator
            );

        }
    );


    // ========================================================
    // LIKE BUTTON
    // ONLY SHOWS POPUP
    // DOES NOT OPEN comments.html
    // DOES NOT LIKE THE VIDEO
    // ========================================================

    likeButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            showToast(
                "Enter comment section to like this video"
            );

        }
    );


    // ========================================================
    // COMMENT BUTTON
    // THIS ONE OPENS comments.html
    // ========================================================

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


    // ========================================================
    // REPOST
    // ========================================================

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


    // ========================================================
    // SHARE
    // ========================================================

    shareButton.addEventListener(
        "click",
        async event => {

            event.stopPropagation();

            await sharePost(
                video
            );

        }
    );


    // ========================================================
    // MUTE
    // ========================================================

    muteButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            videoElement.muted =
                !videoElement.muted;

            const icon =
                muteButton.querySelector(
                    ".action-icon"
                );

            if (icon) {

                icon.textContent =
                    videoElement.muted
                        ? "🔇"
                        : "🔊";

            }

        }
    );


    // ========================================================
    // MORE
    // ========================================================

    moreButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            showToast(
                "More options coming soon"
            );

        }
    );


    // ========================================================
    // PROGRESS
    // ========================================================

    videoElement.addEventListener(
        "timeupdate",
        () => {

            updateProgress(
                videoElement,
                progressBar
            );

        }
    );


    progress.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            if (!videoElement.duration) {
                return;
            }

            const rect =
                progress.getBoundingClientRect();

            const percentage =
                (event.clientX - rect.left) /
                rect.width;

            videoElement.currentTime =
                videoElement.duration *
                Math.max(
                    0,
                    Math.min(
                        1,
                        percentage
                    )
                );

        }
    );


    videoElement.addEventListener(
        "play",
        () => {

            playIndicator.style.opacity =
                "0";

        }
    );


    videoElement.addEventListener(
        "pause",
        () => {

            playIndicator.style.opacity =
                "1";

        }
    );


    postVideos.set(
        video.originalId,
        videoElement
    );


    return card;
}


// ============================================================
// ACTION BUTTON
// ============================================================

function createActionButton(
    icon,
    count,
    label
) {

    const button =
        document.createElement("button");

    button.className =
        "post-real-action";

    button.type =
        "button";

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


    button.appendChild(
        iconElement
    );


    if (count !== "") {

        const countElement =
            document.createElement("span");

        countElement.className =
            "action-count";

        countElement.textContent =
            count;

        button.appendChild(
            countElement
        );

    }


    return button;
}


// ============================================================
// PLAY / PAUSE
// ============================================================

function togglePlay(
    video,
    indicator
) {

    if (video.paused) {

        stopAllVideos(
            video
        );

        video.play()
            .catch(() => {});

    } else {

        video.pause();

        indicator.style.opacity =
            "1";

    }
}


// ============================================================
// PROGRESS
// ============================================================

function updateProgress(
    video,
    bar
) {

    if (
        !video.duration ||
        !isFinite(video.duration)
    ) {
        return;
    }

    const percentage =
        (
            video.currentTime /
            video.duration
        ) * 100;

    bar.style.width =
        `${percentage}%`;
}


// ============================================================
// OBSERVER
// ============================================================

function setupObserver() {

    if (observer) {

        observer.disconnect();

    }


    const feed =
        container?.querySelector(
            ".post-reals-feed"
        );

    if (!feed) return;


    observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    const video =
                        entry.target.querySelector(
                            ".post-real-video"
                        );

                    if (!video) return;


                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.7
                    ) {

                        if (autoplayEnabled) {

                            stopAllVideos(
                                video
                            );

                            video.play()
                                .catch(() => {});

                        }

                    } else {

                        video.pause();

                    }

                });

            },
            {
                root: feed,
                threshold: [
                    0.7,
                    0.9
                ]
            }
        );


    feed
        .querySelectorAll(
            ".post-real-card"
        )
        .forEach(card => {

            observer.observe(
                card
            );

        });
}


// ============================================================
// FIRST VISIBLE VIDEO
// ============================================================

function playFirstVisibleVideo() {

    const feed =
        container?.querySelector(
            ".post-reals-feed"
        );

    if (!feed) return;


    const cards =
        [
            ...feed.querySelectorAll(
                ".post-real-card"
            )
        ];

    if (!cards.length) return;


    const feedRect =
        feed.getBoundingClientRect();

    let closestCard = null;
    let closestDistance = Infinity;


    cards.forEach(card => {

        const rect =
            card.getBoundingClientRect();

        const center =
            rect.top +
            rect.height / 2;

        const feedCenter =
            feedRect.top +
            feedRect.height / 2;

        const distance =
            Math.abs(
                center -
                feedCenter
            );


        if (
            distance <
            closestDistance
        ) {

            closestDistance =
                distance;

            closestCard =
                card;

        }

    });


    if (!closestCard) return;


    const video =
        closestCard.querySelector(
            ".post-real-video"
        );

    if (!video) return;


    stopAllVideos(
        video
    );

    video.play()
        .catch(() => {});
}


// ============================================================
// STOP ALL VIDEOS
// ============================================================

function stopAllVideos(
    exceptVideo = null
) {

    document
        .querySelectorAll(
            ".post-real-video"
        )
        .forEach(video => {

            if (
                video !== exceptVideo
            ) {

                video.pause();

            }

        });
}


// ============================================================
// REPOST
// ============================================================

async function toggleRepost(
    video,
    button
) {

    const user =
        auth.currentUser;

    if (!user) {

        showToast(
            "Please sign in first"
        );

        return;
    }


    const repostRef =
        doc(
            db,
            "posts",
            video.originalId,
            "reposts",
            user.uid
        );


    try {

        const existing =
            await getDoc(
                repostRef
            );


        if (existing.exists()) {

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
                    Number(
                        video.reposts || 0
                    ) - 1
                );


            updateActionCount(
                button,
                video.reposts
            );


            showToast(
                "Repost removed"
            );

        } else {

            await setDoc(
                repostRef,
                {
                    uid:
                        user.uid,

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


            video.reposts =
                Number(
                    video.reposts || 0
                ) + 1;


            updateActionCount(
                button,
                video.reposts
            );


            showToast(
                "Video reposted"
            );

        }

    } catch (error) {

        console.error(
            "Repost error:",
            error
        );

        showToast(
            "Unable to repost video"
        );

    }
}


// ============================================================
// UPDATE ACTION COUNT
// ============================================================

function updateActionCount(
    button,
    value
) {

    const count =
        button.querySelector(
            ".action-count"
        );

    if (count) {

        count.textContent =
            formatCount(value);

    }
}


// ============================================================
// SHARE
// ============================================================

async function sharePost(
    video
) {

    const url =
        `${window.location.origin}/comments.html?postId=${encodeURIComponent(
            video.originalId
        )}`;


    try {

        if (
            navigator.share
        ) {

            await navigator.share({
                title:
                    "VitalStar Video",

                text:
                    "Check out this video on VitalStar",

                url
            });

        } else if (
            navigator.clipboard
        ) {

            await navigator.clipboard.writeText(
                url
            );

            showToast(
                "Link copied"
            );

        } else {

            showToast(
                "Sharing is not supported"
            );

        }

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
// FORMAT COUNT
// ============================================================

function formatCount(
    number
) {

    number =
        Number(number || 0);


    if (number >= 1000000) {

        return (
            number / 1000000
        )
            .toFixed(1)
            .replace(".0", "") +
            "M";

    }


    if (number >= 1000) {

        return (
            number / 1000
        )
            .toFixed(1)
            .replace(".0", "") +
            "K";

    }


    return String(number);
}


// ============================================================
// AVATAR FALLBACK
// ============================================================

function createAvatarFallback(
    profile
) {

    const fallback =
        document.createElement(
            "span"
        );

    const name =
        profile?.fullName ||
        profile?.username ||
        "V";


    fallback.textContent =
        name
            .trim()
            .charAt(0)
            .toUpperCase();


    return fallback;
}


// ============================================================
// LOADER
// ============================================================

function showLoader() {

    if (!container) return;

    container.innerHTML = `
        <div class="post-reals-loader">
            <div class="vs-loader">VS</div>
            <div>Loading Post Reals...</div>
        </div>
    `;

}


// ============================================================
// EMPTY
// ============================================================

function showEmpty() {

    if (!container) return;

    container.innerHTML = `
        <div class="post-reals-empty">
            <div class="empty-icon">🎬</div>

            <div class="empty-title">
                No Post Videos Yet
            </div>

            <div class="empty-text">
                Public videos from VitalStar posts will appear here.
            </div>
        </div>
    `;

}


// ============================================================
// ERROR
// ============================================================

function showError(
    message
) {

    if (!container) return;

    container.innerHTML = `
        <div class="post-reals-empty">

            <div class="empty-icon">
                ⚠️
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


// ============================================================
// TOAST
// ============================================================

function showToast(
    message
) {

    let toast =
        document.querySelector(
            ".reals-toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

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
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2200);
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
    value
) {

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


// ============================================================
// SETTINGS CHANGE
// ============================================================

function onSettingChange() {

    loadSettings();


    document
        .querySelectorAll(
            ".post-real-video"
        )
        .forEach(video => {

            video.muted =
                mutedEnabled;

        });


    if (autoplayEnabled) {

        playFirstVisibleVideo();

    } else {

        stopAllVideos();

    }
}


// ============================================================
// DESTROY
// ============================================================

function destroyPostVids() {

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


    if (resizeHandler) {

        window.removeEventListener(
            "resize",
            resizeHandler
        );

        resizeHandler =
            null;

    }


    stopAllVideos();


    postVideos.clear();

    currentVideos = [];

    lastFeedSignature = "";

}


// ============================================================
// INIT
// ============================================================

function initPostVids(
    targetContainer,
    options = {}
) {

    destroyPostVids();

    destroyed = false;

    container =
        targetContainer;

    settings =
        options;


    loadSettings();


    resizeHandler =
        () => {

            setFeedHeight();

        };


    window.addEventListener(
        "resize",
        resizeHandler
    );


    initializeFeed();

}


// ============================================================
// SETTINGS EVENT
// ============================================================

window.addEventListener(
    "vitalstar-reals-settings-change",
    onSettingChange
);


// ============================================================
// AUTO INIT
// ============================================================

function init() {

    const feed =
        document.querySelector(
            "#realsContent"
        );


    if (!feed) return;


    initPostVids(
        feed
    );

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();

}


// ============================================================
// EXPORT
// ============================================================

export {
    initPostVids,
    destroyPostVids
};