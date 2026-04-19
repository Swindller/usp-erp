"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Wrench, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";

export interface MonthlyRevenue {
  month: string;
  invoiced: number;
  collected: number;
}

export interface TopModel {
  model: string;
  count: number;
}

export interface MaintenanceAlert {
  id: string;
  name: string;
  phone: string;
  lastService: string;
  daysSince: number;
}

interface Props {
  monthlyRevenue: MonthlyRevenue[];
  topModels: TopModel[];
  maintenanceAlerts: MaintenanceAlert[];
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6"];

function CustomTooltipRevenue({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </p>
      ))}
    </div>
  );
}

function CustomTooltipBar({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-red-500">{payload[0].value} arıza</p>
    </div>
  );
}

export function ServiceAnalyticsSection({ monthlyRevenue, topModels, maintenanceAlerts }: Props) {
  return (
    <div className="space-y-6">
      {/* Revenue Chart + Top Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Revenue Area Chart */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold">Son 6 Ay Servis Geliri</h2>
          </div>
          {monthlyRevenue.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Henüz servis faturası yok
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}k`}
                  width={46}
                />
                <Tooltip content={<CustomTooltipRevenue />} />
                <Area
                  type="monotone"
                  dataKey="invoiced"
                  name="Kesilen"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradInvoiced)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Tahsil"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#gradCollected)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-end">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Kesilen
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Tahsil
            </span>
          </div>
        </div>

        {/* Top 5 Faulty Models */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={18} className="text-red-500" />
            <h2 className="text-lg font-semibold">En Çok Arıza Yapan Modeller</h2>
          </div>
          {topModels.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Henüz servis kaydı yok
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={topModels}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="model"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<CustomTooltipBar />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {topModels.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Maintenance Alerts */}
      {maintenanceAlerts.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-900">Periyodik Bakım Gerekli</h2>
            <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {maintenanceAlerts.length} müşteri
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {maintenanceAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/admin/servis/yeni?customerId=${alert.id}`}
                className="bg-white rounded-xl border border-amber-200 px-4 py-3 hover:border-amber-400 hover:shadow-sm transition-all"
              >
                <p className="font-semibold text-sm text-gray-800">{alert.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{alert.phone}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Clock size={12} className="text-amber-500" />
                  <p className="text-xs text-amber-700 font-medium">
                    Son servis: {alert.lastService} ({alert.daysSince} gün önce)
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
