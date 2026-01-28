import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotesSection() {
    const { t } = useTranslation();
    const { autoSaveNotes, notesAppendTitle, notesAppendUrl } = usePreferencesStore(state => ({
        autoSaveNotes: state.autoSaveNotes,
        notesAppendTitle: state.notesAppendTitle,
        notesAppendUrl: state.notesAppendUrl
    }));
    const setNotesSettings = usePreferencesStore(state => state.setNotesSettings);

    const toggle = (key: 'autoSaveNotes' | 'notesAppendTitle' | 'notesAppendUrl') => {
        const val = key === 'autoSaveNotes' ? autoSaveNotes :
            key === 'notesAppendTitle' ? notesAppendTitle : notesAppendUrl;
        setNotesSettings({ [key]: !val });
    };

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-6">{t('settings.notes.settingTitle')}</h4>

                <div className="space-y-6">
                    {/* Auto Save */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.notes.autoSave.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.notes.autoSave.description')}</div>
                        </div>
                        <button
                            onClick={() => toggle('autoSaveNotes')}
                            className={`transition-colors ${autoSaveNotes ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {autoSaveNotes ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Append Title */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.notes.captureTitle.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.notes.captureTitle.description')}</div>
                        </div>
                        <button
                            onClick={() => toggle('notesAppendTitle')}
                            className={`transition-colors ${notesAppendTitle ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {notesAppendTitle ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>

                    {/* Append URL */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.notes.captureUrl.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.notes.captureUrl.description')}</div>
                        </div>
                        <button
                            onClick={() => toggle('notesAppendUrl')}
                            className={`transition-colors ${notesAppendUrl ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {notesAppendUrl ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
