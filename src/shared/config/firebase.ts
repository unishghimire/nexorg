import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableNetwork, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfigJson from '../../../firebase-applet-config.json';

// Support Vercel & CI environment variables with seamless fallback to config JSON
const firebaseConfig = {
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
    authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
    projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || (import.meta as any).env?.FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
    storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || (import.meta as any).env?.FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
    measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
    databaseURL: (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || firebaseConfigJson.databaseURL || `https://${firebaseConfigJson.projectId || 'nexplayorg-app'}-default-rtdb.firebaseio.com`,
};

// Initialize Firebase once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Initialize Realtime Database (RTDB) Singleton
const rtdbUrl = (firebaseConfig as any).databaseURL || `https://${(firebaseConfig as any).projectId || 'nexplayorg-app'}-default-rtdb.firebaseio.com`;
export const rtdb: Database = getDatabase(app, rtdbUrl);

// ponytail: explicitly set browserLocalPersistence (the default, but setting it
// explicitly ensures the auth state survives popup/redirect round-trips and
// browser restarts — critical for signInWithRedirect fallback on mobile).
setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.warn('Failed to set auth persistence:', e);
});

// ponytail: use initializeFirestore with offline persistence when available.
// Ceiling: persistentLocalCache uses IndexedDB — not available in SSR/Node.
// Upgrade: none needed, guard handles it.
let db;
if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
    try {
        const customDbId = (firebaseConfig as any).firestoreDatabaseId;
        db = customDbId
            ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, customDbId)
            : initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    } catch {
        db = (firebaseConfig as any).firestoreDatabaseId ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : getFirestore(app);
    }
} else {
    db = (firebaseConfig as any).firestoreDatabaseId ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) : getFirestore(app);
}
export { db };

export let analytics: any = null;
if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });

    // Reconnect Firestore when network comes back online
    window.addEventListener('online', () => {
        enableNetwork(db).catch((e) => console.error('Failed to re-enable Firestore network:', e));
    });
}

// Error Handling System
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  
  const errorMessage = JSON.stringify(errInfo);
  console.error('Firestore Error:', errorMessage);
  
  // Custom event for global UI error handling
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('app-error', { detail: errInfo }));
  }
  
  throw new Error(errorMessage);
}

// Network Management
export const reconnectFirestore = async () => {
    try {
        await enableNetwork(db);
    } catch (e) {
        console.error("Failed to re-enable network", e);
    }
};
