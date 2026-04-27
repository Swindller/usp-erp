import { redirect } from "next/navigation";
import { getAppSession, hasPagePermission } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServicePlanningPage } from "@/components/servis/ServicePlanningPage";

export default async function PlanlamaPage() {
  const session = await getAppSession();
  if (!session) redirect("/giris");
  const role = session.user.role;
  if (!await hasPagePermission(session.user.id, role, "servis")) redirect("/");

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Oturum açan kullanıcının personel kaydı
  const currentPersonnel = await prisma.personnel.findFirst({
    where: { user: { email: session.user.email! } },
    select: { id: true },
  });

  return (
    <ServicePlanningPage
      personnel={personnel}
      userRole={role}
      currentPersonnelId={currentPersonnel?.id ?? null}
    />
  );
}
