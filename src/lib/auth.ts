import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const ERP_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("missing_fields");
        }

        const ip =
          (req?.headers as Record<string, string | string[] | undefined>)?.[
            "x-forwarded-for"
          ]?.toString().split(",")[0].trim() ?? "unknown";

        if (!checkRateLimit(`${ip}:${credentials.email.toLowerCase()}`)) {
          throw new Error("too_many_attempts");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { personnel: { select: { id: true, permissions: true } } },
        });

        if (!user || !user.passwordHash || !user.isActive) {
          throw new Error("invalid_credentials");
        }

        if (!ERP_ROLES.includes(user.role)) {
          throw new Error("access_denied");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) throw new Error("invalid_credentials");

        // Admin için tüm izinleri ver, diğerleri için personnel'den çek
        const permissions: string[] = ADMIN_ROLES.includes(user.role)
          ? ["dashboard", "servis", "musteriler", "muhasebe", "stok", "bordro", "devamsizlik", "vergiler", "personel", "pozisyonlar"]
          : (user.personnel?.permissions ?? []);

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: user.role,
          permissions,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.permissions = (user as unknown as { permissions: string[] }).permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { permissions: string[] }).permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/giris",
    error: "/giris",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
