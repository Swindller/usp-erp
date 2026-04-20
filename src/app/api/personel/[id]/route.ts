import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hash } from "bcryptjs";
import { PersonnelRole } from "@prisma/client";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  personnelRole: z.nativeEnum(PersonnelRole).optional(),
  positionTitle: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  speciality: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  salary: z.coerce.number().nullable().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { firstName, lastName, personnelRole, positionTitle, department, speciality, phone, salary, permissions, isActive } = parsed.data;

  const personnel = await prisma.personnel.update({
    where: { id },
    data: {
      ...(personnelRole && { role: personnelRole }),
      ...(positionTitle !== undefined && { positionTitle }),
      ...(department !== undefined && { department }),
      ...(speciality !== undefined && { speciality }),
      ...(phone !== undefined && { phone }),
      ...(salary !== undefined && { salary }),
      ...(permissions !== undefined && { permissions }),
      ...(isActive !== undefined && { isActive }),
      user: (firstName || lastName) ? {
        update: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
        },
      } : undefined,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
  });

  return NextResponse.json({ personnel });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Soft delete: hem personnel hem user'ı pasife al (email yeniden kullanılabilsin)
  const personnel = await prisma.personnel.update({
    where: { id },
    data: { isActive: false },
    select: { userId: true },
  });
  await prisma.user.update({ where: { id: personnel.userId }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}

// PUT — şifre değiştir
const passwordSchema = z.object({ password: z.string().min(6) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = passwordSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Şifre en az 6 karakter olmalıdır." }, { status: 400 });

  const personnel = await prisma.personnel.findUnique({ where: { id }, include: { user: true } });
  if (!personnel) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: personnel.userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
