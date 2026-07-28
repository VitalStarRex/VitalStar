
// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDIePnptlh5c4q9RSPZJ8pYLAYNswNHgCs",
  authDomain: "mysocialapp-87ea4.firebaseapp.com",
  projectId: "mysocialapp-87ea4",
  storageBucket: "mysocialapp-87ea4.firebasestorage.app",
  messagingSenderId: "164883751409",
  appId: "1:164883751409:web:b7ccfcc42dfc06783fe450",
  measurementId: "G-6L9PV3CRT3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };