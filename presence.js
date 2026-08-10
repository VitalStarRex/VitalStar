// ============================================================
// VITALSTAR — presence.js
// Firebase Realtime Database Presence System
// ============================================================

import { auth } from "./firebase.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// ============================================================
// DATABASE
// ============================================================

const db = getDatabase();


// ============================================================
// FIREBASE CONNECTION
// ============================================================

const connectedRef = ref(db, ".info/connected");


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {
    return;
  }

  startPresence(user.uid);

});


// ============================================================
// PRESENCE
// ============================================================

function startPresence(uid) {

  const statusRef = ref(db, "status/" + uid);


  onValue(connectedRef, async (snapshot) => {

    if (snapshot.val() !== true) {
      return;
    }


    console.log("VitalStar: Firebase connected");


    // ========================================================
    // IMPORTANT:
    // Firebase will automatically execute this when the
    // user's connection disappears.
    // ========================================================

    try {

      await onDisconnect(statusRef).set({
        online: false,
        lastSeen: serverTimestamp()
      });

      console.log(
        "VitalStar: offline handler registered"
      );

    } catch (error) {

      console.error(
        "VitalStar: onDisconnect failed:",
        error
      );

      return;
    }


    // ========================================================
    // MARK USER ONLINE
    // ========================================================

    try {

      await set(statusRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      console.log(
        "VitalStar: USER ONLINE",
        uid
      );

    } catch (error) {

      console.error(
        "VitalStar: unable to mark user online:",
        error
      );

    }

  });

}