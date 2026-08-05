import { db, auth, messaging } from "./firebase.js";

import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";


// MARK ALL NOTIFICATIONS AS READ

window.markAllNotificationsRead = async function () {

  const user = auth.currentUser;

  if (!user) {
    alert("Please login first");
    return;
  }

  try {

    const unreadQuery = query(
      collection(db, "notifications"),
      where("receiverId", "==", user.uid),
      where("read", "==", false)
    );

    const snapshot = await getDocs(unreadQuery);

    if (snapshot.empty) {
      return;
    }

    const batch = writeBatch(db);

    snapshot.forEach((notificationDoc) => {
      batch.update(notificationDoc.ref, { read: true });
    });

    await batch.commit();

  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
  }

};

const markAllReadLink = document.getElementById("markAllReadLink");

if (markAllReadLink) {
  markAllReadLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.markAllNotificationsRead();
  });
}


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