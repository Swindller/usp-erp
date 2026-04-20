"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Package } from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  "Malzeme / Ekipman",
  "Hizmet",
  "Kira",
  "Elektrik / Su / Doğalgaz",
  "Yakıt",
  "Ofis Giderleri",
  "Sigorta",
  "Diğer",
];

export default function YeniGelenFaturaPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    invoiceNumber: "",
    supplierName: "",
    supplierTaxNo: "",
    category: "",
    description: "",
    subtotal: "",
    vatAmount: "",
    dueDate: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const subtotalNum = parseFloat(form.subtotal) || 0;
  const vatNum = parseFloat(form.vatAmount) || 0;
  const total = subtotalNum + vatNum;

  const handleSubmit = async () => {
    if (!form.invoiceNumber.trim()) { setError("Fatura numarası giriniz."); return; }
    if (!form.supplierName.trim()) { setError("Tedarikçi adı giriniz."); return; }
    if (subtotalNum <= 0) { setError("Geçerli bir tutar giriniz."); return; }

    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/muhasebe/gelen-faturalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: form.invoiceNumber,
          supplierName: form.supplierName,
          supplierTaxNo: form.supplierTaxNo || undefined,
          category: form.category || undefined,
          description: form.description || undefined,
          subtotal: subtotalNum,
          vatAmount: vatNum,
          dueDate: form.dueDate || undefined,
          invoiceDate: form.invoiceDate || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Fatura oluşturulamadı"); return; }
      router.push("/muhasebe/gelen");
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/muhasebe/gelen" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-orange-600" />Gelen Fatura Ekle
          </h1>
          <p className="text-sm text-gray-500">Tedarikçi / gider faturası kaydı</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Tedarikçi Bilgileri */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Tedarikçi Bilgileri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">Tedarikçi Adı / Unvan <span className="text-red-500">*</span></label>
            <input
              value={form.supplierName}
              onChange={(e) => set("supplierName", e.target.value)}
              placeholder="Firma adı veya kişi adı"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Vergi Kimlik No</label>
            <input
              value={form.supplierTaxNo}
              onChange={(e) => set("supplierTaxNo", e.target.value)}
              placeholder="VKN veya TCKN"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Kategori</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
            >
              <option value="">Kategori seçin...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Fatura Detayları */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Fatura Detayları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fatura No <span className="text-red-500">*</span></label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => set("invoiceNumber", e.target.value)}
              placeholder="ör: FTR-2025-001"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fatura Tarihi</label>
            <input
              type="date"
              value={form.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Vade Tarihi</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Açıklama</label>
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Fatura açıklaması"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Tutar Bilgileri */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Tutar Bilgileri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ara Toplam (KDV Hariç) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.subtotal}
                onChange={(e) => set("subtotal", e.target.value)}
                placeholder="0,00"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">KDV Tutarı</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.vatAmount}
                onChange={(e) => set("vatAmount", e.target.value)}
                placeholder="0,00"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Total preview */}
        {subtotalNum > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Ara Toplam</span>
              <span>₺{subtotalNum.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>KDV</span>
              <span>₺{vatNum.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Genel Toplam</span>
              <span>₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Notlar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Notlar</h2>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Ek notlar (opsiyonel)..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <Link href="/muhasebe/gelen" className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 text-center transition-colors">
          İptal
        </Link>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors">
          {saving ? "Kaydediliyor..." : "Fatura Kaydet"}
        </button>
      </div>
    </div>
  );
}
