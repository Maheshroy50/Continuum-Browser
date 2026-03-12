/**
 * ContinuumShield.ts — Central Security Orchestrator
 * 
 * Coordinates all Continuum Shield security features:
 * 1. Updatable filter lists (EasyList, uBlock Origin, Fanboy)
 * 2. Safe Browsing (local hash-prefix DB from URLhaus/PhishTank)
 * 3. Download quarantine & heuristic scanning
 * 4. Runtime hardening (CSP enforcement, mixed content blocking)
 * 5. Fingerprinting resistance coordination
 * 6. Behavioral monitoring (crypto-mining detection)
 * 7. Security statistics & dashboard data
 */

import { app, ipcMain, session } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { SafeBrowsingDB, ThreatType } from './SafeBrowsingDB';

const log = (...args: any[]) => console.log('[ContinuumShield]', ...args);
const warn = (...args: any[]) => console.warn('[ContinuumShield]', ...args);

// ─── Shield Configuration ───────────────────────────────────────────────
export interface ShieldConfig {
    enabled: boolean;
    safeBrowsingEnabled: boolean;
    downloadQuarantineEnabled: boolean;
    runtimeHardeningEnabled: boolean;
    fingerprintResistanceEnabled: boolean;
    behavioralMonitorEnabled: boolean;
    cryptoMiningProtection: boolean;
    mixedContentBlocking: boolean;
    cspEnforcement: boolean;
    webrtcIpProtection: boolean; // Prevent WebRTC IP leak
    autoUpdateFeeds: boolean;
    feedUpdateIntervalHours: number;
    virusTotalApiKey: string; // User-provided, optional
}

export interface ShieldStats {
    threatsBlockedToday: number;
    phishingBlocked: number;
    malwareBlocked: number;
    downloadsQuarantined: number;
    cryptoMinersBlocked: number;
    mixedContentBlocked: number;
    fingerprintAttemptsBlocked: number;
    lastFeedUpdate: number; // timestamp
    safeBrowsingDbSize: number;
    riskScores: Record<string, number>; // origin → score (0-100)
}

export interface SiteRiskAssessment {
    url: string;
    riskScore: number; // 0 = safe, 100 = dangerous
    threats: ThreatType[];
    details: string[];
}

const CONFIG_FILENAME = 'shield-config.json';
const STATS_FILENAME = 'shield-stats.json';

const DEFAULT_CONFIG: ShieldConfig = {
    enabled: true,
    safeBrowsingEnabled: true,
    downloadQuarantineEnabled: true,
    runtimeHardeningEnabled: true,
    fingerprintResistanceEnabled: true,
    behavioralMonitorEnabled: true,
    cryptoMiningProtection: true,
    mixedContentBlocking: true,
    cspEnforcement: true,
    webrtcIpProtection: true,
    autoUpdateFeeds: true,
    feedUpdateIntervalHours: 6,
    virusTotalApiKey: '',
};

// Known crypto-mining domains
const CRYPTO_MINER_DOMAINS = new Set([
    'coinhive.com', 'coin-hive.com', 'cryptoloot.pro', 'minero.cc',
    'jsecoin.com', 'crypto-loot.com', 'webminepool.com', 'ppoi.org',
    'cryptonight.wasm', 'browsermine.com', 'authedmine.com',
    'coinimp.com', 'afminer.com', 'coinerra.com', 'coin-have.com',
    'mineralt.io', 'webmine.cz', 'monerominer.rocks',
]);

// Suspicious file extensions for download quarantine
const DANGEROUS_EXTENSIONS = new Set([
    '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs',
    '.vbe', '.js', '.jse', '.wsh', '.wsf', '.ps1', '.ps1xml', '.ps2',
    '.ps2xml', '.psc1', '.psc2', '.msh', '.msh1', '.msh2', '.inf',
    '.reg', '.dll', '.cpl', '.hta', '.jar', '.app', '.dmg', '.pkg',
    '.deb', '.rpm', '.sh', '.command', '.action', '.workflow',
]);

// Double-extension patterns (e.g., "photo.jpg.exe")
const DOUBLE_EXTENSION_PATTERN = /\.\w{2,5}\.(exe|msi|bat|cmd|com|scr|pif|vbs|js|ps1|hta|jar|app|dmg)$/i;

export class ContinuumShield {
    // Kept for future: sending threat alerts to the renderer
    public readonly mainWindow: BrowserWindow;
    private config: ShieldConfig;
    private stats: ShieldStats;
    private safeBrowsingDB: SafeBrowsingDB;
    private configPath: string;
    private statsPath: string;
    private quarantinePath: string;
    private feedUpdateTimer: NodeJS.Timeout | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.configPath = path.join(app.getPath('userData'), CONFIG_FILENAME);
        this.statsPath = path.join(app.getPath('userData'), STATS_FILENAME);
        this.quarantinePath = path.join(app.getPath('userData'), 'quarantine');

        this.config = { ...DEFAULT_CONFIG };
        this.stats = this.emptyStats();
        this.safeBrowsingDB = new SafeBrowsingDB();

        this.loadConfig();
        this.loadStats();
        this.ensureQuarantineDir();
        this.setupIPC();
        this.setupRuntimeHardening();
        this.scheduleFeedUpdates();

        log('🛡️ Continuum Shield initialized');
    }

    // ─── Configuration ──────────────────────────────────────────────────

    private emptyStats(): ShieldStats {
        return {
            threatsBlockedToday: 0,
            phishingBlocked: 0,
            malwareBlocked: 0,
            downloadsQuarantined: 0,
            cryptoMinersBlocked: 0,
            mixedContentBlocked: 0,
            fingerprintAttemptsBlocked: 0,
            lastFeedUpdate: 0,
            safeBrowsingDbSize: 0,
            riskScores: {},
        };
    }

    private loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const raw = fs.readFileSync(this.configPath, 'utf-8');
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
                log('Config loaded');
            }
        } catch (e) {
            warn('Failed to load config:', e);
        }
    }

    private saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (e) {
            warn('Failed to save config:', e);
        }
    }

    private loadStats() {
        try {
            if (fs.existsSync(this.statsPath)) {
                const raw = fs.readFileSync(this.statsPath, 'utf-8');
                const saved = JSON.parse(raw);
                // Reset daily stats if it's a new day
                const lastDate = new Date(saved.lastFeedUpdate || 0).toDateString();
                const today = new Date().toDateString();
                if (lastDate !== today) {
                    this.stats = this.emptyStats();
                    this.stats.lastFeedUpdate = saved.lastFeedUpdate || 0;
                } else {
                    this.stats = { ...this.emptyStats(), ...saved };
                }
            }
        } catch (e) {
            warn('Failed to load stats:', e);
        }
    }

    private saveStats() {
        try {
            fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
        } catch (e) {
            warn('Failed to save stats:', e);
        }
    }

    private ensureQuarantineDir() {
        try {
            if (!fs.existsSync(this.quarantinePath)) {
                fs.mkdirSync(this.quarantinePath, { recursive: true });
                log('Quarantine directory created');
            }
        } catch (e) {
            warn('Failed to create quarantine dir:', e);
        }
    }

    // ─── Safe Browsing: Pre-Navigation Check ────────────────────────────

    /**
     * Check a URL before navigating. Returns threat info if dangerous.
     * Called from ViewManager before loading any URL.
     */
    public async checkNavigation(url: string): Promise<SiteRiskAssessment | null> {
        if (!this.config.enabled || !this.config.safeBrowsingEnabled) {
            log(`Shield check skipped (enabled=${this.config.enabled}, safeBrowsing=${this.config.safeBrowsingEnabled})`);
            return null;
        }

        try {
            log(`Checking URL: ${url}`);
            const threats = this.safeBrowsingDB.checkUrl(url);
            if (threats.length > 0) {
                log(`🚨 THREAT DETECTED: ${url} → ${threats.join(', ')}`);
                const riskScore = this.calculateRiskScore(threats);
                const details = threats.map((t: ThreatType) => this.threatDescription(t));

                // Update stats
                threats.forEach((t: ThreatType) => {
                    if (t === 'phishing') this.stats.phishingBlocked++;
                    if (t === 'malware') this.stats.malwareBlocked++;
                    if (t === 'cryptominer') this.stats.cryptoMinersBlocked++;
                    this.stats.threatsBlockedToday++;
                });
                this.saveStats();

                // Store risk score for origin
                try {
                    const origin = new URL(url).origin;
                    this.stats.riskScores[origin] = riskScore;
                } catch { /* invalid URL */ }

                return { url, riskScore, threats, details };
            }
        } catch (e) {
            warn('Safe browsing check failed:', e);
        }
        log(`URL clean: ${url}`);
        return null;
    }

    private calculateRiskScore(threats: ThreatType[]): number {
        let score = 0;
        for (const t of threats) {
            switch (t) {
                case 'malware': score += 90; break;
                case 'phishing': score += 85; break;
                case 'unwanted': score += 60; break;
                case 'cryptominer': score += 70; break;
            }
        }
        return Math.min(score, 100);
    }

    private threatDescription(threat: ThreatType): string {
        switch (threat) {
            case 'phishing': return 'This site is known for phishing attacks';
            case 'malware': return 'This site distributes malware';
            case 'unwanted': return 'This site contains potentially unwanted software';
            case 'cryptominer': return 'This site runs cryptocurrency miners';
            default: return 'Unknown threat detected';
        }
    }

    // ─── Download Quarantine ────────────────────────────────────────────

    /**
     * Analyze a download for threats before allowing it.
     * Returns risk assessment with recommendation.
     */
    public analyzeDownload(filename: string, url: string, fileSize: number): {
        shouldQuarantine: boolean;
        risks: string[];
        riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    } {
        if (!this.config.enabled || !this.config.downloadQuarantineEnabled) {
            return { shouldQuarantine: false, risks: [], riskLevel: 'safe' };
        }

        const risks: string[] = [];
        let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical' = 'safe';

        const ext = path.extname(filename).toLowerCase();

        // Check dangerous extensions
        if (DANGEROUS_EXTENSIONS.has(ext)) {
            risks.push(`Potentially dangerous file type: ${ext}`);
            riskLevel = 'high';
        }

        // Check double extensions (e.g., document.pdf.exe)
        if (DOUBLE_EXTENSION_PATTERN.test(filename)) {
            risks.push('Double file extension detected — possible disguised executable');
            riskLevel = 'critical';
        }

        // Check if source URL is in safe browsing DB
        const urlThreats = this.safeBrowsingDB.checkUrl(url);
        if (urlThreats.length > 0) {
            risks.push(`Download source flagged as: ${urlThreats.join(', ')}`);
            riskLevel = 'critical';
        }

        // Suspiciously small executables (< 50KB) — often droppers
        if (DANGEROUS_EXTENSIONS.has(ext) && fileSize > 0 && fileSize < 50 * 1024) {
            risks.push('Unusually small executable (possible dropper/loader)');
            if (riskLevel !== 'critical') riskLevel = 'high';
        }

        // Very large unknown files (> 500MB) from untrusted sources
        if (fileSize > 500 * 1024 * 1024 && urlThreats.length > 0) {
            risks.push('Large file from suspicious source');
        }

        const shouldQuarantine = riskLevel === 'high' || riskLevel === 'critical';

        if (shouldQuarantine) {
            this.stats.downloadsQuarantined++;
            this.saveStats();
        }

        return { shouldQuarantine, risks, riskLevel };
    }

    /**
     * Get the quarantine directory path for isolating suspicious downloads.
     */
    public getQuarantinePath(): string {
        return this.quarantinePath;
    }

    /**
     * Move a file from quarantine to the user's intended destination.
     */
    public releaseFromQuarantine(quarantineFilename: string, destPath: string): boolean {
        try {
            const src = path.join(this.quarantinePath, quarantineFilename);
            if (fs.existsSync(src)) {
                fs.renameSync(src, destPath);
                log(`Released from quarantine: ${quarantineFilename}`);
                return true;
            }
        } catch (e) {
            warn('Failed to release from quarantine:', e);
        }
        return false;
    }

    /**
     * Delete a quarantined file permanently.
     */
    public deleteQuarantined(quarantineFilename: string): boolean {
        try {
            const filePath = path.join(this.quarantinePath, quarantineFilename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                log(`Deleted quarantined file: ${quarantineFilename}`);
                return true;
            }
        } catch (e) {
            warn('Failed to delete quarantined file:', e);
        }
        return false;
    }

    /**
     * List all quarantined files.
     */
    public listQuarantined(): Array<{ name: string; size: number; quarantinedAt: number }> {
        try {
            if (!fs.existsSync(this.quarantinePath)) return [];
            return fs.readdirSync(this.quarantinePath).map(name => {
                const filePath = path.join(this.quarantinePath, name);
                const stat = fs.statSync(filePath);
                return { name, size: stat.size, quarantinedAt: stat.mtimeMs };
            });
        } catch {
            return [];
        }
    }

    // ─── Runtime Hardening ──────────────────────────────────────────────

    private setupRuntimeHardening() {
        if (!this.config.enabled || !this.config.runtimeHardeningEnabled) return;

        const sess = session.defaultSession;

        // Enforce strict Content Security Policy headers on responses
        if (this.config.cspEnforcement) {
            sess.webRequest.onHeadersReceived(
                { urls: ['*://*/*'] },
                (details, callback) => {
                    const responseHeaders = { ...details.responseHeaders };

                    // Block mixed content: upgrade insecure requests
                    if (this.config.mixedContentBlocking) {
                        // Add upgrade-insecure-requests if not present
                        if (!responseHeaders['Content-Security-Policy']?.some(
                            (h: string) => h.includes('upgrade-insecure-requests')
                        )) {
                            const existing = responseHeaders['Content-Security-Policy'] || [];
                            // Don't override site's CSP, just add upgrade-insecure-requests
                            responseHeaders['Content-Security-Policy'] = [
                                ...existing,
                                'upgrade-insecure-requests'
                            ];
                        }
                    }

                    // Strip dangerous headers that leak info
                    delete responseHeaders['X-Powered-By'];
                    delete responseHeaders['Server'];

                    // Ensure security headers
                    if (!responseHeaders['X-Content-Type-Options']) {
                        responseHeaders['X-Content-Type-Options'] = ['nosniff'];
                    }
                    if (!responseHeaders['X-Frame-Options']) {
                        // Only add for top-level navigations, not subframes
                        // (We don't want to break embedded content)
                    }

                    callback({ responseHeaders });
                }
            );
        }

        // Block crypto-mining WebSocket connections
        if (this.config.cryptoMiningProtection) {
            sess.webRequest.onBeforeRequest(
                { urls: ['ws://*/*', 'wss://*/*'] },
                (details, callback) => {
                    try {
                        const url = new URL(details.url);
                        const hostname = url.hostname;

                        // Check known mining pools
                        if (CRYPTO_MINER_DOMAINS.has(hostname) ||
                            hostname.includes('mining') && hostname.includes('pool') ||
                            url.pathname.includes('/proxy') && url.port === '3333') {
                            this.stats.cryptoMinersBlocked++;
                            this.saveStats();
                            log(`Blocked crypto-miner WebSocket: ${details.url}`);
                            return callback({ cancel: true });
                        }
                    } catch { /* invalid URL */ }
                    callback({ cancel: false });
                }
            );
        }

        log('Runtime hardening active');
    }

    // ─── Behavioral Monitoring (Crypto-Mining Detection Script) ─────────

    /**
     * Returns a script to inject into pages for behavioral monitoring.
     * Detects crypto-mining patterns: excessive CPU usage via performance API,
     * WebAssembly instantiation of known mining modules, etc.
     */
    public getBehavioralMonitorScript(): string {
        if (!this.config.enabled || !this.config.behavioralMonitorEnabled) return '';

        return `
        (function() {
            if (window.__continuum_behavioral_monitor) return;
            window.__continuum_behavioral_monitor = true;

            // --- Crypto-Mining Detection ---
            // Monitor WebAssembly instantiation (miners use WASM)
            const origInstantiate = WebAssembly.instantiate;
            const origInstantiateStreaming = WebAssembly.instantiateStreaming;

            let wasmInstantiationCount = 0;
            const WASM_THRESHOLD = 3; // Alert if > 3 WASM modules in 10 seconds

            WebAssembly.instantiate = function(...args) {
                wasmInstantiationCount++;
                checkMiningBehavior();
                return origInstantiate.apply(this, args);
            };

            if (origInstantiateStreaming) {
                WebAssembly.instantiateStreaming = function(...args) {
                    wasmInstantiationCount++;
                    checkMiningBehavior();
                    return origInstantiateStreaming.apply(this, args);
                };
            }

            // Monitor long-running workers
            const origWorker = window.Worker;
            let workerCount = 0;
            window.Worker = function(url, opts) {
                workerCount++;
                if (workerCount > 4) {
                    // Suspicious: many workers spawned (common in miners)
                    console.warn('[CONTINUUM_SHIELD_ALERT]', JSON.stringify({ reason: 'excessive_workers', count: workerCount }));
                }
                return new origWorker(url, opts);
            };
            // Preserve prototype
            window.Worker.prototype = origWorker.prototype;

            function checkMiningBehavior() {
                if (wasmInstantiationCount > WASM_THRESHOLD) {
                    console.warn('[CONTINUUM_SHIELD_ALERT]', JSON.stringify({
                        reason: 'crypto_mining_suspected',
                        wasmCount: wasmInstantiationCount,
                    }));
                }
            }

            // Reset counters periodically
            setInterval(() => {
                wasmInstantiationCount = 0;
                workerCount = 0;
            }, 10000);
        })();
        `;
    }

    // ─── Enhanced Anti-Fingerprinting Script ────────────────────────────

    /**
     * Returns additional fingerprinting resistance script to supplement
     * the existing AntiFingerprinting.ts module.
     */
    public getEnhancedFingerprintScript(): string {
        if (!this.config.enabled || !this.config.fingerprintResistanceEnabled) return '';

        return `
        (function() {
            if (window.__continuum_enhanced_fp) return;
            window.__continuum_enhanced_fp = true;

            // --- WebRTC IP Leak Protection ---
            ${this.config.webrtcIpProtection ? `
            // Prevent WebRTC from leaking IP via unknown STUN servers
            // Allow known-good STUN servers (Google Meet, Zoom, Teams, Twilio, etc.)
            const TRUSTED_STUN_HOSTS = [
                'stun.l.google.com', 'stun1.l.google.com', 'stun2.l.google.com',
                'stun3.l.google.com', 'stun4.l.google.com',
                'stun.zoom.us', 'stun.teams.microsoft.com',
                'global.stun.twilio.com', 'stun.cloudflare.com',
                'stun.nextcloud.com', 'stun.services.mozilla.com',
                'stun.stunprotocol.org',
            ];
            function _isAllowedStun(url) {
                try {
                    // stun:stun.l.google.com:19302 → extract host
                    const host = url.replace(/^stuns?:/, '').split(':')[0].toLowerCase();
                    return TRUSTED_STUN_HOSTS.some(h => host === h || host.endsWith('.' + h));
                } catch { return false; }
            }
            const origRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
            if (origRTCPeerConnection) {
                window.RTCPeerConnection = function(config, constraints) {
                    // Filter out UNKNOWN stun: servers (keep trusted ones + all turn: servers)
                    if (config && config.iceServers) {
                        config.iceServers = config.iceServers.map(server => {
                            if (server.urls) {
                                const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                                server.urls = urls.filter(u => {
                                    if (u.startsWith('stun:') || u.startsWith('stuns:')) {
                                        return _isAllowedStun(u); // Only keep trusted STUN
                                    }
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

            // --- Font Enumeration Randomization ---
            // Fingerprinters detect installed fonts via canvas/DOM measurement
            const COMMON_FONTS = [
                'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
                'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Trebuchet MS',
                'Arial Black', 'Impact', 'Comic Sans MS'
            ];
            // Deterministic per-session seed so same text → same noise (won't break layouts)
            const _fpSeed = Math.random() * 0xFFFFFFFF >>> 0;
            function _fpHash(str) {
                let h = _fpSeed;
                for (let i = 0; i < str.length; i++) {
                    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
                }
                return ((h & 0x7FFFFFFF) / 0x7FFFFFFF) - 0.5; // -0.5 to +0.5
            }

            const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
            CanvasRenderingContext2D.prototype.measureText = function(text) {
                const result = origMeasureText.call(this, text);
                // Deterministic noise: same text+font → same noise per session
                const fontKey = (this.font || '') + '|' + text;
                const noise = _fpHash(fontKey) * 0.1; // ±0.05px max
                const origWidth = result.width;
                try {
                    Object.defineProperty(result, 'width', {
                        get: () => origWidth + noise,
                        configurable: true
                    });
                } catch(e) { /* frozen object */ }
                return result;
            };

            // --- Battery API Spoofing ---
            // Removed from modern browsers but some still expose it
            if (navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1.0,
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => true,
                    onchargingchange: null,
                    onchargingtimechange: null,
                    ondischargingtimechange: null,
                    onlevelchange: null,
                });
            }

            // --- Connection API Normalization ---
            if (navigator.connection) {
                try {
                    Object.defineProperty(navigator.connection, 'effectiveType', {
                        get: () => '4g', configurable: true
                    });
                    Object.defineProperty(navigator.connection, 'downlink', {
                        get: () => 10, configurable: true
                    });
                    Object.defineProperty(navigator.connection, 'rtt', {
                        get: () => 50, configurable: true
                    });
                    Object.defineProperty(navigator.connection, 'saveData', {
                        get: () => false, configurable: true
                    });
                } catch(e) { /* frozen */ }
            }

            // --- Device Memory Normalization ---
            if (navigator.deviceMemory !== undefined) {
                try {
                    Object.defineProperty(navigator, 'deviceMemory', {
                        get: () => 8, configurable: true
                    });
                } catch(e) { /* frozen */ }
            }

            // --- Plugins/MimeTypes Normalization ---
            try {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => {
                        // Return consistent "Chrome PDF" plugins to look like standard Chrome
                        const fakePlugins = {
                            length: 5,
                            item: (i) => null,
                            namedItem: (name) => null,
                            refresh: () => {},
                            [Symbol.iterator]: function*() {}
                        };
                        return fakePlugins;
                    },
                    configurable: true
                });
            } catch(e) { /* frozen */ }
        })();
        `;
    }

    // ─── Feed Updates ───────────────────────────────────────────────────

    private scheduleFeedUpdates() {
        if (!this.config.autoUpdateFeeds) return;

        // Initial update
        const timeSinceLastUpdate = Date.now() - this.stats.lastFeedUpdate;
        const updateIntervalMs = this.config.feedUpdateIntervalHours * 60 * 60 * 1000;

        if (timeSinceLastUpdate > updateIntervalMs) {
            // Update is due
            this.updateFeeds().catch(e => warn('Feed update failed:', e));
        }

        // Schedule periodic updates
        this.feedUpdateTimer = setInterval(() => {
            this.updateFeeds().catch(e => warn('Periodic feed update failed:', e));
        }, updateIntervalMs);
    }

    public async updateFeeds(): Promise<void> {
        log('Updating threat intelligence feeds...');
        try {
            await this.safeBrowsingDB.updateFeeds();
            this.stats.lastFeedUpdate = Date.now();
            this.stats.safeBrowsingDbSize = this.safeBrowsingDB.getDatabaseSize();
            this.saveStats();
            log(`Feeds updated. DB size: ${this.stats.safeBrowsingDbSize} entries`);
        } catch (e) {
            warn('Feed update error:', e);
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────

    public getConfig(): ShieldConfig {
        return { ...this.config };
    }

    public updateConfig(updates: Partial<ShieldConfig>): ShieldConfig {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
        log('Config updated:', Object.keys(updates).join(', '));
        return { ...this.config };
    }

    public getStats(): ShieldStats {
        return {
            ...this.stats,
            safeBrowsingDbSize: this.safeBrowsingDB.getDatabaseSize(),
        };
    }

    public updateStats(stats: ShieldStats) {
        this.stats = { ...stats };
        this.saveStats();
    }

    public getSiteRisk(url: string): SiteRiskAssessment {
        const threats = this.safeBrowsingDB.checkUrl(url);
        const riskScore = threats.length > 0 ? this.calculateRiskScore(threats) : 0;
        const details = threats.map((t: ThreatType) => this.threatDescription(t));
        return { url, riskScore, threats, details };
    }

    /**
     * Generate an HTML interstitial warning page for a detected threat.
     * Shown instead of loading the dangerous page. User can go back or proceed.
     */
    public getThreatInterstitialHtml(
        url: string,
        riskScore: number,
        threats: ThreatType[],
        details: string[]
    ): string {
        const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const threatBadges = threats.map(t => {
            const colors: Record<string, string> = {
                malware: '#dc2626', phishing: '#ea580c', unwanted: '#ca8a04', cryptominer: '#9333ea'
            };
            return `<span style="background:${colors[t] || '#6b7280'};color:#fff;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${t}</span>`;
        }).join(' ');
        const detailsList = details.map(d => `<li style="margin:8px 0;color:#d1d5db">${d}</li>`).join('');

        return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>⚠️ Security Warning — Continuum Shield</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0f0f0f; color:#e5e7eb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
  .card { max-width:560px; width:100%; background:#1a1a1a; border:1px solid #dc2626; border-radius:16px; padding:40px;
          box-shadow:0 0 60px rgba(220,38,38,0.15); }
  .icon { font-size:64px; text-align:center; margin-bottom:16px; }
  h1 { font-size:22px; color:#fca5a5; text-align:center; margin-bottom:8px; }
  .subtitle { color:#9ca3af; text-align:center; font-size:14px; margin-bottom:24px; }
  .risk-bar { height:8px; background:#374151; border-radius:4px; overflow:hidden; margin:16px 0; }
  .risk-fill { height:100%; border-radius:4px;
    background: ${riskScore >= 85 ? '#dc2626' : riskScore >= 70 ? '#ea580c' : '#ca8a04'};
    width:${riskScore}%; transition:width 0.5s; }
  .badges { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin:16px 0; }
  .url-box { background:#111; border:1px solid #374151; border-radius:8px; padding:12px; word-break:break-all;
             font-family:monospace; font-size:12px; color:#9ca3af; margin:16px 0; }
  ul { list-style:none; padding:0; margin:16px 0; }
  li::before { content:"⚠ "; }
  .actions { display:flex; gap:12px; margin-top:24px; }
  .btn { flex:1; padding:12px 20px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; border:none;
         transition:transform 0.1s,box-shadow 0.15s; }
  .btn:active { transform:scale(0.97); }
  .btn-back { background:#22c55e; color:#000; }
  .btn-back:hover { box-shadow:0 0 20px rgba(34,197,94,0.3); }
  .btn-proceed { background:transparent; color:#6b7280; border:1px solid #374151; }
  .btn-proceed:hover { color:#9ca3af; border-color:#6b7280; }
</style></head><body>
<div class="card">
  <div class="icon">🛡️</div>
  <h1>Dangerous Site Blocked</h1>
  <p class="subtitle">Continuum Shield has blocked this page for your safety</p>
  <div class="risk-bar"><div class="risk-fill"></div></div>
  <p style="text-align:center;font-size:13px;color:#9ca3af">Risk Score: <strong style="color:#fca5a5">${riskScore}/100</strong></p>
  <div class="badges">${threatBadges}</div>
  <div class="url-box">${escapedUrl}</div>
  <ul>${detailsList}</ul>
  <div class="actions">
    <button class="btn btn-back" onclick="history.back()">← Go Back to Safety</button>
    <button class="btn btn-proceed" id="proceedBtn">Proceed Anyway</button>
  </div>
</div>
<script>
  // Proceed requires double-click confirmation
  let clickCount = 0;
  document.getElementById('proceedBtn').addEventListener('click', function() {
    clickCount++;
    if (clickCount === 1) {
      this.textContent = 'Are you sure? Click again';
      this.style.color = '#fca5a5';
      this.style.borderColor = '#dc2626';
      setTimeout(() => { clickCount = 0; this.textContent = 'Proceed Anyway'; this.style.color = '#6b7280'; this.style.borderColor = '#374151'; }, 3000);
    } else {
      window.location.href = '${url.replace(/'/g, "\\'")}';
    }
  });
</script>
</body></html>`;
    }

    // ─── IPC Handlers ───────────────────────────────────────────────────

    private setupIPC() {
        ipcMain.handle('shield:get-config', () => this.getConfig());

        ipcMain.handle('shield:update-config', (_, updates: Partial<ShieldConfig>) => {
            return this.updateConfig(updates);
        });

        ipcMain.handle('shield:get-stats', () => this.getStats());

        ipcMain.handle('shield:check-url', async (_, url: string) => {
            return this.checkNavigation(url);
        });

        ipcMain.handle('shield:get-site-risk', (_, url: string) => {
            return this.getSiteRisk(url);
        });

        ipcMain.handle('shield:update-feeds', async () => {
            await this.updateFeeds();
            return this.getStats();
        });

        ipcMain.handle('shield:list-quarantine', () => {
            return this.listQuarantined();
        });

        ipcMain.handle('shield:release-quarantine', (_, filename: string, destPath: string) => {
            return this.releaseFromQuarantine(filename, destPath);
        });

        ipcMain.handle('shield:delete-quarantine', (_, filename: string) => {
            return this.deleteQuarantined(filename);
        });

        ipcMain.handle('shield:analyze-download', (_, filename: string, url: string, fileSize: number) => {
            return this.analyzeDownload(filename, url, fileSize);
        });
    }

    // ─── Cleanup ────────────────────────────────────────────────────────

    public destroy() {
        if (this.feedUpdateTimer) {
            clearInterval(this.feedUpdateTimer);
            this.feedUpdateTimer = null;
        }

        this.saveStats();

        // Remove IPC handlers
        const handlers = [
            'shield:get-config', 'shield:update-config', 'shield:get-stats',
            'shield:check-url', 'shield:get-site-risk', 'shield:update-feeds',
            'shield:list-quarantine', 'shield:release-quarantine',
            'shield:delete-quarantine', 'shield:analyze-download'
        ];
        handlers.forEach(h => {
            try { ipcMain.removeHandler(h); } catch { }
        });

        log('ContinuumShield destroyed');
    }
}
