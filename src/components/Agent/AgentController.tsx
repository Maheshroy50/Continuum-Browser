import { useEffect } from 'react';
import { useAIStore } from '../../store/useAIStore';

export function AgentController() {
    const {
        setActivity,
        setPendingApproval,
        setPowerLevel,
        setIsOpen
    } = useAIStore();

    useEffect(() => {
        const ipc = window.ipcRenderer;
        const agent = ipc?.agent;
        if (!ipc || !agent) {
            console.warn('[AgentController] Agent IPC not available');
            return;
        }

        let disposed = false;

        // Initialize Power Level
        agent.getPowerLevel().then((level: any) => {
            if (disposed) return;
            if (level === 1 || level === 2 || level === 3) {
                setPowerLevel(level);
            }
        }).catch(console.error);

        const handleActivityUpdate = (_event: unknown, activity: any) => {
            setActivity(activity);

            // Auto-clear approval if activity moves away from 'awaiting_approval'
            if (activity.state !== 'awaiting_approval') {
                setPendingApproval(null);
            }
        };

        const handleApprovalRequest = (_event: unknown, request: any) => {
            setPendingApproval({
                id: request.id,
                intent: request.intent,
                origin: request.origin,
                affectedElements: request.affectedElements,
                consequences: request.consequences,
                timestamp: request.timestamp
            });
            setIsOpen(true); // Open panel to show approval
        };

        ipc.on('agent:activity-update', handleActivityUpdate);
        ipc.on('agent:approval-request', handleApprovalRequest);

        return () => {
            disposed = true;
            ipc.off('agent:activity-update', handleActivityUpdate);
            ipc.off('agent:approval-request', handleApprovalRequest);
        };
    }, [setActivity, setPendingApproval, setPowerLevel, setIsOpen]);

    return null;
}
