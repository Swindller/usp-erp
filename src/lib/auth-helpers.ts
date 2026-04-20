import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export interface AuthSession {
  user: { id: string; role: string; email: string; name: string };
}

/**
 * Next.js 15/16 App Router uyumlu session okuyucu.
 * getServerSession(authOptions) yerine doğrudan JWT cookie'yi decode eder.
 * NEXTAUTH_URL bağımsız çalışır.
 */
export async function getAppSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();

    // NEXTAUTH_URL http:// ise "next-auth.session-token", https:// ise "__Secure-" prefix
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

// API route'ları için — req/res tabanlı, App Router dışında güvenli
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
