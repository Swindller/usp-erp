"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Monitor, Smartphone, Printer, Camera, Network, Download,
  Plus, Search, Pencil, Trash2, X, Save, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = "telefonlar" | "bilgisayarlar" | "yazicilar" | "kameralar" | "switchler";

interface ApiRecord { id: string; [key: string]: unknown }

interface TabConfig {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  color: string;
  columns: { key: string; label: string; width?: string }[];
  fields: { key: string; label: string; type?: "text" | "select" | "textarea" | "date"; options?: string[] }[];
}

// ─── Tab Configuration ────────────────────────────────────────────────────────

const TABS: TabConfig[] = [
  {
    key: "telefonlar", label: "Telefonlar", color: "blue",
    icon: <Smartphone size={16} />,
    columns: [
      { key: "siraNo",       label: "No",         width: "w-10" },
      { key: "gsmNumara",    label: "GSM No",      width: "w-32" },
      { key: "kisaKod",      label: "Kısa Kod",    width: "w-20" },
      { key: "kullaniciAdi", label: "Kullanıcı"   },
      { key: "departman",    label: "Departman"   },
      { key: "hatDurum",     label: "Hat Durum",   width: "w-24" },
      { key: "cihazMarka",   label: "Marka"       },
      { key: "cihazModel",   label: "Model"       },
      { key: "imei1",        label: "IMEI 1",      width: "w-36" },
      { key: "tarife",       label: "Tarife"      },
    ],
    fields: [
      { key: "siraNo",       label: "S.No",         type: "text" },
      { key: "gsmNumara",    label: "GSM Numarası",  type: "text" },
      { key: "kisaKod",      label: "Kısa Kod",      type: "text" },
      { key: "kullaniciAdi", label: "Kullanıcı Adı", type: "text" },
      { key: "departman",    label: "Departman",      type: "text" },
      { key: "gorev",        label: "Görev",          type: "text" },
      { key: "hatDurum",     label: "Hat Durum",      type: "select", options: ["Aktif", "Pasif", "Dondurulmuş", "İptal"] },
      { key: "cihazMarka",   label: "Cihaz Markası",  type: "text" },
      { key: "cihazModel",   label: "Cihaz Modeli",   type: "text" },
      { key: "imei1",        label: "IMEI 1",         type: "text" },
      { key: "imei2",        label: "IMEI 2",         type: "text" },
      { key: "faturaNo",     label: "Fatura No",      type: "text" },
      { key: "tarife",       label: "Tarife",         type: "text" },
      { key: "tarifeHaklari",label: "Tarife Hakları", type: "text" },
      { key: "pin",          label: "PIN",            type: "text" },
      { key: "teslimDurumu", label: "Teslim Durumu",  type: "select", options: ["Teslim Edildi", "Boşta", "Arızalı", "Kayıp"] },
      { key: "teslimTarihi", label: "Teslim Tarihi",  type: "date" },
      { key: "aciklama",     label: "Açıklama",       type: "textarea" },
    ],
  },
  {
    key: "bilgisayarlar", label: "Bilgisayarlar", color: "indigo",
    icon: <Monitor size={16} />,
    columns: [
      { key: "pcAdi",          label: "PC Adı",        width: "w-28" },
      { key: "kullanici",      label: "Kullanıcı"      },
      { key: "bolum",          label: "Bölüm"          },
      { key: "islemci",        label: "İşlemci"        },
      { key: "ram",            label: "RAM",            width: "w-16" },
      { key: "depolama",       label: "Depolama",       width: "w-24" },
      { key: "isletimSistemi", label: "İşletim Sistemi" },
      { key: "monitor",        label: "Monitör"        },
    ],
    fields: [
      { key: "pcAdi",             label: "PC Adı",              type: "text" },
      { key: "kullanici",         label: "Kullanıcı/Zimmetli",  type: "text" },
      { key: "bolum",             label: "Bölüm",               type: "text" },
      { key: "monitor",           label: "Monitör",             type: "text" },
      { key: "islemci",           label: "İşlemci",             type: "text" },
      { key: "ram",               label: "RAM",                 type: "text" },
      { key: "grafikKarti",       label: "Grafik Kartı",        type: "text" },
      { key: "depolama",          label: "Depolama",            type: "text" },
      { key: "isletimSistemi",    label: "İşletim Sistemi",     type: "text" },
      { key: "kuralanProgramlar", label: "Kurulan Programlar",  type: "textarea" },
      { key: "yazici",            label: "Yazıcı",              type: "text" },
      { key: "hariciDonanim",     label: "Harici Donanım",      type: "text" },
      { key: "kullaniciAdi",      label: "Kullanıcı Adı (AD)",  type: "text" },
      { key: "urunAnahtari",      label: "Ürün Anahtarı",       type: "text" },
      { key: "aciklama",          label: "Açıklama",            type: "textarea" },
    ],
  },
  {
    key: "yazicilar", label: "Yazıcılar", color: "purple",
    icon: <Printer size={16} />,
    columns: [
      { key: "departman", label: "Departman" },
      { key: "kullanan",  label: "Kullanan"  },
      { key: "yaziciAdi", label: "Yazıcı Adı" },
      { key: "baglanti",  label: "Bağlantı (IP)" },
    ],
    fields: [
      { key: "departman", label: "Departman",     type: "text" },
      { key: "kullanan",  label: "Kullanan",      type: "text" },
      { key: "yaziciAdi", label: "Yazıcı Adı",   type: "text" },
      { key: "baglanti",  label: "Bağlantı/IP",  type: "text" },
      { key: "aciklama",  label: "Açıklama",      type: "textarea" },
    ],
  },
  {
    key: "kameralar", label: "Kameralar", color: "rose",
    icon: <Camera size={16} />,
    columns: [
      { key: "kameraNo", label: "No",      width: "w-16" },
      { key: "isim",     label: "İsim"    },
      { key: "ip",       label: "IP",      width: "w-32" },
      { key: "konum",    label: "Konum"   },
      { key: "tip",      label: "Tip",     width: "w-28" },
      { key: "switch",   label: "Switch"  },
      { key: "port",     label: "Port",    width: "w-16" },
      { key: "mac",      label: "MAC",     width: "w-36" },
    ],
    fields: [
      { key: "kameraNo", label: "Kamera No", type: "text" },
      { key: "isim",     label: "İsim",      type: "text" },
      { key: "ip",       label: "IP Adresi", type: "text" },
      { key: "konum",    label: "Konum",     type: "text" },
      { key: "mac",      label: "MAC Adresi",type: "text" },
      { key: "tip",      label: "Tip",       type: "select", options: ["İÇ ORTAM", "DIŞ ORTAM", "TERMAL", "PTZ"] },
      { key: "switch",   label: "Switch",    type: "text" },
      { key: "port",     label: "Port",      type: "text" },
      { key: "aciklama", label: "Açıklama",  type: "textarea" },
    ],
  },
  {
    key: "switchler", label: "Switchler", color: "emerald",
    icon: <Network size={16} />,
    columns: [
      { key: "swAdi",    label: "SW Adı",    width: "w-28" },
      { key: "ip",       label: "IP",        width: "w-32" },
      { key: "lokasyon", label: "Lokasyon"   },
      { key: "bolge",    label: "Bölge"      },
      { key: "marka",    label: "Marka",     width: "w-20" },
      { key: "port",     label: "Port",      width: "w-20" },
      { key: "bb",       label: "BB",        width: "w-24" },
    ],
    fields: [
      { key: "swAdi",    label: "SW Adı",   type: "text" },
      { key: "ip",       label: "IP",       type: "text" },
      { key: "lokasyon", label: "Lokasyon", type: "text" },
      { key: "bolge",    label: "Bölge",    type: "text" },
      { key: "marka",    label: "Marka",    type: "text" },
      { key: "port",     label: "Port",     type: "text" },
      { key: "bb",       label: "BB",       type: "text" },
      { key: "aciklama", label: "Açıklama", type: "textarea" },
    ],
  },
];

// ─── Color maps ───────────────────────────────────────────────────────────────

const TAB_ACTIVE: Record<string, string> = {
  blue:    "border-blue-600 text-blue-700 bg-blue-50",
  indigo:  "border-indigo-600 text-indigo-700 bg-indigo-50",
  purple:  "border-purple-600 text-purple-700 bg-purple-50",
  rose:    "border-rose-600 text-rose-700 bg-rose-50",
  emerald: "border-emerald-600 text-emerald-700 bg-emerald-50",
};

const TAB_INACTIVE = "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50";

const BTN_PRIMARY: Record<string, string> = {
  blue:    "bg-blue-600 hover:bg-blue-700",
  indigo:  "bg-indigo-600 hover:bg-indigo-700",
  purple:  "bg-purple-600 hover:bg-purple-700",
  rose:    "bg-rose-600 hover:bg-rose-700",
  emerald: "bg-emerald-600 hover:bg-emerald-700",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ItEnvanterPage() {
  const [activeTab, setActiveTab] = useState<TabType>("telefonlar");
  const [records,   setRecords]   = useState<ApiRecord[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [editRecord, setEditRecord] = useState<ApiRecord | null>(null);
  const [formData,  setFormData]    = useState<Record<string, string>>({});
  const [saving,    setSaving]      = useState(false);
  const [formError, setFormError]   = useState("");

  const tab = TABS.find((t) => t.key === activeTab)!;
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/it-envanter?type=${activeTab}&q=${encodeURIComponent(search)}&page=${page}`);
      const json = await res.json();
      setRecords(json.records ?? []);
      setTotal(json.total ?? 0);
    } finally { setLoading(false); }
  }, [activeTab, search, page]);

  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditRecord(null);
    setFormData({});
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (r: ApiRecord) => {
    setEditRecord(r);
    const d: Record<string, string> = {};
    tab.fields.forEach((f) => {
      const v = r[f.key];
      if (v !== null && v !== undefined) {
        if (f.type === "date" && v) {
          d[f.key] = String(v).slice(0, 10);
        } else {
          d[f.key] = String(v);
        }
      }
    });
    setFormData(d);
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError("");
    try {
      const method = editRecord ? "PATCH" : "POST";
      const url    = editRecord
        ? `/api/it-envanter/${editRecord.id}?type=${activeTab}`
        : `/api/it-envanter?type=${activeTab}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(JSON.stringify(json.error)); return; }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/it-envanter/${id}?type=${activeTab}`, { method: "DELETE" });
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res  = await fetch(`/api/it-envanter/export?type=${activeTab}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `IT_Envanter_${tab.label}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Monitor size={22} className="text-blue-600" />IT Envanter
          </h1>
          <p className="text-sm text-gray-500 mt-1">Telefonlar · Bilgisayarlar · Yazıcılar · Kameralar · Switchler</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key ? TAB_ACTIVE[t.color] : TAB_INACTIVE
              }`}
            >
              {t.icon}{t.label}
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-normal">
                {activeTab === t.key ? total : ""}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${tab.label} ara...`}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Excel İndir
          </button>
          <button
            onClick={openCreate}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors ${BTN_PRIMARY[tab.color]}`}
          >
            <Plus size={15} />{tab.label.slice(0, -2)} Ekle
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">{tab.icon}</div>
            <p className="text-gray-500 text-sm">{search ? "Arama sonucu bulunamadı" : `Henüz ${tab.label.toLowerCase()} kaydı yok`}</p>
            <button onClick={openCreate} className={`mt-4 px-4 py-2 text-sm font-semibold rounded-xl text-white ${BTN_PRIMARY[tab.color]}`}>
              <span className="flex items-center gap-1.5"><Plus size={14} />İlk kaydı ekle</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {tab.columns.map((c) => (
                    <th key={c.key} className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap ${c.width ?? ""}`}>{c.label}</th>
                  ))}
                  <th className="px-4 py-3 font-medium text-gray-600 text-center w-20">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                    {tab.columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-gray-700 text-xs">
                        {c.key === "hatDurum" ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r[c.key] === "Aktif"         ? "bg-green-100 text-green-700"  :
                            r[c.key] === "Pasif"         ? "bg-gray-100 text-gray-600"    :
                            r[c.key] === "Dondurulmuş"  ? "bg-blue-100 text-blue-700"    :
                            r[c.key] === "Arızalı"      ? "bg-red-100 text-red-700"      :
                                                           "bg-gray-100 text-gray-500"
                          }`}>{String(r[c.key] ?? "—")}</span>
                        ) : c.key === "teslimDurumu" ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r[c.key] === "Teslim Edildi" ? "bg-green-100 text-green-700"  :
                            r[c.key] === "Boşta"         ? "bg-yellow-100 text-yellow-700":
                            r[c.key] === "Arızalı"       ? "bg-red-100 text-red-700"      :
                                                            "bg-gray-100 text-gray-500"
                          }`}>{String(r[c.key] ?? "—")}</span>
                        ) : (
                          <span className="truncate block max-w-[200px]" title={String(r[c.key] ?? "")}>
                            {String(r[c.key] ?? "—")}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} kayıt · Sayfa {page}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {tab.icon}
                {editRecord ? `${tab.label.slice(0, -2)} Düzenle` : `Yeni ${tab.label.slice(0, -2)}`}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{formError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tab.fields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
                    {f.type === "select" ? (
                      <select
                        value={formData[f.key] ?? ""}
                        onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="">Seçiniz</option>
                        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        value={formData[f.key] ?? ""}
                        onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                    ) : (
                      <input
                        type={f.type === "date" ? "date" : "text"}
                        value={formData[f.key] ?? ""}
                        onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${BTN_PRIMARY[tab.color]}`}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
