import { useSettingsStore } from '../../../store/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { Bot, Key } from 'lucide-react';

export function AISection() {
    const { t } = useTranslation();
    const { openAIApiKey, googleApiKey, anthropicApiKey, setOpenAIApiKey, setGoogleApiKey, setAnthropicApiKey } = useSettingsStore();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium tracking-tight mb-1">{t('settings.ai.title', 'AI & Intelligence')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('settings.ai.description', 'Configure API keys to enable your Second Brain.')}
                </p>
            </div>

            {/* OpenAI */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-green-500" />
                    <h3>OpenAI</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">API Key</div>
                        <div className="text-xs text-muted-foreground">Required for ChatGPT models (GPT-4o, etc).</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={openAIApiKey}
                            onChange={(e) => setOpenAIApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* Google Gemini */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-blue-500" />
                    <h3>Google Gemini</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">API Key</div>
                        <div className="text-xs text-muted-foreground">Required for Gemini Pro models.</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={googleApiKey}
                            onChange={(e) => setGoogleApiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* Anthropic Claude */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-purple-500" />
                    <h3>Anthropic Claude</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">API Key</div>
                        <div className="text-xs text-muted-foreground">Required for Claude 3.5 Sonnet & Opus.</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={anthropicApiKey}
                            onChange={(e) => setAnthropicApiKey(e.target.value)}
                            placeholder="sk-ant-..."
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
