import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PlanTaskStatus, PlanTaskType } from "@prisma/client";

const MANAGE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];
const ALL_ROLES    = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const patchSchema = z.object({
  // Durum değişikliği
  status:      z.nativeEnum(PlanTaskStatus).optional(),
  // İçerik güncellemesi (sadece admin/manager)
  title:       z.string().optional(),
  description: z.string().optional(),
  address:     z.string().optional(),
  type:        z.nativeEnum(PlanTaskType).optional(),
  assigneeIds: z.array(z.string()).optional(),
  serviceReportId: z.string().nullable().optional(),
  sortOrder:   z.coerce.number().optional(),
  notes:       z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALL_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { taskId } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;

  // Teknisyen sadece kendi görevinin durumunu değiştirebilir
  if (user.role === "TECHNICIAN") {
    if (Object.keys(data).some((k) => k !== "status"))
      return NextResponse.json({ error: "Sadece durum güncelleyebilirsiniz" }, { status: 403 });
    // Görev bu teknisyene atanmış mı kontrol et
    const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });
    const task = await prisma.planTask.findUnique({ where: { id: taskId }, include: { assignees: true } });
    if (!task || !task.assignees.some((a) => a.personnelId === personnel?.id))
      return NextResponse.json({ error: "Bu göreve erişiminiz yok" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  if (data.status) {
    updateData.status = data.status;
    const now = new Date();
    if (data.status === "EN_ROUTE")    updateData.startedAt   = now;
    if (data.status === "ARRIVED")     updateData.arrivedAt   = now;
    if (data.status === "IN_PROGRESS" && !updateData.arrivedAt) updateData.arrivedAt = now;
    if (data.status === "DONE")        updateData.completedAt = now;
  }

  if (MANAGE_ROLES.includes(user.role)) {
    if (data.title       !== undefined) updateData.title       = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.address     !== undefined) updateData.address     = data.address;
    if (data.type        !== undefined) updateData.type        = data.type;
    if (data.sortOrder   !== undefined) updateData.sortOrder   = data.sortOrder;
    if (data.notes       !== undefined) updateData.notes       = data.notes;
    if (data.serviceReportId !== undefined) updateData.serviceReportId = data.serviceReportId;
  }

  // Atananları güncelle
  if (data.assigneeIds !== undefined && MANAGE_ROLES.includes(user.role)) {
    await prisma.planTaskAssignee.deleteMany({ where: { taskId } });
    await prisma.planTaskAssignee.createMany({
      data: data.assigneeIds.map((pid) => ({ taskId, personnelId: pid })),
    });
  }

  const task = await prisma.planTask.update({
    where: { id: taskId },
    data: updateData,
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
  });

  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getAuthUser();
  if (!user || !MANAGE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { taskId } = await params;
  await prisma.planTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
