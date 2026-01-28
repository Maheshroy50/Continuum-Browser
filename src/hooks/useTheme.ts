import { useEffect, useCallback } from 'react';
import { usePreferencesStore, Theme } from '../store/usePreferencesStore';

// All available themes
const ALL_THEMES: Theme[] = [
    'light', 'dark', 'midnight',
    'seoul-night', 'soft-cafe', 'blossom-pink', 'milk-tea', 'mint-breeze',
    'america'
];

// Helper to apply theme to document
function applyTheme(theme: Theme) {
    const root = document.documentElement;

    // Remove all theme classes
    ALL_THEMES.forEach(t => root.classList.remove(t));

    // Add the selected theme class (except 'dark' which is the default/root)
    if (theme !== 'dark') {
        root.classList.add(theme);
    }
}

export function useTheme() {
    const theme = usePreferencesStore(state => state.theme);
    const setTheme = usePreferencesStore(state => state.setTheme);

    // Apply theme when it changes
    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        // Simple toggle between light and dark
        setTheme(theme === 'light' ? 'dark' : 'light');
    }, [theme, setTheme]);

    return { theme, setTheme, toggleTheme };
}

export default useTheme;
