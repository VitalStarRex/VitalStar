// ============================================================
// VITALSTAR — presence.js
// Reliable Firebase Realtime Database presence
// ============================================================

import { auth, rtdb } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// FIREBASE CONNECTION
// ============================================================

const connectedRef = ref(rtdb, ".info/connected");

let heartbeatTimer = null;


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    return;
  }

  startPresence(user.uid);

});


// ============================================================
// START PRESENCE
// ============================================================

function startPresence(uid) {

  const statusRef = ref(rtdb, `status/${uid}`);


  onValue(connectedRef, async (snapshot) => {

    const connected = snapshot.val();

    console.log(
      "VitalStar Firebase connection:",
      connected
    );


    // ========================================================
    // NOT CONNECTED
    // ========================================================

    if (connected !== true) {

      return;

    }


    // ========================================================
    // AUTOMATIC OFFLINE STATUS
    // ========================================================

    try {

      await onDisconnect(statusRef).set({
        online: false,
        lastSeen: serverTimestamp()
      });

      console.log(
        "VitalStar: onDisconnect configured"
      );

    } catch (error) {

      console.error(
        "VitalStar: onDisconnect error:",
        error
      );

      return;

    }


    // ========================================================
    // MARK ONLINE
    // ========================================================

    try {

      await set(statusRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      console.log(
        "VitalStar: ONLINE",
        uid
      );

    } catch (error) {

      console.error(
        "VitalStar: Unable to set online:",
        error
      );

      return;

    }


    // ========================================================
    // HEARTBEAT
    // Refresh lastSeen every 30 seconds
    // ========================================================

    if (heartbeatTimer) {

      clearInterval(heartbeatTimer);

    }


    heartbeatTimer = setInterval(async () => {

      try {

        await set(statusRef, {
          online: true,
          lastSeen: serverTimestamp()
        });

      } catch (error) {

        console.error(
          "VitalStar heartbeat error:",
          error
        );

      }

    }, 30000);

  });

}