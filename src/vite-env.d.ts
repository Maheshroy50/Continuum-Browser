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
        updateUrl: (pageId: string, url: string) => Promise<void>;
        back: () => Promise<void>;
        forward: () => Promise<void>;
        reload: () => Promise<void>;
        capture: () => Promise<string>;
        hide: () => Promise<void>;
        show: () => Promise<void>;
        captureState: (flowId: string, pageId: string) => Promise<any>;
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
}

interface Window {
    ipcRenderer: IpcRenderer;
}
