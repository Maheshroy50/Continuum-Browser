import { BrowserView, BrowserWindow, ipcMain, Menu, WebContents } from 'electron';
import { BlockerEngine } from './BlockerEngine';
import { AD_BLOCKING_CSS } from './CosmeticFilters';
import { YOUTUBE_BLOCKER_SCRIPT } from './YouTubeBlocker';

// DEV_MODE: Toggle verbose logging (set to false for production)
const DEV_MODE = process.env.NODE_ENV !== 'production';

// Conditional logging helper
const log = (...args: any[]) => DEV_MODE && console.log('[ViewManager]', ...args);
const logWarn = (...args: any[]) => console.warn('[ViewManager]', ...args);
const logError = (...args: any[]) => console.error('[ViewManager]', ...args);

// Restore result type for feedback to renderer
type RestoreMethod = 'anchor' | 'ratio' | 'pixel' | 'top' | 'none';

interface RestoreResult {
    method: RestoreMethod;
    success: boolean;
    message?: string;
}

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
    // DISABLED: These were breaking Google sign-in
    // public tabSecurityManager: TabSecurityManager;
    // public httpsUpgrader: HttpsUpgrader;

    // Map<flowId, Map<pageId, ViewState>>
    private views: Map<string, Map<string, ViewState>> = new Map();
    private activeView: ViewState | null = null;
    private currentBounds: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
    private onTabSelected?: (contents: WebContents) => void;

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

    destroy() {
        ipcMain.removeHandler('view:create');
        ipcMain.removeHandler('view:select');
        ipcMain.removeHandler('view:resize');
        ipcMain.removeHandler('view:remove');
        ipcMain.removeHandler('view:update-url');
        this.views.clear();
    }

    private setupIPC() {
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

        ipcMain.handle('view:update-url', (_, url: string) => {
            if (this.activeView) {
                return this.activeView.view.webContents.loadURL(url);
            }
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
            if (this.activeView) {
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
                                    offset: scrollY - el.offsetTop
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

            const targetX = state.scrollX || 0;
            const targetY = state.scrollY || 0;
            const anchor = state.anchor;

            // DOM Anchor restoration - finds text first, more resilient to layout changes
            const attemptAnchorRestore = async (): Promise<boolean> => {
                if (!anchor || !anchor.text) return false;

                try {
                    const success = await viewState.view.webContents.executeJavaScript(`
                        (() => {
                            const anchor = ${JSON.stringify(anchor)};
                            const candidates = [...document.querySelectorAll(anchor.tag.toLowerCase() + ', p, h1, h2, h3, h4, li')];
                            
                            // Find element containing the anchor text
                            const match = candidates.find(el => 
                                el.innerText && el.innerText.includes(anchor.text.slice(0, 80))
                            );
                            
                            if (match) {
                                const targetY = match.offsetTop + anchor.offset;
                                window.scrollTo(0, targetY);
                                console.log('[Flow] Anchor restored to:', match.tagName, targetY);
                                return true;
                            }
                            return false;
                        })();
                    `);

                    if (success) {
                        console.log('[ViewManager] Anchor-based restore succeeded');
                        return true;
                    }
                } catch (e) {
                    console.error('[ViewManager] Anchor restore failed:', e);
                }
                return false;
            };

            // Fallback: Self-healing scroll restoration with retry logic
            const attemptScrollRestore = async (tries: number = 0): Promise<void> => {
                if (tries > 5) {
                    console.log('[ViewManager] Scroll restore: max retries reached, accepting current position');
                    return;
                }

                try {
                    const result = await viewState.view.webContents.executeJavaScript(`
                        (() => {
                            const targetX = ${targetX};
                            const targetY = ${targetY};
                            
                            const el = document.scrollingElement || document.documentElement;
                            el.scrollTop = targetY;
                            el.scrollLeft = targetX;
                            window.scrollTo(targetX, targetY);
                            
                            const actualY = document.scrollingElement?.scrollTop ?? window.scrollY;
                            const actualX = document.scrollingElement?.scrollLeft ?? window.scrollX;
                            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                            
                            console.log('[Flow] Scroll attempt:', { targetY, actualY, maxScroll, diff: Math.abs(actualY - targetY) });
                            
                            return { actualY, actualX, maxScroll };
                        })();
                    `);

                    const yDiff = Math.abs(result.actualY - targetY);
                    const xDiff = Math.abs(result.actualX - targetX);

                    // Success conditions:
                    // 1. Within 50px tolerance
                    // 2. We scrolled to max possible (page shorter than saved position)
                    // 3. Target was 0 and we're at 0
                    const isAtMax = result.actualY >= result.maxScroll - 10;
                    const isAtTop = targetY === 0 && result.actualY === 0;

                    if (yDiff <= 50 || xDiff <= 50 || isAtMax || isAtTop) {
                        console.log('[ViewManager] Scroll restored on attempt', tries + 1,
                            isAtMax ? '(at max)' : isAtTop ? '(at top)' : '');
                    } else {
                        setTimeout(() => attemptScrollRestore(tries + 1), 400);
                    }
                } catch (e) {
                    console.error('[ViewManager] Scroll attempt error:', e);
                    if (tries < 5) {
                        setTimeout(() => attemptScrollRestore(tries + 1), 400);
                    }
                }
            };

            // Ratio-based restore - uses scroll percentage
            const attemptRatioRestore = async (): Promise<boolean> => {
                const scrollRatio = state.scrollRatio;
                if (!scrollRatio || scrollRatio === 0) return false;

                try {
                    const success = await viewState.view.webContents.executeJavaScript(`
                        (() => {
                            const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                            const targetY = Math.round(${scrollRatio} * docHeight);
                            window.scrollTo(0, targetY);
                            
                            const actualY = window.scrollY;
                            const diff = Math.abs(actualY - targetY);
                            console.log('[Flow] Ratio restore:', { ratio: ${scrollRatio}, targetY, actualY, diff });
                            
                            return diff < 100; // Success if within 100px
                        })();
                    `);

                    if (success) {
                        console.log('[ViewManager] Ratio-based restore succeeded');
                        return true;
                    }
                } catch (e) {
                    console.error('[ViewManager] Ratio restore failed:', e);
                }
                return false;
            };

            const restoreAll = async () => {
                try {
                    // CASCADING RESTORE STRATEGY
                    // 1. Try anchor-based restore first (most resilient)
                    const anchorWorked = await attemptAnchorRestore();

                    if (!anchorWorked) {
                        // 2. Try ratio-based restore (handles page length changes)
                        const ratioWorked = await attemptRatioRestore();

                        if (!ratioWorked) {
                            // 3. Fall back to pixel-based restore with retries
                            await attemptScrollRestore(0);
                        }
                    }

                    // Restore form data
                    if (state.formData && Object.keys(state.formData).length > 0) {
                        await viewState.view.webContents.executeJavaScript(`
                            const data = ${JSON.stringify(state.formData)};
                            Object.entries(data).forEach(([key, value]) => {
                                const el = document.getElementById(key) || document.querySelector('[name="' + key + '"]');
                                if (el) el.value = value;
                            });
                        `);
                    }

                    // Restore zoom
                    if (state.zoomFactor) {
                        viewState.view.webContents.setZoomFactor(state.zoomFactor);
                    }
                } catch (e) {
                    console.error('[ViewManager] Failed to restore state:', e);
                }
            };

            // Check if page is still loading
            if (viewState.view.webContents.isLoading()) {
                // Wait for page to finish loading
                viewState.view.webContents.once('did-finish-load', async () => {
                    // Wait for double requestAnimationFrame to ensure layout is complete
                    await viewState.view.webContents.executeJavaScript(`
                        new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                    `);
                    await restoreAll();
                });
            } else {
                // Page already loaded, wait for double rAF then restore
                await viewState.view.webContents.executeJavaScript(`
                    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                `);
                await restoreAll();
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
            }
            return this.selectView(flowId, pageId);
        }

        const view = new BrowserView({
            webPreferences: {
                // NOTE: Removed partition to ensure extensions (loaded in defaultSession) attach to all views
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                // Performance: disable spellcheck to reduce CPU usage during video playback
                spellcheck: false,
                // Performance: disable devtools in production
                devTools: DEV_MODE,
                // Enable scroll bounce for "native" feel (helps with swipe nav consistency)
                scrollBounce: true,
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

        // Attach Ad Blocker
        this.blockerEngine.attach(view.webContents.session);

        // Spoof User Agent to Firefox to bypass Google's "This browser is not secure" check
        // MOVED TO MAIN.TS (Smart Stealth Strategy) - Do NOT force it here or it breaks YouTube
        // const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0';
        // view.webContents.setUserAgent(userAgent);

        view.webContents.on('did-start-loading', () => {
            // Global Stealth Script is already injected via main.ts (web-contents-created)

            if (viewState.isInterstitial) {
                viewState.isInterstitial = false;
                // Don't auto-show here, let UI control it, but unblock the flag
            }
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
                            sandbox: true
                        }
                    }
                };
            }

            // 3. FLATTEN EVERYTHING ELSE
            // If the site tries to open a new tab/window (target="_blank"), 
            // force it to load in the CURRENT view instead of opening an ugly native window.
            console.log(`[ViewManager] Flattening popup: ${url}`);
            view.webContents.loadURL(url);
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

        // DISABLED: configureSession strips Client Hints headers which triggers Google detection
        // this.configureSession(view.webContents.session);

        flowViews.set(pageId, viewState);

        // EVENT-DRIVEN SCROLL RESTORATION
        // This is the ONLY place where scroll restore should happen
        view.webContents.on('did-finish-load', () => {
            // Inject Cosmetic Ad Filters
            if (this.blockerEngine.getStatus().isEnabled) {
                view.webContents.insertCSS(AD_BLOCKING_CSS).catch(() => { });

                // Inject YouTube Blocker
                if (view.webContents.getURL().includes('youtube.com')) {
                    view.webContents.executeJavaScript(YOUTUBE_BLOCKER_SCRIPT).catch(() => { });
                }
            }
        });

        view.webContents.once('did-finish-load', async () => {
            const state = viewState.pendingState;
            let restoreResult: RestoreResult = { method: 'none', success: true };

            if (!state) {
                log(`View ${pageId} loaded, no state to restore`);
                return;
            }

            log(`View ${pageId} loaded, restoring state...`, {
                scrollY: state.scrollY,
                scrollRatio: state.scrollRatio?.toFixed(3),
                hasAnchor: !!state.anchor
            });

            try {
                // Wait for double requestAnimationFrame to ensure layout is stable
                await view.webContents.executeJavaScript(`
                    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                `);

                // Check if URL changed (redirect detection)
                const currentUrl = view.webContents.getURL();
                const originalUrl = viewState.url;
                if (currentUrl !== originalUrl && !currentUrl.includes(new URL(originalUrl).hostname)) {
                    logWarn(`View ${pageId} redirected: ${originalUrl} -> ${currentUrl}`);
                    restoreResult = { method: 'none', success: false, message: 'Page redirected' };
                    this.mainWindow.webContents.send('view:restore-result', { pageId, ...restoreResult });
                    viewState.pendingState = undefined;
                    return;
                }

                // Now restore scroll position
                const targetY = state.scrollY || 0;
                const targetX = state.scrollX || 0;
                const anchor = state.anchor;

                // CASCADING RESTORE STRATEGY
                // 1. Try anchor-based restore first (most resilient)
                let restored = false;
                if (anchor && anchor.text) {
                    try {
                        const anchorText = anchor.text.slice(0, 60).replace(/'/g, "\\'").replace(/\n/g, ' ');
                        restored = await view.webContents.executeJavaScript(`
                            (() => {
                                const candidates = [...document.querySelectorAll('${anchor.tag?.toLowerCase() || 'p'}, p, h1, h2, h3, li')];
                                const match = candidates.find(el => el.innerText && el.innerText.includes('${anchorText}'));
                                if (match) {
                                    window.scrollTo(0, match.offsetTop + ${anchor.offset || 0});
                                    return true;
                                }
                                return false;
                            })();
                        `);
                        if (restored) {
                            log(`View ${pageId} anchor-restored`);
                            restoreResult = { method: 'anchor', success: true, message: 'Restored exactly where you left off' };
                        }
                    } catch (e) {
                        log(`View ${pageId} anchor restore failed:`, e);
                    }
                }

                // 2. Fallback to ratio-based (handles dynamic content)
                if (!restored && state.scrollRatio && state.scrollRatio > 0) {
                    try {
                        await view.webContents.executeJavaScript(`
                            const docHeight = document.documentElement.scrollHeight;
                            window.scrollTo(0, Math.round(${state.scrollRatio} * docHeight));
                        `);
                        log(`View ${pageId} ratio-restored at ${(state.scrollRatio * 100).toFixed(0)}%`);
                        restoreResult = { method: 'ratio', success: true, message: 'Resumed near last position' };
                        restored = true;
                    } catch (e) {
                        log(`View ${pageId} ratio restore failed:`, e);
                    }
                }

                // 3. Fallback to pixel-based (exact position)
                if (!restored && targetY > 0) {
                    try {
                        await view.webContents.executeJavaScript(`
                            window.scrollTo(${targetX}, ${targetY});
                        `);
                        log(`View ${pageId} pixel-restored to ${targetY}px`);
                        restoreResult = { method: 'pixel', success: true, message: 'Resumed near last position' };
                        restored = true;
                    } catch (e) {
                        log(`View ${pageId} pixel restore failed:`, e);
                    }
                }

                // 4. If all fail, stay at top with feedback
                if (!restored && targetY > 0) {
                    logWarn(`View ${pageId} restore failed, staying at top`);
                    restoreResult = { method: 'top', success: false, message: 'Could not restore position' };
                }

                // Restore zoom
                if (state.zoomFactor) {
                    view.webContents.setZoomFactor(state.zoomFactor);
                }

                // Clear pending state
                viewState.pendingState = undefined;

                // Send restore result to renderer for toast notification
                this.mainWindow.webContents.send('view:restore-result', { pageId, ...restoreResult });

            } catch (e) {
                logError(`Failed to restore state for ${pageId}:`, e);
                this.mainWindow.webContents.send('view:restore-result', {
                    pageId,
                    method: 'none',
                    success: false,
                    message: 'Restore failed'
                });
            }
        });

        // NOTE: Google Sign-In is blocked by Google (not Continuum)
        // Google officially blocks all embedded browsers (Electron, WebView, etc.)
        // No workaround exists - users must use Safari for Google services

        // Track navigation
        view.webContents.on('did-navigate', (_, newUrl) => {
            this.mainWindow.webContents.send('view:url-updated', { flowId, pageId, url: newUrl });
        });
        view.webContents.on('did-navigate-in-page', (_, newUrl) => {
            this.mainWindow.webContents.send('view:url-updated', { flowId, pageId, url: newUrl });
        });
        view.webContents.on('page-title-updated', (_, title) => {
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
                            require('electron').clipboard.writeText(params.linkURL);
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
        view.webContents.loadURL(url);
    }

    // @ts-ignore - COMPLETELY DISABLED: This function breaks Google sign-in
    // Working Dec 26 version has NO session interceptors at all
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _configureSession(_session: Electron.Session) {
        // INTENTIONALLY EMPTY - Do not add any session manipulation here
        // The working version has ZERO onBeforeSendHeaders calls
    }

    selectView(flowId: string, pageId: string | null, url?: string, state?: any) {
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
