import { auth, rtdb } from "./firebase.js";

import {
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


onAuthStateChanged(auth, (user) => {

  if (!user) return;

  const userStatusRef = ref(rtdb, "status/" + user.uid);

  const connectedRef = ref(rtdb, ".info/connected");


  onValue(connectedRef, (snapshot) => {

    if (snapshot.val() === false) {
      return;
    }


    // When user disconnects
    onDisconnect(userStatusRef).set({
      online: false,
      lastSeen: serverTimestamp()
    });


    // User is online
    set(userStatusRef, {
      online: true,
      lastSeen: serverTimestamp()
    });

  });

});