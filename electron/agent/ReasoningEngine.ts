import { AIService, AIProvider, ChatMessage } from '../AIService';
import { Subtask, FailureAnalysis } from './types';

export interface ReasoningResult {
    thoughtTrace: string;
    critique: string;
    nextAction: string; // JSON string of the action
    confidence: number;
}

export class ReasoningEngine {
    constructor(private aiService: AIService) { }

    /**
     * Perform Chain-of-Thought reasoning to determine the next best action.
     */
    async think(
        goal: string,
        context: string,
        history: string[],
        provider: AIProvider,
        apiKey: string,
        model?: string
    ): Promise<ReasoningResult> {
        const systemPrompt = `You are a sophisticated AI Reasoning Engine.
Your goal is to solve complex web automation tasks by THINKING STEP-BY-STEP.

PROCESS:
1. ANALYZE the Goal and Current Context.
2. RECALL past steps (History) to avoid loops.
3. FORMULATE a plan (Chain of Thought).
4. CRITIQUE the plan (Look for potential failures).
5. DECIDE on the single best next action.

CRITICAL INSTRUCTION FOR CLARIFICATION:
If you need to ask the user a question to clarify their intent (e.g., "What is the purpose of the email?", "Who is the recipient?"), you MUST use "synthesize_final_answer" with your question in the "answer" field. 
DO NOT use "fill_form" to ask questions. The user is NOT a form on the webpage.
DO NOT use "summarize" to ask questions.

HINTS:
- "Draft email" -> First step is usually "Click Compose".
- "Compose" button might be an icon or a div with role="button", look for "Compose" text.
- Gmail Compose button is usually a div[role="button"] with text "Compose" near the top-left.
- After clicking Compose, wait for the compose dialog to appear before filling fields.
- Gmail fields: To field has aria-label="To", Subject has name="subjectbox", Body is div[role="textbox"][contenteditable].
- If you can't find an element by CSS selector, try using its visible text or aria-label as the selectorHint.
- If a form doesn't have a submit button, try "press_key" with "Enter" after filling fields.
- After clicking a button that opens a dialog/popup, use "read_page" to re-read the page before interacting.
- For contenteditable divs (like email body), use fill_form with the aria-label or role as the selectorHint.
- NEVER try to click an element and fill a form in the same step. Click first, then fill.
- When filling email body, use selectorHint: 'div[role="textbox"][contenteditable="true"]' or aria-label.
- CRITICAL JSON RULE: If your string values (like email body) contain newlines, you MUST escape them as \\n in the JSON string. Do NOT use unescaped literal newlines inside the JSON strings.
- IMPORTANT: Google Search box is a <textarea>, NOT an <input>. Use selectorHint: 'textarea[name="q"]' (not input[name="q"]).
- **CRITICAL NAVIGATION RULE**: When the user asks to "go to" or "open" a specific website (e.g. "go to amazon.com", "open youtube.com", "navigate to reddit.com"), you MUST use the "navigate" action with the direct URL. NEVER search for a website on Google when the user explicitly names a domain.
  Examples:
  - "go to amazon.com" -> { "type": "navigate", "target": { "description": "https://www.amazon.com" } }
  - "open youtube" -> { "type": "navigate", "target": { "description": "https://www.youtube.com" } }
  - "go to reddit" -> { "type": "navigate", "target": { "description": "https://www.reddit.com" } }
  Only use Google search when the user wants to SEARCH FOR something, not navigate to a known site.
- Common search field selectors: Google='textarea[name="q"]', Bing='input[name="q"]', DuckDuckGo='input[name="q"]'.

OUTPUT FORMAT (JSON ONLY):
{
  "thought_trace": "Step-by-step reasoning...",
  "critique": "Potential risks or alternative approaches...",
  "confidence": 0.0 to 1.0,
  "next_action": {
    "type": "fill_form" | "click_element" | "scroll_to" | "read_page" | "summarize" | "navigate" | "synthesize_final_answer" | "press_key",
    "target": { "description": "what to interact with", "selectorHint": "CSS selector like #id or .class" },
    "parameters": { ... },
    "answer": "..." (only for synthesize_final_answer)
  }
}

IMPORTANT - fill_form FORMAT:
For fill_form, you MUST include a "parameters.fields" array:
{
  "type": "fill_form",
  "target": { "description": "search form", "selectorHint": "#search" },
  "parameters": {
    "fields": [
      { "fieldName": "search query", "selectorHint": "#twotabsearchtextbox", "value": "iPhone 15" }
    ]
  }
}

IMPORTANT - press_key FORMAT:
{
  "type": "press_key",
  "target": { "description": "press Enter" },
  "parameters": { "key": "Enter" }
}

IMPORTANT - synthesize_final_answer:
When you have enough info to answer the user's question, use synthesize_final_answer:
{ "type": "synthesize_final_answer", "target": { "description": "final answer" }, "answer": "The cheapest iPhone 15 is ₹X" }`;

        const userPrompt = `GOAL: ${goal}

CURRENT CONTEXT:
${context}

HISTORY:
${history.join('\n')}

Think deeply and decide the next step.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            // Use the provided model, or let AIService pick the provider default if undefined.
            // DO NOT force 'gpt-4o' here as it breaks other providers (e.g. Anthropic).
            const response = await this.aiService.chatCompletion(provider, apiKey, messages, model);

            // Parse JSON
            let cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();

            // Robust JSON extraction: Find the first { and last }
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanJson);

            // Ensure confidence is included in the next_action object
            // IntentValidator expects confidence INSIDE the action object
            const nextAction = parsed.next_action || {};
            if (typeof nextAction.confidence !== 'number' && typeof parsed.confidence === 'number') {
                nextAction.confidence = parsed.confidence;
            }

            return {
                thoughtTrace: parsed.thought_trace || 'No trace provided',
                critique: parsed.critique || 'No critique provided',
                nextAction: JSON.stringify(nextAction),
                confidence: parsed.confidence || 0.5
            };
        } catch (error: any) {
            console.error('[ReasoningEngine] Failed to parse response:', error);

            // CRITICAL: Rethrow infrastructure errors (Rate Limit, Circuit Breaker)
            // so AgentGateway can pause execution instead of looping.
            if (error.message.includes('Circuit Breaker') || error.message.includes('Rate limited') || error.message.includes('Quota exceeded')) {
                throw error;
            }

            // Fallback for non-JSON models or parsing errors
            return {
                thoughtTrace: 'Failed to parse AI response',
                critique: 'Error recovery mode',
                nextAction: JSON.stringify({
                    type: 'summarize', // Safe fallback
                    target: { description: 'Current page' },
                    confidence: 0.5, // Add confidence for validator
                    answer: 'I encountered an error while reasoning.'
                }),
                confidence: 0.0
            };
        }
    }

    /**
     * Decompose a goal into structured subtasks
     */
    async planDetailedStrategy(
        goal: string,
        provider: AIProvider,
        apiKey: string
    ): Promise<Subtask[]> {
        const systemPrompt = `You are a strategic planning agent.
Break down the user's goal into a logical sequence of subtasks.
Each subtask must have clear success criteria.

RETURN JSON ARRAY:
[
  {
    "id": "1",
    "description": "Navigate to LinkedIn login page",
    "successCriteria": "URL contains 'login'",
    "dependencies": []
  },
  {
    "id": "2",
    "description": "Enter credentials",
    "successCriteria": "Dashboard is visible",
    "dependencies": ["1"]
  }
]`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `GOAL: ${goal}` }
        ];

        try {
            const response = await this.aiService.chatCompletion(provider, apiKey, messages);
            let cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();

            const firstBracket = cleanJson.indexOf('[');
            const lastBracket = cleanJson.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
                const plan = JSON.parse(cleanJson);
                return plan.map((p: any) => ({
                    ...p,
                    status: 'pending'
                }));
            }
        } catch (e) {
            console.error('Planning failed', e);
        }

        return [{
            id: '1',
            description: goal,
            status: 'pending',
            successCriteria: 'Task completed',
            dependencies: []
        }];
    }

    /**
     * Verify if a subtask is complete based on criteria and context
     */
    async verifySubtaskCompletion(
        subtask: Subtask,
        context: string,
        provider: AIProvider,
        apiKey: string
    ): Promise<boolean> {
        const prompt = `
You are verifying if a subtask was completed successfully.
Subtask: "${subtask.description}"
Success Criteria: "${subtask.successCriteria}"
Current Page Context:
${context.slice(0, 2000)}

Has the subtask been successfully completed based on the criteria?
Return strictly JSON: { "completed": true, "reason": "..." } or { "completed": false }`;

        try {
            const response = await this.aiService.chatCompletion(provider, apiKey, [
                { role: 'user', content: prompt }
            ]);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);
            return result.completed === true;
        } catch (e) {
            return false;
        }
    }

    async analyzeFailureStrategy(
        subtask: Subtask,
        lastAction: string,
        error: string,
        context: string,
        provider: AIProvider,
        apiKey: string
    ): Promise<FailureAnalysis> {
        const prompt = `
The Agent failed to complete an action.
Current Subtask: "${subtask.description}"
Last Action: "${lastAction}"
Error: "${error}"
Page Context:
${context.slice(0, 1000)}

Analyze the failure and decide on a recovery strategy.
1. 'retry': The error seems transient or a slight variation might work.
2. 'new_strategy': The current approach is wrong. We need a new plan (provide new subtasks).
3. 'skip_step': This step is optional or blocked, but we can proceed.
4. 'abort': The goal is impossible.

Return strictly JSON:
{
  "decision": "retry" | "new_strategy" | "skip_step" | "abort",
  "reason": "explanation...",
  "correction": "Try clicking the X button instead...",
  "newSubtasks": [ ... ] // Only if decision is 'new_strategy'
}
`;

        try {
            const response = await this.aiService.chatCompletion(provider, apiKey, [
                { role: 'user', content: prompt }
            ]);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            return { decision: 'retry', reason: 'Failed to analyze failure, defaulting to retry.' };
        }
    }
}
