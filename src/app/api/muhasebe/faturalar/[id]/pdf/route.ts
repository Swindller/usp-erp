import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/muhasebe/InvoicePDF";
import { createElement } from "react";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      serviceReport: { select: { reportNumber: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const pdfProps = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subtotal: parseFloat(invoice.subtotal.toString()),
    vatRate: parseFloat(invoice.vatRate.toString()),
    vatAmount: parseFloat(invoice.vatAmount.toString()),
    total: parseFloat(invoice.total.toString()),
    paidAmount: parseFloat(invoice.paidAmount.toString()),
    lineItems: (invoice.lineItems as { description: string; qty: number; unitPrice: number; vatRate: number; lineTotal?: number }[]) ?? [],
    notes: invoice.notes,
    customerSnapshot: invoice.customerSnapshot as { name?: string | null; phone?: string | null; taxNumber?: string | null; taxOffice?: string | null; address?: string | null } | null,
    customer: invoice.customer
      ? {
          type: invoice.customer.type,
          firstName: invoice.customer.firstName,
          lastName: invoice.customer.lastName,
          companyName: invoice.customer.companyName,
          phone: invoice.customer.phone,
          email: invoice.customer.email,
          taxNumber: invoice.customer.taxNumber,
          taxOffice: invoice.customer.taxOffice,
          address: invoice.customer.address,
        }
      : null,
    serviceReport: invoice.serviceReport,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(InvoicePDF, { invoice: pdfProps }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
