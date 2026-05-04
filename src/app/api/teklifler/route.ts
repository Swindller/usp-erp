import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
  taxRate: z.coerce.number().min(0).max(100).default(20),
  validUntil: z.string().optional(),
  serviceReportId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true } },
        createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
        serviceReport: { select: { id: true, reportNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quote.count({ where }),
  ]);

  return NextResponse.json({ quotes, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { items, taxRate, ...rest } = parsed.data;

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  // Numara üret: TKL-YYYY-NNN
  const year = new Date().getFullYear();
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: `TKL-${year}-` } },
    orderBy: { quoteNumber: "desc" },
  });
  const seq = last ? parseInt(last.quoteNumber.split("-")[2] || "0") + 1 : 1;
  const quoteNumber = `TKL-${year}-${String(seq).padStart(3, "0")}`;

  const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      customerId: rest.customerId,
      title: rest.title,
      notes: rest.notes,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
      serviceReportId: rest.serviceReportId || undefined,
      createdById: personnel?.id,
    },
    include: {
      customer: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true } },
      createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return NextResponse.json({ quote }, { status: 201 });
}
