import { usePreferencesStore, Theme } from '../../../store/usePreferencesStore';
import { Sun, Moon, Sparkles, Coffee, Flower2, IceCream, Leaf, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Core themes
const coreThemes: { id: Theme; label: string; icon: any }[] = [
    { id: 'light', label: 'Continuum Light', icon: Sun },
    { id: 'dark', label: 'Continuum Dark', icon: Moon },
    { id: 'midnight', label: 'Midnight', icon: Sparkles },
];

const tKey: Record<string, string> = {
    light: 'light',
    dark: 'dark',
    midnight: 'midnight'
};

// Helper to convert kebab-case to camelCase for i18n keys
const toCamelCase = (s: string) => s.replace(/-./g, x => x[1].toUpperCase());

// Aesthetic themes with color previews
const aestheticThemes: { id: Theme; label: string; icon: any; colors: string[] }[] = [
    {
        id: 'seoul-night',
        label: 'Seoul Night',
        icon: Sparkles,
        colors: ['#0f1219', '#3b82f6', '#1e293b']  // Dark indigo, neon blue, slate
    },
    {
        id: 'soft-cafe',
        label: 'Soft Café',
        icon: Coffee,
        colors: ['#f5f0e8', '#8b7355', '#e8e0d5']  // Cream, brown, beige
    },
    {
        id: 'blossom-pink',
        label: 'Blossom Pink',
        icon: Flower2,
        colors: ['#f8f0f3', '#c77d94', '#f0e0e6']  // Light pink, muted rose, soft pink
    },
    {
        id: 'milk-tea',
        label: 'Milk Tea',
        icon: IceCream,
        colors: ['#f0e6db', '#c4855a', '#e8dcd0']  // Cream, peach, beige
    },
    {
        id: 'mint-breeze',
        label: 'Mint Breeze',
        icon: Leaf,
        colors: ['#f0f8f5', '#4a9d7c', '#e0f0ea']  // Light mint, soft green, pale mint
    },

    {
        id: 'america',
        label: 'America',
        icon: Flag,
        colors: ['#0F172A', '#EF4444', '#FFFFFF'] // Navy, Red, White
    },
];

export function AppearanceSection() {
    const { t } = useTranslation();
    const theme = usePreferencesStore(state => state.theme);
    const setTheme = usePreferencesStore(state => state.setTheme);

    return (
        <div className="space-y-6">
            {/* Core Themes */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-1">{t('settings.appearance.theme.title')}</h4>
                <p className="text-xs text-muted-foreground mb-6">{t('settings.appearance.theme.description')}</p>

                <div className="grid grid-cols-3 gap-4">
                    {coreThemes.map(themeItem => {
                        const Icon = themeItem.icon;
                        const isSelected = theme === themeItem.id;
                        return (
                            <button
                                key={themeItem.id}
                                onClick={() => setTheme(themeItem.id)}
                                className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                                    }`}
                            >
                                <Icon className="w-6 h-6 mb-3" />
                                <span className="text-xs font-medium">{t(`settings.appearance.theme.${tKey[themeItem.id] || themeItem.id}`)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Aesthetic Themes */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-1">{t('settings.appearance.aesthetic.title')}</h4>
                <p className="text-xs text-muted-foreground mb-6">{t('settings.appearance.aesthetic.description')}</p>

                <div className="grid grid-cols-5 gap-3">
                    {aestheticThemes.map(themeItem => {
                        const isSelected = theme === themeItem.id;
                        return (
                            <button
                                key={themeItem.id}
                                onClick={() => setTheme(themeItem.id)}
                                className={`group flex flex-col items-center p-3 rounded-xl border transition-all ${isSelected
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border hover:border-foreground/30'
                                    }`}
                            >
                                {/* Color preview circles */}
                                <div className="flex gap-1 mb-2">
                                    {themeItem.colors.map((color: string, i: number) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full border border-black/10"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <span className={`text-[10px] font-medium text-center leading-tight ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                    }`}>
                                    {t(`settings.appearance.aesthetic.${toCamelCase(themeItem.id)}`)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
