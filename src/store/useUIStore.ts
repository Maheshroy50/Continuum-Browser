import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PanelState {
    x: number;
    y: number;
    width: number;
    height: number;
    isCollapsed: boolean;
    setPosition: (x: number, y: number) => void;
    setSize: (width: number, height: number) => void;
    setCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<PanelState>()(
    persist(
        (set) => {
            const minWidth = 300;
            const minHeight = 280;
            const viewportMargin = 20;
            const dynamicMinWidth = Math.min(minWidth, Math.max(1, window.innerWidth - viewportMargin * 2));
            const dynamicMinHeight = Math.min(minHeight, Math.max(1, window.innerHeight - viewportMargin * 2));
            const maxWidth = Math.max(dynamicMinWidth, window.innerWidth - viewportMargin * 2);
            const maxHeight = Math.max(
                dynamicMinHeight,
                Math.min(window.innerHeight - viewportMargin * 2, Math.floor(window.innerHeight * 0.72))
            );
            const defaultWidth = Math.max(dynamicMinWidth, Math.min(420, maxWidth));
            const defaultHeight = Math.max(
                dynamicMinHeight,
                Math.min(520, maxHeight)
            );
            const defaultX = Math.max(viewportMargin, window.innerWidth - defaultWidth - viewportMargin);
            const defaultY = Math.max(
                viewportMargin,
                Math.min(60, window.innerHeight - defaultHeight - viewportMargin)
            );

            return {
                x: defaultX,
                y: defaultY,
                width: defaultWidth,
                height: defaultHeight,
                isCollapsed: false,
                setPosition: (x, y) => set({ x, y }),
                setSize: (width, height) => set({ width, height }),
                setCollapsed: (isCollapsed) => set({ isCollapsed }),
            };
        },
        {
            name: 'ui-storage-v3', // unique name (v3 resets stale geometry from earlier drag/resize bugs)
            storage: createJSONStorage(() => localStorage), // Explicitly use localStorage
            skipHydration: true, // IMPORTANT: Skip hydration on init to prevent main thread blocking
        }
    )
);
