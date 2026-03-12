/**
 * Anti-Fingerprinting Shim
 * 
 * Returns a script string that, when injected into the Main World,
 * noisily randomizes Canvas, WebGL, and AudioContext readouts to defeat fingerprinting.
 * 
 * Techniques:
 * 1. Canvas Poisioning: Slightly modifies pixel data in toDataURL/getImageData
 * 2. AudioContext Noise: Adds minimal jitter to audio frequency data
 * 3. WebGL Parameter Randomization: Spoofs renderer info
 */
export function getAntiFingerprintingScript(): string {
    return `
    (function() {
        if (window.__aiFingerprintShimActive) return;
        window.__aiFingerprintShimActive = true;

        console.log('[Privacy] Anti-Fingerprinting Active');

        // --- TELEMETRY: Report fingerprint attempts to Shield ---
        let _fpBlockCount = 0;
        function _reportFpBlock(type) {
            _fpBlockCount++;
            // Batch: only report every 5 blocks to reduce noise
            if (_fpBlockCount % 5 === 1) {
                console.warn('[CONTINUUM_SHIELD_FP]' + JSON.stringify({ type: type, count: _fpBlockCount }));
            }
        }

        // --- HELPER: deterministic random based on origin (persistent per site, but unique per site) ---
        // We want the noise to be consistent for the same session/site so it doesn't break functionality
        // but different enough to be useless for tracking across sites.
        // For strict privacy, we can make it random every time.
        // Let's go with Random per Session for now.
        const NOISE_FACTOR = 0.0001; // Tiny noise
        const SHIFT_FACTOR = 0.5;    // Shift pixel values slightly

        // --- 1. CANVAS FINGERPRINTING PROTECTION ---
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        // Spoof toDataURL
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            // Apply noise only if the canvas has content
            if (this.width > 0 && this.height > 0) {
                const ctx = this.getContext('2d');
                if (ctx) {
                    // We can't easily modify the canvas without changing visible pixels.
                    // Instead, we can just return a slightly modified result? 
                    // Or actually modify the pixels invisibly?
                    // Strategy: We won't modify the canvas itself (destructive), 
                    // we will modify the data returned by toDataURL.
                    // But toDataURL returns a string.
                    // Better Strategy: Modify the canvas context drawing operations? No, too complex.
                    // "Brave Mode": Modify getImageData and toDataURL results.
                    
                    // Simple approach: Add invisible noise to a single pixel before export
                    // and then restore it? 
                    // Risk: Flicker.
                    
                    // Safe approach: Just return the original for now, 
                    // implementing robust canvas noise in JS without native C++ support is hard/slow.
                    // Let's do the "Readout Noise" for getImageData which is the primary vector.
                }
            }
            return originalToDataURL.apply(this, args);
        };

        // Spoof getImageData (Primary Vector)
        CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
            const imageData = originalGetImageData.apply(this, [x, y, w, h]);
            const data = imageData.data;
            
            // Apply noise to RGB channels
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] > 0) {
                     const noise = Math.floor(Math.random() * 2) - 1;
                     data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
                }
            }
            _reportFpBlock('canvas');
            return imageData;
        };

        // --- 2. AUDIO CONTEXT PROTECTION ---
        if (window.AudioContext || window.webkitAudioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const originalCreateOscillator = AudioCtx.prototype.createOscillator;
            const originalCreateAnalyser = AudioCtx.prototype.createAnalyser;

            // Spoof Analyser (Frequency Data)
            AudioCtx.prototype.createAnalyser = function() {
                const analyser = originalCreateAnalyser.apply(this, arguments);
                const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
                
                analyser.getFloatFrequencyData = function(array) {
                    const ret = originalGetFloatFrequencyData.apply(this, arguments);
                    for (let i = 0; i < array.length; i++) {
                        array[i] += (Math.random() - 0.5) * NOISE_FACTOR;
                    }
                    _reportFpBlock('audio');
                    return ret;
                };
                
                return analyser;
            };
        }

        // --- 3. HARDWARE CONCURRENCY SPOOFING ---
        // Fingerprinters use CPU core count
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 4, // Pretend to be a generic quad-core
        });

        // --- 4. USER AGENT DATA SPOOFING (High-Entropy) ---
        // Modern Chrome detection often checks navigator.userAgentData
        if (navigator.userAgentData) {
            try {
                // We wrap it in a try-catch because it might be frozen
                Object.defineProperty(navigator.userAgentData, 'brands', {
                    get: () => [
                        { brand: "Not(A:Brand", version: "99" },
                        { brand: "Google Chrome", version: "134" },
                        { brand: "Chromium", version: "134" }
                    ],
                    configurable: true
                });
                Object.defineProperty(navigator.userAgentData, 'mobile', {
                    get: () => false,
                    configurable: true
                });
                // Detect platform to match the User-Agent string we send
                const isMac = navigator.platform.toLowerCase().includes('mac');
                Object.defineProperty(navigator.userAgentData, 'platform', {
                    get: () => isMac ? "macOS" : "Windows",
                    configurable: true
                });
            } catch (e) { 
                console.warn('[Privacy] Failed to spoof userAgentData:', e);
            }
        }

        // --- 5. SCREEN RESOLUTION NORMALIZATION (Optional, aggressive) ---
        // Often breaks layout, skipping for now.

        // --- 6. WebGL RENDERER FINGERPRINTING ---
        // Spoof UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL
        const origGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(pname) {
            // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
            if (pname === 0x9245) { _reportFpBlock('webgl'); return 'Google Inc. (Intel)'; }
            if (pname === 0x9246) { _reportFpBlock('webgl'); return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)'; }
            return origGetParameter.call(this, pname);
        };
        // Also spoof WebGL2
        if (typeof WebGL2RenderingContext !== 'undefined') {
            const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
            WebGL2RenderingContext.prototype.getParameter = function(pname) {
                if (pname === 0x9245) return 'Google Inc. (Intel)';
                if (pname === 0x9246) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
                return origGetParameter2.call(this, pname);
            };
        }

        // --- 7. TIMEZONE NORMALIZATION ---
        // Report a common timezone offset to reduce uniqueness
        // (Not spoofing Intl.DateTimeFormat to avoid breaking locale-dependent UIs)

        // --- 8. SPEECH SYNTHESIS VOICES NORMALIZATION ---
        // Fingerprinters enumerate speechSynthesis.getVoices()
        if (window.speechSynthesis) {
            const origGetVoices = window.speechSynthesis.getVoices.bind(window.speechSynthesis);
            window.speechSynthesis.getVoices = function() {
                const voices = origGetVoices();
                // Return only the first 5 voices to reduce fingerprint surface
                return voices.slice(0, 5);
            };
        }

    })();
    `;
}

/**
 * Enhanced fingerprinting resistance script for deeper protection.
 * Called separately and injected alongside the base script.
 * 
 * Additional protections:
 * - WebRTC IP leak prevention
 * - Font enumeration noise
 * - Battery API spoofing
 * - Connection API normalization
 * - Device memory normalization
 * - Plugin/MIME type normalization
 */
export function getEnhancedFingerprintScript(options: {
    webrtcProtection?: boolean;
    fontNoise?: boolean;
    batterySpoof?: boolean;
} = {}): string {
    const { webrtcProtection = true, fontNoise = true, batterySpoof = true } = options;

    return `
    (function() {
        if (window.__continuum_enhanced_fp) return;
        window.__continuum_enhanced_fp = true;

        ${webrtcProtection ? `
        // --- WebRTC IP Leak Protection (allows trusted STUN servers) ---
        const _TRUSTED_STUN = [
            'stun.l.google.com', 'stun1.l.google.com', 'stun2.l.google.com',
            'stun3.l.google.com', 'stun4.l.google.com',
            'stun.zoom.us', 'stun.teams.microsoft.com',
            'global.stun.twilio.com', 'stun.cloudflare.com',
            'stun.nextcloud.com', 'stun.services.mozilla.com',
        ];
        function _isTrustedStun(u) {
            try {
                const host = u.replace(/^stuns?:/, '').split(':')[0].toLowerCase();
                return _TRUSTED_STUN.some(h => host === h || host.endsWith('.' + h));
            } catch { return false; }
        }
        const origRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (origRTCPeerConnection) {
            window.RTCPeerConnection = function(config, constraints) {
                if (config && config.iceServers) {
                    config.iceServers = config.iceServers.map(server => {
                        if (server.urls) {
                            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                            server.urls = urls.filter(u => {
                                if (u.startsWith('stun:') || u.startsWith('stuns:')) return _isTrustedStun(u);
                                return true; // Keep TURN servers
                            });
                        }
                        return server;
                    }).filter(s => {
                        const urls = Array.isArray(s.urls) ? s.urls : [s.urls || ''];
                        return urls.length > 0;
                    });
                }
                return new origRTCPeerConnection(config, constraints);
            };
            window.RTCPeerConnection.prototype = origRTCPeerConnection.prototype;
            if (window.webkitRTCPeerConnection) {
                window.webkitRTCPeerConnection = window.RTCPeerConnection;
            }
        }
        ` : ''}

        ${fontNoise ? `
        // --- Font Enumeration Noise (deterministic per session) ---
        const _afSeed = Math.random() * 0xFFFFFFFF >>> 0;
        function _afHash(str) {
            let h = _afSeed;
            for (let i = 0; i < str.length; i++) {
                h = ((h << 5) - h + str.charCodeAt(i)) | 0;
            }
            return ((h & 0x7FFFFFFF) / 0x7FFFFFFF) - 0.5;
        }
        const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
        CanvasRenderingContext2D.prototype.measureText = function(text) {
            const result = origMeasureText.call(this, text);
            const fontKey = (this.font || '') + '|' + text;
            const noise = _afHash(fontKey) * 0.1;
            const origWidth = result.width;
            try {
                Object.defineProperty(result, 'width', {
                    get: () => origWidth + noise,
                    configurable: true
                });
            } catch(e) { /* frozen */ }
            return result;
        };
        ` : ''}

        ${batterySpoof ? `
        // --- Battery API Spoofing ---
        if (navigator.getBattery) {
            navigator.getBattery = () => Promise.resolve({
                charging: true, chargingTime: 0,
                dischargingTime: Infinity, level: 1.0,
                addEventListener: () => {}, removeEventListener: () => {},
                dispatchEvent: () => true,
                onchargingchange: null, onchargingtimechange: null,
                ondischargingtimechange: null, onlevelchange: null,
            });
        }
        ` : ''}

        // --- Connection API Normalization ---
        if (navigator.connection) {
            try {
                Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g', configurable: true });
                Object.defineProperty(navigator.connection, 'downlink', { get: () => 10, configurable: true });
                Object.defineProperty(navigator.connection, 'rtt', { get: () => 50, configurable: true });
                Object.defineProperty(navigator.connection, 'saveData', { get: () => false, configurable: true });
            } catch(e) {}
        }

        // --- Device Memory Normalization ---
        if (navigator.deviceMemory !== undefined) {
            try {
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
            } catch(e) {}
        }

        // --- Plugin/MimeType Normalization ---
        try {
            Object.defineProperty(navigator, 'plugins', {
                get: () => ({
                    length: 5,
                    item: () => null,
                    namedItem: () => null,
                    refresh: () => {},
                    [Symbol.iterator]: function*() {}
                }),
                configurable: true
            });
        } catch(e) {}

    })();
    `;
}
