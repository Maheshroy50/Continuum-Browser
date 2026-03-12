# AI Models Inventory

Continuum supports a wide range of AI models across multiple providers. This document lists the supported models, their capabilities, and configuration.

> **Note**: This list is synchronized with `electron/ModelRegistry.ts`.

## Supported Providers & Models

### OpenAI
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **GPT-4o** | `gpt-4o` | Vision, Tools, JSON | Flagship model. High intelligence, vision, and speed. (Default) |
| **GPT-4 Turbo** | `gpt-4-turbo` | Vision, Tools, JSON | Previous flagship. Good for long context. |
| **o1 Preview** | `o1-preview` | Reasoning | Reasoning model. Best for complex logic and math. |

### Google Gemini
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **Gemini 1.5 Pro** | `gemini-1.5-pro` | Vision, Tools, JSON | Mid-sized multimodal model. Excellent performance. (Default) |
| **Gemini 1.5 Flash** | `gemini-1.5-flash` | Vision, Tools, JSON | Fast and cost-effective. Good for high volume. |
| **Gemini 2.0 Flash (Exp)** | `gemini-2.0-flash-exp` | Vision, Tools, JSON | Experimental fast model. Next-gen capabilities. |

### Anthropic Claude
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **Claude 3.5 Sonnet** | `claude-3-5-sonnet-20240620` | Vision, Tools, JSON | Best balance of intelligence and speed. Coding specialist. (Default) |
| **Claude 3 Opus** | `claude-3-opus-20240229` | Vision, Tools, JSON | Most powerful Claude model. Slower but deeper reasoning. |

### GitHub Models (Azure)
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **GPT-4o** | `gpt-4o` | Vision, Tools, JSON | (Default) |
| **GPT-4o Mini** | `gpt-4o-mini` | Vision, Tools, JSON | |
| **Phi-4** | `Phi-4` | Text Only | Microsoft's small language model. |
| **DeepSeek R1** | `DeepSeek-R1` | Reasoning | DeepSeek's reasoning model. |
| **Llama 3.3 70B** | `Llama-3.3-70B-Instruct` | Tools, JSON | Meta's open weights model. |

### Hugging Face (Inference API)
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **Llama 3 8B** | `meta-llama/Meta-Llama-3-8B-Instruct` | Text Only | Fast, open-weight model. Good for general tasks. (Default) |
| **Qwen 2.5 72B** | `Qwen/Qwen2.5-72B-Instruct` | Text Only | Highly capable open model. Comparable to GPT-4. |
| **DeepSeek R1 Distill** | `deepseek-ai/DeepSeek-R1-Distill-Llama-70B` | Reasoning | Reasoning model distilled from DeepSeek R1. |
| **Mistral 7B v0.3** | `mistralai/Mistral-7B-Instruct-v0.3` | Text Only | |
| **Phi-3 Mini** | `microsoft/Phi-3-mini-4k-instruct` | Text Only | |

### xAI Grok
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **Grok Beta** | `grok-beta` | Text Only | (Default) |
| **Grok Vision Beta** | `grok-vision-beta` | Vision | |

### Moonshot (Kimi)
| Model | ID | Capabilities | Description |
|-------|----|--------------|-------------|
| **Moonshot v1 8k** | `moonshot-v1-8k` | Tools | (Default) |
| **Moonshot v1 32k** | `moonshot-v1-32k` | Tools | |

## Capabilities Key

- **Vision**: Can analyze images (screenshots, uploaded files).
- **Tools**: Supports Function Calling (Agent actions).
- **JSON**: Supports Structured Output (JSON mode).
- **Reasoning**: Uses Chain-of-Thought or similar reasoning techniques (e.g. o1, R1).

## Configuration

Models are selected in the **AI Panel**.
- **Auto (Default)**: Uses the recommended model for the provider (marked above).
- **Custom**: Allows entering any model ID supported by the provider's API.

## Developer Notes

To add a new model:
1. Edit `electron/ModelRegistry.ts`.
2. Add the model definition to the `MODEL_REGISTRY` array.
3. The UI will automatically update to reflect the change.
