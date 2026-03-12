export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'github' | 'huggingface' | 'grok' | 'kimi';

export interface AIModel {
    id: string;
    name: string;
    provider: AIProvider;
    description?: string;
    contextWindow?: number;
    capabilities: {
        vision: boolean;
        tools: boolean; // Function calling support
        jsonMode: boolean; // JSON output mode support
        reasoning?: boolean; // Chain of thought / reasoning support (e.g. o1, R1)
    };
    isDefault?: boolean;
    isDeprecated?: boolean;
}

export const MODEL_REGISTRY: AIModel[] = [
    // --- OpenAI ---
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: 'Flagship model. High intelligence, vision, and speed.',
        capabilities: { vision: true, tools: true, jsonMode: true },
        isDefault: true
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        description: 'Previous flagship. Good for long context.',
        capabilities: { vision: true, tools: true, jsonMode: true }
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        description: 'Reasoning model. Best for complex logic and math.',
        capabilities: { vision: false, tools: false, jsonMode: false, reasoning: true }
    },

    // --- Google Gemini ---
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        description: 'Mid-sized multimodal model. Excellent performance.',
        capabilities: { vision: true, tools: true, jsonMode: true },
        isDefault: true
    },
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        description: 'Fast and cost-effective. Good for high volume.',
        capabilities: { vision: true, tools: true, jsonMode: true }
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Exp)',
        provider: 'gemini',
        description: 'Experimental fast model. Next-gen capabilities.',
        capabilities: { vision: true, tools: true, jsonMode: true }
    },

    // --- Anthropic Claude ---
    {
        id: 'claude-3-5-sonnet-20240620',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        description: 'Best balance of intelligence and speed. Coding specialist.',
        capabilities: { vision: true, tools: true, jsonMode: true },
        isDefault: true
    },
    {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        description: 'Most powerful Claude model. Slower but deeper reasoning.',
        capabilities: { vision: true, tools: true, jsonMode: true }
    },

    // --- GitHub Models (Azure/OpenAI/Others) ---
    {
        id: 'gpt-4o',
        name: 'GPT-4o (GitHub)',
        provider: 'github',
        capabilities: { vision: true, tools: true, jsonMode: true },
        isDefault: true
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini (GitHub)',
        provider: 'github',
        capabilities: { vision: true, tools: true, jsonMode: true }
    },
    {
        id: 'Phi-4',
        name: 'Phi-4',
        provider: 'github',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'DeepSeek-R1',
        name: 'DeepSeek R1',
        provider: 'github',
        capabilities: { vision: false, tools: false, jsonMode: false, reasoning: true }
    },
    {
        id: 'Llama-3.3-70B-Instruct',
        name: 'Llama 3.3 70B',
        provider: 'github',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },

    // --- Hugging Face (Serverless Inference API) ---
    // These models are supported on the HF Inference API
    {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        name: 'Llama 3.3 70B',
        provider: 'huggingface',
        description: 'Latest Llama model. High intelligence and reasoning.',
        capabilities: { vision: false, tools: true, jsonMode: true },
        isDefault: true
    },
    {
        id: 'meta-llama/Llama-3.1-70B-Instruct',
        name: 'Llama 3.1 70B',
        provider: 'huggingface',
        description: 'Powerful open model with long context.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'meta-llama/Llama-3.1-8B-Instruct',
        name: 'Llama 3.1 8B',
        provider: 'huggingface',
        description: 'Fast and efficient. Good for general tasks.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'meta-llama/Llama-3.2-3B-Instruct',
        name: 'Llama 3.2 3B',
        provider: 'huggingface',
        description: 'Compact model. Fast inference.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'meta-llama/Llama-3.2-11B-Vision-Instruct',
        name: 'Llama 3.2 11B Vision',
        provider: 'huggingface',
        description: 'Multimodal Llama with vision capabilities.',
        capabilities: { vision: true, tools: false, jsonMode: false }
    },
    {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B',
        provider: 'huggingface',
        description: 'Highly capable open model. Comparable to GPT-4.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'Qwen/Qwen2.5-32B-Instruct',
        name: 'Qwen 2.5 32B',
        provider: 'huggingface',
        description: 'Strong performance with faster inference.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        name: 'Qwen 2.5 Coder 32B',
        provider: 'huggingface',
        description: 'Specialized for coding tasks.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'Qwen/QwQ-32B',
        name: 'QwQ 32B',
        provider: 'huggingface',
        description: 'Reasoning model from Qwen team.',
        capabilities: { vision: false, tools: false, jsonMode: false, reasoning: true }
    },
    {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek R1',
        provider: 'huggingface',
        description: 'Advanced reasoning model. Chain-of-thought.',
        capabilities: { vision: false, tools: false, jsonMode: false, reasoning: true }
    },
    {
        id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
        name: 'DeepSeek R1 Distill 70B',
        provider: 'huggingface',
        description: 'Distilled reasoning model. Faster inference.',
        capabilities: { vision: false, tools: false, jsonMode: false, reasoning: true }
    },
    {
        id: 'deepseek-ai/DeepSeek-V3',
        name: 'DeepSeek V3',
        provider: 'huggingface',
        description: 'Powerful general-purpose model.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'mistralai/Mistral-7B-Instruct-v0.3',
        name: 'Mistral 7B v0.3',
        provider: 'huggingface',
        description: 'Efficient and fast. Great for quick tasks.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        provider: 'huggingface',
        description: 'Mixture of experts model. High quality.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'mistralai/Mistral-Small-24B-Instruct-2501',
        name: 'Mistral Small 24B',
        provider: 'huggingface',
        description: 'Latest small Mistral model.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'google/gemma-2-27b-it',
        name: 'Gemma 2 27B',
        provider: 'huggingface',
        description: 'Google open model. Strong performance.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'google/gemma-2-9b-it',
        name: 'Gemma 2 9B',
        provider: 'huggingface',
        description: 'Compact Gemma model.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'microsoft/Phi-4',
        name: 'Phi-4',
        provider: 'huggingface',
        description: 'Microsoft small language model. Highly efficient.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'microsoft/Phi-3.5-mini-instruct',
        name: 'Phi 3.5 Mini',
        provider: 'huggingface',
        description: 'Compact and fast.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },
    {
        id: 'NousResearch/Hermes-3-Llama-3.1-8B',
        name: 'Hermes 3 8B',
        provider: 'huggingface',
        description: 'Fine-tuned Llama for instruction following.',
        capabilities: { vision: false, tools: true, jsonMode: true }
    },
    {
        id: 'mistralai/Pixtral-12B-2409',
        name: 'Pixtral 12B',
        provider: 'huggingface',
        description: 'Mistral multimodal model with vision.',
        capabilities: { vision: true, tools: false, jsonMode: false }
    },
    {
        id: 'HuggingFaceH4/zephyr-7b-beta',
        name: 'Zephyr 7B',
        provider: 'huggingface',
        description: 'Fine-tuned Mistral. Fast and helpful.',
        capabilities: { vision: false, tools: false, jsonMode: false }
    },

    // --- xAI Grok ---
    {
        id: 'grok-beta',
        name: 'Grok Beta',
        provider: 'grok',
        capabilities: { vision: false, tools: false, jsonMode: false },
        isDefault: true
    },
    {
        id: 'grok-vision-beta',
        name: 'Grok Vision Beta',
        provider: 'grok',
        capabilities: { vision: true, tools: false, jsonMode: false }
    },

    // --- Moonshot (Kimi) ---
    {
        id: 'moonshot-v1-8k',
        name: 'Moonshot v1 8k',
        provider: 'kimi',
        capabilities: { vision: false, tools: true, jsonMode: false },
        isDefault: true
    },
    {
        id: 'moonshot-v1-32k',
        name: 'Moonshot v1 32k',
        provider: 'kimi',
        capabilities: { vision: false, tools: true, jsonMode: false }
    }
];

export function getModelsForProvider(provider: AIProvider): AIModel[] {
    return MODEL_REGISTRY.filter(m => m.provider === provider);
}

export function getModelById(id: string): AIModel | undefined {
    return MODEL_REGISTRY.find(m => m.id === id);
}

export function getDefaultModel(provider: AIProvider): AIModel | undefined {
    return MODEL_REGISTRY.find(m => m.provider === provider && m.isDefault) || getModelsForProvider(provider)[0];
}
