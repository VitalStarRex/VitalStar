import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const { token, title, body, url } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "FCM token is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const message = {
      token,

      notification: {
        title: title || "VitalStar",
        body: body || "You have a new notification."
      },

      data: {
        url: url || "/"
      },

      webpush: {
        notification: {
          title: title || "VitalStar",
          body: body || "You have a new notification.",
          icon: "/icon-192.png",
          badge: "/icon-192.png"
        },

        fcmOptions: {
          link: url || "/"
        }
      }
    };

    const response = await getMessaging().send(message);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: response
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("FCM send error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};