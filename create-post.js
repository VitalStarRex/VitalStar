import { db, auth } from "./firebase.js";

import {
 addDoc,
 collection,
 serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


window.createPost = async function(){

const text = document.getElementById("postText").value;

const user = auth.currentUser;


if(!user){
 alert("Please login first");
 return;
}


await addDoc(collection(db,"posts"),{

uid:user.uid,
text:text,
createdAt:serverTimestamp()

});


alert("Post created!");

};