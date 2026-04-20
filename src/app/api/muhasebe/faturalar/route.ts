import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { InvoiceType } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

const lineItemSchema = z.object({
  description: z.string(),
  qty:         z.coerce.number().positive(),
  unitPrice:   z.coerce.number().min(0),
  vatRate:     z.coerce.number().min(0).max(100),
});

const schema = z.object({
  serviceReportId: z.string().optional(),
  customerId:      z.string().min(1),
  vatRate:         z.coerce.number().min(0).max(100).default(20),
  lineItems:       z.array(lineItemSchema).min(1),
  dueDate:         z.string().optional(),
  notes:           z.string().optional(),
  type:            z.nativeEnum(InvoiceType).optional(),
});

async function nextInvoiceNumber(): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last   = await prisma.invoice.findFirst({
    where:   { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select:  { invoiceNumber: true },
  });
  const seq = last
    ? parseInt(last.invoiceNumber.replace(prefix, ""), 10) + 1
    : 1;
  return prefix + String(seq).padStart(4, "0");
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { serviceReportId, customerId, vatRate, lineItems, dueDate, notes, type } = parsed.data;

  // Hesapla
  const subtotal   = lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vatAmount  = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total      = subtotal + vatAmount;

  // Müşteri snapshot
  const customer = await prisma.customer.findUnique({
    where:  { id: customerId },
    select: { type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true, address: true, taxNumber: true, taxOffice: true },
  });
  if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });

  const invoiceNumber = await nextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      type:        type ?? InvoiceType.SERVICE,
      customerId,
      serviceReportId: serviceReportId || null,
      customerSnapshot: customer,
      subtotal,
      vatRate,
      vatAmount,
      discountAmount: 0,
      total,
      invoiceDate: new Date(),
      dueDate:     dueDate ? new Date(dueDate) : null,
      lineItems:   lineItems.map((l) => ({
        ...l,
        lineTotal: l.qty * l.unitPrice,
      })),
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
