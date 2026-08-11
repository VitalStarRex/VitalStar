// ============================================================
// VITALSTAR — create-post.js
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
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
    }

});


// ============================================================
// CREATE PREVIEW + POSTING STATE UI
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    const postText =
        document.getElementById("postText");

    const imageInput =
        document.getElementById("postImage");

    const videoInput =
        document.getElementById("postVideo");

    const postButton =
        document.getElementById("postSubmitBtn");


    // --------------------------------------------------------
    // Create preview area automatically
    // --------------------------------------------------------

    let preview =
        document.getElementById("mediaPreview");

    if (!preview) {

        preview =
            document.createElement("div");

        preview.id = "mediaPreview";

        preview.style.display = "none";
        preview.style.margin = "12px 0";
        preview.style.padding = "8px";
        preview.style.background = "#f1f3f5";
        preview.style.borderRadius = "12px";
        preview.style.overflow = "hidden";

        // Put preview before the Post button
        if (postButton) {

            postButton.parentNode.insertBefore(
                preview,
                postButton
            );

        }
        else if (postText) {

            postText.parentNode.appendChild(
                preview
            );

        }

    }


    // --------------------------------------------------------
    // Create posting status automatically
    // --------------------------------------------------------

    let status =
        document.getElementById("postStatus");

    if (!status) {

        status =
            document.createElement("div");

        status.id = "postStatus";

        status.style.display = "none";
        status.style.textAlign = "center";
        status.style.padding = "10px";
        status.style.fontSize = "14px";
        status.style.fontWeight = "600";


        if (postButton) {

            postButton.parentNode.insertBefore(
                status,
                postButton
            );

        }

    }


    // --------------------------------------------------------
    // Preview function
    // --------------------------------------------------------

    function showPreview(file) {

        preview.innerHTML = "";

        if (!file) {

            preview.style.display = "none";

            return;
        }


        const objectURL =
            URL.createObjectURL(file);


        // IMAGE
        if (file.type.startsWith("image")) {

            const img =
                document.createElement("img");

            img.src = objectURL;

            img.alt = "Selected image";

            img.style.width = "100%";
            img.style.maxHeight = "400px";
            img.style.objectFit = "contain";
            img.style.display = "block";
            img.style.borderRadius = "10px";

            preview.appendChild(img);

        }


        // VIDEO
        else if (file.type.startsWith("video")) {

            const video =
                document.createElement("video");

            video.src = objectURL;

            video.controls = true;

            video.preload = "metadata";

            video.style.width = "100%";
            video.style.maxHeight = "400px";
            video.style.display = "block";
            video.style.borderRadius = "10px";

            preview.appendChild(video);

        }


        preview.style.display = "block";
    }


    // --------------------------------------------------------
    // IMAGE SELECTED
    // --------------------------------------------------------

    if (imageInput) {

        imageInput.addEventListener(
            "change",
            () => {

                const file =
                    imageInput.files[0];

                if (file) {

                    // Remove video selection
                    if (videoInput) {
                        videoInput.value = "";
                    }

                    showPreview(file);

                }

            }
        );

    }


    // --------------------------------------------------------
    // VIDEO SELECTED
    // --------------------------------------------------------

    if (videoInput) {

        videoInput.addEventListener(
            "change",
            () => {

                const file =
                    videoInput.files[0];

                if (file) {

                    // Remove image selection
                    if (imageInput) {
                        imageInput.value = "";
                    }

                    showPreview(file);

                }

            }
        );

    }

});


// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(file) {

    const type =
        file.type.startsWith("video")
            ? "video"
            : "image";


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    formData.append(
        "upload_preset",
        "vitalstar_upload"
    );


    const response =
        await fetch(
            `https://api.cloudinary.com/v1_1/m0scmqqv/${type}/upload`,
            {
                method: "POST",
                body: formData
            }
        );


    const data =
        await response.json();


    if (!response.ok || !data.secure_url) {

        console.error(
            "Cloudinary error:",
            data
        );

        throw new Error(
            data?.error?.message ||
            "Upload failed."
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

        button.disabled =
            isPosting;

        button.textContent =
            isPosting
                ? "Posting..."
                : "Post";

    }


    if (status) {

        status.style.display =
            isPosting
                ? "block"
                : "none";

        status.textContent =
            isPosting
                ? "Uploading your post, please wait..."
                : "";

    }

}


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


    if (
        !text &&
        !imageFile &&
        !videoFile
    ) {

        alert(
            "Write something or choose an image/video."
        );

        return;
    }


    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please login first."
        );

        return;
    }


    // START POSTING STATE
    setPostingState(true);


    try {

        // ----------------------------------------------------
        // Get user profile
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // Upload media
        // ----------------------------------------------------

        let imageUrl = "";

        let videoUrl = "";


        if (imageFile) {

            imageUrl =
                await uploadToCloudinary(
                    imageFile
                );

        }


        if (videoFile) {

            videoUrl =
                await uploadToCloudinary(
                    videoFile
                );

        }


        // ----------------------------------------------------
        // Save post
        // ----------------------------------------------------

        await addDoc(
            collection(
                db,
                "posts"
            ),
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


        // ----------------------------------------------------
        // Clear form
        // ----------------------------------------------------

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


        const preview =
            document.getElementById(
                "mediaPreview"
            );


        if (preview) {

            preview.innerHTML = "";

            preview.style.display =
                "none";

        }


        // ----------------------------------------------------
        // Success
        // ----------------------------------------------------

        alert(
            "Post created successfully!"
        );


        // Redirect home
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

        // STOP POSTING STATE
        setPostingState(false);

    }

};