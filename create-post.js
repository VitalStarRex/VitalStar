// ============================================================
// VITALSTAR — create-post.js
// Handles:
// - Authentication
// - Image/video preview
// - Cloudinary uploads
// - Posting state
// - Firestore post creation
// - Redirect to home after successful posting
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

});


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

async function uploadToCloudinary(file) {

    const type = file.type.startsWith("video")
        ? "video"
        : "image";

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        "vitalstar_upload"
    );

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/m0scmqqv/${type}/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {

        console.error(
            "Cloudinary upload error:",
            data
        );

        throw new Error(
            data?.error?.message ||
            "Media upload failed. Please try again."
        );
    }

    return data.secure_url;
}


// ============================================================
// POSTING STATE
// ============================================================

function setPostingState(isPosting) {

    const button =
        document.getElementById("postSubmitBtn");

    const status =
        document.getElementById("postStatus");


    if (button) {

        button.disabled = isPosting;

        button.textContent =
            isPosting
                ? "Posting..."
                : "Post";
    }


    if (status) {

        status.textContent =
            isPosting
                ? "Uploading, please wait..."
                : "";
    }

}


// ============================================================
// MEDIA PREVIEW
// ============================================================

function clearMediaPreview() {

    const preview =
        document.getElementById("mediaPreview");


    if (!preview) {
        return;
    }


    preview.innerHTML = "";

    preview.style.display = "none";
}


// ------------------------------------------------------------
// Show selected image/video
// ------------------------------------------------------------

function showMediaPreview(file) {

    const preview =
        document.getElementById("mediaPreview");


    if (!preview || !file) {
        return;
    }


    preview.innerHTML = "";


    const objectURL =
        URL.createObjectURL(file);


    // IMAGE
    if (file.type.startsWith("image")) {

        const image =
            document.createElement("img");


        image.src = objectURL;

        image.alt = "Image preview";

        image.className =
            "post-media-preview";


        image.style.width = "100%";

        image.style.maxHeight = "400px";

        image.style.objectFit = "contain";

        image.style.display = "block";

        image.style.borderRadius = "10px";


        preview.appendChild(image);
    }


    // VIDEO
    else if (file.type.startsWith("video")) {

        const video =
            document.createElement("video");


        video.src = objectURL;

        video.controls = true;

        video.preload = "metadata";

        video.className =
            "post-media-preview";


        video.style.width = "100%";

        video.style.maxHeight = "400px";

        video.style.display = "block";

        video.style.borderRadius = "10px";


        preview.appendChild(video);
    }


    preview.style.display = "block";
}


// ============================================================
// FILE INPUT PREVIEW
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const imageInput =
            document.getElementById("postImage");


        const videoInput =
            document.getElementById("postVideo");


        // ----------------------------------------------------
        // IMAGE SELECTED
        // ----------------------------------------------------

        if (imageInput) {

            imageInput.addEventListener(
                "change",
                () => {

                    const file =
                        imageInput.files[0];


                    if (file) {

                        // Only one media type at a time
                        if (videoInput) {
                            videoInput.value = "";
                        }


                        showMediaPreview(file);

                    } else {

                        clearMediaPreview();

                    }

                }
            );

        }


        // ----------------------------------------------------
        // VIDEO SELECTED
        // ----------------------------------------------------

        if (videoInput) {

            videoInput.addEventListener(
                "change",
                () => {

                    const file =
                        videoInput.files[0];


                    if (file) {

                        // Only one media type at a time
                        if (imageInput) {
                            imageInput.value = "";
                        }


                        showMediaPreview(file);

                    } else {

                        clearMediaPreview();

                    }

                }
            );

        }

    }
);


// ============================================================
// CREATE POST
// ============================================================

window.createPost = async function () {

    const textElement =
        document.getElementById("postText");


    const text =
        textElement
            ? textElement.value.trim()
            : "";


    const imageFile =
        document
            .getElementById("postImage")
            ?.files[0];


    const videoFile =
        document
            .getElementById("postVideo")
            ?.files[0];


    // --------------------------------------------------------
    // Check if anything was entered
    // --------------------------------------------------------

    if (!text && !imageFile && !videoFile) {

        alert(
            "Write something or choose an image/video."
        );

        return;
    }


    // --------------------------------------------------------
    // Check authentication
    // --------------------------------------------------------

    const user =
        auth.currentUser;


    if (!user) {

        alert("Please login first.");

        return;
    }


    // --------------------------------------------------------
    // Start posting state
    // --------------------------------------------------------

    setPostingState(true);


    try {

        // ====================================================
        // GET USER PROFILE
        // ====================================================

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


        let fullName =
            "VitalStar User";


        if (userSnap.exists()) {

            fullName =
                userSnap.data().fullName ||
                "VitalStar User";
        }


        // ====================================================
        // MEDIA URLS
        // ====================================================

        let imageUrl = "";

        let videoUrl = "";


        // ====================================================
        // UPLOAD IMAGE
        // ====================================================

        if (imageFile) {

            imageUrl =
                await uploadToCloudinary(
                    imageFile
                );

        }


        // ====================================================
        // UPLOAD VIDEO
        // ====================================================

        if (videoFile) {

            videoUrl =
                await uploadToCloudinary(
                    videoFile
                );

        }


        // ====================================================
        // SAVE POST TO FIRESTORE
        // ====================================================

        await addDoc(
            collection(db, "posts"),
            {

                uid: user.uid,

                fullName: fullName,

                text: text,

                image: imageUrl,

                video: videoUrl,

                likes: 0,

                comments: 0,

                shares: 0,

                reposts: 0,

                createdAt:
                    serverTimestamp()

            }
        );


        // ====================================================
        // CLEAR FORM
        // ====================================================

        if (textElement) {

            textElement.value = "";

        }


        if (
            document.getElementById("postImage")
        ) {

            document
                .getElementById("postImage")
                .value = "";

        }


        if (
            document.getElementById("postVideo")
        ) {

            document
                .getElementById("postVideo")
                .value = "";

        }


        clearMediaPreview();


        // ====================================================
        // SUCCESS
        // ====================================================

        alert(
            "Post created successfully!"
        );


        // Redirect to home
        window.location.href =
            "home.html";


    } catch (error) {

        console.error(
            "createPost error:",
            error
        );


        alert(
            error.message ||
            "Something went wrong. Please try again."
        );


    } finally {

        setPostingState(false);

    }

};