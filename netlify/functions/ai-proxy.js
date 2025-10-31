// netlify/functions/ai-proxy.js

// This function acts as a secure middleman between your frontend and the AI service.

exports.handler = async (event) => {
    // 1. Get the secret key from the secure environment variables
    const apiKey = process.env.GEMINI_API_KEY;

    // 2. Safely parse the request body from the frontend
    const { userPrompt } = JSON.parse(event.body);

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server error: API key not configured." }),
        };
    }

    try {
        // 3. Make the secure API call from the serverless function environment
        const apiResponse = await fetch('YOUR_AI_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Use the secret API key securely here
                'Authorization': `Bearer ${apiKey}`, 
            },
            body: JSON.stringify({ prompt: userPrompt }), // Example payload
        });

        const data = await apiResponse.json();

        // 4. Return the result back to your client-side application
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error("AI API Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to communicate with the AI service.' }),
        };
    }
};


### C. Update the Frontend Code (The Call)
Instead of calling the AI service's public endpoint directly from your browser, update your frontend to call the Netlify Function's endpoint:

| Old (Insecure) | New (Secure) |
| :--- | :--- |
| `fetch('https://api.ai-service.com/generate', ...)` | `fetch('/.netlify/functions/ai-proxy', ...)` |

By calling `/ .netlify/functions/ai-proxy`, Netlify automatically routes the request to the secure Node.js function you created, which uses the hidden API key.

---

## 3. Optimizing for Responsiveness and Performance

Netlify's global **Content Delivery Network (CDN)** inherently provides excellent responsiveness and functionality by serving your static assets from the server closest to the user.

* **Serverless Latency:** Since the Netlify Function still involves a network hop (browser -> Netlify Function -> AI API -> Netlify Function -> browser), keep the logic inside `ai-proxy.js` minimal to **reduce overhead and ensure responsiveness.**
* **Asset Optimization:** Make sure your build process uses minification and bundling for your JavaScript, CSS, and HTML. Tools like Webpack or Vite usually handle this automatically.
* **Image Optimization:** For better load times, use Netlify's **Large Media** feature or services like Cloudinary if your app includes many large images.

This architecture ensures the **AI Brain feature** is **secure** (key hidden) and **responsive** (using Netlify's fast CDN and serverless functions).

Let me know if you'd like to dive deeper into the code for the `ai-proxy.js` file or need help adjusting your frontend fetch call!
