importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDIePnptlh5c4q9RSPZJ8pYLAYNswNHgCs",
  authDomain: "mysocialapp-87ea4.firebaseapp.com",
  projectId: "mysocialapp-87ea4",
  storageBucket: "mysocialapp-87ea4.firebasestorage.app",
  messagingSenderId: "164883751409",
  appId: "1:164883751409:web:b7ccfcc42dfc06783fe450"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

  console.log("Background notification:", payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "VitalStar";

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "You have a new notification.";

  self.registration.showNotification(title, {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: payload.data?.url || "/"
    }
  });

});

self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  const url =
    event.notification.data?.url ||
    "/";

  event.waitUntil(

    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {

      for (const client of clientList) {

        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }

      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }

    })

  );

});