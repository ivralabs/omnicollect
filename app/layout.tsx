import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'OmniCollect',
    template: '%s · OmniCollect',
  },
  description: 'Verified audience intelligence for outdoor media.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0f0e] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
