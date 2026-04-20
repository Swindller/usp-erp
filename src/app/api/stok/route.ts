import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { StockMovementType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 30;

  // Get products with current stock (from Product.stock field)
  const where = q ? {
    OR: [
      { sku: { contains: q, mode: "insensitive" as const } },
      { translations: { some: { name: { contains: q, mode: "insensitive" as const } } } },
    ],
  } : {};

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true, sku: true, stock: true, price: true,
        brand: { select: { name: true } },
        translations: { where: { locale: "tr" }, select: { name: true }, take: 1 },
      },
      orderBy: { stock: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // Recent movements
  const recentMovements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ products, total, recentMovements });
}

const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = movementSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { productId, type, quantity, unitPrice, reference, notes } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: { productId, type, quantity, unitPrice: unitPrice ?? null, reference: reference ?? null, notes: notes ?? null, createdBy: user.email },
    });

    // Update product stock
    const delta = (type === "IN" || type === "RETURN") ? quantity : -quantity;
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    });

    return movement;
  });

  return NextResponse.json({ movement: result }, { status: 201 });
}
