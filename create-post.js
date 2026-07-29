import {db} from "./firebase.js";


import {

collection,
query,
orderBy,
onSnapshot,
doc,
updateDoc,
increment

}

from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



const feed = document.getElementById("feed");



const q = query(

collection(db,"posts"),

orderBy("createdAt","desc")

);



onSnapshot(q,(snapshot)=>{


feed.innerHTML="";


snapshot.forEach((item)=>{


let post=item.data();

let id=item.id;



feed.innerHTML += `


<div class="post-card">


<div class="user">

👤 ${post.username}

</div>



<div class="post-text">

${post.text}

</div>



<div class="actions">


<button onclick="likePost('${id}')">

❤️ ${post.likes || 0}

</button>



<button onclick="commentPost('${id}')">

💬 ${post.comments || 0}

</button>



<button onclick="sharePost('${id}')">

🔗 ${post.shares || 0}

</button>



<button onclick="repostPost('${id}')">

🔁 ${post.reposts || 0}

</button>


</div>



</div>


`;


});


});




// LIKE

window.likePost = async function(id){

await updateDoc(

doc(db,"posts",id),

{

likes:increment(1)

}

);

};




// COMMENT COUNT

window.commentPost = async function(id){

await updateDoc(

doc(db,"posts",id),

{

comments:increment(1)

}

);


alert("Comment system will be connected next");

};




// SHARE

window.sharePost = async function(id){

await updateDoc(

doc(db,"posts",id),

{

shares:increment(1)

}

);


alert("Post shared");

};




// REPOST

window.repostPost = async function(id){

await updateDoc(

doc(db,"posts",id),

{

reposts:increment(1)

}

);


};