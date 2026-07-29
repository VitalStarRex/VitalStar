import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.sendMessage = async function () {

    const input = document.getElementById("messageInput");

    const text = input.value.trim();

    if (text === "") return;

    try{

        await addDoc(collection(db,"messages"),{

            text:text,
            type:"text",
            time:serverTimestamp()

        });

        input.value="";

    }catch(error){

        console.log(error);

        alert("Message failed to send");

    }

};