import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function WorkspacesSection() {
    const { t } = useTranslation();
    const restoreLastWorkspace = usePreferencesStore(state => state.restoreLastWorkspace);
    const setRestoreLastWorkspace = usePreferencesStore(state => state.setRestoreLastWorkspace);

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.workspaces.startup.title')}</h4>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm text-foreground font-medium">{t('settings.workspaces.startup.restore.title')}</div>
                        <div className="text-xs text-muted-foreground mt-1">{t('settings.workspaces.startup.restore.description')}</div>
                    </div>

                    <button
                        onClick={() => setRestoreLastWorkspace(!restoreLastWorkspace)}
                        className={`transition-colors ${restoreLastWorkspace ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {restoreLastWorkspace ? (
                            <ToggleRight className="w-8 h-8" />
                        ) : (
                            <ToggleLeft className="w-8 h-8" />
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 opacity-50 cursor-not-allowed">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.workspaces.autoArchive.title')}</h4>
                <p className="text-xs text-muted-foreground mb-4">{t('settings.workspaces.autoArchive.description')}</p>
            </div>
        </div>
    );
}
