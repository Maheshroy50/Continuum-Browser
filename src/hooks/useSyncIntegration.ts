import { useEffect, useRef } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { SyncService } from '../services/SyncService';
import * as Y from 'yjs';

export function useSyncIntegration() {
    const isSyncingRef = useRef(false);

    useEffect(() => {
        const doc = SyncService.getDoc();
        const yFlows = doc.getArray('flows');

        // Initial Data Sync Strategy
        // If Yjs has data, it wins (Remote/Persisted State)
        // If Yjs is empty, Local State populates it
        if (yFlows.length > 0) {
            console.log('[Sync] Yjs has data, hydrating local store');
            useFlowStore.setState({ flows: yFlows.toJSON() as any });
        } else {
            const localFlows = useFlowStore.getState().flows;
            if (localFlows.length > 0) {
                console.log('[Sync] Yjs empty, seeding from local store');
                doc.transact(() => {
                    yFlows.insert(0, localFlows);
                }, 'local');
            }
        }

        // 1. Remote -> Local
        const handleRemoteUpdate = (_events: Y.YEvent<any>[], transaction: Y.Transaction) => {
            if (transaction.origin === 'local') return;

            console.log('[Sync] Remote update received');
            isSyncingRef.current = true;
            useFlowStore.setState({ flows: yFlows.toJSON() as any });
            isSyncingRef.current = false;
        };

        yFlows.observeDeep(handleRemoteUpdate);

        // 2. Local -> Remote
        const unsubscribeStore = useFlowStore.subscribe((state, prevState) => {
            if (isSyncingRef.current) return;
            if (!SyncService.getState().isConnected && !SyncService.getState().isInitialized) return;

            // Simple diff to avoid loops
            if (state.flows === prevState.flows) return;

            // We perform a brute-force sync for MVP (Replace changes)
            // Ideally this would be granular, but Zustand flows are complex objects

            // Check if actually different from Yjs to avoid echo
            // (JSON.stringify is expensive but reliable for this MVP size)
            const currentYJson = JSON.stringify(yFlows.toJSON());
            const currentLocalJson = JSON.stringify(state.flows);

            if (currentYJson !== currentLocalJson) {
                doc.transact(() => {
                    yFlows.delete(0, yFlows.length);
                    yFlows.insert(0, state.flows);
                }, 'local');
            }
        });

        return () => {
            yFlows.unobserveDeep(handleRemoteUpdate);
            unsubscribeStore();
        };
    }, []);
}
