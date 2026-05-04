/**
 * POST /api/erp/sync-products
 *
 * E-ticaret sitesindeki aktif ürünleri ERP ürün tablosuna çeker ve upsert eder.
 * - Varsa: fiyat ve stok güncellenir (isim dokunulmaz)
 * - Yoksa: yeni ürün + Türkçe çeviri oluşturulur
 *
 * Authorization: getAuthUser() — ADMIN / SUPER_ADMIN only
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

interface EcommerceProduct {
  sku: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  currency: string;
  brand: string | null;
}

export async function POST() {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eticaret = process.env.ETICARET_URL;
  const secret   = process.env.ERP_SYNC_SECRET;

  if (!eticaret || !secret) {
    return NextResponse.json(
      { error: "ETICARET_URL veya ERP_SYNC_SECRET env değişkeni eksik" },
      { status: 500 }
    );
  }

  // ── 1. E-ticaret ürünlerini çek ───────────────────────────────────────────
  let ecomProducts: EcommerceProduct[];
  try {
    const res = await fetch(`${eticaret}/api/internal/products`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `E-ticaret API hatası (${res.status}): ${text}` },
        { status: 502 }
      );
    }
    const json = await res.json();
    ecomProducts = json.products ?? [];
  } catch (err) {
    return NextResponse.json(
      { error: `E-ticaret'e bağlanılamadı: ${String(err)}` },
      { status: 502 }
    );
  }

  if (!ecomProducts.length) {
    return NextResponse.json({ ok: true, created: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Her ürünü upsert et ────────────────────────────────────────────────
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const ep of ecomProducts) {
    if (!ep.sku) { skipped++; continue; }

    try {
      const existing = await prisma.product.findUnique({
        where: { sku: ep.sku },
        select: { id: true },
      });

      if (existing) {
        // Mevcut ürün → fiyat & stok güncelle
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            price:    ep.price,
            stock:    ep.stock,
            currency: ep.currency ?? "TRY",
          },
        });
        updated++;
      } else {
        // Yeni ürün → oluştur + Türkçe çeviri ekle
        // Slug çakışmasını önlemek için sku + timestamp kullan
        const baseSlug = ep.slug || ep.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const slug     = `${baseSlug}-${Date.now()}`;

        await prisma.product.create({
          data: {
            sku:      ep.sku,
            price:    ep.price,
            stock:    ep.stock,
            currency: ep.currency ?? "TRY",
            translations: {
              create: {
                locale: "tr",
                name:   ep.name,
                slug,
              },
            },
          },
        });
        created++;
      }
    } catch (err) {
      console.error(`[sync-products] SKU ${ep.sku} upsert hatası:`, err);
      skipped++;
    }
  }

  console.log(`[sync-products] Tamamlandı → oluşturuldu: ${created}, güncellendi: ${updated}, atlandı: ${skipped}`);

  return NextResponse.json({ ok: true, created, updated, skipped });
}
