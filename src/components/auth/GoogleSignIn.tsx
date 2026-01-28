import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// Google Sign-In is not supported in Electron embedded browsers
// import { invoke } from '@tauri-apps/api/core';

export function GoogleSignIn() {
    const { t } = useTranslation();
    const [user, setUser] = useState<{ email: string, name: string, picture: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = () => {
        const storedUser = localStorage.getItem('google_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    };

    const handleSignIn = async () => {
        setLoading(true);
        console.log('Frontend: handleSignIn clicked');
        // alert('Starting sign in...'); // Temporary debug alert
        try {
            console.log('Frontend: Calling ipcRenderer.google.signIn()');
            const profile = await window.ipcRenderer.google.signIn();
            console.log('Frontend: Sign in result:', profile);
            if (profile) {
                setUser(profile);
                localStorage.setItem('google_user', JSON.stringify(profile));
            }
        } catch (e) {
            console.error('Sign in failed:', e);
            alert('Sign in failed: ' + (e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = () => {
        localStorage.removeItem('google_user');
        setUser(null);
    };

    if (user) {
        return (
            <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg group text-xs border border-border/50">
                <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-border"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                    }}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                </div>
                <button
                    onClick={handleSignOut}
                    className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title={t('auth.signOut', 'Sign Out')}
                >
                    <LogOut className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-background hover:bg-muted text-foreground rounded-lg transition-all border border-border hover:border-primary/30 group disabled:opacity-50"
        >
            {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
            ) : (
                <div className="w-4 h-4 bg-foreground rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-background">G</span>
                </div>
            )}
            <span className="text-xs font-medium">
                {t('auth.signInWithGoogle', 'Sign in with Google')}
            </span>
        </button>
    );
}
