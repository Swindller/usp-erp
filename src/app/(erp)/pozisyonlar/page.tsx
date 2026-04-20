"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, Edit2, Trash2, X, CheckCircle, ToggleLeft, ToggleRight } from "lucide-react";

interface Position {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

const defaultForm = { name: "", description: "" };

export default function PozisyonlarPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Position | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/pozisyonlar");
    const data = await res.json();
    setPositions(data.positions ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (p: Position) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? "" });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Pozisyon adı zorunludur."); return; }
    setError("");
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch(`/api/pozisyonlar/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Güncelleme hatası"); return; }
      } else {
        const res = await fetch("/api/pozisyonlar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Kayıt hatası"); return; }
      }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (p: Position) => {
    await fetch(`/api/pozisyonlar/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/pozisyonlar/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  };

  const active = positions.filter((p) => p.isActive);
  const inactive = positions.filter((p) => !p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={22} className="text-blue-600" />Pozisyon Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} aktif pozisyon</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
          <Plus size={16} />Pozisyon Ekle
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></div>
      ) : positions.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Briefcase size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Henüz pozisyon eklenmemiş</p>
          <p className="text-xs text-gray-400 mt-1">Personel atamalarında kullanmak için pozisyon oluşturun</p>
          <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">İlk Pozisyonu Ekle</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Aktif Pozisyonlar */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Aktif Pozisyonlar</h2>
              <span className="text-xs text-gray-400">{active.length} adet</span>
            </div>
            {active.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aktif pozisyon yok.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {active.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Briefcase size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(p)} title="Pasif yap"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-green-500 hover:text-gray-500 transition-colors">
                        <ToggleRight size={18} />
                      </button>
                      <button onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pasif Pozisyonlar */}
          {inactive.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden opacity-70">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-600 text-sm">Pasif Pozisyonlar</h2>
                <span className="text-xs text-gray-400">{inactive.length} adet</span>
              </div>
              <div className="divide-y divide-gray-50">
                {inactive.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Briefcase size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-500 text-sm">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(p)} title="Aktif yap"
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-500 transition-colors">
                        <ToggleLeft size={18} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editTarget ? "Pozisyon Düzenle" : "Yeni Pozisyon"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Pozisyon Adı *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Örn: Baş Teknisyen, Saha Müdürü..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Pozisyon hakkında kısa açıklama (opsiyonel)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">İptal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Kaydediliyor..." : editTarget ? "Güncelle" : "Ekle"}
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
              <h3 className="font-bold text-gray-900">Pozisyonu Sil</h3>
              <p className="text-sm text-gray-500 mt-1"><span className="font-semibold text-gray-700">"{deleteTarget.name}"</span> pozisyonu kalıcı silinecek.</p>
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
