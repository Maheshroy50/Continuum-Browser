import { BrowserWindow, ipcMain, Rectangle } from 'electron';
import path from 'path';

export class PopupManager {
    private mainWindow: BrowserWindow;
    public popupWindow: BrowserWindow | null = null;
    private currentType: string | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        this.setupIPC();
    }

    private setupIPC() {
        // Guard against double-registration (e.g. window re-creation on macOS activate)
        try { ipcMain.removeHandler('popup:open'); } catch { /* not registered yet */ }
        try { ipcMain.removeHandler('popup:close'); } catch { /* not registered yet */ }

        ipcMain.handle('popup:open', async (_event, { type, url, blockedCount, x, y, width, height }) => {
            try {
                this.openPopup(type, { x, y, width, height } as Rectangle, { url, blockedCount });
            } catch (err) {
                console.error('[PopupManager] Failed to open popup:', err);
            }
        });

        ipcMain.handle('popup:close', () => {
            this.closePopup();
        });
    }

    public openPopup(type: string, bounds: Rectangle, params: any) {
        // If same type is requested and open, do nothing (or bring to front)
        if (this.popupWindow && this.currentType === type && !this.popupWindow.isDestroyed()) {
            this.popupWindow.focus();
            return;
        }

        this.closePopup(); // Close existing if any

        this.currentType = type;

        // Sanitize params: convert undefined/null to empty string for URLSearchParams
        const sanitized: Record<string, string> = { type };
        if (params) {
            for (const [key, val] of Object.entries(params)) {
                sanitized[key] = val != null ? String(val) : '';
            }
        }

        // Construct URL
        const query = new URLSearchParams(sanitized).toString();

        // Hash routing for PopupRoot
        const route = `#/popup/${type}?${query}`;

        // Ensure bounds are integers
        const winX = Math.round(bounds.x);
        const winY = Math.round(bounds.y);
        const winW = Math.round(bounds.width);
        const winH = Math.round(bounds.height);

        this.popupWindow = new BrowserWindow({
            parent: this.mainWindow,
            modal: false,
            frame: false, // Frameless
            transparent: true, // Transparent background
            resizable: false,
            hasShadow: true,
            width: winW,
            height: winH,
            x: winX,
            y: winY,
            show: false,
            backgroundColor: '#00000000', // Hex transparent
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false, // Matches main window config
                preload: path.join(__dirname, 'preload.js'),
            }
        });

        // Load URL
        if (process.env.VITE_DEV_SERVER_URL) {
            this.popupWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}${route}`);
        } else {
            this.popupWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: route });
        }

        this.popupWindow.once('ready-to-show', () => {
            if (this.popupWindow && !this.popupWindow.isDestroyed()) {
                this.popupWindow.show();
                this.popupWindow.focus();
            }
        });

        // Close on blur (click outside)
        this.popupWindow.on('blur', () => {
            this.closePopup();
        });

        this.popupWindow.on('closed', () => {
            this.popupWindow = null;
            this.currentType = null;
            // Notify Renderer to update UI state (buttons)
            if (!this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('popup:closed', type);
            }
        });
    }

    public closePopup() {
        if (this.popupWindow && !this.popupWindow.isDestroyed()) {
            this.popupWindow.close();
        }
        this.popupWindow = null;
        this.currentType = null;
    }
}
