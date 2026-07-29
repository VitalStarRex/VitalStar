import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const messages = document.getElementById("messages");

// Send message
window.sendMessage = async function () {

    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if(text === "") return;

    try{

        await addDoc(collection(db,"messages"),{
            text:text,
            type:"text",
            time:serverTimestamp()
        });

        input.value="";

    }catch(error){
        console.error(error);
        alert("Message failed!");
    }

};

// Load messages in real time
const q = query(
    collection(db,"messages"),
    orderBy("time","asc")
);

onSnapshot(q,(snapshot)=>{

    messages.innerHTML="";

    snapshot.forEach((doc)=>{

        const data = doc.data();

        const div = document.createElement("div");
        div.className="message sent";
        div.textContent=data.text;

        messages.appendChild(div);

    });

    messages.scrollTop = messages.scrollHeight;

});