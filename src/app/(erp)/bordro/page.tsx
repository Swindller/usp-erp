"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DollarSign, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Banknote, Users } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

interface PersonnelRef {
  id: string;
  user: { firstName: string | null; lastName: string | null; email: string };
}

interface Payroll {
  id: string;
  personnelId: string;
  year: number;
  month: number;
  baseSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  otherBonus: number;
  workedDays: number;
  absentDays: number;
  grossSalary: number;
  sgiWorker: number;
  unemploymentWorker: number;
  incomeTax: number;
  stampTax: number;
  netSalary: number;
  employerCost: number;
  notes: string | null;
  status: PayrollStatus;
  personnel: PersonnelRef;
}

interface BordroData {
  payrolls: Payroll[];
  allPersonnel: PersonnelRef[];
  year: number;
  month: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const STATUS_CONFIG: Record<PayrollStatus, { label: string; classes: string }> = {
  DRAFT: { label: "Taslak", classes: "bg-gray-100 text-gray-600" },
  APPROVED: { label: "Onaylandı", classes: "bg-blue-100 text-blue-700" },
  PAID: { label: "Ödendi", classes: "bg-green-100 text-green-700" },
};

const fmt = (v: number) =>
  `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

// ─── Payroll Calculation Helper ────────────────────────────────────────────────

function calcPayroll(base: number, meal: number, transport: number, bonus: number, workedDays: number, absentDays: number) {
  const activeDays = Math.max(0, workedDays - absentDays);
  const dailyBase = workedDays > 0 ? base / workedDays : base;
  const effectiveBase = dailyBase * activeDays;
  const gross = effectiveBase + meal + transport + bonus;
  const sgi = gross * 0.14;
  const unemployment = gross * 0.01;
  const taxableBase = gross - sgi - unemployment;
  const incomeTax = taxableBase * 0.15; // simplified bracket
  const stampTax = gross * 0.00759;
  const net = gross - sgi - unemployment - incomeTax - stampTax;
  const sgiEmployer = gross * 0.155;
  const unemploymentEmployer = gross * 0.02;
  const employerCost = gross + sgiEmployer + unemploymentEmployer;
  return { gross, sgi, unemployment, incomeTax, stampTax, net, employerCost };
}

const defaultForm = {
  personnelId: "",
  baseSalary: "",
  mealAllowance: "",
  transportAllowance: "",
  otherBonus: "",
  workedDays: "30",
  absentDays: "0",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BordroPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<BordroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/bordro?year=${year}&month=${month}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const stats = useMemo(() => {
    if (!data) return { grossTotal: 0, netTotal: 0, employerTotal: 0, sgiTotal: 0 };
    return data.payrolls.reduce((acc, p) => ({
      grossTotal: acc.grossTotal + p.grossSalary,
      netTotal: acc.netTotal + p.netSalary,
      employerTotal: acc.employerTotal + p.employerCost,
      sgiTotal: acc.sgiTotal + (p.grossSalary * 0.155),
    }), { grossTotal: 0, netTotal: 0, employerTotal: 0, sgiTotal: 0 });
  }, [data]);

  // Live calculated preview
  const preview = useMemo(() => {
    const base = Number(form.baseSalary) || 0;
    const meal = Number(form.mealAllowance) || 0;
    const transport = Number(form.transportAllowance) || 0;
    const bonus = Number(form.otherBonus) || 0;
    const worked = Number(form.workedDays) || 30;
    const absent = Number(form.absentDays) || 0;
    if (base <= 0) return null;
    return calcPayroll(base, meal, transport, bonus, worked, absent);
  }, [form]);

  const handleSave = async () => {
    if (!form.personnelId) { setError("Personel seçiniz."); return; }
    if (!form.baseSalary || Number(form.baseSalary) <= 0) { setError("Temel maaş giriniz."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bordro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: form.personnelId,
          year,
          month,
          baseSalary: Number(form.baseSalary),
          mealAllowance: Number(form.mealAllowance) || 0,
          transportAllowance: Number(form.transportAllowance) || 0,
          otherBonus: Number(form.otherBonus) || 0,
          workedDays: Number(form.workedDays) || 30,
          absentDays: Number(form.absentDays) || 0,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Kayıt hatası"); return; }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handleStatus = async (id: string, status: PayrollStatus) => {
    await fetch(`/api/bordro/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const personnelName = (p: PersonnelRef) =>
    [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign size={22} className="text-blue-600" />Bordro Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">Maaş hesaplama ve onay süreci</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month selector */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
          <button
            onClick={() => { setForm({ ...defaultForm }); setError(""); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Bordro Oluştur
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Toplam Brüt", value: fmt(stats.grossTotal), icon: <DollarSign size={18} />, color: "bg-blue-100 text-blue-600" },
          { label: "Toplam Net", value: fmt(stats.netTotal), icon: <Banknote size={18} />, color: "bg-green-100 text-green-600" },
          { label: "İşveren Maliyeti", value: fmt(stats.employerTotal), icon: <Users size={18} />, color: "bg-purple-100 text-purple-600" },
          { label: "SGK (İşveren)", value: fmt(stats.sgiTotal), icon: <CheckCircle size={18} />, color: "bg-orange-100 text-orange-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>{card.icon}</div>
            </div>
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{MONTHS[month - 1]} {year} — Bordro Listesi</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : !data || data.payrolls.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Bu dönem için bordro bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Personel</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Brüt</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">SGK İşçi</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Gelir Vergisi</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Net Maaş</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">İşveren Maliyeti</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Durum</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {data.payrolls.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{personnelName(p.personnel)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-700">{fmt(p.grossSalary)}</td>
                    <td className="px-5 py-3.5 text-right text-gray-500">{fmt(p.sgiWorker)}</td>
                    <td className="px-5 py-3.5 text-right text-gray-500">{fmt(p.incomeTax)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(p.netSalary)}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{fmt(p.employerCost)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[p.status].classes}`}>
                        {STATUS_CONFIG[p.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {p.status === "DRAFT" && (
                          <button
                            onClick={() => handleStatus(p.id, "APPROVED")}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors"
                          >
                            Onayla
                          </button>
                        )}
                        {p.status === "APPROVED" && (
                          <button
                            onClick={() => handleStatus(p.id, "PAID")}
                            className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors"
                          >
                            Ödendi
                          </button>
                        )}
                        {p.status === "PAID" && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CheckCircle size={12} className="text-green-500" />Tamamlandı
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Bordro Oluştur — {MONTHS[month - 1]} {year}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Personel *</label>
                <select
                  value={form.personnelId}
                  onChange={(e) => setForm((f) => ({ ...f, personnelId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Personel seçin...</option>
                  {data?.allPersonnel.map((p) => (
                    <option key={p.id} value={p.id}>{personnelName(p)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Temel Maaş (₺) *</label>
                  <input type="number" min="0" step="0.01" value={form.baseSalary}
                    onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Yemek Yardımı (₺)</label>
                  <input type="number" min="0" step="0.01" value={form.mealAllowance}
                    onChange={(e) => setForm((f) => ({ ...f, mealAllowance: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ulaşım Yardımı (₺)</label>
                  <input type="number" min="0" step="0.01" value={form.transportAllowance}
                    onChange={(e) => setForm((f) => ({ ...f, transportAllowance: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Diğer Prim (₺)</label>
                  <input type="number" min="0" step="0.01" value={form.otherBonus}
                    onChange={(e) => setForm((f) => ({ ...f, otherBonus: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Çalışılan Gün</label>
                  <input type="number" min="1" max="31" value={form.workedDays}
                    onChange={(e) => setForm((f) => ({ ...f, workedDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Devamsızlık Günü</label>
                  <input type="number" min="0" max="31" value={form.absentDays}
                    onChange={(e) => setForm((f) => ({ ...f, absentDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>

              {/* Live preview */}
              {preview && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Hesaplanan Değerler</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {[
                      { label: "Brüt Maaş", value: fmt(preview.gross) },
                      { label: "SGK İşçi (%14)", value: fmt(preview.sgi) },
                      { label: "İşsizlik (%1)", value: fmt(preview.unemployment) },
                      { label: "Gelir Vergisi", value: fmt(preview.incomeTax) },
                      { label: "Damga Vergisi", value: fmt(preview.stampTax) },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-blue-700">{row.label}</span>
                        <span className="font-medium text-blue-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-blue-200 flex justify-between">
                    <span className="text-sm font-bold text-blue-800">NET Maaş</span>
                    <span className="text-sm font-bold text-blue-900">{fmt(preview.net)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Kaydediliyor..." : "Bordro Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
