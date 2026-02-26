import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Profile {
    id: string;
    company_id: string;
    name: string | null;
    role: string;
}

interface Company {
    id: string;
    name: string;
}

interface AppContextType {
    profile: Profile | null;
    company: Company | null;
    isOffline: boolean;
    refreshProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [isOffline, setIsOffline] = useState(false);

    const refreshProfile = useCallback(async () => {
        if (!user) { setProfile(null); setCompany(null); return; }
        try {
            const { data: profData, error: profErr } = await supabase
                .from('profiles')
                .select('id, company_id, name, role')
                .eq('id', user.id)
                .single();

            if (profErr || !profData) throw profErr;
            setProfile(profData as Profile);

            const { data: compData } = await supabase
                .from('companies')
                .select('id, name')
                .eq('id', profData.company_id)
                .single();

            if (compData) setCompany(compData);
            setIsOffline(false);
        } catch {
            setIsOffline(true);
        }
    }, [user]);

    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    useEffect(() => {
        const onOnline = () => setIsOffline(false);
        const onOffline = () => setIsOffline(true);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    return (
        <AppContext.Provider value={{ profile, company, isOffline, refreshProfile }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
    return ctx;
}
