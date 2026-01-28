/**
 * UserAgentService - Manages User-Agent spoofing to prevent Electron detection
 * 
 * Strategy:
 * - Google Auth: Use Firefox UA to bypass "insecure browser" blocks
 * - Google Services (YouTube, etc.): Use Chrome UA for media playback compatibility
 * - Other sites: Use Chrome UA for maximum compatibility
 */

// Latest User Agents (Updated January 2026)
const USER_AGENTS = {
    // Firefox UA for Google Sign-In (Google doesn't block Firefox)
    FIREFOX_MAC: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
    FIREFOX_WIN: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    FIREFOX_LINUX: 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',

    // Chrome UA for regular browsing and media playback
    CHROME_MAC: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    CHROME_WIN: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    CHROME_LINUX: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

// Google Authentication domains - use Firefox UA
const GOOGLE_AUTH_DOMAINS = [
    'accounts.google.com',
    'accounts.youtube.com',
    'signin.google.com',
    'login.google.com',
    'myaccount.google.com',
    'oauth.googleusercontent.com',
    'oauthaccountmanager.googleapis.com',
];

// Google Service domains - use Chrome UA for playback compatibility
const GOOGLE_SERVICE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'googlevideo.com',
    'ytimg.com',
    'ggpht.com',
    'google.com',
    'www.google.com',
    'googleapis.com',
    'gstatic.com',
    'googleusercontent.com',
    'play.google.com',
    'drive.google.com',
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com',
    'meet.google.com',
    'mail.google.com',
    'calendar.google.com',
];

// Headers to remove that reveal Electron
const ELECTRON_HEADERS_TO_REMOVE = [
    'X-Electron-Version',
    'X-Chrome-Startup-Origin',
];

export class UserAgentService {
    private platform: NodeJS.Platform;

    constructor() {
        this.platform = process.platform;
    }

    /**
     * Get Firefox User-Agent for current platform
     */
    public getFirefoxUA(): string {
        switch (this.platform) {
            case 'darwin':
                return USER_AGENTS.FIREFOX_MAC;
            case 'win32':
                return USER_AGENTS.FIREFOX_WIN;
            default:
                return USER_AGENTS.FIREFOX_LINUX;
        }
    }

    /**
     * Get Chrome User-Agent for current platform
     */
    public getChromeUA(): string {
        switch (this.platform) {
            case 'darwin':
                return USER_AGENTS.CHROME_MAC;
            case 'win32':
                return USER_AGENTS.CHROME_WIN;
            default:
                return USER_AGENTS.CHROME_LINUX;
        }
    }

    /**
     * Check if URL is a Google Authentication page
     */
    public isGoogleAuthUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return GOOGLE_AUTH_DOMAINS.some(domain =>
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );
        } catch {
            return false;
        }
    }

    /**
     * Check if URL is a Google Service (YouTube, Drive, etc.)
     */
    public isGoogleServiceUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return GOOGLE_SERVICE_DOMAINS.some(domain =>
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );
        } catch {
            return false;
        }
    }

    /**
     * Get the appropriate User-Agent for a given URL
     */
    public getUserAgentForUrl(url: string): string {
        if (this.isGoogleAuthUrl(url)) {
            return this.getFirefoxUA();
        }
        return this.getChromeUA();
    }

    /**
     * Clean request headers to remove Electron traces
     */
    public cleanHeaders(headers: Record<string, string>): Record<string, string> {
        const cleaned = { ...headers };
        for (const header of ELECTRON_HEADERS_TO_REMOVE) {
            delete cleaned[header];
        }
        return cleaned;
    }

    /**
     * Get the stealth script for Firefox persona (Google Auth)
     */
    public getFirefoxStealthScript(): string {
        const firefoxUA = this.getFirefoxUA();
        return `
            (() => {
                try {
                    // Firefox User-Agent spoofing
                    const firefoxUA = '${firefoxUA}';
                    Object.defineProperty(navigator, 'userAgent', { get: () => firefoxUA, configurable: true });
                    Object.defineProperty(navigator, 'appVersion', { get: () => '5.0 (Macintosh)', configurable: true });
                    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', configurable: true });
                    Object.defineProperty(navigator, 'vendor', { get: () => '', configurable: true });
                    Object.defineProperty(navigator, 'productSub', { get: () => '20100101', configurable: true });
                    
                    // Hide webdriver flag
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
                    
                    // Delete Chrome-specific globals to match Firefox
                    delete window.chrome;
                    
                    // Remove Electron-specific properties
                    delete window.process;
                    delete window.require;
                    delete window.module;
                    delete window.exports;
                    delete window.__dirname;
                    delete window.__filename;
                    
                    // Remove automation traces (ChromeDriver fingerprints)
                    const cdcProps = Object.getOwnPropertyNames(window).filter(p => p.startsWith('cdc_'));
                    cdcProps.forEach(p => { try { delete window[p]; } catch(e) {} });
                    
                    // Override permissions API to prevent fingerprinting
                    if (navigator.permissions) {
                        const originalQuery = navigator.permissions.query;
                        navigator.permissions.query = (parameters) => {
                            if (parameters.name === 'notifications') {
                                return Promise.resolve({ state: Notification.permission, onchange: null });
                            }
                            return originalQuery.call(navigator.permissions, parameters);
                        };
                    }
                    
                    // Firefox doesn't have chrome.runtime
                    if (window.chrome) {
                        delete window.chrome.runtime;
                    }
                    
                    console.log('[Stealth] Firefox persona activated');
                } catch (e) {
                    console.error('[Stealth] Firefox persona error:', e);
                }
            })();
        `;
    }

    /**
     * Get the stealth script for Chrome persona (regular browsing)
     */
    public getChromeStealthScript(): string {
        return `
            (() => {
                try {
                    // Hide webdriver flag (most important for bot detection)
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
                    
                    // Remove Electron-specific properties
                    delete window.process;
                    delete window.require;
                    delete window.module;
                    delete window.exports;
                    delete window.__dirname;
                    delete window.__filename;
                    
                    // Remove automation traces (ChromeDriver fingerprints)
                    const cdcProps = Object.getOwnPropertyNames(window).filter(p => p.startsWith('cdc_'));
                    cdcProps.forEach(p => { try { delete window[p]; } catch(e) {} });
                    
                    // Ensure chrome object exists but looks normal
                    if (!window.chrome) {
                        window.chrome = {};
                    }
                    window.chrome.runtime = { id: undefined };
                    
                    // Override plugins to look more like a real browser
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => {
                            const plugins = [
                                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                                { name: 'Native Client', filename: 'internal-nacl-plugin' },
                            ];
                            plugins.item = (i) => plugins[i];
                            plugins.namedItem = (name) => plugins.find(p => p.name === name);
                            plugins.refresh = () => {};
                            return plugins;
                        },
                        configurable: true
                    });
                    
                    // Override languages to look normal
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                        configurable: true
                    });
                    
                    console.log('[Stealth] Chrome persona activated');
                } catch (e) {
                    console.error('[Stealth] Chrome persona error:', e);
                }
            })();
        `;
    }

    /**
     * Get comprehensive stealth script based on URL
     */
    public getStealthScriptForUrl(url: string): string {
        if (this.isGoogleAuthUrl(url)) {
            return this.getFirefoxStealthScript();
        }
        return this.getChromeStealthScript();
    }
}

// Export singleton instance
export const userAgentService = new UserAgentService();
