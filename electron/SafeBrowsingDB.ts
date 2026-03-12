/**
 * SafeBrowsingDB.ts — Local-First Safe Browsing Database
 * 
 * Privacy-friendly threat detection using local hash databases.
 * Sources: URLhaus (abuse.ch), PhishTank, and curated threat lists.
 * 
 * How it works:
 * 1. Downloads threat feeds (URLs/domains) and converts them to SHA-256 hash prefixes
 * 2. Stores hashes locally in a Set for O(1) lookup
 * 3. On navigation, hashes the URL/domain and checks against local DB
 * 4. NO external API calls during browsing — all checks are local
 * 5. Feed updates happen in background on a schedule
 */

import { app, net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const log = (...args: any[]) => console.log('[SafeBrowsingDB]', ...args);
const warn = (...args: any[]) => console.warn('[SafeBrowsingDB]', ...args);

export type ThreatType = 'phishing' | 'malware' | 'unwanted' | 'cryptominer';

// Threat feed sources
const THREAT_FEEDS = {
    // URLhaus — Malware URL database from abuse.ch (updated every 5 minutes)
    urlhaus: {
        url: 'https://urlhaus.abuse.ch/downloads/text_online/',
        type: 'malware' as ThreatType,
        format: 'url-list', // One URL per line
    },
    // PhishTank — Community-curated phishing URLs
    phishtank: {
        url: 'https://data.phishtank.com/data/online-valid.csv',
        type: 'phishing' as ThreatType,
        format: 'csv-url', // CSV with URL in column 2
    },
    // OpenPhish — Machine-learning detected phishing URLs (free feed)
    openphish: {
        url: 'https://openphish.com/feed.txt',
        type: 'phishing' as ThreatType,
        format: 'url-list',
    },
    // Crypto-miner domains
    cryptominers: {
        url: 'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/main/cblists/cryptojacking-domains.txt',
        type: 'cryptominer' as ThreatType,
        format: 'domain-list',
    },
    // ThreatFox — abuse.ch IOC database (malware C2 domains)
    threatfox: {
        url: 'https://threatfox.abuse.ch/downloads/hostfile/',
        type: 'malware' as ThreatType,
        format: 'hostfile',
    },
    // StevenBlack unified hosts — malware + adware domains
    stevenblack: {
        url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts',
        type: 'unwanted' as ThreatType,
        format: 'hostfile',
    },
    // Phishing Army — Blocklist of phishing domains
    phishingarmy: {
        url: 'https://phishing.army/download/phishing_army_blocklist.txt',
        type: 'phishing' as ThreatType,
        format: 'domain-list',
    },
    // Malware Domain List (community)
    malwaredomains: {
        url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
        type: 'malware' as ThreatType,
        format: 'domain-list',
    },
};

// Built-in known-bad domains (always present even if feeds fail)
const BUILT_IN_THREATS: Array<{ domain: string; type: ThreatType }> = [
    // Known phishing domains
    { domain: 'secure-login-verify.com', type: 'phishing' },
    { domain: 'account-verify-login.com', type: 'phishing' },
    { domain: 'paypal-login-verify.com', type: 'phishing' },
    { domain: 'apple-id-verify.com', type: 'phishing' },
    { domain: 'microsoft-login-alert.com', type: 'phishing' },
    { domain: 'secure-bank-login.com', type: 'phishing' },
    { domain: 'signin-verify-account.com', type: 'phishing' },
    { domain: 'update-your-account.com', type: 'phishing' },
    { domain: 'verify-your-identity.com', type: 'phishing' },
    { domain: 'login-security-alert.com', type: 'phishing' },
    // Google Safe Browsing test domains
    { domain: 'testsafebrowsing.appspot.com', type: 'phishing' },
    // Known malware distributors
    { domain: 'malware-traffic-analysis.net', type: 'malware' },
    // Known crypto miners
    { domain: 'coinhive.com', type: 'cryptominer' },
    { domain: 'coin-hive.com', type: 'cryptominer' },
    { domain: 'cryptoloot.pro', type: 'cryptominer' },
    { domain: 'authedmine.com', type: 'cryptominer' },
    { domain: 'coinimp.com', type: 'cryptominer' },
    { domain: 'minero.cc', type: 'cryptominer' },
    { domain: 'jsecoin.com', type: 'cryptominer' },
    { domain: 'browsermine.com', type: 'cryptominer' },
    { domain: 'webminepool.com', type: 'cryptominer' },
    { domain: 'mineralt.io', type: 'cryptominer' },
    // Unwanted / scam
    { domain: 'your-computer-has-virus.com', type: 'unwanted' },
    { domain: 'congratulations-you-won.com', type: 'unwanted' },
    { domain: 'free-iphone-giveaway.com', type: 'unwanted' },
];

const DB_CACHE_FILENAME = 'safebrowsing-db.json';
const HASH_PREFIX_LENGTH = 16; // 16 hex chars = 8 bytes of SHA-256

// Major platforms that host user content. Phishing feeds contain URLs on these domains
// (e.g. docs.google.com/forms/d/evil, sites.google.com/phishing-page) but the DOMAINS
// themselves are not malicious. We must NOT create domain-level threat entries for these —
// only exact URL hash entries — otherwise all Google/GitHub/etc. browsing gets blocked.
const TRUSTED_PLATFORM_DOMAINS = new Set([
    'google.com', 'youtube.com', 'gmail.com', 'googleapis.com', 'gstatic.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'microsoft.com', 'live.com', 'outlook.com', 'office.com', 'office365.com',
    'apple.com', 'icloud.com', 'amazon.com', 'aws.amazon.com',
    'github.com', 'gitlab.com', 'bitbucket.org',
    'linkedin.com', 'reddit.com', 'wikipedia.org', 'wikimedia.org',
    'dropbox.com', 'onedrive.live.com', 'drive.google.com',
    'wordpress.com', 'blogspot.com', 'medium.com', 'substack.com',
    'firebase.com', 'firebaseapp.com', 'cloudflare.com',
    'amazonaws.com', 'azure.com', 'netlify.app', 'vercel.app',
    'github.io', 'herokuapp.com', 'pages.dev',
    'spotify.com', 'netflix.com', 'twitch.tv', 'discord.com',
    'zoom.us', 'teams.microsoft.com', 'slack.com',
]);

/**
 * Check if a hostname belongs to a trusted platform.
 * Walks up the domain hierarchy: docs.google.com → google.com → match.
 */
function isTrustedPlatform(hostname: string): boolean {
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        if (TRUSTED_PLATFORM_DOMAINS.has(parts.slice(i).join('.'))) return true;
    }
    return false;
}

export class SafeBrowsingDB {
    // Map from hash prefix → Set of threat types
    private hashDB: Map<string, Set<ThreatType>> = new Map();
    // Full domain set for faster exact-match checking
    private domainThreats: Map<string, Set<ThreatType>> = new Map();
    private dbPath: string;
    private isUpdating: boolean = false;

    constructor() {
        this.dbPath = path.join(app.getPath('userData'), DB_CACHE_FILENAME);
        this.loadBuiltInThreats();
        this.loadFromCache();
    }

    private loadBuiltInThreats() {
        for (const entry of BUILT_IN_THREATS) {
            this.addDomainThreat(entry.domain, entry.type);
        }
        log(`Loaded ${BUILT_IN_THREATS.length} built-in threat entries`);
    }

    private addDomainThreat(domain: string, type: ThreatType) {
        // Store in domain map for fast exact lookup
        if (!this.domainThreats.has(domain)) {
            this.domainThreats.set(domain, new Set());
        }
        this.domainThreats.get(domain)!.add(type);

        // Also store hash prefix for privacy-safe lookups
        const hash = this.hashUrl(domain);
        if (!this.hashDB.has(hash)) {
            this.hashDB.set(hash, new Set());
        }
        this.hashDB.get(hash)!.add(type);
    }

    private addUrlThreat(url: string, type: ThreatType) {
        // Extract domain and add both URL hash and domain
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname;

            // Only add domain-level threat if the domain is NOT a trusted platform.
            // PhishTank/OpenPhish contain phishing URLs on google.com, github.com, etc.
            // but those domains themselves are not malicious — only specific URLs are.
            if (!isTrustedPlatform(hostname)) {
                this.addDomainThreat(hostname, type);
            }

            // Always hash the full URL for exact matching (works for all URLs)
            const hash = this.hashUrl(url);
            if (!this.hashDB.has(hash)) {
                this.hashDB.set(hash, new Set());
            }
            this.hashDB.get(hash)!.add(type);
        } catch {
            // For bare domains (no protocol), add directly as domain threat
            // These come from domain-list feeds where every entry IS a malicious domain
            this.addDomainThreat(url, type);
        }
    }

    /**
     * Hash a URL or domain to a prefix for privacy-safe storage/lookup.
     */
    private hashUrl(urlOrDomain: string): string {
        const normalized = urlOrDomain.toLowerCase().trim().replace(/\/+$/, '');
        return crypto.createHash('sha256')
            .update(normalized)
            .digest('hex')
            .substring(0, HASH_PREFIX_LENGTH);
    }

    /**
     * Check a URL against the local threat database.
     * Returns array of threat types found (empty = safe).
     */
    public checkUrl(url: string): ThreatType[] {
        const threats = new Set<ThreatType>();

        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname;

            // 0. Skip domain-level checks for trusted platforms.
            // Only exact URL hash matching applies to these (in case the exact
            // phishing URL is visited, not the entire platform).
            if (isTrustedPlatform(hostname)) {
                // Only do exact URL hash check, skip domain/hostname checks
                const urlHash = this.hashUrl(url);
                const hashThreats = this.hashDB.get(urlHash);
                if (hashThreats) {
                    hashThreats.forEach(t => threats.add(t));
                }
                return Array.from(threats);
            }

            // 1. Direct domain lookup (fast path)
            const domainParts = hostname.split('.');
            for (let i = 0; i < domainParts.length - 1; i++) {
                const checkDomain = domainParts.slice(i).join('.');
                const domainThreats = this.domainThreats.get(checkDomain);
                if (domainThreats) {
                    domainThreats.forEach(t => threats.add(t));
                }
            }

            // 2. Hash-based lookup (for full URL matching)
            const urlHash = this.hashUrl(url);
            const hashThreats = this.hashDB.get(urlHash);
            if (hashThreats) {
                hashThreats.forEach(t => threats.add(t));
            }

            // 3. Also check hostname hash
            const hostHash = this.hashUrl(hostname);
            const hostHashThreats = this.hashDB.get(hostHash);
            if (hostHashThreats) {
                hostHashThreats.forEach(t => threats.add(t));
            }

        } catch {
            // Invalid URL, can't check
        }

        return Array.from(threats);
    }

    /**
     * Get total number of entries in the database.
     */
    public getDatabaseSize(): number {
        return this.hashDB.size + this.domainThreats.size;
    }

    // ─── Feed Updates ───────────────────────────────────────────────────

    /**
     * Update all threat feeds. Downloads fresh data and rebuilds the local DB.
     */
    public async updateFeeds(): Promise<void> {
        if (this.isUpdating) {
            log('Update already in progress, skipping');
            return;
        }

        this.isUpdating = true;
        log('Starting feed update...');

        try {
            // Fetch each feed in parallel
            const feedPromises = Object.entries(THREAT_FEEDS).map(
                ([name, feed]) => this.fetchFeed(name, feed.url, feed.type, feed.format)
                    .catch(e => {
                        warn(`Failed to fetch ${name}:`, e?.message || e);
                        return 0;
                    })
            );

            const results = await Promise.all(feedPromises);
            const totalNew = results.reduce((sum, n) => sum + n, 0);
            log(`Feed update complete. ${totalNew} new entries added. Total DB: ${this.getDatabaseSize()}`);

            // Save to cache
            this.saveToCache();
        } finally {
            this.isUpdating = false;
        }
    }

    private async fetchFeed(
        name: string,
        url: string,
        type: ThreatType,
        format: string
    ): Promise<number> {
        log(`Fetching ${name}...`);
        const content = await this.fetchUrl(url);
        if (!content) return 0;

        let count = 0;
        const lines = content.split('\n');

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) continue;

            let target = '';

            switch (format) {
                case 'url-list':
                    // Each line is a URL
                    if (line.startsWith('http')) {
                        target = line;
                    }
                    break;
                case 'domain-list':
                    // Each line is a domain
                    if (!line.includes('/') && line.includes('.') && !line.includes(' ')) {
                        target = line;
                    }
                    break;
                case 'hostfile':
                    // Format: "0.0.0.0 domain" or "127.0.0.1 domain"
                    if (line.startsWith('0.0.0.0 ') || line.startsWith('127.0.0.1 ')) {
                        const parts = line.split(/\s+/);
                        if (parts.length >= 2 && parts[1].includes('.') && parts[1] !== '0.0.0.0') {
                            target = parts[1];
                        }
                    }
                    break;
                case 'csv-url':
                    // CSV with URL in column 2 (PhishTank format)
                    {
                        const parts = line.split(',');
                        if (parts.length >= 2) {
                            const urlField = parts[1]?.replace(/"/g, '').trim();
                            if (urlField && urlField.startsWith('http')) {
                                target = urlField;
                            }
                        }
                    }
                    break;
            }

            if (target) {
                this.addUrlThreat(target, type);
                count++;
            }

            // Cap at 100k entries per feed to prevent memory bloat
            if (count >= 100_000) break;
        }

        log(`${name}: ${count} entries loaded`);
        return count;
    }

    private fetchUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);

            try {
                const request = net.request(url);
                request.on('response', (response) => {
                    // Only accept successful responses
                    if (response.statusCode && response.statusCode >= 400) {
                        clearTimeout(timeout);
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    let data = '';
                    let bytesReceived = 0;
                    const MAX_BYTES = 50 * 1024 * 1024; // 50MB cap

                    response.on('data', (chunk: Buffer) => {
                        bytesReceived += chunk.length;
                        if (bytesReceived > MAX_BYTES) {
                            clearTimeout(timeout);
                            resolve(data); // Return what we have
                            return;
                        }
                        data += chunk.toString();
                    });
                    response.on('end', () => {
                        clearTimeout(timeout);
                        resolve(data);
                    });
                    response.on('error', (err: any) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
                });
                request.on('error', (err: any) => {
                    clearTimeout(timeout);
                    reject(err);
                });
                request.end();
            } catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    // ─── Cache Persistence ──────────────────────────────────────────────

    private saveToCache() {
        try {
            const cacheData: {
                version: number;
                timestamp: number;
                domains: Record<string, ThreatType[]>;
                hashes: Record<string, ThreatType[]>;
            } = {
                version: 2,  // Bumped: v1 cache had trusted platform domains (google.com etc.) flagged
                timestamp: Date.now(),
                domains: {},
                hashes: {},
            };

            // Save domain map
            this.domainThreats.forEach((types, domain) => {
                cacheData.domains[domain] = Array.from(types);
            });

            // Save hash map (subset — domains already cover most)
            // Only save hashes that don't correspond to direct domain entries
            let hashCount = 0;
            this.hashDB.forEach((types, hash) => {
                if (hashCount < 200_000) { // Cap cache size
                    cacheData.hashes[hash] = Array.from(types);
                    hashCount++;
                }
            });

            fs.writeFileSync(this.dbPath, JSON.stringify(cacheData));
            log(`Cache saved: ${Object.keys(cacheData.domains).length} domains, ${hashCount} hashes`);
        } catch (e) {
            warn('Failed to save cache:', e);
        }
    }

    private loadFromCache() {
        try {
            if (!fs.existsSync(this.dbPath)) return;

            const raw = fs.readFileSync(this.dbPath, 'utf-8');
            const cacheData = JSON.parse(raw);

            if (cacheData.version !== 2) {
                log('Cache version outdated (v1 had false positives), will fetch fresh data');
                // Delete the old cache file
                try { fs.unlinkSync(this.dbPath); } catch { /* ok */ }
                return;
            }

            // Check if cache is too old (> 7 days)
            const cacheAge = Date.now() - (cacheData.timestamp || 0);
            if (cacheAge > 7 * 24 * 60 * 60 * 1000) {
                log('Cache too old, will fetch fresh data');
                return;
            }

            // Load domains (skip any that are trusted platforms — safety net)
            if (cacheData.domains) {
                for (const [domain, types] of Object.entries(cacheData.domains)) {
                    if (isTrustedPlatform(domain)) continue; // Safety net
                    for (const type of (types as ThreatType[])) {
                        this.addDomainThreat(domain, type);
                    }
                }
            }

            // Load hashes
            if (cacheData.hashes) {
                for (const [hash, types] of Object.entries(cacheData.hashes)) {
                    if (!this.hashDB.has(hash)) {
                        this.hashDB.set(hash, new Set());
                    }
                    for (const type of (types as ThreatType[])) {
                        this.hashDB.get(hash)!.add(type);
                    }
                }
            }

            log(`Cache loaded: ${this.domainThreats.size} domains, ${this.hashDB.size} hashes`);
        } catch (e) {
            warn('Failed to load cache:', e);
        }
    }
}
