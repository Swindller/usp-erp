import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

function toNum(v: Prisma.Decimal | null | undefined): number {
  return v ? parseFloat(v.toString()) : 0;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InvoiceStatus | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const now = new Date();

  const [paidAgg, pendingAgg, overdueAgg, totalInvoices, invoices] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: InvoiceStatus.PAID }, _sum: { total: true }, _count: { _all: true } }),
    prisma.invoice.aggregate({
      where: { status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] }, OR: [{ dueDate: null }, { dueDate: { gte: now } }] },
      _sum: { total: true, paidAmount: true }, _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] }, dueDate: { lt: now } },
      _sum: { total: true }, _count: { _all: true },
    }),
    prisma.invoice.count({ where: status ? { status } : undefined }),
    prisma.invoice.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: { select: { type: true, firstName: true, lastName: true, companyName: true, phone: true } },
        serviceReport: { select: { reportNumber: true, id: true } },
        payments: { select: { amount: true, paidAt: true, method: true }, orderBy: { paidAt: "desc" }, take: 3 },
      },
      orderBy: { invoiceDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    stats: {
      paid: { total: toNum(paidAgg._sum.total), count: paidAgg._count._all },
      pending: { total: toNum(pendingAgg._sum.total) - toNum(pendingAgg._sum.paidAmount), count: pendingAgg._count._all },
      overdue: { total: toNum(overdueAgg._sum.total), count: overdueAgg._count._all },
    },
    invoices: invoices.map((inv) => ({
      ...inv,
      isOverdue: inv.dueDate && new Date(inv.dueDate) < now && inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED,
      subtotal: toNum(inv.subtotal),
      vatAmount: toNum(inv.vatAmount),
      total: toNum(inv.total),
      paidAmount: toNum(inv.paidAmount),
    })),
    total: totalInvoices,
    page,
    pages: Math.ceil(totalInvoices / limit),
  });
}
