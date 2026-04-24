import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const partItemSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  qty: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().optional(),
  productId: z.string().optional(),
});

const createSchema = z.object({
  parts: z.array(partItemSchema).min(1),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const requests = await prisma.partsRequest.findMany({
    where: { serviceReportId: id },
    include: {
      requestedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      approvedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const report = await prisma.serviceReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 });

  const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });
  if (!personnel) return NextResponse.json({ error: "Personel kaydı bulunamadı" }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const request = await prisma.partsRequest.create({
    data: {
      serviceReportId: id,
      requestedById: personnel.id,
      parts: parsed.data.parts,
      notes: parsed.data.notes,
    },
    include: {
      requestedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      approvedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  // Log
  await prisma.serviceLog.create({
    data: {
      serviceReportId: id,
      type: "PARTS_UPDATED",
      description: `Parça talebi oluşturuldu: ${parsed.data.parts.length} kalem`,
      personnelId: personnel.id,
    },
  });

  // Status → WAITING_PARTS
  await prisma.serviceReport.update({
    where: { id },
    data: { status: "WAITING_PARTS" },
  });

  return NextResponse.json({ request }, { status: 201 });
}
