// ============================================================
// VITALSTAR — create-post.js
// Handles:
// - Authentication
// - Image preview
// - Video preview
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
// ELEMENTS
// ============================================================

const imageInput =
    document.getElementById("postImage");

const videoInput =
    document.getElementById("postVideo");

const imagePreview =
    document.getElementById("imagePreview");

const videoPreview =
    document.getElementById("videoPreview");

const postButton =
    document.getElementById("postButton");


// ============================================================
// CREATE POSTING STATUS
// ============================================================

const postStatus =
    document.createElement("div");

postStatus.id = "postStatus";

postStatus.style.display = "none";
postStatus.style.textAlign = "center";
postStatus.style.marginTop = "12px";
postStatus.style.padding = "10px";
postStatus.style.borderRadius = "8px";
postStatus.style.fontSize = "14px";
postStatus.style.fontWeight = "bold";
postStatus.style.color = "#1877f2";


// Put status underneath the Post button

if (postButton) {

    postButton.parentNode.appendChild(
        postStatus
    );

}


// ============================================================
// POSTING STATE
// ============================================================

function setPostingState(isPosting) {

    if (!postButton) {
        return;
    }


    postButton.disabled =
        isPosting;


    if (isPosting) {

        postButton.textContent =
            "⏳ Posting...";

        postStatus.style.display =
            "block";

        postStatus.textContent =
            "Uploading your post, please wait...";

    }
    else {

        postButton.textContent =
            "🚀 Post";

        postStatus.style.display =
            "none";

        postStatus.textContent =
            "";

    }

}


// ============================================================
// IMAGE PREVIEW
// ============================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        () => {

            const file =
                imageInput.files[0];


            if (!file) {
                return;
            }


            // Clear video input
            if (videoInput) {
                videoInput.value = "";
            }


            // Hide video preview
            if (videoPreview) {

                videoPreview.pause();

                videoPreview.removeAttribute(
                    "src"
                );

                videoPreview.load();

                videoPreview.style.display =
                    "none";

            }


            // Show image preview
            if (imagePreview) {

                const imageURL =
                    URL.createObjectURL(file);


                imagePreview.src =
                    imageURL;


                imagePreview.style.display =
                    "block";

            }

        }
    );

}


// ============================================================
// VIDEO PREVIEW
// ============================================================

if (videoInput) {

    videoInput.addEventListener(
        "change",
        () => {

            const file =
                videoInput.files[0];


            if (!file) {
                return;
            }


            // Clear image input
            if (imageInput) {
                imageInput.value = "";
            }


            // Hide image preview
            if (imagePreview) {

                imagePreview.removeAttribute(
                    "src"
                );

                imagePreview.style.display =
                    "none";

            }


            // Show video preview
            if (videoPreview) {

                const videoURL =
                    URL.createObjectURL(file);


                videoPreview.src =
                    videoURL;


                videoPreview.style.display =
                    "block";

            }

        }
    );

}


// ============================================================
// CLOUDINARY UPLOAD
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
            "Cloudinary upload error:",
            data
        );


        throw new Error(
            data?.error?.message ||
            "Media upload failed."
        );

    }


    return data.secure_url;

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
        imageInput?.files[0];


    const videoFile =
        videoInput?.files[0];


    // --------------------------------------------------------
    // Nothing entered
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Check login
    // --------------------------------------------------------

    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please login first."
        );

        return;
    }


    // --------------------------------------------------------
    // START POSTING STATE
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
        // UPLOAD MEDIA
        // ====================================================

        let imageUrl = "";

        let videoUrl = "";


        // IMAGE
        if (imageFile) {

            imageUrl =
                await uploadToCloudinary(
                    imageFile
                );

        }


        // VIDEO
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
            collection(
                db,
                "posts"
            ),
            {

                uid:
                    user.uid,

                fullName:
                    fullName,

                text:
                    text,

                image:
                    imageUrl,

                video:
                    videoUrl,

                likes:
                    0,

                comments:
                    0,

                shares:
                    0,

                reposts:
                    0,

                createdAt:
                    serverTimestamp()

            }
        );


        // ====================================================
        // CLEAR FORM
        // ====================================================

        if (textElement) {

            textElement.value =
                "";

        }


        if (imageInput) {

            imageInput.value =
                "";

        }


        if (videoInput) {

            videoInput.value =
                "";

        }


        // Clear image preview
        if (imagePreview) {

            imagePreview.removeAttribute(
                "src"
            );

            imagePreview.style.display =
                "none";

        }


        // Clear video preview
        if (videoPreview) {

            videoPreview.pause();

            videoPreview.removeAttribute(
                "src"
            );

            videoPreview.load();

            videoPreview.style.display =
                "none";

        }


        // ====================================================
        // SUCCESS
        // ====================================================

        alert(
            "Post created successfully!"
        );


        // ====================================================
        // REDIRECT TO HOME
        // ====================================================

        window.location.href =
            "home.html";


    }
    catch (error) {

        console.error(
            "createPost error:",
            error
        );


        alert(
            error.message ||
            "Something went wrong. Please try again."
        );

    }
    finally {

        // Stop posting state
        setPostingState(false);

    }

};