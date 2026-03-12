
import { getDefaultModel } from './ModelRegistry';

export type ChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | ChatContentPart[];
}

export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'github' | 'huggingface' | 'grok' | 'kimi';

interface CircuitState {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
    cooldownMs?: number;  // Dynamic cooldown from API rate limit response
}

export class AIService {
    private circuitBreakers: Map<string, CircuitState> = new Map();
    /** Track rate limit reset times per provider to avoid wasteful retries */
    private rateLimitResetAt: Map<string, number> = new Map();

    constructor() { }

    async chatCompletion(provider: AIProvider, apiKey: string, messages: ChatMessage[], model?: string): Promise<string> {
        // Check rate limit cooldown first
        const resetAt = this.rateLimitResetAt.get(provider) || 0;
        if (Date.now() < resetAt) {
            const waitSecs = Math.ceil((resetAt - Date.now()) / 1000);
            throw new Error(`Rate limited for ${provider}. Retry in ${waitSecs}s. Daily limit likely exhausted.`);
        }

        // Check Circuit Breaker
        const circuit = this.getCircuit(provider);
        if (circuit.isOpen) {
            const cooldown = circuit.cooldownMs || 30000;
            if (Date.now() - circuit.lastFailure > cooldown) {
                // Half-open / Retry
                circuit.isOpen = false;
            } else {
                const waitSecs = Math.ceil((cooldown - (Date.now() - circuit.lastFailure)) / 1000);
                throw new Error(`Circuit Breaker Open for ${provider}. Wait ${waitSecs}s.`);
            }
        }

        try {
            const result = await this.retryWithBackoff(async () => {
                // Use registry default if model not provided
                const targetModel = model || getDefaultModel(provider)?.id;

                if (!targetModel) {
                    throw new Error(`No model configured for provider: ${provider}`);
                }

                switch (provider) {
                    case 'openai':
                        return this.callOpenAI(apiKey, messages, targetModel);
                    case 'gemini':
                        return this.callGemini(apiKey, messages, targetModel);
                    case 'anthropic':
                        return this.callAnthropic(apiKey, messages, targetModel);
                    case 'github':
                        return this.callGitHub(apiKey, messages, targetModel);
                    case 'huggingface':
                        return this.callHuggingFace(apiKey, messages, targetModel);
                    case 'grok':
                        return this.callGrok(apiKey, messages, targetModel);
                    case 'kimi':
                        return this.callKimi(apiKey, messages, targetModel);
                    default:
                        throw new Error(`Unknown provider: ${provider}`);
                }
            }, provider);

            // Success - reset failures
            circuit.failures = 0;
            return result;

        } catch (error: any) {
            // Failure - trip circuit if needed
            circuit.failures++;
            circuit.lastFailure = Date.now();

            // Parse rate limit wait time from error message
            const waitMatch = error.message?.match(/wait (\d+) seconds/i);
            if (waitMatch) {
                const waitSecs = parseInt(waitMatch[1], 10);
                this.rateLimitResetAt.set(provider, Date.now() + waitSecs * 1000);
                circuit.cooldownMs = waitSecs * 1000;
                circuit.isOpen = true;
                console.warn(`[AIService] Rate limited for ${provider}. Circuit open for ${waitSecs}s.`);
            } else if (circuit.failures >= 3) {
                circuit.isOpen = true;
                circuit.cooldownMs = 60000; // 1 minute default
                console.warn(`[AIService] Circuit Breaker Tripped for ${provider}`);
            }
            throw error;
        }
    }

    private getCircuit(provider: string): CircuitState {
        if (!this.circuitBreakers.has(provider)) {
            this.circuitBreakers.set(provider, { failures: 0, lastFailure: 0, isOpen: false });
        }
        return this.circuitBreakers.get(provider)!;
    }

    private async retryWithBackoff<T>(fn: () => Promise<T>, _provider: string = '', maxAttempts = 3, initialDelay = 1000): Promise<T> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                const msg = error.message || '';
                const isRateLimit = msg.includes('429');
                const isDailyLimit = msg.includes('86400') || msg.includes('per day') || msg.includes('UserByModelByDay');
                const isPayloadTooLarge = msg.includes('413') || msg.includes('too large');
                const isServerErr = msg.includes('500') || msg.includes('503') || msg.includes('502');
                const isNetworkErr = msg.includes('fetch failed') || msg.includes('network');

                // Never retry daily rate limits or payload size errors
                if (isDailyLimit || isPayloadTooLarge) {
                    console.warn(`[AIService] Non-retryable error: ${msg.substring(0, 100)}`);
                    throw error;
                }

                if (!isRateLimit && !isServerErr && !isNetworkErr) {
                    throw error; // Fail fast on auth/bad request
                }

                if (attempt === maxAttempts) {
                    throw error;
                }

                // For rate limits, parse the server-specified wait time and respect it
                let delay = initialDelay * Math.pow(2, attempt - 1);
                if (isRateLimit) {
                    const retryAfterMatch = msg.match(/\[retry-after:(\d+)\]/);
                    const waitSecondsMatch = msg.match(/wait (\d+) seconds/i) || msg.match(/Please wait (\d+)/i);
                    if (retryAfterMatch) {
                        delay = Math.max(delay, parseInt(retryAfterMatch[1], 10) * 1000);
                    } else if (waitSecondsMatch) {
                        delay = Math.max(delay, parseInt(waitSecondsMatch[1], 10) * 1000);
                    } else {
                        // Default rate limit wait: 30 seconds
                        delay = Math.max(delay, 30000);
                    }
                    // Cap at 90 seconds to avoid indefinite waits
                    delay = Math.min(delay, 90000);
                }

                console.warn(`[AIService] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${Math.round(delay / 1000)}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }

        throw new Error('retryWithBackoff exhausted without returning');
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

    private async callGemini(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Convert messages to Gemini format
        // System prompt is separate
        const systemMessage = messages.find(m => m.role === 'system');
        const contents = messages.filter(m => m.role !== 'system').map(m => {
            const role = m.role === 'assistant' ? 'model' : 'user';
            const parts = Array.isArray(m.content) ? m.content.map(p => {
                if (p.type === 'image_url') {
                    // Gemini expects inline data or file uri. For now assume base64 data url.
                    // data:image/png;base64,.....
                    const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        return { inlineData: { mimeType: match[1], data: match[2] } };
                    }
                    return { text: '[Image]' };
                }
                return { text: p.text };
            }) : [{ text: m.content }];
            return { role, parts };
        });

        // Add system instruction if present (Gemini 1.5+)
        // Note: fetch body structure needs to change slightly for system_instruction
        // But for v1beta simple calls, it's often easier to prepend system prompt to first user message
        if (systemMessage) {
            if (contents.length > 0) {
                const firstPart = contents[0].parts[0];
                if ('text' in firstPart) {
                    firstPart.text = `System Instruction: ${typeof systemMessage.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage.content)}\n\n${firstPart.text}`;
                }
            }
        }

        // --- MODEL SELECTION & FALLBACK ---
        // If the user requested a specific model, try ONLY that one first.
        // If it fails with 404, we might try fallbacks.
        // If it fails with 429, we stop.
        
        let candidates = [model];
        
        // If the requested model is generic or likely to fail (based on recent 404s), add fallbacks
        const knownModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        if (!knownModels.includes(model)) {
            candidates = [...candidates, ...knownModels];
        } else {
             // Even if valid, add others as fallback for 429? No, 429 usually affects the key/project, not just the model.
             // But 503 (Overloaded) might be model specific.
             candidates = [model, ...knownModels.filter(m => m !== model)];
        }
        
        // Deduplicate
        candidates = [...new Set(candidates)];

        let firstError: Error | null = null;

        for (const candidateModel of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
                // console.log(`[AIService] Trying Gemini Model: ${candidateModel}`);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    
                    // CRITICAL: Handle Quota/Rate Limits immediately
                    if (response.status === 429) {
                        throw new Error(`Gemini API Error (429): Quota exceeded. ${errorData.error?.message || ''}`);
                    }

                    // If it's a 404 (Not Found) or 400 (Bad Request - likely model related), continue to next candidate
                    if (response.status === 404 || response.status === 400) {
                        console.warn(`[AIService] Model ${candidateModel} failed: ${response.status} ${response.statusText}`);
                        if (!firstError) {
                            firstError = new Error(`Model ${candidateModel} failed: ${errorData.error?.message || response.statusText}`);
                        }
                        continue; // Try next model
                    }
                    
                    // For other errors (500, 401, 403), throw immediately
                    throw new Error(`Gemini API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    // Check for safety block
                    if (data.promptFeedback?.blockReason) {
                        throw new Error(`Gemini blocked response: ${data.promptFeedback.blockReason}`);
                    }
                    throw new Error('Unexpected response format from Gemini API');
                }

                return data.candidates[0].content.parts[0].text;

            } catch (error: any) {
                // If it's a fatal API error (429, 401, etc), rethrow immediately to stop the loop
                if (error.message.includes('Gemini API Error')) {
                    throw error;
                }
                
                // Only capture first error if it wasn't captured above
                if (!firstError) firstError = error;
                
                // Continue to next candidate
            }
        }

        if (firstError) {
            // console.error('[AIService] All models failed.');
            throw firstError;
        }

        throw new Error('All Gemini model candidates failed.');
    }

    /*
    private async listAvailableModels(apiKey: string): Promise<void> {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                console.error('[AIService] Failed to list models:', data);
                return;
            }

            console.log('[AIService] Available Models:', JSON.stringify(data.models?.map((m: any) => m.name) || [], null, 2));
        } catch (err) {
            console.error('[AIService] Error listing models:', err);
        }
    }
    */

    private async callAnthropic(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Anthropic requires top-level system parameter, not in messages list
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
            // Anthropic handles content arrays natively for user messages
            return {
                role: m.role,
                content: m.content
            };
        });

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
                system: typeof systemMessage?.content === 'string' ? systemMessage.content : '',
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

    private async callGitHub(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // GitHub Models uses OpenAI-compatible endpoint hosted on Azure
        // Ensure content is passed correctly (structure matches OpenAI)
        const chatMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const endpoint = "https://models.inference.ai.azure.com/chat/completions";

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: chatMessages,
                temperature: 0.7,
                max_tokens: 4096,
                top_p: 1.0
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            // Capture Retry-After header for rate limit responses
            const retryAfter = response.headers.get('retry-after') || response.headers.get('Retry-After');
            let errorMsg = `GitHub Models Error (${response.status}): ${error.error?.message || response.statusText}`;
            if (response.status === 429 && retryAfter) {
                errorMsg += ` [retry-after:${retryAfter}]`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
    private async callGrok(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // xAI Grok (OpenAI Compatible)
        const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: chatMessages, temperature: 0.7 })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Grok Error: ${error.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callKimi(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Moonshot AI Kimi (OpenAI Compatible)
        const chatMessages = messages.map(m => ({ role: m.role, content: m.content }));
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: chatMessages, temperature: 0.7 })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Kimi Error: ${error.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callHuggingFace(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Hugging Face Inference API - Using OpenAI-compatible endpoint
        // New router endpoint: https://router.huggingface.co/v1/chat/completions
        // This replaces the deprecated api-inference.huggingface.co

        console.log(`[AIService] Calling Hugging Face: ${model}`);

        // Format messages for OpenAI-compatible API
        // IMPORTANT: Most HF models don't support multimodal (images), so we extract text only
        const chatMessages = messages.map(m => {
            let content: string;
            if (Array.isArray(m.content)) {
                // Extract only text parts from multimodal content
                content = m.content
                    .filter(part => part.type === 'text')
                    .map(part => (part as { type: 'text'; text: string }).text)
                    .join('\n');
            } else {
                content = m.content;
            }
            return {
                role: m.role,
                content
            };
        });

        // Try the OpenAI-compatible chat completions endpoint first
        const url = 'https://router.huggingface.co/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: chatMessages,
                max_tokens: 1024,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.warn(`[AIService] HF Chat Completion failed (${response.status}):`, error);

            // Fallback: If the chat completions endpoint fails, try the text generation endpoint
            if (response.status === 404 || response.status === 400 || response.status === 422) {
                return this.callHuggingFaceFallback(apiKey, messages, model);
            }
            throw new Error(`Hugging Face Error: ${error.error?.message || error.error || response.statusText}`);
        }

        const data = await response.json();
        // OpenAI-compatible response format
        return data.choices?.[0]?.message?.content || JSON.stringify(data);
    }

    private formatMessagesForHF(messages: ChatMessage[]): string {
        // Format messages for Hugging Face text generation API (fallback)
        return messages.map(m => {
            if (m.role === 'system') {
                return `System: ${m.content}`;
            } else if (m.role === 'user') {
                return `User: ${m.content}`;
            } else if (m.role === 'assistant') {
                return `Assistant: ${m.content}`;
            }
            return `${m.role}: ${m.content}`;
        }).join('\n') + '\nAssistant:';
    }

    private async callHuggingFaceFallback(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
        // Fallback for models that don't support OpenAI-compatible API
        // Uses the text generation inference endpoint
        const prompt = this.formatMessagesForHF(messages);

        console.log(`[AIService] Calling Hugging Face Fallback (Text Gen): ${model}`);

        // Try the hf-inference text generation endpoint
        const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 1024, return_full_text: false }
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error(`[AIService] HF Fallback failed:`, error);
            throw new Error(`Hugging Face Error: ${error.error?.message || error.error || response.statusText}`);
        }

        const data = await response.json();
        // Text Gen returns array [{ generated_text: "..." }]
        return Array.isArray(data) ? data[0].generated_text : (data.generated_text || JSON.stringify(data));
    }
}
