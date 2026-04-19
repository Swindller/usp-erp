import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ServiceLogType, Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, include: { personnel: true } });
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}

const schema = z.object({
  type: z.nativeEnum(ServiceLogType).default(ServiceLogType.NOTE_ADDED),
  description: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const report = await prisma.serviceReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const log = await prisma.serviceLog.create({
    data: {
      serviceReportId: id, personnelId: user.personnel?.id,
      type: parsed.data.type, description: parsed.data.description,
      meta: parsed.data.meta as Prisma.InputJsonValue | undefined,
    },
    include: { personnel: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return NextResponse.json({ log }, { status: 201 });
}
