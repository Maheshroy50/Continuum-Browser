import { useEffect, useCallback } from 'react';
import { usePreferencesStore, Theme, AccentColor, UIStyle } from '../store/usePreferencesStore';
import { useThemeColorStore } from '../store/useThemeColorStore';

// Supported themes (UI + preferences)
const SUPPORTED_THEMES: Theme[] = ['light', 'dark', 'midnight', 'dia'];

// All theme classes (for cleanup of legacy persisted values)
const ALL_THEME_CLASSES = [
    'light', 'dark', 'midnight',
    'seoul-night', 'soft-cafe', 'blossom-pink', 'milk-tea', 'mint-breeze',
    'aura', 'dia', 'vibrant-glass',
    'obsidian', 'emerald', 'ocean', 'cobalt', 'amethyst', 'sunrise', 'ember', 'rose',
];

// Helper to apply theme to document
// This is the SINGLE SOURCE OF TRUTH for theme CSS class + --background/--sidebar variables.
// No other code should set or remove these variables.
function applyTheme(theme: Theme, presetBackgroundHsl?: string, presetSidebarHsl?: string) {
    const root = document.documentElement;

    // Step 1: Remove all theme classes (clean slate)
    ALL_THEME_CLASSES.forEach(t => root.classList.remove(t));

    // Step 2: Add the selected theme class (except 'dark' which is the `:root` default)
    if (theme !== 'dark') {
        root.classList.add(theme);
    }

    // Step 3: Manage --background and --sidebar inline CSS variables.
    // Inline styles on <html> have HIGHER specificity than class-scoped CSS variables.
    // For light/midnight, we MUST remove inline overrides so the .light / .midnight CSS rules win.
    // For dark themes, we SET the preset values so the sidebar hue matches the ambient glow.
    if (theme === 'light' || theme === 'midnight') {
        // Remove ALL potentially stale inline CSS variable overrides from dark presets
        const varsToClean = [
            '--background', '--foreground', '--sidebar', '--card', '--card-foreground',
            '--popover', '--popover-foreground', '--secondary', '--secondary-foreground',
            '--muted', '--muted-foreground', '--border', '--input',
            '--destructive', '--destructive-foreground',
            '--dia-surface-0', '--dia-shell',
        ];
        varsToClean.forEach(v => root.style.removeProperty(v));
    } else if (presetBackgroundHsl && presetSidebarHsl) {
        // Dark or Dia theme: sync --background/--sidebar to the active ambient preset
        root.style.setProperty('--background', presetBackgroundHsl);
        root.style.setProperty('--sidebar', presetSidebarHsl);
    }
}

const ACCENT_MAP: Record<AccentColor, string> = {
    blue: '221 83% 53%',   // blue-500
    purple: '249 74% 67%', // #7B68EE (Arc Primary)
    green: '142 70% 45%',  // green-500-ish
    orange: '24 94% 53%',  // orange-500
};

function applyAccentColor(accent: AccentColor) {
    const root = document.documentElement;
    const hsl = ACCENT_MAP[accent] || ACCENT_MAP.blue;
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--accent', hsl);
    root.style.setProperty('--primary-foreground', '0 0% 98%');
    root.style.setProperty('--accent-foreground', '0 0% 98%');
}

function applyDiaAccent() {
    const root = document.documentElement;
    root.style.setProperty('--primary', '36 64% 60%');
    root.style.setProperty('--ring', '36 64% 60%');
    root.style.setProperty('--accent', '34 48% 44%');
    root.style.setProperty('--primary-foreground', '24 18% 10%');
    root.style.setProperty('--accent-foreground', '24 18% 10%');
}

function applyUIStyle(_style: UIStyle) {
    const root = document.documentElement;
    // Enforce Arc style always
    root.classList.add('ui-arc');
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6) {
        return { h: 221, s: 83, l: 53 };
    }
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function toHslString(h: number, s: number, l: number) {
    return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function applyUiTint(hex: string) {
    const root = document.documentElement;
    const { h, s, l } = hexToHsl(hex || '#7aa2ff');
    const softL = clamp(l + 18, 10, 95);
    const strongL = clamp(l - 12, 5, 90);
    root.style.setProperty('--arc-tint', toHslString(h, s, l));
    root.style.setProperty('--arc-tint-soft', toHslString(h, s, softL));
    root.style.setProperty('--arc-tint-strong', toHslString(h, s, strongL));
}

function applyDiaTint() {
    const root = document.documentElement;
    root.style.setProperty('--arc-tint', '34 50% 38%');
    root.style.setProperty('--arc-tint-soft', '34 36% 30%');
    root.style.setProperty('--arc-tint-strong', '34 26% 22%');
}

export function useTheme() {
    const theme = usePreferencesStore(state => state.theme);
    const accentColor = usePreferencesStore(state => state.accentColor);
    const uiStyle = usePreferencesStore(state => state.uiStyle);
    const setTheme = usePreferencesStore(state => state.setTheme);

    // Subscribe to the ambient border preset so we can sync --background/--sidebar
    const activePresetId = useThemeColorStore(state => state.activePresetId);
    const themePreset = useThemeColorStore(state => state.getActivePreset());

    // Apply theme when it changes — this is the SINGLE SOURCE OF TRUTH for:
    // - CSS theme class on <html>
    // - --background and --sidebar inline CSS variables
    // - accent color, tint, and nativeTheme
    useEffect(() => {
        if (!SUPPORTED_THEMES.includes(theme)) {
            setTheme('dark');
            return;
        }

        // Pass the ambient preset's background/sidebar values so applyTheme can
        // set them for dark themes or remove them for light/midnight themes.
        console.log(`[useTheme] Applying theme: "${theme}", preset: ${themePreset?.id || 'none'}`);
        applyTheme(theme, themePreset?.backgroundHsl, themePreset?.sidebarHsl);

        if (theme === 'dia') {
            applyDiaAccent();
        } else {
            applyAccentColor(accentColor);
        }
        applyUIStyle(uiStyle);
        if (theme === 'dia') {
            applyDiaTint();
        } else {
            applyUiTint('#7aa2ff');
        }

        // Sync Electron's nativeTheme so BrowserView web content respects prefers-color-scheme.
        const nativeMode = theme === 'light' ? 'light' : 'dark';
        try {
            // @ts-ignore — window.ipcRenderer.app is exposed by preload.ts
            window.ipcRenderer?.app?.setNativeTheme?.(nativeMode);
        } catch { /* graceful fallback when not in Electron */ }
    }, [theme, accentColor, uiStyle, setTheme, activePresetId, themePreset]);

    const toggleTheme = useCallback(() => {
        // Simple toggle between light and dark
        setTheme(theme === 'light' ? 'dark' : 'light');
    }, [theme, setTheme]);

    return { theme, setTheme, toggleTheme };
}

export default useTheme;
