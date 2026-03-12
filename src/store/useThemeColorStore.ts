import { create } from 'zustand';

export interface ThemeColorPreset {
    id: string;
    name: string;
    outerGlow: string;      // rgba color for the outer border glow
    innerFrame: string;     // hsl color for the inner frame background
    shellBase: string;      // hsl color for the shell base background
    borderLine: string;     // rgba color for the inset border line
    sidebarHsl: string;     // H S% L% for --sidebar CSS variable (matches preset hue)
    backgroundHsl: string;  // H S% L% for --background CSS variable (matches preset hue)
}

const PRESETS: ThemeColorPreset[] = [
    {
        id: 'teal',
        name: 'Teal',
        outerGlow: 'rgba(50, 190, 170, VAR)',
        innerFrame: 'hsl(175, 15%, 8%)',
        shellBase: 'hsl(175, 18%, 6%)',
        borderLine: 'rgba(80, 210, 190, 0.22)',
        sidebarHsl: '175 15% 8%',
        backgroundHsl: '175 12% 8%',
    },
    {
        id: 'emerald',
        name: 'Emerald',
        outerGlow: 'rgba(50, 200, 120, VAR)',
        innerFrame: 'hsl(150, 18%, 8%)',
        shellBase: 'hsl(150, 20%, 6%)',
        borderLine: 'rgba(80, 220, 140, 0.22)',
        sidebarHsl: '150 18% 8%',
        backgroundHsl: '150 15% 8%',
    },
    {
        id: 'blue',
        name: 'Blue',
        outerGlow: 'rgba(60, 140, 220, VAR)',
        innerFrame: 'hsl(215, 20%, 8%)',
        shellBase: 'hsl(215, 22%, 6%)',
        borderLine: 'rgba(80, 160, 240, 0.22)',
        sidebarHsl: '215 20% 8%',
        backgroundHsl: '215 16% 8%',
    },
    {
        id: 'purple',
        name: 'Purple',
        outerGlow: 'rgba(140, 80, 220, VAR)',
        innerFrame: 'hsl(270, 18%, 8%)',
        shellBase: 'hsl(270, 20%, 6%)',
        borderLine: 'rgba(160, 100, 240, 0.22)',
        sidebarHsl: '270 18% 8%',
        backgroundHsl: '270 14% 8%',
    },
    {
        id: 'amber',
        name: 'Amber',
        outerGlow: 'rgba(220, 160, 50, VAR)',
        innerFrame: 'hsl(35, 20%, 8%)',
        shellBase: 'hsl(35, 22%, 6%)',
        borderLine: 'rgba(240, 180, 70, 0.22)',
        sidebarHsl: '35 20% 8%',
        backgroundHsl: '35 16% 8%',
    },
    {
        id: 'rose',
        name: 'Rose',
        outerGlow: 'rgba(220, 80, 120, VAR)',
        innerFrame: 'hsl(340, 18%, 8%)',
        shellBase: 'hsl(340, 20%, 6%)',
        borderLine: 'rgba(240, 100, 140, 0.22)',
        sidebarHsl: '340 18% 8%',
        backgroundHsl: '340 14% 8%',
    },
    {
        id: 'cyan',
        name: 'Cyan',
        outerGlow: 'rgba(40, 200, 220, VAR)',
        innerFrame: 'hsl(190, 20%, 8%)',
        shellBase: 'hsl(190, 22%, 6%)',
        borderLine: 'rgba(60, 220, 240, 0.22)',
        sidebarHsl: '190 20% 8%',
        backgroundHsl: '190 16% 8%',
    },
    {
        id: 'obsidian',
        name: 'Obsidian',
        outerGlow: 'rgba(120, 130, 140, VAR)',
        innerFrame: 'hsl(220, 8%, 8%)',
        shellBase: 'hsl(220, 10%, 6%)',
        borderLine: 'rgba(140, 150, 160, 0.18)',
        sidebarHsl: '220 8% 8%',
        backgroundHsl: '220 6% 8%',
    },
];

const STORAGE_KEY = 'continuum-theme-color';

function loadSavedPreset(): string {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'teal';
    } catch {
        return 'teal';
    }
}

interface ThemeColorStore {
    activePresetId: string;
    presets: ThemeColorPreset[];
    getActivePreset: () => ThemeColorPreset;
    setPreset: (presetId: string) => void;
}

export const useThemeColorStore = create<ThemeColorStore>((set, get) => ({
    activePresetId: loadSavedPreset(),
    presets: PRESETS,
    getActivePreset: () => {
        const state = get();
        return state.presets.find(p => p.id === state.activePresetId) || PRESETS[0];
    },
    setPreset: (presetId: string) => {
        set({ activePresetId: presetId });
        try {
            localStorage.setItem(STORAGE_KEY, presetId);
        } catch { /* ignore */ }
    },
}));

/** Helper: returns the outerGlow color with a specific opacity */
export function glowColor(preset: ThemeColorPreset, opacity: number): string {
    return preset.outerGlow.replace('VAR', String(opacity));
}
