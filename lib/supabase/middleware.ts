// Used from middleware.ts to refresh the auth session on every request
// and propagate Set-Cookie headers back to the browser.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  response.headers.set('x-pathname', request.nextUrl.pathname);

  const url = request.nextUrl.clone();
  const protectedPrefixes = ['/dashboard', '/sites', '/campaigns', '/alerts', '/settings'];
  const isProtected = protectedPrefixes.some((p) => url.pathname.startsWith(p));
  const isAuthRoute = url.pathname === '/login' || url.pathname.startsWith('/login/');

  if (!user && isProtected) {
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    url.pathname = '/dashboard';
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  return response;
}
