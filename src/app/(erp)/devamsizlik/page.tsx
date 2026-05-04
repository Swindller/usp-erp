"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X, Utensils, Sun } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = "HOME" | "OFFICE" | "OUTSIDE" | "NONE";

interface PersonnelRef {
  id: string;
  user: { firstName: string | null; lastName: string | null; email: string };
}

interface Attendance {
  id: string;
  personnelId: string;
  date: string;
  isAbsent: boolean;
  absenceReason: string | null;
  mealType: MealType | null;
  mealCost: string | number | null; // Prisma Decimal → string veya number
  notes: string | null;
}

interface DevamsizlikData {
  personnel: PersonnelRef[];
  attendances: Attendance[];
  year: number;
  month: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const MEAL_LABELS: Record<MealType, string> = {
  HOME: "Evde",
  OFFICE: "Ofiste",
  OUTSIDE: "Dışarıda",
  NONE: "Yemedi",
};

// Resmi tatiller (sabit): gg-aa formatında
const RESMI_TATILLER_FIXED: string[] = [
  "01-01", // Yılbaşı
  "23-04", // Ulusal Egemenlik ve Çocuk Bayramı
  "01-05", // Emek ve Dayanışma Günü
  "19-05", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "15-07", // Demokrasi ve Millî Birlik Günü
  "30-08", // Zafer Bayramı
  "29-10", // Cumhuriyet Bayramı
];

function isResmiTatilFixed(day: number, month: number): boolean {
  const key = `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`;
  return RESMI_TATILLER_FIXED.includes(key);
}

const toNum = (v: string | number | null | undefined): number => Number(v ?? 0);

const fmt = (v: number) =>
  `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

const personnelName = (p: PersonnelRef) =>
  [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.email;

// ─── Component ────────────────────────────────────────────────────────────────

type DayState = "present" | "absent" | "holiday" | "weekend" | "fixed_holiday" | "none";

function getDayState(
  person: PersonnelRef,
  day: number,
  month: number,
  year: number,
  lookup: Map<string, Attendance>
): DayState {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0 || dow === 6) return "weekend";
  if (isResmiTatilFixed(day, month)) return "fixed_holiday";
  const a = lookup.get(`${person.id}_${day}`);
  if (!a) return "none";
  if (a.absenceReason === "HOLIDAY") return "holiday";
  if (a.isAbsent) return "absent";
  return "present";
}

const DOT_COLORS: Record<DayState, string | null> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  holiday: "bg-yellow-400",
  weekend: null,
  fixed_holiday: "bg-orange-300",
  none: "bg-gray-300",
};

export default function DevamsizlikPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DevamsizlikData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPersonnel, setModalPersonnel] = useState<PersonnelRef | null>(null);
  const [modalDate, setModalDate] = useState<string>("");
  const [modalAbsent, setModalAbsent] = useState(false);
  const [modalHoliday, setModalHoliday] = useState(false); // Resmi Tatil
  const [modalMealType, setModalMealType] = useState<MealType>("OFFICE");
  const [modalMealCost, setModalMealCost] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/devamsizlik?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok || !json.personnel) { setLoading(false); return; }
      setData(json);
    } finally {
      setLoading(false);
    }
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

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const attendanceLookup = useMemo(() => {
    if (!data) return new Map<string, Attendance>();
    const map = new Map<string, Attendance>();
    data.attendances.forEach((a) => {
      const day = new Date(a.date).getDate();
      map.set(`${a.personnelId}_${day}`, a);
    });
    return map;
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { workingDays: 0, totalAbsences: 0, totalMealCost: 0, totalHolidays: 0 };
    let workingDays = 0;
    let totalHolidays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) {
        if (isResmiTatilFixed(d, month)) totalHolidays++;
        else workingDays++;
      }
    }
    // Kayıtlı tatiller (kullanıcı eklediği)
    const manualHolidays = data.attendances.filter((a) => a.absenceReason === "HOLIDAY").length;
    const totalAbsences = data.attendances.filter((a) => a.isAbsent && a.absenceReason !== "HOLIDAY").length;
    const totalMealCost = data.attendances
      .filter((a) => !a.isAbsent && a.absenceReason !== "HOLIDAY")
      .reduce((s, a) => s + toNum(a.mealCost), 0);
    return { workingDays, totalAbsences, totalMealCost, totalHolidays: totalHolidays + manualHolidays };
  }, [data, daysInMonth, year, month]);

  const openModal = (person: PersonnelRef, day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = attendanceLookup.get(`${person.id}_${day}`);
    setModalPersonnel(person);
    setModalDate(dateStr);
    setModalHoliday(existing?.absenceReason === "HOLIDAY");
    setModalAbsent(existing?.isAbsent ?? false);
    setModalMealType((existing?.mealType as MealType) ?? "OFFICE");
    setModalMealCost(existing?.mealCost != null && existing.mealCost !== "0" ? String(existing.mealCost) : "");
    setModalNotes(existing?.notes ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!modalPersonnel) return;
    setSaving(true);
    try {
      await fetch("/api/devamsizlik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: modalPersonnel.id,
          date: modalDate,
          isAbsent: modalHoliday ? false : modalAbsent,
          absenceReason: modalHoliday ? "HOLIDAY" : (modalAbsent ? "İzinsiz" : null),
          mealType: (modalHoliday || modalAbsent) ? "NONE" : modalMealType,
          mealCost: (modalHoliday || modalAbsent) ? 0 : (modalMealCost ? Number(modalMealCost) : 0),
          notes: modalNotes || undefined,
        }),
      });
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  };

  // Meal cost summary per person
  const mealSummary = useMemo(() => {
    if (!data) return [];
    return data.personnel.map((p) => {
      const records = data.attendances.filter(
        (a) => a.personnelId === p.id && !a.isAbsent && a.absenceReason !== "HOLIDAY"
      );
      const totalCost = records.reduce((s, a) => s + toNum(a.mealCost), 0);
      const breakdown: Partial<Record<MealType, number>> = {};
      records.forEach((a) => {
        if (a.mealType) {
          breakdown[a.mealType as MealType] = (breakdown[a.mealType as MealType] ?? 0) + toNum(a.mealCost);
        }
      });
      return { person: p, totalCost, breakdown };
    }).filter((s) => s.totalCost > 0);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={22} className="text-blue-600" />Devamsızlık &amp; Yemek Takibi
          </h1>
          <p className="text-sm text-gray-500 mt-1">Günlük devam ve yemek kaydı</p>
        </div>
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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Çalışma Günü", value: stats.workingDays, icon: <Calendar size={18} />, color: "bg-blue-100 text-blue-600" },
          { label: "Devamsızlık", value: stats.totalAbsences, icon: <X size={18} />, color: "bg-red-100 text-red-600" },
          { label: "Resmi Tatil", value: stats.totalHolidays, icon: <Sun size={18} />, color: "bg-yellow-100 text-yellow-600" },
          { label: "Yemek Maliyeti", value: fmt(stats.totalMealCost), icon: <Utensils size={18} />, color: "bg-green-100 text-green-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>{card.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Devam Çizelgesi</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Geldi</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Devamsız</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Resmi Tatil</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-300 inline-block" />Sabit Tatil</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />Kayıt Yok</span>
          </div>
        </div>
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : !data || data.personnel.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Personel bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium text-gray-600 text-left min-w-[160px] sticky left-0 bg-gray-50">Personel</th>
                  {daysArray.map((d) => {
                    const dow = new Date(year, month - 1, d).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isFixed = !isWeekend && isResmiTatilFixed(d, month);
                    return (
                      <th
                        key={d}
                        className={`px-1.5 py-3 font-medium text-center w-8 ${
                          isWeekend ? "text-blue-400" : isFixed ? "text-orange-500" : "text-gray-500"
                        }`}
                        title={isFixed ? "Resmi Tatil" : undefined}
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.personnel.map((person) => (
                  <tr key={person.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800 sticky left-0 bg-white">
                      {personnelName(person)}
                    </td>
                    {daysArray.map((d) => {
                      const state = getDayState(person, d, month, year, attendanceLookup);
                      const dotColor = DOT_COLORS[state];
                      const isWeekend = state === "weekend";
                      const isFixedHol = state === "fixed_holiday";
                      return (
                        <td key={d} className={`px-1.5 py-2.5 text-center ${isWeekend ? "bg-blue-50/40" : isFixedHol ? "bg-orange-50/30" : ""}`}>
                          {isWeekend ? (
                            <span className="w-3 h-3 rounded-full bg-gray-100 inline-block" />
                          ) : (
                            <button
                              onClick={() => openModal(person, d)}
                              className="w-5 h-5 rounded-full mx-auto flex items-center justify-center hover:scale-125 transition-transform"
                              title={`${personnelName(person)} — ${d} ${MONTHS[month - 1]}`}
                            >
                              <span className={`w-3 h-3 rounded-full ${dotColor ?? "bg-gray-300"}`} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Meal Cost Summary */}
      {mealSummary.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">{MONTHS[month - 1]} {year} — Yemek Maliyet Özeti</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Personel</th>
                  {(["HOME", "OFFICE", "OUTSIDE", "NONE"] as MealType[]).map((mt) => (
                    <th key={mt} className="px-5 py-3 font-medium text-gray-600 text-right">{MEAL_LABELS[mt]}</th>
                  ))}
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {mealSummary.map(({ person, totalCost, breakdown }) => (
                  <tr key={person.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{personnelName(person)}</td>
                    {(["HOME", "OFFICE", "OUTSIDE", "NONE"] as MealType[]).map((mt) => (
                      <td key={mt} className="px-5 py-3 text-right text-gray-500 text-xs">
                        {breakdown[mt] ? fmt(breakdown[mt]!) : "—"}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cell Modal */}
      {modalOpen && modalPersonnel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Devam Kaydı</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tarih</label>
                <input readOnly value={modalDate}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Personel</label>
                <input readOnly value={personnelName(modalPersonnel)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700" />
              </div>

              {/* Durum seçimi */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Durum</label>
                <div className="flex gap-2">
                  {[
                    { key: "present", label: "Geldi", color: "bg-green-500", active: !modalAbsent && !modalHoliday },
                    { key: "absent", label: "Devamsız", color: "bg-red-500", active: modalAbsent && !modalHoliday },
                    { key: "holiday", label: "Resmi Tatil", color: "bg-yellow-400", active: modalHoliday },
                  ].map(({ key, label, color, active }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setModalAbsent(key === "absent");
                        setModalHoliday(key === "holiday");
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? "border-current shadow-sm"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${active ? color : "bg-gray-300"}`} />
                      <span className={active ? (key === "absent" ? "text-red-600" : key === "holiday" ? "text-yellow-600" : "text-green-600") : ""}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Yemek bilgisi — sadece "Geldi" durumunda */}
              {!modalAbsent && !modalHoliday && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Yemek Türü</label>
                    <select
                      value={modalMealType}
                      onChange={(e) => setModalMealType(e.target.value as MealType)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {(Object.keys(MEAL_LABELS) as MealType[]).map((mt) => (
                        <option key={mt} value={mt}>{MEAL_LABELS[mt]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Yemek Ücreti (₺)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modalMealCost}
                      onChange={(e) => setModalMealCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
