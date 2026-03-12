/**
 * Agent Gateway
 * 
 * Central orchestrator for the AI agent. This is the "IAM for AI" layer.
 * 
 * Responsibilities:
 * - Receives user requests and page context
 * - Calls LLM via AIService to generate intents
 * - Validates intents through IntentValidator
 * - Checks permissions via PermissionManager
 * - Coordinates approval flow with UI
 * - Executes approved actions via ActionExecutor
 * 
 * Security: LLM NEVER skips this gateway.
 */

import { BrowserWindow, WebContents, ipcMain } from 'electron';
import { AIService, AIProvider } from '../AIService';
import { IntentValidator } from './IntentValidator';
import { permissionManager } from './PermissionManager';
import { actionExecutor } from './ActionExecutor';
import { agentMemory } from './AgentMemory';
import { metricsManager } from './MetricsManager';
import { VisualDetector } from './VisualDetector';
import { ReasoningEngine } from './ReasoningEngine';
import {
    AgentIntent,
    ApprovedIntent,
    ApprovalRequest,
    ActionResult,
    AgentTerminalData,
    AgentTerminalStatus,
    PowerLevel,
    AgentActivity,
    DOMSnapshot,
    POWER_LEVEL_CONFIG,
    ResearchState,
    Subtask,
} from './types';
import { ChatContentPart, ChatMessage } from '../AIService';

/** System prompt is now managed by ReasoningEngine */
// const AGENT_SYSTEM_PROMPT = ... (Removed)

const MAX_TASK_FAILURES = 3;

export class AgentGateway {
    private aiService: AIService;
    private reasoningEngine: ReasoningEngine;
    private visualDetector: VisualDetector;
    private validator: IntentValidator;
    private powerLevel: PowerLevel = 1;
    private mainWindow: BrowserWindow | null = null;
    private overlayWindow: BrowserWindow | null = null;
    private currentActivity: AgentActivity = { state: 'idle' };
    private pendingApprovals: Map<string, {
        request: ApprovalRequest;
        resolve: (approved: boolean) => void;
    }> = new Map();

    /**
     * Check if a navigation goal is complete by matching URL
     * ONLY for simple navigation goals, not complex multi-step tasks
     */
    private isNavigationGoalComplete(goal: string, currentUrl: string): boolean {
        const lowerGoal = goal.toLowerCase();
        const lowerUrl = currentUrl.toLowerCase();

        // IMPORTANT: Don't trigger early completion for complex multi-step goals
        // Check if goal contains action keywords that indicate more work is needed
        const complexGoalKeywords = [
            'find', 'search', 'look for', 'locate',
            'price', 'cost', 'cheapest', 'expensive',
            'compare', 'versus', 'vs',
            'buy', 'purchase', 'order', 'add to cart',
            'fill', 'submit', 'apply', 'sign up', 'register', 'login',
            'summarize', 'list', 'show me', 'tell me', 'get',
            'download', 'extract', 'scrape',
            'top', 'best', 'first', 'last', 'latest', 'newest',
            'and then', 'after that', 'next'
        ];

        const hasComplexKeywords = complexGoalKeywords.some(keyword => lowerGoal.includes(keyword));

        if (hasComplexKeywords) {
            // Complex goal - don't complete just on navigation
            return false;
        }

        // Only trigger for simple navigation goals like "go to youtube.com" or "go to amazon"
        // Common navigation patterns: "go to X", "navigate to X", "open X"
        const navPatterns = [
            /^(?:go\s+to|navigate\s+to|open|visit)\s+([\w.-]+(?:\.\w+)?)\s*$/i,
            /^([\w.-]+\.\w+)\s*$/i  // Just a domain name with TLD
        ];

        for (const pattern of navPatterns) {
            const match = lowerGoal.match(pattern);
            if (match && match[1]) {
                const targetDomain = match[1].replace(/^(https?:\/\/)?/, '').replace(/\/.*$/, '').replace(/^www\./, '');
                // Check if current URL contains the target domain
                if (lowerUrl.includes(targetDomain)) {
                    return true;
                }
                // Also check without TLD for cases like "go to amazon" matching "amazon.com"
                const domainBase = targetDomain.split('.')[0];
                if (domainBase.length >= 3 && lowerUrl.includes(domainBase)) {
                    return true;
                }
            }
        }

        return false;
    }

    constructor(aiService: AIService) {
        this.aiService = aiService;
        this.reasoningEngine = new ReasoningEngine(aiService);
        this.visualDetector = new VisualDetector(aiService);
        this.validator = new IntentValidator(this.powerLevel);
        this.registerIpcHandlers();
    }

    /**
     * Set the main window for IPC communication
     */
    setMainWindow(window: BrowserWindow | null): void {
        this.mainWindow = window;
    }

    /**
     * Set the overlay window for IPC communication
     */
    setOverlayWindow(window: BrowserWindow | null): void {
        this.overlayWindow = window;
    }

    /**
     * Set the active WebContents for actions
     */
    setActiveContents(contents: WebContents | null): void {
        actionExecutor.setActiveContents(contents);
    }

    /**
     * Set power level (1=Reader, 2=Assistant, 3=Agent)
     */
    setPowerLevel(level: PowerLevel): void {
        this.powerLevel = level;
        this.validator.setPowerLevel(level);
        this.notifyActivity({ state: 'idle', message: `Power level: ${POWER_LEVEL_CONFIG[level].name}` });
    }

    /**
     * Get current power level
     */
    getPowerLevel(): PowerLevel {
        return this.powerLevel;
    }

    private withAttemptMetadata(activity: AgentActivity, attemptsUsed: number, terminal = false): AgentActivity {
        const nextAttempt = terminal
            ? Math.max(1, Math.min(attemptsUsed, MAX_TASK_FAILURES))
            : Math.max(1, Math.min(attemptsUsed + 1, MAX_TASK_FAILURES));

        return {
            ...activity,
            attempt: activity.attempt ?? nextAttempt,
            maxAttempts: activity.maxAttempts ?? MAX_TASK_FAILURES,
        };
    }

    private buildFailureSummary(error: string, provider: AIProvider, attemptsUsed: number): string {
        const normalized = error.toLowerCase();

        if (provider === 'github' || normalized.includes('github models')) {
            return `Sorry, I couldn't complete this because the GitHub model kept failing after ${attemptsUsed} attempts.`;
        }

        if (normalized.includes('rate limited') || normalized.includes('quota exceeded')) {
            return `Sorry, I couldn't complete this because the AI provider stayed rate limited after ${attemptsUsed} attempts.`;
        }

        if (normalized.includes('circuit breaker')) {
            return `Sorry, I couldn't complete this because the AI provider stayed unavailable after ${attemptsUsed} attempts.`;
        }

        return `Sorry, I couldn't complete this after ${attemptsUsed} attempts.`;
    }

    private buildManualSteps(
        goal: string,
        currentSubtask: Subtask | null,
        finalUrl?: string,
        completedTasks: string[] = [],
        error?: string
    ): string[] {
        const steps: string[] = [];

        if (finalUrl) {
            steps.push(`Open ${finalUrl} and resume from the current page state.`);
        } else {
            steps.push('Open the site again and return to the screen where the task stopped.');
        }

        if (currentSubtask?.description) {
            steps.push(`Continue with this step manually: ${currentSubtask.description}.`);
        } else {
            steps.push(`Continue the original request manually: ${goal}.`);
        }

        if (completedTasks.length > 0) {
            steps.push(`Reuse the completed progress: ${completedTasks.slice(-2).join(' -> ')}.`);
        }

        if (error && error.trim()) {
            steps.push(`If the same blocker appears, watch for this issue: ${error}.`);
        }

        return steps.slice(0, 4);
    }

    private createTerminalResult(
        status: AgentTerminalStatus,
        intentId: string,
        summary: string,
        options: {
            answer?: string;
            manualSteps?: string[];
            finalUrl?: string;
            attemptsUsed: number;
            durationMs?: number;
            error?: string;
            details?: string;
        }
    ): ActionResult<AgentTerminalData> {
        const data: AgentTerminalData = {
            status,
            summary,
            answer: options.answer,
            manualSteps: options.manualSteps,
            finalUrl: options.finalUrl,
            attemptsUsed: Math.max(1, Math.min(options.attemptsUsed, MAX_TASK_FAILURES)),
        };

        const success = status === 'success';
        this.notifyActivity(this.withAttemptMetadata({
            state: success ? 'complete' : 'error',
            message: success ? 'Task complete' : status === 'cancelled' ? 'Task cancelled' : 'Task failed',
            details: options.details || summary,
            summary,
            manualSteps: options.manualSteps,
        }, data.attemptsUsed, true));

        return {
            success,
            intentId,
            executedAt: Date.now(),
            durationMs: options.durationMs || 0,
            error: success ? undefined : (options.error || summary),
            data,
        };
    }

    /**
     * Main entry point: Process a user request
     */
    async processRequest(
        userRequest: string,
        provider: AIProvider,
        apiKey: string,
        model?: string
    ): Promise<ActionResult<AgentTerminalData>> {
        const taskId = crypto.randomUUID();
        const startedAt = Date.now();
        metricsManager.startTask(taskId, userRequest);

        let failedAttempts = 0;
        let pageContext: DOMSnapshot | null = null;
        let screenshot: string | null = null;
        let researchState: ResearchState | null = null;
        let currentSubtask: Subtask | null = null;
        let lastError = '';
        const history: string[] = [];

        const currentUrl = () => pageContext?.url || '';
        const completedTasks = () => researchState?.completedTasks || [];
        const notifyTaskActivity = (activity: AgentActivity, terminal = false, attemptsUsed = failedAttempts) => {
            this.notifyActivity(this.withAttemptMetadata(activity, attemptsUsed, terminal));
        };
        const finishTask = (
            status: AgentTerminalStatus,
            intentId: string,
            summary: string,
            options: {
                answer?: string;
                manualSteps?: string[];
                finalUrl?: string;
                attemptsUsed?: number;
                error?: string;
                details?: string;
            } = {}
        ) => {
            const attemptsUsed = options.attemptsUsed ?? Math.max(1, failedAttempts || 1);
            const finalUrl = options.finalUrl ?? currentUrl();
            if (status === 'success') {
                metricsManager.endTask(true);
            } else {
                metricsManager.endTask(false, options.error || summary);
            }

            return this.createTerminalResult(status, intentId, summary, {
                answer: options.answer,
                manualSteps: options.manualSteps,
                finalUrl,
                attemptsUsed,
                durationMs: Date.now() - startedAt,
                error: options.error,
                details: options.details,
            });
        };
        const failImmediately = (error: string, intentId: string = crypto.randomUUID()) => {
            lastError = error;
            failedAttempts = MAX_TASK_FAILURES;
            return finishTask(
                'failed',
                intentId,
                this.buildFailureSummary(error, provider, MAX_TASK_FAILURES),
                {
                    manualSteps: this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), error),
                    attemptsUsed: MAX_TASK_FAILURES,
                    error,
                    details: error,
                }
            );
        };
        const consumeFailure = (error: string, intentId: string = crypto.randomUUID()) => {
            lastError = error;
            failedAttempts = Math.min(MAX_TASK_FAILURES, failedAttempts + 1);

            if (failedAttempts >= MAX_TASK_FAILURES) {
                return finishTask(
                    'failed',
                    intentId,
                    this.buildFailureSummary(error, provider, failedAttempts),
                    {
                        manualSteps: this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), error),
                        attemptsUsed: failedAttempts,
                        error,
                        details: error,
                    }
                );
            }

            notifyTaskActivity({
                state: 'thinking',
                message: `Retrying task (${failedAttempts + 1}/${MAX_TASK_FAILURES})...`,
                details: error,
            }, false, failedAttempts);
            return null;
        };

        try {
            const isDeepResearch = this.powerLevel === 3;
            const maxIterations = isDeepResearch ? 15 : 5;

            notifyTaskActivity({ state: 'thinking', message: 'Planning strategy...', details: 'Preparing the task plan...' });

            let plan: Subtask[];
            try {
                plan = await this.reasoningEngine.planDetailedStrategy(userRequest, provider, apiKey);
            } catch (error: any) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                const isRateLimit = errorMsg.includes('Rate limit') || errorMsg.includes('429') || errorMsg.includes('rate limited') || errorMsg.includes('Circuit');

                if (isRateLimit) {
                    const waitMatch = errorMsg.match(/(?:wait|Retry in|for) (\d+)s/i) || errorMsg.match(/(\d+) seconds/i);
                    const waitSecs = waitMatch ? Math.min(parseInt(waitMatch[1], 10), 15) : 5;

                    notifyTaskActivity({
                        state: 'thinking',
                        message: `Rate limited. Waiting ${waitSecs}s before retry...`,
                        details: `The AI provider needs a cooldown. Resuming automatically.`,
                    });

                    console.warn(`[AgentGateway] Rate limited during planning. Waiting ${waitSecs}s...`);
                    await new Promise(r => setTimeout(r, waitSecs * 1000));

                    // Retry planning once after waiting
                    try {
                        plan = await this.reasoningEngine.planDetailedStrategy(userRequest, provider, apiKey);
                    } catch (retryError: any) {
                        return failImmediately(retryError instanceof Error ? retryError.message : String(retryError));
                    }
                } else {
                    return failImmediately(errorMsg);
                }
            }

            researchState = {
                isActive: true,
                goal: userRequest,
                plan,
                completedTasks: [],
                gatheredInfo: [],
                visitedUrls: [],
                iteration: 0,
                maxIterations,
            };

            notifyTaskActivity({ state: 'reading', message: 'Analyzing page...', details: 'Capturing the current page context...' });
            pageContext = await actionExecutor.readSnapshot();
            screenshot = await actionExecutor.captureScreenshot();

            const memory = await agentMemory.getLongTermMemory();

            let contextAnalysisString = '';
            if (pageContext) {
                const { ContextAnalyzer } = await import('./ContextAnalyzer');
                const analyzer = new ContextAnalyzer(this.aiService);
                const analysis = await analyzer.analyze(
                    pageContext.url,
                    pageContext.title,
                    screenshot,
                    pageContext.textContent,
                    provider,
                    apiKey,
                    model
                );
                contextAnalysisString = `Type: ${analysis.pageType}, State: ${analysis.state}`;
            }

            let patternString = '';
            if (pageContext?.url) {
                try {
                    const origin = new URL(pageContext.url).origin;
                    const patterns = await agentMemory.getSitePatterns(origin);
                    if (patterns && patterns.length > 0) {
                        const sorted = patterns.sort((a, b) => b.successCount - a.successCount).slice(0, 3);
                        patternString = sorted.map(p => `Goal: "${p.goalDescription}" -> Selector: "${p.selector}"`).join('; ');
                    }
                } catch {
                    // Pattern recall is opportunistic only.
                }
            }

            while (researchState.iteration < researchState.maxIterations) {
                researchState.iteration++;

                if (researchState.iteration > 1) {
                    pageContext = await actionExecutor.readSnapshot();
                    screenshot = await actionExecutor.captureScreenshot();
                }

                const payload = this.buildMessagePayload(researchState.goal, pageContext, null, provider);
                let richContext = typeof payload === 'string'
                    ? payload
                    : (payload as ChatContentPart[]).find(part => part.type === 'text')?.text || '';

                const isGithub = provider === 'github';
                if (isGithub) {
                    richContext = richContext.slice(0, 2000);
                }

                const maxInfoItems = isGithub ? 2 : 10;
                const gatheredInfoStr = researchState.gatheredInfo.slice(-maxInfoItems).join('; ').slice(0, isGithub ? 300 : 2000);
                const completedTasksStr = researchState.completedTasks.slice(-maxInfoItems).join('; ').slice(0, isGithub ? 200 : 1000);
                const historyStr = history.slice(-2).join('\n').slice(0, isGithub ? 300 : 2000);

                currentSubtask = researchState.plan.find(task => task.status === 'pending') || researchState.plan[researchState.plan.length - 1] || null;
                if (currentSubtask && currentSubtask.status === 'pending') {
                    currentSubtask.status = 'active';
                }

                const activeSubtaskId = currentSubtask?.id;
                const planSummary = researchState.plan.map(task =>
                    `[${task.status === 'completed' ? 'X' : (task.id === activeSubtaskId ? '>' : ' ')}] ${task.description}`
                ).join('\n');

                let contextString = `
${richContext}

CURRENT PLAN:
${planSummary}

Analysis: ${contextAnalysisString}
Patterns: ${patternString}
Gathered Info: ${gatheredInfoStr}
Completed Tasks: ${completedTasksStr}
User Facts: ${memory.facts.slice(0, 3).join('; ')}
Recent History: ${historyStr}
`;
                if (isGithub && contextString.length > 5000) {
                    console.warn(`[AgentGateway] Context too large (${contextString.length} chars), truncating to 5000`);
                    contextString = contextString.slice(0, 5000);
                }

                notifyTaskActivity({
                    state: 'thinking',
                    message: `Reasoning (Step ${researchState.iteration})...`,
                    details: 'Formulating the next action...',
                });

                let reasoning;
                try {
                    reasoning = await this.reasoningEngine.think(
                        researchState.goal,
                        contextString,
                        history,
                        provider,
                        apiKey,
                        model
                    );
                } catch (error: any) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const isRateLimit = errorMsg.includes('Rate limit') || errorMsg.includes('429') || errorMsg.includes('rate limited') || errorMsg.includes('Circuit');

                    if (isRateLimit) {
                        // Parse wait time from the error and actually wait before retrying
                        const waitMatch = errorMsg.match(/(?:wait|Retry in|for) (\d+)s/i) || errorMsg.match(/(\d+) seconds/i);
                        const waitSecs = waitMatch ? Math.min(parseInt(waitMatch[1], 10), 15) : 5;

                        notifyTaskActivity({
                            state: 'thinking',
                            message: `Rate limited. Waiting ${waitSecs}s before retry...`,
                            details: `The AI provider needs a cooldown. Resuming automatically.`,
                        });

                        console.warn(`[AgentGateway] Rate limited. Waiting ${waitSecs}s before retry...`);
                        await new Promise(r => setTimeout(r, waitSecs * 1000));

                        // Use consumeFailure instead of failImmediately to allow retry
                        const terminal = consumeFailure(errorMsg);
                        if (terminal) return terminal;
                        continue;
                    }

                    return failImmediately(errorMsg);
                }

                console.log(`[Reasoning] Trace: ${reasoning.thoughtTrace}`);
                history.push(`Step ${researchState.iteration}: Thought: ${reasoning.thoughtTrace}`);

                const validation = this.validator.parseAndValidate(reasoning.nextAction);
                if (!validation.valid || !validation.sanitizedIntent) {
                    const invalidIntentError = `Invalid intent generated: ${validation.errors.join(', ')}`;
                    console.error('Invalid intent:', validation.errors);
                    history.push(`System Error: ${invalidIntentError}`);
                    const terminal = consumeFailure(invalidIntentError);
                    if (terminal) {
                        return terminal;
                    }
                    continue;
                }

                const intent = validation.sanitizedIntent;

                if (intent.type === 'synthesize_final_answer') {
                    try {
                        await agentMemory.logAction({
                            id: crypto.randomUUID(),
                            intentType: intent.type,
                            origin: currentUrl(),
                            targetDescription: 'Final Answer',
                            approved: true,
                            result: 'success',
                            timestamp: Date.now(),
                            durationMs: 0,
                        });
                    } catch (logError) {
                        console.warn('[AgentGateway] Failed to log final answer action:', logError);
                    }

                    return finishTask(
                        'success',
                        intent.id,
                        'Completed the requested task.',
                        {
                            answer: intent.answer,
                            attemptsUsed: Math.max(1, failedAttempts + 1),
                            details: 'Synthesizing final report...',
                        }
                    );
                }

                const origin = currentUrl();
                const permStatus = permissionManager.checkPermission(origin, intent.type);
                if (permStatus.status === 'requires_approval') {
                    notifyTaskActivity({
                        state: 'awaiting_approval',
                        message: 'Waiting for approval...',
                        intentId: intent.id,
                        details: `Permission required for ${intent.type}`,
                    });

                    const approved = await this.requestApproval(intent, origin);
                    if (!approved) {
                        history.push(`Action ${intent.type} was denied by the user.`);
                        return finishTask(
                            'cancelled',
                            intent.id,
                            'The task was cancelled because approval was not granted.',
                            {
                                manualSteps: [
                                    'Approve the requested browser action and retry if you want the agent to continue.',
                                    ...this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), 'Permission denied'),
                                ].slice(0, 4),
                                attemptsUsed: Math.max(1, failedAttempts + 1),
                                error: 'Permission denied',
                                details: 'Permission denied by the user.',
                            }
                        );
                    }

                    permissionManager.grantPermission(origin, [intent.type]);
                }

                notifyTaskActivity({
                    state: 'executing',
                    message: `Executing: ${intent.type.replace('_', ' ')}`,
                    intentId: intent.id,
                    details: `Target: ${intent.target.description}`,
                });

                const approvedIntent: ApprovedIntent = {
                    ...intent,
                    approvalId: crypto.randomUUID(),
                    approvedAt: Date.now(),
                };
                const result = await actionExecutor.execute(approvedIntent);

                if (result.success) {
                    researchState.completedTasks.push(`${intent.type}: ${intent.target.description}`);
                    history.push(`Action ${intent.type} SUCCEEDED. Result: ${JSON.stringify(result.data || 'OK')}`);

                    if (currentSubtask && currentSubtask.status !== 'completed') {
                        const newSnapshot = await actionExecutor.readSnapshot();
                        if (newSnapshot) {
                            pageContext = newSnapshot;
                            const isComplete = await this.reasoningEngine.verifySubtaskCompletion(
                                currentSubtask,
                                newSnapshot.textContent,
                                provider,
                                apiKey
                            );

                            if (isComplete) {
                                currentSubtask.status = 'completed';
                                notifyTaskActivity({
                                    state: 'executing',
                                    message: 'Subtask complete',
                                    details: currentSubtask.description,
                                });
                                history.push(`CHECKPOINT REACHED: ${currentSubtask.description}`);
                            }
                        }
                    }

                    if (intent.type === 'navigate' || intent.type === 'click_element') {
                        const latestSnapshot = await actionExecutor.readSnapshot();
                        if (latestSnapshot) {
                            pageContext = latestSnapshot;
                        }
                        const latestUrl = currentUrl();
                        if (latestUrl && this.isNavigationGoalComplete(researchState.goal, latestUrl)) {
                            return finishTask(
                                'success',
                                intent.id,
                                `Reached ${latestUrl}.`,
                                {
                                    finalUrl: latestUrl,
                                    attemptsUsed: Math.max(1, failedAttempts + 1),
                                    details: `Successfully reached ${latestUrl}`,
                                }
                            );
                        }
                    }

                    if ((intent.type === 'read_page' || intent.type === 'summarize') && result.data && typeof result.data === 'object' && 'textContent' in (result.data as Record<string, unknown>)) {
                        const textContent = (result.data as Record<string, unknown>).textContent;
                        if (typeof textContent === 'string' && textContent.trim()) {
                            researchState.gatheredInfo.push(textContent.slice(0, 500));
                        }
                    }

                    if (pageContext?.url && intent.target.description && intent.target.selectorHint) {
                        try {
                            const strategy = result.strategy || 'selector';
                            await agentMemory.savePattern(origin, {
                                goalDescription: intent.target.description,
                                selector: intent.target.selectorHint,
                                strategy,
                            });
                        } catch {
                            // Pattern learning is opportunistic only.
                        }
                    }

                    continue;
                }

                const actionError = result.error || 'Unknown error';
                if (actionError.toLowerCase().includes('stopped')) {
                    return finishTask(
                        'cancelled',
                        intent.id,
                        'The task was cancelled before completion.',
                        {
                            manualSteps: this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), actionError),
                            attemptsUsed: Math.max(1, failedAttempts + 1),
                            error: actionError,
                            details: actionError,
                        }
                    );
                }

                console.log(`Action failed: ${actionError}`);
                history.push(`Action ${intent.type} FAILED. Error: ${actionError}`);

                let recovered = false;
                if (intent.type === 'click_element' && screenshot) {
                    const visionSuccess = await this.tryVisionBasedClick(intent, screenshot, provider, apiKey, model);
                    if (visionSuccess) {
                        history.push(`Action ${intent.type} SUCCEEDED via vision fallback.`);
                        recovered = true;
                    }
                }

                if (!recovered && currentSubtask) {
                    notifyTaskActivity({ state: 'thinking', message: 'Analyzing failure...', details: actionError });

                    const analysis = await this.reasoningEngine.analyzeFailureStrategy(
                        currentSubtask,
                        `${intent.type} ${intent.target.description}`,
                        actionError,
                        richContext,
                        provider,
                        apiKey
                    );

                    history.push(`Failure Analysis: ${analysis.decision} - ${analysis.reason}`);

                    if (analysis.decision === 'abort') {
                        return finishTask(
                            'failed',
                            intent.id,
                            `Sorry, I couldn't complete this automatically. ${analysis.reason}`,
                            {
                                manualSteps: this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), actionError),
                                attemptsUsed: Math.max(1, failedAttempts + 1),
                                error: actionError,
                                details: analysis.reason,
                            }
                        );
                    }

                    if (analysis.decision === 'skip_step') {
                        currentSubtask.status = 'completed';
                        history.push(`Skipping subtask: ${currentSubtask.description}`);
                        continue;
                    }

                    if (analysis.decision === 'new_strategy' && analysis.newSubtasks) {
                        currentSubtask.status = 'failed';
                        const currentIndex = researchState.plan.findIndex(task => task.id === currentSubtask?.id);
                        if (currentIndex !== -1) {
                            researchState.plan.splice(currentIndex + 1, 0, ...analysis.newSubtasks);
                        }
                        history.push(`Plan Updated: Added ${analysis.newSubtasks.length} new steps.`);
                        continue;
                    }

                    if (analysis.correction) {
                        history.push(`Correction Hint: ${analysis.correction}`);
                    }
                } else if (!recovered && screenshot) {
                    const diagnosis = await this.diagnoseFailure(intent, actionError, screenshot, pageContext, provider, apiKey, model);
                    if (diagnosis) {
                        history.push(`Diagnosis: ${diagnosis.diagnosis}. Suggestions: ${diagnosis.suggestedSelectors.join(', ')}`);
                    }
                }

                if (recovered) {
                    continue;
                }

                const terminal = consumeFailure(actionError, intent.id);
                if (terminal) {
                    return terminal;
                }
            }

            const maxIterationError = lastError || 'The agent reached its maximum number of steps before completing the task.';
            return finishTask(
                'failed',
                crypto.randomUUID(),
                this.buildFailureSummary(maxIterationError, provider, Math.max(1, failedAttempts || 1)),
                {
                    manualSteps: this.buildManualSteps(userRequest, currentSubtask, currentUrl(), completedTasks(), maxIterationError),
                    attemptsUsed: Math.max(1, failedAttempts || 1),
                    error: maxIterationError,
                    details: maxIterationError,
                }
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[AgentGateway] Process Request Failed:', error);
            return failImmediately(message);
        }
    }

    /**
     * Emergency stop - cancel all pending and active actions
     */
    emergencyStop(): void {
        // Stop executor
        actionExecutor.stop();

        // Cancel all pending approvals
        for (const [id, pending] of this.pendingApprovals) {
            pending.resolve(false);
            this.pendingApprovals.delete(id);
        }

        // Revoke all permissions
        permissionManager.revokeAll();

        // Reset to Level 1
        this.setPowerLevel(1);

        this.notifyActivity({ state: 'idle', message: 'Emergency stop - all actions cancelled' });
    }

    /**
     * Build multimodal message payload
     */
    /**
     * Diagnose failure using LLM Vision
     */
    private async diagnoseFailure(intent: AgentIntent, error: string, screenshot: string | null, pageContext: DOMSnapshot | null, provider: AIProvider, apiKey: string, model?: string): Promise<{ diagnosis: string; suggestedSelectors: string[]; } | null> {
        if (!screenshot) return null;

        const system = `You are an automated browser agent diagnosis expert. 
Your goal is to look at a failed action and the current page state, then explain WHY it failed and suggest fixes.
Be concise. Focus on fixing the CSS selector or text match.`;

        const prompt = `I failed to execute the following action:
Action: ${intent.type}
Target Description: "${intent.target.description}"
Failed Selector: "${intent.target.selectorHint}"
Error Message: "${error}"

Here is the current page visual (screenshot) and DOM context.

Task:
1. Diagnose the issue. (e.g. Element not found, Element covered, visual mismatch, dynamic ID).
2. Suggest up to 3 ALTERNATIVE CSS selectors that are more robust (use attributes, text, or hierarchy).

Return strictly JSON:
{
  "diagnosis": "Brief explanation of failure",
  "suggestedSelectors": ["alternative_selector_1", "alternative_selector_2"]
}`;

        const messages: ChatMessage[] = [
            { role: 'system', content: system },
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: screenshot } }
                ]
            }
        ];

        // Add page context if available
        if (pageContext) {
            let contextStr = `Page Title: ${pageContext.title}\nURL: ${pageContext.url}\n`;
            // Add interactive elements close to potential target could be helpful, but let's keep it simple for now to save tokens
            // Maybe just the interactive elements list
            if (pageContext.interactive) {
                contextStr += `Interactive Elements (possible targets):\n` +
                    pageContext.interactive.slice(0, 50).map(i => `- [${i.role}] "${i.label}" (Selector: ${i.selector})`).join('\n');
            }
            messages[1].content = [
                { type: 'text', text: prompt + '\n\nDOMAIN CONTEXT:\n' + contextStr },
                { type: 'image_url', image_url: { url: screenshot } }
            ];
        }

        try {
            // Use provided model or let service default. Do not force gpt-4o.
            const response = await this.aiService.chatCompletion(provider, apiKey, messages, model);
            // Simple parsing
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('[AgentGateway] Diagnosis failed', e);
            return null;
        }
    }

    /**
     * Try to click using Vision (Coordinates)
     */
    private async tryVisionBasedClick(intent: AgentIntent, screenshot: string | null, provider: AIProvider, apiKey: string, model?: string): Promise<boolean> {
        if (!screenshot) return false;

        const hint = `Target Text: "${intent.target.textMatch || ''}". Previous Selector Failed: "${intent.target.selectorHint}"`;

        const result = await this.visualDetector.locateElement(
            intent.target.description,
            screenshot,
            provider,
            apiKey,
            model,
            hint
        );

        if (result) {
            console.log(`[Vision] Found element at ${result.x},${result.y} (${result.reasoning})`);
            await actionExecutor.clickAtCoordinates(result.x, result.y);
            return true;
        }

        return false;
    }

    private buildMessagePayload(userRequest: string, pageContext: DOMSnapshot | null, screenshotBase64: string | null, provider: AIProvider): string | ChatContentPart[] {
        let prompt = `User request: ${userRequest}\n\n`;

        if (pageContext) {
            prompt += `Current page: ${pageContext.title}\n`;
            prompt += `URL: ${pageContext.url}\n\n`;

            // --- NEW: Interactive Elements (Accessibility-First) ---
            if (pageContext.interactive && pageContext.interactive.length > 0) {
                prompt += `INTERACTIVE ELEMENTS (Accessibility Tree):\n`;

                // Group by role for better readability
                const inputs = pageContext.interactive.filter(i => ['input', 'textarea', 'combobox', 'textbox', 'searchbox'].includes(i.role));
                const clicks = pageContext.interactive.filter(i => !['input', 'textarea', 'combobox', 'textbox', 'searchbox'].includes(i.role));

                // Provider-aware limits (GitHub has strict 8k token limit)
                const isGithub = provider === 'github';
                const maxClicks = isGithub ? 15 : 50;
                const maxInputs = isGithub ? 10 : 30;

                if (inputs.length > 0) {
                    prompt += `[Forms/Inputs]\n`;
                    for (const i of inputs.slice(0, maxInputs)) {
                        const state = [];
                        if (i.attributes.placeholder) state.push(`placeholder="${i.attributes.placeholder}"`);
                        if (i.attributes.value) state.push(`value="${i.attributes.value}"`);
                        prompt += `- [${i.role.toUpperCase()}] "${i.label || i.text || 'unlabeled'}" (${i.selector}) ${state.join(' ')}\n`;
                    }
                    if (inputs.length > maxInputs) prompt += `...and ${inputs.length - maxInputs} more inputs.\n`;
                    prompt += '\n';
                }

                if (clicks.length > 0) {
                    prompt += `[Buttons/Links/Clickables]\n`;
                    // Limit based on provider
                    for (const i of clicks.slice(0, maxClicks)) {
                        prompt += `- [${i.role.toUpperCase()}] "${i.label || i.text}" (${i.selector})\n`;
                    }
                    if (clicks.length > maxClicks) prompt += `...and ${clicks.length - maxClicks} more items.\n`;
                    prompt += '\n';
                }
            }
            // --- FALLBACK: Legacy Lists ---
            else {
                if (pageContext.formFields.length > 0) {
                    prompt += `Form fields on page:\n`;
                    for (const field of pageContext.formFields.slice(0, 10)) {
                        prompt += `- ${field.name} (${field.type}): ${field.label || 'no label'}\n`;
                    }
                    prompt += '\n';
                }

                if (pageContext.buttons.length > 0) {
                    prompt += `Buttons on page:\n`;
                    for (const btn of pageContext.buttons.slice(0, 10)) {
                        prompt += `- ${btn.text} (${btn.type})\n`;
                    }
                    prompt += '\n';
                }
            }

            // Truncate page content
            // GitHub Models have strict 8k limit. Others are 128k+.
            const isGithub = provider === 'github';
            const maxContentLength = isGithub ? 2000 : 25000; // More aggressive for GitHub
            const content = pageContext.textContent.slice(0, maxContentLength);
            prompt += `Page content (truncated):\n<page_content>\n${content}\n</page_content>\n`;
        }

        // If no screenshot or text-only provider (though we assume multimodal for now based on provider check in service)
        if (!screenshotBase64) {
            return prompt;
        }

        // Return multimodal array
        return [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: screenshotBase64, detail: 'high' } }
        ];
    }

    /**
     * Request user approval for an action
     */
    private async requestApproval(intent: AgentIntent, origin: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request: ApprovalRequest = {
                id: crypto.randomUUID(),
                intent,
                origin,
                affectedElements: intent.target.selectorHint ? [intent.target.selectorHint] : [],
                consequences: this.describeConsequences(intent),
                timestamp: Date.now(),
            };

            this.pendingApprovals.set(request.id, { request, resolve });

            // Send to renderer (Main & Overlay)
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('agent:approval-request', request);
            }
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.overlayWindow.webContents.send('agent:approval-request', request);
            }

            // Timeout after 60 seconds
            setTimeout(() => {
                if (this.pendingApprovals.has(request.id)) {
                    this.pendingApprovals.delete(request.id);
                    resolve(false);
                }
            }, 60000);
        });
    }

    /**
     * Handle approval response from UI
     */
    handleApprovalResponse(requestId: string, approved: boolean): void {
        const pending = this.pendingApprovals.get(requestId);
        if (pending) {
            pending.resolve(approved);
            this.pendingApprovals.delete(requestId);
        }
    }

    /**
     * Describe what an intent will do (for approval UI)
     */
    private describeConsequences(intent: AgentIntent): string {
        switch (intent.type) {
            case 'fill_form':
                const params = intent.parameters as { fields?: { fieldName: string }[] };
                const fieldCount = params.fields?.length || 0;
                return `Fill ${fieldCount} form field(s). Will NOT click submit.`;

            case 'click_element':
                return `Click "${intent.target.description}". This is NOT a submit button.`;

            case 'highlight_element':
                return `Highlight "${intent.target.description}" on the page.`;

            case 'suggest_action':
                return `Conversational response: "${intent.answer?.slice(0, 50)}..."`;

            case 'scroll_to':
                return `Scroll to "${intent.target.description}".`;

            case 'read_page':
            case 'summarize':
                return `Read page content (no changes made).`;

            case 'navigate':
                return `Navigate to "${intent.target.description}".`;

            default:
                return 'Unknown action';
        }
    }

    /**
     * Notify UI of activity state change
     */
    private notifyActivity(activity: AgentActivity): void {
        this.currentActivity = activity;
        
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('agent:activity-update', activity);
        }
        
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send('agent:activity-update', activity);
        }
    }

    /**
     * Get current activity state
     */
    getActivityState(): AgentActivity {
        return { ...this.currentActivity };
    }

    /**
     * Register IPC handlers for renderer communication
     */
    private registerIpcHandlers(): void {
        ipcMain.handle('agent:process-request', async (_event, { userRequest, provider, apiKey, model }) => {
            return this.processRequest(userRequest, provider, apiKey, model);
        });

        ipcMain.handle('agent:set-power-level', (_event, level: PowerLevel) => {
            this.setPowerLevel(level);
            return true;
        });

        ipcMain.handle('agent:get-power-level', () => {
            return this.powerLevel;
        });

        ipcMain.handle('agent:emergency-stop', () => {
            this.emergencyStop();
            return true;
        });

        ipcMain.handle('agent:approval-response', (_event, { requestId, approved }) => {
            this.handleApprovalResponse(requestId, approved);
            return true;
        });

        ipcMain.handle('agent:get-permissions', () => {
            return permissionManager.getActivePermissions();
        });

        ipcMain.handle('agent:revoke-permission', (_event, permissionId: string) => {
            return permissionManager.revokePermission(permissionId);
        });

        ipcMain.handle('agent:revoke-all-for-site', (_event, origin: string) => {
            return permissionManager.revokeAllForSite(origin);
        });

        ipcMain.handle('agent:get-action-log', async (_event, limit?: number) => {
            return agentMemory.getActionHistory(limit);
        });

        ipcMain.handle('agent:get-user-profile', async () => {
            return agentMemory.getUserProfile();
        });

        ipcMain.handle('agent:update-user-profile', async (_event, updates) => {
            return agentMemory.updateUserProfile(updates);
        });

        ipcMain.handle('agent:get-activity', () => {
            return this.currentActivity;
        });
    }
}

// Singleton instance will be created in main.ts
export let agentGateway: AgentGateway | null = null;

export function initializeAgentGateway(aiService: AIService): AgentGateway {
    agentGateway = new AgentGateway(aiService);
    return agentGateway;
}
