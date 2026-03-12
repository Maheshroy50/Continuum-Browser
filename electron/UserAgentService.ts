/**
 * UserAgentService - Manages User-Agent spoofing to prevent Electron detection
 * 
 * Strategy:
 * - Google Auth: Use Firefox UA to bypass "insecure browser" blocks
 * - Google Services (YouTube, etc.): Use Chrome UA for media playback compatibility
 * - Other sites: Use Chrome UA for maximum compatibility
 */

// Latest User Agents (Updated February 2026)
const USER_AGENTS = {
    // Firefox UA for Google Sign-In (Google doesn't block Firefox)
    FIREFOX_MAC: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
    FIREFOX_WIN: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    FIREFOX_LINUX: 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',

    // Chrome UA for regular browsing and media playback (Aligned with Electron 35 / Chromium 134)
    // NOTE: We match the actual underlying Chromium version to avoid mismatches
    CHROME_MAC: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36`,
    CHROME_WIN: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36`,
    CHROME_LINUX: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36`,
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
    // 'udemy.com', // Reverted: Using Chrome UA for Castlabs native integration
    // 'www.udemy.com'
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
     * Get Client Hints headers to mimic Google Chrome
     */
    public getClientHintsHeaders(): Record<string, string> {
        // Parse major version from process.versions.chrome (e.g. "138.0.7204.251" -> "138")
        const majorVersion = process.versions.chrome.split('.')[0];
        
        return {
            'sec-ch-ua': `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not?A_Brand";v="24"`,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': `"${process.platform === 'darwin' ? 'macOS' : 'Windows'}"`
        };
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
        // CLEANUP: Removed aggressive stealth scripts that interfere with CDM creation
        return `console.log('[Stealth] Firefox persona - Script injection disabled for stability');`;
    }

    /**
     * Get the stealth script for Chrome persona (regular browsing)
     */
    public getChromeStealthScript(): string {
        // CLEANUP: Removed aggressive stealth scripts that interfere with CDM creation
        // We rely solely on the User-Agent string now.
        return `console.log('[Stealth] Chrome persona - Script injection disabled for stability');`;
    }

    /**
     * Get comprehensive stealth script based on URL
     */
    public getStealthScriptForUrl(_url: string): string {
        // We no longer inject scripts, only return empty/log script
        return this.getChromeStealthScript();
    }

    /**
     * DRM Diagnostic Script
     * Wraps EME API to log success/failure
     */
    // @ts-ignore - Unused but kept for reference
    private getDrmDebugScript(): string {
        // CLEANUP: Removed intrusive DRM debugging that might affect CDM loading
        return '';
    }
}

// Export singleton instance
export const userAgentService = new UserAgentService();
