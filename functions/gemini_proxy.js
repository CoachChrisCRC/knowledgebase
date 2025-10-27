// Netlify Function to securely call the Gemini API
import fetch from 'node-fetch'; // Netlify environment supports node-fetch

// The model and configuration constants
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

// System instruction for the AI (kept secure on the server)
const SYSTEM_PROMPT = "Act as a comprehensive, knowledge-based Q&A engine focused on fitness, nutrition, and training. Provide generalized, science-backed, and practical advice. Explicitly state that for personalized plans, diagnoses, or critical training decisions, the user must consult their actual personal trainer or medical professional. Keep responses concise and focused, using bullet points or bold text where helpful.";

// --- Handler for the Netlify Function ---
exports.handler = async (event, context) => {
    // 1. Check for valid method
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2. Retrieve API Key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Configuration Error: API Key missing." }),
        };
    }

    // 3. Parse the request body (sent by your frontend)
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: "Invalid JSON format." };
    }
    
    const userPrompt = body.prompt;
    if (!userPrompt) {
        return { statusCode: 400, body: "Missing 'prompt' in request body." };
    }

    // 4. Construct the Payload for the Google API
    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        // Enable Google Search grounding
        tools: [{ "google_search": {} }], 
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
    };

    try {
        // 5. Call the Google API securely
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle API errors (e.g., rate limits, invalid input)
            console.error("Gemini API Error:", result);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: result.error?.message || "Gemini API call failed." }),
            };
        }

        // 6. Process the result and extract content/sources
        const candidate = result?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        
        let sources = [];
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title);
        }

        // 7. Return the final, clean JSON response to the client
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, sources }),
        };

    } catch (error) {
        console.error("Unexpected function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An unexpected server error occurred." }),
        };
    }
};


