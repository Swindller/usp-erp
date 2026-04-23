import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ServiceStatus, ServiceType, InvoiceType, InvoiceStatus, Prisma } from "@prisma/client";

interface PartItem { productId?: string; name: string; partNo?: string; quantity: number; unitPrice: number; }
function toNum(val: Prisma.Decimal | null | undefined): number { return val ? parseFloat(val.toString()) : 0; }

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

async function checkAuth() {
  const authUser = await getAuthUser();
  if (!authUser || !ALLOWED_ROLES.includes(authUser.role)) return null;
  const user = await prisma.user.findUnique({ where: { email: authUser.email }, include: { personnel: true } });
  if (!user) return null;
  return user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const report = await prisma.serviceReport.findUnique({
    where: { id },
    include: {
      customer: true,
      technician: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      additionalTechnicians: { include: { user: { select: { firstName: true, lastName: true } } } },
      logs: {
        include: { personnel: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "desc" },
      },
      invoices: { select: { id: true, invoiceNumber: true, status: true, total: true } },
    },
  });

  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  if (user.role === "TECHNICIAN" && user.personnel && report.technicianId !== user.personnel.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ report });
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
  RECEIVED: "Servise Geldi", DIAGNOSING: "İnceleniyor", DIAGNOSED: "Tespit Yapıldı",
  WAITING_PARTS: "Parça Bekliyor", IN_REPAIR: "Montaj Yapılıyor", QUALITY_CHECK: "Test Ediliyor",
  READY: "Teslime Hazır", DELIVERED: "Teslim Edildi", CANCELLED: "İptal", WARRANTY_RETURN: "Garanti İadesi",
};

const updateSchema = z.object({
  status: z.nativeEnum(ServiceStatus).optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  diagnosis: z.string().optional(),
  operations: z.string().optional(),
  partsUsed: z.array(z.object({
    productId: z.string().optional(), name: z.string(), partNo: z.string().optional(),
    quantity: z.number(), unitPrice: z.number(),
  })).optional(),
  technicianId: z.string().nullable().optional(),
  additionalTechnicianIds: z.array(z.string()).optional(),
  estimatedDate: z.string().nullable().optional(),
  laborCost: z.coerce.number().optional(),
  partsCost: z.coerce.number().optional(),
  serviceCost: z.coerce.number().optional(),
  totalCost: z.coerce.number().optional(),
  isWarranty: z.boolean().optional(),
  warrantyUntil: z.string().nullable().optional(),
  internalNotes: z.string().optional(),
  customerNote: z.string().optional(),
  customerSignature: z.string().optional(),
  technicianSignature: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  estimatedCompletionDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const existing = await prisma.serviceReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  const logEntries: Array<{ type: string; description: string; oldValue?: string; newValue?: string; personnelId?: string }> = [];

  if (data.status && data.status !== existing.status) {
    updateData.status = data.status;
    logEntries.push({ type: "STATUS_CHANGE", description: `Durum: ${STATUS_LABELS[existing.status]} → ${STATUS_LABELS[data.status]}`, oldValue: existing.status, newValue: data.status, personnelId: user.personnel?.id });
    if (data.status === ServiceStatus.DELIVERED && !existing.deliveredAt) updateData.deliveredAt = new Date();
    if ((data.status === ServiceStatus.READY || data.status === ServiceStatus.QUALITY_CHECK) && !existing.completedAt) updateData.completedAt = new Date();
  }
  if (data.technicianId !== undefined) {
    updateData.technicianId = data.technicianId;
    if (data.technicianId && data.technicianId !== existing.technicianId) logEntries.push({ type: "TECHNICIAN_ASSIGNED", description: "Teknisyen ataması güncellendi", personnelId: user.personnel?.id });
  }
  if (data.additionalTechnicianIds !== undefined) {
    updateData.additionalTechnicians = { set: data.additionalTechnicianIds.map((id) => ({ id })) };
  }
  if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis;
  if (data.operations !== undefined) updateData.operations = data.operations;
  if (data.partsUsed !== undefined) { updateData.partsUsed = data.partsUsed; logEntries.push({ type: "PARTS_UPDATED", description: `Parçalar güncellendi (${data.partsUsed.length} kalem)`, personnelId: user.personnel?.id }); }
  if (data.serviceType !== undefined) updateData.serviceType = data.serviceType;
  if (data.estimatedDate !== undefined) updateData.estimatedDate = data.estimatedDate ? new Date(data.estimatedDate) : null;
  if (data.laborCost !== undefined) updateData.laborCost = data.laborCost;
  if (data.partsCost !== undefined) updateData.partsCost = data.partsCost;
  if (data.serviceCost !== undefined) updateData.serviceCost = data.serviceCost;
  if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;
  if (data.isWarranty !== undefined) updateData.isWarranty = data.isWarranty;
  if (data.warrantyUntil !== undefined) updateData.warrantyUntil = data.warrantyUntil ? new Date(data.warrantyUntil) : null;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.customerNote !== undefined) updateData.customerNote = data.customerNote;
  if (data.customerSignature !== undefined) updateData.customerSignature = data.customerSignature;
  if (data.technicianSignature !== undefined) updateData.technicianSignature = data.technicianSignature;
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
  if (data.deliveredAt !== undefined) updateData.deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : null;
  if (data.estimatedCompletionDate !== undefined) updateData.estimatedCompletionDate = data.estimatedCompletionDate ? new Date(data.estimatedCompletionDate) : null;

  const isTransitionToReady = data.status === ServiceStatus.READY && existing.status !== ServiceStatus.READY;

  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceReport.update({
      where: { id }, data: updateData,
      include: {
        customer: true,
        technician: { include: { user: { select: { firstName: true, lastName: true } } } },
        additionalTechnicians: { include: { user: { select: { firstName: true, lastName: true } } } },
        logs: { include: { personnel: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: "desc" } },
      },
    });

    if (logEntries.length > 0) {
      await tx.serviceLog.createMany({
        data: logEntries.map((e) => ({
          serviceReportId: id, type: e.type as "STATUS_CHANGE" | "NOTE_ADDED" | "TECHNICIAN_ASSIGNED" | "PARTS_UPDATED" | "PHOTO_ADDED" | "CUSTOMER_CONTACT" | "FIELD_VISIT" | "DIAGNOSIS_UPDATED",
          description: e.description, oldValue: e.oldValue, newValue: e.newValue, personnelId: e.personnelId,
        })),
      });
    }

    if (isTransitionToReady) {
      const parts = ((existing.partsUsed as unknown) ?? []) as PartItem[];
      const stockUpdates = parts.filter((p) => p.productId && p.quantity > 0)
        .map((p) => tx.product.update({ where: { id: p.productId! }, data: { stock: { decrement: p.quantity } } }));
      await Promise.all(stockUpdates);
      if (stockUpdates.length > 0) await tx.serviceLog.create({ data: { serviceReportId: id, type: "PARTS_UPDATED", description: `${stockUpdates.length} üründen stok düşüldü`, personnelId: user.personnel?.id } });

      const existingInvoice = await tx.invoice.findFirst({ where: { serviceReportId: id } });
      if (!existingInvoice) {
        const laborCost = toNum(existing.laborCost);
        const partsCost = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
        const subtotal = toNum(existing.totalCost) || (laborCost + partsCost) || 0;
        const vatRate = 20;
        const vatAmount = subtotal * (vatRate / 100);
        const total = subtotal + vatAmount;

        const year = new Date().getFullYear();
        const invCount = await tx.invoice.count({ where: { invoiceNumber: { startsWith: `INV-${year}-` } } });
        const invoiceNumber = `INV-${year}-${String(invCount + 1).padStart(4, "0")}`;
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);

        const lineItems = [
          ...(laborCost > 0 ? [{ description: "İşçilik Ücreti", qty: 1, unitPrice: laborCost, vatRate, lineTotal: laborCost }] : []),
          ...parts.map((p) => ({ description: p.name, qty: p.quantity, unitPrice: p.unitPrice, vatRate, lineTotal: p.quantity * p.unitPrice })),
          ...(subtotal === 0 ? [{ description: "Servis Ücreti", qty: 1, unitPrice: 0, vatRate, lineTotal: 0 }] : []),
        ];

        const customer = await tx.customer.findUnique({ where: { id: existing.customerId } });
        const customerSnapshot = customer ? {
          name: customer.type === "CORPORATE" ? customer.companyName : [customer.firstName, customer.lastName].filter(Boolean).join(" "),
          phone: customer.phone, taxNumber: customer.taxNumber, taxOffice: customer.taxOffice, address: customer.address,
        } : null;

        await tx.invoice.create({
          data: {
            invoiceNumber, type: InvoiceType.SERVICE, status: InvoiceStatus.DRAFT,
            customerId: existing.customerId, serviceReportId: id,
            subtotal, vatRate, vatAmount, total, lineItems: lineItems as Prisma.InputJsonValue,
            dueDate, customerSnapshot: customerSnapshot as Prisma.InputJsonValue,
          },
        });

        await tx.serviceLog.create({
          data: {
            serviceReportId: id, type: "NOTE_ADDED",
            description: `Fatura oluşturuldu: ${invoiceNumber} · ₺${total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
            personnelId: user.personnel?.id,
          },
        });
      }
    }
    return updated;
  });

  return NextResponse.json({ report });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (authUser.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Sadece Süper Admin silebilir" }, { status: 403 });

  const { id } = await params;

  // Bağlı faturalarda serviceReportId'yi null yap (cascade yok)
  await prisma.invoice.updateMany({ where: { serviceReportId: id }, data: { serviceReportId: null } });
  // Raporu sil (ServiceLog'lar cascade ile silinir)
  await prisma.serviceReport.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
