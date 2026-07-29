import { messaging, db } from "./firebase.js";

import {
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function enableNotifications() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Notifications are disabled.");
    return;
  }

  const token = await getToken(messaging, {
    vapidKey: "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o"
  });

  console.log("FCM Token:", token);

  const uid = localStorage.getItem("uid");

  if (uid && token) {
    await updateDoc(doc(db, "users", uid), {
      fcmToken: token
    });
  }
}

enableNotifications();

onMessage(messaging, (payload) => {
  alert(payload.notification.title + "\n\n" + payload.notification.body);
});