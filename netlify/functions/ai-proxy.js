// netlify/functions/ai-proxy.js

/**
 * Netlify serverless function to securely proxy requests to the Gemini API.
 * This prevents the API key from being exposed on the client side.
 * It uses Google Search Grounding for current, verifiable information.
 */

// Global constant for the model and API endpoint
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Implement exponential backoff for retries
const retryFetch = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            // If response is not OK, throw an error to trigger retry (unless last attempt)
            if (i < retries - 1) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.log(`Request failed (Status ${response.status}). Retrying in ${delay.toFixed(0)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error(`Final request failed with status ${response.status}: ${await response.text()}`);
            }
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            console.log(`Retrying in ${delay.toFixed(0)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

exports.handler = async (event) => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // 1. Basic security check for the API key
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Error: GEMINI_API_KEY not configured in Netlify environment variables." }),
        };
    }

    // 2. Parse the request body (prompt from the client)
    let userPrompt;
    try {
        const body = JSON.parse(event.body);
        userPrompt = body.userPrompt;
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    if (!userPrompt) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing 'userPrompt' in request." }) };
    }

    const apiUrl = `${BASE_URL}${MODEL_NAME}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        // Enable Google Search to ground the knowledge hub responses
        tools: [{ "google_search": {} }],
        systemInstruction: {
            parts: [{ text: "You are a professional research assistant and knowledge curator. Summarize the requested topic clearly, concisely, and based only on verifiable information. Use clean, clear markdown for formatting. Do not include any introductory phrases like 'Here is the summary' or 'I found the following information'." }]
        },
    };

    try {
        // 3. Make the secure API call using retry logic
        const response = await retryFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // 4. Return the result back to the client
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error("Gemini API Proxy Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to communicate with the AI service: ${error.message}` }),
        };
    }
};

