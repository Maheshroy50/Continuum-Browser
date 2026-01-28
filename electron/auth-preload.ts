
// --- LEVEL 5: JS-BASED FINGERPRINT SPOOFING (Chrome 122) ---
// This injects before any other script to overwrite navigator properties
try {
    const script = document.createElement('script');
    script.textContent = `
        (() => {
            // 1. Overwrite the userAgentData property via Object.defineProperty
            // This prevents Google from querying the "brands" array via JS
            if (navigator.userAgentData) {
                const originalGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
                
                Object.defineProperty(navigator, 'userAgentData', {
                    value: {
                        brands: [
                            { brand: 'Chromium', version: '122' },
                            { brand: 'Google Chrome', version: '122' },
                            { brand: 'Not(A:Brand', version: '99' }
                        ],
                        mobile: false, // Important: Says you are Desktop
                        platform: 'macOS', // Match your OS
                        getHighEntropyValues: originalGetHighEntropyValues
                    },
                    configurable: false,
                    enumerable: true,
                    writable: false
                });
            }

            // 2. Fallback: Overwrite standard navigator properties just in case
            // (Use the exact string from your successful Chrome browser - Chrome 122)
            const newUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

            // We use a proxy-like approach for these to be robust
            Object.defineProperty(navigator, 'userAgent', { value: newUA, configurable: false, enumerable: true, writable: false });
            Object.defineProperty(navigator, 'appVersion', { value: newUA.replace('Mozilla/', ''), configurable: false, enumerable: true, writable: false });
            
            // 3. Hide WebDriver (just to be safe)
            if ('webdriver' in navigator) {
                delete Object.getPrototypeOf(navigator).webdriver;
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            }

            // 4. Clean up Electron Trash
            delete window.module;
            delete window.process;
            delete window.require;
            delete window.exports;
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
} catch (e) { }
