

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export class AIService {

    constructor() { }

    async chatCompletion(provider: AIProvider, apiKey: string, messages: ChatMessage[], model?: string): Promise<string> {
        switch (provider) {
            case 'openai':
                return this.callOpenAI(apiKey, messages, model || 'gpt-4o');
            case 'gemini':
                return this.callGemini(apiKey, messages, model || 'gemini-1.5-flash');
            case 'anthropic':
                return this.callAnthropic(apiKey, messages, model || 'claude-3-5-sonnet-20240620');
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    private async callOpenAI(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callGemini(apiKey: string, messages: ChatMessage[], model: string | undefined): Promise<string> {
        // Map messages to Gemini format (user/model roles)
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // List of models to try in order of preference
        // 2026 Update: Gemini 1.5 models may be retired. Using 2.0 and evergreen aliases.
        const candidates = [
            model,
            'gemini-2.0-flash-exp',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash-latest',
            'gemini-pro'
        ].filter((m, i, arr) => m && arr.indexOf(m) === i) as string[];

        let lastError: Error | null = null;

        for (const candidateModel of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
                console.log(`[AIService] Trying Gemini Model: ${candidateModel}`);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    // If it's a 404 (Not Found) or 400 (Bad Request - likely model related), continue to next candidate
                    if (response.status === 404 || response.status === 400) {
                        console.warn(`[AIService] Model ${candidateModel} failed: ${response.status} ${response.statusText}`, errorData);
                        throw new Error(`Model ${candidateModel} not supported: ${errorData.error?.message || response.statusText}`);
                    }
                    // For auth errors (401/403), stop immediately
                    throw new Error(`Gemini API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error('Unexpected response format from Gemini API');
                }

                return data.candidates[0].content.parts[0].text;

            } catch (error: any) {
                lastError = error;
                // Continue to next candidate
            }
        }

        throw lastError || new Error('All Gemini model candidates failed.');
    }

    private async callAnthropic(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Anthropic requires top-level system parameter, not in messages list
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: systemMessage?.content,
                messages: chatMessages
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Anthropic Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }
}
