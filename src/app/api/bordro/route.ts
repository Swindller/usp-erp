import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

// 2025 Türkiye vergi dilimleri
function calcIncomeTax(gross: number): number {
  const brackets = [
    { limit: 158000, rate: 0.15 },
    { limit: 330000, rate: 0.20 },
    { limit: 800000, rate: 0.27 },
    { limit: 4300000, rate: 0.35 },
    { limit: Infinity, rate: 0.40 },
  ];
  let tax = 0, prev = 0;
  for (const b of brackets) {
    if (gross <= prev) break;
    tax += (Math.min(gross, b.limit) - prev) * b.rate;
    prev = b.limit;
  }
  return Math.round(tax * 100) / 100;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const payrolls = await prisma.payroll.findMany({
    where: { year, month },
    include: { personnel: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  // Auto-generate for personnel without payroll this month
  const allPersonnel = await prisma.personnel.findMany({
    where: { isActive: true },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });

  return NextResponse.json({ payrolls, allPersonnel, year, month });
}

const createSchema = z.object({
  personnelId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  baseSalary: z.coerce.number().positive(),
  mealAllowance: z.coerce.number().default(0),
  transportAllowance: z.coerce.number().default(0),
  otherBonus: z.coerce.number().default(0),
  workingDays: z.coerce.number().int().default(0),
  absenceDays: z.coerce.number().int().default(0),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const d = parsed.data;

  // Gün bazlı maaş hesabı
  const dailySalary = d.baseSalary / 30;
  const adjustedBase = d.baseSalary - (dailySalary * d.absenceDays);

  const grossSalary = adjustedBase + d.mealAllowance + d.transportAllowance + d.otherBonus;

  // Kesintiler
  const sgkEmployee = Math.round(grossSalary * 0.14 * 100) / 100;
  const unemploymentEmp = Math.round(grossSalary * 0.01 * 100) / 100;
  const incomeTax = calcIncomeTax(grossSalary - sgkEmployee - unemploymentEmp);
  const stampTax = Math.round(grossSalary * 0.00759 * 100) / 100;
  const netSalary = grossSalary - sgkEmployee - unemploymentEmp - incomeTax - stampTax;

  // İşveren maliyeti
  const sgkEmployer = Math.round(grossSalary * 0.205 * 100) / 100;
  const unemploymentEmp2 = Math.round(grossSalary * 0.02 * 100) / 100;
  const totalEmployerCost = grossSalary + sgkEmployer + unemploymentEmp2;

  const payroll = await prisma.payroll.upsert({
    where: { personnelId_year_month: { personnelId: d.personnelId, year: d.year, month: d.month } },
    update: {
      baseSalary: d.baseSalary, mealAllowance: d.mealAllowance, transportAllowance: d.transportAllowance,
      otherBonus: d.otherBonus, workingDays: d.workingDays, absenceDays: d.absenceDays,
      grossSalary, sgkEmployee, unemploymentEmp, incomeTax, stampTax, netSalary,
      sgkEmployer, unemploymentEmp2, totalEmployerCost, notes: d.notes ?? null,
    },
    create: {
      personnelId: d.personnelId, year: d.year, month: d.month,
      baseSalary: d.baseSalary, mealAllowance: d.mealAllowance, transportAllowance: d.transportAllowance,
      otherBonus: d.otherBonus, workingDays: d.workingDays, absenceDays: d.absenceDays,
      grossSalary, sgkEmployee, unemploymentEmp, incomeTax, stampTax, netSalary,
      sgkEmployer, unemploymentEmp2, totalEmployerCost, notes: d.notes ?? null,
    },
    include: { personnel: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return NextResponse.json({ payroll }, { status: 201 });
}
