"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Building2, User, Search, Plus, Edit2, Trash2, X, Phone, Mail, MapPin, Wrench, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

type CustomerType = "INDIVIDUAL" | "CORPORATE";

interface Customer {
  id: string;
  type: CustomerType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  phone: string;
  phone2: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  notes: string | null;
  _count: { serviceReports: number };
}

const defaultForm = {
  type: "INDIVIDUAL" as CustomerType,
  firstName: "", lastName: "", companyName: "", taxNumber: "", taxOffice: "",
  phone: "", phone2: "", email: "", address: "", city: "", district: "", notes: "",
};

interface Maintenance {
  id: string;
  description: string;
  lastDate: string;
  nextDate: string;
  periodMonths: number;
  isActive: boolean;
  notes: string | null;
}

const PERIOD_OPTIONS = [
  { value: 1,  label: "Aylık" },
  { value: 3,  label: "3 Ayda Bir" },
  { value: 6,  label: "6 Ayda Bir" },
  { value: 12, label: "Yıllık" },
  { value: 24, label: "2 Yılda Bir" },
];

const defaultBakimForm = { description: "", startDate: "", periodMonths: 12, notes: "" };

export default function MusterilerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Bakım state
  const [bakimCustomer, setBakimCustomer]   = useState<Customer | null>(null);
  const [maintenances, setMaintenances]     = useState<Maintenance[]>([]);
  const [bakimLoading, setBakimLoading]     = useState(false);
  const [showBakimForm, setShowBakimForm]   = useState(false);
  const [bakimForm, setBakimForm]           = useState(defaultBakimForm);
  const [bakimSaving, setBakimSaving]       = useState(false);
  const [bakimError, setBakimError]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(q && { q }) });
    const res = await fetch(`/api/musteriler?${params}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setTotal(data.total ?? 0);
    setPages(Math.ceil((data.total ?? 0) / 25));
    setLoading(false);
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({
      type: c.type, firstName: c.firstName ?? "", lastName: c.lastName ?? "",
      companyName: c.companyName ?? "", taxNumber: c.taxNumber ?? "", taxOffice: c.taxOffice ?? "",
      phone: c.phone, phone2: c.phone2 ?? "", email: c.email ?? "",
      address: c.address ?? "", city: c.city ?? "", district: c.district ?? "", notes: c.notes ?? "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setError("");
    if (!form.phone) { setError("Telefon numarası zorunludur."); return; }
    if (form.type === "INDIVIDUAL" && !form.firstName) { setError("Ad zorunludur."); return; }
    if (form.type === "CORPORATE" && !form.companyName) { setError("Firma adı zorunludur."); return; }
    setSaving(true);
    try {
      const body = { ...form, email: form.email || null, phone2: form.phone2 || null, address: form.address || null, city: form.city || null, district: form.district || null, notes: form.notes || null, taxNumber: form.taxNumber || null, taxOffice: form.taxOffice || null };
      if (editTarget) {
        const res = await fetch(`/api/musteriler/${editTarget.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Güncelleme hatası"); return; }
      } else {
        const res = await fetch("/api/musteriler", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Kayıt hatası"); return; }
      }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/musteriler/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  };

  const customerName = (c: Customer) =>
    c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";

  const openBakim = async (c: Customer) => {
    setBakimCustomer(c);
    setBakimLoading(true);
    setShowBakimForm(false);
    setBakimForm(defaultBakimForm);
    setBakimError("");
    const res = await fetch(`/api/musteriler/${c.id}/bakim`);
    const data = await res.json();
    setMaintenances(data.maintenances ?? []);
    setBakimLoading(false);
  };

  const saveBakim = async () => {
    if (!bakimCustomer) return;
    if (!bakimForm.description) { setBakimError("Sistem açıklaması zorunludur."); return; }
    if (!bakimForm.startDate)   { setBakimError("Başlangıç tarihi zorunludur."); return; }
    setBakimSaving(true);
    setBakimError("");
    try {
      const res = await fetch(`/api/musteriler/${bakimCustomer.id}/bakim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bakimForm),
      });
      const data = await res.json();
      if (!res.ok) { setBakimError(typeof data.error === "string" ? data.error : "Hata"); return; }
      setMaintenances((m) => [...m, data.maintenance]);
      setBakimForm(defaultBakimForm);
      setShowBakimForm(false);
    } finally { setBakimSaving(false); }
  };

  const deleteBakim = async (maintenanceId: string) => {
    if (!bakimCustomer) return;
    await fetch(`/api/musteriler/${bakimCustomer.id}/bakim?maintenanceId=${maintenanceId}`, { method: "DELETE" });
    setMaintenances((m) => m.filter((x) => x.id !== maintenanceId));
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-blue-600" />Müşteriler
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} aktif müşteri</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus size={16} />Müşteri Ekle
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="İsim, telefon veya e-posta..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center"><Users size={36} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Müşteri bulunamadı</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {c.type === "CORPORATE" ? <Building2 size={16} className="text-gray-500" /> : <User size={16} className="text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{customerName(c)}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</span>
                    {c.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                    {c.city && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{[c.city, c.district].filter(Boolean).join(", ")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-blue-600">{c._count.serviceReports} servis</p>
                    <p className="text-xs text-gray-400">{c.type === "CORPORATE" ? "Kurumsal" : "Şahıs"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openBakim(c)} title="Periyodik Bakım" className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"><CalendarDays size={14} /></button>
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editTarget ? "Müşteriyi Düzenle" : "Yeni Müşteri"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>}

              {/* Tip seçimi */}
              <div className="flex gap-3">
                {(["INDIVIDUAL", "CORPORATE"] as CustomerType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${form.type === t ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {t === "INDIVIDUAL" ? "Şahıs" : "Kurumsal"}
                  </button>
                ))}
              </div>

              {form.type === "INDIVIDUAL" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Ad *</label>
                    <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Soyad</label>
                    <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Firma Adı *</label>
                    <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Vergi No</label>
                      <input value={form.taxNumber} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Vergi Dairesi</label>
                      <input value={form.taxOffice} onChange={(e) => setForm((f) => ({ ...f, taxOffice: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Telefon *</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05XX..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">E-posta</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">İl</label>
                  <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Antalya"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">İlçe</label>
                  <input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} placeholder="Kepez"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Adres</label>
                <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Kaydediliyor..." : editTarget ? "Güncelle" : "Müşteri Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Periyodik Bakım Modal ── */}
      {bakimCustomer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays size={16} className="text-green-600" />Periyodik Bakım Planı
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{customerName(bakimCustomer)}</p>
              </div>
              <button onClick={() => setBakimCustomer(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {bakimError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{bakimError}</div>}

              {/* Mevcut bakım kayıtları */}
              {bakimLoading ? (
                <div className="py-6 text-center"><div className="animate-spin w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full mx-auto" /></div>
              ) : maintenances.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                  <Wrench size={28} className="text-gray-300" />
                  Henüz bakım planı yok
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenances.map((m) => {
                    const isOverdue = new Date(m.nextDate) < new Date();
                    const period = PERIOD_OPTIONS.find((p) => p.value === m.periodMonths)?.label ?? `${m.periodMonths} aylık`;
                    return (
                      <div key={m.id} className={`border rounded-xl p-3 ${isOverdue ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-50"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{m.description}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><CalendarDays size={10} />İlk: {fmt(m.lastDate)}</span>
                              <span className={`flex items-center gap-1 font-medium ${isOverdue ? "text-orange-600" : "text-green-600"}`}>
                                Sonraki: {fmt(m.nextDate)} {isOverdue ? "⚠ Gecikmiş" : ""}
                              </span>
                              <span>{period}</span>
                            </div>
                            {m.notes && <p className="text-xs text-gray-400 mt-1">{m.notes}</p>}
                          </div>
                          <button onClick={() => deleteBakim(m.id)} className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Yeni bakım formu */}
              <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowBakimForm((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-2"><Plus size={14} />Yeni Bakım Planı Ekle</span>
                  {showBakimForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showBakimForm && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Devriye Alınacak Sistemler / Açıklama *</label>
                      <textarea
                        value={bakimForm.description}
                        onChange={(e) => setBakimForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        placeholder="Örn: Grundfos CM5 pompa, basınç tankı, filtre sistemi, elektrik panosu kontrol..."
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">İlk Bakım Tarihi *</label>
                        <input
                          type="date"
                          value={bakimForm.startDate}
                          onChange={(e) => setBakimForm((f) => ({ ...f, startDate: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Bakım Sıklığı</label>
                        <select
                          value={bakimForm.periodMonths}
                          onChange={(e) => setBakimForm((f) => ({ ...f, periodMonths: Number(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          {PERIOD_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Ek Notlar</label>
                      <input
                        value={bakimForm.notes}
                        onChange={(e) => setBakimForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Özel talimatlar, müşteri tercihleri..."
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <button onClick={saveBakim} disabled={bakimSaving}
                      className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                      {bakimSaving ? "Kaydediliyor..." : "Bakım Planını Kaydet"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={() => setBakimCustomer(null)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto"><Trash2 size={22} className="text-red-600" /></div>
            <div className="text-center">
              <h3 className="font-bold text-gray-900">Müşteriyi Sil</h3>
              <p className="text-sm text-gray-500 mt-1"><strong>{customerName(deleteTarget)}</strong> silinecek. Servis geçmişi korunur.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
