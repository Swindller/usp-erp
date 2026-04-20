import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth-helpers";

const ERP_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  const role = session?.user?.role;

  if (!session || !ERP_ROLES.includes(role ?? "")) redirect("/giris");

  // Admin her şeyi görür — personnel kaydına gerek yok
  let permissions: string[] = [];
  if (!ADMIN_ROLES.includes(role ?? "")) {
    const userId = session.user.id;
    if (userId) {
      try {
        const personnel = await prisma.personnel.findFirst({
          where: { userId },
          select: { permissions: true },
        });
        permissions = personnel?.permissions ?? [];
      } catch (e) {
        console.error("[layout] permissions fetch error:", e);
        permissions = [];
      }
    }
  }

  // getServerSession formatına uygun session objesi oluştur (SessionProvider için)
  const nextAuthSession = {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };

  return (
    <SessionProvider session={nextAuthSession}>
      <div className="flex min-h-screen">
        <Sidebar permissions={permissions} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
