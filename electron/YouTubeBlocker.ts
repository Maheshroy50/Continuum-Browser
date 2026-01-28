export const YOUTUBE_BLOCKER_SCRIPT = `
(function() {
    // console.log('[Flow] YouTube Ad Blocker Active');

    function skipAd() {
        const video = document.querySelector('video');
        if (!video) return;

        // Check if ad is showing via class names on player or ad container existence
        const adShowing = document.querySelector('.ad-showing') || document.querySelector('.video-ads.ytp-ad-module');
        
        // Specific checks for ad elements
        const skipButton = document.querySelector('.ytp-ad-skip-button') || document.querySelector('.ytp-ad-skip-button-modern');
        const overlayAd = document.querySelector('.ytp-ad-overlay-container');
        
        if (overlayAd) {
             overlayAd.style.display = 'none';
        }

        // If 'ad-showing' class is present on the movie player, it's definitely an ad
        const player = document.querySelector('#movie_player');
        const isAd = player && player.classList.contains('ad-showing');

        if (isAd || skipButton) {
            // Speed up and mute to "skip"
            if (video && !isNaN(video.duration) && video.duration > 0) {
                 video.playbackRate = 16;
                 video.muted = true;
                 // Seek to end
                 if(isFinite(video.duration)) {
                    video.currentTime = video.duration;
                 }
            }

            // Click skip button if available
            if (skipButton) {
                skipButton.click();
                // console.log('[Flow] Skipped Ad');
            }
        }
    }

    // Run frequently (every 100ms) to catch ads immediately
    setInterval(skipAd, 100);
    
    // Also remove static banner ads
    const css = \`
        ytd-banner-promo-renderer,
        ytd-display-ad-renderer,
        ytd-action-companion-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        .ytd-action-companion-ad-renderer,
        #player-ads,
        #masthead-ad,
        ytd-ad-slot-renderer {
            display: none !important;
        }
    \`;
    const style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
})();
`;
