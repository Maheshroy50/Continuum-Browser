// @ts-ignore - eval-based require to bypass vite-plugin-electron bundler interop issue
const nodeRequire = eval('require');
const electronModule = nodeRequire('electron') as typeof import('electron')
const { app, BrowserWindow, shell, session } = electronModule
import type { BrowserWindow as BrowserWindowType } from 'electron'
import path from 'node:path'
import { ViewManager } from './ViewManager'
import { BlockerEngine } from './BlockerEngine'
// DISABLED: Not in working Dec 26 version
// import { PrivacyManager } from './PrivacyManager'
// import { DownloadManager } from './DownloadManager'
import { DownloadManager } from './DownloadManager'
import { AIService } from './AIService'
import { autoUpdater } from 'electron-updater'
import { ExtensionManager } from './ExtensionManager'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'

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

let win: BrowserWindowType | null
let viewManager: ViewManager | null = null
let blockerEngine: BlockerEngine | null = null
// DISABLED: Not in working Dec 26 version
// let privacyManager: PrivacyManager | null = null
// let downloadManager: DownloadManager | null = null
let downloadManager: DownloadManager | null = null
let aiService: AIService | null = null
// @ts-ignore
export let extensionManager: ExtensionManager | null = null
let chromeExtensions: ElectronChromeExtensions | null = null

// Register protocol
// Stealth Mode: Disable Automation features to improve Google Sign-In success
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process'); // Helps with cross-origin auth frames

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

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

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
        // vibrancy: 'under-window', // Mac blur effect
        // visualEffectState: 'active',
        backgroundColor: '#222222', // Dark Grey background
        icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
    })

    // Register main renderer tab for extension APIs
    chromeExtensions?.addTab(win.webContents, win);

    // DEV_MODE only: Debug renderer output (causes IPC overhead in production)
    const DEV_MODE = !app.isPackaged;

    if (DEV_MODE) {
        win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
            console.log(`[Renderer][${level}] ${message} (${sourceId}:${line})`);
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

    try {
        extensionManager = new ExtensionManager();
        console.log('ExtensionManager initialized (Safe Mode)');

        // SAFE LOADING STRATEGY
        // Delay execution to ensure main process is stable and window is visible.
        // This prevents boot loops and gives the "CrashGuard" logic a chance to clean up on next run if it fails.
        setTimeout(() => {
            console.log('[Main] Triggering delayed extension loading...');
            extensionManager?.loadPersistedExtensions();
        }, 3000);

    } catch (err) {
        console.error('Failed to initialize ExtensionManager:', err);
    }

    try {
        blockerEngine = new BlockerEngine()
        // blockerEngine.enable() // Active by default
        console.log('BlockerEngine initialized')
    } catch (err) {
        console.error('Failed to initialize BlockerEngine:', err)
    }

    try {
        viewManager = new ViewManager(win, blockerEngine!, (contents) => {
            chromeExtensions?.selectTab(contents);
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

    try {
        aiService = new AIService()
        console.log('AIService initialized successfully')
    } catch (err) {
        console.error('Failed to initialize AIService:', err)
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
        if (aiService) {
            aiService = null;
        }
        win = null
    })
}

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
    try {
        // electron-chrome-extensions officially targets Electron >=35
        const electronMajor = parseInt(process.versions.electron.split('.')[0] || '0', 10);
        if (electronMajor < 35) {
            console.warn('[Extensions] Skipping electron-chrome-extensions (requires Electron >=35).');
        } else {
            chromeExtensions = new ElectronChromeExtensions({
                session: session.defaultSession,
                license: 'GPL-3.0',
            });

            ElectronChromeExtensions.handleCRXProtocol(session.defaultSession);
            console.log('[Extensions] electron-chrome-extensions initialized');
        }
    } catch (err) {
        console.error('[Extensions] Failed to initialize electron-chrome-extensions:', err);
    }

    createWindow()

    const { globalShortcut } = require('electron')
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
    app.on('web-contents-created', (_event, contents) => {
        // Ensure extension APIs are wired for every WebContents
        const owningWindow = BrowserWindow.fromWebContents(contents);
        if (owningWindow) {
            chromeExtensions?.addTab(contents, owningWindow);
        }

        // Prevent new-window creation from ever enabling the automation flag
        contents.on('did-start-loading', () => {
            const url = contents.getURL() || '';
            const isGoogleLogin = url.includes('accounts.google.com') || url.includes('accounts.youtube.com');

            // SMART STEALTH STRATEGY
            // 1. Google Login = Firefox Mode (Maximum Secrecy, sacrificing some native features)
            // 2. Regular Browsing = Chrome Mode (Maximum Compatibility, specifically for YouTube/Netflix)

            if (isGoogleLogin) {
                // FIREFOX MODE
                const firefoxUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0';
                contents.setUserAgent(firefoxUA);

                const FF_SCRIPT = `
                    (() => {
                        try {
                            const firefoxUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0';
                            Object.defineProperty(navigator, 'userAgent', { get: () => firefoxUA });
                            Object.defineProperty(navigator, 'appVersion', { get: () => '5.0 (Macintosh)' });
                            Object.defineProperty(navigator, 'vendor', { get: () => '' });
                            Object.defineProperty(navigator, 'productSub', { get: () => '20100101' });
                            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                            
                             // Delete Chrome globals to match Firefox persona
                            delete window.chrome;
                            
                            // Cleanup automation traces
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Function;
                            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
                        } catch (e) {}
                    })();
                `;
                contents.executeJavaScript(FF_SCRIPT).catch(() => { });
            } else {
                // CHROME MODE (Standard Electron/Chromium)
                // We keep the native User Agent to ensure YouTube gets the right formats.
                // We ONLY hide the webdriver flag to avoid basic bot detection.

                // Reset to default if we navigated away from login
                // const chromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
                // contents.setUserAgent(chromeUA); // Optional: rely on default

                const CHROME_SCRIPT = `
                    (() => {
                        try {
                           // ONLY Hide Webdriver
                           Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                           
                           // Remove specific automation keys
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Function;
                           delete window.cdc_adoQpoasnfa76pfcZLmcfl_Proxy;
                        } catch (e) {}
                    })();
                `;
                contents.executeJavaScript(CHROME_SCRIPT).catch(() => { });
            }
        });
    });

    // IPC Handlers for Persistence
    const { ipcMain } = require('electron')
    const fs = require('node:fs')

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
    ipcMain.handle('ai:chat-completion', async (_: any, { provider, apiKey, messages, model }: { provider: any, apiKey: string, messages: any[], model?: string }) => {
        if (!aiService) throw new Error('AIService not initialized')
        return await aiService.chatCompletion(provider, apiKey, messages, model)
    })


    // Blocker API
    ipcMain.handle('blocker:toggle', () => {
        return blockerEngine?.toggle() ?? false;
    })

    ipcMain.handle('blocker:status', () => {
        return blockerEngine?.getStatus() ?? { isEnabled: false, blockedCount: 0 };
    })
})
