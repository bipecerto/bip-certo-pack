import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { subscribeRealtime, unsubscribeAll } from '../lib/realtime';
import { setCache, CACHE_KEYS } from '../lib/cache';

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
    packagesTick: number; // incrementa ao receber realtime pkg update
    scansTick: number;
    importsTick: number;
    refreshProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [packagesTick, setPackagesTick] = useState(0);
    const [scansTick, setScansTick] = useState(0);
    const [importsTick, setImportsTick] = useState(0);

    const refreshProfile = useCallback(async () => {
        if (!user) { setProfile(null); setCompany(null); return; }
        try {
            const db = supabase();
            const { data: profData, error: profErr } = await db
                .from('profiles')
                .select('id, company_id, name, role')
                .eq('id', user.id)
                .single();

            if (profErr || !profData) throw profErr;
            setProfile(profData);

            const { data: compData } = await db
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

    // Subscrição Realtime quando tiver company
    useEffect(() => {
        if (!profile?.company_id) return;
        const cid = profile.company_id;

        subscribeRealtime('packages', cid, (payload) => {
            setPackagesTick((t) => t + 1);
            // Atualizar cache de packages
            setCache(CACHE_KEYS.PACKAGES, payload, 5 * 60 * 1000);
        });

        subscribeRealtime('scans', cid, () => {
            setScansTick((t) => t + 1);
        });

        subscribeRealtime('imports', cid, () => {
            setImportsTick((t) => t + 1);
        });

        // Monitor de conectividade
        const onOnline = () => setIsOffline(false);
        const onOffline = () => setIsOffline(true);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            unsubscribeAll();
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [profile?.company_id]);

    return (
        <AppContext.Provider value={{ profile, company, isOffline, packagesTick, scansTick, importsTick, refreshProfile }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
    return ctx;
}
