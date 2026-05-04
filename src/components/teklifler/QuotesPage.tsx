"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Send, RefreshCw, ChevronRight } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" | "EXPIRED";

interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  title: string | null;
  total: string;
  subtotal: string;
  taxAmount: string;
  taxRate: string;
  validUntil: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  customer: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    phone: string;
  };
  createdBy: { user: { firstName: string | null; lastName: string | null } } | null;
  serviceReport: { id: string; reportNumber: string } | null;
}

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, { label: string; icon: React.ReactNode; classes: string; badge: string }> = {
  DRAFT:     { label: "Taslak",       icon: <FileText size={13} />,    classes: "text-gray-600",  badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SENT:      { label: "Gönderildi",   icon: <Send size={13} />,        classes: "text-blue-600",  badge: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED:  { label: "Onaylandı",    icon: <CheckCircle2 size={13} />, classes: "text-green-600", badge: "bg-green-50 text-green-700 border-green-200" },
  REJECTED:  { label: "Reddedildi",   icon: <XCircle size={13} />,     classes: "text-red-600",   badge: "bg-red-50 text-red-700 border-red-200" },
  CONVERTED: { label: "Faturaya Döndü", icon: <RefreshCw size={13} />, classes: "text-purple-600", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  EXPIRED:   { label: "Süresi Doldu", icon: <Clock size={13} />,       classes: "text-orange-600", badge: "bg-orange-50 text-orange-700 border-orange-200" },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "DRAFT", label: "Taslak" },
  { value: "SENT", label: "Gönderildi" },
  { value: "APPROVED", label: "Onaylandı" },
  { value: "REJECTED", label: "Reddedildi" },
  { value: "CONVERTED", label: "Faturaya Döndü" },
];

function cName(c: Quote["customer"]) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(val: string | number) {
  return Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  userRole: string;
}

export function QuotesPage({ userRole }: Props) {
  const isManager = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(userRole);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (status: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("search", q);
      const res = await fetch(`/api/teklifler?${params}`);
      const data = await res.json();
      setQuotes(data.quotes || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter, search); }, [statusFilter, search, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // Özet sayaçları
  const counts = quotes.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Teklifler</h1>
          <p className="text-sm text-gray-500">Toplam {total} teklif</p>
        </div>
        {isManager && (
          <Link
            href="/teklifler/yeni"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Yeni Teklif
          </Link>
        )}
      </div>

      {/* Durum özet kartları */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {(["DRAFT", "SENT", "APPROVED", "REJECTED", "CONVERTED", "EXPIRED"] as QuoteStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`rounded-xl border p-3 text-center transition-all ${
                statusFilter === s ? cfg.badge + " ring-2 ring-offset-1 ring-current" : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className={`text-xl font-bold ${statusFilter === s ? "" : "text-gray-800"}`}>{counts[s] || 0}</div>
              <div className={`text-[10px] font-medium ${statusFilter === s ? "" : "text-gray-500"}`}>{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* Arama + Filtre */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Teklif no, müşteri, başlık ara..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            Ara
          </button>
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileText size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Henüz teklif yok</p>
          {isManager && (
            <Link href="/teklifler/yeni" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Plus size={13} />İlk teklifi oluştur
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {quotes.map((q, i) => {
            const cfg = STATUS_CONFIG[q.status];
            const isExpiring = q.validUntil && q.status === "SENT" && new Date(q.validUntil) < new Date(Date.now() + 3 * 86400000);
            return (
              <Link
                key={q.id}
                href={`/teklifler/${q.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                {/* Sol: no + durum */}
                <div className="w-32 flex-shrink-0">
                  <div className="font-mono text-sm font-bold text-gray-800">{q.quoteNumber}</div>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>
                    {cfg.icon}{cfg.label}
                  </span>
                </div>

                {/* Orta: müşteri + başlık */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm truncate">{cName(q.customer)}</div>
                  {q.title && <div className="text-xs text-gray-500 truncate mt-0.5">{q.title}</div>}
                  {q.serviceReport && (
                    <div className="text-[10px] text-blue-600 mt-0.5">
                      Servis: {q.serviceReport.reportNumber}
                    </div>
                  )}
                </div>

                {/* Sağ: tutar + tarih */}
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-gray-800">₺{fmtMoney(q.total)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {q.status === "APPROVED" ? `✓ ${fmtDate(q.approvedAt)}` :
                     q.status === "REJECTED" ? `✗ ${fmtDate(q.rejectedAt)}` :
                     q.status === "SENT" ? `📤 ${fmtDate(q.sentAt)}` :
                     fmtDate(q.createdAt)}
                  </div>
                  {q.validUntil && (
                    <div className={`text-[10px] mt-0.5 ${isExpiring ? "text-orange-500 font-semibold" : "text-gray-400"}`}>
                      Geçerli: {fmtDate(q.validUntil)}
                    </div>
                  )}
                </div>

                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
