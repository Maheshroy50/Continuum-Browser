import { defineConfig, Plugin } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

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
                            // Externalize electron-chrome-extensions so it can resolve its own preload
                            external: ['electron-chrome-extensions'],
                        }
                    }
                },
                onstart(args) {
                    // Copy extension preload script
                    const layout = path.join(__dirname, 'node_modules/electron-chrome-extensions/dist/chrome-extension-api.preload.js');
                    const dest = path.join(__dirname, 'dist-electron/dist/chrome-extension-api.preload.js');
                    const fs = require('node:fs');
                    if (fs.existsSync(layout)) {
                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                        fs.cpSync(layout, dest);
                        console.log('[vite] Copied chrome-extension-api.preload.js');
                    } else {
                        console.warn('[vite] chrome-extension-api.preload.js not found');
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


