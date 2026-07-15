// Supabase server client — uses anon key + user session cookies.
// Reads cookies but does NOT write them (read-only path).
// For session refresh / cookie writes use lib/supabase/middleware.ts from middleware.ts.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op: writes happen via middleware.ts during the request/response cycle.
        },
      },
    }
  );
}
