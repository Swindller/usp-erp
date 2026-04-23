

import { redirect } from "next/navigation";
import { getAppSession, hasPagePermission } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceReportPDFForm } from "@/components/servis/ServiceReportPDFForm";


export default async function YeniServisPage() {
  const session = await getAppSession();
  if (!session) redirect("/giris");
  const role = session.user.role;
  if (!await hasPagePermission(session.user.id, role, "servis")) redirect("/");

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return <ServiceReportPDFForm personnel={personnel} />;
}
