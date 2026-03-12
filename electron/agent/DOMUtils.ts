/**
 * DOM Utils
 * 
 * Shared helper scripts for DOM manipulation and traversal.
 * Centralizes logic for Shadow DOM, visibility checking, and element finding.
 * These scripts are injected into the renderer process.
 *
 * CRITICAL: Every function that runs in renderer context MUST be crash-proof.
 * Gmail, Outlook, and other complex apps have elements with special characters
 * in IDs, SVG elements with non-string classNames, cross-origin iframes, etc.
 * A single uncaught exception kills the entire injected script.
 */

export const DOM_HELPERS = `
    // --- HELPER: Shadow DOM Traversal ---
    
    /**
     * Recursively find all elements matching a selector, piercing Shadow DOMs and Iframes
     */
    function deepQueryAll(root, selector) {
        let results = [];
        try {
            results = Array.from(root.querySelectorAll(selector));
        } catch(e) { return results; }
        
        // Only check direct children for shadow roots/iframes to limit depth
        try {
            root.querySelectorAll('*').forEach(el => {
                try {
                    if (el.shadowRoot) {
                        results = results.concat(deepQueryAll(el.shadowRoot, selector));
                    }
                    if (el.tagName === 'IFRAME') {
                        try {
                            const doc = el.contentDocument;
                            if (doc) {
                                results = results.concat(deepQueryAll(doc, selector));
                            }
                        } catch (e) { /* Cross-origin blocked */ }
                    }
                } catch(e) {}
            });
        } catch(e) {}
        return results;
    }

    /**
     * Find a single element satisfying a predicate, piercing Shadow DOMs and Iframes
     */
    function findInShadows(predicate, root = document) {
        try {
            const all = root.querySelectorAll('*');
            for (const el of all) {
                try {
                    if (predicate(el)) return el;
                } catch(e) {}
                try {
                    if (el.shadowRoot) {
                        const found = findInShadows(predicate, el.shadowRoot);
                        if (found) return found;
                    }
                    if (el.tagName === 'IFRAME') {
                        try {
                            const doc = el.contentDocument;
                            if (doc) {
                                const found = findInShadows(predicate, doc);
                                if (found) return found;
                            }
                        } catch (e) { /* Cross-origin blocked */ }
                    }
                } catch(e) {}
            }
        } catch(e) {}
        return null;
    }

    /**
     * Get all interactive elements across all Shadow DOMs and Iframes
     * Performance: limits traversal depth and caps element count
     */
    function getAllInteractive(root, depth = 0) {
        if (depth > 3) return []; // Prevent infinite recursion
        
        const selector = 'a, button, input, select, textarea, [contenteditable], [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="option"], [role="switch"], [role="combobox"], [role="textbox"], [tabindex]:not([tabindex="-1"]), label, span[onclick], div[onclick], div[role="button"], div[role="textbox"], div[contenteditable="true"], h1, h2, h3';
        let items = [];
        try {
            items = Array.from(root.querySelectorAll(selector));
        } catch(e) { return items; }
        
        // Only traverse shadow roots and iframes if we haven't gone too deep
        if (depth < 2) {
            try {
                const allEls = root.querySelectorAll('*');
                // Cap iteration to prevent performance issues on huge pages
                const maxCheck = Math.min(allEls.length, 5000);
                for (let i = 0; i < maxCheck; i++) {
                    try {
                        const el = allEls[i];
                        if (el.shadowRoot) {
                            items = items.concat(getAllInteractive(el.shadowRoot, depth + 1));
                        }
                        if (el.tagName === 'IFRAME') {
                            try {
                                const doc = el.contentDocument;
                                if (doc) {
                                    items = items.concat(getAllInteractive(doc, depth + 1));
                                }
                            } catch (e) { /* Cross-origin blocked */ }
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }
        return items;
    }

    // --- HELPER: Visibility Check ---
    function isEffectivelyVisible(el) {
        try {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            
            // Check if covered (only for elements in viewport)
            if (rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth) {
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                let topEl = document.elementFromPoint(centerX, centerY);
                
                if (topEl) {
                    if (topEl === el || el.contains(topEl) || topEl.contains(el)) return true;
                    
                    // Shadow DOM check
                    let current = el;
                    while (current && current.parentNode) {
                        if (current.parentNode instanceof ShadowRoot) {
                            if (current.parentNode.host === topEl) return true;
                            current = current.parentNode.host;
                        } else {
                            current = current.parentNode;
                        }
                    }
                }
                return false;
            }
            
            return true;
        } catch(e) {
            return false; // If we can't determine visibility, skip element
        }
    }

    // --- HELPER: Safe CSS ID Escape ---
    // Gmail IDs contain ":" and other special chars that break querySelector
    function safeCSSId(id) {
        if (!id) return '';
        // Use CSS.escape if available (modern browsers), otherwise manual escape
        if (typeof CSS !== 'undefined' && CSS.escape) {
            return CSS.escape(id);
        }
        return id.replace(/([\\[\\].:,#()'"~!@$%^&*=+|<>{}\\/ ])/g, '\\\\$1');
    }

    // --- HELPER: Accessibility Label ---
    function getAccessibleLabel(el) {
        try {
            let label = el.getAttribute('aria-label') || '';
            
            // innerText can be expensive; only use on small elements
            if (!label) {
                try {
                    const text = el.innerText;
                    if (text && text.length < 500) label = text;
                } catch(e) {}
            }
            
            if (!label && el.id) {
                try {
                    const escapedId = safeCSSId(el.id);
                    const labelEl = document.querySelector('label[for="' + escapedId + '"]');
                    if (labelEl) label = labelEl.innerText || '';
                } catch(e) { /* ID contains chars that can't be escaped */ }
            }
            if (!label) {
                try {
                    const parentLabel = el.closest('label');
                    if (parentLabel) label = parentLabel.innerText || '';
                } catch(e) {}
            }
            if (!label) label = el.getAttribute('title') || '';
            if (!label) label = el.getAttribute('placeholder') || '';
            return (label || '').trim().substring(0, 500);
        } catch(e) {
            return '';
        }
    }

    // --- HELPER: Safe className extraction ---
    function safeClassName(el) {
        try {
            if (typeof el.className === 'string' && el.className) {
                return '.' + el.className.split(' ').filter(Boolean).join('.');
            }
        } catch(e) {}
        return '';
    }
`;

/**
 * Generate the script to find a specific element
 */
export function getFindElementScript(selector: string, blockedButtonTypes: string[] = []): string {
    return `
        (function() {
            ${DOM_HELPERS}

            const selector = ${JSON.stringify(selector)};
            const blockedTypes = ${JSON.stringify(blockedButtonTypes)};
            
            let el = null;
            let matchType = 'none';

            // --- STRATEGY 1: EXACT SELECTOR (Deep) ---
            try {
                if (selector) {
                    el = document.querySelector(selector);
                    if (!el) {
                        const all = deepQueryAll(document, selector);
                        if (all.length > 0) el = all[0];
                    }
                    // Fallback: swap input <-> textarea (Google changed search from input to textarea)
                    if (!el && /^(input|textarea)\b/i.test(selector)) {
                        const swapped = selector.startsWith('input')
                            ? selector.replace(/^input/i, 'textarea')
                            : selector.replace(/^textarea/i, 'input');
                        el = document.querySelector(swapped);
                        if (!el) {
                            const all = deepQueryAll(document, swapped);
                            if (all.length > 0) el = all[0];
                        }
                    }
                    if (el) matchType = 'selector';
                }
            } catch (e) {}

            // --- STRATEGY 2: ID HEURISTICS ---
            if (!el) {
                try {
                    const cleanName = selector.replace(/[#.]/g, '').trim();
                    const idVariants = [
                        cleanName,
                        cleanName.replace(/ /g, '_'),
                        cleanName.replace(/ /g, '-'),
                        'btn-' + cleanName,
                        'button-' + cleanName
                    ];
                    for (const id of idVariants) {
                         el = document.getElementById(id);
                         if (!el) {
                             el = findInShadows(n => n.id === id);
                         }
                         if (el) { matchType = 'id'; break; }
                    }
                } catch(e) {}
            }

            // --- STRATEGY 3: ACCESSIBILITY (ARIA) ---
            if (!el) {
                 try {
                     const cleanName = selector.replace(/[#.]/g, '').replace(/"/g, '\\\\"').trim();
                     el = findInShadows(n => n.getAttribute('aria-label') === cleanName);
                     if (el) matchType = 'aria-label';
                     
                     if (!el) {
                        el = findInShadows(n => n.getAttribute('name') === cleanName);
                        if (el) matchType = 'name';
                     }
                     // Partial aria-label match (e.g. search for "Compose" matches aria-label="Compose new message")
                     if (!el && cleanName.length >= 3) {
                        const lowerClean = cleanName.toLowerCase();
                        el = findInShadows(n => {
                            const ariaLabel = (n.getAttribute('aria-label') || '').toLowerCase();
                            return ariaLabel && (ariaLabel.includes(lowerClean) || lowerClean.includes(ariaLabel));
                        });
                        if (el) matchType = 'aria-label-partial';
                     }

                     // ARIA role-based search (Gmail Compose is div[role="button"] with text)
                     if (!el && cleanName.length >= 2) {
                        const lowerClean = cleanName.toLowerCase();
                        const roleElements = deepQueryAll(document, '[role="button"], [role="menuitem"], [role="tab"], [role="link"]');
                        for (const re of roleElements) {
                            try {
                                const reText = (re.innerText || re.textContent || '').toLowerCase().trim();
                                if (reText === lowerClean || reText.includes(lowerClean)) {
                                    if (isEffectivelyVisible(re)) {
                                        el = re;
                                        matchType = 'aria-role-text';
                                        break;
                                    }
                                }
                            } catch(e) {}
                        }
                     }                 } catch(e) {}
            }

            // --- STRATEGY 4: ROBUST TEXT SEARCH ---
            if (!el) {
                try {
                    const search = selector.replace(/[#.]/g, '').toLowerCase().trim();
                    const targets = getAllInteractive(document);
                    
                    let bestCandidate = null;
                    let bestScore = 0;

                    targets.forEach(e => {
                        try {
                            if (!isEffectivelyVisible(e)) return;
                            
                            const text = (e.innerText || '').toLowerCase().trim();
                            const label = (e.getAttribute('aria-label') || '').toLowerCase().trim();
                            const placeholder = (e.getAttribute('placeholder') || '').toLowerCase().trim();
                            const value = (e.getAttribute('value') || '').toLowerCase().trim();
                            const title = (e.getAttribute('title') || '').toLowerCase().trim();
                            
                            let score = 0;
                            let matchedOn = '';

                            if (text === search || label === search || value === search || placeholder === search || title === search) {
                                score = 100;
                                matchedOn = 'exact';
                            }
                            else if (text.startsWith(search) || label.startsWith(search)) {
                                score = 80;
                                matchedOn = 'starts-with';
                            }
                            else if (text.includes(search) || label.includes(search) || value.includes(search) || placeholder.includes(search)) {
                                score = 50;
                                matchedOn = 'includes';
                                 if (text.length > 100) score -= 20;
                            }
                            
                            if (score > 0) {
                                if (e.tagName === 'BUTTON' || e.tagName === 'A' || e.getAttribute('role') === 'button') score += 10;
                                if (e.tagName === 'INPUT' && (e.type === 'submit' || e.type === 'button')) score += 10;
                                
                                // Boost for "Compose" buttons (Gmail etc)
                                if (text.includes('compose') && (e.getAttribute('role') === 'button' || e.tagName === 'DIV')) {
                                    score += 25;
                                }

                                // Boost for role=button divs (common in modern web apps)
                                if (e.getAttribute('role') === 'button' && e.tagName === 'DIV') {
                                    score += 10;
                                }
                                
                                // Boost for ContentEditable if searching for input-like terms
                                if (e.isContentEditable && (search.includes('body') || search.includes('message') || search.includes('content') || search.includes('draft') || search.includes('textbox'))) {
                                    score += 25;
                                }

                                // Boost for role=textbox (Gmail body, Outlook, etc.)
                                if (e.getAttribute('role') === 'textbox') {
                                    score += 15;
                                }

                                // Small size means more specific element (better target)
                                if (text.length < 30) score += 5;
                            }

                            if (score > 40 && score > bestScore) {
                                bestScore = score;
                                bestCandidate = { el: e, score, matchedOn };
                            }
                        } catch(e) {} // Skip elements that throw
                    });
                    
                    if (bestCandidate) {
                        el = bestCandidate.el;
                        matchType = 'text-fuzzy (' + bestCandidate.matchedOn + ')';
                    }
                } catch(e) {}
            }

            if (!el) return { element: null, strategy: 'none' };

            // --- VALIDATION & ASSIGNMENT ---
            if (!el.id) {
                el.id = 'ai-click-target-' + Math.floor(Math.random() * 100000);
            }
            
            const safeSelector = '#' + safeCSSId(el.id);
            const text = el.innerText?.toLowerCase() || el.getAttribute('aria-label') || '';

            // Check Blocked Patterns
            for (const blocked of blockedTypes) {
                try {
                    if (el.matches && el.matches(blocked)) {
                        return { status: 'blocked', selector: safeSelector, text, strategy: matchType }; 
                    }
                } catch(e) {}
            }
            
            // Allow "Apply" but block generic "Submit"
            // RELAXED: Allow "submit" as AI needs to submit forms. Blocking only financial keywords.
            if ((text.includes('pay') || text.includes('purchase') || text.includes('checkout')) && 
                !text.includes('search') && !text.includes('find') && !text.includes('apply')) {
                return { status: 'blocked', selector: safeSelector, text, strategy: matchType };
            }

            return { element: el, status: 'allowed', selector: safeSelector, text, strategy: matchType }; 
        })()
    `;
}

/**
 * Generate the script to read a page snapshot
 */
export function getSnapshotScript(blockedSelectors: string[]): string {
    return `
        (function() {
            try {
                ${DOM_HELPERS}
                
                const blockedSelectors = ${JSON.stringify(blockedSelectors)};
                const interactive = [];
                const formFields = [];
                const buttons = [];

                // Get all interactive elements including from Shadow DOM
                const allElements = getAllInteractive(document);

                allElements.forEach(el => {
                    try {
                        // Skip blocked
                        try {
                            if (blockedSelectors.some(sel => el.matches && el.matches(sel))) return;
                        } catch(e) {}
                        
                        if (!isEffectivelyVisible(el)) return;

                        const tagName = el.tagName.toLowerCase();
                        const type = el.getAttribute('type') || tagName;
                        const role = el.getAttribute('role') || tagName;
                        const label = getAccessibleLabel(el);
                        const rect = el.getBoundingClientRect();

                        // Populate Interactive List
                        // IMPROVED SELECTOR GENERATION: Prefer aria-label for stability in apps like Gmail
                        let stableSelector = tagName;
                        if (el.id) {
                            stableSelector += '#' + safeCSSId(el.id);
                        } else if (el.getAttribute('aria-label')) {
                            stableSelector += '[aria-label=\"' + el.getAttribute('aria-label').replace(/"/g, '\\\\"') + '\"]';
                        } else {
                            stableSelector += safeClassName(el);
                        }

                        interactive.push({
                            selector: stableSelector,
                            role: role,
                            text: label,
                            label: label,
                            rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                            attributes: { 
                                type: type,
                                placeholder: el.getAttribute('placeholder') || '',
                                'aria-label': el.getAttribute('aria-label') || '',
                                name: el.getAttribute('name') || ''
                            },
                            isVisible: true,
                            isCovered: false
                        });

                        // Populate Legacy Lists
                        if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
                             if (type !== 'password' && type !== 'hidden' && type !== 'submit') {
                                 formFields.push({
                                    selector: tagName + (el.id ? '#' + safeCSSId(el.id) : '') + (el.name ? '[name="' + el.name + '"]' : ''),
                                    type: type,
                                    name: el.getAttribute('name') || '',
                                    label: label,
                                    required: el.hasAttribute('required'),
                                    value: type !== 'password' ? el.value : undefined,
                                 });
                             }
                        }

                        if (tagName === 'button' || tagName === 'a' || role === 'button' || role === 'link' || type === 'submit') {
                            const lowerText = label.toLowerCase();
                            let isDangerous = false;
                            if (type === 'submit') {
                                // RELAXED: Only block explicitly dangerous financial actions
                                const dangerousKeywords = ['pay', 'buy', 'purchase', 'checkout', 'place order'];
                                isDangerous = dangerousKeywords.some(k => lowerText.includes(k));
                            }
                            
                            if (!isDangerous) {
                                buttons.push({
                                    selector: tagName + (el.id ? '#' + safeCSSId(el.id) : ''),
                                    text: label.substring(0, 100),
                                    type: type === 'submit' ? 'submit-action' : (tagName === 'a' ? 'link' : 'button'),
                                });
                            }
                        }
                    } catch(elementError) {
                        // Skip this element and continue processing others
                    }
                });

                // Safe text content extraction (limit to prevent OOM on huge pages)
                let textContent = '';
                try {
                    textContent = document.body.innerText.substring(0, 100000);
                } catch(e) {
                    textContent = document.title || '';
                }

                return {
                    title: document.title,
                    url: window.location.href,
                    interactive: interactive.slice(0, 200),
                    buttons: buttons.slice(0, 50),
                    formFields: formFields.slice(0, 50),
                    textContent: textContent
                };
            } catch(fatalError) {
                // Even if everything fails, return a minimal snapshot instead of crashing
                return {
                    title: document.title || '',
                    url: window.location.href || '',
                    interactive: [],
                    buttons: [],
                    formFields: [],
                    textContent: document.title || 'Failed to read page content'
                };
            }
        })()
    `;
}
