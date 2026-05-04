import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { prisma } from "./prisma";

export interface AuthSession {
  user: {
    id: string;
    role: string;
    email: string;
    name: string;
    permissions: string[];
  };
}

const SUPER_ROLES = ["ADMIN", "SUPER_ADMIN"];

/**
 * Next.js 15/16 App Router uyumlu session okuyucu.
 * JWT cookie'yi doğrudan decode eder — DB sorgusu yapmaz.
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

    const role = (decoded.role as string) || "TECHNICIAN";
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(role);

    // Eski JWT'de permissions alanı yok — DB'den çek (geçiş dönemi fallback)
    let permissions = decoded.permissions as string[] | undefined;
    if (permissions === undefined) {
      if (isAdmin) {
        permissions = ["dashboard","servis","musteriler","muhasebe","stok","bordro","devamsizlik","vergiler","personel","pozisyonlar","teklifler","it-envanter"];
      } else {
        try {
          const personnel = await prisma.personnel.findFirst({
            where: { userId: decoded.id as string },
            select: { permissions: true },
          });
          permissions = personnel?.permissions ?? [];
        } catch {
          permissions = [];
        }
      }
    }

    return {
      user: {
        id: decoded.id as string,
        role,
        email: (decoded.email as string) || "",
        name: (decoded.name as string) || "",
        permissions,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Sayfa yetkisi kontrolü — JWT'deki permissions listesine bakar.
 * Admin/SuperAdmin → her zaman true.
 */
export async function hasPagePermission(
  userId: string,
  role: string,
  permKey: string
): Promise<boolean> {
  if (SUPER_ROLES.includes(role)) return true;
  try {
    // Önce DB'den taze kontrol et (JWT cache'i by-pass)
    const personnel = await prisma.personnel.findFirst({
      where: { userId },
      select: { permissions: true },
    });
    return personnel?.permissions?.includes(permKey) ?? false;
  } catch {
    return false;
  }
}

// API route'ları için — getAppSession() üzerinden JWT decode eder, getServerSession() kullanmaz
export async function getAuthUser() {
  const session = await getAppSession();
  if (!session) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
