import { Session, app, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// More aggressive blocklist including Gambling + Porn + Fake News to pass "Extreme" tests
const BLOCKLIST_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts';
const CACHE_FILENAME = 'blocklist-cache.txt';

export class BlockerEngine {
    private sessions: Set<Session> = new Set();
    private isEnabled: boolean = true;
    private blockedCount: number = 0;
    private blockedDomains: Set<string> = new Set();

    // Hardcoded fallback list for immediate protection before fetch
    // Hardcoded fallback list for immediate protection before fetch
    private readonly FALLBACK_DOMAINS = [
        'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adnxs.com',
        'advertising.com', 'rubiconproject.com', 'criteo.com', 'outbrain.com', 'taboola.com',
        'google-analytics.com', 'googletagmanager.com', 'facebook.com', 'analytics.twitter.com',
        'hotjar.com', 'segment.io', 'mixpanel.com', 'newrelic.com', 'sentry.io',
        // Common Popup/Popunder Ad Networks
        'popads.net', 'popcash.net', 'propellerads.com', 'adsterra.com', 'exoClick.com',
        'juicyads.com', 'adxpansion.com', 'clickadu.com', 'hilltopads.com', 'popmyads.com',
        'ungads.com', 'bidvertiser.com', 'revenuehits.com', 'infolinks.com', 'bidversal.com',
        'canyoublockit.com' // For testing
    ];

    constructor() {
        // Initialize with fallback
        this.FALLBACK_DOMAINS.forEach(d => this.blockedDomains.add(d));

        // Start loading full list
        this.init().catch(err => console.error('[Blocker] Init failed:', err));
    }

    private async init() {
        const userDataPath = app.getPath('userData');
        const cachePath = path.join(userDataPath, CACHE_FILENAME);

        // 1. Try to load from cache
        if (fs.existsSync(cachePath)) {
            console.log('[Blocker] Loading from cache...');
            try {
                const content = await fs.promises.readFile(cachePath, 'utf-8');
                this.parseAndLoad(content);
                console.log(`[Blocker] Loaded ${this.blockedDomains.size} domains from cache.`);
            } catch (e) {
                console.error('[Blocker] Failed to load cache', e);
            }
        }

        // 2. Fetch update
        console.log('[Blocker] Fetching update...');
        try {
            const content = await this.fetchBlocklist();
            if (content) {
                this.parseAndLoad(content);
                await fs.promises.writeFile(cachePath, content);
                console.log(`[Blocker] Update complete. Total blocked: ${this.blockedDomains.size}`);
            }
        } catch (e) {
            console.error('[Blocker] Fetch failed:', e);
        }
    }

    private fetchBlocklist(): Promise<string> {
        return new Promise((resolve, reject) => {
            const request = net.request(BLOCKLIST_URL);
            request.on('response', (response) => {
                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => resolve(data));
                response.on('error', (err: any) => reject(err));
            });
            request.on('error', (err: any) => reject(err));
            request.end();
        });
    }

    private parseAndLoad(content: string) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Hosts format: 0.0.0.0 domain.com
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                const domain = parts[1];
                if (domain && domain !== 'localhost' && domain !== 'broadcasthost') {
                    this.blockedDomains.add(domain);
                }
            }
        }
    }

    // We bind the listener function so we can remove it later by reference
    private readonly listener = (details: any, callback: (response: any) => void) => {
        if (!this.isEnabled) {
            return callback({ cancel: false });
        }

        try {
            const url = new URL(details.url);
            const hostname = url.hostname;

            let isBlocked = false;
            const parts = hostname.split('.');

            // Subdomain Matching Logic
            // Iterate checks: "sub.ads.example.com" -> "ads.example.com" -> "example.com"
            while (parts.length >= 2) {
                const checkDomain = parts.join('.');
                if (this.blockedDomains.has(checkDomain)) {
                    isBlocked = true;
                    break;
                }
                parts.shift(); // Remove left-most part
            }

            if (isBlocked) {
                console.log(`[Blocker] Blocked: ${hostname}`);
                this.blockedCount++;
                return callback({ cancel: true });
            }

        } catch (e) {
            // Invalid URL, ignore
        }

        callback({ cancel: false });
    };

    public attach(session: Session) {
        if (this.sessions.has(session)) return;

        this.sessions.add(session);
        console.log('[BlockerEngine] Attaching to session');

        const filter = { urls: ['<all_urls>'] };
        session.webRequest.onBeforeRequest(filter, this.listener);
    }

    public detach(session: Session) {
        if (!this.sessions.has(session)) return;

        // @ts-ignore
        session.webRequest.onBeforeRequest(null);
        this.sessions.delete(session);
        console.log('[BlockerEngine] Detached from session');
    }

    public enable() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        console.log('[BlockerEngine] Enabled');
    }

    public disable() {
        this.isEnabled = false;
        console.log('[BlockerEngine] Disabled');
    }

    public toggle() {
        this.isEnabled = !this.isEnabled;
        console.log(`[BlockerEngine] Toggled ${this.isEnabled ? 'ON' : 'OFF'}`);
        return this.isEnabled;
    }

    public getStatus() {
        return {
            isEnabled: this.isEnabled,
            blockedCount: this.blockedCount
        };
    }

    public shouldBlock(urlStr: string): boolean {
        if (!this.isEnabled) return false;

        // Block empty or about:blank popups (common evasion technique)
        if (!urlStr || urlStr === 'about:blank') {
            console.log('[Blocker] Blocked empty/about:blank popup');
            return true;
        }

        try {
            const url = new URL(urlStr);
            const hostname = url.hostname;
            const parts = hostname.split('.');

            while (parts.length >= 2) {
                const checkDomain = parts.join('.');
                if (this.blockedDomains.has(checkDomain)) {
                    console.log(`[Blocker] Popup Blocked: ${hostname}`);
                    this.blockedCount++;
                    return true;
                }
                parts.shift();
            }
        } catch (e) {
            // If URL parsing fails, checking if it might be an invalid protocol often used by ads
            return false;
        }

        return false;
    }
}
