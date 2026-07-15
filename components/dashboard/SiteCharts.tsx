'use client';

// TODO: Replace placeholder data with real readings prop from Server Component
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HourlyReading {
  hour: string;
  vehicles: number;
}

interface VehicleClassData {
  name: string;
  value: number;
}

interface SiteChartsProps {
  hourlyData: HourlyReading[];
  vehicleClassData: VehicleClassData[];
}

const CLASS_COLORS = ['#14B8A6', '#0d9488', '#2dd4bf', '#5eead4', '#99f6e4', '#f0fdfa'];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0d1614',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
  },
  labelStyle: { color: 'rgba(255,255,255,0.5)' },
};

export default function SiteCharts({ hourlyData, vehicleClassData }: SiteChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Hourly vehicle count */}
      <div className="xl:col-span-2 bg-white/5 border border-white/8 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">Hourly Vehicle Count — Last 24h</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
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
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="vehicles" fill="#14B8A6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vehicle class breakdown */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-4">Vehicle Classes</h3>
        {vehicleClassData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vehicleClassData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {vehicleClassData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CLASS_COLORS[index % CLASS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-white/30 text-sm">No data yet</div>
        )}
      </div>
    </div>
  );
}
