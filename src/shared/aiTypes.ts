export interface AIProvider {
    id: 'openai' | 'gemini' | 'anthropic';
    name: string;
    models: string[];
}
