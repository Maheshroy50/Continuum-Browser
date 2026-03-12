import { AIService } from '../AIService';
import { UserProfile } from './types';
import * as fs from 'fs';

export class ResumeParser {
    constructor(private aiService: AIService) { }

    /**
     * Parse a resume file and extract structured UserProfile
     */
    async parse(filePath: string, provider: 'openai' | 'anthropic' | 'gemini', apiKey: string): Promise<UserProfile> {
        console.log('[ResumeParser] Reading file:', filePath);

        // TODO: specific PDF parsing logic
        // For now, assume text/markdown or simple reading
        const textContent = fs.readFileSync(filePath, 'utf8');

        // Clean up binary noise if it accidentally read a PDF as text (rudimentary)
        const cleanText = textContent.replace(/[^\x20-\x7E\n\r]/g, '');

        return this.extractFromText(cleanText, provider, apiKey);
    }

    /**
     * Use LLM to extract JSON profile from raw text
     */
    private async extractFromText(text: string, provider: any, apiKey: string): Promise<UserProfile> {
        const systemPrompt = `You are a Resume Parser Agent. 
Your goal is to extract key user details into a structured JSON format.
Extract: Name, Email, Phone, LinkedIn URL, Portfolio URL, and a clean text summary of the resume.`;

        const userPrompt = `Resume Content:
"${text.slice(0, 5000)}"

Extract the following JSON structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1...",
  "linkedInUrl": "https://linkedin.com/in/...",
  "portfolioUrl": "https://...",
  "resumeText": "A cleaned up, keyword-rich summary of the resume skills and experience (max 500 words)."
}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        try {
            const response = await this.aiService.chatCompletion(provider, apiKey, messages as any, 'gpt-4o');

            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const extracted = JSON.parse(cleanJson);

            return {
                name: extracted.name,
                email: extracted.email,
                phone: extracted.phone,
                linkedInUrl: extracted.linkedInUrl,
                portfolioUrl: extracted.portfolioUrl,
                resumeText: extracted.resumeText,
                lastUpdated: Date.now()
            };
        } catch (error) {
            console.error('[ResumeParser] Extraction failed', error);
            throw new Error('Failed to parse resume content');
        }
    }
}
