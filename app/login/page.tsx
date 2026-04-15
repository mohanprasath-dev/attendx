'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-300">AttendX</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Use your Google account to access the organizer dashboard.
        </p>
        {error ? (
          <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        <Button className="mt-8 w-full" onClick={handleGoogleSignIn} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </Button>
      </div>
    </main>
  );
}