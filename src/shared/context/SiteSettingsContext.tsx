import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SiteSettings } from '../types/types';

interface SiteSettingsContextType {
    settings: SiteSettings | null;
    loading: boolean;
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
    settings: null,
    loading: true,
});

export const useSiteSettings = () => useContext(SiteSettingsContext);

// ponytail: 8s timeout — if Firestore is unreachable (network issue, rules, wrong DB),
// stop blocking the UI and render the app with defaults. Prevents infinite loading screen.
const SETTINGS_TIMEOUT_MS = 8000;

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let settled = false;

        const markDone = () => {
            if (!settled) {
                settled = true;
                setLoading(false);
            }
        };

        const unsubscribe = onSnapshot(doc(db, 'settings', 'site'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as SiteSettings);
            }
            markDone();
        }, (error) => {
            console.error("Error fetching site settings:", error);
            markDone();
        });

        // Timeout fallback — if Firestore never responds, unblock the UI
        const timeoutId = setTimeout(() => {
            console.warn("SiteSettings: Firestore timed out after 8s, rendering with defaults");
            markDone();
        }, SETTINGS_TIMEOUT_MS);

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <SiteSettingsContext.Provider value={{ settings, loading }}>
            {children}
        </SiteSettingsContext.Provider>
    );
};
