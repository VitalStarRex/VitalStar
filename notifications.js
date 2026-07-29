import { db, auth, messaging } from "./firebase.js";

import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

(async () => {
  try {

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o",
      serviceWorkerRegistration: registration
    });

    console.log("Token:", token);

   

auth.onAuthStateChanged(async (user) => {

    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
        fcmToken: token
    });

    console.log("FCM token saved!");

});

 
      
      
    

  } catch (error) {
    console.error(error);
    alert(error.message);
  }

})();

onMessage(messaging, (payload) => {

  alert(payload.notification?.title || "New notification");

  console.log(payload);

});