'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  alertId: string;
}

export default function ResolveAlertButton({ alertId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleResolve() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from('site_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId);
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CheckCircle className="w-3.5 h-3.5" />
      )}
      Resolve
    </button>
  );
}
