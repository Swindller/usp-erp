"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Wrench, Users, Banknote, UserCog,
  LogOut, ChevronRight, Droplets, Shield, Package, Receipt, CalendarDays, DollarSign, ClipboardList, FileCheck,
} from "lucide-react";

const ALL_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permKey: "dashboard" },
  { href: "/servis", label: "Servis Raporları", icon: Wrench, permKey: "servis" },
  { href: "/servis/planlama", label: "Servis Planlaması", icon: ClipboardList, permKey: "servis" },
  { href: "/musteriler", label: "Müşteriler", icon: Users, permKey: "musteriler" },
  { href: "/muhasebe", label: "Muhasebe", icon: Banknote, permKey: "muhasebe" },
  { href: "/stok", label: "Stok Yönetimi", icon: Package, permKey: "stok" },
  { href: "/bordro", label: "Bordro", icon: DollarSign, permKey: "bordro" },
  { href: "/devamsizlik", label: "Devamsızlık", icon: CalendarDays, permKey: "devamsizlik" },
  { href: "/vergiler", label: "Vergi Takibi", icon: Receipt, permKey: "vergiler" },
  { href: "/personel", label: "Personel", icon: UserCog, permKey: "personel" },
  { href: "/teklifler", label: "Teklifler", icon: FileCheck, permKey: "teklifler" },
];

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

interface SidebarProps {
  permissions?: string[];
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";

  const isAdmin = ADMIN_ROLES.includes(role);

  // Admin tüm sayfaları görür, diğerleri sadece izin verilenleri
  const visibleNav = ALL_NAV.filter((item) =>
    isAdmin || (permissions ?? []).includes(item.permKey)
  );

  // En spesifik eşleşmeyi bul (örn. /servis/planlama, /servis'i de aktif etmemeli)
  const getIsActive = (href: string) => {
    if (href === "/") return pathname === "/";
    // Önce tam eşleşme
    if (pathname === href) return true;
    // Alt sayfa eşleşmesi — ama başka bir nav öğesi daha spesifik eşleşiyorsa hayır
    if (!pathname.startsWith(href + "/")) return false;
    // Daha spesifik bir nav öğesi bu path'i kapsıyor mu?
    const moreSpecific = visibleNav.some(
      (other) => other.href !== href && other.href.startsWith(href) && pathname.startsWith(other.href)
    );
    return !moreSpecific;
  };

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Droplets size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Uğur Su Pompaları</p>
          <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-0.5">ERP Sistemi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const isActive = getIsActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon size={17} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/60 px-4 py-4">
        {isAdmin && (
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <Shield size={11} className="text-blue-400" />
            <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">Tam Yetki</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-slate-300 text-xs font-bold">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{session?.user?.name ?? "..."}</p>
            <p className="text-slate-500 text-[10px] truncate">{session?.user?.email ?? ""}</p>
          </div>
          <button
            onClick={async () => { await signOut({ redirect: false }); window.location.href = "/giris"; }}
            title="Çıkış"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
