// ============================================================
// VITALSTAR — presence.js
// Reliable Firebase Realtime Database presence system
// ============================================================

import { auth, db, rtdb } from "./firebase.js";

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

import {
  doc,
  updateDoc,
  serverTimestamp as firestoreServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// FIREBASE CONNECTION STATUS
// ============================================================

const connectedRef = ref(rtdb, ".info/connected");


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {
    return;
  }

  setupPresence(user.uid);

});


// ============================================================
// SETUP PRESENCE
// ============================================================

function setupPresence(uid) {

  const statusRef = ref(rtdb, `status/${uid}`);

  const offlineData = {
    online: false,
    lastSeen: serverTimestamp()
  };


  // ==========================================================
  // WATCH FIREBASE CONNECTION
  // ==========================================================

  onValue(connectedRef, async (snapshot) => {

    const connected = snapshot.val();

    console.log(
      "VitalStar Firebase connection:",
      connected
    );


    // --------------------------------------------------------
    // NOT CONNECTED
    // --------------------------------------------------------

    if (connected !== true) {
      return;
    }


    // --------------------------------------------------------
    // IMPORTANT:
    // Tell Firebase what to do automatically when connection
    // disappears.
    // --------------------------------------------------------

    try {

      await onDisconnect(statusRef).set(offlineData);

      console.log(
        "VitalStar: onDisconnect configured."
      );

    } catch (error) {

      console.error(
        "VitalStar: Unable to configure onDisconnect:",
        error
      );

      return;

    }


    // --------------------------------------------------------
    // USER IS ONLINE
    // --------------------------------------------------------

    try {

      await set(statusRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      console.log(
        "VitalStar: User is ONLINE:",
        uid
      );

    } catch (error) {

      console.error(
        "VitalStar: Unable to set online status:",
        error
      );

      return;

    }


    // ========================================================
    // ALSO UPDATE FIRESTORE
    // ========================================================

    try {

      await updateDoc(
        doc(db, "users", uid),
        {
          online: true,
          lastSeen: firestoreServerTimestamp()
        }
      );

      console.log(
        "VitalStar: Firestore online status updated."
      );

    } catch (error) {

      console.error(
        "VitalStar: Firestore online update failed:",
        error
      );

    }

  });

}