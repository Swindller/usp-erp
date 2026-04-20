import Link from "next/link";


import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceStatus } from "@prisma/client";
import { ServiceStatusBadge, STATUS_CONFIG } from "@/components/servis/ServiceStatusBadge";
import { Plus, Search, Wrench, Clock, User, Building2 } from "lucide-react";
import { Prisma } from "@prisma/client";
import { CsvButtons } from "@/components/ui/CsvButtons";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

interface Props {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}

function customerName(c: { type: string; firstName: string | null; lastName: string | null; companyName: string | null }) {
  return c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function techName(t: { user: { firstName: string | null; lastName: string | null } } | null) {
  if (!t) return "—";
  return [t.user.firstName, t.user.lastName].filter(Boolean).join(" ") || "Teknisyen";
}

function relativeDate(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Bugün";
  if (days === 1) return "Dün";
  if (days < 7) return `${days} gün önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

export default async function ServisListPage({ searchParams }: Props) {
  const { status, page: pageStr, q } = await searchParams;
  const session = await getAppSession();
  const role = session?.user?.role;
  if (!session) redirect("/giris");
  if (!ALLOWED_ROLES.includes(role || "")) redirect("/");

  const page = Math.max(1, parseInt(pageStr || "1"));
  const limit = 20;

  const where: Prisma.ServiceReportWhereInput = {};
  if (status) where.status = status as ServiceStatus;
  if (q) {
    where.OR = [
      { reportNumber: { contains: q, mode: "insensitive" } },
      { deviceSerial: { contains: q, mode: "insensitive" } },
      { deviceModel: { contains: q, mode: "insensitive" } },
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { companyName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
    ];
  }

  if (role === "TECHNICIAN" && session.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, include: { personnel: true } });
    if (user?.personnel) where.technicianId = user.personnel.id;
  }

  const [reports, total, statusCounts] = await Promise.all([
    prisma.serviceReport.findMany({
      where,
      include: {
        customer: { select: { type: true, firstName: true, lastName: true, companyName: true, phone: true } },
        technician: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.serviceReport.count({ where }),
    prisma.serviceReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const pages = Math.ceil(total / limit);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench size={22} className="text-blue-600" />
            Servis Raporları
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} kayıt{status ? ` · ${STATUS_CONFIG[status as ServiceStatus]?.label || status}` : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CsvButtons exportUrl="/api/musteriler/csv" importUrl="/api/musteriler/csv" exportLabel="Müşteri CSV" importLabel="Müşteri İçe Aktar" templateColumns="tip, ad, soyad, firma, telefon, email" />
          <Link href="/servis/yeni" className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-500 transition-colors">
            <Plus size={16} />Yeni Servis Kaydı
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/servis" className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!status ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Tümü ({total})
        </Link>
        {(Object.keys(STATUS_CONFIG) as ServiceStatus[]).map((s) => {
          const cnt = counts[s] || 0;
          if (cnt === 0 && status !== s) return null;
          return (
            <Link key={s} href={`/servis?status=${s}`} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {STATUS_CONFIG[s].label} {cnt > 0 && `(${cnt})`}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form method="GET" className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input name="q" defaultValue={q} placeholder="Rapor no, seri no, müşteri adı veya telefon..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" />
        {status && <input type="hidden" name="status" value={status} />}
      </form>

      {/* List */}
      {reports.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Wrench size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Link key={r.id} href={`/servis/${r.id}`} className="block bg-white border border-gray-200 rounded-2xl px-4 py-3.5 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  {r.customer.type === "CORPORATE" ? <Building2 size={16} className="text-gray-500" /> : <User size={16} className="text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-mono text-xs text-gray-400">{r.reportNumber}</span>
                      <p className="font-semibold text-gray-900 text-sm">{customerName(r.customer)}</p>
                    </div>
                    <ServiceStatusBadge status={r.status} size="sm" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                    {(r.deviceBrand || r.deviceModel) && <span className="text-xs text-gray-500">{[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ")}</span>}
                    {r.deviceSerial && <span className="text-xs text-gray-400 font-mono">#{r.deviceSerial}</span>}
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{relativeDate(r.createdAt)}</span>
                    {r.technician && <span className="text-xs text-gray-400">{techName(r.technician)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/servis?page=${p}${status ? `&status=${status}` : ""}${q ? `&q=${q}` : ""}`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
