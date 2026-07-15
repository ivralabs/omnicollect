import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ title, value, icon: Icon, subtitle, trend }: StatCardProps) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#14B8A6]" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn('text-xs mt-1 font-medium', trend.positive ? 'text-green-400' : 'text-red-400')}>
          {trend.value}
        </p>
      )}
    </div>
  );
}
