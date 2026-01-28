import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // Persistence API
    fs: {
        getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
        saveFile: (filename: string, content: string) => ipcRenderer.invoke('save-file', filename, content),
        readFile: (filename: string) => ipcRenderer.invoke('read-file', filename),
    },

    views: {
        create: (flowId: string, pageId: string, url: string, state?: any) => ipcRenderer.invoke('view:create', flowId, pageId, url, state),
        select: (flowId: string, pageId: string | null, url?: string, state?: any) => ipcRenderer.invoke('view:select', flowId, pageId, url, state),
        resize: (bounds: { x: number, y: number, width: number, height: number }) => ipcRenderer.invoke('view:resize', bounds),
        remove: (flowId: string, pageId: string) => ipcRenderer.invoke('view:remove', flowId, pageId),
        updateUrl: (url: string) => ipcRenderer.invoke('view:update-url', url),
        back: () => ipcRenderer.invoke('view:back'),
        forward: () => ipcRenderer.invoke('view:forward'),
        reload: () => ipcRenderer.invoke('view:reload'),
        capture: () => ipcRenderer.invoke('view:capture'),
        hide: () => ipcRenderer.invoke('view:hide'),
        show: () => ipcRenderer.invoke('view:show'),
        captureState: (flowId: string, pageId: string) => ipcRenderer.invoke('view:capture-state', flowId, pageId),
        restoreState: (flowId: string, pageId: string, state: any) => ipcRenderer.invoke('view:restore-state', flowId, pageId, state),
        onUrlUpdate: (callback: (data: { flowId: string, pageId: string, url: string }) => void) =>
            ipcRenderer.on('view:url-updated', (_, data) => callback(data)),
        onTitleUpdate: (callback: (data: { flowId: string, pageId: string, title: string }) => void) =>
            ipcRenderer.on('view:title-updated', (_, data) => callback(data)),
        onRestoreResult: (callback: (data: { pageId: string, method: string, success: boolean, message?: string }) => void) =>
            ipcRenderer.on('view:restore-result', (_, data) => callback(data)),
        onSendToNotes: (callback: (data: { text: string, url: string, title: string, flowId: string }) => void) =>
            ipcRenderer.on('send-to-notes', (_, data) => callback(data)),
        // Context menu actions
        onSearchSelection: (callback: (data: { text: string, flowId: string }) => void) =>
            ipcRenderer.on('search-selection', (_, data) => callback(data)),
        onOpenUrlInWorkspace: (callback: (data: { url: string, flowId: string, newPage: boolean }) => void) =>
            ipcRenderer.on('open-url-in-workspace', (_, data) => callback(data)),
        onOpenUrlInNewWorkspace: (callback: (data: { url: string }) => void) =>
            ipcRenderer.on('open-url-in-new-workspace', (_, data) => callback(data)),
    },

    privacy: {
        clearData: (options?: any) => ipcRenderer.invoke('privacy:clear-data', options),
        setSettings: (settings: { blockThirdPartyCookies?: boolean; doNotTrack?: boolean }) =>
            ipcRenderer.invoke('privacy:set-settings', settings),
        getSettings: () => ipcRenderer.invoke('privacy:get-settings'),
        setSitePermission: (origin: string, permission: string, value: 'allow' | 'deny' | 'ask') =>
            ipcRenderer.invoke('privacy:set-site-permission', origin, permission, value),
        getSitePermissions: () => ipcRenderer.invoke('privacy:get-site-permissions'),
        respondToPermission: (requestId: string, granted: boolean) =>
            ipcRenderer.invoke('privacy:permission-response', requestId, granted),
        onPermissionRequest: (callback: (data: { requestId: string; permission: string; origin: string; requestingUrl: string }) => void) =>
            ipcRenderer.on('privacy:permission-request', (_, data) => callback(data)),
    },

    // App API
    app: {
        isDefaultBrowser: () => ipcRenderer.invoke('app:is-default-browser'),
        setDefaultBrowser: () => ipcRenderer.invoke('app:set-default-browser'),
    },

    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    },

    downloads: {
        // Actions
        pause: (id: string) => ipcRenderer.invoke('downloads:pause', id),
        resume: (id: string) => ipcRenderer.invoke('downloads:resume', id),
        cancel: (id: string) => ipcRenderer.invoke('downloads:cancel', id),
        showInFolder: (id: string) => ipcRenderer.invoke('downloads:show-in-folder', id),
        getAll: () => ipcRenderer.invoke('downloads:get-all'),

        // Events
        onStart: (callback: (data: any) => void) =>
            ipcRenderer.on('download:start', (_, data) => callback(data)),
        onProgress: (callback: (data: any) => void) =>
            ipcRenderer.on('download:progress', (_, data) => callback(data)),
        onComplete: (callback: (data: any) => void) =>
            ipcRenderer.on('download:complete', (_, data) => callback(data)),
    },

    google: {
        signIn: () => {
            console.log('Preload: google.signIn invoked');
            return ipcRenderer.invoke('google:sign-in');
        },
        signOut: () => ipcRenderer.invoke('google:sign-out'),
        getUser: () => ipcRenderer.invoke('google:get-user'),
    },

    ai: {
        chatCompletion: (provider: string, apiKey: string, messages: any[], model?: string) =>
            ipcRenderer.invoke('ai:chat-completion', { provider, apiKey, messages, model }),
    },

    extensions: {
        getAll: () => ipcRenderer.invoke('get-extensions'),
        install: (url: string) => ipcRenderer.invoke('install-extension-from-url', { url }),
        remove: (id: string) => ipcRenderer.invoke('remove-extension', id),
        loadUnpacked: (path: string) => ipcRenderer.invoke('load-unpacked-extension', path),
        getInfo: (id: string) => ipcRenderer.invoke('extension-get-info', id),
        openOptions: (id: string) => ipcRenderer.invoke('extension-open-options', id),
        openPopup: (id: string) => ipcRenderer.invoke('extension-open-popup', id),
    },
})
