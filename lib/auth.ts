// Server-side auth helpers. Use in API routes + Server Components.
import { createClient } from './supabase/server';
import { createServiceClient } from './supabase/service';

export type AuthedUser = {
  id: string;
  email: string | null;
};

/** Throws if no user. Reads the session via cookies. */
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return { id: user.id, email: user.email ?? null };
}

/** Returns user or null. */
export async function getUser(): Promise<AuthedUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/**
 * Find the user's current tenant (first row in tenant_users for that user).
 * Returns { tenant_id, role } or null if user has no tenant yet.
 * Uses service client to bypass RLS during bootstrap.
 */
export async function getUserTenant(userId: string): Promise<{ tenant_id: string; role: string } | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { tenant_id: data.tenant_id, role: data.role as string };
}

/** Require both a user AND tenant membership. Throws otherwise. */
export async function requireTenant(): Promise<{ user: AuthedUser; tenant_id: string; role: string }> {
  const user = await requireUser();
  const t = await getUserTenant(user.id);
  if (!t) throw new Error('NO_TENANT');
  return { user, ...t };
}
