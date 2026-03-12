import { useSettingsStore } from '../../../store/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { Bot, Key, User, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AISection() {
    const { t } = useTranslation();
    const { openAIApiKey, googleApiKey, anthropicApiKey, githubApiKey, huggingFaceApiKey, grokApiKey, kimiApiKey, setOpenAIApiKey, setGoogleApiKey, setAnthropicApiKey, setGithubApiKey, setHuggingFaceApiKey, setGrokApiKey, setKimiApiKey } = useSettingsStore();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium tracking-tight mb-1">{t('settings.ai.title')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('settings.ai.description', 'Configure API keys to enable your Second Brain.')}
                </p>
            </div>

            {/* Agent Profile Section (Upgrade 7) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <div className="relative">
                        <User className="w-5 h-5 text-blue-500" />
                        <Sparkles className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
                    </div>
                    <h3>Agent Identity (Resume)</h3>
                </div>

                <div className="p-4 bg-card border border-border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-foreground">Personal Data</div>
                            <div className="text-xs text-muted-foreground">Upload a resume to auto-fill your profile. The Agent uses this to fill forms.</div>
                        </div>
                        <button
                            onClick={async () => {
                                // @ts-ignore
                                const file = await window.ipcRenderer.dialog.openFile();
                                if (file) {
                                    const provider = openAIApiKey ? 'openai' : (githubApiKey ? 'github' : 'openai');
                                    const key = openAIApiKey || githubApiKey || '';
                                    if (!key) {
                                        alert('Please configure an AI provider first.');
                                        return;
                                    }

                                    // Show loading state (could be improved with local state)
                                    const btn = document.getElementById('upload-btn');
                                    if (btn) btn.innerText = 'Parsing...';

                                    try {
                                        // @ts-ignore
                                        await window.ipcRenderer.agent.parseResume(file, provider, key);
                                        // Reload profile (could implement a hook for this, but simplistic approach for now)
                                        alert('Resume parsed and profile updated!');
                                    } catch (e) {
                                        alert('Failed to parse resume: ' + e);
                                    } finally {
                                        if (btn) btn.innerText = 'Upload Resume';
                                    }
                                }
                            }}
                            id="upload-btn"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                        >
                            Upload Resume
                        </button>
                    </div>

                    {/* Simple Profile Preview */}
                    <ProfilePreview />
                </div>
            </div>

            {/* OpenAI */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-green-500" />
                    <h3>{t('settings.ai.openai.title')}</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">{t('settings.ai.openai.keyLabel')}</div>
                        <div className="text-xs text-muted-foreground">{t('settings.ai.openai.description')}</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={openAIApiKey}
                            onChange={(e) => setOpenAIApiKey(e.target.value)}
                            placeholder={t('settings.ai.placeholder')}
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* GitHub Models */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                    <h3>GitHub Models</h3>
                </div>
                <div className="space-y-2 p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-foreground">GitHub Token</div>
                            <div className="text-xs text-muted-foreground">
                                Use free models like GPT-4o via GitHub.
                                <a href="https://github.com/marketplace/models" target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">
                                    Get a token
                                </a>
                            </div>
                        </div>
                        <div className="w-1/2 relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={githubApiKey}
                                onChange={(e) => setGithubApiKey(e.target.value)}
                                placeholder="ghp_..."
                                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Rate Limit Info (Collapsible) */}
                    <details className="text-xs text-muted-foreground border-t border-border pt-2 mt-2 group">
                        <summary className="cursor-pointer hover:text-foreground font-medium flex items-center gap-1 select-none">
                            <span>View Rate Limits & Quotas</span>
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-3 space-y-3 overflow-x-auto">
                            <p className="italic">
                                The playground and free API usage are rate limited. If you hit a limit, you must wait for it to reset.
                                Low, high, and embedding models have different limits. Check the model's info in GitHub Marketplace.
                            </p>

                            <table className="w-full text-left border-collapse border border-border/50 text-[10px]">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="p-1 border border-border/50">Tier / Model</th>
                                        <th className="p-1 border border-border/50">Metric</th>
                                        <th className="p-1 border border-border/50">Free</th>
                                        <th className="p-1 border border-border/50">Pro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="p-1 border border-border/50" rowSpan={4}>Low</td>
                                        <td className="p-1 border border-border/50">Req/min</td>
                                        <td className="p-1 border border-border/50">15</td>
                                        <td className="p-1 border border-border/50">15</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">Req/day</td>
                                        <td className="p-1 border border-border/50">150</td>
                                        <td className="p-1 border border-border/50">150</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">Tokens/req</td>
                                        <td className="p-1 border border-border/50">8k in/4k out</td>
                                        <td className="p-1 border border-border/50">8k in/4k out</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">Concurrent</td>
                                        <td className="p-1 border border-border/50">5</td>
                                        <td className="p-1 border border-border/50">5</td>
                                    </tr>

                                    <tr className="bg-muted/10">
                                        <td className="p-1 border border-border/50" rowSpan={4}>High</td>
                                        <td className="p-1 border border-border/50">Req/min</td>
                                        <td className="p-1 border border-border/50">10</td>
                                        <td className="p-1 border border-border/50">10</td>
                                    </tr>
                                    <tr className="bg-muted/10">
                                        <td className="p-1 border border-border/50">Req/day</td>
                                        <td className="p-1 border border-border/50">50</td>
                                        <td className="p-1 border border-border/50">50</td>
                                    </tr>
                                    <tr className="bg-muted/10">
                                        <td className="p-1 border border-border/50">Tokens/req</td>
                                        <td className="p-1 border border-border/50">8k in/4k out</td>
                                        <td className="p-1 border border-border/50">8k in/4k out</td>
                                    </tr>
                                    <tr className="bg-muted/10">
                                        <td className="p-1 border border-border/50">Concurrent</td>
                                        <td className="p-1 border border-border/50">2</td>
                                        <td className="p-1 border border-border/50">2</td>
                                    </tr>

                                    {/* Specific Models (Summary) */}
                                    <tr>
                                        <td className="p-1 border border-border/50" colSpan={4}><strong>Specific Models (Free)</strong></td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">DeepSeek-R1</td>
                                        <td className="p-1 border border-border/50">Req/min: 1</td>
                                        <td className="p-1 border border-border/50">Req/day: 8</td>
                                        <td className="p-1 border border-border/50">Tokens: 4k/4k</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">Grok-3</td>
                                        <td className="p-1 border border-border/50">Req/min: 1</td>
                                        <td className="p-1 border border-border/50">Req/day: 15</td>
                                        <td className="p-1 border border-border/50">Tokens: 4k/4k</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">Grok-3-Mini</td>
                                        <td className="p-1 border border-border/50">Req/min: 2</td>
                                        <td className="p-1 border border-border/50">Req/day: 30</td>
                                        <td className="p-1 border border-border/50">Tokens: 4k/8k</td>
                                    </tr>
                                    <tr>
                                        <td className="p-1 border border-border/50">OpenAI o1-preview</td>
                                        <td className="p-1 border border-border/50">Req/min: N/A</td>
                                        <td className="p-1 border border-border/50">Req/day: N/A</td>
                                        <td className="p-1 border border-border/50">Pro: 8/day</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="text-[9px] opacity-70 mt-1">
                                * Limits subject to change. See GitHub Marketplace for live data.
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            {/* Google Gemini */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-blue-500" />
                    <h3>{t('settings.ai.gemini.title')}</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">{t('settings.ai.gemini.keyLabel')}</div>
                        <div className="text-xs text-muted-foreground">{t('settings.ai.gemini.description')}</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={googleApiKey}
                            onChange={(e) => setGoogleApiKey(e.target.value)}
                            placeholder={t('settings.ai.placeholder')}
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* Anthropic Claude */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                    <Bot className="w-5 h-5 text-purple-500" />
                    <h3>{t('settings.ai.anthropic.title')}</h3>
                </div>
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                    <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-foreground">{t('settings.ai.anthropic.keyLabel')}</div>
                        <div className="text-xs text-muted-foreground">{t('settings.ai.anthropic.description')}</div>
                    </div>
                    <div className="w-1/2 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={anthropicApiKey}
                            onChange={(e) => setAnthropicApiKey(e.target.value)}
                            placeholder={t('settings.ai.placeholder')}
                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
                {/* Hugging Face */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                        <Bot className="w-5 h-5 text-yellow-500" />
                        <h3>Hugging Face</h3>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                        <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-foreground">API Token</div>
                            <div className="text-xs text-muted-foreground">Access open models (Llama 3, Mistral, etc).</div>
                        </div>
                        <div className="w-1/2 relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={huggingFaceApiKey}
                                onChange={(e) => setHuggingFaceApiKey(e.target.value)}
                                placeholder="hf_..."
                                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Grok (xAI) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                        <Bot className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                        <h3>Grok (xAI)</h3>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                        <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-foreground">API Key</div>
                            <div className="text-xs text-muted-foreground">Power Level 3 Agent with Grok Beta.</div>
                        </div>
                        <div className="w-1/2 relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={grokApiKey}
                                onChange={(e) => setGrokApiKey(e.target.value)}
                                placeholder="xai-..."
                                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Kimi (Moonshot) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                        <Bot className="w-5 h-5 text-blue-600" />
                        <h3>Kimi (Moonshot AI)</h3>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                        <div className="flex-1 pr-4">
                            <div className="text-sm font-medium text-foreground">API Key</div>
                            <div className="text-xs text-muted-foreground">Moonshot v1 models (8k/32k/128k).</div>
                        </div>
                        <div className="w-1/2 relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={kimiApiKey}
                                onChange={(e) => setKimiApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfilePreview() {
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        // Poll for profile updates (simple way)
        const fetchProfile = async () => {
            try {
                // @ts-ignore
                const p = await window.ipcRenderer.agent.getUserProfile();
                setProfile(p);
            } catch (e) {
                console.error('Failed to load profile', e);
            }
        };

        fetchProfile();
        // Set up interval to check for updates after parsing
        const interval = setInterval(fetchProfile, 2000);
        return () => clearInterval(interval);
    }, []);

    if (!profile || (!profile.name && !profile.email)) {
        return (
            <div className="text-xs text-muted-foreground italic border-t border-dashed border-border pt-2">
                No profile data found. Upload a resume to get started.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 mt-2">
            <div>
                <label className="text-xs text-muted-foreground block mb-1">Full Name</label>
                <input
                    type="text"
                    value={profile.name || ''}
                    readOnly
                    className="w-full bg-background/50 border border-input rounded px-2 py-1 text-xs"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground block mb-1">Email</label>
                <input
                    type="text"
                    value={profile.email || ''}
                    readOnly
                    className="w-full bg-background/50 border border-input rounded px-2 py-1 text-xs"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                <input
                    type="text"
                    value={profile.phone || ''}
                    readOnly
                    className="w-full bg-background/50 border border-input rounded px-2 py-1 text-xs"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground block mb-1">LinkedIn</label>
                <input
                    type="text"
                    value={profile.linkedInUrl || ''}
                    readOnly
                    className="w-full bg-background/50 border border-input rounded px-2 py-1 text-xs"
                />
            </div>
            <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Resume Summary</label>
                <textarea
                    value={profile.resumeText || ''}
                    readOnly
                    rows={3}
                    className="w-full bg-background/50 border border-input rounded px-2 py-1 text-xs resize-none"
                />
            </div>
        </div>
    );
}
