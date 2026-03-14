import { Session, app, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type BlockerLevel = 'standard' | 'aggressive' | 'maximum';

interface BlockerConfig {
    level: BlockerLevel;
    youtubeAdsBlocked: boolean;
    whitelist: string[];
}

// Multiple filter list sources for comprehensive coverage
const FILTER_LISTS: Record<string, string> = {
    stevenblack: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    stevenblack_extreme: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts',
    peterlowe: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
    adaway: 'https://adaway.org/hosts.txt',
};

// Which lists each level uses
const LEVEL_LISTS: Record<BlockerLevel, string[]> = {
    standard: ['stevenblack'],
    aggressive: ['stevenblack', 'peterlowe', 'adaway'],
    maximum: ['stevenblack_extreme', 'peterlowe', 'adaway'],
};

const CONFIG_FILENAME = 'blocker-config.json';
const CACHE_FILENAME = 'blocklist-cache.txt';

export class BlockerEngine {
    private sessions: Set<Session> = new Set();
    private isEnabled: boolean = true;
    private useNetworkBlocking: boolean = true;
    private blockedCount: number = 0;
    private blockedDomains: Set<string> = new Set();
    private config: BlockerConfig = {
        level: 'aggressive',
        youtubeAdsBlocked: true,
        whitelist: [],
    };

    // Major ad networks, trackers, analytics, crypto miners
    private readonly FALLBACK_DOMAINS = [
        // Major Ad Networks
        'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adnxs.com',
        'advertising.com', 'rubiconproject.com', 'criteo.com', 'outbrain.com', 'taboola.com',
        'pubmatic.com', 'openx.net', 'casalemedia.com', 'indexexchange.com', 'smartadserver.com',
        'adcolony.com', 'applovin.com', 'vungle.com',
        'adsrvr.org', 'adform.net', 'admob.com', 'mobileadtrading.com', 'inmobi.com',
        // Analytics & Trackers
        'google-analytics.com', 'googletagmanager.com', 'analytics.twitter.com',
        'hotjar.com', 'segment.io', 'mixpanel.com', 'newrelic.com',
        'amplitude.com', 'quantserve.com', 'scorecardresearch.com', 'comscore.com',
        'optimizely.com', 'crazyegg.com', 'fullstory.com', 'mouseflow.com',
        'branch.io', 'adjust.com', 'appsflyer.com', 'kochava.com',
        // Social Tracking (NOT the main sites — only tracking pixels)
        'connect.facebook.net', 'pixel.facebook.com',
        'analytics.tiktok.com', 'ads.linkedin.com', 'ads.pinterest.com',
        // Popup / Popunder Ad Networks
        'popads.net', 'popcash.net', 'propellerads.com', 'adsterra.com', 'exoclick.com',
        'juicyads.com', 'adxpansion.com', 'clickadu.com', 'hilltopads.com', 'popmyads.com',
        'ungads.com', 'bidvertiser.com', 'revenuehits.com', 'infolinks.com',
        // Crypto Miners
        'coinhive.com', 'coin-hive.com', 'cryptoloot.pro', 'minero.cc', 'jsecoin.com',
        // Malware / Scam
        'malware-check.disconnect.me', 'ilivid.com',
        // YouTube Ad servers
        'pagead2.googlesyndication.com', 'ad.doubleclick.net',
        'static.doubleclick.net', 'googleads.g.doubleclick.net',
        's0.2mdn.net', 'innovid.com', 'securepubads.g.doubleclick.net',
        // === Streaming / Piracy Site Ad Networks ===
        // Popunder / Redirect Networks (common on anime/streaming sites)
        'syndication.realsrv.com', 'realsrv.com', 'tsyndicate.com', 'syndication.exdynsrv.com',
        'exdynsrv.com', 'exosrv.com', 'adsco.re', 'adskeeper.co.uk', 'adskeeper.com',
        'a-ads.com', 'ad-maven.com', 'admaven.co', 'ad-delivery.net',
        'trafficjunky.com', 'trafficjunky.net', 'cpmstar.com',
        'disqus.com', 'marketgid.com', 'mgid.com',
        'betrad.com', 'voiranime.com', 'streamtape.com',
        'mixdrop.co', 'upstream.to', 'disable-adblock.com',
        // Redirect / Cloaking Domains
        'shrinkme.io', 'bc.vc', 'adf.ly', 'ouo.io', 'ouo.press',
        'linkvertise.com', 'linkvertise.net', 'link1s.com',
        'tinyurl5.com', 'exe.io', 'fc.lc', 'gplinks.co',
        // Overlay / Interstitial Ad Servers
        'whos.amung.us', 'histats.com', 'c.comenity.net',
        'monkeybroker.com', 'go.oclasrv.com', 'oclasrv.com',
        'offerimage.com', 'go.onclasrv.com', 'onclasrv.com',
        'onclkds.com', 'clksite.com', 'clkmon.com', 'wishlistmember.com',
        'notifpush.com', 'pushame.com', 'pushails.com', 'pushnami.com',
        'richpush.co', 'push.express', 'roost.me', 'geozo.com',
        // Anti-adblock & Scam overlay
        'blockadblock.com', 'fuckadblock.com', 'pagead-googlehosted.l.google.com',
        'fundingchoicesmessages.google.com',
        // Common streaming-site popup/redirect domains
        'mylottochamp24.com', 'mybettingsite.com',
        'streamingbetter.com', 'watchfreemovies.com',
        'betway.com', 'bet365.com', '1xbet.com', 'stake.com',
        'luckyorange.com', 'gamblingsites.com',
    ];

    constructor() {
        this.FALLBACK_DOMAINS.forEach(d => this.blockedDomains.add(d));
        this.loadConfig();
        this.init().catch(err => console.error('[Blocker] Init failed:', err));
    }

    private loadConfig() {
        try {
            const configPath = path.join(app.getPath('userData'), CONFIG_FILENAME);
            if (fs.existsSync(configPath)) {
                const raw = fs.readFileSync(configPath, 'utf-8');
                const saved = JSON.parse(raw);
                this.config = { ...this.config, ...saved };
                console.log(`[Blocker] Config loaded: level=${this.config.level}, whitelist=${this.config.whitelist.length} sites`);
            }
        } catch (e) {
            console.error('[Blocker] Failed to load config:', e);
        }
    }

    private saveConfig() {
        try {
            const configPath = path.join(app.getPath('userData'), CONFIG_FILENAME);
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        } catch (e) {
            console.error('[Blocker] Failed to save config:', e);
        }
    }

    private async init() {
        const userDataPath = app.getPath('userData');
        const cachePath = path.join(userDataPath, CACHE_FILENAME);

        // 1. Load from cache
        if (fs.existsSync(cachePath)) {
            try {
                const content = await fs.promises.readFile(cachePath, 'utf-8');
                this.parseAndLoad(content);
                console.log(`[Blocker] Loaded ${this.blockedDomains.size} domains from cache.`);
            } catch (e) {
                console.error('[Blocker] Failed to load cache', e);
            }
        }

        // 2. Fetch lists based on current level
        await this.fetchAllLists();
    }

    private async fetchAllLists() {
        const listsToFetch = LEVEL_LISTS[this.config.level] || LEVEL_LISTS.aggressive;
        const userDataPath = app.getPath('userData');
        const cachePath = path.join(userDataPath, CACHE_FILENAME);

        console.log(`[Blocker] Fetching ${listsToFetch.length} lists for level: ${this.config.level}`);

        const fetchPromises = listsToFetch.map(async (listId) => {
            const url = FILTER_LISTS[listId];
            if (!url) return null;
            try {
                return await this.fetchBlocklist(url);
            } catch (e) {
                console.warn(`[Blocker] Failed to fetch ${listId}:`, e);
                return null;
            }
        });

        const results = await Promise.all(fetchPromises);
        let allContent = '';
        for (const content of results) {
            if (content) {
                allContent += '\n' + content;
                this.parseAndLoad(content);
            }
        }

        if (allContent) {
            await fs.promises.writeFile(cachePath, allContent).catch(() => { });
            console.log(`[Blocker] Update complete. Total blocked domains: ${this.blockedDomains.size}`);
        }
    }

    private fetchBlocklist(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const request = net.request(url);
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
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

            // Hosts format: 0.0.0.0 domain.com  OR  127.0.0.1 domain.com
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2 && (parts[0] === '0.0.0.0' || parts[0] === '127.0.0.1')) {
                const domain = parts[1];
                if (domain && domain !== 'localhost' && domain !== 'broadcasthost' && domain.includes('.')) {
                    this.blockedDomains.add(domain);
                }
            }
        }
    }

    private isWhitelisted(hostname: string): boolean {
        return this.config.whitelist.some(w => {
            return hostname === w || hostname.endsWith('.' + w);
        });
    }

    // URL patterns that indicate ad/redirect/popunder scripts (checked in 'maximum' mode)
    private readonly AD_URL_PATTERNS: RegExp[] = [
        /\/pop\.js/i, /\/popunder/i, /\/popundr/i,
        /\/redirect\?.*click/i, /\/clickunder/i,
        /vast\.xml/i, /vpaid/i,
        /\/adserv/i, /\/adserver/i,
        /\/ads\/.*\.js/i, /\/ad\.js/i, /\/ads\.js/i,
        /\/prebid/i, /\/gpt\.js/i,
        /\.gif\?.*&click/i,
        /\/openx\//i, /\/adfox\//i,
        /\/banners?\//i,
        /\/track(er|ing)?\/?\?/i,
        /\/pixel(\.gif|\.png)?\?/i,
        /beacon\.js/i,
        /\/push-?notifications?/i,
        /\/sw\.js.*push/i,
        /\/service-?worker.*ads/i,
    ];

    // Resource types to block aggressively in maximum mode (sub_frame = ad iframes)
    private readonly BLOCKED_RESOURCE_TYPES_MAX: Set<string> = new Set([
        'object', 'object-subrequest',
    ]);

    private readonly listener = (details: any, callback: (response: any) => void) => {
        if (!this.isEnabled) {
            return callback({ cancel: false });
        }

        try {
            const url = new URL(details.url);
            const hostname = url.hostname;
            const fullUrl = details.url;

            // Skip whitelisted domains
            if (this.isWhitelisted(hostname)) {
                return callback({ cancel: false });
            }

            // === YouTube-specific ad request blocking ===
            // Block YouTube ad-serving and tracking requests at the network level
            if (this.config.youtubeAdsBlocked && (
                hostname.includes('youtube.com') ||
                hostname.includes('googlevideo.com') ||
                hostname.includes('doubleclick.net') ||
                hostname.includes('googlesyndication.com') ||
                hostname.includes('googleadservices.com')
            )) {
                // Block ad video streams (contain /videoplayback with specific ad params)
                if (fullUrl.includes('/videoplayback') && (
                    fullUrl.includes('&ctier=L') ||
                    fullUrl.includes('oad=') ||
                    fullUrl.includes('&adformat=')
                )) {
                    this.blockedCount++;
                    return callback({ cancel: true });
                }
                // Block ad telemetry & tracking pings
                if (fullUrl.includes('/api/stats/ads') ||
                    fullUrl.includes('/pagead/') ||
                    fullUrl.includes('/ptracking') ||
                    fullUrl.includes('/pcs/activeview') ||
                    fullUrl.includes('/pagead/interaction') ||
                    fullUrl.includes('googleads.g.doubleclick.net') ||
                    fullUrl.includes('securepubads.g.doubleclick.net') ||
                    fullUrl.includes('/generate_204')
                ) {
                    this.blockedCount++;
                    return callback({ cancel: true });
                }
                // Block fundingchoices (anti-adblock detection)
                if (hostname.includes('fundingchoicesmessages.google.com')) {
                    this.blockedCount++;
                    return callback({ cancel: true });
                }
            }

            let isBlocked = false;
            const parts = hostname.split('.');

            // Subdomain Matching Logic
            while (parts.length >= 2) {
                const checkDomain = parts.join('.');
                if (this.blockedDomains.has(checkDomain)) {
                    isBlocked = true;
                    break;
                }
                parts.shift();
            }

            if (isBlocked) {
                this.blockedCount++;
                return callback({ cancel: true });
            }

            // === AGGRESSIVE / MAXIMUM MODE: URL Pattern + Resource Type Blocking ===
            if (this.config.level === 'maximum' || this.config.level === 'aggressive') {
                const fullUrl = details.url;

                // Block ad-related URL patterns
                for (const pattern of this.AD_URL_PATTERNS) {
                    if (pattern.test(fullUrl)) {
                        this.blockedCount++;
                        return callback({ cancel: true });
                    }
                }

                // Block iframes whose SRC matches known ad patterns (not blanket cross-origin!)
                // This avoids killing legitimate video player iframes (filemoon, vidcloud, etc.)
                if (details.resourceType === 'subFrame') {
                    const AD_IFRAME_PATTERNS = [
                        /doubleclick\.net/i, /googlesyndication\.com/i,
                        /adserver/i, /adservice/i, /adsrvr/i,
                        /popads|popunder|clickadu|adsterra|propeller|exoclick/i,
                        /syndication\.realsrv|tsyndicate|exdynsrv|exosrv/i,
                        /oclasrv|onclasrv|onclkds|clksite/i,
                        /admaven|ad-maven|ad-delivery|adsboosters/i,
                        /trafficjunky|juicyads|hilltopads|popcash/i,
                        /betting|casino|lottery|lotto|1xbet|bet365/i,
                        /mylottochamp|stake\.com/i,
                    ];
                    for (const pattern of AD_IFRAME_PATTERNS) {
                        if (pattern.test(fullUrl)) {
                            this.blockedCount++;
                            return callback({ cancel: true });
                        }
                    }
                }

                // Block object/embed types (Flash-era ad containers)
                if (this.BLOCKED_RESOURCE_TYPES_MAX.has(details.resourceType)) {
                    this.blockedCount++;
                    return callback({ cancel: true });
                }
            }

        } catch (e) { /* Invalid URL */ }

        callback({ cancel: false });
    };

    public attach(session: Session) {
        if (this.sessions.has(session)) return;
        this.sessions.add(session);

        if (!this.useNetworkBlocking) {
            console.log('[BlockerEngine] Network blocking disabled.');
            return;
        }

        console.log('[BlockerEngine] 🛡️ Attaching network-level ad blocker to session');
        const filter = { urls: ['<all_urls>'] };
        session.webRequest.onBeforeRequest(filter, this.listener);
    }

    public detach(session: Session) {
        if (!this.sessions.has(session)) return;
        if (this.useNetworkBlocking) {
            // @ts-ignore
            session.webRequest.onBeforeRequest(null);
        }
        this.sessions.delete(session);
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
            blockedCount: this.blockedCount,
            level: this.config.level,
            youtubeAdsBlocked: this.config.youtubeAdsBlocked,
            whitelist: this.config.whitelist,
            totalDomains: this.blockedDomains.size,
        };
    }

    public getLevel(): BlockerLevel {
        return this.config.level;
    }

    public setLevel(level: BlockerLevel) {
        if (this.config.level === level) return;
        this.config.level = level;
        this.saveConfig();
        // Re-fetch lists for new level
        this.blockedDomains.clear();
        this.FALLBACK_DOMAINS.forEach(d => this.blockedDomains.add(d));
        this.fetchAllLists().catch(err => console.error('[Blocker] Re-fetch failed:', err));
        console.log(`[BlockerEngine] Level set to: ${level}`);
    }

    public setYoutubeBlocking(enabled: boolean) {
        this.config.youtubeAdsBlocked = enabled;
        this.saveConfig();
    }

    public addWhitelist(domain: string) {
        const d = domain.toLowerCase().replace(/^www\./, '');
        if (!this.config.whitelist.includes(d)) {
            this.config.whitelist.push(d);
            this.saveConfig();
        }
    }

    public removeWhitelist(domain: string) {
        const d = domain.toLowerCase().replace(/^www\./, '');
        this.config.whitelist = this.config.whitelist.filter(w => w !== d);
        this.saveConfig();
    }

    public shouldBlock(urlStr: string): boolean {
        if (!this.isEnabled) return false;
        if (!urlStr || urlStr === 'about:blank') return true;

        try {
            const url = new URL(urlStr);
            const hostname = url.hostname;

            if (this.isWhitelisted(hostname)) return false;

            const parts = hostname.split('.');
            while (parts.length >= 2) {
                const checkDomain = parts.join('.');
                if (this.blockedDomains.has(checkDomain)) {
                    this.blockedCount++;
                    return true;
                }
                parts.shift();
            }
        } catch (e) {
            return false;
        }

        return false;
    }
}
