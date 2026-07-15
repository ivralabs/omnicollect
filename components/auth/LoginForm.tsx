'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'idle' | 'loading' | 'sent' | 'error';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStep('loading');
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/login/confirm`,
      },
    });

    if (authError) {
      setStep('error');
      setError(authError.message);
    } else {
      setStep('sent');
    }
  }

  if (step === 'sent') {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-5 h-5 text-primary-400" />
        </div>
        <p className="text-white font-medium mb-1">Check your inbox</p>
        <p className="text-sm text-white/50">
          We sent a sign-in link to <strong className="text-white">{email}</strong>
        </p>
        <button
          className="mt-4 text-sm text-primary-400 hover:text-primary-300 transition-colors"
          onClick={() => { setStep('idle'); setEmail(''); }}
        >
          Use a different email
        </button>
      </div>
    );
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
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={step === 'loading' || !email.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
          'bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm',
          'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {step === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</>
        ) : (
          <><Mail className="w-4 h-4" /> Send magic link</>
        )}
      </button>
    </form>
  );
}
