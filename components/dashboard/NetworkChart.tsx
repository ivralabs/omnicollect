'use client';

// TODO: Replace placeholder data with real API call to fetch 24h network aggregate
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// TODO: Replace with real 24-hour network aggregate from DB
const PLACEHOLDER_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  vehicles: Math.floor(Math.sin(i / 3) * 300 + 500 + i * 10),
}));

export default function NetworkChart() {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Network Vehicle Count — Today</h3>
        <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full">
          Placeholder data
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={PLACEHOLDER_DATA} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
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
            <Line
              type="monotone"
              dataKey="vehicles"
              stroke="#14B8A6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#14B8A6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
