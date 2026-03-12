// @ts-ignore - eval-based require to bypass vite-plugin-electron bundler interop issue
const nodeRequire = eval('require');
const electronModule = nodeRequire('electron') as typeof import('electron')
const { app, BrowserWindow, shell, /* session, */ ipcMain, dialog, globalShortcut, nativeTheme } = electronModule
// @ts-ignore
const session = electronModule.session; // Keep session available for future use without import error
import type { BrowserWindow as BrowserWindowType } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { ViewManager } from './ViewManager'
import { BlockerEngine } from './BlockerEngine'
// DISABLED: Not in working Dec 26 version
// import { PrivacyManager } from './PrivacyManager'
// import { DownloadManager } from './DownloadManager'
import { DownloadManager } from './DownloadManager'
import { AIService } from './AIService'
import { MODEL_REGISTRY } from './ModelRegistry'
import { WebAuthnManager } from './WebAuthnManager'
import { autoUpdater } from 'electron-updater'
import { initializeAgentGateway, agentGateway, agentMemory } from './agent'
import { ResumeParser } from './agent/ResumeParser'
import { WorkflowEngine } from './agent/WorkflowEngine'
import { PopupManager } from './PopupManager'
import { ContinuumShield } from './ContinuumShield'
// import { userAgentService } from './UserAgentService'
// @ts-ignore
import { userAgentService } from './UserAgentService'

// Global Error Handlers
process.on('uncaughtException', (error) => {
    console.error('[CRITICAL] Uncaught Exception:', error);
    // Write to a crash log file if possible
    try {
        const crashLogPath = path.join(app.getPath('userData'), 'crash.log');
        fs.appendFileSync(crashLogPath, `[${new Date().toISOString()}] Uncaught Exception: ${error.stack || error}\n`);
    } catch (e) {
        console.error('Failed to write crash log:', e);
    }
});

// WIDEVINE HEIST REVISED: Version-Agnostic Setup
// We use the `electron-widevine-cdm` helper if available, or fall back to local Chrome.
// Since `electron-widevine-cdm` installation failed (404), we will implement a
// robust path finder for a compatible CDM if the user manually provides one,
// OR we just rely on the existing Chrome Heist but warn about version mismatch.
//
// NOTE: For now, we keep the Heist active because it's the only chance we have
// without a custom build. The mismatch (v144 vs v134) might be bridgeable for L3.
/*
function setupWidevine() {
    // MANUAL CDM OVERRIDE for Castlabs Electron
    // Castlabs component updater often fails in dev, so we force the path to our manually downloaded CDM (v132)
    try {
        // 1. Check Local 'widevine' folder (Manual Override)
        // Note: __dirname is usually 'dist-electron', so '../widevine' points to project root 'widevine'
        const localCdmPath = path.join(__dirname, '../widevine/libwidevinecdm.dylib');
        if (fs.existsSync(localCdmPath)) {
            console.log(`[Widevine] Found LOCAL CDM at: ${localCdmPath}`);
            app.commandLine.appendSwitch('widevine-cdm-path', localCdmPath);
            // Updated to match the Chrome 132 CDM version we extracted
            app.commandLine.appendSwitch('widevine-cdm-version', '4.10.2830.0'); 
            return;
        }
    } catch (e) {
        console.error('[Widevine] Failed to setup local CDM:', e);
    }

    // Fallback to automatic (might fail)
    console.log('[Widevine] Skipping manual setup - using @castlabs/electron components API');
    return;
}

// Execute Setup
setupWidevine();
*/

process.on('unhandledRejection', (reason) => {
    console.error('[CRITICAL] Unhandled Rejection:', reason);
});

// Startup Diagnostics
function runDiagnostics() {
    console.log('=== Startup Diagnostics ===');
    console.log('Node Version:', process.version);
    console.log('Electron Version:', process.versions.electron);
    console.log('Platform:', process.platform);
    console.log('Arch:', process.arch);
    try {
        console.log('User Data Path:', app.getPath('userData'));
        console.log('App Path:', app.getAppPath());
    } catch (e) {
        console.error('Failed to get paths:', e);
    }
    console.log('===========================');
}

// The built directory structure
//
// ├─┬─ dist
// │ ├── index.html
// │ ├── assets
// │ └── ...
// ├─┬─ dist-electron
// │ ├── main.js
// │ └── preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
// Note: VITE_PUBLIC is set in createWindow() after app is ready to avoid timing issues

// DEBUG: Force local user data to avoid corruption/permissions issues during crash investigation
// ONLY IN DEV MODE: In production, we must use the standard system path because we can't write into the ASAR
/* 
if (!app.isPackaged) {
    const localUserData = path.join(__dirname, '../.continuum-userdata');
    if (!fs.existsSync(localUserData)) {
        fs.mkdirSync(localUserData, { recursive: true });
    }
    app.setPath('userData', localUserData);
    console.log('[Main] User Data overridden to:', localUserData);
}
*/

let win: BrowserWindowType | null
let overlayWin: BrowserWindowType | null = null
let pendingOverlayOpen: boolean | null = null
let aiPanelOpen = false
let viewManager: ViewManager | null = null
let blockerEngine: BlockerEngine | null = null
// DISABLED: Not in working Dec 26 version
// let privacyManager: PrivacyManager | null = null
// let downloadManager: DownloadManager | null = null
let downloadManager: DownloadManager | null = null
let aiService: AIService | null = null
export let workflowEngine: WorkflowEngine | null = null;
let popupManager: PopupManager | null = null;
let shieldEngine: ContinuumShield | null = null;

// Register protocol
// Stealth Mode: Disable Automation features to improve Google Sign-In success
// app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled'); // REMOVED: Causes crash on newer Electron versions
// REMOVED: 'disable-features', 'IsolateOrigins,site-per-process' - Causes "Mach rendezvous failed" crash on macOS
app.commandLine.appendSwitch('disable-site-isolation-trials'); // CRASH FIX: Reduces process count and shared memory usage

// ENABLE WEBAUTHN (TOUCH ID) SUPPORT
// Ensure WebAuthn is enabled (it is by default, but explicit flags help in some environments)
app.commandLine.appendSwitch('enable-webauthn');
app.commandLine.appendSwitch('enable-features', 'WebAuthenticationTouchIdLocalPasskeys');

// ENABLE WIDEVINE DRM (Netflix, Udemy, Spotify)
// Essential for video playback. 'no-verify' allows it to run in unsigned builds/dev mode.
// Even with Castlabs, dev builds often need this to bypass strict VMP checks.
app.commandLine.appendSwitch('no-verify-widevine-cdm');
app.commandLine.appendSwitch('enable-widevine-cdm');
app.commandLine.appendSwitch('force-renderer-accessibility'); // Helps with some DRM overlays

// PRIVACY & SECURITY HARDENING
// 1. HTTPS-Only Mode (Force Secure Connections)
app.commandLine.appendSwitch('https-only-mode');

// 2. DNS over HTTPS (DoH) - Prevent DNS Snooping
// Using Google DNS for reliability, but could be Cloudflare (1.1.1.1)
app.commandLine.appendSwitch('dns-over-https-server', 'https://dns.google/dns-query');
app.commandLine.appendSwitch('dns-over-https-mode', 'automatic');

// 3. WebRTC IP Leak Protection (Policy Level)
// Forces WebRTC to only use the default public interface or proxy, preventing local IP leaks
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');

// 4. Block Third-Party Cookies (Experimental Flag)
// Note: This might break some legacy auth flows, but is standard for privacy
// app.commandLine.appendSwitch('enable-features', 'BlockThirdPartyCookies');


// CRASH FIX: Disable Hardware Acceleration
// "Mach rendezvous failed" can be caused by GPU process failures on macOS
// However, disabling it causes "Failed to create context" in BrowserView (white screen).
// We enable it (comment out disable) to ensure BrowserView renders correctly.
// app.disableHardwareAcceleration();

// GPU/Hardware Acceleration Optimizations
// REMOVED: Aggressive GPU flags can cause black screens on some macOS systems.
// We rely on default Hardware Acceleration (enabled above) which is sufficient for DRM.
// app.commandLine.appendSwitch('ignore-gpu-blocklist');
// app.commandLine.appendSwitch('enable-zero-copy');
// app.commandLine.appendSwitch('enable-gpu-rasterization');
// app.commandLine.appendSwitch('enable-accelerated-video-decode');

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('continuum', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('continuum')
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (_event, commandLine, _workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
        }

        // Protocol handler for Windows/Linux
        const url = commandLine.find(arg => arg.startsWith('continuum://'))
        if (url) {
            // Handle custom protocol URL if needed
            console.log('Received protocol URL:', url)
        }
    })

    // Protocol handler for macOS
    app.on('open-url', (event, url) => {
        event.preventDefault()
        if (url.startsWith('continuum://')) {
            // Handle custom protocol URL if needed
            console.log('Received protocol URL:', url)
        }
    })
}

// Startup Diagnostics
runDiagnostics();

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createOverlayWindow() {
    if (!win) return;
    if (overlayWin && !overlayWin.isDestroyed()) return;

    overlayWin = new BrowserWindow({
        title: 'Continuum Overlay',
        transparent: true,
        backgroundColor: '#00000000', // Transparent background
        frame: false,
        hasShadow: false,
        focusable: true, // Needs to be focusable for inputs
        skipTaskbar: true,
        parent: win, // Attach to main window
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Optimization for transparent windows
            backgroundThrottling: false,
        },
    });

    // Keep overlay above BrowserView/web content within the app window.
    overlayWin.setAlwaysOnTop(true, 'pop-up-menu');
    overlayWin.showInactive();

    // Ensure we don't capture focus on show (unless interacted with)
    overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Load URL with ?overlay=true
    if (VITE_DEV_SERVER_URL) {
        overlayWin.loadURL(`${VITE_DEV_SERVER_URL}?overlay=true`);
    } else {
        overlayWin.loadFile(path.join(process.env.DIST || '', 'index.html'), { search: '?overlay=true' });
    }

    // Default to click-through (ignore mouse events)
    // forward: true lets the click pass through to the window below (mainWindow)
    overlayWin.setIgnoreMouseEvents(true, { forward: true });

    // Sync bounds with main window
    const updateBounds = () => {
        if (!win || !overlayWin || win.isDestroyed() || overlayWin.isDestroyed()) return;
        // Match the main window's bounds exactly
        overlayWin.setBounds(win.getBounds());
    };

    win.on('move', updateBounds);
    win.on('resize', updateBounds);
    // Initial sync
    updateBounds();

    // Register with AgentGateway
    if (agentGateway) {
        agentGateway.setOverlayWindow(overlayWin);
    }

    overlayWin.webContents.on('did-finish-load', () => {
        if (pendingOverlayOpen !== null) {
            aiPanelOpen = pendingOverlayOpen;
            pendingOverlayOpen = null;
        }
        broadcastAIState();
    });

    // Cleanup
    overlayWin.on('closed', () => {
        overlayWin = null;
        pendingOverlayOpen = null;
        if (agentGateway) {
            agentGateway.setOverlayWindow(null);
        }
    });
}

function broadcastAIState() {
    if (win && !win.isDestroyed()) {
        win.webContents.send('ai:set-open', aiPanelOpen);
    }

    if (overlayWin && !overlayWin.isDestroyed()) {
        const sendToOverlay = () => {
            if (!overlayWin || overlayWin.isDestroyed()) return;
            overlayWin.webContents.send('ai:set-open', aiPanelOpen);
        };

        // Retry briefly to survive renderer mount/listener races.
        sendToOverlay();
        setTimeout(sendToOverlay, 100);
        setTimeout(sendToOverlay, 300);
    }
}

// IPC for Overlay Click-through
ipcMain.on('overlay:focus', () => {
    if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.setIgnoreMouseEvents(false);
        // We don't necessarily force focus, as it might steal from main window inappropriately?
        // But if user wants to type, we need focus.
        // AIPanel has inputs.
        // So yes, we might need focus?
        // Actually, if we just setIgnoreMouseEvents(false), the user can CLICK to focus.
        // If we force focus(), it might be abrupt.
        // Let's just enable events.
    }
});

ipcMain.on('overlay:blur', () => {
    if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.setIgnoreMouseEvents(true, { forward: true });
        // If the overlay had focus, we should probably return focus to the main window
        // to ensure keyboard shortcuts work there?
        if (win && !win.isDestroyed()) {
            win.focus();
        }
    }
});

ipcMain.on('overlay:renderer-ready', () => {
    if (pendingOverlayOpen !== null) {
        aiPanelOpen = pendingOverlayOpen;
        pendingOverlayOpen = null;
    }
    broadcastAIState();
});

// AI Toggle Handler
ipcMain.on('ai:toggle', () => {
    aiPanelOpen = !aiPanelOpen;

    if (!overlayWin || overlayWin.isDestroyed()) {
        createOverlayWindow();
    }

    if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.showInactive();
        if (overlayWin.webContents.isLoading()) {
            pendingOverlayOpen = aiPanelOpen;
        }
    }

    broadcastAIState();
});

function createWindow() {
    // Set VITE_PUBLIC here when app is ready (can't be done at module level)
    process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST || '', '../public')

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset', // Mac style title bar
        trafficLightPosition: { x: 16, y: 18 }, // Position inside sidebar
        // Neutral native fallback while the renderer bootstraps or if it fails to mount.
        backgroundColor: '#0b0e14',
        icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
    })

    // DEV_MODE only: Debug renderer output (causes IPC overhead in production)
    const DEV_MODE = !app.isPackaged;

    if (DEV_MODE) {
        // Updated to use the new object-based signature for Electron >= 35
        // @ts-ignore - Electron types might not be fully updated in local env
        win.webContents.on('console-message', (_event, ...args) => {
            // New signature: (event, details) where details is object
            // Old signature: (event, level, message, line, sourceId)
            
            const firstArg = args[0];
            if (typeof firstArg === 'object' && firstArg !== null) {
                const { level, message, line, sourceId } = firstArg;
                const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'INFO';
                console.log(`[Renderer][${levelStr}] ${message} (${sourceId}:${line})`);
            } else {
                // Fallback for older Electron versions or if types mismatch
                // Arguments: level, message, line, sourceId
                const [level, message, line, sourceId] = args;
                const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level as number] || 'INFO';
                console.log(`[Renderer][${levelStr}] ${message} (${sourceId}:${line})`);
            }
        });
    }

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[Renderer] did-fail-load', { errorCode, errorDescription, validatedURL });
    });

    win.webContents.on('render-process-gone', (_event, details) => {
        console.error('[Renderer] render-process-gone', details);
    });
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }

    // Initialize Managers
    // NOTE: PrivacyManager was breaking Google sign-in - disabled to match Dec 26 working version
    // try {
    //     privacyManager = new PrivacyManager(win)
    //     console.log('PrivacyManager initialized successfully')
    // } catch (err) {
    //     console.error('Failed to initialize PrivacyManager:', err)
    // }

    // WEBAUTHN & TOUCH ID CONFIGURATION
    // Configure session handlers for biometric and security key authentication
    // Must be done AFTER app is ready and session is available
    if (session.defaultSession) {
        // Comprehensive WebAuthn debugging
        session.defaultSession.on('select-hid-device', (event, details, callback) => {
            console.log('[Main] select-hid-device triggered:', details.deviceList?.length);
            console.log('[Main] HID device details:', JSON.stringify(details, null, 2));
            // Automatically select the first available HID device (Security Key)
            // This prevents the UI from hanging during Google Sign-In hardware key checks
            event.preventDefault();
            if (details.deviceList && details.deviceList.length > 0) {
                console.log('[Main] Selecting HID device:', details.deviceList[0].deviceId);
                callback(details.deviceList[0].deviceId);
            } else {
                console.log('[Main] No HID devices available');
                callback('');
            }
        });

        session.defaultSession.on('select-usb-device', (event, details, callback) => {
            console.log('[Main] select-usb-device triggered:', details.deviceList?.length);
            console.log('[Main] USB device details:', JSON.stringify(details, null, 2));
            event.preventDefault();
            if (details.deviceList && details.deviceList.length > 0) {
                console.log('[Main] Selecting USB device:', details.deviceList[0].deviceId);
                callback(details.deviceList[0].deviceId);
            } else {
                console.log('[Main] No USB devices available');
                callback('');
            }
        });

        // Monitor for WebAuthn credential creation/assertion events
        session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
            // WebRTC Leak Protection: Surgical Block
            // Block STUN/TURN requests to prevent IP leakage via WebRTC
            if (details.url.startsWith('stun:') || details.url.startsWith('turn:')) {
                console.log('[Security] Blocked WebRTC Leak Candidate:', details.url);
                callback({ cancel: true });
                return;
            }

            // Verbose logging disabled
            // if (details.url.includes('webauthn') || details.url.includes('credential')) {
            //     console.log('[Main] WebAuthn webRequest detected:', details.method, details.url);
            // }
            callback({});
        });

        // Global Header Injection (GPC & DRM Fixes)
        session.defaultSession.webRequest.onBeforeSendHeaders(
            { urls: ['<all_urls>'] },
            (details, callback) => {
                const requestHeaders = { ...details.requestHeaders };

                // 1. Global Privacy Control (GPC)
                // Signal to websites that the user does not want their data sold
                requestHeaders['Sec-GPC'] = '1';

                // 2. DRM & Compatibility Fixes (Specific Domains)
                const isDrmUrl = details.url.includes('udemy.com') ||
                    details.url.includes('shaka-player-demo.appspot.com') ||
                    details.url.includes('widevine.com') ||
                    details.url.includes('netflix.com');

                if (isDrmUrl) {
                    // Remove suspicious headers that might trigger bot detection
                    delete requestHeaders['X-Electron-Version'];

                    // Only log DRM/Auth related requests to reduce noise
                    if (details.url.includes('license') || details.url.includes('auth') || details.url.includes('drm') || details.url.includes('token') || details.url.includes('manifest') || details.method === 'POST') {
                        console.log(`[Main] DRM/License Request (${details.method}):`, details.url);
                        // console.log('[Main] Request Headers:', JSON.stringify(requestHeaders, null, 2));
                    }

                    // FORCE REFERER FOR UDEMY
                    // Udemy 403s often come from missing Referer/Origin on license requests
                    if (details.url.includes('udemy.com')) {
                        requestHeaders['Referer'] = 'https://www.udemy.com/';
                        requestHeaders['Origin'] = 'https://www.udemy.com';
                    }
                }

                callback({ requestHeaders: requestHeaders });
            }
        );

        session.defaultSession.webRequest.onHeadersReceived(
            { urls: ['<all_urls>'] }, // Capture all to selectively apply CSP
            (details, callback) => {
                const responseHeaders = { ...details.responseHeaders };

                // 1. Inject CSP for the Main App (Localhost / File protocol)
                // We identify the main app requests by checking if they are NOT external
                const isExternal = details.url.startsWith('http') &&
                    !details.url.includes('localhost') &&
                    !details.url.includes('127.0.0.1');

                // Also check if it's the dev server or local file
                const isApp = details.url.startsWith('file:') ||
                    details.url.includes('localhost') ||
                    details.url.includes('127.0.0.1');

                if (isApp && !isExternal) {
                    // Level 1 Strict CSP with 'unsafe-inline' for styles (Vite requirement)
                    // We allow 'unsafe-eval' only if absolutely necessary (Vite in dev mode might use it)
                    // But user requested strict if possible. 
                    // Vite usually needs 'unsafe-eval' for HMR overlays or certain dev tools.
                    // We will try without 'unsafe-eval' first, but if it breaks, we add it back.
                    // Recommended for React+Vite: script-src 'self' 'unsafe-inline' (for small inline scripts)

                    // NOTE: 'unsafe-inline' for script-src is risky, but Vite injects scripts.
                    // We'll use a robust policy:
                    // default-src 'self';
                    // script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; (Vite dev often needs inline)
                    // style-src 'self' 'unsafe-inline';
                    // img-src 'self' data: blob: https:;
                    // connect-src 'self' https: ws: wss:; (WebSockets for HMR)

                    responseHeaders['Content-Security-Policy'] = [[
                        "default-src 'self';",
                        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';",
                        "style-src 'self' 'unsafe-inline';",
                        "img-src 'self' data: blob: https:;",
                        "font-src 'self' data:;",
                        "connect-src 'self' https: ws: wss:;", // Allow WS for HMR
                        "worker-src 'self' blob:;" // For web workers
                    ].join(' ')];
                }

                // HTTP error logging suppressed — tracking/ad network 4xx errors are expected noise.
                callback({ responseHeaders: responseHeaders });
            }
        );

        // Ensure permissions for WebAuthn/Identity are granted
        session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, _details) => {
            // Permission request logged only for non-standard permissions (geo/media are expected)

            // WebAuthn often requires 'clipboard-read' for password managers
            if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
                console.log('[Main] Granting clipboard permission for WebAuthn');
                callback(true);
                return;
            }

            // Allow standard media permissions for auth (e.g. face unlock on web)
            if (permission === 'media' || permission === 'geolocation') {
                console.log('[Main] Granting media/geolocation permission for auth');
                callback(true);
                return;
            }

            // Widevine DRM Permission
            // @ts-ignore - 'protected-media-identifier' is valid but missing from some Electron type definitions
            if (permission === 'mediaKeySystem' || permission === 'protected-media-identifier') {
                console.log(`[Main] Granting ${permission} (Widevine DRM) permission`);
                callback(true);
                return;
            }

            // Explicitly allow general media access (camera/mic often grouped, but needed for some EME checks)
            // @ts-ignore
            if (permission === 'media') {
                console.log('[Main] Granting media permission for Protected Content');
                callback(true);
                return;
            }

            // Default allow
            callback(true);
        });

        // Add device permission handler for WebAuthn
        session.defaultSession.setDevicePermissionHandler((details) => {
            console.log('[Main] Device permission request:', details.deviceType, 'from:', details.origin);
            if (details.deviceType === 'hid' || details.deviceType === 'usb') {
                console.log('[Main] Granting device permission for WebAuthn device');
                return true;
            }
            return false;
        });

        console.log('[Main] WebAuthn & Touch ID handlers configured');
        console.log('[Main] WebAuthn feature flags enabled:', app.commandLine.hasSwitch('enable-webauthn'), app.commandLine.hasSwitch('enable-features'));

        // Widevine status logging is handled in top-level app.whenReady()
        console.log('[Main] DRM permission handlers configured');
    }

    // try {
    //     extensionManager = new ExtensionManager();
    //     console.log('ExtensionManager initialized (Safe Mode)');
    //
    //     // SAFE LOADING STRATEGY
    //     // Delay execution to ensure main process is stable and window is visible.
    //     // This prevents boot loops and gives the "CrashGuard" logic a chance to clean up on next run if it fails.
    //     setTimeout(() => {
    //         console.log('[Main] Triggering delayed extension loading...');
    //         // DISABLED: Extensions disabled for stability
    //         // extensionManager?.loadPersistedExtensions();
    //     }, 3000);
    //
    // } catch (err) {
    //     console.error('Failed to initialize ExtensionManager:', err);
    // }

    try {
        blockerEngine = new BlockerEngine()
        // blockerEngine.enable() // Active by default
        console.log('BlockerEngine initialized')
    } catch (err) {
        console.error('Failed to initialize BlockerEngine:', err)
    }

    try {
        viewManager = new ViewManager(win, blockerEngine!, (contents) => {
            // chromeExtensions?.selectTab(contents);

            // Notify AgentGateway of active view change
            if (agentGateway) {
                agentGateway.setActiveContents(contents);
            }
        })
        console.log('ViewManager initialized successfully')
    } catch (err) {
        console.error('Failed to initialize ViewManager:', err)
    }

    // DISABLED: DownloadManager and GoogleAuth not present in working Dec 26 version
    try {
        downloadManager = new DownloadManager(win)
        console.log('DownloadManager initialized successfully')
    } catch (err) {
        console.error('Failed to initialize DownloadManager:', err)
    }

    // Initialize Continuum Shield Security Engine
    try {
        shieldEngine = new ContinuumShield(win)
        console.log('🛡️ ContinuumShield initialized successfully')

        // Connect Shield to DownloadManager for quarantine
        if (downloadManager) {
            downloadManager.setShield(shieldEngine)
        }

        // Connect Shield to ViewManager for pre-navigation checks
        if (viewManager) {
            viewManager.setShield(shieldEngine)
        }
    } catch (err) {
        console.error('Failed to initialize ContinuumShield:', err)
    }

    try {
        new WebAuthnManager()
        console.log('WebAuthnManager initialized successfully')
    } catch (err) {
        console.error('Failed to initialize WebAuthnManager:', err)
    }

    try {
        aiService = new AIService()
        console.log('AIService initialized successfully')

        // Initialize AI Agent Gateway
        // const { initializeAgentGateway } = require('./agent')
        initializeAgentGateway(aiService)
        if (agentGateway) {
            agentGateway.setMainWindow(win)
            workflowEngine = new WorkflowEngine(agentGateway);
            console.log('WorkflowEngine initialized');
        }
        console.log('AgentGateway initialized successfully')

        // Allow ViewManager to update Agent with active view
        if (viewManager) {
            // Re-assign logic isn't clean here since viewManager is already created.
            // But we can just rely on the existing callback if we modify it below.
        }
    } catch (err) {
        console.error('Failed to initialize AIService/AgentGateway:', err)
    }

    // PopupManager must be initialized independently of AIService
    // so that privacy/download popups always work
    try {
        popupManager = new PopupManager(win);
        console.log('PopupManager initialized successfully');
    } catch (err) {
        console.error('Failed to initialize PopupManager:', err);
    }

    // Test active push message to Renderer-process.
    // Initialize Update Check
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();

        // Auto-download is true by default, but explicit is good
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
    }

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    // Create Overlay Window
    createOverlayWindow();

    win.on('closed', () => {
        if (viewManager) {
            viewManager.destroy();
            viewManager = null;
        }
        // DISABLED: Not in working Dec 26 version
        // if (privacyManager) {
        //     privacyManager.destroy();
        //     privacyManager = null;
        // }
        if (downloadManager) {
            downloadManager.destroy();
            downloadManager = null;
        }
        if (popupManager) {
            popupManager.closePopup();
            popupManager = null;
        }
        if (aiService) {
            aiService = null;
        }
        // Cleanup AgentGateway (singleton, but good practice to reset references)
        if (agentGateway) {
            agentGateway.setMainWindow(null);
            agentGateway.setActiveContents(null);
        }
        win = null
    })
}

// Capture state before quitting - ensures scroll position is saved on close
let isQuitting = false;
app.on('before-quit', async (e) => {
    if (isQuitting) return; // Already handling quit
    if (viewManager && win) {
        isQuitting = true;
        console.log('[Main] Capturing state before quit...');
        // Notify renderer to save current page state
        win.webContents.send('app:before-quit');
        // Give renderer time to capture and save state
        e.preventDefault();
        setTimeout(() => {
            app.exit(0);
        }, 500);
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(async () => {
    // CASTLABS WIDEVINE INIT — Must complete BEFORE createWindow()
    // This matches the StreamDock pattern: await components.whenReady() → createWindow()
    console.log('[Main] Electron Version:', process.versions.electron);
    console.log('[Main] Chrome Version:', process.versions.chrome);

    try {
        // @ts-ignore - components API is from Castlabs Electron fork
        if (electronModule.components) {
            console.log('[Main] Waiting for Widevine CDM components...');
            // @ts-ignore
            await electronModule.components.whenReady();
            // @ts-ignore
            const widevineStatus = electronModule.components.status();
            console.log('[Main] Widevine CDM ready:', JSON.stringify(widevineStatus));
        } else {
            console.warn('[Main] components API not found — not using Castlabs Electron fork?');
        }
    } catch (e) {
        console.error('[Main] Failed to initialize Widevine components:', e);
        // Continue anyway — non-DRM content should still work
    }

    try {
        // electron-chrome-extensions officially targets Electron >=35
        const electronMajor = parseInt(process.versions.electron.split('.')[0] || '0', 10);
        if (electronMajor < 35) {
            console.warn('[Extensions] Skipping electron-chrome-extensions (requires Electron >=35).');
        } else {
            // DISABLED: Temporarily disabling extensions to resolve "Mach rendezvous failed" crash
            // The conflict between BrowserView creation and extension attachment is causing shared memory failures.
            /*
            chromeExtensions = new ElectronChromeExtensions({
                session: session.defaultSession,
                license: 'GPL-3.0',
            });

            ElectronChromeExtensions.handleCRXProtocol(session.defaultSession);
            console.log('[Extensions] electron-chrome-extensions initialized');
            */
            console.log('[Extensions] Disabled for stability check');
        }
    } catch (err) {
        console.error('[Extensions] Failed to initialize electron-chrome-extensions:', err);
    }

    createWindow()

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (viewManager) {
            viewManager.toggleDevTools()
        }
    })
    // Also support Mac-style Cmd+Option+I
    globalShortcut.register('CommandOrControl+Alt+I', () => {
        if (viewManager) {
            viewManager.toggleDevTools()
        }
    })

    // GLOBAL STEALTH MECHANISM
    // Ensures every window, popup, and view gets the spoofing script
    // DISABLED: Global listener might be triggering crash during View creation
    app.on('web-contents-created', (_event, contents) => {
        // Enable WebAuthn (Touch ID / Passkeys) Support
        // Ensure that the WebContents can handle credential management requests

        // Handle Bluetooth device selection for FIDO2/U2F keys if needed
        contents.on('select-bluetooth-device', (event, deviceList, callback) => {
            event.preventDefault();
            // Select the first available device to allow the auth flow to proceed
            if (deviceList && deviceList.length > 0) {
                callback(deviceList[0].deviceId);
            } else {
                callback('');
            }
        });

        // Ensure extension APIs are wired for every WebContents
        const owningWindow = BrowserWindow.fromWebContents(contents);
        if (owningWindow) {
            // DISABLED: Extensions disabled
            // chromeExtensions?.addTab(contents, owningWindow);
        }

        // Prevent new-window creation from ever enabling the automation flag
        contents.on('did-start-loading', () => {
            const url = contents.getURL() || '';

            // CLEAN STEALTH STRATEGY
            // Removed script injection that redefined navigator properties.
            // We only rely on setting the User-Agent string.

            // Apply Stealth Scripts (if needed for Firefox/Chrome personas)
            /* if (userAgentService.isGoogleAuthUrl(url)) {
                // For Firefox persona, we might need some JS tweaks to hide Chrome globals
                // But for now, we trust the UA string.
                contents.executeJavaScript(userAgentService.getFirefoxStealthScript()).catch(() => {});
            } else {
                contents.executeJavaScript(userAgentService.getChromeStealthScript()).catch(() => {});
            } */

            // Apply User Agent based on URL (Dynamic Switching)
            // Critical: Must reset to Chrome UA when leaving Auth pages to ensure YouTube compatibility
            contents.setUserAgent(userAgentService.getUserAgentForUrl(url));
        });
    });

    // ── Theme: sync Electron nativeTheme so BrowserViews respect prefers-color-scheme ──
    // Track last applied mode to avoid redundant CDP + reload cycles
    // (useEffect fires multiple times due to React StrictMode + deps changes)
    let lastAppliedThemeMode: string | null = null;
    let themeReloadTimer: ReturnType<typeof setTimeout> | null = null;

    ipcMain.handle('theme:set-native', async (_event: any, mode: 'light' | 'dark' | 'system') => {
        console.log('[Main] Setting nativeTheme.themeSource to:', mode);
        nativeTheme.themeSource = mode;
        console.log('[Main] nativeTheme.shouldUseDarkColors:', nativeTheme.shouldUseDarkColors);

        // Skip CDP propagation + reload if we already applied this mode
        const colorScheme = mode === 'light' ? 'light' : 'dark';
        if (colorScheme === lastAppliedThemeMode) {
            return nativeTheme.shouldUseDarkColors;
        }
        lastAppliedThemeMode = colorScheme;

        // Cancel any pending reload from a previous rapid switch
        if (themeReloadTimer) {
            clearTimeout(themeReloadTimer);
            themeReloadTimer = null;
        }

        // Force ALL existing BrowserView webContents to re-evaluate prefers-color-scheme
        try {
            const allContents = electronModule.webContents.getAllWebContents();
            console.log(`[Main] Theme switch → ${colorScheme}: propagating to ${allContents.length} webContents`);

            for (const wc of allContents) {
                // Skip the main renderer window (it uses CSS classes, not media queries)
                if (win && wc.id === win.webContents.id) continue;
                // Skip overlay window
                if (overlayWin && wc.id === overlayWin.webContents.id) continue;
                // Skip destroyed webContents
                if (wc.isDestroyed()) continue;

                try {
                    // Use CDP to override the prefers-color-scheme media feature.
                    const dbg = wc.debugger;
                    const wasAttached = dbg.isAttached();
                    if (!wasAttached) {
                        dbg.attach('1.3');
                    }
                    await dbg.sendCommand('Emulation.setEmulatedMedia', {
                        features: [{ name: 'prefers-color-scheme', value: colorScheme }],
                    });

                    // Don't detach — CDPBridge or future theme changes may need it
                } catch (e: any) {
                    console.warn(`[Main] CDP emulation failed for id=${wc.id}:`, e?.message || e);
                }
            }

            // Batch-reload all BrowserView webContents after CDP emulation settles.
            // Use a single debounced timer so rapid theme switches don't spam reloads.
            themeReloadTimer = setTimeout(() => {
                themeReloadTimer = null;
                try {
                    const contents = electronModule.webContents.getAllWebContents();
                    for (const wc of contents) {
                        if (win && wc.id === win.webContents.id) continue;
                        if (overlayWin && wc.id === overlayWin.webContents.id) continue;
                        if (wc.isDestroyed()) continue;
                        try {
                            wc.reload();
                            console.log(`[Main] Reloaded webContents id=${wc.id} for theme change`);
                        } catch { /* ignore */ }
                    }
                } catch { /* ignore */ }
            }, 300);
        } catch (e: any) {
            console.warn('[Main] Failed to propagate color scheme to BrowserViews:', e?.message || e);
        }

        return nativeTheme.shouldUseDarkColors;
    });

    // IPC Handlers for Persistence
    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData')
    })

    ipcMain.handle('save-file', async (_event: any, filename: string, content: string) => {
        const userDataPath = app.getPath('userData')
        const filePath = path.join(userDataPath, filename)
        // Ensure we are only writing to the user data directory (basic security)
        if (!filePath.startsWith(userDataPath)) {
            throw new Error('Access denied')
        }
        return fs.promises.writeFile(filePath, content, 'utf-8')
    })

    ipcMain.handle('read-file', async (_event: any, filename: string) => {
        const userDataPath = app.getPath('userData')
        const filePath = path.join(userDataPath, filename)
        // Ensure we are only reading from the user data directory
        if (!filePath.startsWith(userDataPath)) {
            throw new Error('Access denied')
        }
        try {
            return await fs.promises.readFile(filePath, 'utf-8')
        } catch (error: any) {
            if (error.code === 'ENOENT') return null
            throw error
        }
    })

    ipcMain.handle('window:controls', (_event: any, visible: boolean) => {
        if (process.platform === 'darwin') {
            win?.setWindowButtonVisibility(visible);
        }
        return true;
    })

    ipcMain.handle('window:close', () => {
        win?.close();
    })

    ipcMain.handle('window:minimize', () => {
        win?.minimize();
    })

    ipcMain.handle('window:maximize', () => {
        if (win?.isMaximized()) {
            win?.unmaximize();
        } else {
            win?.maximize();
        }
    })

    // Workflow API (Level 6)
    ipcMain.handle('workflow:start-batch', async (_: any, { urls, goal }: { urls: string[], goal: string }) => {
        if (!workflowEngine) throw new Error('WorkflowEngine not ready');

        const jobIds = [];
        for (const url of urls) {
            const id = workflowEngine.addJob('execution', url, goal);
            jobIds.push(id);
        }

        workflowEngine.start();
        return jobIds;
    })

    ipcMain.handle('workflow:get-status', () => {
        return workflowEngine?.getStatus() || null;
    })

    ipcMain.on('view:edge-hover', (_event: any, edge: string) => {
        win?.webContents.send('view:edge-hover', edge);
    })

    ipcMain.on('view:toggle-switcher', () => {
        win?.webContents.send('view:toggle-switcher');
    })

    // Note: privacy:clear-data is handled by PrivacyManager

    // Default Browser API
    ipcMain.handle('app:is-default-browser', () => {
        return app.isDefaultProtocolClient('http');
    })

    ipcMain.handle('app:set-default-browser', () => {
        return app.setAsDefaultProtocolClient('http');
    })

    // Shell API
    ipcMain.handle('shell:open-external', (_event: any, url: string) => {
        return shell.openExternal(url);
    })

    // Google Auth API - Removed (feature disabled)

    // AI API
    ipcMain.handle('ai:get-models', () => {
        return MODEL_REGISTRY;
    })

    ipcMain.handle('ai:chat-completion', async (_: any, { provider, apiKey, messages, model }: { provider: any, apiKey: string, messages: any[], model?: string }) => {
        try {
            if (!aiService) throw new Error('AIService not initialized')
            return await aiService.chatCompletion(provider, apiKey, messages, model)
        } catch (error) {
            console.error('[Main] ai:chat-completion failed:', error);
            throw error; // Re-throw to renderer
        }
    })

    // Resume Parsing API (Upgrade 7)
    ipcMain.handle('agent:parse-resume', async (_: any, { filePath, provider, apiKey }: { filePath: string, provider: any, apiKey: string }) => {
        try {
            if (!aiService) throw new Error('AIService not initialized')

            const parser = new ResumeParser(aiService);
            const profile = await parser.parse(filePath, provider, apiKey);

            // Save to memory
            if (agentMemory) {
                await agentMemory.updateUserProfile(profile);
            }

            return profile;
        } catch (error) {
            console.error('[Main] agent:parse-resume failed:', error);
            throw error;
        }
    })

    // File Dialog API
    ipcMain.handle('dialog:open-file', async () => {
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: ['txt', 'md', 'json', 'pdf'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    })


    // Blocker API
    ipcMain.handle('blocker:toggle', () => {
        return blockerEngine?.toggle() ?? false;
    })

    ipcMain.handle('blocker:status', () => {
        return blockerEngine?.getStatus() ?? { isEnabled: false, blockedCount: 0 };
    })

    ipcMain.handle('blocker:set-level', (_: any, level: string) => {
        blockerEngine?.setLevel(level as any);
        return blockerEngine?.getStatus();
    })

    ipcMain.handle('blocker:set-youtube', (_: any, enabled: boolean) => {
        blockerEngine?.setYoutubeBlocking(enabled);
        return blockerEngine?.getStatus();
    })

    ipcMain.handle('blocker:add-whitelist', (_: any, domain: string) => {
        blockerEngine?.addWhitelist(domain);
        return blockerEngine?.getStatus();
    })

    ipcMain.handle('blocker:remove-whitelist', (_: any, domain: string) => {
        blockerEngine?.removeWhitelist(domain);
        return blockerEngine?.getStatus();
    })
})
