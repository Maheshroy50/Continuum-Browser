import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Core Themes + Aesthetic Themes
export type Theme =
    | 'light' | 'dark' | 'midnight'  // Core
    | 'seoul-night' | 'soft-cafe' | 'blossom-pink' | 'milk-tea' | 'mint-breeze'
    | 'america';  // Aesthetic
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange';
export type UIDensity = 'comfortable' | 'compact';

export interface Preferences {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    uiDensity: UIDensity;
    animations: boolean;

    // Language
    language: string; // 'system' | 'en' | 'es' ...

    // Workspaces
    restoreLastWorkspace: boolean;

    // Browsing
    searchEngine: 'google' | 'duckduckgo' | 'bing';
    openLinksInNewWorkspace: boolean;
    smoothScrolling: boolean;
    hardwareAcceleration: boolean;

    // Notes
    autoSaveNotes: boolean;
    notesAppendTitle: boolean;
    notesAppendUrl: boolean;

    // Privacy
    blockThirdPartyCookies: boolean;
    doNotTrack: boolean;

    // Layout
    sidebarHidden: boolean;

    // Actions
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: AccentColor) => void;
    setUIDensity: (density: UIDensity) => void;
    setAnimations: (enabled: boolean) => void;
    setLanguage: (lang: string) => void;
    setRestoreLastWorkspace: (enabled: boolean) => void;

    // Phase 2 Setters
    setSearchEngine: (engine: 'google' | 'duckduckgo' | 'bing') => void;
    setOpenLinksInNewWorkspace: (enabled: boolean) => void;
    setNotesSettings: (settings: Partial<{ autoSaveNotes: boolean; notesAppendTitle: boolean; notesAppendUrl: boolean }>) => void;
    setPrivacySettings: (settings: Partial<{ blockThirdPartyCookies: boolean; doNotTrack: boolean }>) => void;
    toggleSidebar: () => void;

    resetToDefaults: () => void;
}

const DEFAULT_PREFERENCES: Omit<Preferences, 'setTheme' | 'setAccentColor' | 'setUIDensity' | 'setAnimations' | 'setLanguage' | 'setRestoreLastWorkspace' | 'setSearchEngine' | 'setOpenLinksInNewWorkspace' | 'setNotesSettings' | 'setPrivacySettings' | 'toggleSidebar' | 'resetToDefaults'> = {
    theme: 'dark',
    accentColor: 'blue',
    uiDensity: 'comfortable',
    animations: true,
    language: 'system',
    restoreLastWorkspace: true,

    searchEngine: 'google',
    openLinksInNewWorkspace: false,
    smoothScrolling: true,
    hardwareAcceleration: true,

    autoSaveNotes: true,
    notesAppendTitle: true,
    notesAppendUrl: false,

    blockThirdPartyCookies: false,
    doNotTrack: true,

    sidebarHidden: false,
};

export const usePreferencesStore = create<Preferences>()(
    persist(
        (set) => ({
            ...DEFAULT_PREFERENCES,

            setTheme: (theme) => set({ theme }),
            setAccentColor: (accentColor) => set({ accentColor }),
            setUIDensity: (uiDensity) => set({ uiDensity }),
            setAnimations: (animations) => set({ animations }),
            setLanguage: (language) => set({ language }),
            setRestoreLastWorkspace: (restoreLastWorkspace) => set({ restoreLastWorkspace }),

            setSearchEngine: (searchEngine) => set({ searchEngine }),
            setOpenLinksInNewWorkspace: (openLinksInNewWorkspace) => set({ openLinksInNewWorkspace }),
            setNotesSettings: (settings) => set((state) => ({ ...state, ...settings })),
            setPrivacySettings: (settings) => set((state) => ({ ...state, ...settings })),
            toggleSidebar: () => set((state) => ({ sidebarHidden: !state.sidebarHidden })),

            resetToDefaults: () => set(DEFAULT_PREFERENCES),
        }),
        {
            name: 'continuum-preferences',
            version: 1, // Ready for migration logic later
        }
    )
);
