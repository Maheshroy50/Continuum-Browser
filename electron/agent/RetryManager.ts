/**
 * Retry Manager
 * 
 * Implements the "Adaptive Retry and Recovery" system from the AI Agent Enhancement Plan.
 * Handles escalating retry strategies to ensure robust execution of actions.
 */

import { ApprovedIntent } from './types';

export enum RetryLevel {
    INITIAL = 0,
    SOFT_RETRY = 1,           // Simple delay and retry
    SELECTOR_FALLBACK = 2,    // Try alternative selectors (if available)
    INTERACTION_SIMULATION = 3, // Scroll, hover, focus before clicking
    JS_FORCE = 4,             // Direct DOM event dispatch / .click()
    STATE_RESET = 5           // (Optional) Reload or navigation reset
}

export interface RetryResult<T = any> {
    success: boolean;
    error?: string;
    finalLevel: RetryLevel;
    data?: T;
}

export type ActionCallback<T = any> = (level: RetryLevel, intent: ApprovedIntent) => Promise<{ success: boolean; error?: string; data?: T }>;

export class RetryManager {
    private static readonly MAX_ATTEMPTS = 3;

    /**
     * Execute an action with escalating retry strategies
     */
    async executeWithRetry<T = any>(
        intent: ApprovedIntent,
        action: ActionCallback<T>
    ): Promise<RetryResult<T>> {
        let currentLevel = RetryLevel.INITIAL;
        let lastError: string | undefined;

        // Special handling for non-interactive intents (e.g., read_page)
        // We might only want simple retries for those
        const isInteractive = ['click_element', 'fill_form'].includes(intent.type);
        const maxLevel = isInteractive ? RetryLevel.JS_FORCE : RetryLevel.SOFT_RETRY;

        for (let attempt = 0; attempt <= RetryManager.MAX_ATTEMPTS; attempt++) {
            
            // Determine level based on attempt
            // Attempt 0: Initial (Level 0)
            // Attempt 1: Soft Retry (Level 1)
            // Attempt 2: Selector Fallback (Level 2)
            // Attempt 3: Interaction Simulation (Level 3)
            // Attempt 4: JS Force (Level 4)
            if (attempt > 0) {
                currentLevel = Math.min(attempt, maxLevel) as RetryLevel;
            }

            console.log(`[RetryManager] Attempt ${attempt + 1}/${RetryManager.MAX_ATTEMPTS + 1} (Level: ${RetryLevel[currentLevel]})`);

            // Apply pre-action delays based on level
            if (currentLevel === RetryLevel.SOFT_RETRY) {
                await this.delay(200);
            } else if (currentLevel >= RetryLevel.INTERACTION_SIMULATION) {
                await this.delay(500);
            }

            try {
                const result = await action(currentLevel, intent);
                
                if (result.success) {
                    return {
                        success: true,
                        finalLevel: currentLevel,
                        data: result.data
                    };
                }

                lastError = result.error;
                console.warn(`[RetryManager] Level ${RetryLevel[currentLevel]} failed: ${lastError}`);

                // If error is "Blocked", do not retry (safety)
                if (lastError && lastError.toLowerCase().includes('blocked')) {
                    return { success: false, error: lastError, finalLevel: currentLevel };
                }

            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.error(`[RetryManager] Unexpected error at Level ${RetryLevel[currentLevel]}:`, error);
            }
        }

        return {
            success: false,
            error: `Failed after ${RetryManager.MAX_ATTEMPTS} attempts. Last error: ${lastError}`,
            finalLevel: currentLevel
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
