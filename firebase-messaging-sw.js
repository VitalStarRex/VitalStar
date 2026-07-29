importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

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
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon-192.png"
  });
});