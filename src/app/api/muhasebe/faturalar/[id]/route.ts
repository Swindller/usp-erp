import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } },
      serviceReport: { select: { id: true, reportNumber: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const schema = z.object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    dueDate: z.string().nullable().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    payment: z.object({
      amount: z.coerce.number().positive(),
      method: z.nativeEnum(PaymentMethod),
      reference: z.string().optional(),
      note: z.string().optional(),
    }).optional(),
  });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;

  const invoice = await prisma.$transaction(async (tx) => {
    let updated = await tx.invoice.update({ where: { id }, data: updateData });
    if (data.payment) {
      await tx.payment.create({ data: { invoiceId: id, amount: data.payment.amount, method: data.payment.method, reference: data.payment.reference, note: data.payment.note } });
      const allPayments = await tx.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
      const paidAmount = parseFloat((allPayments._sum.amount ?? 0).toString());
      const total = parseFloat(updated.total.toString());
      const newStatus = paidAmount >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      updated = await tx.invoice.update({ where: { id }, data: { paidAmount, status: newStatus, paidAt: newStatus === InvoiceStatus.PAID ? new Date() : null } });
    }
    return updated;
  });

  return NextResponse.json({ invoice });
}
