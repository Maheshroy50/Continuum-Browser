import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    // AI API Keys
    openAIApiKey: string;
    googleApiKey: string;
    anthropicApiKey: string;

    // Actions
    setOpenAIApiKey: (key: string) => void;
    setGoogleApiKey: (key: string) => void;
    setAnthropicApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            openAIApiKey: '',
            googleApiKey: '',
            anthropicApiKey: '',

            setOpenAIApiKey: (key) => set({ openAIApiKey: key }),
            setGoogleApiKey: (key) => set({ googleApiKey: key }),
            setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
        }),
        {
            name: 'continuum-settings',
            // Only persist non-sensitive or user-preference data if possible, 
            // but for a local-first browser app, localStorage is acceptable for now 
            // as users expect their keys to be saved.
        }
    )
);
