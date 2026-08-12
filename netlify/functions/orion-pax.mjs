export default async (req) => {
    try {
        // Only allow POST requests
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

        // Read the user's message
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

        // Get the secret from Netlify
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error: "OPENROUTER_API_KEY is missing from Netlify."
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Send request to OpenRouter
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://vitalstar.netlify.app",
                    "X-Title": "VitalStar Orion Pax"
                },

                body: JSON.stringify({
                    model: "openrouter/free",

                    messages: [
                        {
                            role: "system",
                            content:
                                "You are Orion Pax, the AI assistant for VitalStar. " +
                                "Be helpful, intelligent, friendly, clear, and direct. " +
                                "You are a text-based AI assistant."
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        // OpenRouter returned an error
        if (!response.ok) {
            console.error("OpenRouter error:", data);

            return new Response(
                JSON.stringify({
                    error:
                        data?.error?.message ||
                        "OpenRouter request failed."
                }),
                {
                    status: response.status,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Get Orion's answer
        const answer =
            data?.choices?.[0]?.message?.content;

        if (!answer) {
            return new Response(
                JSON.stringify({
                    error:
                        "OpenRouter returned an empty response."
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Send answer back to orion.html
        return new Response(
            JSON.stringify({
                answer: answer
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {

        console.error(
            "Orion Pax function error:",
            error
        );

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