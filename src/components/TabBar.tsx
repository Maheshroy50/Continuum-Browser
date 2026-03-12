import { X, Plus, Globe } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';
import { useTranslation } from 'react-i18next';

export function TabBar() {
    const { t } = useTranslation();
    const {
        flows,
        activeFlowId,
        activePageId,
        setActivePage,
        removePage,
        // createFlow
    } = useFlowStore();

    const activeFlow = flows.find(f => f.id === activeFlowId);

    if (!activeFlow) return null;

    return (
        <div className="h-[38px] flex items-end bg-[#0F1115] px-2 select-none pt-1.5 gap-1.5" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {/* Window Controls Spacer (Mac) */}
            <div className="w-[72px] shrink-0" />

            <div className="flex-1 flex items-end h-full overflow-x-auto no-scrollbar gap-1.5 px-0" onWheel={(e) => e.currentTarget.scrollLeft += e.deltaY}>
                {activeFlow.pages.map(page => {
                    const isActive = activePageId === page.id;
                    return (
                        <div
                            key={page.id}
                            onClick={() => setActivePage(page.id)}
                            className={`
                                group relative flex items-center h-[32px] px-3 rounded-t-lg min-w-[140px] max-w-[220px] cursor-pointer transition-all duration-150 ease-out border-t border-x
                                ${isActive
                                    ? 'bg-[#1E2024] text-white border-white/5 border-b-0 shadow-sm z-10'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-white/5 hover:text-zinc-300'
                                }
                            `}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        >
                            {/* Favicon */}
                            <div className={`w-4 h-4 mr-2 flex items-center justify-center shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}>
                                {page.favicon ? (
                                    <img src={page.favicon} className="w-3.5 h-3.5 rounded-sm" alt="" />
                                ) : (
                                    <Globe className="w-3.5 h-3.5" />
                                )}
                            </div>

                            {/* Title */}
                            <span className="text-[12px] font-medium truncate flex-1 leading-none pb-px select-none">
                                {(() => {
                                    try {
                                        const title = page.title;
                                        if (typeof title === 'string') return title;
                                        if (!title) return String(t('common.untitled', 'Untitled'));
                                        return String(title);
                                    } catch {
                                        return String(t('common.untitled', 'Untitled'));
                                    }
                                })()}
                            </span>

                            {/* Close Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removePage(activeFlow.id, page.id);
                                }}
                                className={`
                                    ml-1 p-0.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100
                                    ${isActive ? 'opacity-100' : ''}
                                `}
                            >
                                <X className="w-3 h-3" />
                            </button>

                            {/* Active Visual Connection (optional nice touch) */}
                            {isActive && (
                                <div className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-[#1E2024] z-20" />
                            )}
                        </div>
                    );
                })}

                {/* New Tab Button */}
                <button
                    onClick={() => {
                        const input = document.querySelector('.app-omnibox-input') as HTMLInputElement;
                        if (input) input.focus();
                    }}
                    className="h-[28px] w-[28px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors shrink-0 mb-0.5"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
