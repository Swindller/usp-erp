import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

type ItType = "telefonlar" | "bilgisayarlar" | "yazicilar" | "kameralar" | "switchler";

// ─── Schema per type ─────────────────────────────────────────────────────────

const phoneSchema = z.object({
  siraNo: z.coerce.number().optional(),
  gsmNumara: z.string().optional(),
  kisaKod: z.string().optional(),
  kullaniciAdi: z.string().optional(),
  departman: z.string().optional(),
  gorev: z.string().optional(),
  hatDurum: z.string().optional(),
  cihazMarka: z.string().optional(),
  cihazModel: z.string().optional(),
  imei1: z.string().optional(),
  imei2: z.string().optional(),
  faturaNo: z.string().optional(),
  tarife: z.string().optional(),
  tarifeHaklari: z.string().optional(),
  pin: z.string().optional(),
  teslimDurumu: z.string().optional(),
  teslimTarihi: z.string().optional(),
  aciklama: z.string().optional(),
});

const computerSchema = z.object({
  pcAdi: z.string().optional(),
  kullanici: z.string().optional(),
  bolum: z.string().optional(),
  monitor: z.string().optional(),
  islemci: z.string().optional(),
  ram: z.string().optional(),
  grafikKarti: z.string().optional(),
  depolama: z.string().optional(),
  isletimSistemi: z.string().optional(),
  kuralanProgramlar: z.string().optional(),
  yazici: z.string().optional(),
  hariciDonanim: z.string().optional(),
  kullaniciAdi: z.string().optional(),
  urunAnahtari: z.string().optional(),
  aciklama: z.string().optional(),
});

const printerSchema = z.object({
  departman: z.string().optional(),
  kullanan: z.string().optional(),
  yaziciAdi: z.string().optional(),
  baglanti: z.string().optional(),
  aciklama: z.string().optional(),
});

const cameraSchema = z.object({
  kameraNo: z.string().optional(),
  isim: z.string().optional(),
  ip: z.string().optional(),
  konum: z.string().optional(),
  mac: z.string().optional(),
  tip: z.string().optional(),
  switch: z.string().optional(),
  port: z.string().optional(),
  aciklama: z.string().optional(),
});

const switchSchema = z.object({
  swAdi: z.string().optional(),
  ip: z.string().optional(),
  lokasyon: z.string().optional(),
  bolge: z.string().optional(),
  marka: z.string().optional(),
  port: z.string().optional(),
  bb: z.string().optional(),
  aciklama: z.string().optional(),
});

const SCHEMAS: Record<ItType, z.ZodObject<z.ZodRawShape>> = {
  telefonlar:   phoneSchema,
  bilgisayarlar: computerSchema,
  yazicilar:    printerSchema,
  kameralar:    cameraSchema,
  switchler:    switchSchema,
};

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type  = (searchParams.get("type") ?? "telefonlar") as ItType;
  const q     = searchParams.get("q") ?? "";
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;
  const skip  = (page - 1) * limit;

  let records: unknown[] = [];
  let total = 0;

  if (type === "telefonlar") {
    const where = q ? {
      OR: [
        { kullaniciAdi: { contains: q, mode: "insensitive" as const } },
        { gsmNumara:    { contains: q, mode: "insensitive" as const } },
        { departman:    { contains: q, mode: "insensitive" as const } },
        { cihazMarka:   { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    [records, total] = await Promise.all([
      prisma.itPhone.findMany({ where, orderBy: { siraNo: "asc" }, skip, take: limit }),
      prisma.itPhone.count({ where }),
    ]);
  } else if (type === "bilgisayarlar") {
    const where = q ? {
      OR: [
        { pcAdi:      { contains: q, mode: "insensitive" as const } },
        { kullanici:  { contains: q, mode: "insensitive" as const } },
        { bolum:      { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    [records, total] = await Promise.all([
      prisma.itComputer.findMany({ where, orderBy: { bolum: "asc" }, skip, take: limit }),
      prisma.itComputer.count({ where }),
    ]);
  } else if (type === "yazicilar") {
    const where = q ? {
      OR: [
        { departman: { contains: q, mode: "insensitive" as const } },
        { kullanan:  { contains: q, mode: "insensitive" as const } },
        { yaziciAdi: { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    [records, total] = await Promise.all([
      prisma.itPrinter.findMany({ where, orderBy: { departman: "asc" }, skip, take: limit }),
      prisma.itPrinter.count({ where }),
    ]);
  } else if (type === "kameralar") {
    const where = q ? {
      OR: [
        { isim:    { contains: q, mode: "insensitive" as const } },
        { konum:   { contains: q, mode: "insensitive" as const } },
        { ip:      { contains: q, mode: "insensitive" as const } },
        { kameraNo:{ contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    [records, total] = await Promise.all([
      prisma.itCamera.findMany({ where, orderBy: { kameraNo: "asc" }, skip, take: limit }),
      prisma.itCamera.count({ where }),
    ]);
  } else if (type === "switchler") {
    const where = q ? {
      OR: [
        { swAdi:    { contains: q, mode: "insensitive" as const } },
        { lokasyon: { contains: q, mode: "insensitive" as const } },
        { ip:       { contains: q, mode: "insensitive" as const } },
        { marka:    { contains: q, mode: "insensitive" as const } },
      ],
    } : {};
    [records, total] = await Promise.all([
      prisma.itSwitch.findMany({ where, orderBy: { lokasyon: "asc" }, skip, take: limit }),
      prisma.itSwitch.count({ where }),
    ]);
  }

  return NextResponse.json({ records, total, page, limit });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "telefonlar") as ItType;
  const schema = SCHEMAS[type];

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const d = parsed.data;
  let record: unknown;

  if (type === "telefonlar") {
    const { teslimTarihi, ...rest } = d;
    record = await prisma.itPhone.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...rest, teslimTarihi: teslimTarihi ? new Date(String(teslimTarihi)) : undefined } as any,
    });
  } else if (type === "bilgisayarlar") {
    record = await prisma.itComputer.create({ data: d as Parameters<typeof prisma.itComputer.create>[0]["data"] });
  } else if (type === "yazicilar") {
    record = await prisma.itPrinter.create({ data: d as Parameters<typeof prisma.itPrinter.create>[0]["data"] });
  } else if (type === "kameralar") {
    record = await prisma.itCamera.create({ data: d as Parameters<typeof prisma.itCamera.create>[0]["data"] });
  } else {
    record = await prisma.itSwitch.create({ data: d as Parameters<typeof prisma.itSwitch.create>[0]["data"] });
  }

  return NextResponse.json({ record }, { status: 201 });
}
