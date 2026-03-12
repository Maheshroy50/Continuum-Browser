import { BrowserView, BrowserWindow, ipcMain, Menu, WebContents, clipboard } from 'electron';
import { BlockerEngine } from './BlockerEngine';
import { AD_BLOCKING_CSS, STREAMING_AD_CSS, ANTI_REDIRECT_SCRIPT } from './CosmeticFilters';
import { YOUTUBE_BLOCKER_SCRIPT } from './YouTubeBlocker';
import { YOUTUBE_SPATIAL_AUDIO_SCRIPT } from './YouTubeSpatialAudio';
import { userAgentService } from './UserAgentService';
import type { ContinuumShield } from './ContinuumShield';

// DEV_MODE: Toggle verbose logging (set to false for production)
const DEV_MODE = process.env.NODE_ENV !== 'production';

// Conditional logging helper
const log = (...args: any[]) => DEV_MODE && console.log('[ViewManager]', ...args);
const logWarn = (...args: any[]) => console.warn('[ViewManager]', ...args);
const logError = (...args: any[]) => console.error('[ViewManager]', ...args);

interface ViewState {
    view: BrowserView;
    url: string;
    title: string;
    flowId: string;
    pageId: string;
    pendingState?: any;  // State to restore after did-finish-load
    backgroundSince?: number | null; // Smart Gating
    isInterstitial?: boolean; // Layout Fix: prevent showing native view when React overlay is active
}

// DISABLED: Private Network Sentinel regex - not used in working Dec 26 version
// const PRIVATE_IP_REGEX = new RegExp(
//     '^(127\\\\.)' +                         // Loopback
//     '|^(10\\\\.)' +                          // Class A Private
//     '|^(172\\\\.(1[6-9]|2[0-9]|3[0-1])\\\\.)' + // Class B Private
//     '|^(192\\\\.168\\\\.)' +                   // Class C Private
//     '|^(::1)$' +                           // IPv6 Loopback
//     '|^(fc00:)' +                          // IPv6 Unique Local
//     '|^(fe80:)' +                          // IPv6 Link Local
//     '|^(localhost)'                        // Hostname alias
// );

export class ViewManager {
    private mainWindow: BrowserWindow;
    private blockerEngine: BlockerEngine;
    private shield: ContinuumShield | null = null;
    // DISABLED: These were breaking Google sign-in
    // public tabSecurityManager: TabSecurityManager;
    // public httpsUpgrader: HttpsUpgrader;

    // Map<flowId, Map<pageId, ViewState>>
    private views: Map<string, Map<string, ViewState>> = new Map();
    private activeView: ViewState | null = null;
    private currentBounds: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
    private onTabSelected?: (contents: WebContents) => void;
    private isSpatialAudioEnabled: boolean = false;

    // LEVEL 5: DEEP SPOOFING SCRIPT
    // This runs in the renderer to hide all traces of Electron/Automation
    // LEVEL 5: DEEP SPOOFING SCRIPT
    // MOVED TO MAIN.TS (Global Scope)
    // private STEALTH_SCRIPT = ...

    // DISABLED: Private Network Sentinel - not in working Dec 26 version
    // private allowedLocalRequestOrigins = new Set<string>(); // "Origin|TargetHost"
    // private pendingAlerts = new Map<number, { origin: string, targetHost: string }>();

    constructor(mainWindow: BrowserWindow, blockerEngine: BlockerEngine, onTabSelected?: (contents: WebContents) => void) {
        this.mainWindow = mainWindow;
        this.blockerEngine = blockerEngine;
        this.onTabSelected = onTabSelected;
        // DISABLED: TabSecurityManager and HttpsUpgrader were breaking Google sign-in
        // Working Dec 26 version doesn't have these
        // this.tabSecurityManager = new TabSecurityManager(privacyManager, mainWindow.webContents);
        // this.httpsUpgrader = new HttpsUpgrader(privacyManager);
        this.setupIPC();
    }

    /**
     * Connect ContinuumShield for pre-navigation safety checks 
     * and enhanced fingerprint/behavioral monitoring injection.
     */
    public setShield(shield: ContinuumShield) {
        this.shield = shield;
        log('ContinuumShield connected to ViewManager');
    }

    destroy() {
        ipcMain.removeHandler('view:create');
        ipcMain.removeHandler('view:select');
        ipcMain.removeHandler('view:resize');
        ipcMain.removeHandler('view:remove');
        ipcMain.removeHandler('view:update-url');
        this.views.clear();
    }

    private spatialAudioMode: string = 'off'; // off, front, left, right, back

    // ... existing ...

    private setupIPC() {
        // Spatial Audio Mode
        ipcMain.handle('view:set-spatial-audio-mode', (_, mode: string) => {
            this.spatialAudioMode = mode;
            this.isSpatialAudioEnabled = mode !== 'off';

            // Iterate all views and update
            const script = `if(window.ContinuumSpatialAudio) window.ContinuumSpatialAudio.setMode('${mode}');`;

            this.views.forEach(flowMap => {
                flowMap.forEach(viewState => {
                    viewState.view.webContents.executeJavaScript(script).catch(() => { });
                });
            });
        });

        // Legacy Spatial Audio Toggle (kept for backward compatibility if needed, but updated to use modes)
        ipcMain.handle('view:set-spatial-audio', (_, enabled: boolean) => {
            const mode = enabled ? 'front' : 'off';
            this.spatialAudioMode = mode;
            this.isSpatialAudioEnabled = enabled;

            const script = `if(window.ContinuumSpatialAudio) window.ContinuumSpatialAudio.setMode('${mode}');`;
            this.views.forEach(flowMap => {
                flowMap.forEach(viewState => {
                    viewState.view.webContents.executeJavaScript(script).catch(() => { });
                });
            });
        });

        // Create view with optional state for restoration
        ipcMain.handle('view:create', (_, flowId: string, pageId: string, url: string, state?: any) => {
            return this.createView(flowId, pageId, url, state);
        });

        // Select view with optional URL for lazy creation and state for restoration
        ipcMain.handle('view:select', (_, flowId: string, pageId: string, url?: string, state?: any) => {
            return this.selectView(flowId, pageId, url, state);
        });

        ipcMain.handle('view:resize', (_, bounds: any, flowId?: string, pageId?: string) => {
            // If specific page requested
            if (flowId && pageId) {
                const view = this.getView(flowId, pageId);
                if (view) {
                    view.view.setBounds(bounds);
                }
                return;
            }

            // Default to active view (legacy/single mode)
            this.currentBounds = bounds;
            if (this.activeView) {
                this.activeView.view.setBounds(bounds);
            }
        });

        ipcMain.handle('view:remove', (_, flowId: string, pageId: string) => {
            return this.removeView(flowId, pageId);
        });

        // Remove ALL views for a flow (when flow is deleted)
        ipcMain.handle('view:remove-flow', (_, flowId: string) => {
            return this.removeFlowViews(flowId);
        });

        ipcMain.handle('view:update-url', async (_, url: string) => {
            if (!this.activeView) return;

            // ContinuumShield: Pre-navigation safe browsing check for address bar
            if (this.shield && this.shield.getConfig().safeBrowsingEnabled) {
                try {
                    const assessment = await this.shield.checkNavigation(url);
                    if (assessment && assessment.riskScore >= 70) {
                        // Threat detected — load interstitial warning instead
                        const interstitialHtml = this.shield.getThreatInterstitialHtml(
                            url, assessment.riskScore, assessment.threats, assessment.details
                        );
                        this.activeView.view.webContents.loadURL(
                            `data:text/html;charset=utf-8,${encodeURIComponent(interstitialHtml)}`
                        );
                        // Notify renderer
                        this.mainWindow.webContents.send('shield:threat-detected', {
                            flowId: this.activeView.flowId,
                            pageId: this.activeView.pageId,
                            url,
                            riskScore: assessment.riskScore,
                            threats: assessment.threats,
                            details: assessment.details,
                        });
                        return;
                    }
                } catch (e) {
                    console.warn('[ViewManager] Shield check failed for address bar URL:', e);
                }
            }

            return this.activeView.view.webContents.loadURL(url);
        });

        ipcMain.handle('view:back', () => {
            // Target active view
            if (this.activeView && this.activeView.view.webContents.canGoBack()) {
                this.activeView.view.webContents.goBack();
            }
        });

        ipcMain.handle('view:forward', () => {
            if (this.activeView && this.activeView.view.webContents.canGoForward()) {
                this.activeView.view.webContents.goForward();
            }
        });

        ipcMain.handle('view:reload', () => {
            if (this.activeView) {
                this.activeView.view.webContents.reload();
            }
        });

        ipcMain.handle('view:capture', async () => {
            if (this.activeView && !this.activeView.view.webContents.isDestroyed()) {
                try {
                    const image = await this.activeView.view.webContents.capturePage();
                    return image.toDataURL();
                } catch (e) {
                    console.error('Failed to capture page:', e);
                    return null;
                }
            }
            return null;
        });

        ipcMain.handle('view:hide', (_, flowId?: string, pageId?: string) => {
            if (flowId && pageId) {
                const view = this.getView(flowId, pageId);
                if (view) {
                    this.mainWindow.removeBrowserView(view.view);
                }
                return;
            }

            if (this.activeView) {
                this.mainWindow.removeBrowserView(this.activeView.view);
            }
        });

        ipcMain.handle('view:show', (_, flowId?: string, pageId?: string, bounds?: any) => {
            if (flowId && pageId) {
                const view = this.getView(flowId, pageId);
                if (view) {
                    // Prevent showing if interstitial is active
                    if (view.isInterstitial) return;

                    this.mainWindow.addBrowserView(view.view);
                    if (bounds) {
                        view.view.setBounds(bounds);
                    }
                }
                return;
            }

            if (this.activeView) {
                if (this.activeView.isInterstitial) return;

                this.mainWindow.addBrowserView(this.activeView.view);
                this.activeView.view.setBounds(this.currentBounds);
            }
        });

        ipcMain.handle('view:get-html', async () => {
            if (this.activeView) {
                return await this.activeView.view.webContents.executeJavaScript('document.documentElement.outerHTML');
            }
            return null;
        });

        ipcMain.handle('view:toggle-devtools', () => {
            if (this.activeView) {
                this.activeView.view.webContents.toggleDevTools();
            } else {
                this.mainWindow.webContents.toggleDevTools();
            }
        });

        // DISABLED: Private Network Sentinel - not in working Dec 26 version
        // ipcMain.on('security:sentinel-response', (_, data: { action: 'block' | 'allow', requestId: number }) => {
        //     if (data.action === 'allow') {
        //         const alert = this.pendingAlerts.get(data.requestId);
        //         if (alert) {
        //             const key = `${alert.origin}|${alert.targetHost}`;
        //             this.allowedLocalRequestOrigins.add(key);
        //             console.log(`[Sentinel] Allowed: ${key}`);
        //         }
        //     }
        //     this.pendingAlerts.delete(data.requestId);
        // });

        // Capture page state with DOM Anchor for resilient resume
        ipcMain.handle('view:capture-state', async (_, flowId: string, pageId: string) => {
            const flowViews = this.views.get(flowId);
            if (!flowViews) return null;

            const viewState = flowViews.get(pageId);
            if (!viewState) return null;

            try {
                const result = await viewState.view.webContents.executeJavaScript(`
                    (() => {
                        // Use scrollingElement for accurate scroll position
                        const scrollY = document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
                        const scrollX = document.scrollingElement?.scrollLeft ?? window.scrollX ?? 0;
                        
                        // DOM Anchor Capture - find what user was reading
                        let anchor = null;
                        const elements = document.querySelectorAll('p, h1, h2, h3, h4, li, article, section, div[class*="content"]');
                        for (const el of elements) {
                            const rect = el.getBoundingClientRect();
                            // Find first element in top 30% of viewport
                            if (rect.top >= 0 && rect.top < window.innerHeight * 0.3 && el.innerText.trim().length > 20) {
                                anchor = {
                                    text: el.innerText.trim().slice(0, 120),
                                    tag: el.tagName,
                                    offset: scrollY - el.offsetTop,
                                    viewportOffset: rect.top
                                };
                                break;
                            }
                        }
                        
                        // Form data capture
                        const formData = {};
                        document.querySelectorAll('input, textarea, select').forEach(el => {
                            const key = el.id || el.name;
                            if (key && el.value) {
                                formData[key] = el.value;
                            }
                        });
                        
                        // Calculate scroll ratio for ratio-based restore
                        const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                        const scrollRatio = docHeight > 0 ? scrollY / docHeight : 0;
                        
                        console.log('[Flow] Captured:', { scrollY, scrollRatio: scrollRatio.toFixed(3), anchor: anchor?.text?.slice(0, 40) + '...' });
                        
                        return {
                            scrollX,
                            scrollY,
                            scrollRatio,
                            anchor,
                            formData: Object.keys(formData).length > 0 ? formData : undefined
                        };
                    })();
                `);

                return {
                    ...result,
                    zoomFactor: viewState.view.webContents.getZoomFactor()
                };
            } catch (e) {
                console.error('[ViewManager] Failed to capture state:', e);
                return null;
            }
        });

        // Restore page state (scroll, form data, zoom) with self-healing retry
        ipcMain.handle('view:restore-state', async (_, flowId: string, pageId: string, state: any) => {
            const flowViews = this.views.get(flowId);
            if (!flowViews || !state) return;

            const viewState = flowViews.get(pageId);
            if (!viewState) return;

            if (viewState.view.webContents.isLoading()) {
                viewState.view.webContents.once('did-finish-load', () => {
                    this.restoreViewState(viewState, state);
                });
            } else {
                await this.restoreViewState(viewState, state);
            }
        });
    }

    private getView(flowId: string, pageId: string): ViewState | undefined {
        return this.views.get(flowId)?.get(pageId);
    }

    public toggleDevTools() {
        if (this.activeView) {
            this.activeView.view.webContents.toggleDevTools();
        } else {
            this.mainWindow.webContents.toggleDevTools();
        }
    }

    private async restoreViewState(viewState: ViewState, state: any) {
        const pageId = viewState.pageId;
        const targetX = state.scrollX || 0;
        const targetY = state.scrollY || 0;
        const anchor = state.anchor;

        log(`[Restore] Starting restoration for ${pageId} (Method: ${anchor ? 'Anchor' : 'Pixel/Ratio'})`);

        // Helper: Retry loop with delay
        const retry = async (fn: (attempt: number) => Promise<boolean>, maxTries = 5, delay = 400) => {
            for (let i = 0; i < maxTries; i++) {
                if (await fn(i)) return true;
                if (i < maxTries - 1) {
                    log(`[Restore] Retry ${i + 1}/${maxTries} failed, waiting ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            logWarn(`[Restore] All ${maxTries} retries failed.`);
            return false;
        };

        // Helper: Wait for dynamic content (SPAs)
        const waitForContent = async () => {
            log(`[Restore] Waiting for content stability...`);
            return viewState.view.webContents.executeJavaScript(`
                new Promise(resolve => {
                    let checks = 0;
                    const check = () => {
                        const h = document.documentElement.scrollHeight;
                        const len = document.body.innerText.length;
                        // Heuristic: If height > 1000 or text > 500 chars, content is likely loaded
                        // Also check if readyState is complete as a fast-path for static sites
                        if (h > 1000 || len > 500 || (document.readyState === 'complete' && len > 0) || checks > 10) {
                            console.log('[Restore] Content ready:', { height: h, textLen: len, checks });
                            resolve(true);
                        } else {
                            checks++;
                            requestAnimationFrame(() => setTimeout(check, 200));
                        }
                    };
                    check();
                })
            `);
        };

        await waitForContent();

        // STRATEGY 1: DOM Anchor (Most Robust for Static Content)
        if (anchor) {
            log(`[Restore] ${pageId}: Attempting Anchor Restore ('${anchor.text?.substring(0, 20)}...')`);
            const anchorSuccess = await retry(async (i) => {
                const found = await viewState.view.webContents.executeJavaScript(`
                    (function() {
                        // 1. Try text match (exact or fuzzy)
                        // Use a safe string replace for the anchor text
                        const anchorText = ${JSON.stringify(anchor.text)};
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        let node;
                        while(node = walker.nextNode()) {
                            if (node.textContent.includes(anchorText)) {
                                node.parentElement.scrollIntoView({block: 'center'});
                                return true;
                            }
                        }
                        return false;
                    })()
                `);
                if (found) log(`[Restore] ${pageId}: Anchor found on attempt ${i + 1}`);
                return found;
            });

            if (anchorSuccess) {
                this.mainWindow.webContents.send('view:restore-result', { pageId, method: 'anchor', success: true });
                return;
            } else {
                logWarn(`[Restore] Anchor restore failed, falling back to Ratio/Pixel.`);
            }
        }

        // STRATEGY 2: Ratio-based (Robust for Responsive/Zoomed Layouts)
        if (state.scrollRatio && state.scrollRatio > 0) {
            log(`[Restore] ${pageId}: Attempting Ratio Restore (${state.scrollRatio})`);
            const ratioSuccess = await retry(async (i) => {
                const result = await viewState.view.webContents.executeJavaScript(`
                    (function() {
                        const target = document.documentElement.scrollHeight * ${state.scrollRatio};
                        document.documentElement.scrollTop = target;
                        return {
                            actual: document.documentElement.scrollTop,
                            expected: target,
                            scrollHeight: document.documentElement.scrollHeight
                        };
                    })()
                `);

                const diff = Math.abs(result.actual - result.expected);
                const success = diff < 50 || (result.actual > 0 && Math.abs(result.actual - result.expected) / result.expected < 0.1); // 10% margin

                if (!success) {
                    log(`[Restore] Ratio attempt ${i + 1}: Wanted ${result.expected.toFixed(0)}, got ${result.actual.toFixed(0)} (Height: ${result.scrollHeight})`);
                }
                return success;
            });

            if (ratioSuccess) {
                this.mainWindow.webContents.send('view:restore-result', { pageId, method: 'ratio', success: true });
                return;
            }
        }

        // STRATEGY 3: Pixel-based (Fallback)
        log(`[Restore] ${pageId}: Attempting Pixel Restore (${targetY})`);
        await retry(async (i) => {
            await viewState.view.webContents.executeJavaScript(`window.scrollTo(${targetX}, ${targetY})`);
            const currentY = await viewState.view.webContents.executeJavaScript('window.scrollY');
            // Allow 50px error margin
            const success = Math.abs(currentY - targetY) < 50;
            if (!success) {
                log(`[Restore] Pixel attempt ${i + 1}: Wanted ${targetY}, got ${currentY}`);
            }
            return success;
        });

        this.mainWindow.webContents.send('view:restore-result', { pageId, method: 'pixel', success: true });
    }

    createView(flowId: string, pageId: string, url: string, stateToRestore?: any) {
        console.log(`[ViewManager] createView called:`, {
            pageId,
            hasState: !!stateToRestore,
            stateInfo: stateToRestore ? { scrollY: stateToRestore.scrollY, scrollRatio: stateToRestore.scrollRatio, hasAnchor: !!stateToRestore.anchor } : null
        });

        if (!this.views.has(flowId)) {
            this.views.set(flowId, new Map());
        }

        const flowViews = this.views.get(flowId)!;
        if (flowViews.has(pageId)) {
            // Already exists, update pending state and return
            const existing = flowViews.get(pageId)!;
            if (stateToRestore) {
                existing.pendingState = stateToRestore;
                // Force restore if view is already loaded or loading
                if (existing.view.webContents.isLoading()) {
                    existing.view.webContents.once('did-finish-load', () => {
                        this.restoreViewState(existing, stateToRestore);
                        existing.pendingState = undefined;
                    });
                } else {
                    this.restoreViewState(existing, stateToRestore);
                    existing.pendingState = undefined;
                }
            }
            return this.selectView(flowId, pageId);
        }

        const view = new BrowserView({
            webPreferences: {
                // NOTE: Removed partition to ensure extensions (loaded in defaultSession) attach to all views
                sandbox: true, // Default safe sandbox
                contextIsolation: true,
                nodeIntegration: false,
                // Performance: disable spellcheck to reduce CPU usage during video playback
                spellcheck: false,
                // Performance: disable devtools in production
                devTools: DEV_MODE,
                // Enable scroll bounce for "native" feel (helps with swipe nav consistency)
                scrollBounce: true,
                // Enable Widevine DRM for Netflix/Udemy/Spotify
                plugins: true
            }
        });

        const viewState: ViewState = {
            view,
            url,
            title: url,
            flowId,
            pageId,
            pendingState: stateToRestore
        };

        // Attach Ad Blocker — network-level request blocking
        this.blockerEngine.attach(view.webContents.session);

        // Apply Intelligent User Agent Spoofing
        // Chrome for Media/General (fixes Udemy/Netflix), Firefox for Google Auth
        view.webContents.setUserAgent(userAgentService.getUserAgentForUrl(url));

        // Dynamic UA Switching on Navigation
        view.webContents.on('did-start-navigation', (_event, navigationUrl, _isInPlace, isMainFrame) => {
            if (!navigationUrl || !isMainFrame) return; // Only switch UA for main frame
            const newUA = userAgentService.getUserAgentForUrl(navigationUrl);
            const currentUA = view.webContents.getUserAgent();
            if (newUA !== currentUA) {
                view.webContents.setUserAgent(newUA);
            }
        });

        // Inject Stealth Scripts (for hiding automation flags)
        // Fire loading start immediately on ANY navigation (catches SPA/pushState before network)
        view.webContents.on('did-start-navigation', (_event, _navUrl, _isInPlace, isMainFrame) => {
            if (!isMainFrame) return;
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:loading', { flowId, pageId, isLoading: true });
        });

        view.webContents.on('did-start-loading', () => {
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:loading', { flowId, pageId, isLoading: true });

            if (viewState.isInterstitial) {
                viewState.isInterstitial = false;
            }
        });

        view.webContents.on('did-stop-loading', () => {
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:loading', { flowId, pageId, isLoading: false });
        });

        // Fail Load Handler (HTTPS-Only Fallback)
        view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            // Only show interstitial for main frame failures, not subframes (ads, trackers, etc.)
            if (!isMainFrame) {
                return; // Silently ignore subframe failures
            }
            logWarn(`[ViewManager] Failed load: ${validatedURL} (${errorCode}: ${errorDescription})`);

            // GOOGLE TRUSTED HANDOFF: Check if Google domain was blocked
            const GOOGLE_AUTH_DOMAINS = [
                'accounts.google.com',
                'signin.google.com',
                'myaccount.google.com',
                'login.google.com'
            ];

            try {
                const failedUrl = new URL(validatedURL);
                const isGoogleAuth = GOOGLE_AUTH_DOMAINS.some(d => failedUrl.hostname === d || failedUrl.hostname.endsWith('.' + d));

                // Google blocks often return -3 (ABORTED), -2 (FAILED), -102 (CONNECTION_REFUSED)
                const googleBlockErrors = [-3, -2, -102, -105, -106];

                if (isGoogleAuth && googleBlockErrors.includes(errorCode)) {
                    // LEVEL 4 FIX: The "Cookie Heist" (Side-Load Login)
                    // Instead of showing an error, automatically launch the Clean Room login window.
                    logWarn('[ViewManager] Google Auth Blocked. Triggering Cookie Heist...');
                    // ERROR 400 FIX: Do NOT pass the 'validatedURL' (which might be the /rejected page).
                    // Always start the Heist with a fresh, clean ServiceLogin URL.
                    this.performGoogleLogin('https://accounts.google.com/ServiceLogin', pageId);
                    return; // Don't fall through to SSL error handling
                }
            } catch (e) {
                // URL parsing failed, continue to regular error handling
            }

            // Common SSL/Connection errors associated with missing HTTPS
            // -102: CONNECTION_REFUSED, -107: SSL_PROTOCOL_ERROR, -101: CONNECTION_RESET
            // -501: INSECURE_RESPONSE
            const sslErrors = [-102, -107, -101, -501, -200, -201, -202, -203]; // Expanded list

            if (sslErrors.includes(errorCode)) {
                // Check if this was a forced upgrade
                // Reconstruct the original HTTP url
                const httpUrl = validatedURL.replace(/^https:/, 'http:');

                // We can check if we should show the interstitial
                // Ideally we'd verify with HttpsUpgrader if it *actually* upgraded this request, 
                // but checking protocol mismatch is a decent heuristic + the error code.

                // Mark as failed in Upgrader so next attempt (if user clicks allow) passes through
                // DISABLED: httpsUpgrader breaks Google sign-in
                // this.httpsUpgrader.markUpgradeFailed(httpUrl);

                // Inform the Renderer to show the "Security Interstitial" overlay
                // We do NOT navigate the view away (preserve the URL in address bar if possible),
                // but since the page failed to load, it will be blank/error page.
                // BETTER UX: Load a local data URI or file with the error, 
                // but for Phase 2 MVP, we'll overlay the React component in App.tsx.
                // We send an IPC to App.tsx to mount <SecurityInterstitial /> on top of this view.

                // CRITICAL FIX: Hide the native view so it doesn't occlude the React overlay
                this.mainWindow.removeBrowserView(view);
                // Mark as interstitial to prevent race conditions (e.g. view:show being called by React effects)
                const viewState = this.views.get(flowId)?.get(pageId);
                if (viewState) viewState.isInterstitial = true;

                this.mainWindow.webContents.send('view:load-interstitial', {
                    url: validatedURL,
                    error: errorDescription,
                    originalUrl: httpUrl
                });
            }
        });

        view.webContents.setWindowOpenHandler((details) => {
            const { url } = details;

            // 1. Check Ad Blocklist (Popup Blocker)
            if (this.blockerEngine.shouldBlock(url)) {
                logWarn(`[ViewManager] Blocked popup to ${url}`);
                return { action: 'deny' };
            }

            // 1b. URL-pattern popup blocking (catches domains not yet in blocklist)
            const level = this.blockerEngine.getLevel();
            if (level === 'aggressive' || level === 'maximum') {
                const POPUP_AD_PATTERNS = [
                    /popunder/i, /popads/i, /clickadu/i, /syndication/i,
                    /realsrv/i, /exosrv/i, /exdynsrv/i, /tsyndicate/i,
                    /adsterra/i, /exoclick/i, /propeller/i, /oclasrv/i,
                    /onclasrv/i, /onclkds/i, /clksite/i, /clkmon/i,
                    /betting/i, /casino/i, /lottery/i, /lotto/i,
                    /1xbet/i, /bet365/i, /stake\.com/i, /mylottochamp/i,
                    /shrinkme/i, /linkvertise/i, /ouo\./i, /adf\.ly/i,
                    /bc\.vc/i, /exe\.io/i, /fc\.lc/i, /gplinks/i,
                    /ad-maven/i, /admaven/i, /ad-delivery/i,
                    /trafficjunky/i, /juicyads/i,
                ];
                for (const pattern of POPUP_AD_PATTERNS) {
                    if (pattern.test(url)) {
                        logWarn(`[ViewManager] Blocked ad popup (pattern): ${url}`);
                        return { action: 'deny' };
                    }
                }

                // Block about:blank popups (common popunder trick)
                if (url === 'about:blank' && level === 'maximum') {
                    logWarn(`[ViewManager] Blocked about:blank popup (maximum mode)`);
                    return { action: 'deny' };
                }
            }

            // 2. Auth Flow Whitelist (Allow native windows for these only)
            const isAuth = [
                'accounts.google.com', 'google.com/accounts', 'gstatic.com',
                'github.com/login', 'github.com/session',
                'facebook.com', 'twitter.com', 'appleid.apple.com',
                'login.microsoftonline.com', 'linkedin.com',
                'okta.com', 'auth0.com'
            ].some(domain => url.includes(domain));

            if (isAuth) {
                // Allow known auth popups (OAuth, etc)
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        // Ensure we spoof UA even in popups to prevent "browser insecure" warnings
                        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
                        webPreferences: {
                            nodeIntegration: false,
                            contextIsolation: true,
                            sandbox: true,
                            // Enable WebAuthn in popups (critical for Google Sign-In)
                            // @ts-ignore - 'enableWebSQL' is not the flag, but ensuring webPreferences are standard helps
                            // In Electron, WebAuthn is enabled by default if not disabled.
                        }
                    }
                };
            }

            // 3. FLATTEN EVERYTHING ELSE
            // If the site tries to open a new tab/window (target="_blank"),
            // force it to load in the CURRENT view instead of opening an ugly native window.
            // PERF FIX: Extract clean destination URL from search-engine redirect wrappers
            // (google.com/url?q=, bing.com/ck/a?, duckduckgo.com/l/?) to avoid serial redirect chains.
            let finalUrl = url;
            try {
                const parsed = new URL(url);
                // Google: /url?q=<encoded-url>&...
                if ((parsed.hostname.includes('google.com') || parsed.hostname.includes('google.co')) && parsed.pathname === '/url') {
                    const q = parsed.searchParams.get('q');
                    if (q && q.startsWith('http')) finalUrl = q;
                }
                // Bing: /ck/a?!&&p=<base64>&...  — destination in 'u' param
                else if (parsed.hostname.includes('bing.com') && parsed.pathname.startsWith('/ck/a')) {
                    const u = parsed.searchParams.get('u');
                    if (u) {
                        const decoded = Buffer.from(u.replace(/^a1/, ''), 'base64').toString('utf8');
                        if (decoded.startsWith('http')) finalUrl = decoded;
                    }
                }
                // DuckDuckGo: /l/?uddg=<encoded-url>
                else if (parsed.hostname.includes('duckduckgo.com') && parsed.pathname === '/l/') {
                    const uddg = parsed.searchParams.get('uddg');
                    if (uddg && uddg.startsWith('http')) finalUrl = decodeURIComponent(uddg);
                }
            } catch {
                // URL parse failed, use original
            }

            // In aggressive/maximum mode: only flatten SAME-SITE popups.
            // Cross-origin popups (like random ad domains) get silently denied.
            // EXCEPTION: When the current page is a SAFE site (Google, Bing, etc.),
            // allow all outbound popups — these are legitimate link clicks from search results.
            const popupLevel = this.blockerEngine.getLevel();
            if (popupLevel === 'aggressive' || popupLevel === 'maximum') {
                try {
                    const currentPageUrl = view.webContents.getURL();
                    const currentPageHost = new URL(currentPageUrl).hostname;
                    const popupHost = new URL(finalUrl).hostname;
                    const isSameSite = popupHost === currentPageHost ||
                                      popupHost.endsWith('.' + currentPageHost) ||
                                      currentPageHost.endsWith('.' + popupHost);

                    // Allow if current page is a well-known safe site (search engines, social media, etc.)
                    // Users clicking links on Google/Bing/Reddit should always work
                    const isFromSafeSite = isSafeNavDomain(currentPageHost);

                    if (!isSameSite && !isFromSafeSite) {
                        // Check if destination is a well-known safe domain
                        const isSafeDestination = isSafeNavDomain(popupHost);

                        if (!isSafeDestination) {
                            logWarn(`[ViewManager] Blocked cross-origin popup flatten: ${finalUrl}`);
                            return { action: 'deny' };
                        }
                    }
                } catch { /* URL parse failed, block to be safe */ 
                    return { action: 'deny' };
                }
            }

            console.log(`[ViewManager] Flattening popup: ${url}${finalUrl !== url ? ' → ' + finalUrl : ''}`);            // ContinuumShield: Check flattened popup URL
            if (this.shield && this.shield.getConfig().safeBrowsingEnabled) {
                this.shield.checkNavigation(finalUrl).then(assessment => {
                    if (assessment && assessment.riskScore >= 70) {
                        const interstitialHtml = this.shield!.getThreatInterstitialHtml(
                            finalUrl, assessment.riskScore, assessment.threats, assessment.details
                        );
                        view.webContents.loadURL(
                            `data:text/html;charset=utf-8,${encodeURIComponent(interstitialHtml)}`
                        );
                    } else {
                        view.webContents.loadURL(finalUrl);
                    }
                }).catch(() => view.webContents.loadURL(finalUrl));
            } else {
                view.webContents.loadURL(finalUrl);
            }
            return { action: 'deny' };
        });
        // Bluetooth Device Selection (WebContents Level)
        view.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
            event.preventDefault();
            if (deviceList && deviceList.length > 0) {
                callback(deviceList[0].deviceId);
            } else {
                callback('');
            }
        });

        // YouTube is a SPA — re-inject blocker on in-page navigations
        view.webContents.on('did-navigate-in-page', (_event, navUrl) => {
            if (this.blockerEngine.getStatus().isEnabled && navUrl.includes('youtube.com') && this.blockerEngine.getStatus().youtubeAdsBlocked) {
                view.webContents.executeJavaScript(YOUTUBE_BLOCKER_SCRIPT).catch(() => { });
            }
        });

        // === ANTI-REDIRECT: WHITELIST-BASED cross-origin navigation blocker ===
        // KEY INSIGHT: `will-navigate` ONLY fires for in-page JS redirects and <a> clicks.
        // It does NOT fire for address-bar navigation (loadURL) or bookmarks.
        // So blocking ALL cross-origin will-navigate in aggressive/max mode is SAFE —
        // it only prevents JS-initiated redirects to random ad domains.
        //
        // Well-known safe domains are whitelisted so real links still work.
        const SAFE_NAVIGATION_DOMAINS = [
            // Major platforms
            'google.com', 'google.co', 'youtube.com', 'youtu.be', 'gmail.com',
            'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
            'reddit.com', 'wikipedia.org', 'wikimedia.org',
            'github.com', 'gitlab.com', 'stackoverflow.com',
            'amazon.com', 'apple.com', 'microsoft.com', 'linkedin.com',
            // Education
            'udemy.com', 'coursera.org', 'edx.org', 'khanacademy.org',
            // Streaming
            'netflix.com', 'hulu.com', 'disneyplus.com', 'crunchyroll.com',
            'twitch.tv', 'spotify.com', 'soundcloud.com',
            // Common CDNs / safe infra
            'cloudflare.com', 'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com',
            'recaptcha.net', 'hcaptcha.com', 'gstatic.com',
            // Auth
            'accounts.google.com', 'appleid.apple.com',
            'login.microsoftonline.com', 'auth0.com', 'okta.com',
        ];

        function isSafeNavDomain(hostname: string): boolean {
            return SAFE_NAVIGATION_DOMAINS.some(safe =>
                hostname === safe || hostname.endsWith('.' + safe)
            );
        }

        view.webContents.on('will-navigate', (event, navUrl) => {
            // === ContinuumShield: Safe Browsing pre-navigation check ===
            // SYNCHRONOUSLY block navigation, then check async. If safe, re-navigate.
            // This prevents the race condition where the malicious page loads before the check completes.
            if (this.shield && this.shield.getConfig().safeBrowsingEnabled) {
                // Skip safe browsing check for well-known safe domains (Google, YouTube, etc.)
                // These are major platforms that should never be blocked by safe browsing.
                let isTrustedNav = false;
                try {
                    const navHost = new URL(navUrl).hostname;
                    isTrustedNav = isSafeNavDomain(navHost);
                } catch { /* invalid URL, treat as untrusted */ }

                if (!isTrustedNav) {
                    // Skip if this is a shield-approved re-navigation (marked by __shield_checked query param)
                    if (navUrl.includes('__shield_checked=1')) {
                        // Strip the marker param before loading
                        try {
                            const cleanUrl = new URL(navUrl);
                            cleanUrl.searchParams.delete('__shield_checked');
                            const clean = cleanUrl.toString();
                            if (clean !== navUrl) {
                                event.preventDefault();
                                view.webContents.loadURL(clean);
                                return;
                            }
                        } catch { /* proceed */ }
                        return; // Already checked, allow navigation
                    }

                    // Block navigation synchronously
                    event.preventDefault();

                    // Run async safe browsing check, then decide
                    this.shield.checkNavigation(navUrl).then(assessment => {
                        if (assessment && assessment.riskScore >= 70) {
                            // Threat detected — load interstitial warning page
                            const interstitialHtml = this.shield!.getThreatInterstitialHtml(
                                navUrl, assessment.riskScore, assessment.threats, assessment.details
                            );
                            view.webContents.loadURL(
                                `data:text/html;charset=utf-8,${encodeURIComponent(interstitialHtml)}`
                            );

                            // Also notify the renderer sidebar
                            this.mainWindow.webContents.send('shield:threat-detected', {
                                flowId, pageId,
                                url: navUrl,
                                riskScore: assessment.riskScore,
                                threats: assessment.threats,
                                details: assessment.details,
                            });
                        } else {
                            // Safe — proceed with navigation (add marker to skip re-check)
                            try {
                                const markedUrl = new URL(navUrl);
                                markedUrl.searchParams.set('__shield_checked', '1');
                                view.webContents.loadURL(markedUrl.toString());
                            } catch {
                                view.webContents.loadURL(navUrl);
                            }
                        }
                    }).catch(() => {
                        // Check failed — allow navigation (fail-open to avoid breaking browsing)
                        try {
                            const markedUrl = new URL(navUrl);
                            markedUrl.searchParams.set('__shield_checked', '1');
                            view.webContents.loadURL(markedUrl.toString());
                        } catch {
                            view.webContents.loadURL(navUrl);
                        }
                    });
                    return; // Don't continue to blocker engine check (already prevented)
                }
                // Trusted domain — fall through to blocker engine checks below
            }

            if (!this.blockerEngine.getStatus().isEnabled) return;
            const level = this.blockerEngine.getLevel();
            if (level !== 'aggressive' && level !== 'maximum') return;

            try {
                const currentUrl = view.webContents.getURL();
                const currentHost = new URL(currentUrl).hostname;
                const navHost = new URL(navUrl).hostname;

                // Always allow same-site navigations
                if (navHost === currentHost || navHost.endsWith('.' + currentHost) || currentHost.endsWith('.' + navHost)) {
                    return;
                }

                // Allow navigation to well-known safe domains
                if (isSafeNavDomain(navHost)) {
                    return;
                }

                // Allow navigation FROM safe domains (e.g., clicking Google search results)
                // When you're on Google/Bing/DuckDuckGo/etc., outbound link clicks are legitimate
                if (isSafeNavDomain(currentHost)) {
                    return;
                }

                // BLOCK everything else — this catches random ad domains like
                // astronautlividlyreformer.com, randomword123.com, etc.
                // The user can still navigate to any site via the address bar (loadURL).
                event.preventDefault();
                logWarn(`[Anti-Redirect] Blocked cross-origin redirect: ${currentHost} → ${navHost} (${navUrl})`);
            } catch { /* URL parse failed, allow */ }
        });

        // DISABLED: configureSession strips Client Hints headers which triggers Google detection
        // this.configureSession(view.webContents.session);

        flowViews.set(pageId, viewState);

        // EARLY INJECTION: Inject anti-redirect script at dom-ready (before page scripts run)
        // This catches redirect scripts that execute before did-finish-load
        // SKIP safe/mainstream sites — anti-redirect script is for sketchy streaming sites only
        view.webContents.on('dom-ready', () => {
            if (!this.blockerEngine.getStatus().isEnabled) return;
            const level = this.blockerEngine.getLevel();
            const currentUrl = view.webContents.getURL();
            const isYouTube = currentUrl.includes('youtube.com');

            // Don't inject on well-known safe sites (Google, social media, etc.)
            try {
                const host = new URL(currentUrl).hostname;
                if (isSafeNavDomain(host)) return;
            } catch {}

            if ((level === 'aggressive' || level === 'maximum') && !isYouTube) {
                view.webContents.executeJavaScript(ANTI_REDIRECT_SCRIPT).catch(() => { });
                view.webContents.insertCSS(STREAMING_AD_CSS).catch(() => { });
            }
        });

        // EVENT-DRIVEN SCROLL RESTORATION
        // This is the ONLY place where scroll restore should happen
        view.webContents.on('did-finish-load', () => {
            // Inject Cosmetic Ad Filters
            if (this.blockerEngine.getStatus().isEnabled) {
                view.webContents.insertCSS(AD_BLOCKING_CSS).catch(() => { });

                const level = this.blockerEngine.getLevel();
                const currentUrl = view.webContents.getURL();
                const isYouTube = currentUrl.includes('youtube.com');

                // Check if this is a well-known safe site — skip aggressive injection
                let isSafeSite = false;
                try {
                    const host = new URL(currentUrl).hostname;
                    isSafeSite = isSafeNavDomain(host);
                } catch {}

                // Inject streaming-site cosmetic filters (aggressive + maximum, skip YouTube & safe sites)
                if ((level === 'aggressive' || level === 'maximum') && !isYouTube && !isSafeSite) {
                    view.webContents.insertCSS(STREAMING_AD_CSS).catch(() => { });
                }

                // Inject anti-redirect & click-hijack protection (aggressive + maximum, skip YouTube & safe sites)
                // These protections are for sketchy streaming sites — they break Google, social media, etc.
                if ((level === 'aggressive' || level === 'maximum') && !isYouTube && !isSafeSite) {
                    view.webContents.executeJavaScript(ANTI_REDIRECT_SCRIPT).catch(() => { });
                }

                // Inject YouTube Blocker (respects per-user config)
                if (view.webContents.getURL().includes('youtube.com') && this.blockerEngine.getStatus().youtubeAdsBlocked) {
                    view.webContents.executeJavaScript(YOUTUBE_BLOCKER_SCRIPT).catch(() => { });

                    // Inject Spatial Audio Script
                    view.webContents.executeJavaScript(YOUTUBE_SPATIAL_AUDIO_SCRIPT).then(() => {
                        // Apply current state
                        if (this.isSpatialAudioEnabled) {
                            const mode = this.spatialAudioMode || 'front';
                            view.webContents.executeJavaScript(`if(window.ContinuumSpatialAudio) window.ContinuumSpatialAudio.setMode('${mode}');`).catch(() => { });
                        }
                    }).catch(() => { });
                }
            }

            // === ContinuumShield: Inject security scripts ===
            if (this.shield) {
                // Behavioral monitoring (crypto-mining detection)
                const behavioralScript = this.shield.getBehavioralMonitorScript();
                if (behavioralScript) {
                    view.webContents.executeJavaScript(behavioralScript).catch(() => { });
                }

                // Enhanced fingerprinting resistance
                const fpScript = this.shield.getEnhancedFingerprintScript();
                if (fpScript) {
                    view.webContents.executeJavaScript(fpScript).catch(() => { });
                }

                // Listen for behavioral monitor alerts from injected scripts
                // Scripts use console.warn('[CONTINUUM_SHIELD_ALERT]', jsonData)
                // to signal crypto-mining or suspicious behavior from the isolated page context
                if (!view.webContents.listenerCount('console-message') ||
                    !(view.webContents as any).__shieldConsoleListener) {
                    const shieldConsoleListener = (_event: any, _level: number, message: string) => {
                        if (message.startsWith('[CONTINUUM_SHIELD_ALERT]')) {
                            try {
                                const payload = JSON.parse(message.replace('[CONTINUUM_SHIELD_ALERT]', '').trim());
                                const reason = payload.reason || 'unknown';
                                log(`⚠️ Shield alert on ${view.webContents.getURL()}: ${reason}`);

                                // Update shield stats
                                if (this.shield && (reason === 'crypto_mining_suspected' || reason === 'excessive_workers')) {
                                    // Notify renderer about the threat
                                    this.mainWindow.webContents.send('shield:behavioral-alert', {
                                        flowId, pageId,
                                        url: view.webContents.getURL(),
                                        reason,
                                        details: payload,
                                    });
                                }
                            } catch { /* malformed alert JSON */ }
                        }
                        // Fingerprint resistance telemetry
                        if (message.startsWith('[CONTINUUM_SHIELD_FP]')) {
                            try {
                                const payload = JSON.parse(message.replace('[CONTINUUM_SHIELD_FP]', '').trim());
                                if (this.shield) {
                                    const stats = this.shield.getStats();
                                    stats.fingerprintAttemptsBlocked += (payload.count ? 5 : 1);
                                    this.shield.updateStats(stats);
                                }
                            } catch { /* malformed FP telemetry */ }
                        }
                    };
                    view.webContents.on('console-message', shieldConsoleListener);
                    (view.webContents as any).__shieldConsoleListener = true;
                }
            }

            // RESTORE STATE LOGIC
            const state = viewState.pendingState;
            if (state) {
                log(`View ${pageId} loaded, restoring state...`, {
                    scrollY: state.scrollY,
                    scrollRatio: state.scrollRatio?.toFixed(3),
                    hasAnchor: !!state.anchor
                });

                // Wait for layout stability before restoring
                view.webContents.executeJavaScript(`
                    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                `).then(async () => {
                    // Check if URL changed (redirect detection)
                    const currentUrl = view.webContents.getURL();
                    const originalUrl = viewState.url;

                    // Allow subdomains and same-site redirects, but block completely different domains
                    // unless it's a known auth flow
                    if (currentUrl !== originalUrl && !currentUrl.includes(new URL(originalUrl).hostname)) {
                        logWarn(`View ${pageId} redirected: ${originalUrl} -> ${currentUrl}`);
                        this.mainWindow.webContents.send('view:restore-result', {
                            pageId,
                            method: 'none',
                            success: false,
                            message: 'Page redirected'
                        });
                        viewState.pendingState = undefined;
                        return;
                    }

                    // Restore State using Robust Logic
                    try {
                        await this.restoreViewState(viewState, state);
                        viewState.pendingState = undefined;
                    } catch (e) {
                        logError(`Failed to restore state for ${pageId}:`, e);
                        this.mainWindow.webContents.send('view:restore-result', {
                            pageId,
                            method: 'none',
                            success: false,
                            message: 'Restore failed'
                        });
                    }
                }).catch(e => {
                    logError(`Failed to execute restore delay for ${pageId}:`, e);
                });
            } else {
                log(`View ${pageId} loaded, no state to restore`);
            }
        });

        // REMOVED: Duplicate view.webContents.once('did-finish-load') handler to prevent race conditions.
        // The logic is now consolidated into the single listener above.

        // NOTE: Google Sign-In is blocked by Google (not Continuum)
        // Google officially blocks all embedded browsers (Electron, WebView, etc.)
        // No workaround exists - users must use Safari for Google services

        // Track navigation
        view.webContents.on('did-navigate', (_, newUrl) => {
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:url-updated', { flowId, pageId, url: newUrl });
        });
        view.webContents.on('did-navigate-in-page', (_, newUrl) => {
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:url-updated', { flowId, pageId, url: newUrl });
        });
        view.webContents.on('page-title-updated', (_, title) => {
            if (this.mainWindow.isDestroyed()) return;
            this.mainWindow.webContents.send('view:title-updated', { flowId, pageId, title });
        });

        // Continuum-style Context Menu (workspace-first, purposeful)
        view.webContents.on('context-menu', (_event, params) => {
            const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
            const currentUrl = view.webContents.getURL();
            const pageTitle = view.webContents.getTitle();

            // === TEXT SELECTION MENU ===
            if (params.selectionText && params.selectionText.trim().length > 0) {
                const selectedText = params.selectionText.trim();

                menuTemplate.push(
                    {
                        label: 'Add Selection to Notes',
                        click: () => {
                            this.mainWindow.webContents.send('send-to-notes', {
                                text: selectedText,
                                url: currentUrl,
                                title: pageTitle,
                                flowId,
                            });
                        }
                    },
                    { type: 'separator' },
                    { label: 'Copy', role: 'copy' },
                    {
                        label: 'Search Selection',
                        click: () => {
                            this.mainWindow.webContents.send('search-selection', {
                                text: selectedText,
                                flowId,
                            });
                        }
                    },
                    { type: 'separator' },
                    { label: 'Select All', role: 'selectAll' }
                );
            }
            // === LINK MENU ===
            else if (params.linkURL) {
                menuTemplate.push(
                    {
                        label: 'Open Link in Current Workspace',
                        click: () => {
                            this.mainWindow.webContents.send('open-url-in-workspace', {
                                url: params.linkURL,
                                flowId,
                                newPage: true,
                            });
                        }
                    },
                    {
                        label: 'Open Link in New Workspace',
                        click: () => {
                            this.mainWindow.webContents.send('open-url-in-new-workspace', {
                                url: params.linkURL,
                            });
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Copy Link',
                        click: () => {
                            clipboard.writeText(params.linkURL);
                        }
                    },
                    {
                        label: 'Save Link to Notes',
                        click: () => {
                            this.mainWindow.webContents.send('send-to-notes', {
                                text: `[${params.linkText || params.linkURL}](${params.linkURL})`,
                                url: currentUrl,
                                title: pageTitle,
                                flowId,
                            });
                        }
                    }
                );
            }
            // === IMAGE MENU ===
            else if (params.srcURL && params.mediaType === 'image') {
                menuTemplate.push(
                    {
                        label: 'Save Image',
                        click: () => {
                            view.webContents.downloadURL(params.srcURL);
                        }
                    },
                    {
                        label: 'Copy Image',
                        click: () => {
                            view.webContents.copyImageAt(params.x, params.y);
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Add Image to Notes',
                        click: () => {
                            this.mainWindow.webContents.send('send-to-notes', {
                                text: `![Image](${params.srcURL})`,
                                url: currentUrl,
                                title: pageTitle,
                                flowId,
                            });
                        }
                    }
                );
            }
            // === NORMAL PAGE MENU ===
            else {
                menuTemplate.push(
                    {
                        label: '⭐ Add to Favorites Bar',
                        click: () => {
                            // Get favicon from the page
                            view.webContents.executeJavaScript(`
                                (function() {
                                    var link = document.querySelector('link[rel*="icon"]') || document.querySelector('link[rel="shortcut icon"]');
                                    return link ? link.href : '';
                                })()
                            `).then((favicon: string) => {
                                this.mainWindow.webContents.send('favorites:add-current', {
                                    url: currentUrl,
                                    title: pageTitle,
                                    favicon: favicon || '',
                                });
                            }).catch(() => {
                                this.mainWindow.webContents.send('favorites:add-current', {
                                    url: currentUrl,
                                    title: pageTitle,
                                    favicon: '',
                                });
                            });
                        }
                    },
                    {
                        label: 'Add Page to Workspace',
                        click: () => {
                            this.mainWindow.webContents.send('add-page-to-workspace', {
                                url: currentUrl,
                                title: pageTitle,
                                flowId,
                            });
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Copy Page Link',
                        click: () => {
                            require('electron').clipboard.writeText(currentUrl);
                        }
                    },
                    {
                        label: 'Reload Page',
                        click: () => {
                            view.webContents.reload();
                        }
                    },
                    { type: 'separator' },
                    { label: 'Back', click: () => view.webContents.goBack(), enabled: view.webContents.canGoBack() },
                    { label: 'Forward', click: () => view.webContents.goForward(), enabled: view.webContents.canGoForward() }
                );

                // Dev mode only
                if (DEV_MODE) {
                    menuTemplate.push(
                        { type: 'separator' },
                        { label: 'Inspect Element', click: () => view.webContents.inspectElement(params.x, params.y) }
                    );
                }
            }

            if (menuTemplate.length > 0) {
                const menu = Menu.buildFromTemplate(menuTemplate);
                menu.popup();
            }
        });

        // Enable auto-resize
        view.setAutoResize({ width: true, height: true });

        // Handle HTML5 fullscreen (YouTube, etc.)
        view.webContents.on('enter-html-full-screen', () => {
            log(`View ${pageId} entered fullscreen`);
            // Expand view to cover entire window
            const [windowWidth, windowHeight] = this.mainWindow.getSize();
            view.setBounds({ x: 0, y: 0, width: windowWidth, height: windowHeight });
            this.mainWindow.webContents.send('view:fullscreen-changed', { pageId, isFullscreen: true });
        });

        view.webContents.on('leave-html-full-screen', () => {
            log(`View ${pageId} left fullscreen`);
            // Restore original bounds
            view.setBounds(this.currentBounds);
            this.mainWindow.webContents.send('view:fullscreen-changed', { pageId, isFullscreen: false });
        });

        // Load URL with explicit User-Agent for the initial request
        // ContinuumShield: Pre-navigation safe browsing check for initial page load
        if (this.shield && this.shield.getConfig().safeBrowsingEnabled) {
            this.shield.checkNavigation(url).then(assessment => {
                if (assessment && assessment.riskScore >= 70) {
                    const interstitialHtml = this.shield!.getThreatInterstitialHtml(
                        url, assessment.riskScore, assessment.threats, assessment.details
                    );
                    view.webContents.loadURL(
                        `data:text/html;charset=utf-8,${encodeURIComponent(interstitialHtml)}`
                    );
                    this.mainWindow.webContents.send('shield:threat-detected', {
                        flowId, pageId, url,
                        riskScore: assessment.riskScore,
                        threats: assessment.threats,
                        details: assessment.details,
                    });
                } else {
                    view.webContents.loadURL(url);
                }
            }).catch(() => view.webContents.loadURL(url));
        } else {
            view.webContents.loadURL(url);
        }
    }

    // @ts-ignore - COMPLETELY DISABLED: This function breaks Google sign-in
    // Working Dec 26 version has NO session interceptors at all
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _configureSession(_session: Electron.Session) {
        // INTENTIONALLY EMPTY - Do not add any session manipulation here
        // The working version has ZERO onBeforeSendHeaders calls
    }

    selectView(flowId: string, pageId: string | null, url?: string, state?: any) {
        console.log(`[ViewManager] selectView called:`, { flowId, pageId, url, hasState: !!state, stateInfo: state ? { scrollY: state.scrollY } : null });
        // If flowId changes, we might need to detach current view
        if (this.activeView) {
            // Tab hidden -> Start 30s timer
            // DISABLED: tabSecurityManager breaks Google sign-in
            // this.tabSecurityManager.handleTabVisibilityChange(this.activeView.view.webContents.id, false);

            this.mainWindow.removeBrowserView(this.activeView.view);
            this.activeView = null;
        }

        if (!pageId) {
            // Just clearing the view (e.g. going to flow overview)
            return;
        }

        // Lazy Creation / Restoration
        if (!this.views.has(flowId)) {
            this.views.set(flowId, new Map());
        }

        const flowViews = this.views.get(flowId)!;
        let viewState = flowViews.get(pageId);

        if (!viewState) {
            if (url) {
                console.log(`[ViewManager] View ${pageId} not found, creating with state...`);
                // Create it now with state for restoration
                this.createView(flowId, pageId, url, state);
                viewState = flowViews.get(pageId);
            } else {
                console.warn(`[ViewManager] View ${pageId} not found and no URL provided.`);
                return;
            }
        } else if (state) {
            // View exists but we have new state to restore
            viewState.pendingState = state;
        }

        if (!viewState) return;

        this.mainWindow.addBrowserView(viewState.view);
        viewState.view.setBounds(this.currentBounds);
        // Ensure the view has focus for biometrics/input
        viewState.view.webContents.focus();
        this.activeView = viewState;

        // Notify external systems (e.g., extension APIs) about the active tab
        this.onTabSelected?.(viewState.view.webContents);

        // Tab visible -> Clear timer
        // DISABLED: tabSecurityManager breaks Google sign-in
        // this.tabSecurityManager.handleTabVisibilityChange(viewState.view.webContents.id, true);
    }

    removeView(flowId: string, pageId: string) {
        const flowViews = this.views.get(flowId);
        if (!flowViews) return;

        const viewState = flowViews.get(pageId);
        if (!viewState) return;

        // Stop monitoring
        // DISABLED: tabSecurityManager breaks Google sign-in
        // this.tabSecurityManager.stopMonitoring(viewState.view.webContents.id);

        // If active, detach
        if (this.activeView === viewState) {
            this.mainWindow.removeBrowserView(viewState.view);
            this.activeView = null;
        }

        // Destroy
        // viewState.view.webContents.destroy(); // Optional, but good for cleanup
        // (BrowserView doesn't have destroy(), but we drop the reference. 
        //  The WebContents underneath will be collected eventually or explicitly destroyed if we want)
        (viewState.view.webContents as any).destroy();

        flowViews.delete(pageId);
    }

    // Remove ALL views for a flow (called when flow is deleted)
    removeFlowViews(flowId: string) {
        const flowViews = this.views.get(flowId);
        if (!flowViews) return;

        // Destroy all views in this flow
        for (const [pageId, viewState] of flowViews) {
            // If active, detach first
            if (this.activeView === viewState) {
                this.mainWindow.removeBrowserView(viewState.view);
                this.activeView = null;
            }
            // Destroy the webcontents
            (viewState.view.webContents as any).destroy();
            log(`Destroyed view ${pageId} for deleted flow ${flowId}`);
        }

        // Remove the entire flow from the map
        this.views.delete(flowId);
        log(`Removed all views for flow ${flowId}`);
    }

    /**
     * Simple Google Login: Opens Safari for authentication
     * Safari is a trusted browser that Google will not block.
     */
    private async performGoogleLogin(_targetUrl: string, _pageId: string) {
        const { shell } = require('electron');
        // Open Google sign-in in Safari (trusted browser)
        shell.openExternal('https://accounts.google.com/ServiceLogin');
        log('[GoogleLogin] Opened Safari for Google sign-in');
    }
}
