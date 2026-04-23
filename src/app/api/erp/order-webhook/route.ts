/**
 * POST /api/erp/order-webhook
 *
 * E-ticaret sitesi sipariş CONFIRMED veya DELIVERED olduğunda bu endpoint'e çağrı yapar.
 * - Müşteriyi bulur veya oluşturur
 * - Otomatik fatura oluşturur (SALE tipi)
 * - Her SKU için stok düşürür (OUT hareketi)
 *
 * Authorization: Bearer <ERP_SYNC_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CustomerType,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  StockMovementType,
} from "@prisma/client";

// ─── Fatura numarası üretici ─────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last
    ? parseInt(last.invoiceNumber.replace(prefix, ""), 10) + 1
    : 1;
  return prefix + String(seq).padStart(4, "0");
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

interface WebhookItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface WebhookBody {
  orderId: string;
  orderNumber: string;
  status: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: WebhookItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  currency: string;
  paymentMethod: string;
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.ERP_SYNC_SECRET;

  if (!secret) {
    console.error("[order-webhook] ERP_SYNC_SECRET env var eksik");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Body parse ──────────────────────────────────────────────────────────
  let body: WebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    orderId, orderNumber, status,
    customer, items, shippingCost, total, currency, paymentMethod,
  } = body;

  if (!orderId || !orderNumber || !items?.length) {
    return NextResponse.json({ error: "Eksik alanlar: orderId, orderNumber, items" }, { status: 400 });
  }

  // ── 3. Sadece ilgili statüleri işle ───────────────────────────────────────
  if (!["CONFIRMED", "DELIVERED"].includes(status)) {
    return NextResponse.json({ ok: true, skipped: true, reason: `status '${status}' işlenmez` });
  }

  // ── 4. Idempotency — aynı sipariş tekrar işlenmesin ──────────────────────
  const SYNC_TAG = `ecommerce-order:${orderId}`;
  const existing = await prisma.invoice.findFirst({
    where: { notes: { contains: SYNC_TAG } },
    select: { id: true, invoiceNumber: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "zaten işlendi",
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
    });
  }

  // ── 5. Müşteri bul / oluştur ──────────────────────────────────────────────
  const nameParts = (customer.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "İsimsiz";
  const lastName  = nameParts.slice(1).join(" ") || "";

  let dbCustomer = customer.email
    ? await prisma.customer.findFirst({ where: { email: customer.email } })
    : null;

  if (!dbCustomer) {
    dbCustomer = await prisma.customer.create({
      data: {
        type:      CustomerType.INDIVIDUAL,
        firstName,
        lastName,
        email:     customer.email || null,
        phone:     customer.phone || "0000000000",
        address:   customer.address || null,
      },
    });
  }

  // ── 6. Satır kalemleri oluştur ────────────────────────────────────────────
  const lineItems = items.map((item) => ({
    description: item.name,
    qty:         item.quantity,
    unitPrice:   item.unitPrice,
    vatRate:     20,
    lineTotal:   Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));

  if ((shippingCost ?? 0) > 0) {
    lineItems.push({
      description: "Kargo Ücreti",
      qty:         1,
      unitPrice:   shippingCost,
      vatRate:     20,
      lineTotal:   shippingCost,
    });
  }

  const subtotalCalc = lineItems.reduce((s, li) => s + li.lineTotal, 0);
  const vatAmount    = Math.round(
    lineItems.reduce((s, li) => s + li.lineTotal * (li.vatRate / 100), 0) * 100
  ) / 100;

  // ── 7. Ödeme yöntemi map ──────────────────────────────────────────────────
  const PM_MAP: Record<string, PaymentMethod> = {
    BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
    CREDIT_CARD:   PaymentMethod.CREDIT_CARD,
    CASH:          PaymentMethod.CASH,
    CHECK:         PaymentMethod.CHECK,
    INSTALLMENT:   PaymentMethod.INSTALLMENT,
  };
  const pm = PM_MAP[paymentMethod] ?? PaymentMethod.BANK_TRANSFER;

  // ── 8. Fatura numarası ─────────────────────────────────────────────────────
  const invoiceNumber = await nextInvoiceNumber();

  // ── 9. Transaction: fatura oluştur + stok düş ────────────────────────────
  const isDelivered = status === "DELIVERED";

  const result = await prisma.$transaction(async (tx) => {
    // Fatura
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        type:             InvoiceType.SALE,
        status:           isDelivered ? InvoiceStatus.PAID : InvoiceStatus.SENT,
        customerId:       dbCustomer!.id,
        customerSnapshot: {
          type: "INDIVIDUAL",
          firstName,
          lastName,
          email:   customer.email,
          phone:   customer.phone,
          address: customer.address,
        },
        lineItems,
        subtotal:       subtotalCalc,
        vatRate:        20,
        vatAmount,
        discountAmount: 0,
        total:          total ?? subtotalCalc + vatAmount,
        currency:       currency ?? "TRY",
        paymentMethod:  pm,
        paidAmount:     isDelivered ? (total ?? subtotalCalc + vatAmount) : 0,
        paidAt:         isDelivered ? new Date() : null,
        invoiceDate:    new Date(),
        notes:          `${SYNC_TAG}\nSipariş No: ${orderNumber}`,
      },
    });

    // Stok hareketi (her SKU için)
    const stockResults: Array<{ sku: string; decremented?: number; skipped?: boolean; reason?: string }> = [];

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { sku: item.sku },
        select: { id: true, stock: true },
      });

      if (!product) {
        stockResults.push({ sku: item.sku, skipped: true, reason: "SKU bulunamadı" });
        continue;
      }

      await tx.stockMovement.create({
        data: {
          productId:  product.id,
          type:       StockMovementType.OUT,
          quantity:   item.quantity,
          unitPrice:  item.unitPrice,
          reference:  orderNumber,
          notes:      `E-ticaret siparişi: ${orderNumber}`,
          createdBy:  "e-ticaret-webhook",
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data:  { stock: { decrement: item.quantity } },
      });

      stockResults.push({ sku: item.sku, decremented: item.quantity });
    }

    return { invoice, stockResults };
  });

  console.log(`[order-webhook] Sipariş ${orderNumber} işlendi → Fatura ${invoiceNumber}`);

  return NextResponse.json(
    {
      ok: true,
      invoiceId:     result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      stockResults:  result.stockResults,
    },
    { status: 201 }
  );
}
