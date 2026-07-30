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

    snapshot.forEach((docSnap) => {

        const comment = docSnap.data();

        commentList.innerHTML += `

        <div class="comment">

            <b>${comment.username}</b>

            <br><br>

            ${comment.text}

        </div>

        `;

    });

});

window.sendComment = async function(){

    const text = document.getElementById("commentText").value.trim();

    if(text==""){
        return;
    }

    const user = auth.currentUser;

    const userSnap = await getDoc(doc(db,"users",user.uid));

    const username = userSnap.exists()
        ? userSnap.data().username
        : "VitalStar User";

    await addDoc(collection(db,"comments"),{

        postId:postId,

        uid:user.uid,

        username:username,

        text:text,

        createdAt:serverTimestamp()

    });

    await updateDoc(doc(db,"posts",postId),{

        comments:increment(1)

    });

    document.getElementById("commentText").value="";

};



window.openComments = function(postId){
    location.href = "comments.html?postId=" + postId;
};