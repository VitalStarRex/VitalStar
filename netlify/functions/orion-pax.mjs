export default async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return Response.json(
      { error: "Orion Pax accepts POST requests only." },
      {
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return Response.json(
        { error: "Please enter a message." },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key is not configured on Netlify." },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "gpt-5-mini",

          instructions:
            "You are Orion Pax, the text-only AI assistant of VitalStar. " +
            "Your personality is serious, calm, direct, and not cheerful. " +
            "Do not use excessive emojis or unnecessary enthusiasm. " +
            "Give clear and useful answers. " +
            "You communicate through text only. " +
            "Do not claim to have abilities you do not have.",

          input: message
        })
      }
    );

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("OpenAI error:", data);

      return Response.json(
        {
          error:
            data?.error?.message ||
            "OpenAI returned an error."
        },
        {
          status: openAIResponse.status,
          headers: {
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    const answer =
      data.output_text ||
      "Orion Pax could not generate a response.";

    return Response.json(
      {
        answer: answer
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (error) {
    console.error("Orion Pax error:", error);

    return Response.json(
      {
        error: "Orion Pax encountered an unexpected error."
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
};