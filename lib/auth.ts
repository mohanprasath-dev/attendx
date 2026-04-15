import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error('Firebase Auth is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables first.');
  }

  return signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error('Firebase Auth is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables first.');
  }

  return firebaseSignOut(auth);
}