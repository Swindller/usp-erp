import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

interface PhotoEntry { url: string; name: string; addedAt: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const report = await prisma.serviceReport.findUnique({ where: { id }, select: { id: true, photos: true } });
  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const body = await req.json();
  const { photos: newPhotos } = body as { photos: { url: string; name: string }[] };

  if (!Array.isArray(newPhotos) || newPhotos.length === 0)
    return NextResponse.json({ error: "photos array gerekli" }, { status: 400 });

  const existing: PhotoEntry[] = (report.photos as unknown as PhotoEntry[]) || [];
  const toAdd: PhotoEntry[] = newPhotos.map((p) => ({ url: p.url, name: p.name, addedAt: new Date().toISOString() }));
  const merged = [...existing, ...toAdd];

  const updated = await prisma.serviceReport.update({
    where: { id },
    data: { photos: merged as unknown as Prisma.InputJsonValue },
    select: { photos: true },
  });

  const personnel = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });
  await prisma.serviceLog.create({
    data: {
      serviceReportId: id,
      type: "PHOTO_ADDED",
      description: `${toAdd.length} fotoğraf eklendi`,
      personnelId: personnel?.id,
    },
  });

  return NextResponse.json({ photos: updated.photos });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { index } = await req.json() as { index: number };

  const report = await prisma.serviceReport.findUnique({ where: { id }, select: { photos: true } });
  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const existing: PhotoEntry[] = (report.photos as unknown as PhotoEntry[]) || [];
  const updatedPhotos = existing.filter((_, i) => i !== index);

  await prisma.serviceReport.update({ where: { id }, data: { photos: updatedPhotos as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true });
}
