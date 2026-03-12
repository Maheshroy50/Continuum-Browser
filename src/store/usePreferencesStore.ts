import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Core Themes + Dia
export type Theme =
    | 'light' | 'dark' | 'midnight'
    | 'dia';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange';
export type UIDensity = 'comfortable' | 'compact';
export type UIStyle = 'classic' | 'arc';

export interface FavoriteSite {
    id: string;
    url: string;
    title: string;
    favicon?: string;
}

export interface Preferences {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    uiDensity: UIDensity;
    uiStyle: UIStyle;
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
    isNotesPanelOpen: boolean;

    // Favorites Bar
    favoriteSites: FavoriteSite[];
    showFavoritesBar: boolean;

    // Actions
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: AccentColor) => void;
    setUIDensity: (density: UIDensity) => void;
    setUIStyle: (style: UIStyle) => void;
    setAnimations: (enabled: boolean) => void;
    setLanguage: (lang: string) => void;
    setRestoreLastWorkspace: (enabled: boolean) => void;

    // Phase 2 Setters
    setSearchEngine: (engine: 'google' | 'duckduckgo' | 'bing') => void;
    setOpenLinksInNewWorkspace: (enabled: boolean) => void;
    setNotesSettings: (settings: Partial<{ autoSaveNotes: boolean; notesAppendTitle: boolean; notesAppendUrl: boolean }>) => void;
    setPrivacySettings: (settings: Partial<{ blockThirdPartyCookies: boolean; doNotTrack: boolean }>) => void;
    toggleSidebar: () => void;
    toggleNotesPanel: () => void;

    // Favorites Bar Actions
    addFavoriteSite: (site: FavoriteSite) => void;
    removeFavoriteSite: (id: string) => void;
    reorderFavoriteSites: (sites: FavoriteSite[]) => void;
    toggleFavoritesBar: () => void;

    resetToDefaults: () => void;
}

const DEFAULT_PREFERENCES: Omit<Preferences, 'setTheme' | 'setAccentColor' | 'setUIDensity' | 'setUIStyle' | 'setAnimations' | 'setLanguage' | 'setRestoreLastWorkspace' | 'setSearchEngine' | 'setOpenLinksInNewWorkspace' | 'setNotesSettings' | 'setPrivacySettings' | 'toggleSidebar' | 'toggleNotesPanel' | 'addFavoriteSite' | 'removeFavoriteSite' | 'reorderFavoriteSites' | 'toggleFavoritesBar' | 'resetToDefaults'> = {
    theme: 'dark',
    accentColor: 'blue',
    uiDensity: 'comfortable',
    uiStyle: 'arc',
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

    sidebarHidden: true,
    isNotesPanelOpen: false,

    favoriteSites: [],
    showFavoritesBar: true,
};

export const usePreferencesStore = create<Preferences>()(
    persist(
        (set) => ({
            ...DEFAULT_PREFERENCES,

            setTheme: (theme) => set({ theme }),
            setAccentColor: (accentColor) => set({ accentColor }),
            setUIDensity: (uiDensity) => set({ uiDensity }),
            setUIStyle: (uiStyle) => set({ uiStyle }),
            setAnimations: (animations) => set({ animations }),
            setLanguage: (language) => set({ language }),
            setRestoreLastWorkspace: (restoreLastWorkspace) => set({ restoreLastWorkspace }),

            setSearchEngine: (searchEngine) => set({ searchEngine }),
            setOpenLinksInNewWorkspace: (openLinksInNewWorkspace) => set({ openLinksInNewWorkspace }),
            setNotesSettings: (settings) => set((state) => ({ ...state, ...settings })),
            setPrivacySettings: (settings) => set((state) => ({ ...state, ...settings })),
            toggleSidebar: () => set((state) => ({ sidebarHidden: !state.sidebarHidden })),
            toggleNotesPanel: () => set((state) => ({ isNotesPanelOpen: !state.isNotesPanelOpen })),

            addFavoriteSite: (site) => set((state) => {
                if (state.favoriteSites.some(s => s.url === site.url)) return state;
                return { favoriteSites: [...state.favoriteSites, site] };
            }),
            removeFavoriteSite: (id) => set((state) => ({
                favoriteSites: state.favoriteSites.filter(s => s.id !== id)
            })),
            reorderFavoriteSites: (sites) => set({ favoriteSites: sites }),
            toggleFavoritesBar: () => set((state) => ({ showFavoritesBar: !state.showFavoritesBar })),

            resetToDefaults: () => set(DEFAULT_PREFERENCES),
        }),
        {
            name: 'continuum-preferences',
            version: 1, // Ready for migration logic later
        }
    )
);

