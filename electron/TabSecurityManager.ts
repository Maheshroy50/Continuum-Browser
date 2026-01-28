import { webContents } from 'electron';
import { PrivacyManager } from './PrivacyManager';

const REVOCATION_TIMEOUT_MS = 30000; // 30 seconds

export class TabSecurityManager {
    private privacyManager: PrivacyManager;
    private revocationTimers: Map<number, NodeJS.Timeout> = new Map();
    private mainWindowWebContents: Electron.WebContents;

    constructor(privacyManager: PrivacyManager, mainWindowWebContents: Electron.WebContents) {
        this.privacyManager = privacyManager;
        this.mainWindowWebContents = mainWindowWebContents;
    }

    handleTabVisibilityChange(contentsId: number, isVisible: boolean) {
        // If tab becomes visible, clear any pending revocation
        if (isVisible) {
            if (this.revocationTimers.has(contentsId)) {
                // console.log(`[TabSecurity] Tab ${contentsId} active, clearing revocation timer`);
                clearTimeout(this.revocationTimers.get(contentsId));
                this.revocationTimers.delete(contentsId);
            }
            return;
        }

        // If tab becomes hidden, start the countdown
        // Only start if not already scheduled
        if (!this.revocationTimers.has(contentsId)) {
            // console.log(`[TabSecurity] Tab ${contentsId} backgrounded, starting ${REVOCATION_TIMEOUT_MS}ms timer`);
            const timer = setTimeout(() => {
                this.revokeSensitivePermissions(contentsId);
            }, REVOCATION_TIMEOUT_MS);

            this.revocationTimers.set(contentsId, timer);
        }
    }

    stopMonitoring(contentsId: number) {
        if (this.revocationTimers.has(contentsId)) {
            clearTimeout(this.revocationTimers.get(contentsId));
            this.revocationTimers.delete(contentsId);
        }
    }

    private revokeSensitivePermissions(contentsId: number) {
        this.revocationTimers.delete(contentsId);

        try {
            const wc = webContents.fromId(contentsId);
            if (!wc) return;

            const url = wc.getURL();
            const origin = new URL(url).origin;

            console.log(`[TabSecurity] Revoking permissions for background tab ${contentsId} (${origin})`);

            // 1. Send IPC to Renderer to kill streams (stops hardware light)
            wc.send('privacy:revoke-media');

            // 2. Update PrivacyManager to set permissions to 'deny' (Explicit Intent recovery)
            // We set them to 'deny' so the user has to manually re-enable them via the address bar
            this.privacyManager.setPermission(origin, 'media', 'deny');
            this.privacyManager.setPermission(origin, 'camera', 'deny');
            this.privacyManager.setPermission(origin, 'microphone', 'deny');

            // 3. Trigger UI Toast notification in the Main Window
            this.mainWindowWebContents.send('toast:show', {
                message: `Microphone & Camera disabled for ${new URL(origin).hostname} (Background > 30s)`,
                type: 'info',
                duration: 5000,
                icon: 'shield-lock'
            });

        } catch (e) {
            console.error('[TabSecurity] Failed to revoke permissions:', e);
        }
    }
}
