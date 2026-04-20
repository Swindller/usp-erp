import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { TaxType, TaxStatus } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const [records, upcoming] = await Promise.all([
    prisma.taxRecord.findMany({
      where: { year },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.taxRecord.findMany({
      where: { status: { in: [TaxStatus.PENDING, TaxStatus.OVERDUE] }, dueDate: { gte: new Date() } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({ records, upcoming, year });
}

const createSchema = z.object({
  type: z.nativeEnum(TaxType),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12).nullable().optional(),
  quarter: z.coerce.number().int().min(1).max(4).nullable().optional(),
  baseAmount: z.coerce.number().min(0),
  taxAmount: z.coerce.number().min(0),
  kdvDeducted: z.coerce.number().default(0),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const d = parsed.data;
  const netTax = d.taxAmount - d.kdvDeducted;

  const record = await prisma.taxRecord.create({
    data: {
      type: d.type, year: d.year, month: d.month ?? null, quarter: d.quarter ?? null,
      baseAmount: d.baseAmount, taxAmount: d.taxAmount, kdvDeducted: d.kdvDeducted,
      netTax: Math.max(0, netTax), dueDate: new Date(d.dueDate),
      notes: d.notes ?? null,
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}
