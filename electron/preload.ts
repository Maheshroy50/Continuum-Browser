import { contextBridge, ipcRenderer } from 'electron'
import { getAntiFingerprintingScript } from './AntiFingerprinting'

// --------- Expose some API to the Renderer process ---------
console.log('[Preload] Exposing ipcRenderer with webauthn API...')
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    removeListener(...args: Parameters<typeof ipcRenderer.removeListener>) {
        const [channel, ...omit] = args
        return ipcRenderer.removeListener(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // Persistence API
    fs: {
        getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
        saveFile: (filename: string, content: string) => ipcRenderer.invoke('save-file', filename, content),
        readFile: (filename: string) => ipcRenderer.invoke('read-file', filename),
    },

    views: {
        create: (flowId: string, pageId: string, url: string, state?: any) => ipcRenderer.invoke('view:create', flowId, pageId, url, state),
        select: (flowId: string, pageId: string | null, url?: string, state?: any) => ipcRenderer.invoke('view:select', flowId, pageId, url, state),
        resize: (bounds: { x: number, y: number, width: number, height: number }) => ipcRenderer.invoke('view:resize', bounds),
        remove: (flowId: string, pageId: string) => ipcRenderer.invoke('view:remove', flowId, pageId),
        updateUrl: (url: string) => ipcRenderer.invoke('view:update-url', url),
        back: () => ipcRenderer.invoke('view:back'),
        forward: () => ipcRenderer.invoke('view:forward'),
        reload: () => ipcRenderer.invoke('view:reload'),
        capture: () => ipcRenderer.invoke('view:capture'),
        hide: () => ipcRenderer.invoke('view:hide'),
        show: () => ipcRenderer.invoke('view:show'),
        captureState: (flowId: string, pageId: string) => ipcRenderer.invoke('view:capture-state', flowId, pageId),
        restoreState: (flowId: string, pageId: string, state: any) => ipcRenderer.invoke('view:restore-state', flowId, pageId, state),
        onUrlUpdate: (callback: (data: { flowId: string, pageId: string, url: string }) => void) =>
            ipcRenderer.on('view:url-updated', (_, data) => callback(data)),
        onTitleUpdate: (callback: (data: { flowId: string, pageId: string, title: string }) => void) =>
            ipcRenderer.on('view:title-updated', (_, data) => callback(data)),
        onRestoreResult: (callback: (data: { pageId: string, method: string, success: boolean, message?: string }) => void) =>
            ipcRenderer.on('view:restore-result', (_, data) => callback(data)),
        onSendToNotes: (callback: (data: { text: string, url: string, title: string, flowId: string }) => void) =>
            ipcRenderer.on('send-to-notes', (_, data) => callback(data)),
        // Context menu actions
        onSearchSelection: (callback: (data: { text: string, flowId: string }) => void) =>
            ipcRenderer.on('search-selection', (_, data) => callback(data)),
        onOpenUrlInWorkspace: (callback: (data: { url: string, flowId: string, newPage: boolean }) => void) =>
            ipcRenderer.on('open-url-in-workspace', (_, data) => callback(data)),
        onOpenUrlInNewWorkspace: (callback: (data: { url: string }) => void) =>
            ipcRenderer.on('open-url-in-new-workspace', (_, data) => callback(data)),
    },

    blocker: {
        toggle: () => ipcRenderer.invoke('blocker:toggle'),
        status: () => ipcRenderer.invoke('blocker:status'),
        setLevel: (level: string) => ipcRenderer.invoke('blocker:set-level', level),
        setYoutube: (enabled: boolean) => ipcRenderer.invoke('blocker:set-youtube', enabled),
        addWhitelist: (domain: string) => ipcRenderer.invoke('blocker:add-whitelist', domain),
        removeWhitelist: (domain: string) => ipcRenderer.invoke('blocker:remove-whitelist', domain),
    },

    privacy: {
        clearData: (options?: any) => ipcRenderer.invoke('privacy:clear-data', options),
        setSettings: (settings: { blockThirdPartyCookies?: boolean; doNotTrack?: boolean }) =>
            ipcRenderer.invoke('privacy:set-settings', settings),
        getSettings: () => ipcRenderer.invoke('privacy:get-settings'),
        setSitePermission: (origin: string, permission: string, value: 'allow' | 'deny' | 'ask') =>
            ipcRenderer.invoke('privacy:set-site-permission', origin, permission, value),
        getSitePermissions: () => ipcRenderer.invoke('privacy:get-site-permissions'),
        respondToPermission: (requestId: string, granted: boolean) =>
            ipcRenderer.invoke('privacy:permission-response', requestId, granted),
        onPermissionRequest: (callback: (data: { requestId: string; permission: string; origin: string; requestingUrl: string }) => void) =>
            ipcRenderer.on('privacy:permission-request', (_, data) => callback(data)),
    },

    // App API
    app: {
        isDefaultBrowser: () => ipcRenderer.invoke('app:is-default-browser'),
        setDefaultBrowser: () => ipcRenderer.invoke('app:set-default-browser'),
        onBeforeQuit: (callback: () => void) => ipcRenderer.on('app:before-quit', () => callback()),
        setNativeTheme: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set-native', mode),
    },

    // Debugging: Log messages from Main Process
    onConsoleMessage: (callback: (level: string, message: string) => void) => 
        ipcRenderer.on('console-message', (_, level, message) => callback(level, message)),

    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    },

    downloads: {
        // Actions
        pause: (id: string) => ipcRenderer.invoke('downloads:pause', id),
        resume: (id: string) => ipcRenderer.invoke('downloads:resume', id),
        cancel: (id: string) => ipcRenderer.invoke('downloads:cancel', id),
        showInFolder: (id: string) => ipcRenderer.invoke('downloads:show-in-folder', id),
        getAll: () => ipcRenderer.invoke('downloads:get-all'),

        // Events
        onStart: (callback: (data: any) => void) =>
            ipcRenderer.on('download:start', (_, data) => callback(data)),
        onProgress: (callback: (data: any) => void) =>
            ipcRenderer.on('download:progress', (_, data) => callback(data)),
        onComplete: (callback: (data: any) => void) =>
            ipcRenderer.on('download:complete', (_, data) => callback(data)),
    },

    google: {
        signIn: () => {
            console.log('Preload: google.signIn invoked');
            return ipcRenderer.invoke('google:sign-in');
        },
        signOut: () => ipcRenderer.invoke('google:sign-out'),
        getUser: () => ipcRenderer.invoke('google:get-user'),
    },

    ai: {
        chatCompletion: (provider: string, apiKey: string, messages: any[], model?: string) =>
            ipcRenderer.invoke('ai:chat-completion', { provider, apiKey, messages, model }),
    },

    agent: {
        // Core Process
        processRequest: (userRequest: string, provider: string, apiKey: string, model?: string) =>
            ipcRenderer.invoke('agent:process-request', { userRequest, provider, apiKey, model }),

        // Power Level
        setPowerLevel: (level: 1 | 2 | 3) => ipcRenderer.invoke('agent:set-power-level', level),
        getPowerLevel: () => ipcRenderer.invoke('agent:get-power-level'),

        // Control
        emergencyStop: () => ipcRenderer.invoke('agent:emergency-stop'),

        // Approval Flow
        onApprovalRequest: (callback: (request: any) => void) =>
            ipcRenderer.on('agent:approval-request', (_, request) => callback(request)),
        respondToApproval: (requestId: string, approved: boolean) =>
            ipcRenderer.invoke('agent:approval-response', { requestId, approved }),

        // Activity & Status
        onActivityUpdate: (callback: (activity: any) => void) =>
            ipcRenderer.on('agent:activity-update', (_, activity) => callback(activity)),
        getActivity: () => ipcRenderer.invoke('agent:get-activity'),

        // Permissions
        getPermissions: () => ipcRenderer.invoke('agent:get-permissions'),
        revokePermission: (id: string) => ipcRenderer.invoke('agent:revoke-permission', id),
        revokeAllForSite: (origin: string) => ipcRenderer.invoke('agent:revoke-all-for-site', origin),

        // Memory & Logs
        getActionLog: (limit?: number) => ipcRenderer.invoke('agent:get-action-log', limit),
        getUserProfile: () => ipcRenderer.invoke('agent:get-user-profile'),
        updateUserProfile: (updates: any) => ipcRenderer.invoke('agent:update-user-profile', updates),
        // Upgrade 7: Resume Parsing
        parseResume: (filePath: string, provider: string, apiKey: string) =>
            ipcRenderer.invoke('agent:parse-resume', { filePath, provider, apiKey }),

        // Upgrade 8: Workflow
        startBatch: (urls: string[], goal: string) => ipcRenderer.invoke('workflow:start-batch', { urls, goal }),
        getWorkflowStatus: () => ipcRenderer.invoke('workflow:get-status'),
    },

    dialog: {
        openFile: () => ipcRenderer.invoke('dialog:open-file'),
    },

    extensions: {
        getAll: () => ipcRenderer.invoke('get-extensions'),
        install: (url: string) => ipcRenderer.invoke('install-extension-from-url', { url }),
        remove: (id: string) => ipcRenderer.invoke('remove-extension', id),
        loadUnpacked: (path: string) => ipcRenderer.invoke('load-unpacked-extension', path),
        getInfo: (id: string) => ipcRenderer.invoke('extension-get-info', id),
        openOptions: (id: string) => ipcRenderer.invoke('extension-open-options', id),
        openPopup: (id: string) => ipcRenderer.invoke('extension-open-popup', id),
    },

    webauthn: {
        // Check if native WebAuthn is available
        isAvailable: () => ipcRenderer.invoke('webauthn:is-available'),
        
        // Check if Touch ID is available
        isTouchIdAvailable: () => ipcRenderer.invoke('webauthn:is-touchid-available'),
        
        // Get available authenticators
        getAuthenticators: () => ipcRenderer.invoke('webauthn:get-authenticators'),
        
        // Create a new credential (registration)
        createCredential: (options: any) => ipcRenderer.invoke('webauthn:create-credential', options),
        
        // Get credential (authentication)
        getCredential: (options: any) => ipcRenderer.invoke('webauthn:get-credential', options),
        
        // Open macOS Passwords settings
        managePasswords: () => ipcRenderer.invoke('webauthn:manage-passwords'),
    },
})

console.log('[Preload] ipcRenderer with webauthn API exposed successfully')

// Inject WebAuthn Shim into Main World to use native Touch ID
    // This runs in the main world context and monkey-patches navigator.credentials
    if (process.platform === 'darwin') {
        const shimScript = `
        (() => {
            // Wait for ipcRenderer to be available (it should be immediate with contextBridge)
            if (!window.navigator || !window.navigator.credentials) return;
            
            const originalCreate = window.navigator.credentials.create.bind(window.navigator.credentials);
            const originalGet = window.navigator.credentials.get.bind(window.navigator.credentials);
            
            // Helper to convert to ArrayBuffer
            const toArrayBuffer = (data) => {
                if (!data) return null;
                if (data instanceof ArrayBuffer) return data;
                if (data.buffer instanceof ArrayBuffer) return data.buffer;
                if (Array.isArray(data) || data instanceof Uint8Array) {
                    return new Uint8Array(data).buffer;
                }
                // Handle objects that look like buffers (Node Buffer polyfills)
                if (data.type === 'Buffer' && Array.isArray(data.data)) {
                    return new Uint8Array(data.data).buffer;
                }
                return data;
            };

            // Helper to reconstruct PublicKeyCredential
            const reconstructCredential = (data) => {
                if (!data) return null;
                
                // Construct the credential object
                // We create a structure that mimics PublicKeyCredential
                const credential = {
                    id: data.id,
                    rawId: toArrayBuffer(data.rawId),
                    type: data.type,
                    response: {
                        clientDataJSON: toArrayBuffer(data.response.clientDataJSON)
                    },
                    getClientExtensionResults: () => data.clientExtensionResults || {}
                };
                
                if (data.response.attestationObject) {
                    credential.response.attestationObject = toArrayBuffer(data.response.attestationObject);
                }
                
                if (data.response.authenticatorData) {
                    credential.response.authenticatorData = toArrayBuffer(data.response.authenticatorData);
                }
                
                if (data.response.signature) {
                    credential.response.signature = toArrayBuffer(data.response.signature);
                }
                
                if (data.response.userHandle) {
                    credential.response.userHandle = toArrayBuffer(data.response.userHandle);
                }
                
                return credential;
            };

            // Override create
            window.navigator.credentials.create = async function(options) {
                // Only intercept WebAuthn requests (those with publicKey)
                if (options && options.publicKey && window.ipcRenderer && window.ipcRenderer.webauthn) {
                    console.log('[WebAuthn Shim] Intercepting create() request');
                    try {
                        // Check if native WebAuthn is available
                        const isAvailable = await window.ipcRenderer.webauthn.isAvailable();
                        if (isAvailable) {
                            const result = await window.ipcRenderer.webauthn.createCredential(options);
                            console.log('[WebAuthn Shim] create() success', result);
                            return reconstructCredential(result);
                        } else {
                            console.log('[WebAuthn Shim] Native WebAuthn not available, falling back to browser default');
                        }
                    } catch (error) {
                        console.error('[WebAuthn Shim] create() error:', error);
                        console.error('[WebAuthn Shim] Error Name:', error.name);
                        console.error('[WebAuthn Shim] Error Message:', error.message);
                        // If native fails, we could try fallback, but usually we should throw
                        throw error;
                    }
                }
                return originalCreate(options);
            };
            
            // Override get
            window.navigator.credentials.get = async function(options) {
                if (options && options.publicKey && window.ipcRenderer && window.ipcRenderer.webauthn) {
                    console.log('[WebAuthn Shim] Intercepting get() request');
                    try {
                        const isAvailable = await window.ipcRenderer.webauthn.isAvailable();
                        if (isAvailable) {
                            const result = await window.ipcRenderer.webauthn.getCredential(options);
                            console.log('[WebAuthn Shim] get() success', result);
                            return reconstructCredential(result);
                        } else {
                            console.log('[WebAuthn Shim] Native WebAuthn not available, falling back to browser default');
                        }
                    } catch (error) {
                        console.error('[WebAuthn Shim] get() error:', error);
                        console.error('[WebAuthn Shim] Error Name:', error.name);
                        console.error('[WebAuthn Shim] Error Message:', error.message);
                        throw error;
                    }
                }
                return originalGet(options);
            };

            // Override isUserVerifyingPlatformAuthenticatorAvailable
            if (window.PublicKeyCredential) {
                const originalAvailability = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
                window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function() {
                    if (window.ipcRenderer && window.ipcRenderer.webauthn) {
                        try {
                            const available = await window.ipcRenderer.webauthn.isTouchIdAvailable();
                            console.log('[WebAuthn Shim] Platform authenticator check:', available);
                            return available;
                        } catch (e) {
                            console.warn('[WebAuthn Shim] Availability check failed:', e);
                        }
                    }
                    return originalAvailability ? originalAvailability.call(window.PublicKeyCredential) : false;
                };
            }
            
            console.log('[WebAuthn Shim] Native Touch ID Shim Activated (Main World)');
        })();
        `;

        // Inject into Main World via DOM
        // This ensures it runs in the page context, not the isolated preload context
        const injectShim = () => {
            try {
                const target = document.head || document.documentElement;
                if (!target) {
                    console.warn('[Preload] DOM not ready for WebAuthn shim injection');
                    return;
                }
                const script = document.createElement('script');
                script.textContent = shimScript;
                target.appendChild(script);
                // Clean up
                script.remove();
            } catch (e) {
                console.error('[Preload] Failed to inject WebAuthn shim:', e);
            }
        };

        if (document.head || document.documentElement) {
            injectShim();
        } else {
            window.addEventListener('DOMContentLoaded', injectShim);
        }
    }

    // --- INJECT ANTI-FINGERPRINTING SHIM ---
    const injectFpShim = () => {
        try {
            const target = document.head || document.documentElement;
            if (!target) return;
            const fpScript = document.createElement('script');
            fpScript.textContent = getAntiFingerprintingScript();
            target.appendChild(fpScript);
            fpScript.remove();
        } catch (e) {
            console.error('[Preload] Failed to inject Anti-Fingerprinting shim:', e);
        }
    };

    if (document.head || document.documentElement) {
        injectFpShim();
    } else {
        window.addEventListener('DOMContentLoaded', injectFpShim);
    }
