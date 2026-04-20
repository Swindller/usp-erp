import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { getAppSession } from "@/lib/auth-helpers";

const ERP_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();

  if (!session || !ERP_ROLES.includes(session.user.role)) {
    redirect("/giris");
  }

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
    <SessionProvider session={nextAuthSession as never}>
      <div className="flex min-h-screen">
        <Sidebar permissions={session.user.permissions} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
