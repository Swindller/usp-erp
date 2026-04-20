import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export interface AuthSession {
  user: { id: string; role: string; email: string; name: string };
}

const SUPER_ROLES = ["ADMIN", "SUPER_ADMIN"];

/**
 * Next.js 15/16 App Router uyumlu session okuyucu.
 * getServerSession yerine JWT cookie'yi doğrudan decode eder.
 */
export async function getAppSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("__Secure-next-auth.session-token")?.value ||
      cookieStore.get("next-auth.session-token")?.value;

    if (!token) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const decoded = await decode({ token, secret });
    if (!decoded?.id) return null;

    return {
      user: {
        id: decoded.id as string,
        role: (decoded.role as string) || "TECHNICIAN",
        email: (decoded.email as string) || "",
        name: (decoded.name as string) || "",
      },
    };
  } catch {
    return null;
  }
}

/**
 * Sayfa yetkisi kontrolü.
 * Admin/SuperAdmin → her zaman true.
 * Diğerleri → personnel.permissions içinde permKey var mı?
 */
export async function hasPagePermission(
  userId: string,
  role: string,
  permKey: string
): Promise<boolean> {
  if (SUPER_ROLES.includes(role)) return true;
  try {
    const personnel = await prisma.personnel.findFirst({
      where: { userId },
      select: { permissions: true },
    });
    return personnel?.permissions?.includes(permKey) ?? false;
  } catch {
    return false;
  }
}

// API route'ları için (req/res tabanlı)
export async function getAuthUser() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session.user as { id: string; role: string; email?: string; name?: string };
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
