import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { create } from 'zustand';

// Signaling servers (using public ones for now, can be hosted self-hosted later)
const SIGNALING_SERVERS = [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling-eu.herokuapp.com',
    'wss://y-webrtc-signaling-us.herokuapp.com'
];

interface SyncState {
    isConnected: boolean;
    peerCount: number;
    syncId: string | null;
    lastError: string | null;
    isInitialized: boolean;
}

class SyncServiceImpl {
    private doc: Y.Doc;
    private provider: WebrtcProvider | null = null;
    private persistence: IndexeddbPersistence | null = null;
    private statusListeners: Set<(state: SyncState) => void> = new Set();

    // Internal state
    private state: SyncState = {
        isConnected: false,
        peerCount: 0,
        syncId: null,
        lastError: null,
        isInitialized: false
    };

    constructor() {
        this.doc = new Y.Doc();

        // Initialize persistence immediately to save local changes even if offline
        this.persistence = new IndexeddbPersistence('continuum-sync-store', this.doc);

        this.persistence.on('synced', () => {
            console.log('[SyncService] Local persistence loaded');
        });
    }

    public getDoc(): Y.Doc {
        return this.doc;
    }

    public getState(): SyncState {
        return { ...this.state };
    }

    public subscribe(listener: (state: SyncState) => void) {
        this.statusListeners.add(listener);
        listener(this.state);
        return () => this.statusListeners.delete(listener);
    }

    private updateState(updates: Partial<SyncState>) {
        this.state = { ...this.state, ...updates };
        this.statusListeners.forEach(l => l(this.state));
    }

    public generateKey(): string {
        // Generate a random 3-word key or UUID. UUID is simpler for now.
        return crypto.randomUUID();
    }

    public async connect(syncId: string, password?: string) {
        if (!syncId) return;

        // If already connected to this ID, do nothing
        if (this.provider && this.state.syncId === syncId) return;

        // Disconnect existing
        this.disconnect();

        try {
            console.log(`[SyncService] Connecting to room: ${syncId}`);

            // Password functionality in y-webrtc is done via room name hashing or custom signaling.
            // For MVP, the "Sync ID" IS the secret key. 
            // We prepend 'continuum-' to ensure we don't collide with other y-webrtc users on public signaling.
            const roomName = `continuum-v1-${syncId}`;

            this.provider = new WebrtcProvider(roomName, this.doc, {
                signaling: SIGNALING_SERVERS,
                password: password || undefined, // y-webrtc supports password if signaling server supports it
            });

            this.provider.on('status', (event: { connected: boolean }) => {
                console.log('[SyncService] Status:', event.connected ? 'connected' : 'disconnected');
                this.updateState({ isConnected: event.connected });
            });

            this.provider.on('peers', (event: { webrtcPeers: any[], bcPeers: any[] }) => {
                const count = event.webrtcPeers.length + event.bcPeers.length;
                console.log('[SyncService] Peers:', count);
                this.updateState({ peerCount: count });
            });

            this.provider.on('synced', (event: any) => {
                console.log('[SyncService] Synced with peers:', event);
            });

            this.updateState({
                syncId,
                isConnected: false, // Wait for status event
                lastError: null,
                isInitialized: true
            });

        } catch (error: any) {
            console.error('[SyncService] Connection error:', error);
            this.updateState({ lastError: error.message });
        }
    }

    public disconnect() {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }
        this.updateState({
            isConnected: false,
            peerCount: 0,
            // We keep syncId to know what we *were* connected to, or allow re-connect
        });
    }
}

export const SyncService = new SyncServiceImpl();

// Hook for React components
export const useSyncState = create<SyncState>((set) => {
    // Initial state
    const initialState = SyncService.getState();

    // Subscribe to updates
    SyncService.subscribe((state) => {
        set(state);
    });

    return initialState;
});
