// ============================================================
// VITALSTAR — comments.js
// Post / Comments / Likes / Replies / Shares / Notifications
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

            uid:
                user.uid,

            username:
                "username",

            fullName:
                "VitalStar User",

            profilePicture:
                ""

        };

    }


    const data =
        userSnap.data();


    return {

        uid:
            user.uid,

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

    if (!receiverId) return;

    if (!sender) return;

    // Never notify yourself
    if (
        receiverId ===
        sender.uid
    ) {

        return;

    }


    const notification = {

        receiverId:
            receiverId,

        senderId:
            sender.uid,

        senderName:
            sender.fullName,

        senderPhoto:
            sender.profilePicture,

        type:
            type,

        postId:
            postId,

        text:
            text,

        read:
            false,

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

                    <p style="
                        text-align:center;
                        padding:30px;
                        color:gray;
                    ">
                        Post not found.
                    </p>

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
                                    color:black;
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
                        ${escapeHTML(
                            post.text
                        )}
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
                        src="${escapeHTML(
                            post.image
                        )}"
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
                            src="${escapeHTML(
                                post.video
                            )}"
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

                    <!-- POST LIKE -->

                    <button
                        type="button"
                        id="postLikeBtn"
                        class="post-like-btn"
                        aria-label="Like post"
                        title="Like post"
                        style="
                            border:none;
                            background:transparent;
                            cursor:pointer;
                            padding:7px 10px;
                            font-size:15px;
                            position:relative;
                            z-index:20;
                            pointer-events:auto;
                        "
                    >

                        ❤️

                        <span id="postLikeCount">
                            ${post.likes || 0}
                        </span>

                    </button>


                    <!-- COMMENT COUNT -->

                    <span>

                        💬

                        ${post.comments || 0}

                    </span>


                    <!-- ICON ONLY SHARE -->

                    <button
                        type="button"
                        id="postShareBtn"
                        class="post-share-btn"
                        aria-label="Share post"
                        title="Share post"
                        style="
                            border:none;
                            background:transparent;
                            cursor:pointer;
                            padding:7px 10px;
                            font-size:15px;
                            position:relative;
                            z-index:20;
                            pointer-events:auto;
                        "
                    >

                        🔗

                        <span id="shareCount">
                            ${post.shares || 0}
                        </span>

                    </button>

                </div>

            </div>

        `;


        // ====================================================
        // POST LIKE BUTTON
        // ====================================================

        const likeButton =
            document.getElementById(
                "postLikeBtn"
            );


        if (likeButton) {

            likeButton.addEventListener(
                "click",
                function(event) {

                    event.preventDefault();

                    event.stopPropagation();

                    window.likePost();

                }
            );

        }


        // ====================================================
        // SHARE BUTTON
        // ====================================================

        const shareButton =
            document.getElementById(
                "postShareBtn"
            );


        if (shareButton) {

            shareButton.addEventListener(
                "click",
                function(event) {

                    event.preventDefault();

                    event.stopPropagation();

                    window.sharePost();

                }
            );

        }


        // Update post like button state
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


    if (likeSnap.exists()) {

        button.style.opacity =
            "1";

        button.setAttribute(
            "aria-pressed",
            "true"
        );

    } else {

        button.setAttribute(
            "aria-pressed",
            "false"
        );

    }

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


        if (!postSnap.exists()) {

            return;

        }


        const post =
            postSnap.data();


        const userData =
            await getCurrentUserData();


        const count =
            document.getElementById(
                "postLikeCount"
            );


        // ====================================================
        // UNLIKE
        // ====================================================

        if (likeSnap.exists()) {

            await deleteDoc(
                likeRef
            );


            await updateDoc(
                postRef,
                {

                    likes:
                        increment(-1)

                }
            );


            if (count) {

                const current =
                    Number(
                        count.textContent
                    ) || 0;


                count.textContent =
                    Math.max(
                        0,
                        current - 1
                    );

            }


            const button =
                document.getElementById(
                    "postLikeBtn"
                );


            if (button) {

                button.setAttribute(
                    "aria-pressed",
                    "false"
                );

            }


            return;

        }


        // ====================================================
        // LIKE
        // ====================================================

        await setDoc(
            likeRef,
            {

                postId:
                    postId,

                uid:
                    user.uid,

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

            const current =
                Number(
                    count.textContent
                ) || 0;


            count.textContent =
                current + 1;

        }


        const button =
            document.getElementById(
                "postLikeBtn"
            );


        if (button) {

            button.setAttribute(
                "aria-pressed",
                "true"
            );

        }


        // ====================================================
        // NOTIFICATION
        // ====================================================

        await createNotification({

            receiverId:
                post.uid,

            sender:
                userData,

            type:
                "post_like",

            postId:
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

                <p style="
                    text-align:center;
                    padding:20px;
                    color:gray;
                ">
                    No comments yet.
                </p>

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
                            color:black;
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
                        color:#1877f2;
                        font-size:13px;
                    "
                >
                    @${escapeHTML(
                        comment.username ||
                        "username"
                    )}
                </span>

                <br>

                <small style="color:gray;">
                    ${escapeHTML(date)}
                </small>

            </div>

        </div>


        ${
            comment.text
            ?
            `
            <p class="comment-text">
                ${escapeHTML(
                    comment.text
                )}
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
                src="${escapeHTML(
                    comment.image
                )}"
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

            <!-- COMMENT LIKE -->

            <button
                type="button"
                class="comment-like-btn"
                data-comment-like="${commentId}"
                aria-label="Like comment"
                title="Like comment"
                style="
                    border:none;
                    background:transparent;
                    cursor:pointer;
                    padding:7px 10px;
                    font-size:15px;
                    position:relative;
                    z-index:20;
                    pointer-events:auto;
                "
            >

                ❤️

                <span>
                    ${comment.likes || 0}
                </span>

            </button>


            <!-- REPLY -->

            <button
                type="button"
                class="comment-reply-btn"
                data-comment-reply="${commentId}"
                style="
                    border:none;
                    background:transparent;
                    cursor:pointer;
                    padding:7px 10px;
                    font-size:15px;
                    position:relative;
                    z-index:20;
                    pointer-events:auto;
                "
            >

                💬 Reply

            </button>

        </div>


        <div
            id="replyBox-${commentId}"
        ></div>


        <div
            id="replies-${commentId}"
        ></div>

    `;


    commentList.appendChild(
        element
    );


    // ========================================================
    // COMMENT LIKE
    // ========================================================

    const likeButton =
        element.querySelector(
            "[data-comment-like]"
        );


    if (likeButton) {

        likeButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                event.stopPropagation();

                window.likeComment(
                    commentId
                );

            }
        );

    }


    // ========================================================
    // REPLY
    // ========================================================

    const replyButton =
        element.querySelector(
            "[data-comment-reply]"
        );


    if (replyButton) {

        replyButton.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                event.stopPropagation();

                window.showReplyBox(
                    commentId
                );

            }
        );

    }


    loadReplies(
        commentId
    );

}


// ============================================================
// COMMENTING INDICATOR
// ============================================================

function showCommentingIndicator(
    text
) {

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

    const indicator =
        document.getElementById(
            "commentingIndicator"
        );


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
            ?
            textElement.value.trim()
            :
            "";


        const imageFile =
            imageElement &&
            imageElement.files &&
            imageElement.files[0]
            ?
            imageElement.files[0]
            :
            null;


        if (!text && !imageFile) {

            return;

        }


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

            sendButton.disabled =
                true;

            sendButton.style.opacity =
                "0.6";

        }


        const userData =
            await getCurrentUserData();


        let imageUrl =
            "";


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

                postId:
                    postId,

                uid:
                    user.uid,

                username:
                    userData.username,

                fullName:
                    userData.fullName,

                profilePicture:
                    userData.profilePicture,

                text:
                    text,

                image:
                    imageUrl,

                likes:
                    0,

                replies:
                    0,

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

                postId:
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


        if (!commentSnap.exists()) {

            return;

        }


        const comment =
            commentSnap.data();


        const userData =
            await getCurrentUserData();


        if (likeSnap.exists()) {

            await deleteDoc(
                likeRef
            );


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

                commentId:
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

            postId:
                postId,

            commentId:
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


    if (
        box.innerHTML.trim()
    ) {

        box.innerHTML =
            "";

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
                style="
                    flex:1;
                    padding:10px;
                    border:1px solid #ddd;
                    border-radius:20px;
                    outline:none;
                "
            >


            <button
                type="button"
                id="replySend-${commentId}"
                style="
                    border:none;
                    border-radius:20px;
                    padding:8px 14px;
                    background:#1877f2;
                    color:white;
                    cursor:pointer;
                "
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

    }


    if (send) {

        send.addEventListener(
            "click",
            function(event) {

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

async function sendReply(
    commentId
) {

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


        if (!commentSnap.exists()) {

            return;

        }


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

                text:
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

            postId:
                postId,

            commentId:
                commentId,

            text:
                "replied to your comment."

        });


        input.value =
            "";


        const box =
            document.getElementById(
                `replyBox-${commentId}`
            );


        if (box) {

            box.innerHTML =
                "";

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

function loadReplies(
    commentId
) {

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

            container.innerHTML =
                "";


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

                        <div
                            class="reply"
                            style="
                                margin-left:35px;
                                margin-top:8px;
                                padding:10px;
                                border-left:3px solid #1877f2;
                            "
                        >

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

                                    <small
                                        style="color:gray;"
                                    >
                                        ${escapeHTML(
                                            date
                                        )}
                                    </small>

                                </div>

                            </div>


                            <p
                                style="
                                    margin:7px 0 0 43px;
                                "
                            >
                                ${escapeHTML(
                                    reply.text ||
                                    ""
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


        if (!postSnap.exists()) {

            return;

        }


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
                ?
                post.text.substring(
                    0,
                    120
                )
                :
                "Check out this post on VitalStar.",

            url:
                shareUrl

        };


        let shared =
            false;


        if (
            navigator.share
        ) {

            try {

                await navigator.share(
                    shareData
                );

                shared =
                    true;

            } catch (error) {

                if (
                    error.name ===
                    "AbortError"
                ) {

                    return;

                }

                console.error(
                    "Share cancelled/error:",
                    error
                );

                return;

            }

        } else {

            try {

                await navigator.clipboard.writeText(
                    shareUrl
                );

                shared =
                    true;

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

            postId:
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