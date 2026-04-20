import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { IncomingInvoiceStatus } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

async function checkAccess() {
  const user = await getAuthUser();
  if (!user) return null;
  if (ALLOWED_ROLES.includes(user.role)) return user;
  // Check muhasebe permission
  const personnel = await prisma.personnel.findFirst({ where: { userId: user.id } });
  if (personnel?.permissions?.includes("muhasebe")) return user;
  return null;
}

const createSchema = z.object({
  invoiceNumber: z.string().min(1),
  supplierName: z.string().min(1),
  supplierTaxNo: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  subtotal: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0).default(0),
  dueDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await checkAccess();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as IncomingInvoiceStatus | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const where = status ? { status } : {};

  const [invoices, total] = await Promise.all([
    prisma.incomingInvoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.incomingInvoice.count({ where }),
  ]);

  return NextResponse.json({ invoices, total, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const user = await checkAccess();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { invoiceNumber, supplierName, supplierTaxNo, category, description, subtotal, vatAmount, dueDate, invoiceDate, notes } = parsed.data;

  const total = subtotal + vatAmount;

  const invoice = await prisma.incomingInvoice.create({
    data: {
      invoiceNumber,
      supplierName,
      supplierTaxNo: supplierTaxNo || null,
      category: category || null,
      description: description || null,
      subtotal,
      vatAmount,
      total,
      dueDate: dueDate ? new Date(dueDate) : null,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      notes: notes || null,
    },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
