import { session } from 'electron';
import { PrivacyManager } from './PrivacyManager';

// Regex for Localhost/Local Networks to avoid breaking dev tools
const LOCALHOST_REGEX = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;
const LOCAL_IP_REGEX = /^http:\/\/(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;

// Store sites that failed HTTPS upgrade so we don't retry endlessly in one session
const failedUpgrades = new Set<string>();

export class HttpsUpgrader {
    private privacyManager: PrivacyManager;

    constructor(privacyManager: PrivacyManager) {
        this.privacyManager = privacyManager;
        this.registerInterceptor();
    }

    private registerInterceptor() {
        const filter = {
            urls: ['http://*/*'] // Only intercept HTTP
        };

        session.defaultSession.webRequest.onBeforeRequest(
            filter,
            (details, callback) => {
                const { url } = details;

                // 1. Check Allow-List (User explicitly said "I want HTTP")
                try {
                    const { origin } = new URL(url);
                    // We need to implement isHttpAllowed in PrivacyManager
                    if (this.privacyManager.isHttpAllowed(origin)) {
                        callback({});
                        return;
                    }
                } catch (e) {
                    // Invalid URL
                    callback({});
                    return;
                }

                // 2. Check if we already tried to upgrade this URL in this session
                if (failedUpgrades.has(url)) {
                    // If it failed before, let the HTTP request proceed
                    callback({});
                    return;
                }

                // 3. Check for Localhost/Local IPs (Do not upgrade)
                try {
                    const { hostname } = new URL(url);
                    if (LOCALHOST_REGEX.test(hostname) || LOCAL_IP_REGEX.test(url)) {
                        callback({});
                        return;
                    }
                } catch (e) {
                    callback({});
                    return;
                }

                // 4. Perform Upgrade
                // console.log(`[Continuum] Upgrading: ${url} -> HTTPS`);

                const upgradedUrl = url.replace(/^http:/, 'https:');

                callback({ redirectURL: upgradedUrl });
            }
        );
    }

    /**
     * Call this when we detect an SSL error or connection failure on the upgraded URL.
     * This removes the automatic redirect, allowing the user to see the error 
     * or click "Load Insecurely".
     */
    public markUpgradeFailed(originalUrl: string) {
        failedUpgrades.add(originalUrl);
        // console.log(`[HttpsUpgrader] Marked failed upgrade: ${originalUrl}`);

        // Optional: Auto-clear after 5 minutes to give it another chance later
        setTimeout(() => {
            failedUpgrades.delete(originalUrl);
        }, 5 * 60 * 1000);
    }
}
