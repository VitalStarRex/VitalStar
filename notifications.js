import { messaging } from "./firebase.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

(async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: "BEkwoctvtqjDmybrhAY-gGrG8_aBxTBmxDUoqq5w43H8MW6z0IwvOzmCLI3AZKY1KLqc5YuTFrt2cL-952QjV7o"
    });

    alert("Token: " + token);
    console.log("Token:", token);

  } catch (error) {
    alert("Notification Error: " + error.message);
    console.error(error);
  }
})();

onMessage(messaging, (payload) => {
  alert("New notification received!");
  console.log(payload);
});