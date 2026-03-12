/**
 * CDPBridge — Chrome DevTools Protocol Bridge for Electron
 * 
 * OpenClaw-inspired browser control layer that uses Electron's built-in
 * webContents.debugger API for CDP access. This bypasses all CSP/Trusted Types
 * restrictions since CDP operates at the protocol level, not via script injection.
 * 
 * Key advantages over executeJavaScript:
 * - Bypasses Content Security Policy completely
 * - Trusted keyboard/mouse input (no isTrusted: false)
 * - ARIA-based accessibility tree (no DOM parsing needed)
 * - Reliable on Gmail, banking sites, and other CSP-strict pages
 */

import { WebContents } from 'electron';
import { DOMSnapshot } from './types';

// CDPNode interface omitted — using Accessibility.AXNode directly

interface AXNode {
    nodeId: string;
    ignored: boolean;
    role?: { type: string; value: string };
    name?: { type: string; value: string; sources?: any[] };
    description?: { type: string; value: string };
    value?: { type: string; value: string };
    properties?: Array<{ name: string; value: { type: string; value: any } }>;
    childIds?: string[];
    backendDOMNodeId?: number;
}

interface BoxModel {
    content: number[];  // [x1, y1, x2, y2, x3, y3, x4, y4] quad
    padding: number[];
    border: number[];
    margin: number[];
    width: number;
    height: number;
}

export class CDPBridge {
    private attached = false;
    private webContents: WebContents | null = null;

    /**
     * Attach CDP debugger to a webContents
     */
    async attach(contents: WebContents): Promise<boolean> {
        if (this.attached && this.webContents === contents) {
            return true; // Already attached to this contents
        }

        // Detach from previous if needed
        await this.detach();
        this.webContents = contents;

        try {
            // Attach to CDP 1.3 protocol
            contents.debugger.attach('1.3');
            this.attached = true;
            console.log('[CDPBridge] Attached to webContents via CDP 1.3');
            return true;
        } catch (error: any) {
            // Already attached by another debugger client
            if (error.message?.includes('Already attached')) {
                this.attached = true;
                return true;
            }
            console.error('[CDPBridge] Failed to attach:', error.message);
            this.attached = false;
            return false;
        }
    }

    /**
     * Detach CDP debugger
     */
    async detach(): Promise<void> {
        if (this.attached && this.webContents) {
            try {
                this.webContents.debugger.detach();
            } catch (e) {
                // Already detached
            }
        }
        this.attached = false;
        this.webContents = null;
    }

    /**
     * Send a CDP command. This is the core method.
     */
    private async send(method: string, params?: any): Promise<any> {
        if (!this.attached || !this.webContents) {
            throw new Error('CDPBridge not attached');
        }
        return this.webContents.debugger.sendCommand(method, params);
    }

    // =========================================================================
    // EVALUATION (CSP-safe replacement for executeJavaScript)
    // =========================================================================

    /**
     * Evaluate JavaScript in the page context via CDP Runtime.evaluate.
     * Unlike executeJavaScript, this bypasses Trusted Types CSP.
     */
    async evaluate(expression: string, returnByValue = true): Promise<any> {
        try {
            const result = await this.send('Runtime.evaluate', {
                expression,
                returnByValue,
                awaitPromise: true,
                userGesture: true  // Enables trusted context
            });

            if (result.exceptionDetails) {
                const msg = result.exceptionDetails.exception?.description ||
                    result.exceptionDetails.text || 'Unknown error';
                console.error('[CDPBridge] Eval error:', msg);
                return null;
            }

            return result.result?.value ?? null;
        } catch (error) {
            console.error('[CDPBridge] evaluate failed:', error);
            return null;
        }
    }

    // =========================================================================
    // ACCESSIBILITY TREE (OpenClaw-style ARIA snapshots)
    // =========================================================================

    /**
     * Get the full accessibility tree via CDP.
     * This is the OpenClaw approach — read the page through ARIA, not DOM scraping.
     * Completely immune to CSP/Trusted Types.
     */
    async getAccessibilityTree(): Promise<AXNode[]> {
        try {
            const result = await this.send('Accessibility.getFullAXTree');
            return result.nodes || [];
        } catch (error) {
            console.error('[CDPBridge] getAccessibilityTree failed:', error);
            return [];
        }
    }

    /**
     * Build a compact DOMSnapshot from the accessibility tree + basic page info.
     * Aggressively truncated to fit within GitHub Models' 8000 token limit.
     * Prioritizes interactive elements over text content.
     */
    async getSnapshot(): Promise<DOMSnapshot | null> {
        try {
            // Get page info via evaluate (simple expressions don't trigger CSP)
            const pageInfo = await this.evaluate(`({
                url: document.location.href,
                title: document.title
            })`);

            if (!pageInfo) {
                return null;
            }

            // Get accessibility tree
            const axTree = await this.getAccessibilityTree();

            // Caps to keep snapshot small (GitHub gpt-4o has 8000 token limit)
            const MAX_INTERACTIVE = 50;
            const MAX_BUTTONS = 30;
            const MAX_FORM_FIELDS = 20;
            const MAX_TEXT_CHARS = 1500;
            const MAX_BOX_MODEL_LOOKUPS = 30; // Box model calls are expensive

            // Build interactive elements, form fields, buttons from AX tree
            const interactive: DOMSnapshot['interactive'] = [];
            const formFields: DOMSnapshot['formFields'] = [];
            const buttons: DOMSnapshot['buttons'] = [];
            const textParts: string[] = [];
            let boxModelLookups = 0;

            for (const node of axTree) {
                if (node.ignored) continue;

                const role = node.role?.value || '';
                const name = node.name?.value || '';
                const value = node.value?.value || '';
                const description = node.description?.value || '';

                // Collect text content (limited)
                if (name && role !== 'none' && role !== 'presentation' && textParts.length < 100) {
                    // Only add unique, meaningful text (skip short labels)
                    if (name.length > 2 && !textParts.includes(name)) {
                        textParts.push(name.substring(0, 80));
                    }
                }

                // Skip non-interactive nodes early
                if (!this.isInteractiveRole(role)) continue;

                // Stop adding elements once we hit caps
                if (interactive.length >= MAX_INTERACTIVE) continue;

                // Get bounding box for interactive elements (limited lookups)
                let rect = { x: 0, y: 0, width: 0, height: 0 };
                if (node.backendDOMNodeId && boxModelLookups < MAX_BOX_MODEL_LOOKUPS) {
                    try {
                        const box = await this.getBoxModel(node.backendDOMNodeId);
                        boxModelLookups++;
                        if (box) {
                            rect = {
                                x: box.content[0],
                                y: box.content[1],
                                width: box.width,
                                height: box.height
                            };
                        }
                    } catch (e) {
                        // Element may not be visible
                    }
                }

                // Minimal selector
                const selector = node.backendDOMNodeId
                    ? `[data-cdp-node="${node.backendDOMNodeId}"]`
                    : `aria/${name}`;

                // Add to interactive list (compact: minimal attributes)
                interactive.push({
                    selector,
                    role,
                    text: name.substring(0, 60),
                    label: (description || name).substring(0, 60),
                    rect,
                    attributes: {},  // Skip attributes to save tokens
                    isVisible: rect.width > 0 && rect.height > 0,
                    isCovered: false
                });

                // Categorize: form field or button
                if (this.isFormFieldRole(role) && formFields.length < MAX_FORM_FIELDS) {
                    formFields.push({
                        selector,
                        type: this.mapRoleToType(role),
                        name: name.substring(0, 40),
                        label: (description || name).substring(0, 40),
                        value: value ? value.substring(0, 30) : undefined
                    });
                }

                if (this.isButtonRole(role) && buttons.length < MAX_BUTTONS) {
                    buttons.push({
                        selector,
                        text: name.substring(0, 40),
                        type: role === 'link' ? 'link' : 'button',
                        rect
                    });
                }
            }

            // Truncate text content aggressively
            const textContent = textParts.join('\n').slice(0, MAX_TEXT_CHARS);
            console.log(`[CDPBridge] Snapshot: ${interactive.length} interactive, ${buttons.length} buttons, ${formFields.length} fields, ${textContent.length} chars text`);

            return {
                url: pageInfo.url,
                title: pageInfo.title,
                textContent,
                formFields,
                buttons,
                interactive
            };
        } catch (error) {
            console.error('[CDPBridge] getSnapshot failed:', error);
            return null;
        }
    }

    // =========================================================================
    // INPUT EVENTS (trusted keyboard/mouse via CDP)
    // =========================================================================

    /**
     * Click at coordinates using CDP Input domain.
     * These are trusted OS-level events.
     */
    async click(x: number, y: number): Promise<void> {
        await this.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x, y,
            button: 'left',
            clickCount: 1
        });
        await this.sleep(50);
        await this.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x, y,
            button: 'left',
            clickCount: 1
        });
    }

    /**
     * Click a node by backendDOMNodeId using trusted CDP events.
     * This bypasses CSP, overlays, and isTrusted checks.
     */
    async clickNode(backendNodeId: number): Promise<boolean> {
        try {
            // Scroll into view BEFORE getting box model — element may be off-screen
            try {
                await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
                await this.sleep(150);
            } catch (e) {
                // Fallback: try focus to bring into view
                try { await this.send('DOM.focus', { backendNodeId }); } catch (_) { /* ignore */ }
                await this.sleep(150);
            }

            const box = await this.getBoxModel(backendNodeId);
            if (!box) {
                console.warn(`[CDPBridge] Could not get box model for node ${backendNodeId}`);
                return false;
            }

            // Calculate center
            const x = box.content[0] + (box.width / 2);
            const y = box.content[1] + (box.height / 2);

            // Validate coordinates are in viewport
            if (x <= 0 || y <= 0) {
                console.warn(`[CDPBridge] Node ${backendNodeId} has invalid coords (${x},${y}), retrying scroll`);
                try {
                    await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
                    await this.sleep(200);
                    const box2 = await this.getBoxModel(backendNodeId);
                    if (box2) {
                        const x2 = box2.content[0] + (box2.width / 2);
                        const y2 = box2.content[1] + (box2.height / 2);
                        if (x2 > 0 && y2 > 0) {
                            console.log(`[CDPBridge] Clicking node ${backendNodeId} at ${x2},${y2} (after re-scroll)`);
                            await this.click(x2, y2);
                            await this.sleep(100);
                            return true;
                        }
                    }
                } catch (_) { /* fall through */ }
                return false;
            }

            console.log(`[CDPBridge] Clicking node ${backendNodeId} at ${x},${y}`);
            await this.click(x, y);
            await this.sleep(100); // Let DOM settle after click
            return true;
        } catch (error) {
            console.error(`[CDPBridge] Failed to click node ${backendNodeId}:`, error);
            return false;
        }
    }

    /**
     * Type text character by character using CDP Input domain.
     * Human-like delays. These are trusted events that bypass CSP.
     * 
     * CDP key event model:
     * - rawKeyDown: physical key press (does NOT insert text)
     * - char: text insertion event (this is what actually types the character)
     * - keyUp: key release
     * 
     * IMPORTANT: Using 'keyDown' (not 'rawKeyDown') with a `text` field also
     * inserts text, so combining keyDown+char causes DOUBLE insertion.
     * We use rawKeyDown + char + keyUp to match real browser behavior.
     */
    async typeText(text: string, humanLike = true): Promise<void> {
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '\n') {
                await this.pressKey('Enter');
            } else if (char === '\t') {
                await this.pressKey('Tab');
            } else {
                // rawKeyDown — physical key press, no text insertion
                await this.send('Input.dispatchKeyEvent', {
                    type: 'rawKeyDown',
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    windowsVirtualKeyCode: char.charCodeAt(0),
                    nativeVirtualKeyCode: char.charCodeAt(0)
                });
                // char — this is the event that actually inserts the character
                await this.send('Input.dispatchKeyEvent', {
                    type: 'char',
                    key: char,
                    text: char,
                    unmodifiedText: char
                });
                // keyUp — key release, no text fields needed
                await this.send('Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    windowsVirtualKeyCode: char.charCodeAt(0),
                    nativeVirtualKeyCode: char.charCodeAt(0)
                });
            }

            // Human-like delays
            if (humanLike) {
                const baseDelay = 30 + Math.random() * 70; // 30-100ms
                const thinkPause = Math.random() < 0.1 ? 200 + Math.random() * 300 : 0;
                await this.sleep(baseDelay + thinkPause);
            }
        }
    }

    /**
     * Insert text directly using CDP Input.insertText.
     * This is more reliable than typeText for contenteditable elements
     * (like Gmail compose body, rich text editors, etc.) because it bypasses
     * the keyboard event pipeline entirely and inserts text at the cursor.
     * 
     * For regular <input>/<textarea> fields, use typeText instead.
     */
    async insertText(text: string): Promise<void> {
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > 0) {
                await this.send('Input.insertText', { text: lines[i] });
            }
            if (i < lines.length - 1) {
                await this.pressKey('Enter');
                // Allow the editor to create the new element (e.g. <div><br></div>)
                await this.sleep(30);
            }
        }
    }

    /**
     * Press a special key (Enter, Tab, Backspace, etc.)
     */
    async pressKey(key: string, modifiers?: string[]): Promise<void> {
        const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
            'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
            'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
            'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
            'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
            'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
            'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
            'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
            'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
            'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        };

        const mapped = keyMap[key] || { key, code: key, keyCode: 0 };
        const cdpModifiers = this.toCDPModifiers(modifiers || []);

        await this.send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            key: mapped.key,
            code: mapped.code,
            windowsVirtualKeyCode: mapped.keyCode,
            nativeVirtualKeyCode: mapped.keyCode,
            modifiers: cdpModifiers
        });
        await this.sleep(30);
        await this.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: mapped.key,
            code: mapped.code,
            windowsVirtualKeyCode: mapped.keyCode,
            nativeVirtualKeyCode: mapped.keyCode,
            modifiers: cdpModifiers
        });
    }

    /**
     * Select all text and delete (Cmd+A → Backspace)
     */
    async clearField(): Promise<void> {
        // Cmd+A (Mac) / Ctrl+A (Other)
        await this.send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            key: 'a',
            code: 'KeyA',
            windowsVirtualKeyCode: 65,
            modifiers: 4  // 4 = Meta (Cmd on Mac)
        });
        await this.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'a',
            code: 'KeyA',
            windowsVirtualKeyCode: 65,
            modifiers: 4
        });
        await this.sleep(50);
        await this.pressKey('Backspace');
    }

    // =========================================================================
    // ELEMENT INTERACTION (find + click/type by ARIA)
    // =========================================================================

    /**
     * Focus an element by backendNodeId and get its location.
     * Returns coordinates for clicking.
     */
    async focusAndGetRect(backendNodeId: number): Promise<{ x: number; y: number; width: number; height: number } | null> {
        try {
            // Resolve to DOM nodeId first
            await this.send('DOM.resolveNode', { backendNodeId });

            // Focus it
            await this.send('DOM.focus', { backendNodeId });

            // Scroll into view
            await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
            await this.sleep(100);

            // Get box model
            const box = await this.getBoxModel(backendNodeId);
            if (!box) return null;

            return {
                x: box.content[0],
                y: box.content[1],
                width: box.width,
                height: box.height
            };
        } catch (error) {
            console.error('[CDPBridge] focusAndGetRect failed:', error);
            return null;
        }
    }

    /**
     * Find an element by CSS selector and return its backendNodeId + rect
     */
    async findElement(selector: string): Promise<{ backendNodeId: number; x: number; y: number; width: number; height: number } | null> {
        try {
            // Get the document root
            const { root } = await this.send('DOM.getDocument', { depth: 0 });

            // Query selector
            let { nodeId } = await this.send('DOM.querySelector', {
                nodeId: root.nodeId,
                selector
            });

            // Fallback: swap input <-> textarea (Google changed search from input to textarea)
            if ((!nodeId || nodeId === 0) && /^(input|textarea)\b/i.test(selector)) {
                const swapped = selector.startsWith('input')
                    ? selector.replace(/^input/i, 'textarea')
                    : selector.replace(/^textarea/i, 'input');
                console.log(`[CDPBridge] Selector "${selector}" not found, trying "${swapped}"`);
                const fallback = await this.send('DOM.querySelector', {
                    nodeId: root.nodeId,
                    selector: swapped
                });
                if (fallback?.nodeId && fallback.nodeId !== 0) {
                    nodeId = fallback.nodeId;
                }
            }

            if (!nodeId || nodeId === 0) return null;

            // Get backend node ID for stable reference
            const { node } = await this.send('DOM.describeNode', { nodeId });

            // Scroll into view
            try {
                await this.send('DOM.scrollIntoViewIfNeeded', { nodeId });
            } catch (e) { /* may not be needed */ }
            await this.sleep(100);

            // Get box model
            const boxResult = await this.send('DOM.getBoxModel', { nodeId });
            if (!boxResult?.model) return null;

            const content = boxResult.model.content;
            return {
                backendNodeId: node.backendNodeId,
                x: (content[0] + content[2]) / 2,  // center X
                y: (content[1] + content[5]) / 2,  // center Y
                width: content[2] - content[0],
                height: content[5] - content[1]
            };
        } catch (error) {
            console.error('[CDPBridge] findElement failed:', error);
            return null;
        }
    }

    /**
     * Find element by ARIA label or text using the Accessibility Tree.
     * Fallback for when CSS selectors fail on CSP-strict sites.
     */
    async findElementByAria(searchText: string): Promise<{ backendNodeId: number; x: number; y: number; width: number; height: number } | null> {
        try {
            const axTree = await this.getAccessibilityTree();
            const search = searchText.toLowerCase().trim();

            // Score candidates
            const candidates: { node: AXNode; score: number }[] = [];

            for (const node of axTree) {
                if (node.ignored) continue;
                const role = node.role?.value || '';
                const name = (node.name?.value || '').toLowerCase();
                const description = (node.description?.value || '').toLowerCase();

                if (!name && !description) continue;

                let score = 0;

                // Exact match
                if (name === search || description === search) {
                    score = 100;
                }
                // Starts with
                else if (name.startsWith(search) || description.startsWith(search)) {
                    score = 80;
                }
                // Contains
                else if (name.includes(search) || description.includes(search)) {
                    score = 50;
                }

                if (score <= 0) continue;

                // Boost interactive roles
                if (this.isInteractiveRole(role)) score += 20;
                if (this.isButtonRole(role)) score += 15;
                // Penalize generic roles
                if (role === 'generic' || role === 'none' || role === 'presentation') score -= 30;

                candidates.push({ node, score });
            }

            // Sort by score descending
            candidates.sort((a, b) => b.score - a.score);

            // Try each candidate until we find one with valid coordinates
            for (const candidate of candidates.slice(0, 5)) {
                const node = candidate.node;
                if (!node.backendDOMNodeId) continue;

                try {
                    await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: node.backendDOMNodeId });
                    await this.sleep(100);
                } catch (_) { /* ignore */ }

                const box = await this.getBoxModel(node.backendDOMNodeId);
                if (box && box.width > 0 && box.height > 0) {
                    return {
                        backendNodeId: node.backendDOMNodeId,
                        x: box.content[0] + (box.width / 2),
                        y: box.content[1] + (box.height / 2),
                        width: box.width,
                        height: box.height
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('[CDPBridge] findElementByAria failed:', error);
            return null;
        }
    }

    /**
     * Click an element by CSS selector, with ARIA fallback
     */
    async clickElement(selector: string): Promise<boolean> {
        // Strategy 1: CSS selector
        const el = await this.findElement(selector);
        if (el) {
            await this.click(el.x, el.y);
            await this.sleep(100);
            return true;
        }

        // Strategy 2: ARIA-based text search (fallback for dynamic/CSP sites)
        const cleanText = selector.replace(/[#.[\]="']/g, '').trim();
        if (cleanText) {
            console.log(`[CDPBridge] CSS selector failed, trying ARIA search: "${cleanText}"`);
            const ariaEl = await this.findElementByAria(cleanText);
            if (ariaEl) {
                await this.click(ariaEl.x, ariaEl.y);
                await this.sleep(100);
                return true;
            }
        }

        return false;
    }

    /**
     * Type into an element: find → click → clear → type
     */
    async typeIntoElement(selector: string, text: string): Promise<boolean> {
        const el = await this.findElement(selector);
        if (!el) return false;

        // Click to focus
        await this.click(el.x, el.y);
        await this.sleep(100);

        // Clear existing content
        await this.clearField();
        await this.sleep(50);

        // Type the text
        await this.typeText(text, true);
        return true;
    }

    // =========================================================================
    // GMAIL-SPECIFIC HELPERS
    // =========================================================================

    /**
     * Find Gmail compose fields using ARIA labels.
     * This works even when CSS selectors fail due to Gmail's obfuscated IDs.
     */
    async findGmailField(fieldType: 'to' | 'subject' | 'body'): Promise<{ x: number; y: number } | null> {
        const selectors: Record<string, string[]> = {
            'to': [
                'input[aria-label="To"]',
                'input[aria-label="To recipients"]',
                'input[name="to"]',
                'input[role="combobox"][aria-autocomplete="list"]'
            ],
            'subject': [
                'input[name="subjectbox"]',
                'input[aria-label="Subject"]',
                'input[placeholder="Subject"]'
            ],
            'body': [
                'div[role="textbox"][aria-label="Message Body"]',
                'div[role="textbox"][g_editable="true"]',
                'div[aria-label="Message Body"]',
                'div[aria-label="Message Body"] div[contenteditable="true"]',
                'div.editable[contenteditable="true"][g_editable="true"]',
                'div[role="textbox"][contenteditable="true"]',
                'div.editable[contenteditable="true"]'
            ]
        };

        for (const sel of selectors[fieldType] || []) {
            const el = await this.findElement(sel);
            if (el) {
                return { x: el.x, y: el.y };
            }
        }
        return null;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private async getBoxModel(backendNodeId: number): Promise<BoxModel | null> {
        try {
            const result = await this.send('DOM.getBoxModel', { backendNodeId });
            if (!result?.model) return null;
            return result.model;
        } catch {
            return null;
        }
    }

    private isInteractiveRole(role: string): boolean {
        return [
            'button', 'link', 'textbox', 'searchbox', 'combobox',
            'checkbox', 'radio', 'switch', 'slider', 'spinbutton',
            'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
            'option', 'treeitem'
        ].includes(role);
    }

    private isFormFieldRole(role: string): boolean {
        return ['textbox', 'searchbox', 'combobox', 'checkbox', 'radio',
            'switch', 'slider', 'spinbutton'].includes(role);
    }

    private isButtonRole(role: string): boolean {
        return ['button', 'link', 'tab', 'menuitem'].includes(role);
    }

    private mapRoleToType(role: string): string {
        const map: Record<string, string> = {
            'textbox': 'text',
            'searchbox': 'search',
            'combobox': 'select',
            'checkbox': 'checkbox',
            'radio': 'radio',
            'switch': 'checkbox',
            'slider': 'range',
            'spinbutton': 'number'
        };
        return map[role] || 'text';
    }

    private toCDPModifiers(modifiers: string[]): number {
        let flags = 0;
        for (const mod of modifiers) {
            switch (mod.toLowerCase()) {
                case 'alt': flags |= 1; break;
                case 'ctrl': case 'control': flags |= 2; break;
                case 'meta': case 'cmd': case 'command': flags |= 4; break;
                case 'shift': flags |= 8; break;
            }
        }
        return flags;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if bridge is currently attached
     */
    get isAttached(): boolean {
        return this.attached;
    }
}

// Singleton instance
export const cdpBridge = new CDPBridge();
