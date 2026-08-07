// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

// Firebase Services
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDIePnptlh5c4q9RSPZJ8pYLAYNswNHgCs",
  authDomain: "mysocialapp-87ea4.firebaseapp.com",
  projectId: "mysocialapp-87ea4",
  databaseURL: "https://mysocialapp-87ea4-default-rtdb.firebaseio.com",
  storageBucket: "mysocialapp-87ea4.firebasestorage.app",
  messagingSenderId: "164883751409",
  appId: "1:164883751409:web:b7ccfcc42dfc06783fe450",
  measurementId: "G-6L9PV3CRT3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Optional export
export { app };