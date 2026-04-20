"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package, Plus, Minus, X, Search, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, RotateCcw, AlertTriangle, PackageOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "RETURN";

interface Brand { name: string }

interface Product {
  id: string;
  nameTr: string;
  sku: string | null;
  stock: number;
  price: number;
  brand: Brand | null;
}

interface Movement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  unitPrice: number | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface StokData {
  products: Product[];
  total: number;
  recentMovements: Movement[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<MovementType, string> = {
  IN: "Giriş",
  OUT: "Çıkış",
  ADJUSTMENT: "Düzeltme",
  RETURN: "İade",
};

const MOVEMENT_BADGE: Record<MovementType, string> = {
  IN: "bg-green-100 text-green-700",
  OUT: "bg-red-100 text-red-700",
  ADJUSTMENT: "bg-yellow-100 text-yellow-700",
  RETURN: "bg-blue-100 text-blue-700",
};

const defaultForm = {
  productId: "",
  type: "IN" as MovementType,
  quantity: "",
  unitPrice: "",
  reference: "",
  notes: "",
};

const fmt = (v: number) =>
  `₺${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
  });

// ─── Component ────────────────────────────────────────────────────────────────

export default function StokPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [data, setData] = useState<StokData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stok");
      const json = await res.json();
      if (!res.ok || !json.products) { setLoading(false); return; }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced URL update
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search); else params.delete("q");
      router.replace(`?${params.toString()}`);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, router, searchParams]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const lower = q.toLowerCase();
    if (!lower) return data.products;
    return data.products.filter(
      (p) =>
        p.nameTr.toLowerCase().includes(lower) ||
        (p.sku ?? "").toLowerCase().includes(lower) ||
        (p.brand?.name ?? "").toLowerCase().includes(lower),
    );
  }, [data, q]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, lowStock: 0, outOfStock: 0 };
    return {
      total: data.total,
      lowStock: data.products.filter((p) => p.stock > 0 && p.stock < 5).length,
      outOfStock: data.products.filter((p) => p.stock === 0).length,
    };
  }, [data]);

  const openModal = (product: Product, type: "IN" | "OUT") => {
    setForm({ ...defaultForm, productId: product.id, type });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.quantity || Number(form.quantity) <= 0) {
      setError("Miktar 0'dan büyük olmalıdır.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          type: form.type,
          quantity: Number(form.quantity),
          unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Kayıt hatası"); return; }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const stockColor = (stock: number) => {
    if (stock <= 0) return "text-red-600 font-semibold";
    if (stock < 5) return "text-orange-500 font-semibold";
    return "text-green-600 font-semibold";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-blue-600" />Stok Yönetimi
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? `${data.total} ürün` : "Yükleniyor..."}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün, SKU veya marka ara..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Toplam Ürün", value: stats.total, icon: <Package size={20} />, color: "bg-blue-100 text-blue-600" },
          { label: "Düşük Stok (<5)", value: stats.lowStock, icon: <AlertTriangle size={20} />, color: "bg-orange-100 text-orange-600" },
          { label: "Stokta Yok", value: stats.outOfStock, icon: <PackageOpen size={20} />, color: "bg-red-100 text-red-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>{card.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Ürün Listesi</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Ürün bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Ürün Adı</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Marka</th>
                  <th className="px-5 py-3 font-medium text-gray-600">SKU</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Mevcut Stok</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Fiyat</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{p.nameTr}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{p.brand?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{p.sku ?? "—"}</td>
                    <td className={`px-5 py-3.5 text-right ${stockColor(p.stock)}`}>{p.stock}</td>
                    <td className="px-5 py-3.5 text-right text-gray-700">{fmt(p.price)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openModal(p, "IN")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors"
                        >
                          <Plus size={13} />Giriş
                        </button>
                        <button
                          onClick={() => openModal(p, "OUT")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium transition-colors"
                        >
                          <Minus size={13} />Çıkış
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

      {/* Recent Movements */}
      {data && data.recentMovements.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Son Stok Hareketleri</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-medium text-gray-600">Ürün ID</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Tip</th>
                  <th className="px-5 py-3 font-medium text-gray-600 text-right">Miktar</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Referans</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMovements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{m.productId.slice(0, 8)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {m.type === "IN" && <ArrowUpCircle size={13} className="text-green-600" />}
                        {m.type === "OUT" && <ArrowDownCircle size={13} className="text-red-600" />}
                        {m.type === "ADJUSTMENT" && <RefreshCw size={13} className="text-yellow-600" />}
                        {m.type === "RETURN" && <RotateCcw size={13} className="text-blue-600" />}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOVEMENT_BADGE[m.type]}`}>
                          {MOVEMENT_LABELS[m.type]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{m.quantity}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{m.reference ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Stok Hareketi</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Hareket Tipi *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MovementType }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="IN">Giriş</option>
                  <option value="OUT">Çıkış</option>
                  <option value="ADJUSTMENT">Düzeltme</option>
                  <option value="RETURN">İade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Miktar *</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Birim Fiyat (₺) <span className="text-gray-400 font-normal">— opsiyonel</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Referans <span className="text-gray-400 font-normal">— opsiyonel</span></label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Fatura no, sipariş no..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar <span className="text-gray-400 font-normal">— opsiyonel</span></label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
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
