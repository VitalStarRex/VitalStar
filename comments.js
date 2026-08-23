// ============================================================
// VITALSTAR — COMMENTS PAGE
// Comments / Likes / Replies / Sharing / Notifications
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
// AUTHENTICATION
// ============================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
    }

});


// ============================================================
// GET POST ID
// ============================================================

const params = new URLSearchParams(window.location.search);

const postId = params.get("postId");

if (!postId) {

    console.error("Post ID not found.");

    throw new Error("Missing postId");

}


// ============================================================
// ELEMENTS
// ============================================================

const commentList = document.getElementById("commentList");

const postContainer = document.getElementById("postContainer");


// ============================================================
// LOAD USER INFORMATION
// ============================================================

async function getCurrentUserData() {

    const user = auth.currentUser;

    if (!user) return null;

    const userSnap = await getDoc(
        doc(db, "users", user.uid)
    );

    if (!userSnap.exists()) {

        return {
            uid: user.uid,
            username: "username",
            fullName: "VitalStar User",
            profilePicture: ""
        };

    }

    const data = userSnap.data();

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
// LOAD POST
// ============================================================

async function loadPost() {

    try {

        const postSnap = await getDoc(
            doc(db, "posts", postId)
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

        const post = postSnap.data();

        let date = "Just now";

        if (post.createdAt) {

            try {

                date =
                    post.createdAt
                        .toDate()
                        .toLocaleString();

            } catch (e) {}

        }


        if (!postContainer) return;


        postContainer.innerHTML = `

            <div class="comment">

                <div class="comment-header">

                    <div class="comment-avatar">
                        ${
                            post.profilePicture
                                ? `
                                <img
                                    src="${post.profilePicture}"
                                    style="
                                        width:100%;
                                        height:100%;
                                        border-radius:50%;
                                        object-fit:cover;
                                    "
                                >
                                `
                                : "👤"
                        }
                    </div>

                    <div>

                        <b>

                            <a
                                href="profile.html?uid=${post.uid}"
                                style="
                                    text-decoration:none;
                                    color:black;
                                "
                            >
                                ${post.fullName || "VitalStar User"}
                            </a>

                        </b>

                        <br>

                        <small>
                            ${date}
                        </small>

                    </div>

                </div>


                <p class="comment-text">
                    ${post.text || ""}
                </p>


                ${
                    post.image
                        ? `
                            <img
                                class="comment-photo"
                                src="${post.image}"
                            >
                          `
                        : ""
                }


                ${
                    post.video
                        ? `
                            <video
                                class="comment-photo"
                                controls
                            >
                                <source
                                    src="${post.video}"
                                    type="video/mp4"
                                >
                            </video>
                          `
                        : ""
                }


                <div class="comment-actions">

                    <span>
                        ❤️ ${post.likes || 0}
                    </span>

                    <span>
                        💬 ${post.comments || 0}
                    </span>

                    <button
                        type="button"
                        onclick="sharePost()"
                        style="
                            border:none;
                            background:none;
                            cursor:pointer;
                            font-size:15px;
                        "
                    >
                        🔗 Share
                        <span id="shareCount">
                            ${post.shares || 0}
                        </span>
                    </button>

                </div>

            </div>

        `;

    } catch (error) {

        console.error(
            "Failed to load post:",
            error
        );

    }

}


loadPost();


// ============================================================
// LOAD COMMENTS
// ============================================================

const commentsQuery = query(

    collection(db, "comments"),

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

        console.log(
            "Comments:",
            snapshot.size
        );


        if (!commentList) return;


        commentList.innerHTML = "";


        if (snapshot.empty) {

            commentList.innerHTML = `
                <p
                    style="
                        text-align:center;
                        padding:20px;
                        color:gray;
                    "
                >
                    No comments yet.
                </p>
            `;

            return;

        }


        snapshot.forEach((docSnap) => {

            const comment =
                docSnap.data();

            let date = "Just now";


            if (comment.createdAt) {

                try {

                    date =
                        comment.createdAt
                            .toDate()
                            .toLocaleString();

                } catch (e) {}

            }


            commentList.innerHTML += `

                <div class="comment">

                    <div class="comment-header">

                        <div class="comment-avatar">

                            <img
                                src="${
                                    comment.profilePicture ||
                                    "https://via.placeholder.com/45"
                                }"
                                style="
                                    width:100%;
                                    height:100%;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                            >

                        </div>


                        <div>

                            <b>

                                <a
                                    href="profile.html?uid=${comment.uid}"
                                    style="
                                        text-decoration:none;
                                        color:black;
                                    "
                                >
                                    ${
                                        comment.fullName ||
                                        "VitalStar User"
                                    }
                                </a>

                            </b>

                            <br>

                            <span
                                style="
                                    color:#1877f2;
                                    font-size:13px;
                                "
                            >
                                @${comment.username || "username"}
                            </span>

                            <br>

                            <small
                                style="color:gray;"
                            >
                                ${date}
                            </small>

                        </div>

                    </div>


                    <p class="comment-text">
                        ${comment.text || ""}
                    </p>


                    ${
                        comment.image
                            ? `
                                <img
                                    class="comment-photo"
                                    src="${comment.image}"
                                >
                              `
                            : ""
                    }


                    <div class="comment-actions">

                        <button
                            type="button"
                            onclick="likeComment('${docSnap.id}')"
                        >
                            ❤️
                            <span>
                                ${comment.likes || 0}
                            </span>
                        </button>


                        <button
                            type="button"
                            onclick="showReplyBox('${docSnap.id}')"
                        >
                            💬 Reply
                        </button>

                    </div>


                    <div
                        id="replyBox-${docSnap.id}"
                    ></div>

                </div>

            `;

        });

    },

    (error) => {

        console.error(
            "Comments listener error:",
            error
        );

    }

);


// ============================================================
// SEND COMMENT
// ============================================================

window.sendComment = async function () {

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
            imageElement.files
                ? imageElement.files[0]
                : null;


        if (!text && !imageFile) {

            alert(
                "Write a comment or choose an image."
            );

            return;

        }


        const user =
            auth.currentUser;


        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        const userData =
            await getCurrentUserData();


        if (!userData) return;


        // ====================================================
        // IMAGE UPLOAD
        // ====================================================

        let imageUrl = "";


        if (imageFile) {

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

                alert(
                    "Image upload failed."
                );

                return;

            }


            imageUrl =
                data.secure_url;

        }


        // ====================================================
        // CREATE COMMENT
        // ====================================================

        await addDoc(
            collection(
                db,
                "comments"
            ),
            {

                postId: postId,

                uid: user.uid,

                username:
                    userData.username,

                fullName:
                    userData.fullName,

                profilePicture:
                    userData.profilePicture,

                text: text,

                image: imageUrl,

                likes: 0,

                replies: 0,

                createdAt:
                    serverTimestamp()

            }
        );


        // ====================================================
        // UPDATE POST COMMENT COUNT
        // ====================================================

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


        // ====================================================
        // GET POST OWNER
        // ====================================================

        const postSnap =
            await getDoc(
                doc(
                    db,
                    "posts",
                    postId
                )
            );


        // ====================================================
        // COMMENT NOTIFICATION
        // ====================================================

        if (postSnap.exists()) {

            const post =
                postSnap.data();


            // Don't notify yourself
            if (
                post.uid !==
                user.uid
            ) {

                await addDoc(
                    collection(
                        db,
                        "notifications"
                    ),
                    {

                        receiverId:
                            post.uid,

                        senderId:
                            user.uid,

                        senderName:
                            userData.fullName,

                        senderPhoto:
                            userData.profilePicture,

                        type:
                            "comment",

                        postId:
                            postId,

                        text:
                            "commented on your post.",

                        read: false,

                        createdAt:
                            serverTimestamp()

                    }
                );

            }

        }


        // ====================================================
        // CLEAR FORM
        // ====================================================

        if (textElement) {

            textElement.value = "";

        }


        if (imageElement) {

            imageElement.value = "";

        }


        console.log(
            "Comment posted successfully."
        );

    } catch (error) {

        console.error(
            "Comment error:",
            error
        );

        alert(
            error.message ||
            "Failed to post comment."
        );

    }

};


// ============================================================
// LIKE COMMENT
// ============================================================

window.likeComment = async function (
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


        const likeId =
            `${commentId}_${user.uid}`;


        const likeRef =
            doc(
                db,
                "commentLikes",
                likeId
            );


        const likeSnap =
            await getDoc(
                likeRef
            );


        const commentRef =
            doc(
                db,
                "comments",
                commentId
            );


        const commentSnap =
            await getDoc(
                commentRef
            );


        if (!commentSnap.exists()) {

            console.error(
                "Comment not found."
            );

            return;

        }


        const comment =
            commentSnap.data();


        const userData =
            await getCurrentUserData();


        // ====================================================
        // UNLIKE
        // ====================================================

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


            console.log(
                "Comment unliked."
            );

            return;

        }


        // ====================================================
        // LIKE
        // ====================================================

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


        // ====================================================
        // LIKE NOTIFICATION
        // ====================================================

        // Don't notify yourself
        if (
            comment.uid &&
            comment.uid !==
            user.uid
        ) {

            await addDoc(
                collection(
                    db,
                    "notifications"
                ),
                {

                    receiverId:
                        comment.uid,

                    senderId:
                        user.uid,

                    senderName:
                        userData.fullName,

                    senderPhoto:
                        userData.profilePicture,

                    type:
                        "comment_like",

                    postId:
                        postId,

                    commentId:
                        commentId,

                    text:
                        "liked your comment.",

                    read: false,

                    createdAt:
                        serverTimestamp()

                }
            );

        }


        console.log(
            "Comment liked."
        );

    } catch (error) {

        console.error(
            "Like comment error:",
            error
        );

    }

};


// ============================================================
// SHARE POST
// ============================================================

window.sharePost = async function () {

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

            console.error(
                "Post not found."
            );

            return;

        }


        const post =
            postSnap.data();


        const userData =
            await getCurrentUserData();


        // ====================================================
        // SHARE URL
        // ====================================================

        const shareUrl =
            `${window.location.origin}${window.location.pathname}?postId=${postId}`;


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


        // ====================================================
        // NATIVE SHARE
        // ====================================================

        if (
            navigator.share
        ) {

            try {

                await navigator.share(
                    shareData
                );

            } catch (shareError) {

                // User cancelled the share dialog.
                if (
                    shareError.name ===
                    "AbortError"
                ) {

                    return;

                }

                console.error(
                    "Native share failed:",
                    shareError
                );

            }

        } else {

            // ==================================================
            // FALLBACK — COPY LINK
            // ==================================================

            if (
                navigator.clipboard
            ) {

                await navigator.clipboard.writeText(
                    shareUrl
                );

                console.log(
                    "Post link copied."
                );

            }

        }


        // ====================================================
        // UPDATE SHARE COUNT
        // ====================================================

        await updateDoc(
            postRef,
            {

                shares:
                    increment(1)

            }
        );


        // ====================================================
        // UPDATE DISPLAYED SHARE COUNT
        // ====================================================

        const shareCount =
            document.getElementById(
                "shareCount"
            );


        if (shareCount) {

            const currentCount =
                Number(
                    shareCount.textContent
                ) || 0;


            shareCount.textContent =
                currentCount + 1;

        }


        // ====================================================
        // SHARE NOTIFICATION
        // ====================================================

        // Don't notify yourself
        if (
            post.uid &&
            post.uid !==
            user.uid
        ) {

            await addDoc(
                collection(
                    db,
                    "notifications"
                ),
                {

                    receiverId:
                        post.uid,

                    senderId:
                        user.uid,

                    senderName:
                        userData.fullName,

                    senderPhoto:
                        userData.profilePicture,

                    type:
                        "share",

                    postId:
                        postId,

                    text:
                        "shared your post.",

                    read: false,

                    createdAt:
                        serverTimestamp()

                }
            );

        }


        console.log(
            "Post shared."
        );

    } catch (error) {

        console.error(
            "Share post error:",
            error
        );

    }

};