import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { hash } from "bcryptjs";
import { PersonnelRole, UserRole } from "@prisma/client";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  personnelRole: z.nativeEnum(PersonnelRole),
  positionTitle: z.string().optional(),
  department: z.string().optional(),
  speciality: z.string().optional(),
  phone: z.string().optional(),
  salary: z.coerce.number().optional(),
  permissions: z.array(z.string()).default([]),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const personnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ personnel });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { firstName, lastName, email, password, personnelRole, positionTitle, department, speciality, phone, salary, permissions } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { personnel: true },
  });

  const passwordHash = await hash(password, 12);
  const userRole: UserRole = ["MANAGER", "SUPERVISOR"].includes(personnelRole) ? "MANAGER" : "TECHNICIAN";

  // E-posta mevcut ama kullanıcı pasif silinmişse → yeniden aktive et
  if (existing) {
    const hasActivePersonnel = existing.personnel?.isActive === true;
    if (hasActivePersonnel) {
      return NextResponse.json({ error: "Bu e-posta zaten kullanılıyor." }, { status: 409 });
    }

    // User'ı güncelle ve aktive et
    await prisma.user.update({
      where: { id: existing.id },
      data: { firstName, lastName, passwordHash, role: userRole, isActive: true },
    });

    let personnel;
    if (existing.personnel) {
      // Mevcut personnel kaydını yeniden aktive et
      personnel = await prisma.personnel.update({
        where: { id: existing.personnel.id },
        data: {
          role: personnelRole,
          positionTitle: positionTitle || null,
          department: department ?? null,
          speciality: speciality ?? null,
          phone: phone ?? null,
          salary: salary ?? null,
          permissions,
          isActive: true,
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      });
    } else {
      personnel = await prisma.personnel.create({
        data: {
          userId: existing.id,
          role: personnelRole,
          positionTitle: positionTitle || null,
          department,
          speciality,
          phone,
          salary: salary ?? null,
          permissions,
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      });
    }

    return NextResponse.json({ personnel }, { status: 201 });
  }

  const newUser = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role: userRole },
  });

  const personnel = await prisma.personnel.create({
    data: {
      userId: newUser.id,
      role: personnelRole,
      positionTitle: positionTitle || null,
      department,
      speciality,
      phone,
      salary: salary ?? null,
      permissions,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
  });

  return NextResponse.json({ personnel }, { status: 201 });
}
