import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    // AI API Keys
    openAIApiKey: string;
    googleApiKey: string;
    anthropicApiKey: string;
    githubApiKey: string;
    huggingFaceApiKey: string;
    grokApiKey: string;
    kimiApiKey: string;


    // Actions
    setOpenAIApiKey: (key: string) => void;
    setGoogleApiKey: (key: string) => void;
    setAnthropicApiKey: (key: string) => void;
    setGithubApiKey: (key: string) => void;
    setHuggingFaceApiKey: (key: string) => void;
    setGrokApiKey: (key: string) => void;
    setKimiApiKey: (key: string) => void;
}


export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            openAIApiKey: '',
            googleApiKey: '',
            anthropicApiKey: '',
            githubApiKey: '',
            huggingFaceApiKey: '',
            grokApiKey: '',
            kimiApiKey: '',


            setOpenAIApiKey: (key) => set({ openAIApiKey: key }),
            setGoogleApiKey: (key) => set({ googleApiKey: key }),
            setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
            setGithubApiKey: (key) => set({ githubApiKey: key }),
            setHuggingFaceApiKey: (key) => set({ huggingFaceApiKey: key }),
            setGrokApiKey: (key) => set({ grokApiKey: key }),
            setKimiApiKey: (key) => set({ kimiApiKey: key }),
        }),
        {
            name: 'continuum-settings',
            // Only persist non-sensitive or user-preference data if possible, 
            // but for a local-first browser app, localStorage is acceptable for now 
            // as users expect their keys to be saved.
            skipHydration: true,
        }
    )
);
