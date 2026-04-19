import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServiceReportForm } from "@/components/servis/ServiceReportForm";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export default async function YeniServisPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !ALLOWED_ROLES.includes(role || "")) redirect("/giris");

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return <ServiceReportForm personnel={personnel} />;
}
