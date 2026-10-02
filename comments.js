// ============================================================
// VITALSTAR — COMMENTS.JS
// Navy + Glowing Blue Theme
// Posts / Comments / Likes / Replies / Shares / Notifications
// Firebase v10.12.2
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    increment,
    deleteDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// VITALSTAR NAVY / BLUE THEME
// ============================================================

const VS_THEME = `
<style>

:root {
    --vs-navy: #020817;
    --vs-navy-2: #06152b;
    --vs-blue: #1683ff;
    --vs-blue-light: #42adff;
    --vs-glow: rgba(20, 130, 255, .55);
    --vs-border: rgba(40, 150, 255, .28);
    --vs-text: #f3f8ff;
    --vs-muted: #91a8c5;
}

body {
    background:
        radial-gradient(
            circle at 50% -10%,
            rgba(0, 115, 255, .22),
            transparent 42%
        ),
        linear-gradient(
            145deg,
            #010611,
            #031126 48%,
            #020817
        ) !important;

    color: var(--vs-text) !important;
    min-height: 100vh;
}

#postContainer,
#commentList {
    width: min(700px, 94%);
    margin-left: auto;
    margin-right: auto;
}

.comment,
.post-preview {
    background:
        linear-gradient(
            145deg,
            rgba(7, 25, 49, .97),
            rgba(2, 12, 28, .99)
        ) !important;

    color: var(--vs-text) !important;

    border: 1px solid var(--vs-border) !important;

    border-radius: 18px !important;

    box-shadow:
        0 0 18px rgba(0, 100, 255, .12),
        inset 0 0 20px rgba(0, 120, 255, .025) !important;

    transition:
        border-color .25s ease,
        box-shadow .25s ease,
        transform .25s ease;
}

.comment:hover {
    border-color: rgba(45, 155, 255, .5) !important;

    box-shadow:
        0 0 25px rgba(20, 125, 255, .20),
        inset 0 0 25px rgba(20, 125, 255, .035) !important;
}

.comment-header,
.comment-header b {
    color: #fff !important;
}

.comment-header small {
    color: var(--vs-muted) !important;
}

.comment-avatar {
    background:
        linear-gradient(
            135deg,
            #061a35,
            #0b5ec4
        ) !important;

    border: 2px solid rgba(35, 150, 255, .55);

    box-shadow:
        0 0 12px rgba(20, 130, 255, .35);

    color: #70c4ff !important;
}

.comment a {
    color: #fff !important;
}

.comment a:hover {
    color: var(--vs-blue-light) !important;
}

.comment-text {
    color: #e7f1ff !important;
    line-height: 1.55;
}

.comment-photo {
    border-radius: 14px !important;

    border: 1px solid rgba(50, 155, 255, .25);

    box-shadow:
        0 0 18px rgba(20, 110, 255, .12);

    max-width: 100%;
}

.comment-actions,
.post-actions {
    border-top: 1px solid rgba(50, 145, 255, .12);

    margin-top: 12px;

    padding-top: 8px;
}

.comment-actions button,
.post-actions button {
    color: #9ecbff !important;

    border-radius: 12px !important;

    transition:
        background .2s ease,
        color .2s ease,
        box-shadow .2s ease,
        transform .2s ease;
}

.comment-actions button:hover,
.post-actions button:hover {
    color: #fff !important;

    background:
        rgba(20, 125, 255, .13) !important;

    box-shadow:
        0 0 14px rgba(20, 130, 255, .25);

    transform: translateY(-1px);
}

.comment-like-btn,
.post-like-btn {
    color: #72bdff !important;
}

.comment-like-btn:hover,
.post-like-btn:hover {
    color: #fff !important;

    text-shadow:
        0 0 10px #1683ff;
}

.comment-reply-btn,
.post-share-btn {
    color: #72bdff !important;
}

.reply {
    margin-left: 35px;

    margin-top: 8px;

    padding: 10px;

    border-left:
        3px solid #168cff !important;

    border-radius: 0 12px 12px 0;

    background:
        rgba(4, 20, 42, .72) !important;

    box-shadow:
        -5px 0 15px rgba(20, 130, 255, .08);
}

.reply b {
    color: #fff !important;
}

.reply small {
    color: #7894b3 !important;
}

.reply p {
    color: #dceaff !important;
}

[id^="replyBox-"] {
    margin-top: 8px;
}

[id^="replyBox-"] input {
    background:
        rgba(2, 15, 34, .96) !important;

    color: #fff !important;

    border:
        1px solid rgba(35, 145, 255, .35) !important;

    border-radius: 20px !important;

    box-shadow:
        inset 0 0 10px rgba(0, 100, 255, .08);

    outline: none;
}

[id^="replyBox-"] input::placeholder {
    color: #7892af !important;
}

[id^="replyBox-"] input:focus {
    border-color: #1683ff !important;

    box-shadow:
        0 0 12px rgba(20, 130, 255, .35),
        inset 0 0 10px rgba(0, 100, 255, .08);
}

[id^="replyBox-"] button {
    background:
        linear-gradient(
            135deg,
            #075bc7,
            #168cff
        ) !important;

    color: #fff !important;

    border:
        1px solid rgba(90, 190, 255, .5) !important;

    box-shadow:
        0 0 12px rgba(20, 130, 255, .35);
}

[id^="replyBox-"] button:hover {
    box-shadow:
        0 0 20px rgba(20, 140, 255, .65);
}

#commentText {
    background:
        rgba(2, 15, 34, .96) !important;

    color: #fff !important;

    border:
        1px solid rgba(40, 150, 255, .35) !important;

    border-radius: 18px !important;

    box-shadow:
        inset 0 0 15px rgba(0, 100, 255, .07);
}

#commentText::placeholder {
    color: #7189a6 !important;
}

#commentText:focus {
    border-color: #168cff !important;

    box-shadow:
        0 0 15px rgba(20, 130, 255, .35),
        inset 0 0 15px rgba(0, 100, 255, .08);
}

#sendCommentBtn {
    background:
        linear-gradient(
            135deg,
            #075bc7,
            #168cff
        ) !important;

    color: #fff !important;

    border:
        1px solid rgba(80, 185, 255, .55) !important;

    box-shadow:
        0 0 14px rgba(20, 130, 255, .4);

    border-radius: 14px !important;
}

#sendCommentBtn:hover {
    box-shadow:
        0 0 24px rgba(20, 140, 255, .7);
}

#commentingIndicator {
    background:
        linear-gradient(
            135deg,
            rgba(2, 20, 45, .98),
            rgba(4, 45, 85, .98)
        ) !important;

    color: #75c5ff !important;

    border:
        1px solid rgba(40, 155, 255, .45);

    border-radius: 14px;

    box-shadow:
        0 0 20px rgba(20, 130, 255, .3);

    text-align: center;

    padding: 10px 14px;
}

.comment video {
    background: #010712;

    border-radius: 14px;

    border:
        1px solid rgba(40, 150, 255, .25);
}

@media (max-width: 600px) {

    #postContainer,
    #commentList {
        width: 94%;
    }

    .comment,
    .post-preview {
        border-radius: 16px !important;
    }

}

</style>
`;

document.head.insertAdjacentHTML(
    "beforeend",
    VS_THEME
);


// ============================================================
// ELEMENTS
// ============================================================

const commentList =
    document.getElementById("commentList");

const postContainer =
    document.getElementById("postContainer");


// ============================================================
// POST ID
// ============================================================

const params =
    new URLSearchParams(window.location.search);

const postId =
    params.get("postId");

if (!postId) {

    console.error("Post ID not found.");

    throw new Error("Missing postId");

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href = "login.html";

    }

    updatePostLikeState();

});


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ============================================================
// GET CURRENT USER DATA
// ============================================================

async function getCurrentUserData() {

    const user =
        auth.currentUser;

    if (!user) return null;

    const userSnap =
        await getDoc(
            doc(
                db,
                "users",
                user.uid
            )
        );

    if (!userSnap.exists()) {

        return {

            uid: user.uid,

            username: "username",

            fullName: "VitalStar User",

            profilePicture: ""

        };

    }

    const data =
        userSnap.data();

    return {

        uid: user.uid,

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

}


// ============================================================
// CREATE NOTIFICATION
// ============================================================

async function createNotification({
    receiverId,
    sender,
    type,
    postId,
    commentId = null,
    text
}) {

    if (!receiverId || !sender) return;

    if (receiverId === sender.uid) return;

    const notification = {

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

        read: false,

        createdAt:
            serverTimestamp()

    };

    if (commentId) {

        notification.commentId =
            commentId;

    }

    await addDoc(
        collection(
            db,
            "notifications"
        ),
        notification
    );

}


// ============================================================
// LOAD POST
// ============================================================

async function loadPost() {

    try {

        const postSnap =
            await getDoc(
                doc(
                    db,
                    "posts",
                    postId
                )
            );

        if (!postSnap.exists()) {

            if (postContainer) {

                postContainer.innerHTML = `

                    <div
                        style="
                            text-align:center;
                            padding:30px;
                            color:#7894b3;
                        "
                    >
                        Post not found.
                    </div>

                `;

            }

            return;

        }

        const post =
            postSnap.data();

        let date =
            "Just now";

        if (post.createdAt) {

            try {

                date =
                    post.createdAt
                        .toDate()
                        .toLocaleString();

            } catch (error) {}

        }

        if (!postContainer) return;

        postContainer.innerHTML = `

            <div class="comment post-preview">

                <div class="comment-header">

                    <div class="comment-avatar">

                        ${
                            post.profilePicture
                            ?
                            `
                            <img
                                src="${escapeHTML(
                                    post.profilePicture
                                )}"
                                style="
                                    width:100%;
                                    height:100%;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                            >
                            `
                            :
                            "👤"
                        }

                    </div>

                    <div>

                        <b>

                            <a
                                href="profile.html?uid=${encodeURIComponent(
                                    post.uid || ""
                                )}"
                                style="
                                    text-decoration:none;
                                "
                            >
                                ${escapeHTML(
                                    post.fullName ||
                                    "VitalStar User"
                                )}
                            </a>

                        </b>

                        <br>

                        <small>
                            ${escapeHTML(date)}
                        </small>

                    </div>

                </div>

                ${
                    post.text
                    ?
                    `
                    <p class="comment-text">
                        ${escapeHTML(post.text)}
                    </p>
                    `
                    :
                    ""
                }

                ${
                    post.image
                    ?
                    `
                    <img
                        class="comment-photo"
                        src="${escapeHTML(post.image)}"
                    >
                    `
                    :
                    ""
                }

                ${
                    post.video
                    ?
                    `
                    <video
                        class="comment-photo"
                        controls
                    >
                        <source
                            src="${escapeHTML(post.video)}"
                            type="video/mp4"
                        >
                    </video>
                    `
                    :
                    ""
                }

                <div
                    class="comment-actions post-actions"
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                    "
                >

                    <button
                        type="button"
                        id="postLikeBtn"
                        class="post-like-btn"
                        aria-label="Like post"
                        title="Like post"
                    >
                        ❤️
                        <span id="postLikeCount">
                            ${post.likes || 0}
                        </span>
                    </button>

                    <span>
                        💬
                        ${post.comments || 0}
                    </span>

                    <button
                        type="button"
                        id="postShareBtn"
                        class="post-share-btn"
                        aria-label="Share post"
                        title="Share post"
                    >
                        🔗
                        <span id="shareCount">
                            ${post.shares || 0}
                        </span>
                    </button>

                </div>

            </div>

        `;

        const likeButton =
            document.getElementById(
                "postLikeBtn"
            );

        if (likeButton) {

            likeButton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();

                    window.likePost();

                }
            );

        }

        const shareButton =
            document.getElementById(
                "postShareBtn"
            );

        if (shareButton) {

            shareButton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();

                    window.sharePost();

                }
            );

        }

        await updatePostLikeState();

    } catch (error) {

        console.error(
            "Load post error:",
            error
        );

    }

}

loadPost();


// ============================================================
// UPDATE POST LIKE STATE
// ============================================================

async function updatePostLikeState() {

    const user =
        auth.currentUser;

    if (!user) return;

    const likeId =
        `${postId}_${user.uid}`;

    const likeSnap =
        await getDoc(
            doc(
                db,
                "postLikes",
                likeId
            )
        );

    const button =
        document.getElementById(
            "postLikeBtn"
        );

    if (!button) return;

    button.setAttribute(
        "aria-pressed",
        likeSnap.exists()
            ? "true"
            : "false"
    );

}


// ============================================================
// POST LIKE
// ============================================================

window.likePost =
async function() {

    try {

        const user =
            auth.currentUser;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        const postRef =
            doc(
                db,
                "posts",
                postId
            );

        const likeId =
            `${postId}_${user.uid}`;

        const likeRef =
            doc(
                db,
                "postLikes",
                likeId
            );

        const [
            likeSnap,
            postSnap
        ] = await Promise.all([

            getDoc(likeRef),

            getDoc(postRef)

        ]);

        if (!postSnap.exists()) return;

        const post =
            postSnap.data();

        const userData =
            await getCurrentUserData();

        const count =
            document.getElementById(
                "postLikeCount"
            );

        if (likeSnap.exists()) {

            await deleteDoc(likeRef);

            await updateDoc(
                postRef,
                {
                    likes:
                        increment(-1)
                }
            );

            if (count) {

                count.textContent =
                    Math.max(
                        0,
                        Number(count.textContent) - 1
                    );

            }

            return;

        }

        await setDoc(
            likeRef,
            {
                postId,
                uid: user.uid,
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

        if (count) {

            count.textContent =
                Number(count.textContent) + 1;

        }

        await createNotification({

            receiverId:
                post.uid,

            sender:
                userData,

            type:
                "post_like",

            postId,

            text:
                "liked your post."

        });

    } catch (error) {

        console.error(
            "Post like error:",
            error
        );

    }

};


// ============================================================
// LOAD COMMENTS
// ============================================================

const commentsQuery =
    query(

        collection(
            db,
            "comments"
        ),

        where(
            "postId",
            "==",
            postId
        ),

        orderBy(
            "createdAt",
            "desc"
        )

    );

onSnapshot(

    commentsQuery,

    (snapshot) => {

        if (!commentList) return;

        commentList.innerHTML = "";

        if (snapshot.empty) {

            commentList.innerHTML = `

                <div
                    style="
                        text-align:center;
                        padding:25px;
                        color:#7894b3;
                    "
                >
                    No comments yet.
                </div>

            `;

            return;

        }

        snapshot.forEach(
            (commentSnap) => {

                renderComment(
                    commentSnap.id,
                    commentSnap.data()
                );

            }
        );

    },

    (error) => {

        console.error(
            "Comments listener error:",
            error
        );

    }

);


// ============================================================
// RENDER COMMENT
// ============================================================

function renderComment(
    commentId,
    comment
) {

    if (!commentList) return;

    let date =
        "Just now";

    if (comment.createdAt) {

        try {

            date =
                comment.createdAt
                    .toDate()
                    .toLocaleString();

        } catch (error) {}

    }

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "comment";

    element.innerHTML = `

        <div class="comment-header">

            <div class="comment-avatar">

                ${
                    comment.profilePicture
                    ?
                    `
                    <img
                        src="${escapeHTML(
                            comment.profilePicture
                        )}"
                        style="
                            width:100%;
                            height:100%;
                            border-radius:50%;
                            object-fit:cover;
                        "
                    >
                    `
                    :
                    "👤"
                }

            </div>

            <div>

                <b>

                    <a
                        href="profile.html?uid=${encodeURIComponent(
                            comment.uid || ""
                        )}"
                        style="
                            text-decoration:none;
                        "
                    >
                        ${escapeHTML(
                            comment.fullName ||
                            "VitalStar User"
                        )}
                    </a>

                </b>

                <br>

                <span
                    style="
                        color:#43a9ff;
                        font-size:13px;
                    "
                >
                    @${escapeHTML(
                        comment.username ||
                        "username"
                    )}
                </span>

                <br>

                <small>
                    ${escapeHTML(date)}
                </small>

            </div>

        </div>

        ${
            comment.text
            ?
            `
            <p class="comment-text">
                ${escapeHTML(comment.text)}
            </p>
            `
            :
            ""
        }

        ${
            comment.image
            ?
            `
            <img
                class="comment-photo"
                src="${escapeHTML(comment.image)}"
            >
            `
            :
            ""
        }

        <div
            class="comment-actions"
            style="
                display:flex;
                align-items:center;
                gap:8px;
            "
        >

            <button
                type="button"
                class="comment-like-btn"
                data-comment-like="${commentId}"
                aria-label="Like comment"
                title="Like comment"
            >
                ❤️
                <span>
                    ${comment.likes || 0}
                </span>
            </button>

            <button
                type="button"
                class="comment-reply-btn"
                data-comment-reply="${commentId}"
            >
                💬 Reply
            </button>

        </div>

        <div id="replyBox-${commentId}"></div>

        <div id="replies-${commentId}"></div>

    `;

    commentList.appendChild(element);

    const likeButton =
        element.querySelector(
            "[data-comment-like]"
        );

    if (likeButton) {

        likeButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                window.likeComment(
                    commentId
                );

            }
        );

    }

    const replyButton =
        element.querySelector(
            "[data-comment-reply]"
        );

    if (replyButton) {

        replyButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                window.showReplyBox(
                    commentId
                );

            }
        );

    }

    loadReplies(commentId);

}


// ============================================================
// COMMENTING INDICATOR
// ============================================================

function showCommentingIndicator(text) {

    const indicator =
        document.getElementById(
            "commentingIndicator"
        );

    if (!indicator) return;

    indicator.textContent =
        text;

    indicator.style.display =
        "block";

}

function hideCommentingIndicator() {

    const indicator =
        document.getElementById(
            "commentingIndicator"
        );

    if (!indicator) return;

    indicator.style.display =
        "none";

}


// ============================================================
// SEND COMMENT
// ============================================================

window.sendComment =
async function() {

    const sendButton =
        document.getElementById(
            "sendCommentBtn"
        );

    try {

        const textElement =
            document.getElementById(
                "commentText"
            );

        const imageElement =
            document.getElementById(
                "commentImage"
            );

        const text =
            textElement
                ? textElement.value.trim()
                : "";

        const imageFile =
            imageElement &&
            imageElement.files &&
            imageElement.files[0]
                ? imageElement.files[0]
                : null;

        if (!text && !imageFile) return;

        const user =
            auth.currentUser;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        showCommentingIndicator(
            "💬 Posting comment..."
        );

        if (sendButton) {

            sendButton.disabled = true;

            sendButton.style.opacity =
                ".6";

        }

        const userData =
            await getCurrentUserData();

        let imageUrl = "";

        if (imageFile) {

            showCommentingIndicator(
                "📤 Uploading image..."
            );

            const formData =
                new FormData();

            formData.append(
                "file",
                imageFile
            );

            formData.append(
                "upload_preset",
                "vitalstar_upload"
            );

            const response =
                await fetch(
                    "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload",
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!data.secure_url) {

                throw new Error(
                    "Image upload failed."
                );

            }

            imageUrl =
                data.secure_url;

        }

        showCommentingIndicator(
            "💬 Posting comment..."
        );

        await addDoc(
            collection(
                db,
                "comments"
            ),
            {

                postId,

                uid:
                    user.uid,

                username:
                    userData.username,

                fullName:
                    userData.fullName,

                profilePicture:
                    userData.profilePicture,

                text,

                image:
                    imageUrl,

                likes: 0,

                replies: 0,

                createdAt:
                    serverTimestamp()

            }
        );

        await updateDoc(
            doc(
                db,
                "posts",
                postId
            ),
            {
                comments:
                    increment(1)
            }
        );

        const postSnap =
            await getDoc(
                doc(
                    db,
                    "posts",
                    postId
                )
            );

        if (postSnap.exists()) {

            const post =
                postSnap.data();

            await createNotification({

                receiverId:
                    post.uid,

                sender:
                    userData,

                type:
                    "comment",

                postId,

                text:
                    "commented on your post."

            });

        }

        if (textElement) {

            textElement.value =
                "";

        }

        if (imageElement) {

            imageElement.value =
                "";

        }

        showCommentingIndicator(
            "✓ Comment posted"
        );

        setTimeout(
            hideCommentingIndicator,
            1200
        );

    } catch (error) {

        console.error(
            "Comment error:",
            error
        );

        showCommentingIndicator(
            "⚠️ Failed to post comment"
        );

        setTimeout(
            hideCommentingIndicator,
            2000
        );

    } finally {

        if (sendButton) {

            sendButton.disabled =
                false;

            sendButton.style.opacity =
                "1";

        }

    }

};


// ============================================================
// LIKE COMMENT
// ============================================================

window.likeComment =
async function(commentId) {

    try {

        const user =
            auth.currentUser;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        const likeId =
            `${commentId}_${user.uid}`;

        const likeRef =
            doc(
                db,
                "commentLikes",
                likeId
            );

        const commentRef =
            doc(
                db,
                "comments",
                commentId
            );

        const [
            likeSnap,
            commentSnap
        ] = await Promise.all([

            getDoc(likeRef),

            getDoc(commentRef)

        ]);

        if (!commentSnap.exists()) return;

        const comment =
            commentSnap.data();

        const userData =
            await getCurrentUserData();

        if (likeSnap.exists()) {

            await deleteDoc(likeRef);

            await updateDoc(
                commentRef,
                {
                    likes:
                        increment(-1)
                }
            );

            return;

        }

        await setDoc(
            likeRef,
            {

                commentId,

                uid:
                    user.uid,

                createdAt:
                    serverTimestamp()

            }
        );

        await updateDoc(
            commentRef,
            {
                likes:
                    increment(1)
            }
        );

        await createNotification({

            receiverId:
                comment.uid,

            sender:
                userData,

            type:
                "comment_like",

            postId,

            commentId,

            text:
                "liked your comment."

        });

    } catch (error) {

        console.error(
            "Comment like error:",
            error
        );

    }

};


// ============================================================
// SHOW REPLY BOX
// ============================================================

window.showReplyBox =
function(commentId) {

    const box =
        document.getElementById(
            `replyBox-${commentId}`
        );

    if (!box) return;

    if (box.innerHTML.trim()) {

        box.innerHTML = "";

        return;

    }

    box.innerHTML = `

        <div
            style="
                display:flex;
                gap:8px;
                margin:8px 0;
            "
        >

            <input
                id="replyInput-${commentId}"
                type="text"
                placeholder="Write a reply..."
            >

            <button
                type="button"
                id="replySend-${commentId}"
            >
                Send
            </button>

        </div>

    `;

    const input =
        document.getElementById(
            `replyInput-${commentId}`
        );

    const send =
        document.getElementById(
            `replySend-${commentId}`
        );

    if (input) {

        input.focus();

        input.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    sendReply(
                        commentId
                    );

                }

            }
        );

    }

    if (send) {

        send.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                sendReply(
                    commentId
                );

            }
        );

    }

};


// ============================================================
// SEND REPLY
// ============================================================

async function sendReply(commentId) {

    try {

        const user =
            auth.currentUser;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        const input =
            document.getElementById(
                `replyInput-${commentId}`
            );

        if (!input) return;

        const text =
            input.value.trim();

        if (!text) return;

        const userData =
            await getCurrentUserData();

        const commentSnap =
            await getDoc(
                doc(
                    db,
                    "comments",
                    commentId
                )
            );

        if (!commentSnap.exists()) return;

        const comment =
            commentSnap.data();

        await addDoc(
            collection(
                db,
                "comments",
                commentId,
                "replies"
            ),
            {

                uid:
                    user.uid,

                username:
                    userData.username,

                fullName:
                    userData.fullName,

                profilePicture:
                    userData.profilePicture,

                text,

                createdAt:
                    serverTimestamp()

            }
        );

        await updateDoc(
            doc(
                db,
                "comments",
                commentId
            ),
            {
                replies:
                    increment(1)
            }
        );

        await createNotification({

            receiverId:
                comment.uid,

            sender:
                userData,

            type:
                "comment_reply",

            postId,

            commentId,

            text:
                "replied to your comment."

        });

        input.value = "";

        const box =
            document.getElementById(
                `replyBox-${commentId}`
            );

        if (box) {

            box.innerHTML = "";

        }

    } catch (error) {

        console.error(
            "Reply error:",
            error
        );

    }

}


// ============================================================
// LOAD REPLIES
// ============================================================

function loadReplies(commentId) {

    const container =
        document.getElementById(
            `replies-${commentId}`
        );

    if (!container) return;

    const repliesQuery =
        query(

            collection(
                db,
                "comments",
                commentId,
                "replies"
            ),

            orderBy(
                "createdAt",
                "asc"
            )

        );

    onSnapshot(
        repliesQuery,

        (snapshot) => {

            container.innerHTML = "";

            snapshot.forEach(
                (replySnap) => {

                    const reply =
                        replySnap.data();

                    let date =
                        "Just now";

                    if (
                        reply.createdAt
                    ) {

                        try {

                            date =
                                reply.createdAt
                                    .toDate()
                                    .toLocaleString();

                        } catch (error) {}

                    }

                    container.innerHTML += `

                        <div class="reply">

                            <div
                                style="
                                    display:flex;
                                    gap:8px;
                                    align-items:center;
                                "
                            >

                                <img
                                    src="${escapeHTML(
                                        reply.profilePicture ||
                                        "https://via.placeholder.com/35"
                                    )}"
                                    style="
                                        width:35px;
                                        height:35px;
                                        border-radius:50%;
                                        object-fit:cover;
                                    "
                                >

                                <div>

                                    <b>
                                        ${escapeHTML(
                                            reply.fullName ||
                                            "VitalStar User"
                                        )}
                                    </b>

                                    <br>

                                    <small>
                                        ${escapeHTML(date)}
                                    </small>

                                </div>

                            </div>

                            <p
                                style="
                                    margin:7px 0 0 43px;
                                "
                            >
                                ${escapeHTML(
                                    reply.text || ""
                                )}
                            </p>

                        </div>

                    `;

                }
            );

        },

        (error) => {

            console.error(
                "Replies error:",
                error
            );

        }

    );

}


// ============================================================
// SHARE POST
// ============================================================

window.sharePost =
async function() {

    try {

        const user =
            auth.currentUser;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        const postRef =
            doc(
                db,
                "posts",
                postId
            );

        const postSnap =
            await getDoc(
                postRef
            );

        if (!postSnap.exists()) return;

        const post =
            postSnap.data();

        const userData =
            await getCurrentUserData();

        const shareUrl =
            `${window.location.origin}${window.location.pathname}?postId=${encodeURIComponent(
                postId
            )}`;

        const shareData = {

            title:
                `${post.fullName || "VitalStar"}'s post`,

            text:
                post.text
                    ? post.text.substring(0, 120)
                    : "Check out this post on VitalStar.",

            url:
                shareUrl

        };

        let shared = false;

        if (navigator.share) {

            try {

                await navigator.share(
                    shareData
                );

                shared = true;

            } catch (error) {

                if (
                    error.name ===
                    "AbortError"
                ) {

                    return;

                }

                console.error(
                    "Share error:",
                    error
                );

                return;

            }

        } else {

            try {

                await navigator.clipboard.writeText(
                    shareUrl
                );

                shared = true;

            } catch (error) {

                console.error(
                    "Copy link error:",
                    error
                );

                return;

            }

        }

        if (!shared) return;

        await updateDoc(
            postRef,
            {
                shares:
                    increment(1)
            }
        );

        const shareCount =
            document.getElementById(
                "shareCount"
            );

        if (shareCount) {

            shareCount.textContent =
                Number(
                    shareCount.textContent
                ) + 1;

        }

        await createNotification({

            receiverId:
                post.uid,

            sender:
                userData,

            type:
                "share",

            postId,

            text:
                "shared your post."

        });

    } catch (error) {

        console.error(
            "Share error:",
            error
        );

    }

};