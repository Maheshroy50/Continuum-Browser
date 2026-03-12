export const YOUTUBE_BLOCKER_SCRIPT = `
(function() {
    if (window.__continuum_yt_blocker) return;
    window.__continuum_yt_blocker = true;

    // ═══════════════════════════════════════════════════════
    // LAYER 1: Strip ad config from API responses (PRIMARY)
    // This prevents ads from loading in the first place
    // ═══════════════════════════════════════════════════════

    const AD_KEYS = [
        'adPlacements', 'adSlots', 'playerAds', 'adBreakParams',
        'adBreakHeartbeatParams', 'enStyle',
    ];

    const ENFORCEMENT_KEYS = [
        'enforcementMessageViewModel',
        'enforcementMessageView',
    ];

    const ALL_STRIP_KEYS = new Set([...AD_KEYS, ...ENFORCEMENT_KEYS]);
    const MAX_DEPTH = 8;

    function stripAdsFromObject(obj, depth) {
        if (!obj || typeof obj !== 'object' || (depth || 0) > MAX_DEPTH) return obj;
        const d = (depth || 0) + 1;
        if (Array.isArray(obj)) {
            for (let i = obj.length - 1; i >= 0; i--) {
                stripAdsFromObject(obj[i], d);
            }
            return obj;
        }
        for (const key of ALL_STRIP_KEYS) {
            if (key in obj) delete obj[key];
        }
        // Strip enforcement actions without JSON.stringify
        if (obj.actions && Array.isArray(obj.actions)) {
            obj.actions = obj.actions.filter(a => {
                if (!a) return true;
                // Check top-level keys only — fast path
                const keys = Object.keys(a);
                return !keys.some(k => k.toLowerCase().includes('enforcement') || k.toLowerCase().includes('adblocker'));
            });
        }
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                stripAdsFromObject(obj[key], d);
            }
        }
        return obj;
    }

    // ─── Intercept fetch() for /youtubei/ API calls ───
    // Only intercept /player and /next — these contain ad placements.
    // Skip /browse, /search, /reel to avoid parsing huge payloads.
    const _fetch = window.fetch;
    window.fetch = async function(...args) {
        const url = (typeof args[0] === 'string') ? args[0] : args[0]?.url || '';
        const needsStrip = typeof url === 'string' && (
            url.includes('/youtubei/v1/player') ||
            url.includes('/youtubei/v1/next')
        );

        const resp = await _fetch.apply(this, args);
        if (!needsStrip) return resp;

        try {
            const clone = resp.clone();
            const text = await clone.text();
            let data = JSON.parse(text);
            stripAdsFromObject(data, 0);
            return new Response(JSON.stringify(data), {
                status: resp.status,
                statusText: resp.statusText,
                headers: resp.headers,
            });
        } catch(e) {
            return resp;
        }
    };

    // ─── Intercept XMLHttpRequest for older YT code paths ───
    const XHR = XMLHttpRequest.prototype;
    const _xhrOpen = XHR.open;
    const _xhrSend = XHR.send;

    XHR.open = function(method, url, ...rest) {
        this._continuum_url = url;
        return _xhrOpen.apply(this, [method, url, ...rest]);
    };

    XHR.send = function(...args) {
        const url = this._continuum_url || '';
        if (typeof url === 'string' && (
            url.includes('/youtubei/v1/player') ||
            url.includes('/youtubei/v1/next')
        )) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4) {
                    try {
                        const data = JSON.parse(this.responseText);
                        stripAdsFromObject(data, 0);
                        Object.defineProperty(this, 'responseText', {
                            value: JSON.stringify(data),
                            writable: false,
                        });
                        Object.defineProperty(this, 'response', {
                            value: JSON.stringify(data),
                            writable: false,
                        });
                    } catch(e) {}
                }
            });
        }
        return _xhrSend.apply(this, args);
    };

    // ═══════════════════════════════════════════════════════
    // LAYER 2: Intercept ytInitialPlayerResponse (inline data)
    // YouTube embeds initial player data in script tags
    // ═══════════════════════════════════════════════════════

    function stripInitialData() {
        try {
            if (window.ytInitialPlayerResponse) {
                stripAdsFromObject(window.ytInitialPlayerResponse, 0);
            }
            if (window.ytInitialData) {
                stripAdsFromObject(window.ytInitialData, 0);
            }
        } catch(e) {}
    }

    // Intercept property assignment to catch initial data as it's set
    let _ytInitialPlayerResponse = window.ytInitialPlayerResponse;
    try {
        Object.defineProperty(window, 'ytInitialPlayerResponse', {
            get() { return _ytInitialPlayerResponse; },
            set(val) {
                _ytInitialPlayerResponse = stripAdsFromObject(val, 0);
            },
            configurable: true,
        });
    } catch(e) {}

    let _ytInitialData = window.ytInitialData;
    try {
        Object.defineProperty(window, 'ytInitialData', {
            get() { return _ytInitialData; },
            set(val) {
                _ytInitialData = stripAdsFromObject(val, 0);
            },
            configurable: true,
        });
    } catch(e) {}

    // Also strip after DOM is ready (in case data was already set)
    stripInitialData();

    // ═══════════════════════════════════════════════════════
    // LAYER 3: Enforcement dialog dismissal
    // Immediately remove anti-adblock popups/overlays
    // ═══════════════════════════════════════════════════════

    function dismissEnforcementDialog() {
        let didRemove = false;

        // Remove the enforcement overlay dialog
        const selectors = [
            'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
            'ytd-enforcement-message-view-model',
            '#dialog.ytd-enforcement-message-view-model',
        ];
        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
                el.remove();
                didRemove = true;
            });
        }

        // Only clean up backdrop + resume video if we actually removed an enforcement dialog
        if (!didRemove) return;

        // Remove the background overlay/scrim
        document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(el => el.remove());

        // Re-enable scrolling (enforcement dialog locks the page)
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';

        // Resume video ONLY if enforcement dialog was blocking it
        const video = document.querySelector('video');
        if (video && video.paused) {
            video.play().catch(() => {});
        }
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 4: CSS cosmetic hiding (FALLBACK)
    // Hides ad elements that slip through API stripping
    // ═══════════════════════════════════════════════════════

    const adCSS = \`
        /* Video ads */
        .ad-showing .video-ads,
        .ad-showing .ytp-ad-module,
        .ytp-ad-overlay-container,
        .ytp-ad-overlay-slot,
        .ytp-ad-message-container,
        .ytp-ad-image-overlay,
        .ytp-ad-text-overlay,
        .ytp-ad-skip-ad-slot,

        /* Banner / companion ads */
        ytd-banner-promo-renderer,
        ytd-display-ad-renderer,
        ytd-action-companion-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-promoted-sparkles-text-search-renderer,
        ytd-promoted-video-renderer,
        ytd-ad-slot-renderer,
        ytd-in-feed-ad-layout-renderer,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-reel-shelf-renderer:has(.ytd-ad-slot-renderer),
        .ytd-action-companion-ad-renderer,
        .ytd-promoted-sparkles-web-renderer,

        /* Masthead / player ads */
        #player-ads,
        #masthead-ad,
        #panels > ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],

        /* Enforcement / anti-adblock dialogs */
        tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
        ytd-enforcement-message-view-model,
        tp-yt-iron-overlay-backdrop,

        /* Feed / sidebar ads */
        ytd-merch-shelf-renderer,
        ytd-statement-banner-renderer,
        ytd-brand-video-shelf-renderer,
        ytd-brand-video-singleton-renderer,
        #related ytd-promoted-sparkles-web-renderer,

        /* Premium upsell */
        ytd-popup-container:has(a[href*="/premium"]),
        tp-yt-paper-dialog:has(yt-mealbar-promo-renderer),
        ytmusic-mealbar-promo-renderer,

        /* Shorts ads */
        ytd-reel-video-renderer .ytp-ad-overlay-container {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }

        /* Fix video container when ad is force-removed */
        .ad-showing video {
            visibility: visible !important;
        }
    \`;

    const styleEl = document.createElement('style');
    styleEl.id = 'continuum-yt-adblock';
    styleEl.textContent = adCSS;
    (document.head || document.documentElement).appendChild(styleEl);

    // ═══════════════════════════════════════════════════════
    // LAYER 5: Fast ad skipper (catches anything remaining)
    // ═══════════════════════════════════════════════════════

    function skipAd() {
        const player = document.querySelector('#movie_player');
        if (!player) return;

        const isAd = player.classList.contains('ad-showing');
        if (!isAd) return;

        const video = document.querySelector('video');
        if (video && !isNaN(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
            video.muted = true;
        }

        // Click ALL possible skip buttons
        const skipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button',
            'button.ytp-ad-skip-button-modern',
            '.ytp-ad-skip-button-slot button',
            '.videoAdUiSkipButton',
            '[id^="skip-button"]',
            '.ytp-ad-overlay-close-button',
        ];

        for (const sel of skipSelectors) {
            const btn = document.querySelector(sel);
            if (btn) {
                btn.click();
                break;
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 6: MutationObserver for real-time detection
    // ═══════════════════════════════════════════════════════

    // Lightweight interval — just check for ads, no heavy DOM queries
    setInterval(skipAd, 500);

    // ─── Player observer: watch for ad-showing class ───
    const playerObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.target.classList?.contains('ad-showing')) {
                skipAd();
            }
        }
    });

    // ─── Popup observer: watch for enforcement dialogs & ad elements ───
    // Scoped to ytd-popup-container instead of entire body for performance
    const AD_TAGS = new Set([
        'ytd-ad-slot-renderer', 'ytd-display-ad-renderer',
        'ytd-promoted-sparkles-web-renderer', 'ytd-in-feed-ad-layout-renderer',
    ]);
    const popupObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const tag = node.tagName?.toLowerCase();
                if (AD_TAGS.has(tag)) {
                    node.remove();
                    continue;
                }
                // Catch enforcement dialogs being added
                if (tag === 'tp-yt-paper-dialog' || tag === 'ytd-enforcement-message-view-model') {
                    const text = node.textContent || '';
                    if (text.includes('Ad blockers') || text.includes('ad blocker') || text.includes('enforcement')) {
                        node.remove();
                        // Remove backdrop and resume
                        document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(el => el.remove());
                        document.documentElement.style.overflow = '';
                        document.body.style.overflow = '';
                        const video = document.querySelector('video');
                        if (video && video.paused) video.play().catch(() => {});
                    }
                }
                if (tag === 'tp-yt-iron-overlay-backdrop') {
                    node.remove();
                }
            }
        }
    });

    const startObserving = () => {
        const player = document.querySelector('#movie_player');
        if (player) {
            playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
        }
        // Observe popup container (narrow scope) instead of entire body
        const popupContainer = document.querySelector('ytd-popup-container');
        if (popupContainer) {
            popupObserver.observe(popupContainer, { childList: true, subtree: true });
        } else if (document.body) {
            // Fallback: observe body but only childList (no subtree) to catch top-level popups
            popupObserver.observe(document.body, { childList: true, subtree: false });
        }
        // One-time cleanup on attach
        dismissEnforcementDialog();
        stripInitialData();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }

    // Re-attach observer after SPA navigation
    const navObserver = new MutationObserver(() => {
        const player = document.querySelector('#movie_player');
        if (player) {
            playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
        }
        const popupContainer = document.querySelector('ytd-popup-container');
        if (popupContainer) {
            popupObserver.observe(popupContainer, { childList: true, subtree: true });
        }
        stripInitialData();
    });
    const content = document.querySelector('#content');
    if (content) {
        navObserver.observe(content, { childList: true, subtree: false });
    }
})();
`;
