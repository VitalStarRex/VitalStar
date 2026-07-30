import { db, auth } from "./firebase.js";

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
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const postId = params.get("postId");

const commentList = document.getElementById("commentList");

const q = query(
    collection(db, "comments"),
    where("postId", "==", postId),
    orderBy("createdAt", "asc")
);

onSnapshot(q, (snapshot) => {

    commentList.innerHTML = "";

    if (snapshot.empty) {

        commentList.innerHTML =
        "<p style='text-align:center;padding:20px;'>No comments yet.</p>";

        return;

    }

    snapshot.forEach((docSnap) => {

        const comment = docSnap.data();

        let date = "Just now";

        if (comment.createdAt) {

            try {

                date = comment.createdAt
                .toDate()
                .toLocaleString();

            } catch (e) {}

        }

        commentList.innerHTML += `

<div class="comment">

<div class="comment-header">

<div class="comment-avatar">
👤
</div>

<div>

<b>${comment.username || "VitalStar User"}</b>

<br>

<small style="color:gray;">
${date}
</small>

</div>

</div>

<p class="comment-text">

${comment.text || ""}

</p>

${comment.image ?

`

<img
class="comment-photo"
src="${comment.image}">

`

: ""}

</div>

`;

    });

});

window.sendComment = async function () {

    try {

        const text =
        document.getElementById("commentText").value.trim();

        const imageFile =
        document.getElementById("commentImage").files[0];

        if (!text && !imageFile) {

            alert("Write a comment or choose an image.");

            return;

        }

        const user = auth.currentUser;

        if (!user) {

            alert("Please login first.");

            return;

        }

        const userDoc =
        await getDoc(doc(db, "users", user.uid));

        let username = "VitalStar User";

        if (userDoc.exists()) {

            username =
            userDoc.data().username ||
            "VitalStar User";

        }

        let imageUrl = "";

        if (imageFile) {

            const formData = new FormData();

            formData.append("file", imageFile);

            formData.append(
                "upload_preset",
                "vitalstar_upload"
            );

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
      








        await addDoc(collection(db, "comments"), {

            postId: postId,
            uid: user.uid,
            username: username,
            text: text,
            image: imageUrl,
            createdAt: serverTimestamp()

        });

        await updateDoc(doc(db, "posts", postId), {

            comments: increment(1)

        });

        document.getElementById("commentText").value = "";
        document.getElementById("commentImage").value = "";

        alert("Comment posted successfully!");

    } catch (error) {

        console.error(error);
        alert(error.message);

    }

};