import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Palette, Globe, Layout, Info, FileText, Shield, Bot, RefreshCw, Puzzle } from 'lucide-react';

// Section Components
import { AppearanceSection } from './sections/Appearance';
import { LanguageSection } from './sections/Language';
import { WorkspacesSection } from './sections/Workspaces';
import { AboutSection } from './sections/About';
import { BrowsingSection } from './sections/Browsing';
import { NotesSection } from './sections/Notes';
import { PrivacySection } from './sections/Privacy';
import { AISection } from './sections/AISection';
import { SyncSection } from './sections/SyncSection';
import { ExtensionsSection } from './sections/Extensions';

type SettingsSectionId = 'appearance' | 'language' | 'workspaces' | 'browsing' | 'notes' | 'privacy' | 'ai' | 'sync' | 'extensions' | 'about';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<SettingsSectionId>('appearance');
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on Esc
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close on click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen) return null;

    const sections = [
        { id: 'appearance', icon: Palette, label: t('settings.appearance.title') },
        { id: 'language', icon: Globe, label: t('settings.language.title') },
        { id: 'workspaces', icon: Layout, label: t('settings.workspaces.title') },
        { id: 'browsing', icon: Globe, label: t('settings.browsing.title') },
        { id: 'notes', icon: FileText, label: t('settings.notes.title') },
        { id: 'privacy', icon: Shield, label: t('settings.privacy.title') },
        { id: 'extensions', icon: Puzzle, label: t('settings.extensions.title', 'Extensions') },
        { id: 'ai', icon: Bot, label: t('settings.ai.title', 'AI & Intelligence') },
        { id: 'sync', icon: RefreshCw, label: t('settings.sync.title', 'Sync & Devices') },
        { id: 'about', icon: Info, label: t('settings.about.title') },
    ] as const;

    const renderContent = () => {
        switch (activeSection) {
            case 'appearance': return <AppearanceSection />;
            case 'language': return <LanguageSection />;
            case 'workspaces': return <WorkspacesSection />;
            case 'browsing': return <BrowsingSection />;
            case 'notes': return <NotesSection />;
            case 'privacy': return <PrivacySection />;
            case 'extensions': return <ExtensionsSection />;
            case 'ai': return <AISection />;
            case 'sync': return <SyncSection />;
            case 'about': return <AboutSection />;
            default: return null;
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={handleBackdropClick}
        >
            <div
                ref={modalRef}
                className="w-full max-w-5xl h-[80vh] bg-background border border-border rounded-xl shadow-2xl flex overflow-hidden"
            >
                {/* Sidebar */}
                <div className="w-64 shrink-0 bg-muted/30 border-r border-border flex flex-col py-6">
                    <div className="px-6 mb-6">
                        <h2 className="text-xl font-semibold text-foreground tracking-tight">{t('settings.title')}</h2>
                    </div>

                    <nav className="flex-1 space-y-0.5 px-3">
                        {sections.map(section => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id as SettingsSectionId)}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 mr-3" />
                                    {section.label}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-border">
                        <div className="text-xs text-muted-foreground text-center">
                            Continuum v0.1.0 Beta
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-background min-w-0 h-full relative text-foreground">
                    <div className="h-16 border-b border-border flex items-center justify-between px-8 shrink-0">
                        <h3 className="text-lg font-medium text-foreground">
                            {sections.find(s => s.id === activeSection)?.label}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-2xl">
                            {renderContent() || (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                    <p>Select a setting to view options.</p>
                                    <p className="text-xs opacity-50 mt-2">Section ID: {activeSection}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
