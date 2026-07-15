import { requireTenant } from '@/lib/auth';
import CreateSiteForm from './CreateSiteForm';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Add Site' };

export default async function NewSitePage() {
  await requireTenant();
  return <CreateSiteForm />;
}
