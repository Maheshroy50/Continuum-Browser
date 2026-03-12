import { AIService, AIProvider } from '../AIService';


export interface PageContextAnalysis {
    pageType: 'job_listing' | 'application_form' | 'search_results' | 'login' | 'dashboard' | 'article' | 'other';
    platform: string; // e.g. 'linkedin', 'indeed', 'github'
    topic: string; // Brief 1-sentence summary
    state: 'logged_in' | 'logged_out' | 'error' | 'unknown' | 'ready_to_apply' | 'applied';
    suggestedMode?: 'apply' | 'browse' | 'login' | 'read';
}

export class ContextAnalyzer {
    constructor(private aiService: AIService) { }

    /**
     * Analyze a page to determine its context/type
     */
    async analyze(
        url: string,
        title: string,
        screenshot: string | null,
        textContent: string,
        provider: AIProvider,
        apiKey: string,
        model?: string
    ): Promise<PageContextAnalysis> {

        console.log('[ContextAnalyzer] Analyzing page context...');

        const systemPrompt = `You are a specialist web crawler agent. 
Your job is to categorize the current webpage so the main control agent knows how to behave.
Is it a Job Listing? A Login Page? Search Results?`;

        const userPrompt = `Analyze this page info:
URL: ${url}
Title: ${title}
Content Snippet: "${textContent.slice(0, 500)}..."

Determine:
1. What type of page is this?
2. What platform is it likely on?
3. What is the state (e.g. is user logged in?)?
4. What is the topic?

Return strictly JSON:
{
  "pageType": "job_listing" | "application_form" | "search_results" | "login",
  "platform": "string",
  "topic": "string",
  "state": "logged_in" | "logged_out" | "ready_to_apply",
  "suggestedMode": "apply"
}`;

        // For non-vision providers (like most Hugging Face models), use text-only
        const supportsVision = provider === 'openai' || provider === 'anthropic' || provider === 'gemini' || provider === 'github';

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: (screenshot && supportsVision)
                    ? [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: screenshot } }
                    ]
                    : userPrompt
            }
        ];

        try {
            // Use the provided model, or let the service pick the default for the provider
            const response = await this.aiService.chatCompletion(provider, apiKey, messages as any, model);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(cleanJson);

            console.log('[ContextAnalyzer] Analysis:', analysis);
            return analysis;
        } catch (error) {
            console.error('[ContextAnalyzer] Output parsing failed', error);
            // Fallback
            return {
                pageType: 'other',
                platform: 'unknown',
                topic: title,
                state: 'unknown'
            };
        }
    }
}
