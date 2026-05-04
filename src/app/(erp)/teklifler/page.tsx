import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuotesPage } from "@/components/teklifler/QuotesPage";

export const metadata = { title: "Teklifler" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/giris");

  const role = (session.user as { role?: string })?.role ?? "";
  const allowed = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
  if (!allowed.includes(role)) redirect("/");

  return <QuotesPage userRole={role} />;
}
