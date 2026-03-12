/**
 * Visual Detector
 * 
 * Handles computer vision tasks for the agent.
 * Currently wraps Cloud Vision APIs (via AIService) but designed to support local models (YOLO/TFJS) in future.
 */

import { AIService, AIProvider, ChatMessage } from '../AIService';

export class VisualDetector {
    constructor(private aiService: AIService) {}

    /**
     * Locate an element's coordinates from a screenshot
     */
    async locateElement(
        description: string,
        screenshotBase64: string,
        provider: AIProvider,
        apiKey: string,
        model?: string,
        hintText: string = ''
    ): Promise<{ x: number; y: number; confidence: number; reasoning: string } | null> {
        console.log('[VisualDetector] Attempting to locate element visually...');

        const system = `You are an automated GUI agent. 
Your goal is to find the exact screen coordinates (x, y) of a specific UI element based on a screenshot.
Return JSON with coordinates.`;

        const prompt = `I need to find the center coordinates of the element described as: "${description}".
${hintText ? `Additional Hint: ${hintText}` : ''}

Look at the screenshot carefully. Find the visual center of this element.

Return strictly JSON:
{
  "found": true,
  "x": 123,
  "y": 456,
  "confidence": 0.9,
  "reasoning": "I see a blue button top-right saying 'Apply'"
}
If NOT found, set "found": false.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: system },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: screenshotBase64 } }
                ]
            }
        ];

        try {
            // Use AIService which handles provider specifics
            const response = await this.aiService.chatCompletion(provider, apiKey, messages, model);
            
            // Robust JSON extraction
            let cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }

            const result = JSON.parse(cleanJson);

            if (result.found && typeof result.x === 'number' && typeof result.y === 'number') {
                return {
                    x: result.x,
                    y: result.y,
                    confidence: result.confidence || 1.0,
                    reasoning: result.reasoning || 'Found via visual analysis'
                };
            }
        } catch (e) {
            console.error('[VisualDetector] Vision analysis failed:', e);
        }

        return null;
    }
}
