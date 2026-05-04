import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
type ItType = "telefonlar" | "bilgisayarlar" | "yazicilar" | "kameralar" | "switchler";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "telefonlar") as ItType;
  const data = await req.json();

  let record: unknown;

  if (type === "telefonlar") {
    if (data.teslimTarihi) data.teslimTarihi = new Date(data.teslimTarihi);
    record = await prisma.itPhone.update({ where: { id }, data });
  } else if (type === "bilgisayarlar") {
    record = await prisma.itComputer.update({ where: { id }, data });
  } else if (type === "yazicilar") {
    record = await prisma.itPrinter.update({ where: { id }, data });
  } else if (type === "kameralar") {
    record = await prisma.itCamera.update({ where: { id }, data });
  } else {
    record = await prisma.itSwitch.update({ where: { id }, data });
  }

  return NextResponse.json({ record });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "telefonlar") as ItType;

  if (type === "telefonlar")    await prisma.itPhone.delete({ where: { id } });
  else if (type === "bilgisayarlar") await prisma.itComputer.delete({ where: { id } });
  else if (type === "yazicilar")    await prisma.itPrinter.delete({ where: { id } });
  else if (type === "kameralar")    await prisma.itCamera.delete({ where: { id } });
  else                              await prisma.itSwitch.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
