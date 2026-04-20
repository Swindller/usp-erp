

import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceReportForm } from "@/components/servis/ServiceReportForm";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export default async function YeniServisPage() {
  const session = await getAppSession();
  const role = session?.user?.role;
  if (!session) redirect("/giris");
  if (!ALLOWED_ROLES.includes(role || "")) redirect("/");

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return <ServiceReportForm personnel={personnel} />;
}
