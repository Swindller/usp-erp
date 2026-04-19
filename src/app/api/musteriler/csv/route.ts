import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CustomerType } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

function escapeCsv(val: string | number | boolean | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(escapeCsv).join(",");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else current += ch;
  }
  result.push(current.trim());
  return result;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });
  const header = ["tip", "ad", "soyad", "firma", "telefon", "email", "tc_no", "vergi_no", "vergi_dairesi", "sehir", "ilce", "adres", "aktif"];
  const rows = customers.map((c) => rowToCsv([c.type === "CORPORATE" ? "kurumsal" : "sahis", c.firstName, c.lastName, c.companyName, c.phone, c.email, c.tcNumber, c.taxNumber, c.taxOffice, c.city, c.district, c.address, c.isActive]));
  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="musteriler_${new Date().toISOString().split("T")[0]}.csv"` },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const text = await req.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "CSV boş veya geçersiz" }, { status: 400 });

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => headers.indexOf(name);
  const tipIdx = idx("tip"); const adIdx = idx("ad"); const soyadIdx = idx("soyad");
  const firmaIdx = idx("firma"); const telIdx = idx("telefon"); const emailIdx = idx("email");
  const tcIdx = idx("tc_no"); const vergiIdx = idx("vergi_no"); const vdIdx = idx("vergi_dairesi");
  const sehirIdx = idx("sehir"); const ilceIdx = idx("ilce"); const adresIdx = idx("adres");

  if (telIdx === -1) return NextResponse.json({ error: "'telefon' sütunu zorunludur" }, { status: 400 });

  let created = 0; let skipped = 0; const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const phone = cols[telIdx]?.trim();
    if (!phone) { skipped++; continue; }
    const tipRaw = cols[tipIdx]?.toLowerCase().trim() || "sahis";
    const type: CustomerType = tipRaw.includes("kurum") || tipRaw === "corporate" ? CustomerType.CORPORATE : CustomerType.INDIVIDUAL;
    const customerData = {
      type, phone,
      firstName: adIdx !== -1 ? cols[adIdx] || undefined : undefined,
      lastName: soyadIdx !== -1 ? cols[soyadIdx] || undefined : undefined,
      companyName: firmaIdx !== -1 ? cols[firmaIdx] || undefined : undefined,
      email: emailIdx !== -1 ? cols[emailIdx] || undefined : undefined,
      tcNumber: tcIdx !== -1 ? cols[tcIdx] || undefined : undefined,
      taxNumber: vergiIdx !== -1 ? cols[vergiIdx] || undefined : undefined,
      taxOffice: vdIdx !== -1 ? cols[vdIdx] || undefined : undefined,
      city: sehirIdx !== -1 ? cols[sehirIdx] || undefined : undefined,
      district: ilceIdx !== -1 ? cols[ilceIdx] || undefined : undefined,
      address: adresIdx !== -1 ? cols[adresIdx] || undefined : undefined,
    };
    try {
      const existing = await prisma.customer.findFirst({ where: { phone } });
      if (existing) await prisma.customer.update({ where: { id: existing.id }, data: customerData });
      else await prisma.customer.create({ data: customerData });
      created++;
    } catch { errors.push(`Satır ${i + 1}: ${phone} kaydedilemedi`); }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 10), message: `${created} müşteri aktarıldı, ${skipped} atlandı` });
}
