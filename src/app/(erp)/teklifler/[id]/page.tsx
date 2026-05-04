import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteDetail } from "@/components/teklifler/QuoteDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/giris");

  const role = (session.user as { role?: string })?.role ?? "";
  const allowed = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
  if (!allowed.includes(role)) redirect("/");

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true, address: true, city: true, district: true, taxNumber: true, taxOffice: true } },
      createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      serviceReport: { select: { id: true, reportNumber: true } },
    },
  });
  if (!quote) notFound();

  return <QuoteDetail quote={JSON.parse(JSON.stringify(quote))} userRole={role} />;
}
