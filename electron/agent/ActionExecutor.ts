/**
 * Action Executor
 * 
 * Sandboxed executor that performs approved browser actions.
 * This is the ONLY component that interacts with page content.
 * 
 * Hard restrictions:
 * - No arbitrary JS execution
 * - No password/sensitive field access
 * - No submit button clicks
 * - All actions are logged
 */

import { WebContents } from 'electron';
import { ApprovedIntent, ActionResult, ActionLogEntry, BLOCKED_SELECTORS, BLOCKED_BUTTON_TYPES, FillFormParameters, DOMSnapshot } from './types';
import { NetworkMonitor } from './NetworkMonitor';
import { agentMemory } from './AgentMemory';
import { RetryManager, RetryLevel } from './RetryManager';
import { getFindElementScript, getSnapshotScript } from './DOMUtils';
import { metricsManager } from './MetricsManager';
import { MouseUtils } from './MouseUtils';
import { cdpBridge } from './CDPBridge';

const HIGHLIGHT_COLOR = 'rgba(99, 102, 241, 0.3)';
const HIGHLIGHT_BORDER = '2px solid rgb(99, 102, 241)';

export class ActionExecutor {
    private activeContents: WebContents | null = null;
    private shouldStop: boolean = false;
    private retryManager = new RetryManager();
    private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };

    /**
     * Set the active WebContents to operate on
     */
    setActiveContents(contents: WebContents | null): void {
        this.activeContents = contents;
        // Inject monitor immediately if possible
        if (this.activeContents) {
            this.activeContents.executeJavaScript(NetworkMonitor.getInitScript()).catch(() => { });
            // Attach CDP bridge for CSP-safe operations
            cdpBridge.attach(this.activeContents).catch(() => {
                console.log('[ActionExecutor] CDP bridge attach deferred');
            });
        }
    }

    /**
     * Emergency stop - halts all pending actions
     */
    stop(): void {
        this.shouldStop = true;
    }

    /**
     * Reset stop flag
     */
    reset(): void {
        this.shouldStop = false;
    }

    /**
     * Wait for network idle state (no active requests for 500ms)
     */
    async waitForNetworkIdle(timeout = 5000): Promise<void> {
        if (!this.activeContents) return;

        // Ensure monitor is initialized
        await this.activeContents.executeJavaScript(NetworkMonitor.getInitScript());

        const start = Date.now();
        while (Date.now() - start < timeout) {
            const isIdle = await this.activeContents.executeJavaScript(NetworkMonitor.getCheckIdleScript());
            if (isIdle) return;
            await new Promise(r => setTimeout(r, 200));
        }
        console.log('[ActionExecutor] Network idle timeout reached, proceeding anyway.');
    }

    /**
     * Execute an approved intent
     */
    async execute(intent: ApprovedIntent): Promise<ActionResult> {
        if (!this.activeContents) {
            return this.createResult(intent, false, 'No active web contents to execute on');
        }

        console.log(`[ActionExecutor] Executing ${intent.type} on ${this.activeContents.id}`);

        const startTime = Date.now();

        if (this.shouldStop) {
            return this.createResult(intent, false, 'Execution stopped by user', 0);
        }

        // Wait for network idle before reading or interacting if sensible
        if (intent.type === 'read_page' || intent.type === 'summarize') {
            await this.waitForNetworkIdle();
        }

        // Execute with Retry Manager
        const retryResult = await this.retryManager.executeWithRetry(intent, async (level, intent) => {
            if (this.shouldStop) return { success: false, error: 'Stopped' };

            let success = false;
            let error: string | undefined;
            let resultData: any = undefined;

            switch (intent.type) {
                case 'scroll_to':
                    success = await this.scrollToElement(intent.target.selectorHint || '');
                    break;

                case 'navigate':
                    success = await this.navigate(intent.target.description);
                    if (success) await this.activeContents?.executeJavaScript(NetworkMonitor.getInitScript());
                    break;

                case 'fill_form':
                    const fillResult = await this.fillFormFields(intent, level);
                    success = fillResult.success;
                    error = fillResult.error;
                    break;

                case 'click_element':
                    const clickResult = await this.clickElement(intent, level);
                    success = clickResult.success;
                    error = clickResult.error;
                    break;

                case 'press_key':
                    const key = intent.parameters?.key as string;
                    if (key) {
                        success = await this.pressKey(key);
                    } else {
                        success = false;
                        error = 'No key specified';
                    }
                    break;

                case 'read_page':
                case 'summarize':
                    // Show reading indicator
                    await this.highlightElement('body', 'Reading page content...');
                    await this.sleep(800);

                    const snapshot = await this.readSnapshot();
                    await this.clearHighlights();

                    if (snapshot) {
                        success = true;
                        resultData = snapshot;
                    } else {
                        // CSP fallback
                        try {
                            const basicInfo = await this.activeContents?.executeJavaScript(`
                                ({ title: document.title, url: window.location.href })
                            `);
                            if (basicInfo) {
                                success = true;
                                resultData = {
                                    url: basicInfo.url,
                                    title: basicInfo.title,
                                    textContent: `Page: ${basicInfo.title}. Content reading blocked by site security (CSP). Navigation was successful.`,
                                    cspBlocked: true
                                };
                            } else {
                                success = false;
                                error = 'Page content restricted by site security policy';
                            }
                        } catch {
                            success = false;
                            error = 'Page content restricted by site security policy';
                        }
                    }
                    break;

                case 'highlight_element':
                    success = await this.highlightElement(intent.target.selectorHint || '', intent.target.description);
                    break;

                case 'suggest_action':
                case 'synthesize_final_answer':
                    success = true;
                    break;

                default:
                    success = false;
                    error = `Unknown intent type: ${intent.type}`;
            }

            return { success, error, data: resultData };
        });

        const result = this.createResult(intent, retryResult.success, retryResult.error, Date.now() - startTime, retryResult.data);

        // Record Metric
        metricsManager.recordAction({
            actionId: result.intentId,
            type: intent.type,
            durationMs: result.durationMs || 0,
            retries: retryResult.finalLevel,
            finalRetryLevel: retryResult.finalLevel,
            success: result.success,
            error: result.error,
            timestamp: Date.now()
        });

        await this.logAction(intent, result);
        return result;
    }

    /**
     * Handle Infinite Scroll
     * Scrolls to bottom up to `maxScrolls` times, waiting for new content.
     * Returns true if content length increased.
     */
    async handleInfiniteScroll(maxScrolls = 3): Promise<boolean> {
        if (!this.activeContents) return false;

        console.log('[ActionExecutor] Attempting infinite scroll...');
        const initialLength = await this.activeContents.executeJavaScript(`document.querySelector('main, article, #content, body')?.innerText.length || 0`);

        for (let i = 0; i < maxScrolls; i++) {
            // Scroll to bottom
            await this.activeContents.executeJavaScript(`window.scrollTo(0, document.body.scrollHeight)`);
            await this.sleep(1000); // Wait for trigger

            // Wait for network idle (new content loading)
            await this.waitForNetworkIdle(3000);
        }

        const newLength = await this.activeContents.executeJavaScript(`document.querySelector('main, article, #content, body')?.innerText.length || 0`);

        return newLength > initialLength + 100; // Significant increase
    }

    /**
     * Read page content and return a sanitized snapshot.
     * Strategy: CDP bridge first (CSP-immune), falls back to executeJavaScript.
     */
    async readSnapshot(): Promise<DOMSnapshot | null> {
        if (!this.activeContents) return null;

        // Ensure network is idle before reading
        await this.waitForNetworkIdle();

        // STRATEGY 1: CDP Bridge (OpenClaw-inspired, CSP-safe)
        if (cdpBridge.isAttached) {
            try {
                console.log('[ActionExecutor] Reading snapshot via CDP bridge');
                const snapshot = await cdpBridge.getSnapshot();
                if (snapshot && snapshot.textContent.length > 0) {
                    return snapshot;
                }
                console.log('[ActionExecutor] CDP snapshot empty, falling back to JS');
            } catch (error) {
                console.log('[ActionExecutor] CDP snapshot failed, falling back to JS');
            }
        }

        // STRATEGY 2: executeJavaScript fallback (works on non-CSP pages)
        try {
            // Show scanning effect (CSP-safe: uses textContent instead of innerHTML)
            try {
                await this.activeContents.executeJavaScript(`
                    (function() {
                        try {
                            var overlay = document.createElement('div');
                            overlay.id = 'ai-scan-overlay';
                            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(99, 102, 241, 0.1);z-index:999999;pointer-events:none;transition:opacity 0.5s;';
                            document.body.appendChild(overlay);
                            
                            var scanLine = document.createElement('div');
                            scanLine.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:2px;background:#6366f1;box-shadow:0 0 10px #6366f1;animation:aiScan 1.5s linear infinite;';
                            var style = document.createElement('style');
                            style.textContent = '@keyframes aiScan { 0% {top:0} 50% {top:100%} 100% {top:0} }';
                            overlay.appendChild(style);
                            overlay.appendChild(scanLine);
                        } catch(e) { /* CSP may block - silently skip */ }
                    })();
                `);
            } catch (overlayError) {
                // Overlay is cosmetic only — never let it block snapshot reading
            }

            await this.sleep(300);

            const result = await this.activeContents.executeJavaScript(
                getSnapshotScript(BLOCKED_SELECTORS)
            );

            // Remove scanning effect
            try {
                await this.activeContents.executeJavaScript(`
                    try { document.getElementById('ai-scan-overlay')?.remove(); } catch(e) {}
                `);
            } catch (e) { /* ignore */ }

            return result as DOMSnapshot;
        } catch (error) {
            console.error('[ActionExecutor] Failed to read snapshot (both methods):', error);
            if (this.activeContents) {
                try {
                    await this.activeContents.executeJavaScript(`
                        try { document.getElementById('ai-scan-overlay')?.remove(); } catch(e) {}
                    `);
                } catch (e) { /* ignore */ }
            }
            return null;
        }
    }

    /**
     * Capture screenshot of the current page
     * Returns base64 string
     */
    async captureScreenshot(): Promise<string | null> {
        if (!this.activeContents) return null;

        try {
            // Capture the visible page
            const image = await this.activeContents.capturePage();

            // Resize to reasonable dimensions to save tokens and bandwidth
            // Max 1024 width/height is standard for OpenAI
            const resized = image.resize({ width: 1024 });

            // Return as data URL
            return resized.toDataURL();
        } catch (error) {
            console.error('[ActionExecutor] Failed to capture screenshot:', error);
            return null;
        }
    }

    /**
     * Shared logic to find an element responsibly
     * Returns the element or null
     * Note: This runs entirely in the renderer context
     */
    private getFindElementScript(selector: string): string {
        return getFindElementScript(selector, BLOCKED_BUTTON_TYPES);
    }

    /**
     * Move mouse smoothly to target coordinates
     */
    private async moveMouseSmoothly(targetX: number, targetY: number): Promise<void> {
        if (!this.activeContents) return;

        const path = MouseUtils.generateHumanPath(this.lastMousePosition, { x: targetX, y: targetY });

        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            try {
                await this.activeContents.sendInputEvent({
                    type: 'mouseMove',
                    x: Math.round(p.x),
                    y: Math.round(p.y)
                });
            } catch (e) {
                // Ignore errors during movement (e.g. if page closed)
            }

            const delay = MouseUtils.getDelay(i, path.length);
            if (delay > 0) await this.sleep(delay);
        }

        this.lastMousePosition = { x: targetX, y: targetY };
    }

    /**
     * Click at specific coordinates (Vision Fallback)
     */
    async clickAtCoordinates(x: number, y: number): Promise<{ success: boolean; error?: string }> {
        if (!this.activeContents) return { success: false, error: 'No active view' };

        try {
            // Visual feedback
            await this.activeContents.executeJavaScript(`
                (function() {
                    const dot = document.createElement('div');
                    dot.style.cssText = 'position:fixed;left:${x}px;top:${y}px;width:20px;height:20px;background:rgba(255, 0, 0, 0.5);border-radius:50%;z-index:999999;pointer-events:none;transform:translate(-50%, -50%);transition: all 0.3s ease;';
                    document.body.appendChild(dot);
                    setTimeout(() => {
                        dot.style.transform = 'translate(-50%, -50%) scale(0)';
                        setTimeout(() => dot.remove(), 300);
                    }, 500);
                })();
            `);

            // Move Mouse Smoothly
            await this.moveMouseSmoothly(x, y);

            await this.sleep(50);

            // Execute click via Input event emulation (most reliable for coordinates)
            await this.activeContents.sendInputEvent({
                type: 'mouseDown',
                x: Math.round(x),
                y: Math.round(y),
                button: 'left',
                clickCount: 1
            });

            await this.activeContents.sendInputEvent({
                type: 'mouseUp',
                x: Math.round(x),
                y: Math.round(y),
                button: 'left',
                clickCount: 1
            });

            console.log(`[ActionExecutor] Clicked at ${x},${y}`);
            return { success: true };

        } catch (error) {
            console.error('[ActionExecutor] Click at coordinates failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Highlight an element on the page
     */
    async highlightElement(selector: string, message?: string): Promise<boolean> {
        if (!this.activeContents) return false;

        try {
            await this.activeContents.executeJavaScript(`
                (function() {
                    // Remove any existing highlights
                    document.querySelectorAll('[data-ai-highlight]').forEach(el => {
                        el.style.outline = el.dataset.originalOutline || '';
                        el.style.backgroundColor = el.dataset.originalBg || '';
                        el.removeAttribute('data-ai-highlight');
                    });
                    
                    // Use shared finder
                    const result = ${this.getFindElementScript(selector)};
                    const el = result.element;
                    // const strategy = result.strategy; // Can log if needed

                    if (!el) return false;
                    
                    // Store original styles
                    el.dataset.originalOutline = el.style.outline;
                    el.dataset.originalBg = el.style.backgroundColor;
                    el.dataset.aiHighlight = 'true';
                    
                    // Apply highlight
                    el.style.outline = ${JSON.stringify(HIGHLIGHT_BORDER)};
                    el.style.backgroundColor = ${JSON.stringify(HIGHLIGHT_COLOR)};
                    
                    // Scroll into view
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Show tooltip if message provided
                    ${message ? `
                        const tooltip = document.createElement('div');
                        tooltip.id = 'ai-tooltip';
                        tooltip.style.cssText = 'position:fixed;top:10px;right:10px;background:#4F46E5;color:white;padding:12px 16px;border-radius:8px;z-index:999999;font-family:system-ui;font-size:14px;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
                        tooltip.innerText = ${JSON.stringify(message)};
                        document.body.appendChild(tooltip);
                        setTimeout(() => tooltip.remove(), 5000);
                    ` : ''}
                    
                    return true;
                })();
            `);

            return true;
        } catch (error) {
            console.error('[ActionExecutor] Failed to highlight:', error);
            return false;
        }
    }

    /**
     * Remove all AI highlights from page
     */
    async clearHighlights(): Promise<void> {
        if (!this.activeContents) return;

        try {
            await this.activeContents.executeJavaScript(`
                document.querySelectorAll('[data-ai-highlight]').forEach(el => {
                    el.style.outline = el.dataset.originalOutline || '';
                    el.style.backgroundColor = el.dataset.originalBg || '';
                    el.removeAttribute('data-ai-highlight');
                });
                document.getElementById('ai-tooltip')?.remove();
            `);
        } catch (error) {
            console.error('[ActionExecutor] Failed to clear highlights:', error);
        }
    }

    /**
     * Scroll to an element
     */
    private async scrollToElement(selector: string): Promise<boolean> {
        if (!this.activeContents) return false;

        try {
            const result = await this.activeContents.executeJavaScript(`
                (function() {
                    // Strategy 1: Smart Selector finding
                    let el = null;
                    let matchInfo = { type: 'selector', score: 100 };
                    
                    try {
                        if (${JSON.stringify(selector)}) {
                            // Try exact selector first
                            el = document.querySelector(${JSON.stringify(selector)});
                        }
                    } catch(e) {}

                    // Strategy 2: ID Search (Common pattern: spaces to underscores)
                    if (!el) {
                         const rawSearch = ${JSON.stringify(selector)};
                         const search = rawSearch.replace(/[#.]/g, '').trim();
                         // Try ID with underscores (Wikipedia style)
                         const idSearch = search.replace(/ /g, '_');
                         el = document.getElementById(idSearch);
                         if (el) matchInfo = { type: 'id_exact', score: 100 };
                    }
                    
                    // Strategy 3: Text Search with Scoring
                    // Define candidates here so it's available for debug label
                    let candidates = [];

                    if (!el) {
                        const rawSearch = ${JSON.stringify(selector)};
                        const search = rawSearch.replace(/[#.]/g, '').toLowerCase().trim();
                        
                        // Helper to score and collect
                        const collect = (tags, scoreBase, type) => {
                            document.querySelectorAll(tags).forEach(e => {
                                const text = e.innerText?.toLowerCase() || '';
                                if (!text) return;
                                
                                const isVisible = e.offsetParent !== null;
                                const notInNav = !e.closest('.toc, #toc, .vector-toc, nav, header, footer, .sidebar, .mw-editsection');
                                if (!isVisible || !notInNav) return;

                                // 1. Exact Phrase Match
                                if (text.includes(search)) {
                                    // Bonus for exact length match (it IS the header, not just containing it)
                                    const lengthBonus = text.length === search.length ? 50 : 0;
                                    // Penalty for huge text blocks
                                    const sizePenalty = text.length > 500 ? -50 : 0;
                                    
                                    candidates.push({ 
                                        el: e, 
                                        score: scoreBase + 50 + lengthBonus + sizePenalty, 
                                        match: 'exact',
                                        text: e.innerText.substring(0, 50) 
                                    });
                                } 
                                // 2. Keyword Match (All words)
                                else {
                                    const stopWords = ['and', 'the', 'for', 'with', 'that', 'this', 'section', 'part', 'about', 'chapter', 'page', 'screen', 'view', 'show', 'find', 'scroll', 'to', 'in', 'on'];
                                    const words = search.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
                                    
                                    // Stricter keyword matching for content: require ALL valid keywords
                                    if (words.length > 0 && words.every(w => text.includes(w))) {
                                        // Massive penalty for content matching keywords vs headers
                                        const isContent = type === 'paragraph' || type === 'content';
                                        const sizePenalty = (isContent && text.length > 100) ? -100 : 0;
                                        
                                        // Boost if it's short (like a header that didn't exact match for some reason)
                                        const brevityBonus = text.length < 50 ? 20 : 0;

                                        candidates.push({ 
                                            el: e, 
                                            score: scoreBase + sizePenalty + brevityBonus, 
                                            match: 'keywords',
                                            text: e.innerText.substring(0, 50)
                                        });
                                    }
                                }
                            });
                        };

                        // Collect candidates with base scores
                        // Boost headers SIGNIFICANTLY to override any paragraph matches
                        collect('h1, h2, h3, h4, h5, h6', 500, 'heading'); 
                        collect('dt, th', 200, 'term');                     
                        collect('li, td, span, b, strong', 50, 'content'); 
                        collect('p', 10, 'paragraph'); // Paragraphs are last resort

                        // Sort by score descending
                        candidates.sort((a, b) => b.score - a.score);

                        // Pick best
                        if (candidates.length > 0) {
                            el = candidates[0].el;
                            matchInfo = { 
                                type: candidates[0].match, 
                                score: candidates[0].score 
                            };
                        }
                    }

                    if (!el) return false;
                    
                    // Sanity check: If element is huge (like the whole page body or main content div), don't highlight it
                    const rect = el.getBoundingClientRect();
                    if (rect.height > window.innerHeight && el.tagName === 'DIV') {
                        // If it's a huge container, try to find the headers inside it that matched
                        const nestedHeader = el.querySelector('h1, h2, h3, h4, h5, h6');
                        if (nestedHeader) el = nestedHeader;
                    }

                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Highlight with animation & Tooltip
                    const originalOutline = el.style.outline;
                    const originalBg = el.style.backgroundColor;
                    const originalTransition = el.style.transition;
                    const originalPosition = el.style.position || 'static';
                    
                    el.style.transition = 'all 0.5s ease';
                    el.style.outline = '4px solid rgba(74, 222, 128, 0.8)'; // Green success
                    el.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
                    
                    // Visual Label
                    const label = document.createElement('div');
                    
                    let info = '';
                    // 1. Show the search term used
                    const rawSearch = ${JSON.stringify(selector)};
                    const search = rawSearch.replace(/[#.]/g, '').toLowerCase().trim();
                    info += 'Search: "' + search.substring(0, 60) + '"\\n';

                    if (matchInfo.type.includes('selector') || matchInfo.type.includes('id')) {
                        info += 'Match: ' + matchInfo.type + ' (100)';
                    } else if (typeof candidates !== 'undefined' && candidates.length > 0) {
                         // Show top 3 candidates
                         candidates.slice(0, 3).forEach((c, i) => {
                             info += '#' + (i+1) + ' ' + c.el.tagName + ': ' + c.match + ' (' + Math.round(c.score) + ')\\n';
                         });
                    } else {
                        info += 'No candidates found.';
                    }
                    
                    label.innerText = info;
                    label.style.cssText = 'position: absolute; top: -50px; left: 0; background: rgba(0,0,0,0.85); color: #4ade80; font-size: 11px; padding: 6px 10px; border-radius: 6px; z-index: 10000; pointer-events: none; white-space: pre-wrap; font-family: monospace; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid #4ade80;';
                    
                    // Ensure relative positioning
                    if (originalPosition === 'static') {
                        el.style.position = 'relative';
                    }
                    el.appendChild(label);
                    
                    setTimeout(() => {
                        el.style.outline = originalOutline;
                        el.style.backgroundColor = originalBg;
                        el.style.transition = originalTransition;
                        el.style.position = originalPosition;
                        label.remove();
                    }, 4000);

                    // Return the text we found so we can show the user
                    return { success: true, foundText: el.innerText.substring(0, 50) };
                })();
            `);

            if (result && typeof result === 'object' && result.success) {
                return {
                    result: true,
                    foundText: result.foundText
                } as any;
            }
            return result === true;
        } catch {
            return false;
        }
    }

    /**
     * Navigate to a URL
     * Handles raw domains (amazon.com), full URLs, and search queries gracefully.
     */
    private async navigate(url: string): Promise<boolean> {
        if (!this.activeContents) return false;

        try {
            let finalUrl = url.trim();

            // Strip common conversational prefixes the LLM might include
            finalUrl = finalUrl.replace(/^(go\s+to|navigate\s+to|open|visit)\s+/i, '').trim();

            // Check if it looks like a URL (has a dot and no spaces)
            const looksLikeUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(finalUrl);

            if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
                // Already a full URL — use as-is
            } else if (looksLikeUrl) {
                // Looks like a domain (e.g. amazon.com, amazon.in/path) — prepend https
                finalUrl = 'https://' + finalUrl;
            } else if (!finalUrl.startsWith('http')) {
                // Doesn't look like a URL at all — it might be a search query the LLM passed.
                // Prepend https as a best-effort attempt; loadURL will fail gracefully.
                finalUrl = 'https://' + finalUrl;
            }

            // Validate the URL is parseable before loading
            try {
                new URL(finalUrl);
            } catch {
                console.warn(`[ActionExecutor] Invalid URL after normalization: ${finalUrl}`);
                return false;
            }

            await this.activeContents.loadURL(finalUrl);
            return true;
        } catch (error) {
            console.error('[ActionExecutor] Failed to navigate:', error);
            return false;
        }
    }

    /**
     * Type text using Electron's native sendInputEvent (trusted OS-level events)
     * This is the ONLY reliable way to type into Gmail and other rich text editors
     */
    private async typeText(text: string, humanLike: boolean = true): Promise<void> {
        if (!this.activeContents) return;

        console.log(`[ActionExecutor] Typing via native input: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            try {
                // Special character handling
                if (char === '\n') {
                    await this.pressKey('Return');
                } else if (char === '\t') {
                    await this.pressKey('Tab');
                } else {
                    // Send the character as a native keyboard event
                    // keyDown -> char -> keyUp simulates a real keystroke
                    await this.activeContents.sendInputEvent({
                        type: 'keyDown',
                        keyCode: char,
                    });
                    await this.activeContents.sendInputEvent({
                        type: 'char',
                        keyCode: char,
                    });
                    await this.activeContents.sendInputEvent({
                        type: 'keyUp',
                        keyCode: char,
                    });
                }
            } catch (e) {
                console.warn(`[ActionExecutor] Failed to type char '${char}':`, e);
            }

            // Human-like delay between keystrokes
            if (humanLike) {
                const baseDelay = 30 + Math.random() * 70; // 30-100ms
                // Occasional longer pauses (like a human thinking)
                const thinkPause = Math.random() < 0.05 ? 150 + Math.random() * 200 : 0;
                await this.sleep(baseDelay + thinkPause);
            }
        }
    }

    /**
     * Press a special key (Enter, Tab, Backspace, etc.) using native input
     */
    async pressKey(keyCode: string): Promise<boolean> {
        if (!this.activeContents) return false;

        try {
            await this.activeContents.sendInputEvent({ type: 'keyDown', keyCode });
            await this.activeContents.sendInputEvent({ type: 'keyUp', keyCode });
            return true;
        } catch (e) {
            console.error('[ActionExecutor] Failed to press key:', e);
            return false;
        }
    }

    /**
     * Select all and delete content in the currently focused field using native input
     */
    private async clearField(): Promise<void> {
        if (!this.activeContents) return;

        // Cmd+A (Select All) on macOS
        await this.activeContents.sendInputEvent({
            type: 'keyDown',
            keyCode: 'a',
            modifiers: ['meta']
        });
        await this.activeContents.sendInputEvent({
            type: 'keyUp',
            keyCode: 'a',
            modifiers: ['meta']
        });
        await this.sleep(50);

        // Delete the selection
        await this.pressKey('Backspace');
        await this.sleep(50);
    }

    /**
     * Get the bounding rectangle of a field element (runs in renderer, returns coords)
     */
    private async getFieldCoordinates(selectorHint: string): Promise<{ x: number; y: number; found: boolean; isContentEditable: boolean; tagName: string }> {
        if (!this.activeContents) return { x: 0, y: 0, found: false, isContentEditable: false, tagName: '' };

        try {
            const result = await this.activeContents.executeJavaScript(`
                (function() {
                    try {
                        const url = window.location.href;
                        const hint = ${JSON.stringify(selectorHint)};
                        let el = null;

                        // --- GOOGLE SEARCH SPECIFIC FIELD DETECTION ---
                        if (url.includes('google.com') && !url.includes('mail.google.com')) {
                            const hintLower = hint.toLowerCase();
                            if (hintLower.includes('search') || hintLower.includes('name="q"') || hintLower.includes('q') || hintLower.includes('query')) {
                                el = document.querySelector('textarea[name="q"]') ||
                                     document.querySelector('input[name="q"]') ||
                                     document.querySelector('[aria-label="Search"]') ||
                                     document.querySelector('textarea[title="Search"]') ||
                                     document.querySelector('input[title="Search"]');
                            }
                        }

                        // --- GMAIL-SPECIFIC FIELD DETECTION ---
                        if (!el && url.includes('mail.google.com')) {
                            const hintLower = hint.toLowerCase();
                            
                            if (hintLower.includes('to') && !hintLower.includes('subject') && !hintLower.includes('body')) {
                                el = document.querySelector('input[aria-label="To"]') ||
                                     document.querySelector('input[name="to"]') ||
                                     document.querySelector('input[aria-label="To recipients"]') ||
                                     document.querySelector('.agP.aFw input') ||
                                     document.querySelector('div[aria-label="To"] input');
                            }
                            else if (hintLower.includes('subject') || hintLower.includes('subj')) {
                                el = document.querySelector('input[aria-label="Subject"]') ||
                                     document.querySelector('input[name="subjectbox"]') ||
                                     document.querySelector('.aoT input');
                            }
                            else if (hintLower.includes('body') || hintLower.includes('message') || hintLower.includes('content') || hintLower.includes('draft') || hintLower.includes('email')) {
                                el = document.querySelector('div[role="textbox"][contenteditable="true"]') ||
                                     document.querySelector('div[aria-label="Message Body"]') ||
                                     document.querySelector('div[aria-label*="Body"]') ||
                                     document.querySelector('div.Am.Al.editable') ||
                                     document.querySelector('.editable[contenteditable="true"]');
                            }
                        }

                        // --- GENERIC FINDER FALLBACK ---
                        if (!el) {
                            const finder = ${this.getFindElementScript(selectorHint)};
                            el = finder.element;
                        }

                        // --- DRILL DOWN to actual input ---
                        if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) {
                            const inner = el.querySelector('input:not([type="hidden"]), textarea, [contenteditable="true"]');
                            if (inner) el = inner;
                        }

                        if (!el) return { found: false, x: 0, y: 0, isContentEditable: false, tagName: '' };

                        // Scroll into view and get coordinates
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const rect = el.getBoundingClientRect();

                        return {
                            found: true,
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                            isContentEditable: !!el.isContentEditable,
                            tagName: el.tagName
                        };
                    } catch(e) {
                        return { found: false, x: 0, y: 0, isContentEditable: false, tagName: '', error: e.message };
                    }
                })()
            `);

            return result || { x: 0, y: 0, found: false, isContentEditable: false, tagName: '' };
        } catch (e) {
            console.error('[ActionExecutor] getFieldCoordinates error:', e);
            return { x: 0, y: 0, found: false, isContentEditable: false, tagName: '' };
        }
    }

    /**
     * Fill form fields using CDP bridge (primary) or native Electron input (fallback).
     * 
     * CDP Strategy (OpenClaw-inspired):
     * 1. Find element via CDP DOM.querySelector
     * 2. Click/focus via CDP Input.dispatchMouseEvent (trusted)
     * 3. Type via CDP Input.dispatchKeyEvent (trusted, human-like)
     * 4. Verify via CDP Runtime.evaluate
     */
    private async fillFormFields(intent: ApprovedIntent, _level: RetryLevel = RetryLevel.INITIAL): Promise<{ success: boolean; error?: string }> {
        if (!this.activeContents) {
            return { success: false, error: 'No active view' };
        }

        const params = intent.parameters as unknown as FillFormParameters;
        if (!params?.fields || !Array.isArray(params.fields)) {
            return { success: false, error: 'Invalid fill_form parameters' };
        }

        const origin = this.activeContents.getURL();
        const isGmail = origin.includes('mail.google.com');
        const useCDP = cdpBridge.isAttached;

        for (const field of params.fields) {
            if (this.shouldStop) {
                return { success: false, error: 'Stopped by user' };
            }

            // Check for secure credential injection
            if (field.value.startsWith('{{') && field.value.endsWith('}}')) {
                console.log(`[ActionExecutor] Resolving secure credential: ${field.value}`);
                const secret = await agentMemory.getSecureCredential(field.value);
                if (secret) {
                    field.value = secret;
                    // Mark as sensitive to prevent logging
                    (field as any).isSensitive = true;
                } else {
                    console.error(`[ActionExecutor] Secure credential not found: ${field.value}`);
                    return { success: false, error: `Credential not found: ${field.value}` };
                }
            }

            // Safety check: don't fill password fields UNLESS it was a resolved credential
            if (!((field as any).isSensitive) && (/password|passwd|pwd/i.test(field.selectorHint) || /password|passwd|pwd/i.test(field.fieldName))) {
                console.log(`[ActionExecutor] Skipping password field (no credential provided): ${field.fieldName}`);
                continue;
            }

            try {
                console.log(`[ActionExecutor] Filling field: "${field.fieldName}" with hint: "${field.selectorHint}"`);

                if (useCDP) {
                    // ========= CDP PATH (preferred) =========
                    const filled = await this.fillFieldViaCDP(field, isGmail);
                    if (filled) {
                        await agentMemory.recordFormFill(origin, field.fieldName, field.value);
                        console.log(`[ActionExecutor] Successfully filled field via CDP: ${field.fieldName}`);
                        continue;
                    }
                    console.log(`[ActionExecutor] CDP fill failed for ${field.fieldName}, trying fallback`);
                }

                // ========= FALLBACK: sendInputEvent =========
                const coords = await this.getFieldCoordinates(field.selectorHint);

                if (!coords.found) {
                    // Gmail Tab navigation fallback
                    if (isGmail && (field.fieldName.toLowerCase().includes('subject') ||
                        field.fieldName.toLowerCase().includes('body') ||
                        field.fieldName.toLowerCase().includes('message'))) {
                        console.log('[ActionExecutor] Gmail: Tab to next field');
                        await this.pressKey('Tab');
                        await this.sleep(300);
                    } else {
                        return { success: false, error: `Element not found: ${field.selectorHint}` };
                    }
                } else {
                    await this.moveMouseSmoothly(coords.x, coords.y);
                    await this.sleep(100);
                    await this.activeContents.sendInputEvent({
                        type: 'mouseDown',
                        x: Math.round(coords.x),
                        y: Math.round(coords.y),
                        button: 'left',
                        clickCount: 1
                    });
                    await this.activeContents.sendInputEvent({
                        type: 'mouseUp',
                        x: Math.round(coords.x),
                        y: Math.round(coords.y),
                        button: 'left',
                        clickCount: 1
                    });
                    await this.sleep(300);
                }

                await this.clearField();
                await this.sleep(100);
                await this.typeText(field.value, true);
                await this.sleep(200);

                // Auto-submit for search fields
                const isSearch = field.selectorHint?.toLowerCase().includes('search') ||
                    field.fieldName?.toLowerCase().includes('search') ||
                    field.selectorHint?.toLowerCase().includes('[name="q"]');
                if (isSearch) {
                    await this.sleep(200);
                    await this.pressKey('Return');
                    return { success: true };
                }

                await agentMemory.recordFormFill(origin, field.fieldName, field.value);
                console.log(`[ActionExecutor] Successfully filled field: ${field.fieldName}`);

            } catch (error) {
                console.error(`[ActionExecutor] Failed to fill field ${field.fieldName}:`, error);
                return { success: false, error: error instanceof Error ? error.message : 'Fill failed' };
            }
        }

        await this.clearHighlights();
        return { success: true };
    }

    /**
     * Fill a single field using the CDP bridge.
     * Returns true if successful, false to fall back to legacy method.
     */
    private async fillFieldViaCDP(
        field: { fieldName: string; selectorHint: string; value: string },
        isGmail: boolean
    ): Promise<boolean> {
        try {
            // --- OPENCLAW INTEGRATION: CDP Node Support ---
            const cdpMatch = field.selectorHint.match(/\[data-cdp-node="(\d+)"\]/);
            if (cdpMatch && cdpMatch[1]) {
                const nodeId = parseInt(cdpMatch[1], 10);
                console.log(`[ActionExecutor] Filling CDP Node ${nodeId}`);
                
                // Click to focus
                const clicked = await cdpBridge.clickNode(nodeId);
                if (!clicked) return false;
                
                await this.sleep(200);
                await cdpBridge.clearField(); // Requires focus
                await this.sleep(50);
                
                console.log(`[ActionExecutor] Typing via CDP: "${field.value.substring(0, 30)}..."`);
                await cdpBridge.typeText(field.value, true);
                return true;
            }

            // Try Google Search-specific selectors first
            const origin = this.activeContents?.getURL() || '';
            const isGoogleSearch = origin.includes('google.com') && !origin.includes('mail.google.com');
            if (isGoogleSearch) {
                const hintLower = (field.fieldName + ' ' + field.selectorHint).toLowerCase();
                if (hintLower.includes('search') || hintLower.includes('name="q"') || hintLower.includes('query') || hintLower === 'q') {
                    const searchSelectors = [
                        'textarea[name="q"]', 'input[name="q"]',
                        '[aria-label="Search"]', 'textarea[title="Search"]', 'input[title="Search"]'
                    ];
                    for (const sel of searchSelectors) {
                        const el = await cdpBridge.findElement(sel);
                        if (el) {
                            await cdpBridge.click(el.x, el.y);
                            await this.sleep(200);
                            await cdpBridge.clearField();
                            await this.sleep(50);
                            console.log(`[ActionExecutor] Typing via CDP (Google): "${field.value.substring(0, 30)}..."`);
                            await cdpBridge.typeText(field.value, true);
                            await this.sleep(100);
                            return true;
                        }
                    }
                }
            }

            // Try Gmail-specific selectors first
            if (isGmail) {
                const fieldType = this.getGmailFieldType(field.fieldName, field.selectorHint);
                if (fieldType) {
                    const gmailCoords = await cdpBridge.findGmailField(fieldType);
                    if (gmailCoords) {
                        await cdpBridge.click(gmailCoords.x, gmailCoords.y);
                        await this.sleep(200);
                        await cdpBridge.clearField();
                        await this.sleep(50);
                        console.log(`[ActionExecutor] Typing via CDP (Gmail ${fieldType}): "${field.value.substring(0, 30)}..."`);

                        if (fieldType === 'body') {
                            // Gmail body is a contenteditable div — use insertText for reliability
                            await cdpBridge.insertText(field.value);
                        } else {
                            await cdpBridge.typeText(field.value, true);
                        }
                        await this.sleep(100);

                        // Gmail: Tab from subject → body automatically
                        if (fieldType === 'subject' || fieldType === 'to') {
                            console.log(`[ActionExecutor] Gmail: Tab from ${fieldType} to next field`);
                            await cdpBridge.pressKey('Tab');
                            await this.sleep(200);
                        }

                        // Verify via CDP (CSP-safe)
                        await this.verifyCDPFill(field);
                        return true;
                    }

                    // Gmail body fallback: if selectors failed but focus is already
                    // in the body (from Tab after subject), just type directly
                    if (fieldType === 'body') {
                        console.log(`[ActionExecutor] Gmail body selectors failed, typing at current cursor position`);
                        await cdpBridge.insertText(field.value);
                        await this.sleep(100);
                        return true;
                    }
                }
            }

            // Generic selector approach
            const el = await cdpBridge.findElement(field.selectorHint);
            if (el) {
                await cdpBridge.click(el.x, el.y);
                await this.sleep(200);
                await cdpBridge.clearField();
                await this.sleep(50);
                console.log(`[ActionExecutor] Typing via CDP: "${field.value.substring(0, 30)}..."`);
                await cdpBridge.typeText(field.value, true);
                await this.sleep(100);
                await this.verifyCDPFill(field);
                return true;
            }

            // ARIA-based fallback (for when CSS selectors fail on dynamic sites)
            // Extract meaningful ARIA text from field metadata
            let ariaText = field.fieldName || '';
            if (!ariaText || ariaText.length < 2) {
                // Try extracting aria-label value from selector: [aria-label="Search"] -> Search
                const ariaMatch = field.selectorHint.match(/aria-label=["']([^"']+)["']/i);
                const nameMatch = field.selectorHint.match(/name=["']([^"']+)["']/i);
                const placeholderMatch = field.selectorHint.match(/placeholder=["']([^"']+)["']/i);
                ariaText = ariaMatch?.[1] || placeholderMatch?.[1] || nameMatch?.[1] || field.selectorHint.replace(/[#.\[\]="']/g, ' ').replace(/\s+/g, ' ').trim();
            }
            if (ariaText && ariaText.length >= 2) {
                console.log(`[ActionExecutor] CDP CSS fill failed, trying ARIA: "${ariaText}"`);
                const ariaEl = await cdpBridge.findElementByAria(ariaText);
                if (ariaEl) {
                    await cdpBridge.click(ariaEl.x, ariaEl.y);
                    await this.sleep(200);
                    await cdpBridge.clearField();
                    await this.sleep(50);
                    console.log(`[ActionExecutor] Typing via CDP (ARIA): "${field.value.substring(0, 30)}..."`);
                    await cdpBridge.typeText(field.value, true);
                    await this.sleep(100);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.log(`[ActionExecutor] CDP fill error: ${error}`);
            return false;
        }
    }

    /**
     * Determine Gmail field type from field name / selector hint
     */
    private getGmailFieldType(fieldName: string, selectorHint: string): 'to' | 'subject' | 'body' | null {
        const lower = (fieldName + ' ' + selectorHint).toLowerCase();
        if (lower.includes('to') && !lower.includes('body') && !lower.includes('subject')) return 'to';
        if (lower.includes('subject')) return 'subject';
        if (lower.includes('body') || lower.includes('message') || lower.includes('content')) return 'body';
        return null;
    }

    /**
     * Verify that text was filled using CDP evaluate (CSP-safe)
     */
    private async verifyCDPFill(field: { fieldName: string; selectorHint: string; value: string }): Promise<void> {
        try {
            const result = await cdpBridge.evaluate(`
                (function() {
                    var el = document.querySelector('${field.selectorHint.replace(/'/g, "\\'")}');
                    if (!el) return { found: false };
                    var val = el.value || el.innerText || el.textContent || '';
                    return { found: true, hasContent: val.length > 0, preview: val.substring(0, 50) };
                })()
            `);
            if (result) {
                console.log(`[ActionExecutor] CDP verification for "${field.fieldName}":`, result);
            }
        } catch (e) {
            // Verification is optional
        }
    }

    /**
     * Click an element (never submit buttons)
     */
    private async clickElement(intent: ApprovedIntent, level: RetryLevel = RetryLevel.INITIAL): Promise<{ success: boolean; error?: string }> {
        if (!this.activeContents) {
            return { success: false, error: 'No active view' };
        }

        const selector = intent.target.selectorHint || '';
        const description = intent.target.description || '';

        // --- OPENCLAW INTEGRATION: CDP-Based Clicking ---
        // If the selector is a CDP Node ID (from Accessibility Tree), use CDP directly.
        // This bypasses CSP, overlays, and isTrusted checks.
        const cdpMatch = selector.match(/\[data-cdp-node="(\d+)"\]/);
        if (cdpMatch && cdpMatch[1]) {
            const nodeId = parseInt(cdpMatch[1], 10);
            console.log(`[ActionExecutor] Detected CDP Selector: ${nodeId}. Using CDP Bridge.`);
            
            const success = await cdpBridge.clickNode(nodeId);
            if (success) {
                await this.sleep(300); // Wait for DOM to settle
                return { success: true };
            } else {
                // Fallback: try ARIA-based clicking via CDP
                const ariaText = description || selector.replace(/[#.\[\]="']/g, '').trim();
                if (ariaText && cdpBridge.isAttached) {
                    console.log(`[ActionExecutor] CDP node click failed, trying ARIA: "${ariaText}"`);
                    const ariaEl = await cdpBridge.findElementByAria(ariaText);
                    if (ariaEl) {
                        const clicked = await cdpBridge.clickNode(ariaEl.backendNodeId);
                        if (clicked) {
                            await this.sleep(300);
                            return { success: true };
                        }
                    }
                }
                return { success: false, error: 'Failed to click via CDP (Node likely not found or invisible)' };
            }
        }

        // --- CDP ARIA FALLBACK (for sites where CSS selectors fail) ---
        if (cdpBridge.isAttached && level >= RetryLevel.SELECTOR_FALLBACK) {
            // Extract meaningful ARIA text — don't just strip brackets from CSS selectors
            let ariaText = description || '';
            if (!ariaText || ariaText.length < 2) {
                const ariaMatch = selector.match(/aria-label=["']([^"']+)["']/i);
                ariaText = ariaMatch?.[1] || selector.replace(/[#.\[\]="']/g, ' ').replace(/\s+/g, ' ').trim();
            }
            if (ariaText && ariaText.length >= 2) {
                console.log(`[ActionExecutor] Trying CDP ARIA click: "${ariaText}"`);
                const ariaEl = await cdpBridge.findElementByAria(ariaText);
                if (ariaEl) {
                    const clicked = await cdpBridge.clickNode(ariaEl.backendNodeId);
                    if (clicked) {
                        await this.sleep(300);
                        return { success: true };
                    }
                }
            }
        }

        try {
            // Check if it's a blocked button
            const isBlocked = await this.activeContents.executeJavaScript(`
                (async function() {
                    const blockedTypes = ${JSON.stringify(BLOCKED_BUTTON_TYPES)};
                    
                    // --- USE SHARED ROBUST FINDER ---
                    const finder = ${this.getFindElementScript(selector)};
                    let el = finder.element;
                    const strategy = finder.strategy;
                    
                    // Fallback: Gmail Compose Button (Special Case) if finder failed
                    if (!el && ${JSON.stringify(selector)}.toLowerCase().includes('compose')) {
                        // Gmail often uses a div with role=button and text "Compose"
                        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                        el = buttons.find(b => b.innerText.toLowerCase().includes('compose'));
                    }
                    
                    if (!el) return { status: 'not_found' };

                    if (!el.id) {
                        el.id = 'ai-click-target-' + Math.floor(Math.random() * 100000);
                    }
                    
                    const safeSelector = '#' + el.id;
                    const text = el.innerText?.toLowerCase() || el.getAttribute('aria-label') || '';

                    // Check Blocked Patterns (try-catch: el.matches can throw on invalid CSS)
                    for (const blocked of blockedTypes) {
                        try {
                            if (el.matches && el.matches(blocked)) {
                                return { status: 'blocked', selector: safeSelector, text, strategy }; 
                            }
                        } catch(e) {}
                    }

                    // Strict check for "Submit" keywords on generic buttons
                    if ((text.includes('submit') || text.includes('pay') || text.includes('purchase')) && 
                        !text.includes('search') && !text.includes('find') && !text.includes('apply')) {
                        return { status: 'blocked', selector: safeSelector, text, strategy };
                    }

                    return { status: 'allowed', selector: safeSelector, text, strategy }; 
                })();
            `);

            if (isBlocked && isBlocked.status === 'not_found') {
                return { success: false, error: 'Element not found' };
            }

            // Exemption for Search
            let isSearchButton = false;
            if (typeof isBlocked === 'object' && isBlocked.text) {
                const t = isBlocked.text.toLowerCase();
                if (t.includes('search') || t.includes('google') || t.includes('find') || t.includes('go')) {
                    isSearchButton = true;
                }
            }

            if (!isSearchButton && isBlocked.status === 'blocked') {
                return { success: false, error: 'This button type is blocked for safety' };
            }

            const safeSelector = (typeof isBlocked === 'object') ? isBlocked.selector : selector;

            // Highlight before clicking
            await this.highlightElement(safeSelector, 'Clicking...');
            await this.sleep(500);

            // Perform click with Sticky Header Protection and Event Simulation
            const result = await this.activeContents.executeJavaScript(`
                (async function() {
                    const el = document.querySelector(${JSON.stringify(safeSelector)});
                    if (!el) return;
                    
                    const level = ${level};

                    // --- STICKY HEADER PROTECTION ---
                    function isCovered(element) {
                        const rect = element.getBoundingClientRect();
                        const x = rect.left + rect.width / 2;
                        const y = rect.top + rect.height / 2;
                        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
                        
                        const topEl = document.elementFromPoint(x, y);
                        // If top element is not our element OR a descendant OR an ancestor, it's covered
                        if (topEl && topEl !== element && !element.contains(topEl) && !topEl.contains(element)) {
                           // Allow transparent/pointer-events-none overlays
                           const style = window.getComputedStyle(topEl);
                           if (style.pointerEvents !== 'none' && style.opacity !== '0') return true;
                        }
                        return false;
                    }

                    if (isCovered(el)) {
                        el.scrollIntoView({ behavior: 'auto', block: 'center' });
                        await new Promise(r => setTimeout(r, 200));
                        if (isCovered(el)) {
                            window.scrollBy(0, -100); 
                            await new Promise(r => setTimeout(r, 200));
                        }
                    }
                    
                    const rect = el.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;

                    // Level 4: JS Force Click (only used as last resort)
                    if (level >= 4) {
                        el.click();
                        return { success: true, method: 'js_force' };
                    }
                    
                    // Level 3: Pre-interaction (hover, focus) before native click
                    if (level >= 3) {
                         el.focus();
                         el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
                         await new Promise(r => setTimeout(r, 200));
                    }

                    // For levels 0-3, return coordinates for native OS-level input click
                    // This is the most reliable method as it generates trusted events.
                    // DO NOT also dispatch JS click events here — that causes double-clicks
                    // which can toggle buttons/dialogs (open then immediately close).
                    return { success: true, method: 'input_event', x: x, y: y };
                })();
            `);

            if (result && result.method === 'input_event' && result.x && result.y) {
                // Use native input events as the PRIMARY click method (most reliable).
                // The JS events dispatched above serve as pre-interaction (hover, focus)
                // but the actual click should be trusted OS-level input.
                await this.moveMouseSmoothly(result.x, result.y);
                await this.sleep(50);
                await this.activeContents.sendInputEvent({ type: 'mouseDown', x: Math.round(result.x), y: Math.round(result.y), button: 'left', clickCount: 1 });
                await this.activeContents.sendInputEvent({ type: 'mouseUp', x: Math.round(result.x), y: Math.round(result.y), button: 'left', clickCount: 1 });
            }

            // Wait for DOM to settle (compose dialogs, dropdowns, etc.)
            await this.sleep(400);
            await this.clearHighlights();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Click failed' };
        }
    }

    /**
     * Create an action result
     */
    private createResult(
        intent: ApprovedIntent,
        success: boolean,
        error?: string,
        durationMs?: number,
        customData?: any
    ): ActionResult {
        const data = customData || (intent.answer ? { answer: intent.answer } : undefined);
        return {
            success,
            intentId: intent.id,
            executedAt: Date.now(),
            durationMs: durationMs || 0,
            error,
            data,
        };
    }

    /**
     * Log action to memory
     */
    private async logAction(intent: ApprovedIntent, result: ActionResult): Promise<void> {
        const origin = this.activeContents?.getURL() || 'unknown';

        // SANITIZATION: Ensure sensitive data (passwords) is NOT logged
        let safeIntent = intent;
        if (intent.type === 'fill_form') {
            // Clone intent to avoid modifying original reference if used elsewhere
            safeIntent = JSON.parse(JSON.stringify(intent));
            const params = safeIntent.parameters as unknown as FillFormParameters;
            if (params && params.fields) {
                params.fields.forEach(field => {
                    // Redact if it was marked sensitive or looks like a password
                    if ((field as any).isSensitive || /password|passwd|pwd/i.test(field.fieldName)) {
                        field.value = '[REDACTED]';
                    }
                });
            }
        }

        const entry: ActionLogEntry = {
            id: crypto.randomUUID(),
            intentType: safeIntent.type,
            origin,
            targetDescription: safeIntent.target.description,
            approved: true,
            approvedBy: 'user',
            result: result.success ? 'success' : 'failure',
            error: result.error,
            timestamp: Date.now(),
            durationMs: result.durationMs,
        };

        try {
            await agentMemory.logAction(entry);
        } catch (err) {
            console.error('Failed to log action:', err);
        }
    }

    /**
     * Utility sleep function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const actionExecutor = new ActionExecutor();
