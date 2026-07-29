import { messaging } from "./firebase.js";

import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const token = await getToken(messaging, {
    vapidKey: "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o"
});

console.log("VitalStar Notification Token:", token);

onMessage(messaging, (payload) => {
    console.log("New notification:", payload);
});