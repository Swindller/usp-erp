import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { MealType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const [personnel, attendances] = await Promise.all([
    prisma.personnel.findMany({
      where: { isActive: true },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: [{ personnelId: "asc" }, { date: "asc" }],
    }),
  ]);

  return NextResponse.json({ personnel, attendances, year, month });
}

const upsertSchema = z.object({
  personnelId: z.string().min(1),
  date: z.string(),
  isAbsent: z.boolean().default(false),
  absenceReason: z.string().nullable().optional(),
  mealType: z.nativeEnum(MealType).default(MealType.OUTSIDE),
  mealCost: z.coerce.number().default(0),
  notes: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { personnelId, date, isAbsent, absenceReason, mealType, mealCost, notes } = parsed.data;

  const attendance = await prisma.attendance.upsert({
    where: { personnelId_date: { personnelId, date: new Date(date) } },
    update: { isAbsent, absenceReason: absenceReason ?? null, mealType, mealCost, notes: notes ?? null },
    create: { personnelId, date: new Date(date), isAbsent, absenceReason: absenceReason ?? null, mealType, mealCost, notes: notes ?? null },
  });

  return NextResponse.json({ attendance });
}
