import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServiceAnalyticsSection } from "@/components/dashboard/ServiceAnalyticsSection";
import type { MonthlyRevenue, TopModel, MaintenanceAlert } from "@/components/dashboard/ServiceAnalyticsSection";
import { Wrench, Banknote, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { InvoiceStatus, ServiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role ?? "";
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const [
    totalReports, activeReports, completedReports,
    totalCustomers,
    paidInvoices, pendingInvoices,
    serviceInvoicesRaw, topModelsRaw, maintenanceCustomersRaw,
    recentReports,
  ] = await Promise.all([
    prisma.serviceReport.count(),
    prisma.serviceReport.count({ where: { status: { notIn: [ServiceStatus.DELIVERED, ServiceStatus.CANCELLED] } } }),
    prisma.serviceReport.count({ where: { status: ServiceStatus.DELIVERED } }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.invoice.aggregate({ where: { status: InvoiceStatus.PAID }, _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] } }, _sum: { total: true } }),
    prisma.invoice.findMany({ where: { type: "SERVICE", createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true, total: true, paidAmount: true } }),
    prisma.serviceReport.groupBy({ by: ["deviceModel"], _count: { _all: true }, where: { deviceModel: { not: null } }, orderBy: { _count: { deviceModel: "desc" } }, take: 5 }),
    prisma.customer.findMany({
      where: { serviceReports: { some: {}, every: { createdAt: { lt: sixMonthsAgo } } } },
      include: { serviceReports: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      take: 9,
    }),
    prisma.serviceReport.findMany({
      include: {
        customer: { select: { type: true, firstName: true, lastName: true, companyName: true } },
        technician: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const monthlyMap = new Map<string, { invoiced: number; collected: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { invoiced: 0, collected: 0 });
  }
  for (const inv of serviceInvoicesRaw) {
    const key = new Date(inv.createdAt).toISOString().slice(0, 7);
    const entry = monthlyMap.get(key);
    if (entry) { entry.invoiced += parseFloat(String(inv.total ?? 0)); entry.collected += parseFloat(String(inv.paidAmount ?? 0)); }
  }
  const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyMap.entries()).map(([key, v]) => ({
    month: TR_MONTHS[parseInt(key.split("-")[1]) - 1],
    invoiced: Math.round(v.invoiced * 100) / 100,
    collected: Math.round(v.collected * 100) / 100,
  }));

  const topModels: TopModel[] = topModelsRaw.filter((r) => r.deviceModel).map((r) => ({ model: r.deviceModel!, count: r._count._all }));

  const maintenanceAlerts: MaintenanceAlert[] = maintenanceCustomersRaw.map((c) => {
    const lastDate = c.serviceReports[0]?.createdAt ?? new Date(0);
    const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);
    const name = c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
    return { id: c.id, name, phone: c.phone, lastService: new Date(lastDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }), daysSince };
  });

  const paidTotal = parseFloat(String(paidInvoices._sum.total ?? 0));
  const pendingTotal = parseFloat(String(pendingInvoices._sum.total ?? 0));

  function customerName(c: { type: string; firstName: string | null; lastName: string | null; companyName: string | null }) {
    return c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
  }

  const STATUS_COLOR: Record<string, string> = {
    RECEIVED: "bg-gray-100 text-gray-600", DIAGNOSING: "bg-blue-100 text-blue-700",
    WAITING_PARTS: "bg-amber-100 text-amber-700", IN_REPAIR: "bg-orange-100 text-orange-700",
    QUALITY_CHECK: "bg-purple-100 text-purple-700", READY: "bg-green-100 text-green-700",
    DELIVERED: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-500",
    WARRANTY_RETURN: "bg-pink-100 text-pink-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    RECEIVED: "Alındı", DIAGNOSING: "Teşhis", WAITING_PARTS: "Parça Bekl.", IN_REPAIR: "Tamirde",
    QUALITY_CHECK: "Kalite Ktr.", READY: "Hazır", DELIVERED: "Teslim", CANCELLED: "İptal", WARRANTY_RETURN: "Garanti",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Hoş geldin, {session?.user?.name?.split(" ")[0] ?? ""}!</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/servis" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Aktif Servis</p><p className="text-2xl font-bold text-blue-600 mt-1">{activeReports}</p><p className="text-xs text-gray-400 mt-0.5">{totalReports} toplam</p></div>
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Wrench size={20} className="text-blue-600" /></div>
          </div>
        </Link>
        <Link href="/servis?status=DELIVERED" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Tamamlanan</p><p className="text-2xl font-bold text-green-600 mt-1">{completedReports}</p></div>
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><CheckCircle size={20} className="text-green-600" /></div>
          </div>
        </Link>
        <Link href="/musteriler" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div><p className="text-xs text-gray-500">Müşteriler</p><p className="text-2xl font-bold mt-1">{totalCustomers}</p></div>
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><Users size={20} className="text-purple-600" /></div>
          </div>
        </Link>
        {(role === "ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER") && (
          <Link href="/muhasebe" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Tahsil Edildi</p>
                <p className="text-xl font-bold text-green-600 mt-1">₺{paidTotal.toLocaleString("tr-TR", { minimumFractionDigits: 0 })}</p>
                <p className="text-xs text-amber-600 mt-0.5">₺{pendingTotal.toLocaleString("tr-TR", { minimumFractionDigits: 0 })} bekliyor</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Banknote size={20} className="text-emerald-600" /></div>
            </div>
          </Link>
        )}
      </div>

      {/* Charts */}
      <ServiceAnalyticsSection monthlyRevenue={monthlyRevenue} topModels={topModels} maintenanceAlerts={maintenanceAlerts} />

      {/* Recent Reports */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock size={17} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Son Servis Kayıtları</h2>
          </div>
          <Link href="/servis" className="text-xs text-blue-600 hover:underline">Tümünü Gör</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentReports.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Henüz servis kaydı yok</p>
          ) : recentReports.map((r) => (
            <Link key={r.id} href={`/servis/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-gray-400">{r.reportNumber}</p>
                <p className="font-semibold text-sm text-gray-800">{customerName(r.customer)}</p>
                {(r.deviceBrand || r.deviceModel) && <p className="text-xs text-gray-500">{[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ")}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
