import { defineConfig, Plugin } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

const nodeRequire = createRequire(import.meta.url)

function resolveOptionalModuleAsset(modulePath: string): string | null {
    try {
        return nodeRequire.resolve(modulePath)
    } catch {
        return null
    }
}

const extensionPreloadPath = resolveOptionalModuleAsset(
    'electron-chrome-extensions/dist/chrome-extension-api.preload.js',
)
const hasElectronChromeExtensions = extensionPreloadPath !== null

// Custom plugin to remove crossorigin attribute for Electron file:// protocol
function removeCrossOrigin(): Plugin {
    return {
        name: 'remove-crossorigin',
        transformIndexHtml(html) {
            // Remove crossorigin attribute which breaks Electron file:// loading
            return html.replace(/ crossorigin/g, '')
        }
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    // CRITICAL: Use relative paths for Electron file:// protocol
    base: './',
    optimizeDeps: {
        // Force a clean prebundle on each dev boot so Electron does not hold stale
        // internal optimizer chunk URLs across reloads.
        force: true,
    },
    build: {
        // Disable crossorigin attribute which breaks file:// loading
        modulePreload: { polyfill: false },
    },
    plugins: [
        react(),
        // Remove crossorigin AFTER React plugin adds it
        removeCrossOrigin(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            // Externalize electron-chrome-extensions only when it is installed.
                            external: hasElectronChromeExtensions ? ['electron-chrome-extensions'] : [],
                        }
                    }
                },
                onstart(args) {
                    // Copy extension preload script
                    const dest = path.join(__dirname, 'dist-electron/dist/chrome-extension-api.preload.js');
                    if (extensionPreloadPath && fs.existsSync(extensionPreloadPath)) {
                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                        fs.cpSync(extensionPreloadPath, dest);
                        console.log('[vite] Copied chrome-extension-api.preload.js');
                    }

                    // Start the app
                    args.startup()
                },
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: {
                    preload: path.join(__dirname, 'electron/preload.ts'),
                    // DISABLED: view-preload breaks Google sign-in - working Dec 26 version doesn't have it
                    // 'view-preload': path.join(__dirname, 'electron/view-preload.ts'),
                },
                vite: {
                    build: {
                        rollupOptions: {
                            output: {
                                inlineDynamicImports: false,
                            }
                        }
                    }
                }
            },
            // Ployfill the Electron and Node.js built-in modules for Renderer process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: {},
        }),
    ],
})
