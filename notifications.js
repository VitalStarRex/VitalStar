import { messaging } from "./firebase.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

(async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }

    // Wait for the service worker you already registered
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o",
      serviceWorkerRegistration: registration
    });

                    

  import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, auth } from "./firebase.js";

// ...

console.log("Token:", token);

const user = auth.currentUser;

if (user) {
    await updateDoc(doc(db, "users", user.uid), {
        fcmToken: token
    });
}



  } catch (error) {
    alert("Notification Error: " + error.message);
    console.error(error);
  }
})();

onMessage(messaging, (payload) => {
  alert("New notification received!");
  console.log(payload);
});