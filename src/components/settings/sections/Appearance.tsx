import { usePreferencesStore, Theme, AccentColor } from '../../../store/usePreferencesStore';
import { useFlowStore } from '../../../store/useFlowStore';
import { useThemeColorStore, glowColor } from '../../../store/useThemeColorStore';
import { Sun, Moon, Sparkles, Check, Volume2, VolumeX } from 'lucide-react';
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
    midnight: 'midnight',
};


const accentOptions: { id: AccentColor; label: string; color: string }[] = [
    { id: 'blue', label: 'Blue', color: '#3b82f6' },
    { id: 'purple', label: 'Purple', color: '#a855f7' },
    { id: 'green', label: 'Green', color: '#22c55e' },
    { id: 'orange', label: 'Orange', color: '#f97316' },
];



export function AppearanceSection() {
    const { t } = useTranslation();
    const theme = usePreferencesStore(state => state.theme);
    const setTheme = usePreferencesStore(state => state.setTheme);
    const accentColor = usePreferencesStore(state => state.accentColor);
    const setAccentColor = usePreferencesStore(state => state.setAccentColor);
    const { isSpatialAudio, setSpatialAudio } = useFlowStore();
    const { presets: borderPresets, activePresetId: activeBorderPreset, setPreset: setBorderPreset } = useThemeColorStore();

    return (
        <div className="space-y-6">

            {/* Core Themes */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-1">{t('settings.appearance.theme.title')}</h4>
                <p className="text-xs text-muted-foreground mb-6">{t('settings.appearance.theme.description')}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                                <span className="text-xs font-medium">{t(`settings.appearance.theme.${tKey[themeItem.id] || themeItem.id}`, themeItem.label)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>


            {/* Ambient Border Color */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-1">Ambient Border</h4>
                <p className="text-xs text-muted-foreground mb-6">Choose the glow color for the ambient border around the window.</p>

                <div className="flex flex-wrap gap-4 justify-center">
                    {borderPresets.map(preset => {
                        const isSelected = activeBorderPreset === preset.id;
                        const swatchColor = glowColor(preset, 0.8);
                        return (
                            <button
                                key={preset.id}
                                onClick={() => setBorderPreset(preset.id)}
                                className="group flex flex-col items-center gap-2"
                            >
                                <div
                                    className={`w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center ${isSelected
                                        ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110'
                                        : 'hover:scale-110 hover:shadow-lg'
                                        }`}
                                    style={{
                                        background: `radial-gradient(circle, ${swatchColor}, ${preset.innerFrame})`,
                                        boxShadow: isSelected ? `0 0 16px ${swatchColor}` : 'none',
                                    }}
                                >
                                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                                </div>
                                <span className={`text-[10px] font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {preset.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Accent Color */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-1">Accent Color</h4>
                <p className="text-xs text-muted-foreground mb-6">Choose the highlight color used across buttons, toggles, and focus rings.</p>

                <div className="grid grid-cols-4 gap-3">
                    {accentOptions.map(option => {
                        const isSelected = accentColor === option.id;
                        return (
                            <button
                                key={option.id}
                                onClick={() => setAccentColor(option.id as any)}
                                className={`h-10 rounded-lg border transition-all flex items-center justify-center relative ${isSelected
                                    ? 'border-foreground ring-2 ring-foreground/20'
                                    : 'border-transparent hover:border-border'
                                    }`}
                                style={{ backgroundColor: option.color }}
                            >
                                {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sound */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">Interface Sounds</h4>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm text-foreground font-medium">Spatial Audio</div>
                        <div className="text-xs text-muted-foreground mt-1">Enable 3D spatial sound effects for interactions.</div>
                    </div>
                    <button
                        onClick={() => setSpatialAudio(!isSpatialAudio)}
                        className={`transition-colors ${isSpatialAudio ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {isSpatialAudio ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
                    </button>
                </div>
            </div>



        </div>
    );
}
