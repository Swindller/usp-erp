import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const locale = searchParams.get("locale") || "tr";
  if (q.length < 2) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { translations: { some: { locale, name: { contains: q, mode: "insensitive" } } } },
      ],
    },
    include: {
      translations: { where: { locale }, select: { name: true } },
      brand: { select: { name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
    },
    take: 15,
    orderBy: { stock: "desc" },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.translations[0]?.name || p.sku,
      price: parseFloat(p.price.toString()),
      stock: p.stock,
      brand: p.brand?.name || null,
      imageUrl: p.images[0]?.url || null,
    })),
  });
}
