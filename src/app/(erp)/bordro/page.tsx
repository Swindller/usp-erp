"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DollarSign, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Banknote, Users, Search, Loader2, Sun } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

interface PersonnelRef {
  id: string;
  salary?: string | number | null;
  user: { firstName: string | null; lastName: string | null; email: string };
}

interface AttendanceRec {
  personnelId: string;
  isAbsent: boolean;
  absenceReason: string | null;
  mealCost: string | number | null;
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
  attendances: AttendanceRec[];
  year: number;
  month: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const STATUS_CONFIG: Record<PayrollStatus, { label: string; classes: string }> = {
  DRAFT:    { label: "Taslak",   classes: "bg-gray-100 text-gray-600" },
  APPROVED: { label: "Onaylandı", classes: "bg-blue-100 text-blue-700" },
  PAID:     { label: "Ödendi",   classes: "bg-green-100 text-green-700" },
};

const fmt = (v: number) =>
  `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

const toNum = (v: string | number | null | undefined) => Number(v ?? 0);

// Resmi tatiller sabit
const RESMI_TATILLER_FIXED: string[] = [
  "01-01","23-04","01-05","19-05","15-07","30-08","29-10",
];
function countFixedHolidays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${String(d).padStart(2,"0")}-${String(month).padStart(2,"0")}`;
    if (RESMI_TATILLER_FIXED.includes(key)) count++;
  }
  return count;
}
function countWorkingDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count - countFixedHolidays(year, month);
}

// ─── Payroll Calculation ───────────────────────────────────────────────────────

function calcPayroll(base: number, meal: number, transport: number, bonus: number, workedDays: number, absentDays: number) {
  const activeDays = Math.max(0, workedDays - absentDays);
  const dailyBase = workedDays > 0 ? base / workedDays : base;
  const effectiveBase = dailyBase * activeDays;
  const gross = effectiveBase + meal + transport + bonus;
  const sgi = Math.round(gross * 0.14 * 100) / 100;
  const unemployment = Math.round(gross * 0.01 * 100) / 100;
  const taxableBase = gross - sgi - unemployment;
  const incomeTax = Math.round(taxableBase * 0.15 * 100) / 100;
  const stampTax = Math.round(gross * 0.00759 * 100) / 100;
  const net = Math.max(0, gross - sgi - unemployment - incomeTax - stampTax);
  const sgiEmployer = Math.round(gross * 0.155 * 100) / 100;
  const unemploymentEmployer = Math.round(gross * 0.02 * 100) / 100;
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
  holidays: "0",
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

  // Personel arama
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bordro?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok || !json.payrolls) { setLoading(false); return; }
      setData(json);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Click outside dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const personnelName = (p: PersonnelRef) =>
    [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.email;

  // Personel seçilince otomatik doldur
  const selectPersonnel = (p: PersonnelRef) => {
    if (!data) return;

    const workingDays = countWorkingDays(year, month);
    const fixedHolidays = countFixedHolidays(year, month);

    // Bu personele ait bu aya ait devamsızlık kayıtları
    const recs = data.attendances.filter((a) => a.personnelId === p.id);
    const absentDays = recs.filter((a) => a.isAbsent && a.absenceReason !== "HOLIDAY").length;
    const manualHolidays = recs.filter((a) => a.absenceReason === "HOLIDAY").length;
    const totalHolidays = fixedHolidays + manualHolidays;
    // Yemek toplamı
    const mealTotal = recs
      .filter((a) => !a.isAbsent && a.absenceReason !== "HOLIDAY")
      .reduce((s, a) => s + toNum(a.mealCost), 0);

    // Temel maaş: personnel.salary veya mevcut değer
    const baseSalary = p.salary ? String(Math.round(toNum(p.salary))) : form.baseSalary;

    setForm((f) => ({
      ...f,
      personnelId: p.id,
      baseSalary,
      mealAllowance: mealTotal > 0 ? String(Math.round(mealTotal * 100) / 100) : f.mealAllowance,
      workedDays: String(workingDays),
      absentDays: String(absentDays),
      holidays: String(totalHolidays),
    }));

    // Seçilen personel adını search'e yaz
    setSearch(personnelName(p));
    setShowDropdown(false);
  };

  const filteredPersonnel = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.allPersonnel;
    return data.allPersonnel.filter((p) =>
      personnelName(p).toLowerCase().includes(q) || p.user.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  const openModal = () => {
    const workingDays = countWorkingDays(year, month);
    setForm({ ...defaultForm, workedDays: String(workingDays) });
    setSearch("");
    setError("");
    setShowModal(true);
  };

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
          year, month,
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

  // Resmi tatil özeti
  const fixedHolidayCount = countFixedHolidays(year, month);

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
            onClick={openModal}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />Bordro Oluştur
          </button>
        </div>
      </div>

      {/* Resmi tatil bilgi bandı */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
        <Sun size={15} className="text-yellow-500 flex-shrink-0" />
        <span className="text-yellow-800">
          <strong>{MONTHS[month - 1]} {year}</strong> — {fixedHolidayCount} sabit resmi tatil,{" "}
          <strong>{countWorkingDays(year, month)}</strong> çalışma günü
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Toplam Brüt",    value: fmt(stats.grossTotal),    icon: <DollarSign size={18} />, color: "bg-blue-100 text-blue-600" },
          { label: "Toplam Net",     value: fmt(stats.netTotal),      icon: <Banknote size={18} />,  color: "bg-green-100 text-green-600" },
          { label: "İşveren Maliyeti", value: fmt(stats.employerTotal), icon: <Users size={18} />,  color: "bg-purple-100 text-purple-600" },
          { label: "SGK (İşveren)",  value: fmt(stats.sgiTotal),      icon: <CheckCircle size={18} />, color: "bg-orange-100 text-orange-600" },
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
                          <button onClick={() => handleStatus(p.id, "APPROVED")}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors">
                            Onayla
                          </button>
                        )}
                        {p.status === "APPROVED" && (
                          <button onClick={() => handleStatus(p.id, "PAID")}
                            className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors">
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

              {/* Personel Arama */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Personel *</label>
                <div className="relative" ref={searchRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setForm((f) => ({ ...f, personnelId: "" })); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Personel adı veya e-posta ile ara..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {form.personnelId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                      <CheckCircle size={14} />
                    </span>
                  )}
                  {showDropdown && filteredPersonnel.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {filteredPersonnel.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPersonnel(p)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 text-left transition-colors ${form.personnelId === p.id ? "bg-blue-50" : ""}`}
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-800">{personnelName(p)}</div>
                            <div className="text-xs text-gray-400">{p.user.email}</div>
                          </div>
                          {p.salary && (
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {fmt(toNum(p.salary))}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.personnelId && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Seçildi — devamsızlık ve yemek verileri otomatik dolduruldu
                  </p>
                )}
              </div>

              {/* Resmi tatil bilgisi */}
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-800">
                <Sun size={13} className="text-yellow-500 flex-shrink-0" />
                <span>Bu ay <strong>{countFixedHolidays(year, month)}</strong> sabit resmi tatil,{" "}
                  <strong>{countWorkingDays(year, month)}</strong> çalışma günü</span>
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
                  {form.personnelId && form.mealAllowance && (
                    <p className="text-[10px] text-blue-600 mt-0.5">Devamsızlık kaydından alındı</p>
                  )}
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
                  {form.personnelId && (
                    <p className="text-[10px] text-blue-600 mt-0.5">Devamsızlık kaydından alındı</p>
                  )}
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
                      { label: "Gelir Vergisi (%15)", value: fmt(preview.incomeTax) },
                      { label: "Damga Vergisi", value: fmt(preview.stampTax) },
                      { label: "İşveren Maliyeti", value: fmt(preview.employerCost) },
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
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Kaydediliyor..." : "Bordro Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
