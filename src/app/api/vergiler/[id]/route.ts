import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaxStatus } from "@prisma/client";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status) {
    data.status = body.status;
    if (body.status === TaxStatus.PAID) data.paidDate = new Date();
  }
  if (body.notes !== undefined) data.notes = body.notes;

  const record = await prisma.taxRecord.update({ where: { id }, data });
  return NextResponse.json({ record });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.taxRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
