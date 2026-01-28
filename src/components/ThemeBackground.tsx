// import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../store/usePreferencesStore';

import americaBg from '../assets/themes/america-bg.png';

export function ThemeBackground() {
    const theme = usePreferencesStore(state => state.theme);
    // const [mounted, setMounted] = useState(false);

    // useEffect(() => {
    //     setMounted(true);
    // }, []);

    const getBackgroundImage = () => {
        switch (theme) {

            case 'america': return americaBg;
            default: return null;
        }
    };

    const bgImage = getBackgroundImage();

    if (!bgImage) return null;

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Background Image with Ken Burns Effect */}
            <div
                key={theme} // Re-animate on theme change
                className="absolute inset-0 animate-slow-zoom opacity-40 transition-opacity duration-1000"
            >
                <img
                    src={bgImage}
                    alt="Theme Background"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Vignette / Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
        </div>
    );
}
