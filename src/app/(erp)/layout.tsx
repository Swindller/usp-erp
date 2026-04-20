import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { prisma } from "@/lib/prisma";

const ERP_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !ERP_ROLES.includes(role ?? "")) redirect("/giris");

  // Admin her şeyi görür — personnel kaydına gerek yok
  let permissions: string[] = [];
  if (!ADMIN_ROLES.includes(role ?? "") && session.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { personnel: { select: { permissions: true } } },
    });
    permissions = user?.personnel?.permissions ?? [];
  }

  return (
    <SessionProvider session={session}>
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
