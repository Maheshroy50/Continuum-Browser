/// <reference types="vite/client" />

declare module '*.png' {
    const value: string;
    export default value;
}

interface IpcRenderer {
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    off(channel: string, listener: (event: any, ...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
    invoke(channel: string, ...args: any[]): Promise<any>;
    fs: {
        getUserDataPath: () => Promise<string>;
        saveFile: (filename: string, content: string) => Promise<void>;
        readFile: (filename: string) => Promise<string | null>;
    };
    views: {
        create: (flowId: string, pageId: string, url: string, state?: any) => Promise<any>;
        select: (flowId: string, pageId: string | null | undefined, url?: string | null, state?: any) => Promise<void>;
        resize: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
        remove: (flowId: string, pageId: string) => Promise<void>;
        updateUrl: (url: string) => Promise<void>;
        back: () => Promise<void>;
        forward: () => Promise<void>;
        reload: () => Promise<void>;
        capture: () => Promise<string>;
        hide: () => Promise<void>;
        show: () => Promise<void>;
        captureState: (flowId?: string, pageId?: string) => Promise<any>;
        restoreState: (flowId: string, pageId: string, state: any) => Promise<void>;
        onUrlUpdate: (callback: (data: { flowId: string; pageId: string; url: string }) => void) => void;
        onTitleUpdate: (callback: (data: { flowId: string, pageId: string, title: string }) => void) => void;
        onRestoreResult: (callback: (data: { pageId: string; method: string; success: boolean; message?: string }) => void) => void;
        onSendToNotes: (callback: (data: { text: string; url: string; title: string, flowId: string }) => void) => void;
    };
    privacy: {
        clearData: (options?: any) => Promise<boolean>;
    };
    google: {
        signIn: () => Promise<any>;
        signOut: () => Promise<void>;
        getUser: () => Promise<any>;
    };
    ai: {
        chatCompletion: (provider: string, apiKey: string, messages: any[], model?: string) => Promise<string>;
    };
    agent: {
        processRequest: (userRequest: string, provider: string, apiKey: string, model?: string) => Promise<any>;
        setPowerLevel: (level: 1 | 2 | 3) => Promise<boolean>;
        getPowerLevel: () => Promise<1 | 2 | 3>;
        emergencyStop: () => Promise<void>;
        onApprovalRequest: (callback: (request: any) => void) => void;
        respondToApproval: (requestId: string, approved: boolean) => Promise<void>;
        onActivityUpdate: (callback: (activity: any) => void) => void;
        getActivity: () => Promise<any>;
        getPermissions: () => Promise<any[]>;
        revokePermission: (id: string) => Promise<void>;
        revokeAllForSite: (origin: string) => Promise<void>;
        getActionLog: (limit?: number) => Promise<any[]>;
        getUserProfile: () => Promise<any>;
        updateUserProfile: (updates: any) => Promise<void>;
        // Upgrade 7
        parseResume: (filePath: string, provider: string, apiKey: string) => Promise<any>;
        // Upgrade 8
        startBatch: (urls: string[], goal: string) => Promise<string[]>;
        getWorkflowStatus: () => Promise<any>;
    };
    dialog: {
        openFile: () => Promise<string | null>;
    };
    extensions: {
        getAll: () => Promise<any[]>;
        install: (url: string) => Promise<{ success: boolean, id?: string, error?: string }>;
        remove: (id: string) => Promise<{ success: boolean, error?: string }>;
        loadUnpacked: (path: string) => Promise<{ success: boolean, id?: string, name?: string, error?: string }>;
        getInfo: (id: string) => Promise<{ success: boolean, error?: string } & any>;
        openOptions: (id: string) => Promise<{ success: boolean, error?: string }>;
        openPopup: (id: string) => Promise<{ success: boolean, error?: string }>;
    };
    app: {
        isDefaultBrowser: () => Promise<boolean>;
        setDefaultBrowser: () => Promise<void>;
        onBeforeQuit: (callback: () => void) => void;
    };
}

interface Window {
    ipcRenderer: IpcRenderer;
}
