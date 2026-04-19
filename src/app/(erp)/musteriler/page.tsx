import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Building2, User, Search, Plus } from "lucide-react";
import { CsvButtons } from "@/components/ui/CsvButtons";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function MusterilerPage({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !ALLOWED_ROLES.includes(role || "")) redirect("/giris");

  const page = Math.max(1, parseInt(pageStr || "1"));
  const limit = 25;

  const where = q ? {
    isActive: true,
    OR: [
      { firstName: { contains: q, mode: "insensitive" as const } },
      { lastName: { contains: q, mode: "insensitive" as const } },
      { companyName: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  } : { isActive: true };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { serviceReports: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-blue-600" />
            Müşteriler
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} aktif müşteri</p>
        </div>
        <CsvButtons exportUrl="/api/musteriler/csv" importUrl="/api/musteriler/csv" exportLabel="CSV İndir" importLabel="CSV İçe Aktar" templateColumns="tip, ad, soyad, firma, telefon" />
      </div>

      <form method="GET" className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input name="q" defaultValue={q} placeholder="İsim, telefon veya e-posta..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" />
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Müşteri bulunamadı</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map((c) => {
              const name = c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {c.type === "CORPORATE" ? <Building2 size={16} className="text-gray-500" /> : <User size={16} className="text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                    {c.city && <p className="text-xs text-gray-400">{[c.city, c.district].filter(Boolean).join(", ")}</p>}
                  </div>
                  <div className="text-right">
                    <Link href={`/servis?q=${encodeURIComponent(c.phone)}`} className="text-xs text-blue-600 hover:underline">
                      {c._count.serviceReports} servis
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{c.type === "CORPORATE" ? "Kurumsal" : "Şahıs"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/musteriler?page=${p}${q ? `&q=${q}` : ""}`}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
