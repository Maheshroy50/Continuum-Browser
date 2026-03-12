import { BrowserWindow, ipcMain, DownloadItem, Notification, app, Session, shell } from 'electron';
import type { ContinuumShield } from './ContinuumShield';
import path from 'node:path';

export interface DownloadState {
    id: string;
    filename: string;
    path: string;
    totalBytes: number;
    receivedBytes: number;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused' | 'quarantined';
    startTime: number;
    // Shield integration
    riskLevel?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    risks?: string[];
    quarantinedPath?: string; // Path in quarantine folder if quarantined
    sourceUrl?: string;
}

export class DownloadManager {
    private mainWindow: BrowserWindow;
    // activeDownloads map: id -> DownloadItem
    private activeDownloads: Map<string, DownloadItem> = new Map();
    // downloadStates map: id -> DownloadState (to send to renderer)
    private downloadStates: Map<string, DownloadState> = new Map();
    // Track sessions to avoid duplicate listeners
    private trackedSessions = new WeakSet<Session>();
    // ContinuumShield integration for quarantine & scanning
    private shield: ContinuumShield | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.setupSessionListeners();
        this.setupIPC();
    }

    /**
     * Connect to ContinuumShield for download quarantine & risk analysis.
     * Called after both DownloadManager and ContinuumShield are initialized.
     */
    public setShield(shield: ContinuumShield) {
        this.shield = shield;
        console.log('[DownloadManager] Shield integration enabled');
    }

    destroy() {
        this.activeDownloads.clear();
        this.downloadStates.clear();
        ipcMain.removeHandler('downloads:pause');
        ipcMain.removeHandler('downloads:resume');
        ipcMain.removeHandler('downloads:cancel');
        ipcMain.removeHandler('downloads:show-in-folder');
        ipcMain.removeHandler('downloads:get-all');
    }

    private setupSessionListeners() {
        // Track default session
        this.trackSession(this.mainWindow.webContents.session);

        // Track any new sessions (e.g. per-workspace partitions)
        app.on('session-created', (session) => {
            this.trackSession(session);
        });
    }

    private trackSession(session: Session) {
        if (this.trackedSessions.has(session)) return;
        this.trackedSessions.add(session);

        session.on('will-download', (_event, item, _webContents) => {
            // Minimal: Only track this download
            const id = crypto.randomUUID();
            const filename = item.getFilename();
            const savePath = item.getSavePath(); // Might be empty if prompt logic, but usually electron handles prompt
            const sourceUrl = item.getURL();

            this.activeDownloads.set(id, item);

            // === ContinuumShield: Analyze download risk ===
            let riskLevel: DownloadState['riskLevel'] = 'safe';
            let risks: string[] = [];
            let shouldQuarantine = false;

            if (this.shield) {
                const analysis = this.shield.analyzeDownload(
                    filename,
                    sourceUrl,
                    item.getTotalBytes()
                );
                riskLevel = analysis.riskLevel;
                risks = analysis.risks;
                shouldQuarantine = analysis.shouldQuarantine;
            }

            // If high/critical risk, redirect to quarantine folder
            let quarantinedPath: string | undefined;
            if (shouldQuarantine && this.shield) {
                const quarantineDir = this.shield.getQuarantinePath();
                const safeName = `${id}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                quarantinedPath = path.join(quarantineDir, safeName);
                item.setSavePath(quarantinedPath);
                console.log(`[DownloadManager] ⚠️ Quarantining: ${filename} → ${quarantinedPath}`);
            }

            const initialState: DownloadState = {
                id,
                filename,
                path: quarantinedPath || savePath,
                totalBytes: item.getTotalBytes(),
                receivedBytes: item.getReceivedBytes(),
                state: 'progressing',
                startTime: Date.now(),
                riskLevel,
                risks,
                quarantinedPath,
                sourceUrl,
            };

            this.downloadStates.set(id, initialState);
            this.sendUpdate('download:start', initialState);

            // If high risk, also send a warning notification to the UI
            if (riskLevel === 'high' || riskLevel === 'critical') {
                this.sendUpdate('download:risk-warning', {
                    id,
                    filename,
                    riskLevel,
                    risks,
                    quarantined: !!quarantinedPath,
                });
            }

            item.on('updated', (_event, state) => {
                const current = this.downloadStates.get(id);
                if (!current) return;

                if (state === 'interrupted') {
                    current.state = 'interrupted';
                } else if (state === 'progressing') {
                    if (item.isPaused()) {
                        current.state = 'paused';
                    } else {
                        current.state = 'progressing';
                    }
                }

                current.receivedBytes = item.getReceivedBytes();
                current.path = item.getSavePath(); // Update path in case it changed

                this.sendUpdate('download:progress', current);
            });

            item.once('done', (_event, state) => {
                const current = this.downloadStates.get(id);
                if (!current) return;

                if (state === 'completed') {
                    // If it was quarantined, mark as quarantined instead of completed
                    if (current.quarantinedPath) {
                        current.state = 'quarantined';
                        this.sendNotification(`⚠️ ${current.filename} quarantined — suspicious file detected`);
                    } else {
                        current.state = 'completed';
                        this.sendNotification(current.filename);
                    }
                } else if (state === 'cancelled') {
                    current.state = 'cancelled';
                } else {
                    current.state = 'interrupted';
                }

                this.sendUpdate('download:complete', current);

                // Cleanup active reference, but keep state for UI history
                this.activeDownloads.delete(id);
            });
        });
    }

    private setupIPC() {
        ipcMain.handle('downloads:pause', (_, id: string) => {
            const item = this.activeDownloads.get(id);
            if (item && !item.isPaused()) item.pause();
        });

        ipcMain.handle('downloads:resume', (_, id: string) => {
            const item = this.activeDownloads.get(id);
            if (item && item.canResume()) item.resume();
        });

        ipcMain.handle('downloads:cancel', (_, id: string) => {
            const item = this.activeDownloads.get(id);
            if (item) item.cancel();
        });

        ipcMain.handle('downloads:show-in-folder', (_, id: string) => {
            const state = this.downloadStates.get(id);
            if (state && state.path) {
                // showItemInFolder
                shell.showItemInFolder(state.path);
            }
        });

        ipcMain.handle('downloads:get-all', () => {
            return Array.from(this.downloadStates.values()).sort((a, b) => b.startTime - a.startTime);
        });
    }

    private sendUpdate(channel: string, payload: any) {
        if (!this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, payload);
        }
    }

    private sendNotification(filename: string) {
        if (Notification.isSupported()) {
            new Notification({
                title: 'Download Finished',
                body: filename,
                silent: false // user said "helping you, not interrupting", but completion usually warrants a sound or banner
            }).show();
        }
    }
}
