import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
const APPROVE_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

const updateSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  validUntil: z.string().nullable().optional(),
  serviceReportId: z.string().nullable().optional(),
});

const actionSchema = z.object({
  action: z.enum(["send", "approve", "reject", "revert_draft"]),
});

const includeClause = {
  customer: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true, address: true, city: true, district: true, taxNumber: true, taxOffice: true } },
  createdBy: { include: { user: { select: { firstName: true, lastName: true } } } },
  serviceReport: { select: { id: true, reportNumber: true } },
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: includeClause });
  if (!quote) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  return NextResponse.json({ quote });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Aksiyon mu, güncelleme mi?
  const actionParsed = actionSchema.safeParse(body);
  if (actionParsed.success) {
    const { action } = actionParsed.data;

    if ((action === "approve" || action === "reject") && !APPROVE_ROLES.includes(user.role))
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

    let data: Record<string, unknown> = {};
    if (action === "send") {
      if (quote.status !== "DRAFT") return NextResponse.json({ error: "Sadece taslak teklifler gönderilebilir" }, { status: 400 });
      data = { status: "SENT", sentAt: new Date() };
    } else if (action === "approve") {
      if (quote.status !== "SENT") return NextResponse.json({ error: "Sadece gönderilmiş teklifler onaylanabilir" }, { status: 400 });
      data = { status: "APPROVED", approvedAt: new Date() };
    } else if (action === "reject") {
      if (!["SENT", "APPROVED"].includes(quote.status)) return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
      data = { status: "REJECTED", rejectedAt: new Date() };
    } else if (action === "revert_draft") {
      if (!APPROVE_ROLES.includes(user.role)) return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
      if (!["SENT", "REJECTED"].includes(quote.status)) return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
      data = { status: "DRAFT", sentAt: null };
    }

    const updated = await prisma.quote.update({ where: { id }, data, include: includeClause });
    return NextResponse.json({ quote: updated });
  }

  // Güncelleme
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (quote.status !== "DRAFT") return NextResponse.json({ error: "Sadece taslak teklifler düzenlenebilir" }, { status: 400 });

  const { items, taxRate, validUntil, serviceReportId, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = { ...rest };

  if (items !== undefined) {
    const rate = taxRate ?? Number(quote.taxRate);
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const taxAmount = Math.round(subtotal * rate) / 100;
    const total = subtotal + taxAmount;
    updateData.items = items;
    updateData.taxRate = rate;
    updateData.subtotal = subtotal;
    updateData.taxAmount = taxAmount;
    updateData.total = total;
  } else if (taxRate !== undefined) {
    const subtotal = Number(quote.subtotal);
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    updateData.taxRate = taxRate;
    updateData.taxAmount = taxAmount;
    updateData.total = subtotal + taxAmount;
  }

  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
  if (serviceReportId !== undefined) updateData.serviceReportId = serviceReportId || null;

  const updated = await prisma.quote.update({ where: { id }, data: updateData, include: includeClause });
  return NextResponse.json({ quote: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !APPROVE_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (!["DRAFT", "REJECTED", "EXPIRED"].includes(quote.status))
    return NextResponse.json({ error: "Bu teklif silinemez" }, { status: 400 });

  await prisma.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
