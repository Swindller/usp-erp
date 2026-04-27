import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PlanTaskType } from "@prisma/client";

const MANAGE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];
const ALL_ROLES    = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const taskSchema = z.object({
  type:            z.nativeEnum(PlanTaskType).default("FIELD_VISIT"),
  title:           z.string().min(1),
  description:     z.string().optional(),
  address:         z.string().optional(),
  assigneeIds:     z.array(z.string()).default([]),
  serviceReportId: z.string().optional(),
  sortOrder:       z.coerce.number().default(0),
  notes:           z.string().optional(),
});

const patchSchema = z.object({
  title:  z.string().optional(),
  notes:  z.string().optional(),
  addTask: taskSchema.optional(),
});

function planInclude() {
  return {
    tasks: {
      include: {
        assignees: {
          include: {
            personnel: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        serviceReport: {
          select: {
            id: true, reportNumber: true, status: true,
            customer: { select: { firstName: true, lastName: true, companyName: true, type: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" as const },
    },
    createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALL_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const plan = await prisma.servicePlan.findUnique({ where: { id }, include: planInclude() });
  if (!plan) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !MANAGE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { title, notes, addTask } = parsed.data;

  if (title !== undefined || notes !== undefined) {
    await prisma.servicePlan.update({
      where: { id },
      data: { title: title ?? undefined, notes: notes ?? undefined },
    });
  }

  if (addTask) {
    await prisma.planTask.create({
      data: {
        planId: id,
        type: addTask.type,
        title: addTask.title,
        description: addTask.description,
        address: addTask.address,
        sortOrder: addTask.sortOrder,
        notes: addTask.notes,
        serviceReportId: addTask.serviceReportId || null,
        assignees: { create: addTask.assigneeIds.map((pid) => ({ personnelId: pid })) },
      },
    });
  }

  const plan = await prisma.servicePlan.findUnique({ where: { id }, include: planInclude() });
  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !MANAGE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.servicePlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
