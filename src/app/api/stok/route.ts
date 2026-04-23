import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { StockMovementType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

// ─── E-ticaret stok sync ──────────────────────────────────────────────────────
/**
 * Ürün teslim alındığında (IN / RETURN hareketi) e-ticaret sitesine güncel stok gönderir.
 * Hata olursa log'a yazar ama ERP işlemini bloklamaz.
 */
async function syncStockToEcommerce(productId: string) {
  const eticaret = process.env.ETICARET_URL;
  const secret   = process.env.ERP_SYNC_SECRET;
  if (!eticaret || !secret) return; // env eksikse sessizce atla

  try {
    const product = await prisma.product.findUnique({
      where:  { id: productId },
      select: { sku: true, stock: true },
    });
    if (!product?.sku) return; // SKU'su olmayan ürünleri senkronize etme

    const res = await fetch(`${eticaret}/api/internal/stock-update`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({
        updates: [{ sku: product.sku, stock: product.stock }],
      }),
      // Timeout için AbortSignal
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[StockSync] e-ticaret sync başarısız (${res.status}): ${text}`);
    } else {
      console.log(`[StockSync] SKU ${product.sku} → stok ${product.stock} gönderildi`);
    }
  } catch (err) {
    // Ağ hatası, timeout vb. — ERP kaydını bloklamıyoruz
    console.error("[StockSync] e-ticaret sync hatası:", err);
  }
}

// ─── GET /api/stok ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q     = searchParams.get("q") || "";
  const page  = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 30;

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

  const recentMovements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ products, total, recentMovements });
}

// ─── POST /api/stok ───────────────────────────────────────────────────────────

const movementSchema = z.object({
  productId: z.string().min(1),
  type:      z.nativeEnum(StockMovementType),
  quantity:  z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().optional(),
  reference: z.string().optional(),
  notes:     z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = movementSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { productId, type, quantity, unitPrice, reference, notes } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type,
        quantity,
        unitPrice:  unitPrice ?? null,
        reference:  reference ?? null,
        notes:      notes ?? null,
        createdBy:  user.email,
      },
    });

    const delta = (type === "IN" || type === "RETURN") ? quantity : -quantity;
    await tx.product.update({
      where: { id: productId },
      data:  { stock: { increment: delta } },
    });

    return movement;
  });

  // Stok girişi / iadesi → e-ticaret sitesine güncel stoku bildir
  if (type === "IN" || type === "RETURN") {
    // await kullanmıyoruz — response'u bloklamasın
    syncStockToEcommerce(productId).catch(() => {});
  }

  return NextResponse.json({ movement: result }, { status: 201 });
}
