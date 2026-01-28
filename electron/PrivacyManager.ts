import { session, ipcMain, BrowserWindow } from 'electron';

// DEV_MODE: Toggle verbose logging
const DEV_MODE = process.env.NODE_ENV !== 'production';
const log = (...args: any[]) => DEV_MODE && console.log('[PrivacyManager]', ...args);

// Sites that require relaxed cookie partitioning to function (First-Party Sets)
const GOOGLE_EXCEPTION_SITES = [
    'google.com',
    'youtube.com',
    'gmail.com',
    'accounts.google.com',
    'apis.google.com',
    'googleapis.com',
    'gstatic.com',
    'googleusercontent.com'
];

interface PrivacySettings {
    blockThirdPartyCookies: boolean;
    doNotTrack: boolean;
}

interface SitePermissions {
    [origin: string]: {
        camera?: 'allow' | 'deny' | 'ask';
        microphone?: 'allow' | 'deny' | 'ask';
        geolocation?: 'allow' | 'deny' | 'ask';
    };
}

export class PrivacyManager {
    private mainWindow: BrowserWindow;
    private settings: PrivacySettings = {
        blockThirdPartyCookies: false,
        doNotTrack: true,
    };
    private sitePermissions: SitePermissions = {};
    private httpAllowList: Set<string> = new Set();
    private pendingPermissionCallbacks: Map<string, (granted: boolean) => void> = new Map();
    private permissionsPath: string;
    private httpAllowListPath: string;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        // Store in user data directory
        const app = require('electron').app;
        const path = require('path');
        this.permissionsPath = path.join(app.getPath('userData'), 'privacy-permissions.json');
        this.httpAllowListPath = path.join(app.getPath('userData'), 'http-allow-list.json');

        this.loadPermissions();
        this.setupIPC();
        this.setupRequestInterceptors();
        this.setupPermissionHandlers();
        log('PrivacyManager initialized');
    }

    private loadPermissions() {
        const fs = require('fs');
        try {
            if (fs.existsSync(this.permissionsPath)) {
                const data = fs.readFileSync(this.permissionsPath, 'utf8');
                this.sitePermissions = JSON.parse(data);
                log('Loaded site permissions from disk');
            }
            if (fs.existsSync(this.httpAllowListPath)) {
                const data = fs.readFileSync(this.httpAllowListPath, 'utf8');
                this.httpAllowList = new Set(JSON.parse(data));
                log('Loaded HTTP allow-list from disk');
            }
        } catch (e) {
            console.error('Failed to load privacy permissions:', e);
        }
    }

    private savePermissions() {
        const fs = require('fs');
        try {
            fs.writeFileSync(this.permissionsPath, JSON.stringify(this.sitePermissions, null, 2));
            fs.writeFileSync(this.httpAllowListPath, JSON.stringify([...this.httpAllowList], null, 2));
            log('Saved site permissions to disk');
        } catch (e) {
            console.error('Failed to save privacy permissions:', e);
        }
    }

    public setPermission(origin: string, permission: string, value: 'allow' | 'deny' | 'ask'): boolean {
        if (!this.sitePermissions[origin]) {
            this.sitePermissions[origin] = {};
        }
        (this.sitePermissions[origin] as any)[permission] = value;
        this.savePermissions(); // Save on change
        // log(`Set permission for ${origin}: ${permission} = ${value}`);
        return true;
    }

    public isHttpAllowed(origin: string): boolean {
        return this.httpAllowList.has(origin);
    }

    public allowHttp(origin: string) {
        this.httpAllowList.add(origin);
        this.savePermissions();
        log(`Allowed HTTP for ${origin}`);
    }

    // Check if a domain is in the Google exception list (First-Party Sets)
    public isGoogleSite(urlString: string): boolean {
        try {
            const url = new URL(urlString);
            const hostname = url.hostname;
            return GOOGLE_EXCEPTION_SITES.some(site =>
                hostname === site || hostname.endsWith('.' + site)
            );
        } catch {
            return false;
        }
    }

    private setupIPC() {
        // Update privacy settings from renderer
        ipcMain.handle('privacy:set-settings', (_, settings: Partial<PrivacySettings>) => {
            this.updateSettings(settings);
            return true;
        });

        // Get current settings
        ipcMain.handle('privacy:get-settings', () => {
            return this.settings;
        });

        // Set site permission
        ipcMain.handle('privacy:set-site-permission', (_, origin: string, permission: string, value: 'allow' | 'deny' | 'ask') => {
            return this.setPermission(origin, permission, value);
        });

        // Get site permissions
        ipcMain.handle('privacy:get-site-permissions', () => {
            return this.sitePermissions;
        });

        // Allow Insecure HTTP (HTTPS-Only Override)
        ipcMain.handle('security:allow-insecure', (_, url: string) => {
            try {
                const origin = new URL(url).origin;
                this.allowHttp(origin);
                return true;
            } catch (e) {
                console.error('Invalid URL for allow-list:', url);
                return false;
            }
        });

        // Handle permission response from user dialog
        ipcMain.handle('privacy:permission-response', (_, requestId: string, granted: boolean) => {
            const callback = this.pendingPermissionCallbacks.get(requestId);
            if (callback) {
                callback(granted);
                this.pendingPermissionCallbacks.delete(requestId);
                log(`Permission ${requestId} resolved: ${granted ? 'granted' : 'denied'}`);
            }
        });

        // Clear browsing data (enhanced)
        ipcMain.handle('privacy:clear-data', async (_, options?: { storages?: string[] }) => {
            const storages = options?.storages || ['cookies', 'localstorage', 'caches', 'indexdb'];

            try {
                // Clear from default session
                if (storages.includes('cookies')) {
                    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
                }
                if (storages.includes('localstorage')) {
                    await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
                }
                if (storages.includes('caches')) {
                    await session.defaultSession.clearStorageData({ storages: ['cachestorage'] });
                }
                if (storages.includes('indexdb')) {
                    await session.defaultSession.clearStorageData({ storages: ['indexdb'] });
                }

                // Note: In production, track flow partitions and clear each

                log('Browsing data cleared:', storages);
                return { success: true };
            } catch (error) {
                console.error('[PrivacyManager] Failed to clear data:', error);
                return { success: false, error: String(error) };
            }
        });
    }

    private setupRequestInterceptors() {
        // Apply to all sessions (default + flow partitions)
        this.applyInterceptorsToSession(session.defaultSession);

        // Listen for new partitions being created
        session.defaultSession.on('will-download', () => {
            // Could track new sessions here if needed
        });
    }

    private applyInterceptorsToSession(sess: Electron.Session) {
        // Intercept all requests to add DNT header and optionally block third-party cookies
        sess.webRequest.onBeforeSendHeaders(
            { urls: ['*://*/*'] },
            (details, callback) => {
                const requestHeaders = { ...details.requestHeaders };

                // DISABLED: These headers may trigger Google's browser detection
                // Add Do Not Track header if enabled
                // if (this.settings.doNotTrack) {
                //     requestHeaders['DNT'] = '1';
                //     requestHeaders['Sec-GPC'] = '1'; // Global Privacy Control (modern DNT)
                // }

                // Block third-party cookies if enabled
                if (this.settings.blockThirdPartyCookies && details.referrer) {
                    try {
                        const requestUrl = new URL(details.url);
                        const referrerUrl = new URL(details.referrer);

                        // EXCEPTION: Allow Google cross-domain cookies (First-Party Sets)
                        if (this.isGoogleSite(details.url) || this.isGoogleSite(details.referrer)) {
                            // Skip blocking for Google domains
                        } else if (requestUrl.hostname !== referrerUrl.hostname) {
                            // Check if it's not a subdomain relationship
                            const requestDomain = this.getBaseDomain(requestUrl.hostname);
                            const referrerDomain = this.getBaseDomain(referrerUrl.hostname);

                            if (requestDomain !== referrerDomain) {
                                delete requestHeaders['Cookie'];
                                log(`Blocked third-party cookie: ${requestUrl.hostname} from ${referrerUrl.hostname}`);
                            }
                        }
                    } catch (e) {
                        // URL parsing failed, continue without blocking
                    }
                }

                callback({ requestHeaders });
            }
        );

        // Also block third-party cookie responses (Set-Cookie headers)
        if (this.settings.blockThirdPartyCookies) {
            sess.webRequest.onHeadersReceived(
                { urls: ['*://*/*'] },
                (details, callback) => {
                    const responseHeaders = { ...details.responseHeaders };

                    if (this.settings.blockThirdPartyCookies && details.referrer) {
                        try {
                            const requestUrl = new URL(details.url);
                            const referrerUrl = new URL(details.referrer);

                            // EXCEPTION: Allow Google cross-domain cookies (First-Party Sets)
                            if (this.isGoogleSite(details.url) || this.isGoogleSite(details.referrer)) {
                                // Skip blocking for Google domains
                            } else {
                                const requestDomain = this.getBaseDomain(requestUrl.hostname);
                                const referrerDomain = this.getBaseDomain(referrerUrl.hostname);

                                if (requestDomain !== referrerDomain) {
                                    // Remove Set-Cookie headers from third-party responses
                                    delete responseHeaders['set-cookie'];
                                    delete responseHeaders['Set-Cookie'];
                                }
                            }
                        } catch (e) {
                            // Continue without blocking
                        }
                    }

                    callback({ responseHeaders });
                }
            );
        }
    }

    private setupPermissionHandlers() {
        // Handle permission requests for camera, microphone, geolocation
        session.defaultSession.setPermissionRequestHandler(
            (_webContents, permission, callback, details) => {
                const origin = details.requestingUrl ? new URL(details.requestingUrl).origin : 'unknown';

                // Check for stored permission
                const sitePerms = this.sitePermissions[origin];
                if (sitePerms) {
                    const stored = (sitePerms as any)[this.mapPermission(permission)];
                    if (stored === 'allow') {
                        log(`Auto-allowing ${permission} for ${origin} (stored)`);
                        callback(true);
                        return;
                    } else if (stored === 'deny') {
                        log(`Auto-denying ${permission} for ${origin} (stored)`);
                        callback(false);
                        return;
                    }
                }

                // For sensitive permissions, ask user
                if (['media', 'camera', 'microphone', 'geolocation'].includes(permission)) {
                    const requestId = `${origin}-${permission}-${Date.now()}`;

                    // Store callback for later resolution
                    this.pendingPermissionCallbacks.set(requestId, callback);

                    // Send to renderer for user dialog
                    this.mainWindow.webContents.send('privacy:permission-request', {
                        requestId,
                        permission: this.mapPermission(permission),
                        origin,
                        requestingUrl: details.requestingUrl,
                    });

                    log(`Requesting user permission: ${permission} for ${origin}`);

                    // Timeout after 60 seconds (auto-deny)
                    setTimeout(() => {
                        if (this.pendingPermissionCallbacks.has(requestId)) {
                            this.pendingPermissionCallbacks.get(requestId)?.(false);
                            this.pendingPermissionCallbacks.delete(requestId);
                            log(`Permission request ${requestId} timed out, auto-denied`);
                        }
                    }, 60000);
                } else {
                    // Allow other permissions by default
                    callback(true);
                }
            }
        );

        // Also handle permission checks (for feature detection)
        session.defaultSession.setPermissionCheckHandler(
            (_webContents, permission, requestingOrigin, _details) => {
                const sitePerms = this.sitePermissions[requestingOrigin];
                if (sitePerms) {
                    const stored = (sitePerms as any)[this.mapPermission(permission)];
                    if (stored === 'allow') return true;
                    if (stored === 'deny') return false;
                }
                // Default: allow (return true) since null causes type issues
                return true;
            }
        );
    }

    private mapPermission(electronPermission: string): string {
        switch (electronPermission) {
            case 'media':
            case 'camera':
                return 'camera';
            case 'microphone':
                return 'microphone';
            case 'geolocation':
                return 'geolocation';
            default:
                return electronPermission;
        }
    }

    private getBaseDomain(hostname: string): string {
        // Simple extraction - get last two parts (e.g., "google.com" from "www.google.com")
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return hostname;
    }

    updateSettings(newSettings: Partial<PrivacySettings>) {
        this.settings = { ...this.settings, ...newSettings };
        log('Privacy settings updated:', this.settings);

        // Re-apply interceptors with new settings
        // Note: In production, you'd need to properly remove old listeners first
    }

    destroy() {
        ipcMain.removeHandler('privacy:set-settings');
        ipcMain.removeHandler('privacy:get-settings');
        ipcMain.removeHandler('privacy:set-site-permission');
        ipcMain.removeHandler('privacy:get-site-permissions');
        ipcMain.removeHandler('privacy:permission-response');
        ipcMain.removeHandler('privacy:clear-data');
        this.pendingPermissionCallbacks.clear();
        log('PrivacyManager destroyed');
    }
}
