
import { ipcRenderer } from 'electron';

// --- LEVEL 3: JS-BASED FINGERPRINT SPOOFING (Chrome 122) ---
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


// --------------------------------------


let lastSwipeTime = 0;
const SWIPE_COOLDOWN = 1000; // 1s cooldown


let lastEdgeEvent = 0;
const EDGE_THROTTLE = 100;

// Horizontal Swipe Navigation Logic
window.addEventListener('wheel', (e) => {
    const now = Date.now();
    if (now - lastSwipeTime < SWIPE_COOLDOWN) return;

    // Only trigger if horizontal scroll is dominant + threshold
    // Threshold 350 prevents accidental swipes during normal scroll (Very heavy feel)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 350) {

        const maxScroll = document.body.scrollWidth - window.innerWidth;

        if (e.deltaX < 0 && window.scrollX <= 0) {
            // Swipe Right (Go Back)
            ipcRenderer.invoke('view:back');
            lastSwipeTime = now;
        } else if (e.deltaX > 0 && window.scrollX >= maxScroll - 1) {
            // Swipe Left (Go Forward)
            ipcRenderer.invoke('view:forward');
            lastSwipeTime = now;
        }
    }
}, { passive: true });

// Global Shortcut Bridge
window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        ipcRenderer.send('view:toggle-switcher');
        // Prevent default browser search or other actions
        e.preventDefault();
        e.stopPropagation();
    }
});

// Zen Mode Edge Detection
window.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastEdgeEvent < EDGE_THROTTLE) return;

    // 15px from left edge
    if (e.clientX < 15) {
        ipcRenderer.send('view:edge-hover', 'left');
        lastEdgeEvent = now;
    }
}, { passive: true });

// --- SMART PERMISSION GATING (Phase 1B) ---
// Listen for immediate revocation signal from Main Process
ipcRenderer.on('privacy:revoke-media', () => {
    console.warn('[Privacy] Revoking sensitive permissions due to background inactivity.');

    // 1. Stop all active media tracks (Camera/Microphone)
    navigator.mediaDevices.enumerateDevices().then(() => {
        // We can't query active streams directly from navigator, 
        // but we can hijack existing ones if we were tracking them, 
        // OR rely on the fact that native revoke turns them off.
        // HOWEVER, to ensure the HARDWARE LIGHT turns off immediately, checking typical locations:

        // This stops tracks attached to video/audio elements in the DOM
        document.querySelectorAll('video, audio').forEach((el: any) => {
            if (el.srcObject) {
                const stream = el.srcObject as MediaStream;
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('[Privacy] Stopped track:', track.kind, track.label);
                });
                el.srcObject = null;
            }
        });

        // Note: We cannot easily access "floating" streams not attached to DOM 
        // (unless we proxied getUserMedia, which effectively we didn't fully do yet).
        // But Browser-level permission revocation (Main Process) usually handles the "Active" state.
        // This is a safety measure for visible elements.
    });
});
