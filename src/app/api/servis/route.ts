import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ServiceStatus, ServiceType, Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

async function checkAuth() {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  // Fetch personnel relation
  const full = await prisma.user.findUnique({
    where: { email: user.email },
    include: { personnel: true },
  });
  return full;
}

export async function GET(req: NextRequest) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ServiceStatus | null;
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));

  const where: Prisma.ServiceReportWhereInput = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { reportNumber: { contains: search, mode: "insensitive" } },
      { deviceSerial: { contains: search, mode: "insensitive" } },
      { deviceModel: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search } } },
    ];
  }
  if (user.role === "TECHNICIAN" && user.personnel) {
    where.technicianId = user.personnel.id;
  }

  const [reports, total] = await Promise.all([
    prisma.serviceReport.findMany({
      where,
      include: {
        customer: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true } },
        technician: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.serviceReport.count({ where }),
  ]);

  return NextResponse.json({ reports, total, page, limit, pages: Math.ceil(total / limit) });
}

const partSchema = z.object({
  productId: z.string(),
  name: z.string(),
  qty: z.number(),
  unitPrice: z.number().nullable(),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceSerial: z.string().optional(),
  deviceYear: z.coerce.number().optional(),
  devicePower: z.string().optional(),
  deviceVoltage: z.string().optional(),
  devicePhase: z.string().optional(),
  productId: z.string().optional(),
  serviceType: z.nativeEnum(ServiceType),
  status: z.nativeEnum(ServiceStatus).optional(),
  complaint: z.string().min(1),
  diagnosis: z.string().optional(),
  operations: z.string().optional(),
  partsUsed: z.array(partSchema).optional(),
  technicianId: z.string().optional(),
  estimatedDate: z.string().optional(),
  isWarranty: z.boolean().default(false),
  internalNotes: z.string().optional(),
  customerNote: z.string().optional(),
  customerSignature: z.string().optional(),
  technicianSignature: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = parsed.data;
  const year = new Date().getFullYear();
  const count = await prisma.serviceReport.count({ where: { reportNumber: { startsWith: `SR-${year}-` } } });
  const reportNumber = `SR-${year}-${String(count + 1).padStart(4, "0")}`;

  const report = await prisma.serviceReport.create({
    data: {
      reportNumber,
      customerId: data.customerId,
      deviceBrand: data.deviceBrand,
      deviceModel: data.deviceModel,
      deviceSerial: data.deviceSerial,
      deviceYear: data.deviceYear,
      devicePower: data.devicePower,
      deviceVoltage: data.deviceVoltage,
      devicePhase: data.devicePhase,
      productId: data.productId || undefined,
      serviceType: data.serviceType,
      status: data.status ?? ServiceStatus.RECEIVED,
      complaint: data.complaint,
      diagnosis: data.diagnosis,
      operations: data.operations,
      partsUsed: data.partsUsed ? data.partsUsed : undefined,
      technicianId: data.technicianId || undefined,
      estimatedDate: data.estimatedDate ? new Date(data.estimatedDate) : undefined,
      isWarranty: data.isWarranty,
      internalNotes: data.internalNotes,
      customerNote: data.customerNote,
      customerSignature: data.customerSignature,
      technicianSignature: data.technicianSignature,
      logs: {
        create: {
          type: "STATUS_CHANGE",
          description: `Servis raporu oluşturuldu. Numara: ${reportNumber}`,
          newValue: ServiceStatus.RECEIVED,
          personnelId: user.personnel?.id,
        },
      },
    },
    include: { customer: true },
  });

  return NextResponse.json({ report }, { status: 201 });
}
