declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

/**
 * Executes Google reCAPTCHA Enterprise invisible token generation.
 * 
 * @param action The user action identifier (e.g. 'LOGIN', 'REGISTER')
 * @returns A Promise resolving to the token string or null
 */
export async function executeRecaptchaEnterprise(action: string = 'SUBMIT'): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) return null;

  if (typeof window === 'undefined') return null;

  // Check if enterprise script is available
  if (!window.grecaptcha?.enterprise) {
    console.info('reCAPTCHA Enterprise script is initializing...');
    return null;
  }

  return new Promise((resolve) => {
    try {
      window.grecaptcha!.enterprise!.ready(async () => {
        try {
          const token = await window.grecaptcha!.enterprise!.execute(siteKey, { action });
          resolve(token);
        } catch (err) {
          console.warn('reCAPTCHA enterprise token execution warning:', err);
          resolve(null);
        }
      });
    } catch (err) {
      console.warn('reCAPTCHA enterprise ready callback error:', err);
      resolve(null);
    }
  });
}
