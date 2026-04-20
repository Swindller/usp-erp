"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle2, Clock, AlertTriangle, FileText,
  Building2, User, CreditCard, Banknote, Landmark, Smartphone, Package,
  CalendarDays, Plus,
} from "lucide-react";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "CANCELLED";
type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "CHECK" | "OTHER";

interface Payment {
  id: string;
  amount: number | string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  paidAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string | null;
  total: number | string;
  paidAmount: number | string;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  customer: { type: string; firstName: string | null; lastName: string | null; companyName: string | null; phone: string; email: string | null };
  serviceReport: { id: string; reportNumber: string } | null;
  payments: Payment[];
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: React.ReactNode; classes: string }> = {
  DRAFT:          { label: "Taslak",       icon: <FileText size={14} />,     classes: "bg-gray-100 text-gray-600" },
  SENT:           { label: "Gönderildi",   icon: <Clock size={14} />,        classes: "bg-blue-100 text-blue-700" },
  PAID:           { label: "Ödendi",       icon: <CheckCircle2 size={14} />, classes: "bg-green-100 text-green-700" },
  PARTIALLY_PAID: { label: "Kısmi Ödeme", icon: <Clock size={14} />,        classes: "bg-yellow-100 text-yellow-700" },
  OVERDUE:        { label: "Vadesi Geçti",icon: <AlertTriangle size={14} />, classes: "bg-red-100 text-red-700" },
  CANCELLED:      { label: "İptal",        icon: <FileText size={14} />,     classes: "bg-gray-100 text-gray-500" },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı", CHECK: "Çek", OTHER: "Diğer",
};

const PAYMENT_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Banknote size={14} />, BANK_TRANSFER: <Landmark size={14} />, CREDIT_CARD: <CreditCard size={14} />, CHECK: <FileText size={14} />, OTHER: <Package size={14} />,
};

function fmt(v: number | string) { return `₺${parseFloat(String(v)).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`; }
function fmtDate(d: string | null) { if (!d) return "—"; return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }); }
function customerName(c: Invoice["customer"]) {
  return c.type === "CORPORATE" ? c.companyName || "Kurumsal" : [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

export default function FaturaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/muhasebe/faturalar/${id}`);
      if (!res.ok) { setError("Fatura bulunamadı"); return; }
      const data = await res.json();
      setInvoice(data.invoice);
    } catch { setError("Yüklenirken hata oluştu"); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayment = async () => {
    if (!payAmount || isNaN(parseFloat(payAmount))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/muhasebe/faturalar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment: { amount: parseFloat(payAmount), method: payMethod, reference: payRef || undefined, note: payNote || undefined } }),
      });
      if (!res.ok) return;

      // Form kapat, alanları sıfırla
      setShowPaymentForm(false);
      setPayAmount("");
      setPayRef("");
      setPayNote("");

      // Güncel fatura verisini (ödeme geçmişi dahil) yükle — spinner göstermeden
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !invoice) return (
    <div className="text-center py-20">
      <FileText size={40} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">{error || "Fatura bulunamadı"}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:underline">Geri dön</button>
    </div>
  );

  const total = parseFloat(String(invoice.total));
  const paid = parseFloat(String(invoice.paidAmount));
  const remaining = total - paid;
  const isPaid = invoice.status === "PAID" || invoice.status === "CANCELLED";
  const cfg = STATUS_CONFIG[invoice.status];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-gray-500">Fatura Detayı</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.classes}`}>
          {cfg.icon}{cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sol: Fatura Bilgileri */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Fatura Bilgileri</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Fatura No</span>
              <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Düzenleme Tarihi</span>
              <span>{fmtDate(invoice.invoiceDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vade Tarihi</span>
              <span className={!invoice.dueDate ? "text-gray-400" : remaining > 0 && invoice.dueDate && new Date(invoice.dueDate) < new Date() ? "text-red-600 font-semibold" : ""}>{fmtDate(invoice.dueDate)}</span>
            </div>
            {invoice.serviceReport && (
              <div className="flex justify-between">
                <span className="text-gray-500">Servis Raporu</span>
                <Link href={`/servis/${invoice.serviceReport.id}`} className="font-mono text-blue-600 hover:underline text-xs">{invoice.serviceReport.reportNumber}</Link>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Toplam Tutar</span>
              <span className="font-bold text-lg">{fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ödenen</span>
              <span className="text-green-600 font-semibold">{fmt(paid)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700 font-medium">Kalan</span>
                <span className="text-red-600 font-bold">{fmt(remaining)}</span>
              </div>
            )}
          </div>

          {!isPaid && (
            <button onClick={() => setShowPaymentForm(true)} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Plus size={16} />Ödeme Kaydet
            </button>
          )}
        </div>

        {/* Sağ: Müşteri Bilgileri */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Müşteri</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              {invoice.customer.type === "CORPORATE" ? <Building2 size={18} className="text-blue-600" /> : <User size={18} className="text-blue-600" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{customerName(invoice.customer)}</p>
              <p className="text-xs text-gray-500">{invoice.customer.type === "CORPORATE" ? "Kurumsal" : "Şahıs"}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600"><Smartphone size={13} className="text-gray-400" />{invoice.customer.phone}</div>
            {invoice.customer.email && <div className="flex items-center gap-2 text-gray-600"><CalendarDays size={13} className="text-gray-400" />{invoice.customer.email}</div>}
          </div>
          {invoice.notes && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Not</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Ödeme Geçmişi */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Ödeme Geçmişi</h2>
          <span className="text-xs text-gray-400">{invoice.payments.length} kayıt</span>
        </div>
        {invoice.payments.length === 0 ? (
          <div className="py-10 text-center"><CreditCard size={28} className="text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">Henüz ödeme kaydı yok</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">{PAYMENT_ICONS[p.method]}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{fmt(p.amount)}</p>
                  <p className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[p.method]}{p.reference ? ` · ${p.reference}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{fmtDate(p.paidAt)}</p>
                  {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ödeme Formu Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Ödeme Kaydet</h3>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tutar (₺) *</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={`Max: ${fmt(remaining)}`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Ödeme Yöntemi *</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white">
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Referans / Dekont No</label>
              <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Opsiyonel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Not</label>
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Opsiyonel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPaymentForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">İptal</button>
              <button onClick={handlePayment} disabled={saving || !payAmount} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
