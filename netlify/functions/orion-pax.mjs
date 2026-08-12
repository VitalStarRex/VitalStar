// ============================================================
// VITALSTAR — ORION PAX
// Netlify Function → OpenRouter
// CORS enabled for vitalstar.pages.dev
// ============================================================

const corsHeaders = {
    "Access-Control-Allow-Origin": "https://vitalstar.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};


// ============================================================
// MAIN FUNCTION
// ============================================================

export default async function handler(req) {

    try {

        // ----------------------------------------------------
        // CORS PREFLIGHT
        // ----------------------------------------------------

        if (req.method === "OPTIONS") {

            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });

        }


        // ----------------------------------------------------
        // ONLY POST REQUESTS
        // ----------------------------------------------------

        if (req.method !== "POST") {

            return new Response(
                JSON.stringify({
                    error: "POST request required."
                }),
                {
                    status: 405,
                    headers: corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // READ REQUEST BODY
        // ----------------------------------------------------

        let body;

        try {

            body = await req.json();

        } catch {

            return new Response(
                JSON.stringify({
                    error: "Invalid JSON request."
                }),
                {
                    status: 400,
                    headers: corsHeaders
                }
            );

        }


        const message =
            typeof body?.message === "string"
                ? body.message.trim()
                : "";


        // ----------------------------------------------------
        // CHECK MESSAGE
        // ----------------------------------------------------

        if (!message) {

            return new Response(
                JSON.stringify({
                    error: "Message is required."
                }),
                {
                    status: 400,
                    headers: corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // GET OPENROUTER API KEY
        // ----------------------------------------------------

        const apiKey =
            process.env.OPENROUTER_API_KEY;


        if (!apiKey) {

            console.error(
                "OPENROUTER_API_KEY is missing."
            );

            return new Response(
                JSON.stringify({
                    error:
                        "OPENROUTER_API_KEY is missing from Netlify environment variables."
                }),
                {
                    status: 500,
                    headers: corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // SEND MESSAGE TO OPENROUTER
        // ----------------------------------------------------

        const openRouterResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {

                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${apiKey}`,

                    "Content-Type":
                        "application/json",

                    "HTTP-Referer":
                        "https://vitalstar.pages.dev",

                    "X-Title":
                        "VitalStar Orion Pax"

                },

                body: JSON.stringify({

                    model:
                        "openrouter/free",

                    messages: [

                        {
                            role: "system",

                            content:
                                "You are Orion Pax, the AI assistant for VitalStar. " +
                                "You are helpful, intelligent, friendly, clear and direct. " +
                                "Answer the user's questions naturally. " +
                                "You are a text-based AI assistant."
                        },

                        {
                            role: "user",

                            content:
                                message
                        }

                    ]

                })

            }
        );


        // ----------------------------------------------------
        // READ OPENROUTER RESPONSE
        // ----------------------------------------------------

        let data;

        try {

            data =
                await openRouterResponse.json();

        } catch {

            console.error(
                "OpenRouter returned invalid JSON."
            );

            return new Response(
                JSON.stringify({
                    error:
                        "OpenRouter returned an invalid response."
                }),
                {
                    status: 502,
                    headers: corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // OPENROUTER ERROR
        // ----------------------------------------------------

        if (!openRouterResponse.ok) {

            console.error(
                "OpenRouter error:",
                data
            );

            return new Response(
                JSON.stringify({

                    error:
                        data?.error?.message ||
                        "OpenRouter request failed.",

                    code:
                        data?.error?.code ||
                        openRouterResponse.status

                }),
                {
                    status:
                        openRouterResponse.status,

                    headers:
                        corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // GET AI RESPONSE
        // ----------------------------------------------------

        const answer =
            data?.choices?.[0]?.message?.content;


        if (
            typeof answer !== "string" ||
            !answer.trim()
        ) {

            console.error(
                "OpenRouter returned no answer:",
                data
            );

            return new Response(
                JSON.stringify({
                    error:
                        "OpenRouter returned an empty response."
                }),
                {
                    status: 502,
                    headers: corsHeaders
                }
            );

        }


        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        return new Response(

            JSON.stringify({

                answer:
                    answer.trim()

            }),

            {
                status: 200,
                headers: corsHeaders
            }

        );


    } catch (error) {

        // ----------------------------------------------------
        // UNEXPECTED ERROR
        // ----------------------------------------------------

        console.error(
            "ORION PAX ERROR:",
            error
        );


        return new Response(

            JSON.stringify({

                error:
                    "Orion Pax server error: " +
                    (
                        error?.message ||
                        "Unknown error"
                    )

            }),

            {
                status: 500,
                headers: corsHeaders
            }

        );

    }

}