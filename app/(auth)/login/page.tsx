import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OC</span>
            </div>
            <span className="text-xl font-semibold text-white">OmniCollect</span>
          </div>
          <p className="text-sm text-white/50">Verified audience intelligence</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-lg font-semibold text-white mb-1">Sign in to your account</h1>
          <p className="text-sm text-white/50 mb-6">
            Sign in to your OmniCollect account.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
