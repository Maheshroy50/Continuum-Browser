export const AD_BLOCKING_CSS = `
/* Generic Ad Hiding Rules */
[id^="google_ads_"],
[id^="ad-"],
[class^="ad-"],
[class*=" ad "],
[class*=" ads "],
[class$="Ad"],
[class$="Ads"],
div[id*="ScriptRoot"],
div[id*="pop-"],
div[class*="pop-"],
a[href*="doubleclick.net"],
iframe[src*="doubleclick.net"],
iframe[src*="googleads"],
iframe[src*="adserver"],
.adsbygoogle, 
.ad-banner, 
.box_ad, 
#ad-container,
#banner-ad,

/* Specific to canyoublockit.com and common "extreme" tests */
#interstitial_ad,
.interstitial,
.push-notification-request,
.in-page-push,
.native-ad,
[data-ad-slot],
[data-ad-client],

/* Sticky Footers / Popups */
.sticky-ad,
.floating-ad,
.bottom-ad-bar
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
