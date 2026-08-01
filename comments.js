
import { auth, db } from "./firebase.js";




import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});




     
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









const params = new URLSearchParams(window.location.search);
const postId = params.get("postId");

alert(commentList);



const commentList = document.getElementById("commentList");

alert("commentList loaded");






const q = query(
    collection(db, "comments")
);


     


  onSnapshot(q, (snapshot) => {

    alert("Comments found: " + snapshot.size);

    console.log("Snapshot:", snapshot);
    console.log("Number of comments:", snapshot.size);

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

<img
src="${comment.profilePicture || 'https://via.placeholder.com/45'}"
style="
width:100%;
height:100%;
border-radius:50%;
object-fit:cover;
">

</div>

<div>

<b>${comment.fullName || "VitalStar User"}</b>

<br>

<span style="color:#1877f2;font-size:13px;">
@${comment.username || "username"}
</span>

<br>

<small style="color:gray;">
${date}
</small>

</div>


</div>

<p class="comment-text">

${comment.text || ""}

</p>







${comment.image ? `

<img
class="comment-photo"
src="${comment.image}">

` : ""}

<div class="comment-actions">

<button onclick="likeComment('${docSnap.id}')">
❤️ ${comment.likes || 0}
</button>

<button onclick="showReplyBox('${docSnap.id}')">
💬 Reply
</button>

</div>

<div id="replyBox-${docSnap.id}"></div>

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

        


const userDoc = await getDoc(doc(db, "users", user.uid));

let username = "VitalStar User";
let fullName = "VitalStar User";
let profilePicture = "";

if (userDoc.exists()) {

    const userData = userDoc.data();

    username = userData.username || "VitalStar User";
    fullName = userData.fullName || "VitalStar User";
    profilePicture = userData.profilePicture || "";

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
      







       alert("Saving comment to post: " + postId);



await addDoc(collection(db, "comments"), {

    postId: postId,
    uid: user.uid,
    username: username,
    fullName: fullName,
    profilePicture: profilePicture,
    text: text,
    image: imageUrl,
    likes: 0,
    replies: 0,
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









window.likeComment = async function(commentId) {

    try {

        const user = auth.currentUser;

        if (!user) {
            alert("Please login first.");
            return;
        }

        const likeId = `${commentId}_${user.uid}`;

        const likeRef = doc(db, "commentLikes", likeId);

        const likeSnap = await getDoc(likeRef);

        const commentRef = doc(db, "comments", commentId);

        if (likeSnap.exists()) {

            // Unlike
            await deleteDoc(likeRef);

            await updateDoc(commentRef, {
                likes: increment(-1)
            });

        } else {

            // Like
            await setDoc(likeRef, {
                commentId: commentId,
                uid: user.uid,
                createdAt: new Date()
            });

            await updateDoc(commentRef, {
                likes: increment(1)
            });

        }

    } catch (err) {

        console.error(err);
        alert("Failed to like comment.");

    }

};