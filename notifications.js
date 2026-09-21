import { db, auth, messaging } from "./firebase.js";

import {
  doc,
  setDoc,
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
      batch.update(notificationDoc.ref, {
        read: true
      });
    });

    await batch.commit();

  } catch (error) {

    console.error(
      "Failed to mark notifications as read:",
      error
    );

  }

};


const markAllReadLink =
  document.getElementById("markAllReadLink");

if (markAllReadLink) {

  markAllReadLink.addEventListener("click", (e) => {

    e.preventDefault();

    window.markAllNotificationsRead();

  });

}


// PUSH NOTIFICATIONS

async function setupPushNotifications() {

  try {

    if (!("Notification" in window)) {
      console.log("Notifications are not supported.");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("Service workers are not supported.");
      return;
    }


    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {

      console.log(
        "Notification permission was not granted."
      );

      return;
    }


    const registration =
      await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );


    const token = await getToken(messaging, {

      vapidKey:
        "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o",

      serviceWorkerRegistration:
        registration

    });


    if (!token) {

      console.log(
        "No FCM token received."
      );

      return;
    }


    console.log(
      "FCM Token:",
      token
    );


    auth.onAuthStateChanged(
      async (user) => {

        if (!user) {
          return;
        }

        try {

          await setDoc(
            doc(db, "users", user.uid),
            {
              fcmToken: token
            },
            {
              merge: true
            }
          );

          console.log(
            "FCM token saved!"
          );

        } catch (error) {

          console.error(
            "Failed to save FCM token:",
            error
          );

        }

      }
    );


  } catch (error) {

    console.error(
      "Push notification setup failed:",
      error
    );

  }

}


setupPushNotifications();


// FOREGROUND NOTIFICATIONS

onMessage(messaging, (payload) => {

  console.log(
    "Foreground notification:",
    payload
  );


  const title =
    payload.notification?.title ||
    "VitalStar";


  const body =
    payload.notification?.body ||
    "You have a new notification.";


  if (
    Notification.permission ===
    "granted"
  ) {

    new Notification(title, {
      body: body,
      icon: "/icon-192.png"
    });

  }

});