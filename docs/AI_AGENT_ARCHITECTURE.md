# AI Agent System Architecture Enhancement

## Overview
This document outlines the enhanced architecture of the Continuum AI Agent system. The system has been upgraded to support sophisticated reasoning, robust error handling, and scalable execution.

## 1. System Architecture

### Core Components

1.  **AgentGateway (`AgentGateway.ts`)**
    *   **Role**: Central orchestrator and "Identity & Access Management" (IAM) for the AI.
    *   **Responsibility**:
        *   Receives high-level user goals.
        *   Manages the "Research Loop" (Look -> Think -> Act).
        *   Enforces permissions via `PermissionManager`.
        *   Delegates reasoning to `ReasoningEngine`.
        *   Delegates execution to `ActionExecutor`.

2.  **Reasoning Engine (`ReasoningEngine.ts`)**
    *   **Role**: The "Brain" of the agent.
    *   **Methodology**: Uses **Chain-of-Thought (CoT)** reasoning.
    *   **Process**:
        1.  Analyze Goal & Context.
        2.  Recall History (to avoid loops).
        3.  Formulate Plan (Internal Monologue).
        4.  Critique Plan (Self-Correction).
        5.  Output Structured Action.

3.  **Workflow Engine (`WorkflowEngine.ts`)**
    *   **Role**: Task Queue and Concurrency Manager.
    *   **Capabilities**:
        *   Manages a queue of `WorkflowJob`s.
        *   Supports concurrent execution (configurable `concurrency` level).
        *   Handles job lifecycle (pending -> running -> completed/failed).

4.  **Action Executor (`ActionExecutor.ts`)**
    *   **Role**: The "Hands" of the agent.
    *   **Capabilities**:
        *   Interacts with the DOM (Click, Type, Scroll).
        *   Reads page content (Snapshots).
        *   Captures screenshots (Vision).
    *   **Safety**: Sandboxed execution, no arbitrary JS eval from LLM.

5.  **AI Service (`AIService.ts`)**
    *   **Role**: LLM Interface Layer.
    *   **Robustness**:
        *   **Retry Policy**: Exponential backoff for transient errors.
        *   **Circuit Breaker**: Prevents cascading failures when providers are down.
        *   **Multi-Provider**: Supports OpenAI, Gemini, Anthropic, etc.

## 2. Data Flow

1.  **User Request**: User inputs a goal (e.g., "Find cheap flights to Tokyo").
2.  **Workflow Enqueue**: Request is added to `WorkflowEngine`.
3.  **Job Processing**: `WorkflowEngine` picks up the job and calls `AgentGateway`.
4.  **Context Gathering**: `AgentGateway` captures Page Snapshot + Screenshot.
5.  **Reasoning Loop**:
    *   `ReasoningEngine` analyzes context and history.
    *   Generates a Thought Trace ("I need to find the search form...").
    *   Outputs a JSON Action (`fill_form`).
6.  **Validation**: `IntentValidator` ensures the action is safe and valid.
7.  **Permission Check**: `PermissionManager` verifies if the site allows this action.
8.  **Execution**: `ActionExecutor` performs the action on the WebContents.
9.  **Feedback**: Result (Success/Fail) is fed back into the history for the next Reasoning step.

## 3. Performance & Reliability Benchmarks

*   **Concurrency**: Architecture supports N-way parallelism (limited by hardware/BrowserView instances).
*   **Resilience**:
    *   Network Flakiness: Handled by `AIService` retries.
    *   API Outages: Handled by `CircuitBreaker`.
    *   Hallucinations: Mitigated by `ReasoningEngine` critique step and `IntentValidator`.
*   **Latency**: Optimized by pruning context window and using fast models (e.g., Gemini Flash) for routine tasks.

## 4. Maintenance Guidelines

### Adding a New Tool
1.  Define the intent in `types.ts` (`AgentIntent`).
2.  Add validation logic in `IntentValidator.ts`.
3.  Implement execution logic in `ActionExecutor.ts`.
4.  Update `ReasoningEngine` prompt (optional, usually LLM generalizes).

### Scaling Concurrency
To increase concurrency > 1:
1.  Update `WorkflowEngine` constructor with higher limit.
2.  **Crucial**: Implement a `BrowserViewPool` in `main.ts` to provide separate `WebContents` for each worker. Currently, `AgentGateway` shares the active view.

### Monitoring
*   Monitor `AIService` logs for Circuit Breaker trips.
*   Track `AgentGateway` activity logs for task completion rates.

## 5. Deployment
*   The system is embedded in the Electron main process.
*   Requires valid API keys for selected providers.
*   Recommended: Use `gpt-4o` or `gemini-1.5-pro` for `ReasoningEngine` for best results.
