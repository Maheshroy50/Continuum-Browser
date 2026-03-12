/**
 * NetworkMonitor.ts
 * 
 * Helper class to track network idle state in the renderer process.
 * This is crucial for SPAs (Single Page Applications) where the "load" event
 * fires early, but content continues to load via fetch/XHR.
 */

export class NetworkMonitor {
    /**
     * Script to inject into the renderer to track active requests.
     * We monkey-patch fetch and XMLHttpRequest.
     */
    static getInitScript(): string {
        return `
            (function() {
                if (window.__aiNetworkMonitorInitialized) return;
                window.__aiNetworkMonitorInitialized = true;
                
                window.__aiActiveRequests = 0;
                window.__aiLastRequestTime = Date.now();

                // Patch fetch
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    window.__aiActiveRequests++;
                    window.__aiLastRequestTime = Date.now();
                    try {
                        return await originalFetch.apply(this, args);
                    } finally {
                        window.__aiActiveRequests = Math.max(0, window.__aiActiveRequests - 1);
                        window.__aiLastRequestTime = Date.now();
                    }
                };

                // Patch XHR
                const originalXHR = window.XMLHttpRequest;
                class MonitoredXHR extends originalXHR {
                    constructor() {
                        super();
                        this.addEventListener('loadstart', () => {
                            window.__aiActiveRequests++;
                            window.__aiLastRequestTime = Date.now();
                        });
                        this.addEventListener('loadend', () => {
                            window.__aiActiveRequests = Math.max(0, window.__aiActiveRequests - 1);
                            window.__aiLastRequestTime = Date.now();
                        });
                    }
                }
                window.XMLHttpRequest = MonitoredXHR;
            })();
        `;
    }

    /**
     * Script to check if network is idle.
     * Returns true if active requests == 0 and at least 500ms passed since last request.
     */
    static getCheckIdleScript(idleTimeMs: number = 500): string {
        return `
            (function() {
                const active = window.__aiActiveRequests || 0;
                const timeSinceLast = Date.now() - (window.__aiLastRequestTime || 0);
                return active === 0 && timeSinceLast > ${idleTimeMs};
            })();
        `;
    }

    /**
     * Script to get current active request count (for debugging)
     */
    static getStatusScript(): string {
        return `window.__aiActiveRequests || 0`;
    }
}
