import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ServiceReportPDF } from "@/components/servis/ServiceReportPDF";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const report = await prisma.serviceReport.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          type: true, firstName: true, lastName: true, companyName: true,
          phone: true, email: true, address: true, city: true, district: true,
          taxNumber: true, taxOffice: true,
        },
      },
      technician: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  // Serialize Dates and Decimals to strings
  const serialized = {
    ...report,
    receivedAt: report.receivedAt.toISOString(),
    completedAt: report.completedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    laborCost: report.laborCost?.toString() ?? null,
    partsCost: report.partsCost?.toString() ?? null,
    totalCost: report.totalCost?.toString() ?? null,
    partsUsed: report.partsUsed as { productId: string; name: string; qty: number; unitPrice: number }[] | null,
    techSignerName: report.techSignerName ?? null,
    techSignerRole: report.techSignerRole ?? null,
    custSignerName: report.custSignerName ?? null,
    custSignerRole: report.custSignerRole ?? null,
    deviceMonth: report.deviceMonth ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(ServiceReportPDF, { report: serialized }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="servis-raporu-${report.reportNumber}.pdf"`,
    },
  });
}
