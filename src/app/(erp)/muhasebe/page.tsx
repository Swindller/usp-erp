import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, CustomerType, Prisma } from "@prisma/client";
import Link from "next/link";
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, FileText, ChevronRight, Building2, User } from "lucide-react";
import { DeleteInvoiceButton } from "@/components/muhasebe/DeleteInvoiceButton";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; classes: string }> = {
  DRAFT:          { label: "Taslak",        classes: "bg-gray-100 text-gray-600" },
  SENT:           { label: "Gönderildi",    classes: "bg-blue-100 text-blue-700" },
  PAID:           { label: "Ödendi",        classes: "bg-green-100 text-green-700" },
  PARTIALLY_PAID: { label: "Kısmi Ödeme",  classes: "bg-yellow-100 text-yellow-700" },
  OVERDUE:        { label: "Vadesi Geçti", classes: "bg-red-100 text-red-700" },
  CANCELLED:      { label: "İptal",        classes: "bg-gray-100 text-gray-500" },
};

function toNum(v: Prisma.Decimal | null | undefined): number { return v ? parseFloat(v.toString()) : 0; }
function fmt(v: number) { return `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`; }
function fmtDate(d: Date | string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }); }
function customerName(c: { type: CustomerType; firstName: string | null; lastName: string | null; companyName: string | null }) {
  return c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

export default async function MuhasebePage({ searchParams }: Props) {
  const { status, page: pageStr } = await searchParams;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !ALLOWED_ROLES.includes(role || "")) redirect("/giris");

  const page = Math.max(1, parseInt(pageStr || "1"));
  const limit = 20;
  const now = new Date();
  const invoiceWhere: Prisma.InvoiceWhereInput = status ? { status: status as InvoiceStatus } : {};

  const [paidAgg, pendingAgg, overdueAgg, totalCount, invoices] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: InvoiceStatus.PAID }, _sum: { total: true }, _count: { _all: true } }),
    prisma.invoice.aggregate({ where: { status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] }, OR: [{ dueDate: null }, { dueDate: { gte: now } }] }, _sum: { total: true, paidAmount: true }, _count: { _all: true } }),
    prisma.invoice.aggregate({ where: { status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] }, dueDate: { lt: now } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.invoice.findMany({ where: invoiceWhere, include: { customer: { select: { type: true, firstName: true, lastName: true, companyName: true } }, serviceReport: { select: { id: true, reportNumber: true } } }, orderBy: { invoiceDate: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);

  const stats = {
    paid: { total: toNum(paidAgg._sum.total), count: paidAgg._count._all },
    pending: { total: toNum(pendingAgg._sum.total) - toNum(pendingAgg._sum.paidAmount), count: pendingAgg._count._all },
    overdue: { total: toNum(overdueAgg._sum.total), count: overdueAgg._count._all },
  };
  const pages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp size={22} className="text-blue-600" />Muhasebe</h1>
        <p className="text-sm text-gray-500 mt-1">Fatura, ödeme ve vade takibi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Tahsil Edildi", value: fmt(stats.paid.total), count: stats.paid.count, icon: <CheckCircle2 size={20} />, color: "green" as const, href: "/muhasebe?status=PAID" },
          { label: "Bekleyen", value: fmt(stats.pending.total), count: stats.pending.count, icon: <Clock size={20} />, color: "blue" as const, href: "/muhasebe?status=SENT" },
          { label: "Vadesi Geçmiş", value: fmt(stats.overdue.total), count: stats.overdue.count, icon: <AlertTriangle size={20} />, color: "red" as const, href: "/muhasebe?status=OVERDUE" },
        ].map((card) => {
          const colorMap = { green: "bg-green-50 border-green-200 text-green-700", blue: "bg-blue-50 border-blue-200 text-blue-700", red: "bg-red-50 border-red-200 text-red-700" };
          const iconColorMap = { green: "bg-green-100 text-green-600", blue: "bg-blue-100 text-blue-600", red: "bg-red-100 text-red-600" };
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

      <div className="flex flex-wrap gap-2">
        <Link href="/muhasebe" className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!status ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Tümü ({totalCount})</Link>
        {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map((s) => (
          <Link key={s} href={`/muhasebe?status=${s}`} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{STATUS_CONFIG[s].label}</Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200"><FileText size={36} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Fatura bulunamadı</p></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
            <span className="col-span-2">Fatura No</span><span className="col-span-3">Müşteri</span><span className="col-span-2">Servis Raporu</span><span className="col-span-1 text-right">Tutar</span><span className="col-span-2">Vade</span><span className="col-span-1">Durum</span><span className="col-span-1" />
          </div>
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => {
              const isOverdue = inv.dueDate && new Date(inv.dueDate) < now && inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED;
              const displayStatus = isOverdue ? InvoiceStatus.OVERDUE : inv.status;
              return (
                <div key={inv.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-4 py-3.5 items-center hover:bg-gray-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                  <span className="sm:col-span-2 font-mono text-xs text-gray-600 font-medium">{inv.invoiceNumber}</span>
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">{inv.customer.type === "CORPORATE" ? <Building2 size={11} className="text-gray-500" /> : <User size={11} className="text-gray-500" />}</div>
                    <span className="text-sm text-gray-800 truncate">{customerName(inv.customer)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    {inv.serviceReport ? <Link href={`/servis/${inv.serviceReport.id}`} className="text-xs font-mono text-blue-600 hover:underline">{inv.serviceReport.reportNumber}</Link> : <span className="text-xs text-gray-400">—</span>}
                  </div>
                  <div className="sm:col-span-1 sm:text-right"><span className="text-sm font-semibold">{fmt(toNum(inv.total))}</span></div>
                  <div className="sm:col-span-2"><span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>{inv.dueDate ? fmtDate(inv.dueDate) : "Vade yok"}</span></div>
                  <div className="sm:col-span-1"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[displayStatus].classes}`}>{STATUS_CONFIG[displayStatus].label}</span></div>
                  <div className="sm:col-span-1 flex justify-end items-center gap-0.5">
                    {role === "SUPER_ADMIN" && (
                      <DeleteInvoiceButton invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
                    )}
                    <Link href={`/muhasebe/fatura/${inv.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Detay">
                      <ChevronRight size={14} />
                    </Link>
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
            <Link key={p} href={`/muhasebe?page=${p}${status ? `&status=${status}` : ""}`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
