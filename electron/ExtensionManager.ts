import { session, ipcMain, app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'extensions');
const MANIFEST_FILE = path.join(app.getPath('userData'), 'extensions.json');
const CRASH_MARKER_FILE = path.join(app.getPath('userData'), 'extension_load_pending');

interface InstalledExtension {
    id: string;
    name: string;
    version: string;
    path: string;
}

export class ExtensionManager {
    constructor() {
        this.init();
    }

    private init() {
        if (!fs.existsSync(EXTENSIONS_DIR)) {
            fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
        }

        // --- CRASHGUARD CHECK ---
        if (fs.existsSync(CRASH_MARKER_FILE)) {
            console.error('[ExtensionManager] CrashGuard: Detected incomplete startup. Purging extensions to recover.');
            try {
                // Nuclear Option: Delete everything to ensure app opens
                fs.rmSync(EXTENSIONS_DIR, { recursive: true, force: true });
                fs.rmSync(MANIFEST_FILE, { force: true });
                fs.unlinkSync(CRASH_MARKER_FILE);

                // Re-create dir
                fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
            } catch (e) {
                console.error('[ExtensionManager] CrashGuard failed to clean up:', e);
            }
            return; // Skip loading this time to be safe
        }

        this.registerIpc();
        // TEMPORARILY DISABLED: Testing if extension loading causes crash
        // this.loadPersistedExtensions();
    }



    private registerIpc() {
        console.log('[ExtensionManager] Registering IPC handlers');
        ipcMain.handle('get-extensions', () => {
            const exts = session.defaultSession.getAllExtensions();
            return exts.map(ext => ({
                id: ext.id,
                name: ext.name,
                // description: ext.description,
                version: ext.version,
                path: ext.path
            }));
        });

        ipcMain.handle('extension-get-info', (_, id: string) => {
            const info = this.getExtensionDetails(id);
            if (!info) return { success: false, error: 'Extension not found' };
            return { success: true, ...info };
        });

        ipcMain.handle('extension-open-options', (_, id: string) => {
            const info = this.getExtensionDetails(id);
            if (!info) return { success: false, error: 'Extension not found' };
            if (!info.optionsPage) return { success: false, error: 'No options page for this extension' };

            const win = new BrowserWindow({
                width: 900,
                height: 700,
                autoHideMenuBar: true,
                titleBarStyle: 'hiddenInset',
                webPreferences: {
                    session: session.defaultSession,
                    preload: path.join(__dirname, 'preload.js'),
                },
            });
            win.loadURL(info.optionsPage);
            return { success: true };
        });

        ipcMain.handle('extension-open-popup', (_, id: string) => {
            const info = this.getExtensionDetails(id);
            if (!info) return { success: false, error: 'Extension not found' };
            if (!info.popupPage) return { success: false, error: 'No popup for this extension' };

            const win = new BrowserWindow({
                width: 420,
                height: 640,
                autoHideMenuBar: true,
                titleBarStyle: 'hiddenInset',
                webPreferences: {
                    session: session.defaultSession,
                    preload: path.join(__dirname, 'preload.js'),
                },
            });
            win.loadURL(info.popupPage);
            return { success: true };
        });



        ipcMain.handle('install-extension-from-url', async (_, { url }) => {
            try {
                // 1. Parse ID
                const idMatch = url.match(/([a-z]{32})/);
                if (!idMatch) throw new Error('Invalid Web Store URL');
                const id = idMatch[1];

                // 2. Download & Install
                await this.downloadAndInstall(id);
                return { success: true, id };
            } catch (error: any) {
                console.error('[ExtensionManager] Install failed:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('remove-extension', (_, id) => {
            try {
                session.defaultSession.removeExtension(id);
                this.removePersisted(id);

                // Optionally delete the folder
                const extPath = path.join(EXTENSIONS_DIR, id);
                if (fs.existsSync(extPath)) {
                    fs.rmSync(extPath, { recursive: true, force: true });
                }

                return { success: true };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        // For developer mode: Loading local unpacked extension
        ipcMain.handle('load-unpacked-extension', async (_, dirPath) => {
            try {
                const ext = await session.defaultSession.loadExtension(dirPath);
                this.persistExtension(ext.id, dirPath, ext.name, ext.version);
                return { success: true, id: ext.id, name: ext.name };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });
    }

    private async downloadAndInstall(id: string) {
        console.log(`[ExtensionManager] Downloading ${id}...`);

        // Updated prodversion to 131.0.0.0 for better compatibility
        const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`;

        const tempCrxPath = path.join(EXTENSIONS_DIR, `${id}.crx`);
        const installDir = path.join(EXTENSIONS_DIR, id);

        // 1. Download
        await this.downloadFile(crxUrl, tempCrxPath);

        // 2. Setup Install Dir
        if (fs.existsSync(installDir)) {
            fs.rmSync(installDir, { recursive: true, force: true });
        }
        fs.mkdirSync(installDir, { recursive: true });

        // 3. Unzip (Handling CRX Header)
        this.extractCrx(tempCrxPath, installDir);

        // 4. Cleanup CRX
        fs.unlinkSync(tempCrxPath);

        // 5. Load into Electron
        console.log(`[ExtensionManager] Loading unpacked extension from ${installDir}...`);
        const ext = await session.defaultSession.loadExtension(installDir);

        // 6. Persist
        console.log(`[ExtensionManager] Extension loaded: ${ext.name}`);
        this.persistExtension(ext.id, installDir, ext.name, ext.version);
    }

    private async downloadFile(url: string, dest: string): Promise<void> {
        // Use Node.js native fetch for better reliability than electron.net
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(arrayBuffer));
    }

    private extractCrx(crxPath: string, destDir: string) {
        const buffer = fs.readFileSync(crxPath);
        let startOffset = 0;

        // CRX files have a header, usually starting with "Cr24". 
        // We need to find the start of the Zip archive (PK\x03\x04)
        if (buffer.toString('utf8', 0, 4) === 'Cr24') {
            // Find PK header
            // Common PK header is 50 4B 03 04
            const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
            startOffset = buffer.indexOf(zipHeader);

            if (startOffset === -1) {
                // Fallback: Sometimes headers are small, maybe simple zip works?
                console.warn('[ExtensionManager] Could not find ZIP header in CRX, trying direct unzip...');
                startOffset = 0;
            } else {
                console.log(`[ExtensionManager] Found ZIP header at offset ${startOffset}`);
            }
        }

        // Create a buffer for the zip content
        const zipBuffer = startOffset > 0 ? buffer.subarray(startOffset) : buffer;

        // Extract
        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(destDir, true);
    }

    // --- Persistence ---

    public async loadPersistedExtensions() {
        if (!fs.existsSync(MANIFEST_FILE)) return;

        try {
            // Set CrashGuard Marker
            fs.writeFileSync(CRASH_MARKER_FILE, 'pending');

            const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
            const installed: InstalledExtension[] = data.installed || [];

            // Use sequential loop to ensure stability and isolate crashes
            for (const ext of installed) {
                const extPath = ext.path;

                // 1. Basic Existence Check
                if (!fs.existsSync(extPath)) {
                    console.warn(`[ExtensionManager] path not found: ${extPath}`);
                    this.removePersisted(ext.id);
                    continue;
                }

                // 2. Deep Integrity Check (Manifest + Resources)
                if (!this.validateExtensionIntegrity(extPath)) {
                    console.error(`[ExtensionManager] Integrity check failed for ${ext.name}. Removing...`);

                    // Self-healing: Remove from persistence so we don't crash next time
                    this.removePersisted(ext.id);

                    // Optional: Try to delete the bad folder to clean up.
                    // This is the "Nuclear Option" executing automatically.
                    try { fs.rmSync(extPath, { recursive: true, force: true }); } catch (e) { }

                    continue;
                }

                // 3. Load
                try {
                    console.log(`[ExtensionManager] Loading persisted: ${ext.name}`);
                    await session.defaultSession.loadExtension(extPath);
                } catch (e) {
                    console.error(`[ExtensionManager] Failed to load ${ext.name}:`, e);
                }
            }

            // Clear CrashGuard Marker (Success)
            if (fs.existsSync(CRASH_MARKER_FILE)) fs.unlinkSync(CRASH_MARKER_FILE);

        } catch (e) {
            console.error('[ExtensionManager] Failed to read manifest:', e);
        }
    }

    private validateExtensionIntegrity(extPath: string): boolean {
        const manifestPath = path.join(extPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) return false;

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

            // Validate Background Scripts/Workers (Critical for native stability)
            if (manifest.background) {
                const bg = manifest.background;
                if (bg.service_worker) {
                    if (!fs.existsSync(path.join(extPath, bg.service_worker))) return false;
                }
                if (bg.scripts && Array.isArray(bg.scripts)) {
                    for (const script of bg.scripts) {
                        if (!fs.existsSync(path.join(extPath, script))) return false;
                    }
                }
                if (bg.page) {
                    if (!fs.existsSync(path.join(extPath, bg.page))) return false;
                }
            }

            // Validate Default Popup (UI stability)
            if (manifest.action && manifest.action.default_popup) {
                if (!fs.existsSync(path.join(extPath, manifest.action.default_popup))) return false;
            }
            if (manifest.browser_action && manifest.browser_action.default_popup) {
                if (!fs.existsSync(path.join(extPath, manifest.browser_action.default_popup))) return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    private persistExtension(id: string, extPath: string, name: string, version: string) {
        let installed: InstalledExtension[] = [];
        if (fs.existsSync(MANIFEST_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
                installed = data.installed || [];
            } catch (e) { }
        }

        // Remove existing if any
        installed = installed.filter(e => e.id !== id);

        // Add new
        installed.push({ id, path: extPath, name, version });

        fs.writeFileSync(MANIFEST_FILE, JSON.stringify({ installed }, null, 2));
    }

    private removePersisted(id: string) {
        if (!fs.existsSync(MANIFEST_FILE)) return;
        try {
            const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
            const installed = (data.installed || []).filter((e: any) => e.id !== id);
            fs.writeFileSync(MANIFEST_FILE, JSON.stringify({ installed }, null, 2));
        } catch (e) { }
    }
    private getExtensionDetails(id: string) {
        const ext = session.defaultSession.getExtension(id);
        if (!ext) return null;

        const manifest: any = ext.manifest || {};
        const optionsPage = manifest.options_page || manifest.options_ui?.page || null;
        const popupPage = manifest.browser_action?.default_popup || manifest.action?.default_popup || manifest.page_action?.default_popup || null;

        return {
            id: ext.id,
            name: ext.name,
            version: ext.version,
            manifestVersion: manifest.manifest_version,
            optionsPage: optionsPage ? `chrome-extension://${ext.id}/${optionsPage}` : null,
            popupPage: popupPage ? `chrome-extension://${ext.id}/${popupPage}` : null,
        };
    }
}
