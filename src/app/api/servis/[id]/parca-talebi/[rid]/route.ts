import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const APPROVE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];
const ALL_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "deliver"]),
});

interface PartItem { name: string; code?: string; qty: number; unitPrice?: number; productId?: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALL_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, rid } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const { action } = parsed.data;

  if ((action === "approve" || action === "reject") && !APPROVE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });

  const partsReq = await prisma.partsRequest.findUnique({
    where: { id: rid },
    include: { serviceReport: { select: { id: true, partsUsed: true } } },
  });
  if (!partsReq || partsReq.serviceReportId !== id)
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  let updated;

  if (action === "approve") {
    updated = await prisma.partsRequest.update({
      where: { id: rid },
      data: { status: "APPROVED", approvedById: personnel?.id, approvedAt: new Date() },
      include: {
        requestedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
        approvedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    await prisma.serviceLog.create({
      data: {
        serviceReportId: id,
        type: "PARTS_UPDATED",
        description: "Parça talebi onaylandı",
        personnelId: personnel?.id,
      },
    });

  } else if (action === "reject") {
    updated = await prisma.partsRequest.update({
      where: { id: rid },
      data: { status: "REJECTED", approvedById: personnel?.id },
      include: {
        requestedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
        approvedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    await prisma.serviceLog.create({
      data: {
        serviceReportId: id,
        type: "PARTS_UPDATED",
        description: "Parça talebi reddedildi",
        personnelId: personnel?.id,
      },
    });

  } else {
    // deliver
    updated = await prisma.partsRequest.update({
      where: { id: rid },
      data: { status: "DELIVERED", deliveredAt: new Date() },
      include: {
        requestedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
        approvedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Auto-add parts to report.partsUsed
    const reqParts = (partsReq.parts as unknown as PartItem[]).map((p) => ({
      productId: p.productId || "manual",
      name: p.name,
      partNo: p.code || "",
      quantity: p.qty,
      unitPrice: p.unitPrice || 0,   // Fiyat arka planda saklanır, teknisyen görmez
    }));
    const existingParts = (partsReq.serviceReport.partsUsed as unknown as typeof reqParts | null) || [];
    const merged = [...existingParts, ...reqParts];
    const partsCost = merged.reduce((s, p) => s + p.quantity * p.unitPrice, 0);

    await prisma.serviceReport.update({
      where: { id },
      data: {
        partsUsed: merged,
        partsCost,
        status: "IN_REPAIR",
      },
    });

    await prisma.serviceLog.create({
      data: {
        serviceReportId: id,
        type: "PARTS_UPDATED",
        description: `Parçalar teslim edildi (${reqParts.length} kalem), kullanılan parçalara eklendi. Durum: Montaj Yapılıyor`,
        personnelId: personnel?.id,
      },
    });
  }

  return NextResponse.json({ request: updated });
}
