import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PlanTaskType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
const MANAGE_ROLES  = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

const taskSchema = z.object({
  type:             z.nativeEnum(PlanTaskType).default("FIELD_VISIT"),
  title:            z.string().min(1),
  description:      z.string().optional(),
  address:          z.string().optional(),
  assigneeIds:      z.array(z.string()).default([]),
  serviceReportId:  z.string().optional(),
  sortOrder:        z.coerce.number().default(0),
  notes:            z.string().optional(),
});

const createSchema = z.object({
  date:   z.string(), // YYYY-MM-DD
  title:  z.string().optional(),
  notes:  z.string().optional(),
  tasks:  z.array(taskSchema).optional(),
});

function planInclude(personnelId?: string) {
  return {
    tasks: {
      where: personnelId ? { assignees: { some: { personnelId } } } : undefined,
      include: {
        assignees: {
          include: {
            personnel: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
        serviceReport: { select: { id: true, reportNumber: true, status: true, customer: { select: { firstName: true, lastName: true, companyName: true, type: true } } } },
      },
      orderBy: { sortOrder: "asc" as const },
    },
    createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);

  // Teknisyen sadece kendi görevlerini görür
  let personnelId: string | undefined;
  if (user.role === "TECHNICIAN") {
    const p = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });
    personnelId = p?.id;
  }

  const plan = await prisma.servicePlan.findFirst({
    where: { date },
    include: planInclude(personnelId),
  });

  return NextResponse.json({ plan: plan ?? null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !MANAGE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { date: dateStr, title, notes, tasks = [] } = parsed.data;
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);

  // Upsert plan
  const plan = await prisma.servicePlan.upsert({
    where: { date },
    create: {
      date,
      title: title || null,
      notes: notes || null,
      createdById: personnel?.id,
    },
    update: {
      title: title !== undefined ? title : undefined,
      notes: notes !== undefined ? notes : undefined,
    },
    include: planInclude(),
  });

  // Görevleri ekle
  if (tasks.length > 0) {
    for (const t of tasks) {
      await prisma.planTask.create({
        data: {
          planId: plan.id,
          type: t.type,
          title: t.title,
          description: t.description,
          address: t.address,
          sortOrder: t.sortOrder,
          notes: t.notes,
          serviceReportId: t.serviceReportId || null,
          assignees: {
            create: t.assigneeIds.map((pid) => ({ personnelId: pid })),
          },
        },
      });
    }
  }

  const full = await prisma.servicePlan.findUnique({
    where: { id: plan.id },
    include: planInclude(),
  });

  return NextResponse.json({ plan: full }, { status: 201 });
}
