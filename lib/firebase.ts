import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0
);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

function getFirebaseApp() {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  return app;
}

function createFirebaseAuth(firebaseApp: FirebaseApp) {
  try {
    return getAuth(firebaseApp);
  } catch {
    return initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence
    });
  }
}

export function getFirebaseDb() {
  if (!db) {
    const firebaseApp = getFirebaseApp();

    if (!firebaseApp) {
      return null;
    }

    db = getFirestore(firebaseApp);
  }

  return db;
}

export function getFirebaseAuth() {
  if (!hasFirebaseConfig || typeof window === 'undefined') {
    return null;
  }

  if (!auth) {
    const firebaseApp = getFirebaseApp();

    if (!firebaseApp) {
      return null;
    }

    auth = createFirebaseAuth(firebaseApp);
  }

  return auth;
}

export { app, hasFirebaseConfig };
export default app;
