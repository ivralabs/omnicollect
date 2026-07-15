'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartPoint {
  hour: string;
  vehicles: number;
}

function formatHour(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:00`;
}

export default function NetworkChart() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/network/chart?hours=24');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: ChartPoint[] };
        setData(json.data ?? []);
      } catch {
        // silently fail — empty state handles it
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const chartData = data.map((d) => ({
    hour: formatHour(d.hour),
    vehicles: d.vehicles,
  }));

  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Network Vehicle Count — Today</h3>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse bg-white/5 rounded-lg" />
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-white/30">
          No data yet — connect your first edge device
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="hour"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#0d1614',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              />
              <Area
                type="monotone"
                dataKey="vehicles"
                stroke="#14B8A6"
                strokeWidth={2}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#14B8A6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
