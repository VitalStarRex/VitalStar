// ============================================================
// VITALSTAR — CREATE POST
// post.js
// Firebase v10.12.2
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// CLOUDINARY
// ============================================================

const CLOUDINARY_CLOUD_NAME = "m0scmqqv";
const CLOUDINARY_UPLOAD_PRESET = "vitalstar_upload";


// ============================================================
// MAIN CONTAINER
// ============================================================

const createPostContainer =
    document.getElementById("createPost");


// ============================================================
// STOP IF CONTAINER DOES NOT EXIST
// ============================================================

if (!createPostContainer) {

    console.error(
        "VitalStar: #createPost container was not found."
    );

} else {

    initializeCreatePost();

}


// ============================================================
// INITIALIZE
// ============================================================

function initializeCreatePost() {

    renderComposer();

    setupComposerEvents();

}


// ============================================================
// RENDER CREATE POST
// ============================================================

function renderComposer() {

    createPostContainer.innerHTML = `

<section class="composer">

    <div class="composer-top">

        <img
            class="composer-avatar"
            id="composerAvatar"
            src="default-profile.png"
            alt="Profile"
        >

        <button
            class="composer-input"
            id="openPostComposer"
            type="button"
        >
            What's on your mind?
        </button>

    </div>


    <div class="composer-actions">

        <button
            class="composer-action photo-action"
            id="postPhotoButton"
            type="button"
        >
            🖼️ Photo
        </button>

        <button
            class="composer-action video-action"
            id="postVideoButton"
            type="button"
        >
            🎥 Video
        </button>

        <button
            class="composer-action live-action"
            id="postLiveButton"
            type="button"
        >
            📡 Live
        </button>

        <button
            class="composer-action feeling-action"
            id="postFeelingButton"
            type="button"
        >
            ✏️ Feeling
        </button>

    </div>

</section>

`;

}


// ============================================================
// EVENTS
// ============================================================

function setupComposerEvents() {

    const openButton =
        document.getElementById("openPostComposer");

    const photoButton =
        document.getElementById("postPhotoButton");

    const videoButton =
        document.getElementById("postVideoButton");

    const liveButton =
        document.getElementById("postLiveButton");

    const feelingButton =
        document.getElementById("postFeelingButton");


    if (openButton) {

        openButton.addEventListener(
            "click",
            () => openPostModal("text")
        );

    }


    if (photoButton) {

        photoButton.addEventListener(
            "click",
            () => openPostModal("photo")
        );

    }


    if (videoButton) {

        videoButton.addEventListener(
            "click",
            () => openPostModal("video")
        );

    }


    if (liveButton) {

        liveButton.addEventListener(
            "click",
            () => {

                alert(
                    "Live streaming is coming soon on VitalStar."
                );

            }
        );

    }


    if (feelingButton) {

        feelingButton.addEventListener(
            "click",
            () => openPostModal("feeling")
        );

    }


    loadCurrentUser();

}


// ============================================================
// LOAD CURRENT USER
// ============================================================

async function loadCurrentUser() {

    onAuthStateChanged(
        auth,
        async (user) => {

            if (!user) {
                return;
            }

            try {

                const userSnap =
                    await getDoc(
                        doc(db, "users", user.uid)
                    );

                if (!userSnap.exists()) {
                    return;
                }

                const userData =
                    userSnap.data();

                const avatar =
                    document.getElementById(
                        "composerAvatar"
                    );

                if (!avatar) {
                    return;
                }

                const profilePicture =
                    userData.profilePicture ||
                    userData.photoURL ||
                    user.photoURL;

                if (profilePicture) {

                    avatar.src =
                        profilePicture;

                }

                avatar.onerror = () => {

                    avatar.src =
                        "default-profile.png";

                };

            } catch (error) {

                console.error(
                    "Could not load profile:",
                    error
                );

            }

        }
    );

}


// ============================================================
// OPEN POST MODAL
// ============================================================

function openPostModal(type = "text") {

    if (
        document.getElementById(
            "vitalstarPostModal"
        )
    ) {

        return;

    }


    const modal =
        document.createElement("div");

    modal.id =
        "vitalstarPostModal";


    modal.innerHTML = `

<div class="vs-post-overlay">

    <div class="vs-post-modal">

        <div class="vs-post-header">

            <strong>Create Post</strong>

            <button
                id="closePostModal"
                type="button"
            >
                ×
            </button>

        </div>


        <div class="vs-post-user">

            <img
                id="modalPostAvatar"
                src="default-profile.png"
                alt="Profile"
            >

            <div>

                <div
                    id="modalPostName"
                    class="vs-post-name"
                >
                    VitalStar User
                </div>

                <div class="vs-post-privacy">
                    🌎 Public
                </div>

            </div>

        </div>


        <textarea
            id="postTextInput"
            class="vs-post-textarea"
            placeholder="What's on your mind?"
            maxlength="5000"
        ></textarea>


        <div
            id="postMediaPreview"
            class="vs-post-preview"
        ></div>


        <input
            id="postMediaInput"
            type="file"
            accept="image/*,video/*"
            hidden
        >


        <div class="vs-post-tools">

            <button
                id="choosePhoto"
                type="button"
            >
                🖼️ Photo
            </button>

            <button
                id="chooseVideo"
                type="button"
            >
                🎥 Video
            </button>

            <button
                id="addFeeling"
                type="button"
            >
                😊 Feeling
            </button>

        </div>


        <button
            id="publishPost"
            class="vs-publish-button"
            type="button"
        >
            Post
        </button>

    </div>

</div>

`;


    document.body.appendChild(modal);


    addPostModalStyles();


    setupModalEvents(type);


    loadModalUser();

}


// ============================================================
// MODAL EVENTS
// ============================================================

function setupModalEvents(type) {

    const closeButton =
        document.getElementById(
            "closePostModal"
        );

    const photoButton =
        document.getElementById(
            "choosePhoto"
        );

    const videoButton =
        document.getElementById(
            "chooseVideo"
        );

    const feelingButton =
        document.getElementById(
            "addFeeling"
        );

    const fileInput =
        document.getElementById(
            "postMediaInput"
        );

    const publishButton =
        document.getElementById(
            "publishPost"
        );


    closeButton.onclick =
        closePostModal;


    document
        .querySelector(".vs-post-overlay")
        .addEventListener(
            "click",
            (event) => {

                if (
                    event.target.classList.contains(
                        "vs-post-overlay"
                    )
                ) {

                    closePostModal();

                }

            }
        );


    photoButton.onclick = () => {

        fileInput.accept =
            "image/*";

        fileInput.click();

    };


    videoButton.onclick = () => {

        fileInput.accept =
            "video/*";

        fileInput.click();

    };


    feelingButton.onclick = () => {

        const textarea =
            document.getElementById(
                "postTextInput"
            );

        textarea.value +=
            " 😊";

        textarea.focus();

    };


    fileInput.addEventListener(
        "change",
        handleMediaSelection
    );


    publishButton.onclick =
        publishPost;


    if (type === "photo") {

        fileInput.accept =
            "image/*";

        setTimeout(
            () => fileInput.click(),
            150
        );

    }


    if (type === "video") {

        fileInput.accept =
            "video/*";

        setTimeout(
            () => fileInput.click(),
            150
        );

    }


    if (type === "feeling") {

        document
            .getElementById(
                "postTextInput"
            )
            .focus();

    }

}


// ============================================================
// LOAD USER INTO MODAL
// ============================================================

async function loadModalUser() {

    const user =
        auth.currentUser;

    if (!user) {
        return;
    }


    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


        if (!userSnap.exists()) {
            return;
        }


        const userData =
            userSnap.data();


        const name =
            userData.fullName ||
            userData.username ||
            "VitalStar User";


        const picture =
            userData.profilePicture ||
            userData.photoURL ||
            user.photoURL;


        const nameElement =
            document.getElementById(
                "modalPostName"
            );


        const avatar =
            document.getElementById(
                "modalPostAvatar"
            );


        if (nameElement) {

            nameElement.textContent =
                name;

        }


        if (
            avatar &&
            picture
        ) {

            avatar.src =
                picture;

        }


        if (avatar) {

            avatar.onerror = () => {

                avatar.src =
                    "default-profile.png";

            };

        }

    } catch (error) {

        console.error(
            "Modal profile error:",
            error
        );

    }

}


// ============================================================
// MEDIA SELECTION
// ============================================================

let selectedMediaFile = null;


function handleMediaSelection(event) {

    const file =
        event.target.files?.[0];


    if (!file) {
        return;
    }


    selectedMediaFile =
        file;


    const preview =
        document.getElementById(
            "postMediaPreview"
        );


    if (!preview) {
        return;
    }


    preview.innerHTML = "";


    const url =
        URL.createObjectURL(file);


    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        const image =
            document.createElement(
                "img"
            );

        image.src = url;

        image.alt =
            "Selected image";

        preview.appendChild(
            image
        );

    } else if (
        file.type.startsWith(
            "video/"
        )
    ) {

        const video =
            document.createElement(
                "video"
            );

        video.src = url;

        video.controls =
            true;

        preview.appendChild(
            video
        );

    }

}


// ============================================================
// PUBLISH POST
// ============================================================

async function publishPost() {

    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please log in before creating a post."
        );

        return;

    }


    const textInput =
        document.getElementById(
            "postTextInput"
        );


    const publishButton =
        document.getElementById(
            "publishPost"
        );


    const text =
        textInput?.value.trim() || "";


    if (
        !text &&
        !selectedMediaFile
    ) {

        alert(
            "Write something or select a photo/video."
        );

        return;

    }


    if (text.length > 5000) {

        alert(
            "Your post is too long."
        );

        return;

    }


    try {

        publishButton.disabled =
            true;

        publishButton.textContent =
            "Posting...";


        // ----------------------------------------------------
        // LOAD USER PROFILE
        // ----------------------------------------------------

        let userData = {};


        try {

            const userSnap =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (
                userSnap.exists()
            ) {

                userData =
                    userSnap.data();

            }

        } catch (profileError) {

            console.warn(
                "Profile lookup failed:",
                profileError
            );

        }


        const fullName =
            userData.fullName ||
            userData.username ||
            "VitalStar User";


        const username =
            userData.username ||
            "";


        const profilePicture =
            userData.profilePicture ||
            userData.photoURL ||
            user.photoURL ||
            "";


        // ----------------------------------------------------
        // UPLOAD MEDIA
        // ----------------------------------------------------

        let image = "";
        let video = "";


        if (selectedMediaFile) {

            const uploadedUrl =
                await uploadToCloudinary(
                    selectedMediaFile
                );


            if (
                selectedMediaFile.type.startsWith(
                    "image/"
                )
            ) {

                image =
                    uploadedUrl;

            } else if (
                selectedMediaFile.type.startsWith(
                    "video/"
                )
            ) {

                video =
                    uploadedUrl;

            }

        }


        // ----------------------------------------------------
        // CREATE FIRESTORE POST
        // ----------------------------------------------------

        const postData = {

            uid:
                user.uid,

            fullName:
                fullName,

            username:
                username,

            profilePicture:
                profilePicture,

            text:
                text,

            image:
                image,

            video:
                video,

            likes:
                0,

            comments:
                0,

            reposts:
                0,

            shares:
                0,

            createdAt:
                serverTimestamp()

        };


        const postRef =
            await addDoc(
                collection(
                    db,
                    "posts"
                ),
                postData
            );


        console.log(
            "VitalStar post created:",
            postRef.id
        );


        closePostModal();


        // ----------------------------------------------------
        // REFRESH FEED
        // ----------------------------------------------------

        window.dispatchEvent(
            new CustomEvent(
                "vitalstarPostCreated",
                {
                    detail: {
                        postId:
                            postRef.id
                    }
                }
            )
        );


        // Give home.js a chance to update naturally.
        // Reloading guarantees the new post appears
        // even when home.js uses a one-time query.

        setTimeout(
            () => {

                if (
                    document.getElementById(
                        "feed"
                    )
                ) {

                    window.location.reload();

                }

            },
            500
        );


    } catch (error) {

        console.error(
            "Create post error:",
            error
        );


        alert(
            error?.message ||
            "Could not create your post. Please try again."
        );


        if (publishButton) {

            publishButton.disabled =
                false;

            publishButton.textContent =
                "Post";

        }

    }

}


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

async function uploadToCloudinary(
    file
) {

    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
    );


    const resourceType =
        file.type.startsWith(
            "video/"
        )
            ? "video"
            : "image";


    const uploadUrl =
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;


    const response =
        await fetch(
            uploadUrl,
            {
                method:
                    "POST",

                body:
                    formData
            }
        );


    if (!response.ok) {

        throw new Error(
            "Media upload failed."
        );

    }


    const data =
        await response.json();


    if (!data.secure_url) {

        throw new Error(
            "Cloudinary did not return a media URL."
        );

    }


    return data.secure_url;

}


// ============================================================
// CLOSE MODAL
// ============================================================

function closePostModal() {

    const modal =
        document.getElementById(
            "vitalstarPostModal"
        );


    if (modal) {

        modal.remove();

    }


    selectedMediaFile =
        null;

}


// ============================================================
// POST MODAL STYLES
// ============================================================

function addPostModalStyles() {

    if (
        document.getElementById(
            "vitalstarPostStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "vitalstarPostStyles";


    style.textContent = `

.vs-post-overlay{

    position:fixed;

    inset:0;

    z-index:99999;

    display:flex;

    align-items:center;

    justify-content:center;

    padding:15px;

    background:
        rgba(0,0,0,.72);

    backdrop-filter:
        blur(12px);

}


.vs-post-modal{

    width:
        min(100%, 560px);

    max-height:
        92vh;

    overflow-y:auto;

    background:
        linear-gradient(
            145deg,
            #151a2e,
            #0c1020
        );

    border:
        1px solid
        rgba(255,255,255,.10);

    border-radius:
        22px;

    padding:
        17px;

    box-shadow:
        0 20px 70px
        rgba(0,0,0,.65);

    color:#fff;

}


.vs-post-header{

    display:flex;

    align-items:center;

    justify-content:space-between;

    padding-bottom:14px;

    border-bottom:
        1px solid
        rgba(255,255,255,.08);

}


.vs-post-header strong{

    font-size:19px;

}


.vs-post-header button{

    width:36px;

    height:36px;

    border:0;

    border-radius:50%;

    background:#20263d;

    color:#fff;

    font-size:25px;

    cursor:pointer;

}


.vs-post-user{

    display:flex;

    align-items:center;

    gap:10px;

    padding:
        15px 0 10px;

}


.vs-post-user img{

    width:44px;

    height:44px;

    border-radius:50%;

    object-fit:cover;

    background:
        linear-gradient(
            135deg,
            #7b2cff,
            #00d5ff
        );

}


.vs-post-name{

    font-size:14px;

    font-weight:900;

}


.vs-post-privacy{

    margin-top:3px;

    color:#8f99b9;

    font-size:11px;

}


.vs-post-textarea{

    width:100%;

    min-height:150px;

    resize:vertical;

    border:0;

    outline:none;

    border-radius:15px;

    padding:14px;

    background:#101529;

    color:#fff;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    font-size:16px;

    line-height:1.5;

}


.vs-post-textarea::placeholder{

    color:#727b9a;

}


.vs-post-preview{

    margin-top:12px;

}


.vs-post-preview img,
.vs-post-preview video{

    display:block;

    width:100%;

    max-height:420px;

    object-fit:contain;

    border-radius:15px;

    background:#080b16;

}


.vs-post-tools{

    display:flex;

    gap:7px;

    margin-top:12px;

    flex-wrap:wrap;

}


.vs-post-tools button{

    flex:1;

    min-width:100px;

    padding:11px 8px;

    border:1px solid
        rgba(255,255,255,.08);

    border-radius:12px;

    background:#171d34;

    color:#dce3ff;

    font-weight:800;

    cursor:pointer;

}


.vs-post-tools button:hover{

    background:#202743;

}


.vs-publish-button{

    width:100%;

    margin-top:14px;

    padding:13px;

    border:0;

    border-radius:14px;

    background:
        linear-gradient(
            135deg,
            #7639ff,
            #00cfff,
            #ff28a8
        );

    color:#fff;

    font-size:15px;

    font-weight:900;

    cursor:pointer;

    box-shadow:
        0 0 20px
        rgba(106,54,255,.30);

}


.vs-publish-button:disabled{

    opacity:.6;

    cursor:wait;

}


@media(max-width:600px){

    .vs-post-overlay{

        padding:8px;

        align-items:flex-end;

    }


    .vs-post-modal{

        max-height:94vh;

        border-radius:
            22px 22px 15px 15px;

    }


    .vs-post-textarea{

        min-height:130px;

    }

}

`;


    document.head.appendChild(
        style
    );

}


// ============================================================
// OPTIONAL GLOBAL ACCESS
// ============================================================

window.VitalStarPost = {

    open:
        openPostModal,

    close:
        closePostModal

};