'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogIn, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'idle' | 'loading' | 'error';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setStep('loading');
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setStep('error');
      setError(authError.message);
    } else {
      // Hard redirect so session cookie propagates correctly
      window.location.href = '/dashboard';
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mediacompany.co.za"
          className={cn(
            'w-full px-3.5 py-2.5 rounded-lg bg-white/5 border text-white placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'transition-colors text-sm',
            error ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
          )}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={cn(
            'w-full px-3.5 py-2.5 rounded-lg bg-white/5 border text-white placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'transition-colors text-sm',
            error ? 'border-red-500/60' : 'border-white/10 hover:border-white/20',
          )}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={step === 'loading' || !email.trim() || !password.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
          'bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm',
          'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {step === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
        ) : (
          <><LogIn className="w-4 h-4" /> Sign in</>
        )}
      </button>
    </form>
  );
}
