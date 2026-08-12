const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

export default async (req) => {
    try {
        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({
                    error: "POST request required."
                }),
                {
                    status: 405,
                    headers: {
                        ...corsHeaders,
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
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error: "OPENROUTER_API_KEY is missing."
                }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

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
                                "You are Orion Pax, the AI assistant for VitalStar. Be helpful, intelligent, friendly, clear and direct."
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

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error:
                        data?.error?.message ||
                        "OpenRouter request failed."
                }),
                {
                    status: response.status,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const answer =
            data?.choices?.[0]?.message?.content;

        if (!answer) {
            return new Response(
                JSON.stringify({
                    error: "OpenRouter returned an empty response."
                }),
                {
                    status: 502,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({
                answer: answer
            }),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {

        console.error("Orion error:", error);

        return new Response(
            JSON.stringify({
                error: error.message
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );
    }
};