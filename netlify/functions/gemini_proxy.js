/**
 * Netlify Function: gemini_proxy
 * * This function securely proxies requests from the front-end to the Google Generative Language API.
 * It is required for the Gymini AI Brain to work on the deployed Netlify site.
 * It reads the GEMINI_API_KEY securely from Netlify Environment Variables.
 */

const fetch = require('node-fetch');

// The model we are using for general knowledge questions with grounding
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

exports.handler = async (event) => {
    // 1. Security Check: Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // 2. Environment Variable Check
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }),
        };
    }

    try {
        // 3. Parse the incoming request body to get the user prompt
        const body = JSON.parse(event.body || '{}');
        const prompt = body.prompt;

        if (!prompt) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameter: prompt' }),
            };
        }

        // 4. Construct the API payload for Google Search Grounding
        const apiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            // Enable Google Search grounding tool for up-to-date information
            tools: [{ "google_search": {} }], 
            systemInstruction: {
                parts: [{ text: "You are a world-class fitness and nutrition coach named Gymini. Provide concise, actionable, and evidence-based advice in a friendly, encouraging tone. Respond to the user's question directly." }]
            },
        };

        // 5. API Endpoint URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        let apiResponse = null;
        let attempt = 0;
        const maxRetries = 3;

        // Implement simple retry logic with exponential backoff
        while (attempt < maxRetries) {
            try {
                apiResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                });
                
                if (apiResponse.ok) {
                    break; // Success! Exit the loop.
                }

                // If not OK, prepare for retry
                const errorBody = await apiResponse.json();
                console.warn(`Attempt ${attempt + 1} failed. Status: ${apiResponse.status}. Error: ${JSON.stringify(errorBody)}`);
                
                if (apiResponse.status === 400 || apiResponse.status === 403) {
                     // Non-retriable errors (bad request or forbidden)
                    throw new Error(`API Error: ${apiResponse.statusText}`);
                }

            } catch (error) {
                // Catches network errors or thrown non-retriable errors
                throw error;
            }

            attempt++;
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms, 2000ms...
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        if (!apiResponse || !apiResponse.ok) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to get a successful response from the Gemini API after retries.' }),
            };
        }

        const result = await apiResponse.json();
        const candidate = result.candidates?.[0];

        // 6. Extract the generated text and sources
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];

            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }

            // 7. Return successful response
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, sources }),
            };

        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'The AI model returned an unexpected response structure.' }),
            };
        }
    } catch (error) {
        console.error('Function execution error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error while processing the request.' }),
        };
    }
};


