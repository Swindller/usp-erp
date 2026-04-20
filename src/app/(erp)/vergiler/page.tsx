"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt, ChevronLeft, ChevronRight, Plus, X, Trash2, AlertTriangle, Clock, CheckCircle, CalendarDays } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaxType =
  | "KDV_BEYANNAME"
  | "MUHTASAR"
  | "SGK_PRIM"
  | "GECICI_VERGI"
  | "KURUMLAR_VERGISI"
  | "GELIR_VERGISI";

type TaxStatus = "PENDING" | "PAID" | "OVERDUE";

interface TaxRecord {
  id: string;
  type: TaxType;
  year: number;
  month: number | null;
  baseAmount: number;
  taxAmount: number;
  kdvDeducted: number;
  netTax: number;
  dueDate: string;
  status: TaxStatus;
  notes: string | null;
  paidAt: string | null;
}

interface VergiData {
  records: TaxRecord[];
  upcoming: TaxRecord[];
  year: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const TAX_LABELS: Record<TaxType, string> = {
  KDV_BEYANNAME: "KDV Beyannamesi",
  MUHTASAR: "Muhtasar Beyanname",
  SGK_PRIM: "SGK Primi",
  GECICI_VERGI: "Geçici Vergi",
  KURUMLAR_VERGISI: "Kurumlar Vergisi",
  GELIR_VERGISI: "Gelir Vergisi Beyannamesi",
};

const STATUS_CONFIG: Record<TaxStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  PENDING: { label: "Bekliyor", classes: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  PAID: { label: "Ödendi", classes: "bg-green-100 text-green-700", icon: <CheckCircle size={12} /> },
  OVERDUE: { label: "Gecikmiş", classes: "bg-red-100 text-red-700", icon: <AlertTriangle size={12} /> },
};

const TAX_CALENDAR = [
  { label: "KDV Beyannamesi", detail: "Her ayın 26'sı" },
  { label: "Muhtasar Beyanname", detail: "Her ayın 23'ü" },
  { label: "SGK Primi", detail: "Her ayın 23'ü" },
  { label: "Geçici Vergi", detail: "Mart 17, Haziran 17, Eylül 17, Aralık 17" },
  { label: "Kurumlar Vergisi", detail: "30 Nisan" },
];

const fmt = (v: number) =>
  `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

const defaultForm = {
  type: "KDV_BEYANNAME" as TaxType,
  year: new Date().getFullYear(),
  month: "",
  baseAmount: "",
  taxAmount: "",
  kdvDeducted: "",
  dueDate: "",
  notes: "",
};

// ─── Urgency helper ───────────────────────────────────────────────────────────

function urgencyClass(record: TaxRecord) {
  if (record.status === "PAID") return "";
  const now = new Date();
  const due = new Date(record.dueDate);
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "bg-red-50 border-l-4 border-l-red-400";
  if (diff < 7) return "bg-orange-50 border-l-4 border-l-orange-400";
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VergilerPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<VergiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, year: now.getFullYear() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/vergiler?year=${year}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // Group records by month
  const grouped = useMemo(() => {
    if (!data) return new Map<string, TaxRecord[]>();
    const map = new Map<string, TaxRecord[]>();
    data.records.forEach((r) => {
      const key = r.month != null ? `${r.year}-${String(r.month).padStart(2, "0")}` : `${r.year}-00`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    // Sort keys descending
    return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [data]);

  const netPreview = useMemo(() => {
    const tax = Number(form.taxAmount) || 0;
    const ded = Number(form.kdvDeducted) || 0;
    return Math.max(0, tax - ded);
  }, [form.taxAmount, form.kdvDeducted]);

  const handleSave = async () => {
    if (!form.taxAmount || Number(form.taxAmount) <= 0) { setError("Hesaplanan vergi giriniz."); return; }
    if (!form.dueDate) { setError("Son ödeme tarihi giriniz."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/vergiler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          year: Number(form.year),
          month: form.month ? Number(form.month) : undefined,
          baseAmount: Number(form.baseAmount) || 0,
          taxAmount: Number(form.taxAmount),
          kdvDeducted: Number(form.kdvDeducted) || 0,
          dueDate: form.dueDate,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Kayıt hatası"); return; }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handlePay = async (id: string) => {
    await fetch(`/api/vergiler/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/vergiler/${id}`, { method: "DELETE" });
    load();
  };

  const groupLabel = (key: string) => {
    const [y, m] = key.split("-");
    if (m === "00") return `${y} — Yıllık`;
    return `${MONTHS[Number(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={22} className="text-blue-600" />Vergi Takibi
          </h1>
          <p className="text-sm text-gray-500 mt-1">Beyanname ve vergi ödeme takvimi</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[60px] text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
          <button
            onClick={() => { setForm({ ...defaultForm, year }); setError(""); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Vergi Kaydı Ekle
          </button>
        </div>
      </div>

      {/* Tax Calendar Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={18} className="text-blue-700" />
          <h2 className="font-semibold text-blue-800">{year} Vergi Takvimi</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {TAX_CALENDAR.map((item) => (
            <div key={item.label} className="flex items-start gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-blue-800">{item.label}:</span>{" "}
                <span className="text-blue-700">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming payments */}
      {data && data.upcoming.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Yaklaşan / Gecikmiş Ödemeler</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.upcoming.map((r) => {
              const now2 = new Date();
              const due = new Date(r.dueDate);
              const diff = Math.ceil((due.getTime() - now2.getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = diff < 0;
              const isSoon = !isOverdue && diff < 7;
              return (
                <div key={r.id} className={`flex items-center justify-between px-5 py-3.5 gap-4 ${isOverdue ? "bg-red-50" : isSoon ? "bg-orange-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    {isOverdue && <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
                    {isSoon && <Clock size={16} className="text-orange-500 flex-shrink-0" />}
                    {!isOverdue && !isSoon && <Clock size={16} className="text-gray-400 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{TAX_LABELS[r.type]}</p>
                      <p className="text-xs text-gray-500">
                        {r.month ? `${MONTHS[r.month - 1]} ${r.year}` : `${r.year}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmt(r.netTax)}</p>
                    <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : isSoon ? "text-orange-600" : "text-gray-500"}`}>
                      {isOverdue ? `${Math.abs(diff)} gün geçti` : diff === 0 ? "Bugün son gün!" : `${diff} gün kaldı`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Records grouped by month */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-200">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : !data || data.records.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-200">
          <Receipt size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{year} yılı için vergi kaydı bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([key, records]) => (
            <div key={key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">{groupLabel(key)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-5 py-3 font-medium text-gray-600">Vergi Türü</th>
                      <th className="px-5 py-3 font-medium text-gray-600">Dönem</th>
                      <th className="px-5 py-3 font-medium text-gray-600 text-right">Matrah</th>
                      <th className="px-5 py-3 font-medium text-gray-600 text-right">Hesaplanan</th>
                      <th className="px-5 py-3 font-medium text-gray-600 text-right">İndirim</th>
                      <th className="px-5 py-3 font-medium text-gray-600 text-right">Net Vergi</th>
                      <th className="px-5 py-3 font-medium text-gray-600">Son Tarih</th>
                      <th className="px-5 py-3 font-medium text-gray-600">Durum</th>
                      <th className="px-5 py-3 font-medium text-gray-600 text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${urgencyClass(r)}`}>
                        <td className="px-5 py-3.5 font-medium text-gray-900">{TAX_LABELS[r.type]}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">
                          {r.month ? `${MONTHS[r.month - 1]} ${r.year}` : `${r.year}`}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-600">{fmt(r.baseAmount)}</td>
                        <td className="px-5 py-3.5 text-right text-gray-600">{fmt(r.taxAmount)}</td>
                        <td className="px-5 py-3.5 text-right text-gray-500">{r.kdvDeducted > 0 ? fmt(r.kdvDeducted) : "—"}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(r.netTax)}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{fmtDate(r.dueDate)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[r.status].classes}`}>
                            {STATUS_CONFIG[r.status].icon}
                            {STATUS_CONFIG[r.status].label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            {r.status !== "PAID" && (
                              <button
                                onClick={() => handlePay(r.id)}
                                className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors"
                              >
                                Ödendi
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Vergi Kaydı Ekle</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Vergi Türü *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TaxType }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                  {(Object.keys(TAX_LABELS) as TaxType[]).map((t) => (
                    <option key={t} value={t}>{TAX_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Yıl *</label>
                  <input type="number" value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ay <span className="text-gray-400 font-normal">— opsiyonel</span></label>
                  <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">Yıllık</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Matrah (₺)</label>
                <input type="number" min="0" step="0.01" value={form.baseAmount}
                  onChange={(e) => setForm((f) => ({ ...f, baseAmount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Hesaplanan Vergi (₺) *</label>
                  <input type="number" min="0" step="0.01" value={form.taxAmount}
                    onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">İndirilecek KDV (₺)</label>
                  <input type="number" min="0" step="0.01" value={form.kdvDeducted}
                    onChange={(e) => setForm((f) => ({ ...f, kdvDeducted: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              {/* Net preview */}
              {(Number(form.taxAmount) > 0) && (
                <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5">
                  <span className="text-sm font-medium text-blue-700">NET Ödenecek Vergi</span>
                  <span className="text-sm font-bold text-blue-900">{fmt(netPreview)}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Son Ödeme Tarihi *</label>
                <input type="date" value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
