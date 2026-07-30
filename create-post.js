import { db, auth } from "./firebase.js";

import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.createPost = async function () {

    const text = document.getElementById("postText").value.trim();
    const imageFile = document.getElementById("postImage").files[0];

    if (!text && !imageFile) {
        alert("Write something or choose an image.");
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        alert("Please login first.");
        return;
    }

    // Get user's profile
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let username = "VitalStar User";

    if (userSnap.exists()) {
        username = userSnap.data().username || "VitalStar User";
    }

    let imageUrl = "";

    // Upload image to Cloudinary
    if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("upload_preset", "vitalstar_upload");

        const response = await fetch(
            "https://api.cloudinary.com/v1_1/m0scmqqv/image/upload",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (data.secure_url) {
            imageUrl = data.secure_url;
        } else {
            alert("Image upload failed.");
            return;
        }
    }

    await addDoc(collection(db, "posts"), {
        uid: user.uid,
        username: username,
        text: text,
        image: imageUrl,
        likes: 0,
        comments: 0,
        shares: 0,
        reposts: 0,
        createdAt: serverTimestamp()
    });

    document.getElementById("postText").value = "";
    document.getElementById("postImage").value = "";

    alert("Post created successfully!");
};