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

    return data.secure_url || "";
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




    // Get user profile

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);



    let fullName = "VitalStar User";


    if (userSnap.exists()) {

        fullName =
        userSnap.data().fullName || "VitalStar User";

    }





    let imageUrl = "";

    let videoUrl = "";



    // Upload image

    if (imageFile) {

        imageUrl = await uploadToCloudinary(imageFile);


        if (!imageUrl) {

            alert("Image upload failed.");

            return;
        }
    }





    // Upload video

    if (videoFile) {

        videoUrl = await uploadToCloudinary(videoFile);


        if (!videoUrl) {

            alert("Video upload failed.");

            return;
        }
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






    document.getElementById("postText").value = "";


    if(document.getElementById("postImage")){

        document.getElementById("postImage").value = "";

    }


    if(document.getElementById("postVideo")){

        document.getElementById("postVideo").value = "";

    }




    alert("Post created successfully!");

};