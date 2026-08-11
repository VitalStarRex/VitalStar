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


onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
});


// --- File validation limits ---
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;


function validateFile(file, type) {
    const maxMB = type === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    const maxBytes = maxMB * 1024 * 1024;

    if (!file.type.startsWith(type)) {
        return `Please choose a valid ${type} file.`;
    }

    if (file.size > maxBytes) {
        return `${type === "video" ? "Video" : "Image"} must be under ${maxMB}MB.`;
    }

    return null; // no error
}


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
        console.error("Cloudinary upload error:", data);
        throw new Error(data?.error?.message || "Upload failed. Please try again.");
    }

    return data.secure_url;
}


// --- UI helpers ---

function setPostingState(isPosting) {
    const btn = document.getElementById("postSubmitBtn");
    const status = document.getElementById("postStatus");

    if (btn) {
        btn.disabled = isPosting;
        btn.textContent = isPosting ? "Posting..." : "Post";
    }

    if (status) {
        status.textContent = isPosting ? "Uploading, please wait..." : "";
    }
}


window.createPost = async function () {

    const text = document
        .getElementById("postText")
        .value
        .trim();

    const imageFile =
        document.getElementById("postImage")
        ?.files[0];

    const videoFile =
        document.getElementById("postVideo")
        ?.files[0];

    if (!text && !imageFile && !videoFile) {
        alert("Write something or choose an image/video.");
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        alert("Please login first.");
        return;
    }

    // Validate files BEFORE uploading anything
    if (imageFile) {
        const error = validateFile(imageFile, "image");
        if (error) {
            alert(error);
            return;
        }
    }

    if (videoFile) {
        const error = validateFile(videoFile, "video");
        if (error) {
            alert(error);
            return;
        }
    }

    setPostingState(true);

    try {

        // Get user profile
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        let fullName = "VitalStar User";

        if (userSnap.exists()) {
            fullName = userSnap.data().fullName || "VitalStar User";
        }

        let imageUrl = "";
        let videoUrl = "";

        // Upload image
        if (imageFile) {
            imageUrl = await uploadToCloudinary(imageFile);
        }

        // Upload video
        if (videoFile) {
            videoUrl = await uploadToCloudinary(videoFile);
        }

        // Save post
        await addDoc(collection(db, "posts"), {
            uid: user.uid,
            fullName: fullName,
            text: text,
            image: imageUrl,
            video: videoUrl,
            likes: 0,
            comments: 0,
            shares: 0,
            reposts: 0,
            createdAt: serverTimestamp()
        });

        // Reset form
        document.getElementById("postText").value = "";

        if (document.getElementById("postImage")) {
            document.getElementById("postImage").value = "";
        }

        if (document.getElementById("postVideo")) {
            document.getElementById("postVideo").value = "";
        }

        alert("Post created successfully!");

    } catch (err) {
        console.error("createPost error:", err);
        alert(err.message || "Something went wrong. Please try again.");

    } finally {
        setPostingState(false);
    }

};
