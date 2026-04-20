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
  const personnel = await prisma.personnel.findFirst({ where: { userId: user.id } });
  if (personnel?.permissions?.includes("muhasebe")) return user;
  return null;
}

const updateSchema = z.object({
  invoiceNumber: z.string().min(1).optional(),
  supplierName: z.string().min(1).optional(),
  supplierTaxNo: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  subtotal: z.coerce.number().min(0).optional(),
  vatAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  status: z.nativeEnum(IncomingInvoiceStatus).optional(),
  dueDate: z.string().nullable().optional(),
  invoiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAccess();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;

  const existing = await prisma.incomingInvoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const subtotal = data.subtotal ?? parseFloat(existing.subtotal.toString());
  const vatAmount = data.vatAmount ?? parseFloat(existing.vatAmount.toString());
  const total = subtotal + vatAmount;

  // Auto-set status based on paid amount
  const paidAmount = data.paidAmount ?? parseFloat(existing.paidAmount.toString());
  let status = data.status ?? existing.status;
  if (data.paidAmount !== undefined) {
    if (paidAmount >= total) status = IncomingInvoiceStatus.PAID;
    else if (paidAmount > 0) status = IncomingInvoiceStatus.PARTIALLY_PAID;
    else status = IncomingInvoiceStatus.UNPAID;
  }

  const invoice = await prisma.incomingInvoice.update({
    where: { id },
    data: {
      ...(data.invoiceNumber && { invoiceNumber: data.invoiceNumber }),
      ...(data.supplierName && { supplierName: data.supplierName }),
      ...(data.supplierTaxNo !== undefined && { supplierTaxNo: data.supplierTaxNo || null }),
      ...(data.category !== undefined && { category: data.category || null }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.subtotal !== undefined && { subtotal }),
      ...(data.vatAmount !== undefined && { vatAmount }),
      total,
      ...(data.paidAmount !== undefined && { paidAmount }),
      status,
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.invoiceDate && { invoiceDate: new Date(data.invoiceDate) }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(status === IncomingInvoiceStatus.PAID && !existing.paidAt && { paidAt: new Date() }),
    },
  });

  return NextResponse.json({ invoice });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.incomingInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
