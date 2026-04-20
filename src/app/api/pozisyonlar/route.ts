import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET() {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const positions = await prisma.position.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ positions });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Pozisyon adı gereklidir." }, { status: 400 });

  const existing = await prisma.position.findUnique({ where: { name: name.trim() } });
  if (existing) return NextResponse.json({ error: "Bu pozisyon zaten mevcut." }, { status: 409 });

  const position = await prisma.position.create({ data: { name: name.trim(), description: description?.trim() || null } });
  return NextResponse.json({ position }, { status: 201 });
}
