import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Users, Wrench, CheckCircle, Clock, TrendingUp } from "lucide-react";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

function avgDays(ms: number): string {
  const d = Math.round(ms / 86400000);
  if (d === 0) return "< 1 gün";
  return `${d} gün`;
}

export default async function PersonelPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !ALLOWED_ROLES.includes(role || "")) redirect("/giris");

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const personnelIds = personnel.map((p) => p.id);

  const [completedReports, activeReports, completionTimesRaw] = await Promise.all([
    prisma.serviceReport.groupBy({ by: ["technicianId"], _count: { _all: true }, where: { technicianId: { in: personnelIds }, status: { in: ["DELIVERED", "READY"] } } }),
    prisma.serviceReport.groupBy({ by: ["technicianId"], _count: { _all: true }, where: { technicianId: { in: personnelIds }, status: { notIn: ["DELIVERED", "CANCELLED"] } } }),
    prisma.serviceReport.findMany({ where: { technicianId: { in: personnelIds }, completedAt: { not: null } }, select: { technicianId: true, createdAt: true, completedAt: true } }),
  ]);

  const completedMap = new Map(completedReports.map((r) => [r.technicianId, r._count._all]));
  const activeMap = new Map(activeReports.map((r) => [r.technicianId, r._count._all]));
  const completionByTech = new Map<string, number[]>();
  for (const r of completionTimesRaw) {
    if (!r.technicianId || !r.completedAt) continue;
    const ms = new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime();
    if (ms > 0) { const arr = completionByTech.get(r.technicianId) ?? []; arr.push(ms); completionByTech.set(r.technicianId, arr); }
  }

  const stats = personnel.map((p) => {
    const times = completionByTech.get(p.id) ?? [];
    const avgMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const completed = completedMap.get(p.id) ?? 0;
    const active = activeMap.get(p.id) ?? 0;
    return { id: p.id, name: [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.email, role: p.role, completed, active, avgCompletion: avgMs !== null ? avgDays(avgMs) : "—", totalJobs: completed + active };
  });

  const ROLE_LABELS: Record<string, string> = { TECHNICIAN: "Teknisyen", FIELD_TECHNICIAN: "Saha Tekn.", WORKSHOP_TECHNICIAN: "Atölye Tekn.", SUPERVISOR: "Supervisor", MANAGER: "Yönetici" };
  const totalCompleted = stats.reduce((s, p) => s + p.completed, 0);
  const totalActive = stats.reduce((s, p) => s + p.active, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users size={22} className="text-blue-600" />Personel Performansı</h1>
        <p className="text-sm text-gray-500 mt-1">{personnel.length} aktif personel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Tamamlanan İşler", value: totalCompleted, icon: <CheckCircle size={20} />, color: "bg-green-100 text-green-600", textColor: "text-green-600" },
          { label: "Aktif İşler", value: totalActive, icon: <Wrench size={20} />, color: "bg-blue-100 text-blue-600", textColor: "text-blue-600" },
          { label: "Toplam Kayıt", value: totalCompleted + totalActive, icon: <TrendingUp size={20} />, color: "bg-purple-100 text-purple-600", textColor: "text-gray-900" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>{card.icon}</div>
              <div><p className="text-xs text-gray-500">{card.label}</p><p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Teknisyen Detayları</h2></div>
        {stats.length === 0 ? (
          <div className="py-16 text-center"><Users size={36} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aktif personel bulunamadı</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Personel</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Rol</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">Aktif</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">Tamamlanan</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">Toplam</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">Ort. Süre</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">Verimlilik</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((p) => {
                  const efficiency = p.totalJobs > 0 ? Math.round((p.completed / p.totalJobs) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-4"><p className="font-semibold text-gray-900">{p.name}</p></td>
                      <td className="px-5 py-4"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{ROLE_LABELS[p.role] ?? p.role}</span></td>
                      <td className="px-5 py-4 text-center"><span className={`font-bold ${p.active > 0 ? "text-blue-600" : "text-gray-400"}`}>{p.active}</span></td>
                      <td className="px-5 py-4 text-center"><span className="font-bold text-green-600">{p.completed}</span></td>
                      <td className="px-5 py-4 text-center font-medium">{p.totalJobs}</td>
                      <td className="px-5 py-4 text-center"><div className="flex items-center justify-center gap-1 text-gray-600"><Clock size={12} />{p.avgCompletion}</div></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
                            <div className={`h-2 rounded-full ${efficiency >= 80 ? "bg-green-500" : efficiency >= 50 ? "bg-yellow-500" : "bg-red-400"}`} style={{ width: `${efficiency}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-9 text-right">{efficiency}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
