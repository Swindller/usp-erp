

import { redirect, notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceReportDetail } from "@/components/servis/ServiceReportDetail";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServisDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getAppSession();
  const role = session?.user?.role;
  if (!session) redirect("/giris");
  if (!ALLOWED_ROLES.includes(role || "")) redirect("/");

  const [report, personnel] = await Promise.all([
    prisma.serviceReport.findUnique({
      where: { id },
      include: {
        customer: true,
        technician: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        additionalTechnicians: { include: { user: { select: { firstName: true, lastName: true } } } },
        logs: {
          include: { personnel: { include: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { createdAt: "desc" },
        },
        invoices: { select: { id: true, invoiceNumber: true, status: true, total: true } },
      },
    }),
    prisma.personnel.findMany({
      where: { isActive: true },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  if (!report) notFound();

  let canCreateInvoice = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role ?? "");

  if (session.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, include: { personnel: true } });
    if (role === "TECHNICIAN" && user?.personnel && report.technicianId !== user.personnel.id) redirect("/servis");
    // Muhasebe yetkisi olan teknisyenler de fatura oluşturabilir
    if (!canCreateInvoice && user?.personnel?.permissions.includes("muhasebe")) canCreateInvoice = true;
  }

  const canEdit   = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role ?? "");
  const canDelete = role === "SUPER_ADMIN";
  return <ServiceReportDetail report={report as unknown as Parameters<typeof ServiceReportDetail>[0]["report"]} personnel={personnel} canEdit={canEdit} canDelete={canDelete} canCreateInvoice={canCreateInvoice} />;
}
