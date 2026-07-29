import { db } from "./firebase.js";

import {
collection,
query,
orderBy,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const postsDiv = document.getElementById("posts");


const q = query(
 collection(db,"posts"),
 orderBy("createdAt","desc")
);


onSnapshot(q,(snapshot)=>{

postsDiv.innerHTML="";


snapshot.forEach((doc)=>{

const post = doc.data();


postsDiv.innerHTML += `

<div style="border:1px solid black; padding:10px; margin:10px;">

<p>${post.text}</p>

</div>

`;

});


});