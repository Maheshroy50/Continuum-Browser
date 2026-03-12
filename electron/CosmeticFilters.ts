export const AD_BLOCKING_CSS = `
/* ═══════════════════════════════════════════
   Continuum Cosmetic Ad Filters
   Comprehensive element hiding rules
   ═══════════════════════════════════════════ */

/* ── Google Ads ── */
[id^="google_ads_"],
.adsbygoogle,
ins.adsbygoogle,
[data-ad-slot],
[data-ad-client],
[data-google-query-id],
#google_ads_frame1,
#google_ads_frame2,

/* ── DoubleClick / Ad iframes ── */
a[href*="doubleclick.net"],
iframe[src*="doubleclick.net"],
iframe[src*="googleads"],
iframe[src*="adserver"],
iframe[src*="ad.doubleclick"],
iframe[data-src*="ads"],

/* ── Generic Ad Containers ── */
[class*=" ad "],
[class*=" ads "],
div[id*="ScriptRoot"],
.ad-banner,
.ad-container,
.ad-wrapper,
.ad-slot,
.ad-unit,
.ad-block,
.box_ad,
#ad-container,
#banner-ad,
#top-ad,
#bottom-ad,
#sidebar-ad,
.native-ad,

/* ── Interstitials & Overlays ── */
#interstitial_ad,
.interstitial,
.interstitial-ad,
.overlay-ad,
.modal-ad,
div[class*="interstitial"],

/* ── Sticky / Floating ── */
.sticky-ad,
.floating-ad,
.bottom-ad-bar,
.top-ad-bar,
[class*="sticky-ad"],
[class*="floating-ad"],
.adhesion-ad,

/* ── Push Notifications & Popups ── */
.push-notification-request,
.in-page-push,
.notification-popup,
[class*="push-notification"],

/* ── Social Sharing Walls / Cookie Walls ── */
[class*="cookie-wall"],
[class*="consent-wall"],

/* ── Specific Ad Networks ── */
[id*="taboola"],
[class*="taboola"],
[id*="outbrain"],
[class*="outbrain"],
.OUTBRAIN,
#taboola-below-article,
.taboola-container,
[data-outbrain-widget],

/* ── Common test site selectors ── */
[data-ad-slot],
[data-ad-client],

/* ── Aggressive: common ad wrapper patterns ── */
div[class*="ad-placement"],
div[class*="ad-leaderboard"],
div[class*="ad-rectangle"],
div[class*="ad-skyscraper"],
aside[id*="sidebar"] > div[class*="widget"] > div[class*="ad"],
div[class*="sponsored-content"],
div[class*="promoted-content"],
article[class*="sponsored"],
[class*="sponsor-"],
[data-testid="ad"],
[data-testid="ad-container"],
[aria-label*="advertisement" i],
[aria-label*="sponsored" i]
{
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    z-index: -9999 !important;
}
`;

// ═══════════════════════════════════════════
//  Streaming Site Anti-Ad & Anti-Redirect CSS
//  Targets overlays, popunders, click-hijack layers
// ═══════════════════════════════════════════
export const STREAMING_AD_CSS = `
/* ── Click-Hijack Overlays ── */
/* Invisible layers on top of video players that redirect on click */
div[style*="z-index: 2147483647"],
div[style*="z-index:2147483647"],

/* ── Popunder trigger elements ── */
[class*="popunder"],
[id*="popunder"],
[class*="pop-under"],
[id*="pop-under"],
[class*="clickunder"],
[id*="clickunder"],

/* ── Full-screen ad overlays ── */
div[class*="ad-overlay"],
div[id*="ad-overlay"],
div[class*="adOverlay"],
div[id*="adOverlay"],
.overlay-blocker,
div.ad-mask,
div.ads-mask,

/* ── Streaming-specific ad containers ── */
div[class*="vast-blocker"],
div[class*="preroll-ad"],
div[id*="preroll-ad"],
.video-ad-overlay,
.player-ad-overlay,

/* ── Notification / Push / Telegram spam ── */
div[class*="push-notification"],
div[id*="push-notification"],
a[href*="t.me"][style*="position: fixed"],
div[class*="join-telegram"],

/* ── Anti-adblock walls ── */
div[class*="adblock-notice"],
div[id*="adblock-notice"],
div[class*="adb-overlay"],
div[class*="adblock-modal"],
div[id*="adblock-modal"],

/* ── Telegram / Discord join bars ── */
a[href*="t.me"],
a[href*="telegram.me"],
a[href*="discord.gg"],
div[class*="telegram"],
div[id*="telegram"],
div[class*="join-group"],
div[id*="join-group"],
div[class*="join-channel"],

/* ── Scam / Lottery / Betting link elements ── */
a[href*="mylottochamp"],
a[href*="1xbet"],
a[href*="bet365"],
a[href*="stake.com"],
a[href*="adsboosters"],
a[href*="juicyads"],
a[href*="exoclick"],
a[href*="trafficjunky"],
a[href*="clickadu"],
a[href*="propellerads"],

/* ── Streaming site ad banner / sidebar patterns ── */
div[class*="sidebar-ad"],
div[class*="banner-ad"],
div[id*="sidebar-ad"],
div[id*="banner-ad"],
div[class*="widget_ad"],
div[class*="ad-widget"],
ins[data-ad-slot],
ins.adsbygoogle,

/* ── In-player notification / popup ad widgets ── */
/* These are small floating boxes that appear over the video ("Crypto Bot", etc.) */
div[class*="notification-widget"],
div[class*="notif-widget"],
div[class*="notif-popup"],
div[id*="notification-widget"],
div[id*="push-widget"],
div[class*="push-widget"],
div[class*="browser-notification"],
div[class*="web-notification"],
div[class*="notify-box"],
div[class*="notify-popup"],
div[class*="notification-bar"],
div[class*="notification-box"],
div[class*="notification-card"],
div[class*="notifyme"],
div[class*="onesignal"],

/* ── Promo / Sponsor banner images ── */
/* Image banners with ad links wrapping them */
a[href*="/redirect"] > img,
a[href*="tracker"] > img,
a[href*="click."] > img,
a[rel="sponsored"] > img,
a[target="_blank"][rel*="nofollow"] > img:only-child,
div[class*="sponsor"] img,
div[class*="promo-banner"],
div[id*="promo-banner"],
div[class*="ad-banner-img"],

/* ── Specific scam / crypto ad patterns ── */
div[class*="crypto"],
div[class*="trading-bot"],
a[href*="crypto"][style*="position"],
a[href*="trading"][style*="position"],

/* ── Close-button ad containers (X dismiss button = ad popup) ── */
/* Floating positioned boxes with small close buttons are almost always ad popups */
div[class*="close-btn"][style*="position: fixed"],
div[class*="dismiss"][style*="position: fixed"],
div[class*="close-btn"][style*="position: absolute"],

/* ── Interstitial / splash screen ads on streaming sites ── */
div[class*="splash-ad"],
div[class*="interstitial-ad"],
div[id*="splash-ad"],

/* ── In-content promotional banners (image ads between content sections) ── */
a[target="_blank"] > img[width],
a[target="_blank"] > img[style*="width"],
a[href*="/redirect"] > img,
a[href*="/go/"] > img,
a[href*="/out/"] > img,
a[href*="/click/"] > img,
a[href*="/aff/"] > img,
a[href*="/track/"] > img,
a[href*="/banner/"] > img,
a[href*="/promo/"] > img,
a[href*="/sponsor/"] > img,
a[href*="/visit/"] > img,
a[href*="/ref/"] > img,
div[class*="promo"] a > img,
div[class*="banner"] a > img,
div[class*="sponsor"] a > img,
div[class*="ad-spot"] a > img
{
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    z-index: -9999 !important;
}
`;

// ═══════════════════════════════════════════
//  Anti-Click-Hijack & Anti-Redirect Script v3
//  Strategy: First-click-absorb + aggressive DOM cleanup
//  Does NOT use stopPropagation (which breaks YouTube)
// ═══════════════════════════════════════════
export const ANTI_REDIRECT_SCRIPT = `
(function() {
    'use strict';
    if (window.__continuum_anti_redirect_v3) return;
    window.__continuum_anti_redirect_v3 = true;

    var ORIGIN = window.location.hostname;

    // === 1. BLOCK window.open() — ALL popups from streaming sites ===
    var realOpen = window.open;
    window.open = function(url, target, features) {
        // On streaming sites, window.open is ALWAYS used for ads
        console.log('[Continuum] Blocked window.open:', url);
        return null;
    };

    // === 2. BLOCK location.assign / location.replace to ad domains ===
    try {
        var realAssign = window.location.assign.bind(window.location);
        var realReplace = window.location.replace.bind(window.location);
        
        function isSameSite(url) {
            try {
                var h = new URL(url, window.location.href).hostname;
                return h === ORIGIN || h.endsWith('.' + ORIGIN) || ORIGIN.endsWith('.' + h);
            } catch(e) { return true; }
        }

        window.location.assign = function(url) {
            if (!isSameSite(url)) {
                console.log('[Continuum] Blocked location.assign redirect:', url);
                return;
            }
            return realAssign(url);
        };
        window.location.replace = function(url) {
            if (!isSameSite(url)) {
                console.log('[Continuum] Blocked location.replace redirect:', url);
                return;
            }
            return realReplace(url);
        };
    } catch(e) {}

    // === 3. INTERCEPT location.href SETTER ===
    // This is the #1 redirect method used by streaming sites
    // We intercept it by wrapping the location property descriptor
    try {
        // Create a proxy for the location href setter
        var origHrefDescriptor = Object.getOwnPropertyDescriptor(window.location.__proto__, 'href') ||
                                  Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
        if (origHrefDescriptor && origHrefDescriptor.set) {
            var origHrefSet = origHrefDescriptor.set;
            Object.defineProperty(window.location, 'href', {
                get: function() { return origHrefDescriptor.get.call(window.location); },
                set: function(val) {
                    try {
                        var newHost = new URL(val, window.location.href).hostname;
                        if (newHost !== ORIGIN && !newHost.endsWith('.' + ORIGIN) && !ORIGIN.endsWith('.' + newHost)) {
                            console.log('[Continuum] Blocked location.href redirect:', val);
                            return;
                        }
                    } catch(e) {}
                    origHrefSet.call(window.location, val);
                },
                configurable: true
            });
        }
    } catch(e) {
        // Fallback: Some browsers restrict modifying location descriptor
        // The will-navigate handler in Electron will catch these
    }

    // === 4. INTERCEPT programmatic <a>.click() redirects ===
    var realCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = realCreateElement(tag);
        if (tag.toLowerCase() === 'a') {
            var realClick = el.click.bind(el);
            el.click = function() {
                var href = el.href || '';
                try {
                    var h = new URL(href, window.location.href).hostname;
                    if (h !== ORIGIN && !h.endsWith('.' + ORIGIN) && !ORIGIN.endsWith('.' + h)) {
                        console.log('[Continuum] Blocked fake-anchor click:', href);
                        return;
                    }
                } catch(e) {}
                return realClick();
            };
        }
        return el;
    };

    // === 5. AGGRESSIVE DOM CLEANUP ===
    // Strategy: STRUCTURAL detection, not text-matching.
    // On streaming sites, the only real content is the video player + server list.
    // Anything that's a floating positioned element with close button, external images,
    // or external links is an ad — regardless of what text it contains.
    var SITE_ORIGIN = window.location.hostname;

    function isExternalUrl(href) {
        if (!href) return false;
        try {
            var h = new URL(href, window.location.href).hostname;
            return h !== SITE_ORIGIN && !h.endsWith('.' + SITE_ORIGIN) && !SITE_ORIGIN.endsWith('.' + h);
        } catch(e) { return false; }
    }

    // Elements that should NEVER be removed (video player, controls, server list)
    var SAFE_SELECTORS = 'video, [class*="player"], [id*="player"], .plyr, .jw-video, .vjs-tech, [class*="video-js"], [class*="server"], [class*="episode"], nav, header, footer';

    function isSafeElement(el) {
        if (!el) return false;
        if (el.matches && el.matches(SAFE_SELECTORS)) return true;
        if (el.querySelector && el.querySelector('video, iframe[src]')) return true;
        return false;
    }

    function cleanDOM() {
        // Remove invisible click-catchers
        document.querySelectorAll('body > a, body > div > a').forEach(function(a) {
            var s = window.getComputedStyle(a);
            var r = a.getBoundingClientRect();
            if (r.width > window.innerWidth * 0.4 && r.height > window.innerHeight * 0.3) {
                if (s.position === 'fixed' || s.position === 'absolute') {
                    if (parseFloat(s.opacity) < 0.15 || parseInt(s.zIndex) > 9000) {
                        a.remove();
                        return;
                    }
                }
            }
            if (parseInt(s.zIndex) > 99999) { a.remove(); }
        });

        // === STRUCTURAL AD DETECTION ===
        // Any positioned (fixed/absolute) element that has:
        //   - A close/dismiss button (X), OR
        //   - External links + small size (notification popup), OR
        //   - Is a small box overlapping the video area with an image
        // is an ad, regardless of text content.
        document.querySelectorAll('div, aside, section, span').forEach(function(el) {
            if (isSafeElement(el)) return;
            var s = window.getComputedStyle(el);
            var r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (s.position !== 'fixed' && s.position !== 'absolute') return;
            if (s.display === 'none' || s.visibility === 'hidden') return;
            // Skip if it's a parent of the video player
            if (el.querySelector('video')) return;
            // Skip full-page layout containers
            if (r.width > window.innerWidth * 0.85 && r.height > window.innerHeight * 0.85) return;

            var hasCloseBtn = !!(el.querySelector('[class*="close"], [class*="dismiss"], [class*="x-btn"], [class*="x-button"], [aria-label="close" i], [aria-label="dismiss" i]') ||
                               // Also detect small positioned child elements in the corner (custom X buttons)
                               el.querySelector('svg, span[style*="cursor: pointer"], div[style*="cursor: pointer"]'));

            var links = el.querySelectorAll('a[href]');
            var hasExternalLink = false;
            var hasImage = el.querySelector('img') !== null;
            links.forEach(function(link) {
                if (isExternalUrl(link.getAttribute('href'))) hasExternalLink = true;
            });

            // PATTERN 1: Small floating box with close button + image = notification ad popup
            // (This catches "Crypto Bot", "Top On Sale Product", etc.)
            if (hasCloseBtn && hasImage && r.width < 400 && r.height < 250) {
                el.remove();
                console.log('[Continuum] Removed notification ad (close+img)');
                return;
            }

            // PATTERN 2: Small floating box with close button + external links
            if (hasCloseBtn && hasExternalLink && r.width < 500) {
                el.remove();
                console.log('[Continuum] Removed ad popup (close+extlink)');
                return;
            }

            // PATTERN 3: Any positioned element with external links that overlaps the bottom-right
            // of the viewport (classic notification ad position)
            if (hasExternalLink && r.right > window.innerWidth * 0.5 && r.bottom > window.innerHeight * 0.5) {
                if (r.width < 400 && r.height < 200) {
                    el.remove();
                    console.log('[Continuum] Removed corner ad popup');
                    return;
                }
            }

            // PATTERN 4: High z-index positioned element with external link (always an ad overlay)
            if (hasExternalLink && parseInt(s.zIndex) > 9000) {
                el.remove();
                console.log('[Continuum] Removed high-z ad overlay');
                return;
            }
        });

        // === BANNER AD IMAGES ===
        // Detect promotional image banners using multiple signals:
        //   1. External URL wrapping a large image
        //   2. target="_blank" link wrapping a large image (always ad on streaming)
        //   3. Redirect-style same-domain URLs (/go/, /redirect/, /out/, etc.)
        //   4. Link that contains ONLY a large image and nothing else useful
        // eslint-disable-next-line no-useless-escape
        var REDIRECT_PATH = /\/(?:go|redirect|out|click|away|visit|track|aff|ref|jump|link|redir|banner|promo|ad|sponsor)[/\x3f]/i;

        document.querySelectorAll('a[href]').forEach(function(anchor) {
            var href = anchor.getAttribute('href') || '';
            if (isSafeElement(anchor)) return;
            if (isSafeElement(anchor.parentElement)) return;
            // Skip navigation links (menus, episode lists, etc.)
            if (anchor.closest('nav, header, footer, [class*="episode"], [class*="server"]')) return;

            var imgs = anchor.querySelectorAll('img');
            if (imgs.length === 0) return;

            var external = isExternalUrl(href);
            var hasTargetBlank = anchor.getAttribute('target') === '_blank';
            var hasRedirectPath = REDIRECT_PATH.test(href);
            // If link has ONLY images and whitespace text, it's a pure image ad link
            var textOnly = (anchor.textContent || '').replace(/\\s+/g, '').length;
            var imgTextLen = 0;
            imgs.forEach(function(im) { imgTextLen += (im.alt || '').length; });
            var isPureImageLink = (textOnly - imgTextLen) < 30; // minimal non-alt text

            var isAdLink = external || hasTargetBlank || hasRedirectPath;

            imgs.forEach(function(img) {
                var r = img.getBoundingClientRect();
                // Banner dimensions: at least 200px wide, 40px tall
                if (r.width > 200 && r.height > 40) {
                    if (isAdLink) {
                        anchor.remove();
                        console.log('[Continuum] Removed banner ad image link');
                    } else if (isPureImageLink && r.width > 300 && r.height > 80) {
                        // Large standalone image-only link in content = promotional banner
                        anchor.remove();
                        console.log('[Continuum] Removed standalone image banner');
                    }
                }
            });
        });

        // === STANDALONE PROMOTIONAL BANNERS ===
        // Detect wrapper containers with image + optional caption that are ads.
        // Pattern: <div> containing <a><img></a> + <p>text</p>
        // Signals: external URL, target=_blank, redirect-style URL, or image
        // is the dominant content of the container.
        document.querySelectorAll('div, figure, section, article').forEach(function(el) {
            if (isSafeElement(el)) return;
            // Skip navigation/layout containers
            if (el.closest('nav, header, footer, [class*="episode"], [class*="server"], [class*="player"]')) return;
            var children = el.children;
            if (children.length < 1 || children.length > 5) return;

            var anchorWithImg = el.querySelector('a[href] > img, a[href] img');
            if (!anchorWithImg) return;

            var anchor = anchorWithImg.closest('a');
            if (!anchor) return;
            var href = anchor.getAttribute('href') || '';
            var external = isExternalUrl(href);
            var hasTargetBlank = anchor.getAttribute('target') === '_blank';
            var hasRedirectPath = REDIRECT_PATH.test(href);

            var imgRect = anchorWithImg.getBoundingClientRect();
            var elRect = el.getBoundingClientRect();

            if (imgRect.width > 200 && imgRect.height > 50) {
                // Strong signals: external, target=_blank, or redirect URL
                if (external || hasTargetBlank || hasRedirectPath) {
                    el.remove();
                    console.log('[Continuum] Removed banner ad container');
                    return;
                }

                // Weaker signal: image dominates the container (>40% of container area)
                // and container is not the main content area
                var imgArea = imgRect.width * imgRect.height;
                var elArea = elRect.width * elRect.height;
                if (elArea > 0 && (imgArea / elArea) > 0.4 && elRect.width < window.innerWidth * 0.7) {
                    // Container where image is dominant + text caption = promotional banner
                    var textLen = (el.textContent || '').replace(/\\s+/g, '').length;
                    if (textLen < 100) {
                        el.remove();
                        console.log('[Continuum] Removed image-dominant banner container');
                        return;
                    }
                }
            }
        });

        // === ORPHAN IMAGE DETECTION ===
        // On streaming sites, real content images come in grids (episode thumbnails, series posters).
        // A large standalone image NOT part of a grid is a promotional ad banner.
        // This catches banners that don't use <a> tags, external URLs, or target=_blank.
        document.querySelectorAll('img').forEach(function(img) {
            if (!img.parentElement || !img.isConnected) return;
            var r = img.getBoundingClientRect();
            // Must be banner-sized: > 250px wide, > 80px tall
            if (r.width < 250 || r.height < 80) return;
            // Skip full-width background/hero images
            if (r.width > window.innerWidth * 0.85) return;
            // Skip images inside safe elements (player, navigation, etc.)
            if (img.closest(SAFE_SELECTORS)) return;
            if (img.closest('nav, header, footer, [class*="poster"], [class*="thumb"]')) return;
            // Skip the site logo
            if (img.closest('[class*="logo"], [id*="logo"]')) return;

            // Check if this image is part of a content grid.
            // Walk up to find a reasonable container (up to 4 levels).
            var gridContainer = img.parentElement;
            for (var up = 0; up < 4 && gridContainer && gridContainer !== document.body; up++) {
                gridContainer = gridContainer.parentElement;
            }
            if (!gridContainer || gridContainer === document.body) return;

            // Count sibling images of similar size in the grid container
            var allImgs = gridContainer.querySelectorAll('img');
            var similarCount = 0;
            allImgs.forEach(function(sib) {
                if (sib === img) return;
                var sr = sib.getBoundingClientRect();
                if (sr.width < 50 || sr.height < 50) return; // ignore tiny icons
                // Similar = within 2x size range
                if (sr.width > r.width * 0.4 && sr.width < r.width * 2.5 &&
                    sr.height > r.height * 0.4 && sr.height < r.height * 2.5) {
                    similarCount++;
                }
            });

            // If 3+ similar siblings, this is part of a content grid — keep it
            if (similarCount >= 3) return;

            // This is a standalone large image — likely a promotional banner.
            // Find the closest small wrapper to remove (image + caption together).
            var wrapper = img.parentElement;
            // Walk up to find the wrapper div that holds just this banner
            for (var w = 0; w < 3 && wrapper && wrapper !== document.body; w++) {
                var wr = wrapper.getBoundingClientRect();
                // Stop if wrapper is too large (layout container)
                if (wr.width > window.innerWidth * 0.8 || wr.height > window.innerHeight * 0.5) break;
                // Good wrapper: image dominates it
                var imgArea = r.width * r.height;
                var wrapperArea = wr.width * wr.height;
                if (wrapperArea > 0 && (imgArea / wrapperArea) > 0.25) {
                    var textLen = (wrapper.textContent || '').replace(/\\s+/g, '').length;
                    // Promotional banners have short captions (< 80 chars)
                    if (textLen < 80 && wrapper.children.length <= 6) {
                        if (!isSafeElement(wrapper)) {
                            wrapper.remove();
                            console.log('[Continuum] Removed orphan image banner + container');
                            return;
                        }
                    }
                }
                wrapper = wrapper.parentElement;
            }

            // If no suitable wrapper found, just hide the image
            if (img.isConnected) {
                img.style.display = 'none';
                console.log('[Continuum] Hid orphan promotional image');
            }
        });

        // === TELEGRAM / NOTIFICATION BARS ===
        // Floating bars asking users to join Telegram, Discord, etc.
        document.querySelectorAll('a[href*="t.me"], a[href*="telegram"], a[href*="discord.gg"], [class*="telegram"], [id*="telegram"]').forEach(function(el) {
            // Find the bar/wrapper containing this
            var bar = el.closest('div, section, aside');
            if (bar && bar !== document.body) {
                var br = bar.getBoundingClientRect();
                // Notification bars are typically thin and wide
                if (br.height < 200 && br.width > window.innerWidth * 0.3) {
                    if (!isSafeElement(bar)) {
                        bar.remove();
                        console.log('[Continuum] Removed Telegram/notification bar');
                    }
                }
            }
        });

        // Remove ad iframes
        document.querySelectorAll('iframe').forEach(function(iframe) {
            var src = (iframe.src || iframe.getAttribute('data-src') || '').toLowerCase();
            if (/doubleclick|googlesyndication|adserver|adservice|popunder|popads|adsterra|clickadu|propeller|exoclick|juicyads|trafficjunky|adsboosters|syndication[.]realsrv|tsyndicate|oclasrv|onclkds|clksite|admaven|ad-maven|betting|casino|1xbet|bet365|mylottochamp/.test(src)) {
                iframe.remove();
                return;
            }
            var r = iframe.getBoundingClientRect();
            if (r.width <= 1 && r.height <= 1 && src) { iframe.remove(); }
        });

        // Remove ad scripts
        document.querySelectorAll('script[src]').forEach(function(s) {
            var src = (s.getAttribute('src') || '').toLowerCase();
            if (/popunder|popads|adsterra|clickadu|propeller|exoclick|adsboosters|syndication[.]realsrv|tsyndicate|oclasrv|admaven|ad-maven|juicyads|trafficjunky/.test(src)) {
                s.remove();
            }
        });

        // Remove known ad link elements
        document.querySelectorAll('a[href*="adsboosters"], a[href*="1xbet"], a[href*="bet365"], a[href*="mylottochamp"], a[href*="clickadu"], a[href*="juicyads"], a[href*="exoclick"], a[href*="trafficjunky"], a[href*="propellerads"]').forEach(function(el) {
            el.remove();
        });
    }

    // === 6. MUTATION OBSERVER ===
    var observer = new MutationObserver(function(mutations) {
        var needsClean = false;
        for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var node = added[j];
                if (node.nodeType !== 1) continue;

                // Immediately remove ad scripts before they execute
                if (node.tagName === 'SCRIPT') {
                    var src = (node.getAttribute('src') || '').toLowerCase();
                    if (/popunder|popads|adsterra|clickadu|propeller|exoclick|adsboosters|syndication[.]realsrv|tsyndicate|oclasrv|admaven|ad-maven/.test(src)) {
                        node.remove();
                        continue;
                    }
                    var text = (node.textContent || '').toLowerCase();
                    // eslint-disable-next-line no-useless-escape
                    if (text.length < 2000 && (/popunder|window[.]open\s*[(]|location[.]href\s*=.*http/.test(text))) {
                        if (!/video|player|stream/i.test(text)) {
                            node.remove();
                            continue;
                        }
                    }
                }

                // Immediately remove ad iframes
                if (node.tagName === 'IFRAME') {
                    var iframeSrc = (node.getAttribute('src') || '').toLowerCase();
                    if (/doubleclick|googlesyndication|adserver|popunder|adsterra|clickadu|adsboosters|syndication[.]realsrv|oclasrv/.test(iframeSrc)) {
                        node.remove();
                        continue;
                    }
                }

                // Schedule a full cleanup pass for any new element
                needsClean = true;
            }
        }
        if (needsClean) {
            setTimeout(cleanDOM, 50);
        }
    });

    // === 7. SPOOF AD ELEMENTS (defeat anti-adblock detection) ===
    function spoofAdElements() {
        var fakeAd = document.createElement('div');
        fakeAd.className = 'ad ads adsbox ad-placement';
        fakeAd.id = 'ad-container';
        fakeAd.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
        fakeAd.innerHTML = '&nbsp;';
        (document.body || document.documentElement).appendChild(fakeAd);
        var fakeIns = document.createElement('ins');
        fakeIns.className = 'adsbygoogle';
        fakeIns.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;display:block;';
        (document.body || document.documentElement).appendChild(fakeIns);
    }

    // === 8. BLOCK meta http-equiv="refresh" REDIRECTS ===
    function removeMetaRefresh() {
        document.querySelectorAll('meta[http-equiv="refresh"]').forEach(function(m) {
            var content = m.getAttribute('content') || '';
            if (/url=/i.test(content)) {
                m.remove();
                console.log('[Continuum] Removed meta refresh redirect');
            }
        });
    }

    // === INIT ===
    function init() {
        cleanDOM();
        removeMetaRefresh();
        spoofAdElements();
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }

    if (document.body) { init(); }
    else { document.addEventListener('DOMContentLoaded', init); }

    // Periodic cleanup (sites re-inject ad elements constantly)
    setInterval(cleanDOM, 1500);

    console.log('[Continuum] Anti-redirect v3 (whitelist-based) active');
})();
`;
