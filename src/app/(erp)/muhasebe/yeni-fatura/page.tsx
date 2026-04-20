"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Trash2, Search, Building2, User, Receipt } from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  type: "INDIVIDUAL" | "CORPORATE";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string;
  email: string | null;
}

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
}

function customerDisplayName(c: Customer) {
  return c.type === "CORPORATE"
    ? (c.companyName ?? "Kurumsal")
    : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

const emptyLine = (): LineItem => ({ description: "", qty: 1, unitPrice: 0, vatRate: 20 });

export default function YeniFaturaPage() {
  const router = useRouter();

  // Müşteri seçimi
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fatura detayları
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomers([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/musteriler?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerSearch(customerDisplayName(c));
    setShowDropdown(false);
    setCustomers([]);
  };

  const updateLine = (i: number, field: keyof LineItem, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Hesaplamalar
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vatAmount = lines.reduce((s, l) => s + l.qty * l.unitPrice * (l.vatRate / 100), 0);
  const total = subtotal + vatAmount;

  const handleSubmit = async () => {
    if (!selectedCustomer) { setError("Müşteri seçiniz."); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.unitPrice > 0);
    if (validLines.length === 0) { setError("En az bir fatura kalemi giriniz."); return; }

    setError("");
    setSaving(true);
    try {
      const avgVat = Math.round(validLines.reduce((s, l) => s + l.vatRate, 0) / validLines.length);
      const res = await fetch("/api/muhasebe/faturalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          vatRate: avgVat,
          lineItems: validLines,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : "Fatura oluşturulamadı"); return; }
      router.push(`/muhasebe/fatura/${data.invoice.id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/muhasebe" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={20} className="text-blue-600" />Yeni Fatura Oluştur
          </h1>
          <p className="text-sm text-gray-500">Servis raporu olmadan manuel fatura</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Müşteri */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Müşteri</h2>
        <div className="relative">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Müşteri ara..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          {showDropdown && customers.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {customers.map((c) => (
                <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {c.type === "CORPORATE" ? <Building2 size={12} className="text-gray-500" /> : <User size={12} className="text-gray-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{customerDisplayName(c)}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && customerSearch && !searching && customers.length === 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">
              Müşteri bulunamadı
            </div>
          )}
        </div>
        {selectedCustomer && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              {selectedCustomer.type === "CORPORATE" ? <Building2 size={14} className="text-blue-600" /> : <User size={14} className="text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{customerDisplayName(selectedCustomer)}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
            </div>
          </div>
        )}
      </div>

      {/* Fatura Detayları */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Fatura Detayları</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Vade Tarihi</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsiyonel not..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Kalemler */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">Fatura Kalemleri</h2>
          <button onClick={() => setLines((l) => [...l, emptyLine()])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={13} />Satır Ekle
          </button>
        </div>

        {/* Kolon başlıkları */}
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
          <span className="col-span-5">Açıklama</span>
          <span className="col-span-2 text-center">Adet</span>
          <span className="col-span-2 text-right">Birim ₺</span>
          <span className="col-span-2 text-center">KDV %</span>
          <span className="col-span-1" />
        </div>

        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)}
                placeholder="Açıklama"
                className="col-span-5 px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
              <input type="number" min={1} value={line.qty} onChange={(e) => updateLine(i, "qty", parseFloat(e.target.value) || 1)}
                className="col-span-2 px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-center" />
              <input type="number" min={0} step={0.01} value={line.unitPrice || ""} onChange={(e) => updateLine(i, "unitPrice", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="col-span-2 px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-right" />
              <input type="number" min={0} max={100} value={line.vatRate} onChange={(e) => updateLine(i, "vatRate", parseFloat(e.target.value) || 0)}
                className="col-span-2 px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-center" />
              <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                className="col-span-1 flex justify-center p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 disabled:opacity-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Toplamlar */}
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Ara Toplam</span>
            <span>₺{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>KDV</span>
            <span>₺{vatAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Genel Toplam</span>
            <span>₺{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <Link href="/muhasebe" className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 text-center transition-colors">
          İptal
        </Link>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Oluşturuluyor..." : "Fatura Oluştur"}
        </button>
      </div>
    </div>
  );
}
