import { useThemeColorStore, glowColor } from '../store/useThemeColorStore';

/**
 * ThemeColorPicker — A compact row of color swatches for picking the ambient border theme.
 * Appears inline in the tab strip or as a floating panel.
 */
export function ThemeColorPicker({ onClose }: { onClose: () => void }) {
    const { presets, activePresetId, setPreset } = useThemeColorStore();

    return (
        <div
            className="fixed z-[999] rounded-xl border border-white/10 shadow-2xl p-3"
            style={{
                top: '50px',
                right: '60px',
                background: 'hsl(220, 15%, 10%)',
                backdropFilter: 'blur(20px)',
                minWidth: '200px',
            }}
        >
            <div className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider mb-2 px-1">
                Ambient Theme
            </div>

            <div className="grid grid-cols-4 gap-2">
                {presets.map(preset => {
                    const isActive = preset.id === activePresetId;
                    const swatchColor = glowColor(preset, 0.8);

                    return (
                        <button
                            key={preset.id}
                            onClick={() => {
                                setPreset(preset.id);
                            }}
                            className={`
                                flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200
                                ${isActive
                                    ? 'bg-white/[0.08] ring-1 ring-white/20'
                                    : 'hover:bg-white/[0.04]'
                                }
                            `}
                            title={preset.name}
                        >
                            <div
                                className="w-7 h-7 rounded-full border border-white/10 transition-transform duration-200"
                                style={{
                                    background: `radial-gradient(circle, ${swatchColor}, ${preset.innerFrame})`,
                                    boxShadow: isActive ? `0 0 12px ${swatchColor}` : 'none',
                                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                                }}
                            />
                            <span className={`text-[9px] font-medium ${isActive ? 'text-foreground/70' : 'text-foreground/30'}`}>
                                {preset.name}
                            </span>
                        </button>
                    );
                })}
            </div>

            <button
                onClick={onClose}
                className="w-full mt-2 py-1.5 text-[10px] text-foreground/30 hover:text-foreground/60 transition-colors rounded-md hover:bg-white/[0.04]"
            >
                Close
            </button>
        </div>
    );
}
