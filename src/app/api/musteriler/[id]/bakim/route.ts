import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  description: z.string().min(1),
  startDate:   z.string(), // ISO date string
  periodMonths: z.coerce.number().int().min(1).max(120),
  notes:       z.string().optional(),
  isActive:    z.boolean().optional(),
});

function calcNextDate(startDate: Date, periodMonths: number): Date {
  const now  = new Date();
  const next = new Date(startDate);
  // Advance until next date is in the future
  while (next <= now) {
    next.setMonth(next.getMonth() + periodMonths);
  }
  return next;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const maintenances = await prisma.annualMaintenance.findMany({
    where: { customerId: id },
    orderBy: { nextDate: "asc" },
  });

  return NextResponse.json({ maintenances });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { description, startDate, periodMonths, notes } = parsed.data;
  const lastDate = new Date(startDate);
  const nextDate = calcNextDate(lastDate, periodMonths);

  const maintenance = await prisma.annualMaintenance.create({
    data: { customerId: id, description, lastDate, nextDate, periodMonths, notes: notes ?? null },
  });

  return NextResponse.json({ maintenance }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId } = await params;
  const body = await req.json();
  const { maintenanceId, ...rest } = body as { maintenanceId: string } & Record<string, unknown>;
  if (!maintenanceId)
    return NextResponse.json({ error: "maintenanceId gerekli" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (rest.description)   updateData.description  = rest.description;
  if (rest.notes !== undefined) updateData.notes   = rest.notes;
  if (rest.isActive !== undefined) updateData.isActive = rest.isActive;
  if (rest.periodMonths) {
    updateData.periodMonths = Number(rest.periodMonths);
  }
  if (rest.startDate) {
    const lastDate = new Date(rest.startDate as string);
    const periodMonths = Number(rest.periodMonths ?? 12);
    updateData.lastDate = lastDate;
    updateData.nextDate = calcNextDate(lastDate, periodMonths);
  }

  const maintenance = await prisma.annualMaintenance.update({
    where: { id: maintenanceId, customerId },
    data: updateData,
  });

  return NextResponse.json({ maintenance });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId } = await params;
  const { searchParams }   = new URL(req.url);
  const maintenanceId      = searchParams.get("maintenanceId");
  if (!maintenanceId)
    return NextResponse.json({ error: "maintenanceId gerekli" }, { status: 400 });

  await prisma.annualMaintenance.delete({ where: { id: maintenanceId, customerId } });
  return NextResponse.json({ ok: true });
}
