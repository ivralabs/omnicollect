'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Network,
  Car,
  Route,
  TrendingUp,
  BarChart2,
  Plus,
  Loader2,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  unique_vehicles: number;
  cross_site_travellers: number;
  network_reach_rate: number;
  avg_frequency: number;
}

interface OverlapEntry {
  site_a_id: string;
  site_a_name: string;
  site_b_id: string;
  site_b_name: string;
  shared_vehicles: number;
}

interface FrequencyEntry {
  times_seen: number;
  vehicle_count: number;
}

interface JourneyEntry {
  from_site: string;
  to_site: string;
  shared_vehicles: number;
  pct_of_from: number;
}

interface SiteReachEntry {
  site_id: string;
  site_name: string;
  unique_vehicles: number;
  cross_site_pct: number;
  avg_frequency: number;
}

interface NetworkStats {
  summary: Summary;
  overlap_matrix: OverlapEntry[];
  frequency_distribution: FrequencyEntry[];
  top_journeys: JourneyEntry[];
  site_reach: SiteReachEntry[];
}

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-ZA');
}

function tealOpacity(value: number, max: number) {
  if (max === 0) return 'rgba(20,184,166,0.05)';
  const ratio = Math.min(value / max, 1);
  return `rgba(20,184,166,${0.05 + ratio * 0.75})`;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Network className="w-7 h-7 text-white/20" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">No cross-site data yet</h3>
      <p className="text-sm text-white/40 max-w-sm mb-6">
        Start collecting data by registering sites and connecting your edge devices
      </p>
      <Link
        href="/sites/new"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14B8A6] text-white text-sm font-medium hover:bg-[#0d9488] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add your first site
      </Link>
    </div>
  );
}

// ── Overlap Matrix ────────────────────────────────────────────────────────────
function OverlapMatrix({ matrix }: { matrix: OverlapEntry[] }) {
  const siteIds = Array.from(
    new Set(matrix.flatMap((e) => [e.site_a_id, e.site_b_id]))
  );
  const siteNames: Record<string, string> = {};
  for (const e of matrix) {
    siteNames[e.site_a_id] = e.site_a_name;
    siteNames[e.site_b_id] = e.site_b_name;
  }

  const maxShared = Math.max(...matrix.map((e) => e.shared_vehicles), 0);
  const lookup: Record<string, number> = {};
  for (const e of matrix) lookup[`${e.site_a_id}::${e.site_b_id}`] = e.shared_vehicles;

  if (siteIds.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/30">
        No data yet — connect your first edge device
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-white/30 font-normal w-32"></th>
            {siteIds.map((id) => (
              <th key={id} className="px-3 py-2 text-white/50 font-medium text-center max-w-[80px] truncate">
                {siteNames[id]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {siteIds.map((rowId) => (
            <tr key={rowId}>
              <td className="px-3 py-2 text-white/50 font-medium truncate max-w-[128px]">
                {siteNames[rowId]}
              </td>
              {siteIds.map((colId) => {
                const v = lookup[`${rowId}::${colId}`] ?? 0;
                const isDiag = rowId === colId;
                return (
                  <td
                    key={colId}
                    className="px-3 py-2 text-center text-white font-medium rounded"
                    style={{
                      backgroundColor: isDiag ? 'rgba(255,255,255,0.04)' : tealOpacity(v, maxShared),
                    }}
                    title={
                      isDiag
                        ? `${siteNames[rowId]}`
                        : `${v.toLocaleString('en-ZA')} vehicles seen at both ${siteNames[rowId]} and ${siteNames[colId]}`
                    }
                  >
                    {isDiag ? '—' : v > 0 ? fmt(v) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Frequency Chart ───────────────────────────────────────────────────────────
function FrequencyChart({ data }: { data: FrequencyEntry[] }) {
  const hasData = data.some((d) => d.vehicle_count > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <BarChart2 className="w-8 h-8 text-white/10 mb-2" />
        <p className="text-sm text-white/30">No data yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.times_seen === 5 ? '5+' : String(d.times_seen),
    vehicles: d.vehicle_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.2)"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
          label={{ value: 'Sites visited', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.2)"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
          tickFormatter={(v: number) => fmt(v)}
        />
        <Tooltip
          contentStyle={{ background: '#0d1614', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          itemStyle={{ color: '#14B8A6' }}
          formatter={(v: unknown) => [fmt(Number(v)), 'Vehicles']}
        />
        <Bar dataKey="vehicles" fill="#14B8A6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  days?: number;
  dateFrom?: string;
  dateTo?: string;
}

export default function NetworkClient({ days = 30, dateFrom, dateTo }: Props) {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url =
          dateFrom && dateTo
            ? `/api/network/stats?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`
            : `/api/network/stats?days=${days}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as NetworkStats;
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [days, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-[#14B8A6] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-sm text-red-400">
        Failed to load network data: {error}
      </div>
    );
  }

  if (!stats) return null;

  const { summary, overlap_matrix, frequency_distribution, top_journeys, site_reach } = stats;
  const isEmpty = summary.unique_vehicles === 0;

  if (isEmpty) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Unique Vehicles (30d)"
          value={fmt(summary.unique_vehicles)}
          icon={Car}
        />
        <StatCard
          title="Cross-Site Travellers"
          value={fmt(summary.cross_site_travellers)}
          icon={Route}
          subtitle="seen at 2+ sites"
        />
        <StatCard
          title="Network Reach Rate"
          value={`${summary.network_reach_rate}%`}
          icon={TrendingUp}
          subtitle="of unique vehicles"
        />
        <StatCard
          title="Avg Frequency"
          value={summary.avg_frequency.toFixed(1)}
          icon={BarChart2}
          subtitle="sites per vehicle"
        />
      </div>

      {/* Overlap Matrix */}
      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-medium text-white">Cross-Site Audience Overlap</h2>
          <p className="text-xs text-white/40 mt-0.5">Vehicles seen at both sites in the last 30 days</p>
        </div>
        <div className="p-4">
          <OverlapMatrix matrix={overlap_matrix} />
        </div>
      </div>

      {/* Frequency + Top Journeys side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Frequency Distribution */}
        <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-medium text-white">Frequency Distribution</h2>
            <p className="text-xs text-white/40 mt-0.5">How many sites each vehicle visited</p>
          </div>
          <div className="p-4">
            <FrequencyChart data={frequency_distribution} />
          </div>
        </div>

        {/* Top Journey Paths */}
        <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-medium text-white">Top Journey Paths</h2>
            <p className="text-xs text-white/40 mt-0.5">Most common site-to-site vehicle flows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">From</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">To</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Shared</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">% of From</th>
                </tr>
              </thead>
              <tbody>
                {top_journeys.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-white/30">No journey data yet</td>
                  </tr>
                ) : (
                  top_journeys.map((j, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-5 py-3 text-white/80 truncate max-w-[120px]">{j.from_site}</td>
                      <td className="px-5 py-3 text-white/80 truncate max-w-[120px]">{j.to_site}</td>
                      <td className="px-5 py-3 text-right text-[#14B8A6] font-medium">{fmt(j.shared_vehicles)}</td>
                      <td className="px-5 py-3 text-right text-white/60">{j.pct_of_from}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Site Reach Table */}
      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-medium text-white">Site Reach Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Site</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Unique Vehicles</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Cross-Site %</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Avg Frequency</th>
              </tr>
            </thead>
            <tbody>
              {site_reach.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-white/30">No data</td>
                </tr>
              ) : (
                site_reach.map((s) => (
                  <tr key={s.site_id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{s.site_name}</td>
                    <td className="px-5 py-3 text-right text-white/80">{fmt(s.unique_vehicles)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[#14B8A6] font-medium">{s.cross_site_pct}%</span>
                    </td>
                    <td className="px-5 py-3 text-right text-white/60">{s.avg_frequency.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
