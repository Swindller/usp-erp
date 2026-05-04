"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search, X, Building2, User, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  type: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phone: string;
}

interface Item {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function cName(c: Customer) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

const emptyItem = (): Item => ({ name: "", description: "", quantity: "1", unitPrice: "" });

export function NewQuoteForm() {
  const router = useRouter();

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("20");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await fetch(`/api/musteriler?search=${encodeURIComponent(customerSearch)}&limit=8`);
        const data = await res.json();
        setCustomerResults(data.customers || []);
      } finally {
        setSearchingCustomer(false);
      }
    }, 350);
  }, [customerSearch]);

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, value: string) =>
    setItems((p) => p.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  const handleSubmit = async () => {
    if (!selectedCustomer) { setError("Müşteri seçiniz"); return; }
    const validItems = items.filter((it) => it.name.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
    if (!validItems.length) { setError("En az bir kalem giriniz"); return; }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/teklifler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          title: title || undefined,
          notes: notes || undefined,
          items: validItems.map((it) => ({
            name: it.name,
            description: it.description || undefined,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
          taxRate: Number(taxRate),
          validUntil: validUntil || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(JSON.stringify(data.error)); return; }
      router.push(`/teklifler/${data.quote.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Yeni Teklif</h1>
        <p className="text-sm text-gray-500">Müşteri için teklif oluştur</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Müşteri Seçimi */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Müşteri</h2>
        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                {selectedCustomer.type === "CORPORATE"
                  ? <Building2 size={14} className="text-white" />
                  : <User size={14} className="text-white" />}
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-800">{cName(selectedCustomer)}</div>
                <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>
              </div>
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="p-1 text-gray-400 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Müşteri adı veya telefon ile ara..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchingCustomer && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            {customerResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomerResults([]); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {c.type === "CORPORATE" ? <Building2 size={12} className="text-gray-600" /> : <User size={12} className="text-gray-600" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{cName(c)}</div>
                      <div className="text-xs text-gray-400">{c.phone}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Genel Bilgiler */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">Genel Bilgiler</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Başlık (opsiyonel)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Pompa bakım teklifi"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Geçerlilik Tarihi</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Müşteriye gösterilecek notlar, koşullar..."
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Kalemler */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">Teklif Kalemleri</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus size={13} />Kalem Ekle
          </button>
        </div>

        {/* Başlık satırı */}
        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
          <div className="col-span-5">Ürün/Hizmet</div>
          <div className="col-span-3">Açıklama</div>
          <div className="col-span-1 text-center">Adet</div>
          <div className="col-span-2 text-right">Birim Fiyat</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  placeholder="Ürün/hizmet adı"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="col-span-3">
                <input
                  value={it.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                  placeholder="Açıklama"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₺</span>
                  <input
                    type="number"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl pl-5 pr-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center pt-1">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Toplam */}
        <div className="border-t border-gray-100 pt-4 mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Ara Toplam</span>
            <span className="font-medium text-gray-800">₺{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>KDV</span>
              <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-0.5 text-xs focus:outline-none">
                {["0","1","8","10","18","20"].map((r) => (
                  <option key={r} value={r}>%{r}</option>
                ))}
              </select>
            </div>
            <span className="font-medium text-gray-800">₺{taxAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="font-bold text-gray-900">Genel Toplam</span>
            <span className="text-xl font-bold text-blue-600">₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Aksiyon butonları */}
      <div className="flex gap-3 pb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Kaydediliyor..." : "Teklif Oluştur"}
        </button>
      </div>
    </div>
  );
}
