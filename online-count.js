import { rtdb } from "./firebase.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const onlineUsersCount =
document.getElementById("onlineUsersCount");


if(onlineUsersCount){

    onValue(ref(rtdb, "status"), (snapshot)=>{

        let count = 0;


        snapshot.forEach((child)=>{

            const user = child.val();


            if(user.online === true){

                count++;

            }

        });


        onlineUsersCount.textContent =
        `🟢 Online: ${count}`;


    });

}