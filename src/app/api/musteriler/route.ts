import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CustomerType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !ALLOWED_ROLES.includes(user.role)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { taxNumber: { contains: q } },
      ],
    },
    select: {
      id: true, type: true, firstName: true, lastName: true,
      companyName: true, phone: true, email: true, address: true, city: true, district: true,
    },
    take: 10,
  });

  return NextResponse.json({ customers });
}

const createSchema = z.object({
  type: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  tcNumber: z.string().optional(),
  companyName: z.string().optional(),
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7),
  phone2: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data = parsed.data;
  const customer = await prisma.customer.create({ data: { ...data, email: data.email || undefined } });
  return NextResponse.json({ customer }, { status: 201 });
}
