import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewQuoteForm } from "@/components/teklifler/NewQuoteForm";

export const metadata = { title: "Yeni Teklif" };

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/giris");

  const role = (session.user as { role?: string })?.role ?? "";
  const allowed = ["ADMIN", "SUPER_ADMIN", "MANAGER"];
  if (!allowed.includes(role)) redirect("/teklifler");

  return <NewQuoteForm />;
}
