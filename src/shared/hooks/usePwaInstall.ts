import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = 'nexorg_pwa_dismissed_until';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // Check iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check snooze in localStorage
    try {
      const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        setIsDismissed(true);
      }
    } catch {
      // ignore in private mode
    }

    // Capture beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.removeItem(DISMISSED_KEY);
      } catch {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> => {
    if (isInstalled) return 'unavailable';

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        return choice.outcome;
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        return 'unavailable';
      }
    }

    setShowIOSModal(true);
    return isIOS ? 'ios' : 'unavailable';
  }, [deferredPrompt, isInstalled, isIOS]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
  }, []);

  const openIOSModal = useCallback(() => setShowIOSModal(true), []);
  const closeIOSModal = useCallback(() => setShowIOSModal(false), []);

  return {
    isInstallable: !isInstalled && (Boolean(deferredPrompt) || isIOS || !isDismissed),
    canPromptDirectly: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isDismissed,
    showIOSModal,
    promptInstall,
    dismissPrompt,
    openIOSModal,
    closeIOSModal,
  };
}

export default usePwaInstall;
