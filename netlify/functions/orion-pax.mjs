export default async (req) => {
    try {
        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({
                    error: "POST request required."
                }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const body = await req.json();

        const message = body?.message?.trim();

        if (!message) {
            return new Response(
                JSON.stringify({
                    error: "Message is required."
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error: "OPENAI_API_KEY is missing from Netlify."
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const response = await fetch(
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
                        "You are Orion Pax, the AI assistant for VitalStar. " +
                        "Be helpful, clear, calm and direct.",

                    input: message
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI error:", data);

            return new Response(
                JSON.stringify({
                    error:
                        data?.error?.message ||
                        "OpenAI request failed."
                }),
                {
                    status: response.status,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({
                answer:
                    data.output_text ||
                    "Orion Pax did not return a response."
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {

        console.error("Orion function error:", error);

        return new Response(
            JSON.stringify({
                error:
                    "Orion Pax server error: " +
                    error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
};