import useStore from '../store/useStore';

function normalizeCliErrorMessage(message) {
    const text = String(message || '');
    const lower = text.toLowerCase();

    if (lower.includes('openai cli is installed but not authenticated')) {
        return text;
    }
    if (lower.includes('api_key client option must be set') || lower.includes('openai_api_key')) {
        return 'OpenAI CLI is installed but not authenticated. Set OPENAI_API_KEY in the environment that starts Vite, then restart the app.';
    }

    return text;
}

export async function generateText({ prompt, systemPrompt, temperature = 0.7 }) {
    const state = useStore.getState();
    const settings = state.settings;

    if (settings.openAiCliEnabled) {
        // Use local CLI Bridge
        try {
            const response = await fetch('/api/openai-cli/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    systemPrompt: systemPrompt || 'You are a helpful assistant.',
                    temperature
                })
            });

            if (!response.ok) {
                let errData = {};
                try {
                    errData = await response.json();
                } catch (e) {
                    throw new Error(`Local CLI returned error status ${response.status}`);
                }
                throw new Error(normalizeCliErrorMessage(errData.error || 'Failed to generate text via OpenAI CLI'));
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI CLI Generation Error:', error);
            throw new Error(normalizeCliErrorMessage(error.message || error));
        }
    } else if (settings.openRouterApiKey) {
        // Use OpenRouter
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.openRouterApiKey}`,
                    'HTTP-Referer': 'http://localhost:5173',
                    'X-Title': 'Vibe Writer',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-pro', // Primary default
                    messages: [
                        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature
                })
            });

            if (!response.ok) {
                let errData = {};
                try {
                    errData = await response.json();
                } catch (e) {
                    throw new Error(`OpenRouter returned error status ${response.status}`);
                }
                throw new Error(errData.error?.message || 'Failed to generate text via OpenRouter');
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenRouter Generation Error:', error);
            throw error;
        }
    } else {
        throw new Error('No AI provider configured. Enable OpenAI CLI mode (with CLI auth configured) or add an OpenRouter API Key in settings.');
    }
}
