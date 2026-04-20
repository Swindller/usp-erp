"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users, Plus, Edit2, Trash2, X, CheckCircle, TrendingUp,
  Wrench, Eye, EyeOff, KeyRound,
} from "lucide-react";

type PersonnelRole = "TECHNICIAN" | "FIELD_TECHNICIAN" | "WORKSHOP_TECHNICIAN" | "SUPERVISOR" | "MANAGER";

interface Personnel {
  id: string;
  role: PersonnelRole;
  positionTitle: string | null;
  department: string | null;
  speciality: string | null;
  phone: string | null;
  salary: number | null;
  permissions: string[];
  isActive: boolean;
  user: { id: string; firstName: string | null; lastName: string | null; email: string; role: string };
}


const ROLE_LABELS: Record<PersonnelRole, string> = {
  MANAGER: "Yönetici",
  FIELD_TECHNICIAN: "Satış",
  WORKSHOP_TECHNICIAN: "Muhasebe",
  TECHNICIAN: "Teknisyen",
  SUPERVISOR: "Yönetici",  // eski kayıtlar için — dropdown'da gösterilmez
};

// Dropdown'da gösterilecek 4 rol
const DISPLAY_ROLES: PersonnelRole[] = ["MANAGER", "FIELD_TECHNICIAN", "WORKSHOP_TECHNICIAN", "TECHNICIAN"];

// Pozisyon adından sistem rolü belirle
function inferRole(positionTitle: string): PersonnelRole {
  const lower = positionTitle.toLowerCase();
  if (lower.includes("yönetici") || lower.includes("müdür") || lower.includes("manager") || lower.includes("supervisor")) return "MANAGER";
  if (lower.includes("satış") || lower.includes("satis") || lower.includes("sales")) return "FIELD_TECHNICIAN";
  if (lower.includes("muhasebe") || lower.includes("finans") || lower.includes("accounting")) return "WORKSHOP_TECHNICIAN";
  return "TECHNICIAN";
}

const ALL_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "servis", label: "Servis Yönetimi" },
  { key: "musteriler", label: "Müşteriler" },
  { key: "muhasebe", label: "Muhasebe" },
  { key: "stok", label: "Stok Yönetimi" },
  { key: "bordro", label: "Bordro" },
  { key: "devamsizlik", label: "Devamsızlık" },
  { key: "vergiler", label: "Vergi Takibi" },
  { key: "personel", label: "Personel" },
];

const defaultForm = {
  firstName: "", lastName: "", email: "", password: "",
  personnelRole: "TECHNICIAN" as PersonnelRole,
  positionTitle: "",
  department: "", speciality: "", phone: "", salary: "",
  permissions: ["servis"] as string[],
  isAdmin: false,
};

export default function PersonelPage() {
  const { data: sessionData } = useSession();
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes((sessionData?.user as { role?: string })?.role ?? "");

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Personnel | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Personnel | null>(null);

  // Şifre değiştirme
  const [pwTarget, setPwTarget] = useState<Personnel | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const pRes = await fetch("/api/personel");
      const pData = await pRes.json();
      setPersonnel(pData.personnel ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (p: Personnel) => {
    setEditTarget(p);
    setForm({
      firstName: p.user.firstName ?? "",
      lastName: p.user.lastName ?? "",
      email: p.user.email,
      password: "",
      personnelRole: p.role,
      positionTitle: p.positionTitle ?? "",
      department: p.department ?? "",
      speciality: p.speciality ?? "",
      phone: p.phone ?? "",
      salary: p.salary != null ? String(p.salary) : "",
      permissions: p.permissions,
      isAdmin: false,
    });
    setError("");
    setShowModal(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      // Pozisyon seçilmişse sistem rolünü otomatik belirle
      const inferredRole = form.positionTitle ? inferRole(form.positionTitle) : form.personnelRole;

      if (editTarget) {
        const res = await fetch(`/api/personel/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            personnelRole: inferredRole,
            positionTitle: form.positionTitle || null,
            department: form.department || null,
            speciality: form.speciality || null,
            phone: form.phone || null,
            salary: form.salary ? parseFloat(form.salary) : null,
            permissions: form.permissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Güncelleme hatası"); return; }
      } else {
        const res = await fetch("/api/personel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            personnelRole: inferredRole,
            positionTitle: form.positionTitle || undefined,
            salary: form.salary ? parseFloat(form.salary) : undefined,
            isAdmin: form.isAdmin,
          }),
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
    await fetch(`/api/personel/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  };

  const openPwModal = (p: Personnel) => {
    setPwTarget(p);
    setNewPw("");
    setConfirmPw("");
    setPwError("");
    setShowNewPw(false);
  };

  const handlePasswordChange = async () => {
    if (!pwTarget) return;
    if (newPw.length < 6) { setPwError("Şifre en az 6 karakter olmalıdır."); return; }
    if (newPw !== confirmPw) { setPwError("Şifreler eşleşmiyor."); return; }
    setPwError("");
    setPwSaving(true);
    try {
      const res = await fetch(`/api/personel/${pwTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || "Şifre değiştirilemedi."); return; }
      setPwTarget(null);
    } finally { setPwSaving(false); }
  };

  const totalCount = personnel.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-blue-600" />Personel Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} aktif personel</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus size={16} />Personel Ekle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Toplam Personel", value: totalCount, icon: <Users size={20} />, color: "bg-blue-100 text-blue-600" },
          { label: "Teknisyen", value: personnel.filter((p) => p.role.includes("TECHNICIAN")).length, icon: <Wrench size={20} />, color: "bg-green-100 text-green-600" },
          { label: "Yönetici", value: personnel.filter((p) => ["SUPERVISOR", "MANAGER"].includes(p.role)).length, icon: <TrendingUp size={20} />, color: "bg-purple-100 text-purple-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>{card.icon}</div>
              <div><p className="text-xs text-gray-500">{card.label}</p><p className="text-2xl font-bold text-gray-900">{card.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Personel Listesi</h2></div>
        {loading ? (
          <div className="py-16 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></div>
        ) : personnel.length === 0 ? (
          <div className="py-16 text-center"><Users size={36} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Henüz personel yok</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Ad Soyad</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Rol</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Departman</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Yetkili Sayfalar</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Maaş</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map((p) => {
                  const name = [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.email;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400">{p.user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {p.positionTitle ?? ROLE_LABELS[p.role] ?? p.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600 text-xs">{p.department || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.permissions.length === 0 ? (
                            <span className="text-xs text-gray-400">Yok</span>
                          ) : p.permissions.map((perm) => (
                            <span key={perm} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
                              {ALL_PERMISSIONS.find((pp) => pp.key === perm)?.label ?? perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 text-xs">
                        {p.salary != null ? `₺${parseFloat(String(p.salary)).toLocaleString("tr-TR")}` : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEdit(p)} title="Düzenle" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => openPwModal(p)} title="Şifre Değiştir" className="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors"><KeyRound size={14} /></button>
                            <button onClick={() => setDeleteTarget(p)} title="Sil" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 block text-center">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editTarget ? "Personel Düzenle" : "Yeni Personel Ekle"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Ad *</label>
                  <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Soyad *</label>
                  <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              {!editTarget && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">E-posta *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Şifre *</label>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10" />
                      <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Pozisyon *</label>
                  <select
                    value={form.positionTitle}
                    onChange={(e) => setForm((f) => ({ ...f, positionTitle: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">— Seçiniz —</option>
                    {DISPLAY_ROLES.map((r) => (
                      <option key={r} value={ROLE_LABELS[r]}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Maaş (₺)</label>
                  <input type="number" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} placeholder="Opsiyonel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Departman</label>
                  <input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="Teknik Servis"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Telefon</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05XX..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              {/* Admin Yetkisi */}
              {!editTarget && (
                <div className={`rounded-xl border px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${form.isAdmin ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-200"}`}
                  onClick={() => setForm((f) => ({ ...f, isAdmin: !f.isAdmin, permissions: !f.isAdmin ? ALL_PERMISSIONS.map(p => p.key) : f.permissions }))}>
                  <div>
                    <p className={`text-sm font-semibold ${form.isAdmin ? "text-purple-800" : "text-gray-700"}`}>Admin Yetkileri Ver</p>
                    <p className="text-xs text-gray-500 mt-0.5">Personel ekleyebilir, silebilir, tüm sayfalara tam erişim</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.isAdmin ? "bg-purple-600" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isAdmin ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>
              )}

              {/* Yetki Atama */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Erişim Yetkileri</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const active = form.permissions.includes(perm.key);
                    return (
                      <button key={perm.key} type="button" onClick={() => togglePerm(perm.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors text-left ${active ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${active ? "bg-blue-600" : "border border-gray-300"}`}>
                          {active && <CheckCircle size={12} className="text-white" />}
                        </div>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Admin ve Yöneticiler tüm sayfalara erişebilir.</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Kaydediliyor..." : editTarget ? "Güncelle" : "Personel Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Şifre Değiştir Modal */}
      {pwTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-yellow-600" />
                <h3 className="font-bold text-gray-900">Şifre Değiştir</h3>
              </div>
              <button onClick={() => setPwTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{[pwTarget.user.firstName, pwTarget.user.lastName].filter(Boolean).join(" ")}</span> için yeni şifre belirleyin.
              </p>
              {pwError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{pwError}</div>}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Yeni Şifre *</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Şifreyi Onayla *</label>
                <input
                  type={showNewPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Şifreyi tekrar girin"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setPwTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
              <button onClick={handlePasswordChange} disabled={pwSaving} className="flex-1 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50">
                {pwSaving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
              </button>
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
              <h3 className="font-bold text-gray-900">Personeli Sil</h3>
              <p className="text-sm text-gray-500 mt-1">{[deleteTarget.user.firstName, deleteTarget.user.lastName].filter(Boolean).join(" ")} adlı personel devre dışı bırakılacak.</p>
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
