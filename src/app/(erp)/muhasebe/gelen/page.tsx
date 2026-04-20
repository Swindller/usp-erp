import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IncomingInvoiceStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { TrendingDown, Clock, AlertTriangle, CheckCircle2, ChevronRight, Plus, Package } from "lucide-react";
import { getAppSession } from "@/lib/auth-helpers";

const ROLE_ALLOWED = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_CONFIG: Record<IncomingInvoiceStatus, { label: string; classes: string }> = {
  UNPAID:          { label: "Ödenmedi",      classes: "bg-red-100 text-red-700" },
  PARTIALLY_PAID:  { label: "Kısmi Ödeme",  classes: "bg-yellow-100 text-yellow-700" },
  PAID:            { label: "Ödendi",        classes: "bg-green-100 text-green-700" },
  OVERDUE:         { label: "Vadesi Geçti", classes: "bg-red-100 text-red-700" },
};

function toNum(v: Prisma.Decimal | null | undefined): number { return v ? parseFloat(v.toString()) : 0; }
function fmt(v: number) { return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`; }
function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function GelenFaturaPage({ searchParams }: Props) {
  const { status, page: pageStr } = await searchParams;
  const session = await getAppSession();
  if (!session) redirect("/giris");
  const role = session.user.role;
  if (!ROLE_ALLOWED.includes(role)) {
    const personnel = await prisma.personnel.findFirst({ where: { userId: session.user.id }, select: { permissions: true } });
    if (!personnel?.permissions?.includes("muhasebe")) redirect("/");
  }

  const page = Math.max(1, parseInt(pageStr || "1"));
  const limit = 20;
  const now = new Date();
  const where: Prisma.IncomingInvoiceWhereInput = status ? { status: status as IncomingInvoiceStatus } : {};

  const [unpaidAgg, paidAgg, overdueAgg, totalCount, invoices] = await Promise.all([
    prisma.incomingInvoice.aggregate({
      where: { status: { in: [IncomingInvoiceStatus.UNPAID, IncomingInvoiceStatus.PARTIALLY_PAID] }, OR: [{ dueDate: null }, { dueDate: { gte: now } }] },
      _sum: { total: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.incomingInvoice.aggregate({
      where: { status: IncomingInvoiceStatus.PAID },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.incomingInvoice.aggregate({
      where: { status: { notIn: [IncomingInvoiceStatus.PAID] }, dueDate: { lt: now } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.incomingInvoice.count({ where }),
    prisma.incomingInvoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const stats = {
    unpaid: { total: toNum(unpaidAgg._sum.total) - toNum(unpaidAgg._sum.paidAmount), count: unpaidAgg._count._all },
    paid: { total: toNum(paidAgg._sum.total), count: paidAgg._count._all },
    overdue: { total: toNum(overdueAgg._sum.total), count: overdueAgg._count._all },
  };
  const pages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown size={22} className="text-orange-600" />Muhasebe
          </h1>
          <p className="text-sm text-gray-500 mt-1">Fatura, ödeme ve vade takibi</p>
        </div>
        <Link
          href="/muhasebe/gelen/yeni"
          className="flex items-center gap-2 bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-orange-700 transition-colors"
        >
          <Plus size={16} />Gelen Fatura Ekle
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <Link href="/muhasebe" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Giden Faturalar
        </Link>
        <Link href="/muhasebe/gelen" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm transition-colors">
          Gelen Faturalar
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Ödenecek", value: fmt(stats.unpaid.total), count: stats.unpaid.count, icon: <Clock size={20} />, color: "orange" as const, href: "/muhasebe/gelen?status=UNPAID" },
          { label: "Ödendi", value: fmt(stats.paid.total), count: stats.paid.count, icon: <CheckCircle2 size={20} />, color: "green" as const, href: "/muhasebe/gelen?status=PAID" },
          { label: "Vadesi Geçmiş", value: fmt(stats.overdue.total), count: stats.overdue.count, icon: <AlertTriangle size={20} />, color: "red" as const, href: "/muhasebe/gelen?status=OVERDUE" },
        ].map((card) => {
          const colorMap = {
            orange: "bg-orange-50 border-orange-200 text-orange-700",
            green: "bg-green-50 border-green-200 text-green-700",
            red: "bg-red-50 border-red-200 text-red-700",
          };
          const iconColorMap = {
            orange: "bg-orange-100 text-orange-600",
            green: "bg-green-100 text-green-600",
            red: "bg-red-100 text-red-600",
          };
          return (
            <Link key={card.label} href={card.href} className={`flex items-center gap-4 p-5 rounded-2xl border ${colorMap[card.color]} hover:shadow-sm transition-shadow`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColorMap[card.color]}`}>{card.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium opacity-70">{card.label}</p>
                <p className="text-xl font-bold mt-0.5">{card.value}</p>
                <p className="text-xs opacity-60 mt-0.5">{card.count} fatura</p>
              </div>
              <ChevronRight size={16} className="opacity-40" />
            </Link>
          );
        })}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        <Link href="/muhasebe/gelen" className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!status ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Tümü ({totalCount})
        </Link>
        {(Object.keys(STATUS_CONFIG) as IncomingInvoiceStatus[]).map((s) => (
          <Link key={s} href={`/muhasebe/gelen?status=${s}`} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {STATUS_CONFIG[s].label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Package size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Gelen fatura bulunamadı</p>
          <Link href="/muhasebe/gelen/yeni" className="mt-4 inline-flex items-center gap-2 text-sm text-orange-600 font-medium hover:underline">
            <Plus size={14} />İlk faturayı ekle
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
            <span className="col-span-2">Fatura No</span>
            <span className="col-span-3">Tedarikçi</span>
            <span className="col-span-2">Kategori</span>
            <span className="col-span-1 text-right">Tutar</span>
            <span className="col-span-1 text-right">Ödenen</span>
            <span className="col-span-2">Vade</span>
            <span className="col-span-1">Durum</span>
          </div>
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const isOverdue = inv.dueDate && new Date(inv.dueDate) < now && inv.status !== IncomingInvoiceStatus.PAID;
              const displayStatus = isOverdue ? IncomingInvoiceStatus.OVERDUE : inv.status;
              return (
                <div key={inv.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-3.5 items-center hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                  <span className="sm:col-span-2 font-mono text-xs text-gray-600 font-medium">{inv.invoiceNumber}</span>
                  <div className="sm:col-span-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{inv.supplierName}</p>
                    {inv.supplierTaxNo && <p className="text-xs text-gray-400">VKN: {inv.supplierTaxNo}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-gray-500">{inv.category || "—"}</span>
                  </div>
                  <div className="sm:col-span-1 sm:text-right">
                    <span className="text-sm font-semibold">{fmt(toNum(inv.total))}</span>
                  </div>
                  <div className="sm:col-span-1 sm:text-right">
                    <span className="text-sm text-gray-500">{fmt(toNum(inv.paidAmount))}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      {inv.dueDate ? fmtDate(inv.dueDate) : "Vade yok"}
                    </span>
                  </div>
                  <div className="sm:col-span-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[displayStatus].classes}`}>
                      {STATUS_CONFIG[displayStatus].label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/muhasebe/gelen?page=${p}${status ? `&status=${status}` : ""}`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${p === page ? "bg-orange-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
