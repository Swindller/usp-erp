import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServiceAnalyticsSection } from "@/components/dashboard/ServiceAnalyticsSection";
import type { MonthlyRevenue, TopModel, MaintenanceAlert } from "@/components/dashboard/ServiceAnalyticsSection";
import { Wrench, Banknote, Users, CheckCircle, Clock, AlertTriangle, Trophy, CalendarClock, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { InvoiceStatus, ServiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role ?? "";
  const isAdmin = ADMIN_ROLES.includes(role);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalReports, activeReports, completedReports,
    totalCustomers,
    paidInvoices, pendingInvoices,
    serviceInvoicesRaw, topModelsRaw, maintenanceCustomersRaw,
    recentReports,
    // #7 — Top teknisyenler
    topTechniciansRaw,
    // #8 — Vadesi yaklaşan ödemeler
    upcomingInvoices,
    // #9 — Yıllık bakım hatırlatma
    upcomingMaintenances,
    // #10 — Vergi son tarihleri
    upcomingTaxes,
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
    // Top teknisyenler: en çok arıza tespit eden (diagnosis not null)
    prisma.serviceReport.groupBy({
      by: ["technicianId"],
      _count: { _all: true },
      where: { technicianId: { not: null }, diagnosis: { not: null } },
      orderBy: { _count: { technicianId: "desc" } },
      take: 5,
    }),
    // Vadesi yaklaşan faturalar (30 gün içinde, ödenmemiş)
    prisma.invoice.findMany({
      where: {
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
        dueDate: { gte: now, lte: thirtyDaysLater },
      },
      include: { customer: { select: { type: true, firstName: true, lastName: true, companyName: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    // Bakım sözleşmesi yaklaşanlar
    prisma.annualMaintenance.findMany({
      where: { isActive: true, nextDate: { gte: now, lte: thirtyDaysLater } },
      include: { customer: { select: { type: true, firstName: true, lastName: true, companyName: true, phone: true } } },
      orderBy: { nextDate: "asc" },
      take: 8,
    }),
    // Yaklaşan vergi ödeme tarihleri
    prisma.taxRecord.findMany({
      where: { status: { not: "PAID" }, dueDate: { gte: now, lte: thirtyDaysLater } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  // Teknisyen isimlerini çek
  const techIds = topTechniciansRaw.map((r) => r.technicianId).filter(Boolean) as string[];
  const personnelList = techIds.length > 0 ? await prisma.personnel.findMany({
    where: { id: { in: techIds } },
    include: { user: { select: { firstName: true, lastName: true } } },
  }) : [];
  const personnelMap = new Map(personnelList.map((p) => [p.id, [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || "İsimsiz"]));
  const topTechnicians = topTechniciansRaw.map((r) => ({
    name: personnelMap.get(r.technicianId ?? "") ?? "—",
    count: r._count._all,
  })).filter((t) => t.name !== "—");

  // Monthly revenue
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
  function fmtDate(d: Date | string) { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }); }
  function fmt(v: number | string) { return `₺${parseFloat(String(v)).toLocaleString("tr-TR", { minimumFractionDigits: 0 })}`; }
  function daysUntil(d: Date) { return Math.ceil((new Date(d).getTime() - now.getTime()) / 86400000); }

  const TAX_LABELS: Record<string, string> = {
    KDV_BEYANNAME: "KDV", MUHTASAR: "Muhtasar", SGK_PRIM: "SGK",
    GECICI_VERGI: "Geçici Vergi", KURUMLAR_VERGISI: "Kurumlar V.", GELIR_VERGISI: "Gelir V.",
  };

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
        {isAdmin && (
          <Link href="/muhasebe" className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Tahsil Edildi</p>
                <p className="text-xl font-bold text-green-600 mt-1">{fmt(paidTotal)}</p>
                <p className="text-xs text-amber-600 mt-0.5">{fmt(pendingTotal)} bekliyor</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Banknote size={20} className="text-emerald-600" /></div>
            </div>
          </Link>
        )}
      </div>

      {/* Charts */}
      <ServiceAnalyticsSection monthlyRevenue={monthlyRevenue} topModels={topModels} maintenanceAlerts={maintenanceAlerts} />

      {/* Alert row — 3 columns */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* #8 Vadesi yaklaşan ödemeler */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-800 text-sm">Vadesi Yaklaşan Ödemeler</h2>
              <span className="ml-auto text-xs text-gray-400">30 gün</span>
            </div>
            {upcomingInvoices.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">Vadesi yaklaşan ödeme yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingInvoices.map((inv) => {
                  const days = daysUntil(inv.dueDate!);
                  const urgent = days <= 7;
                  return (
                    <Link key={inv.id} href={`/muhasebe/fatura/${inv.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{customerName(inv.customer)}</p>
                        <p className="text-xs text-gray-400 font-mono">{inv.invoiceNumber}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-800">{fmt(inv.total as unknown as number)}</p>
                        <p className={`text-[10px] font-medium ${urgent ? "text-red-600" : "text-amber-600"}`}>{days} gün kaldı</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-50">
              <Link href="/muhasebe" className="text-xs text-blue-600 hover:underline">Tüm faturalar →</Link>
            </div>
          </div>

          {/* #9 Yıllık bakım yaklaşanlar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <CalendarClock size={16} className="text-blue-500" />
              <h2 className="font-semibold text-gray-800 text-sm">Bakım Zamanı Gelen Müşteriler</h2>
              <span className="ml-auto text-xs text-gray-400">30 gün</span>
            </div>
            {upcomingMaintenances.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">Yaklaşan bakım yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingMaintenances.map((m) => {
                  const days = daysUntil(m.nextDate);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{customerName(m.customer)}</p>
                        <p className="text-xs text-gray-400">{m.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">{fmtDate(m.nextDate)}</p>
                        <p className={`text-[10px] font-medium ${days <= 7 ? "text-red-600" : "text-blue-600"}`}>{days} gün</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-50">
              <Link href="/musteriler" className="text-xs text-blue-600 hover:underline">Müşteriler →</Link>
            </div>
          </div>

          {/* #10 Vergi son tarihleri */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Receipt size={16} className="text-red-500" />
              <h2 className="font-semibold text-gray-800 text-sm">Yaklaşan Vergi Son Tarihleri</h2>
              <span className="ml-auto text-xs text-gray-400">30 gün</span>
            </div>
            {upcomingTaxes.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400">Yaklaşan vergi yok</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingTaxes.map((t) => {
                  const days = daysUntil(t.dueDate);
                  const urgent = days <= 7;
                  return (
                    <div key={t.id} className={`flex items-center gap-3 px-5 py-3 ${urgent ? "bg-red-50/40" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{TAX_LABELS[t.type] ?? t.type}</p>
                        <p className="text-xs text-gray-400">{t.month ? `${TR_MONTHS[t.month - 1]} ${t.year}` : String(t.year)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-800">{fmt(t.netTax as unknown as number)}</p>
                        <p className={`text-[10px] font-medium ${urgent ? "text-red-600" : "text-orange-500"}`}>{days} gün kaldı</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-50">
              <Link href="/vergiler" className="text-xs text-blue-600 hover:underline">Tüm vergiler →</Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom row — Son servisler + Top teknisyenler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Son Servis Kayıtları */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2"><Clock size={17} className="text-gray-500" /><h2 className="font-semibold text-gray-800">Son Servis Kayıtları</h2></div>
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
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* #7 Top Teknisyenler */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Trophy size={16} className="text-yellow-500" />
            <h2 className="font-semibold text-gray-800 text-sm">En Çok Arıza Tespit Eden</h2>
          </div>
          {topTechnicians.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">Henüz veri yok</p>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {topTechnicians.map((t, i) => {
                const max = topTechnicians[0]?.count ?? 1;
                const pct = Math.round((t.count / max) * 100);
                const medals = ["🥇", "🥈", "🥉", "4.", "5."];
                return (
                  <div key={t.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800">{medals[i]} {t.name}</span>
                      <span className="text-gray-500 font-semibold">{t.count} tespit</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/personel" className="text-xs text-blue-600 hover:underline">Personel performansı →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
