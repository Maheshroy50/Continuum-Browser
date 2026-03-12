import { useEffect, useState } from 'react';
// import { ExtensionsPanel } from './ExtensionsPanel';
import { SitePermissionsPanel } from './SitePermissionsPanel';
import { DownloadManager } from './DownloadManager';

import { useDownloads } from '../hooks/useDownloads';

export function PopupRoot() {
    const [route, setRoute] = useState(window.location.hash);

    // Listen for hash changes
    useEffect(() => {
        const handleHashChange = () => setRoute(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    if (!route.startsWith('#/popup/')) return null;

    const typeParts = route.replace('#/popup/', '').split('?');
    const type = typeParts[0];
    const query = new URLSearchParams(typeParts[1] || '');

    // Common props
    const onClose = () => window.close();

    // Specific props extraction
    const url = query.get('url') || '';
    const blockedCount = parseInt(query.get('blockedCount') || '0', 10);

    return (
        <div className="w-full h-full bg-transparent flex flex-col overflow-hidden">
            {/* {type === 'extensions' && (
                <div className="p-2">
                    <ExtensionsPanel isPopup={true} />
                </div>
            )} */}

            {type === 'permissions' && (
                <div className="p-2">
                    <SitePermissionsPanel
                        isOpen={true}
                        onClose={onClose}
                        url={url}
                        rect={null}
                        blockedCount={blockedCount}
                        isPopup={true}
                    />
                </div>
            )}

            {type === 'downloads' && (
                <div className="p-2">
                    {/* Retrieve downloads from store or hook inside component */}
                    <DownloadPopupWrapper onClose={onClose} />
                </div>
            )}
        </div>
    );
}

// Wrapper for DownloadManager to handle hooks if needed
function DownloadPopupWrapper({ onClose }: { onClose: () => void }) {
    // But DownloadManager usually takes 'downloads' prop.
    const { downloads, pause, resume, cancel, showInFolder, clearDownload } = useDownloads();

    return (
        <DownloadManager
            isOpen={true}
            onClose={onClose}
            downloads={downloads}
            rect={null}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
            onShowInFolder={showInFolder}
            onClear={clearDownload}
            isPopup={true}
        />
    );
}
