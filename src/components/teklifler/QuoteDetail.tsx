"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, Send, Clock, FileText, RefreshCw,
  Building2, User, Trash2, Edit3, X, Save, Plus, Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" | "EXPIRED";

interface QuoteItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

interface QuoteData {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  title: string | null;
  notes: string | null;
  items: QuoteItem[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  validUntil: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  customer: {
    id: string;
    type: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    district: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
  };
  createdBy: { user: { firstName: string | null; lastName: string | null } } | null;
  serviceReport: { id: string; reportNumber: string } | null;
}

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  DRAFT:     { label: "Taslak",          icon: <FileText size={14} />,     badge: "bg-gray-100 text-gray-700 border-gray-200" },
  SENT:      { label: "Gönderildi",      icon: <Send size={14} />,         badge: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED:  { label: "Onaylandı",       icon: <CheckCircle2 size={14} />, badge: "bg-green-50 text-green-700 border-green-200" },
  REJECTED:  { label: "Reddedildi",      icon: <XCircle size={14} />,      badge: "bg-red-50 text-red-700 border-red-200" },
  CONVERTED: { label: "Faturaya Döndü", icon: <RefreshCw size={14} />,    badge: "bg-purple-50 text-purple-700 border-purple-200" },
  EXPIRED:   { label: "Süresi Doldu",   icon: <Clock size={14} />,        badge: "bg-orange-50 text-orange-700 border-orange-200" },
};

function cName(c: QuoteData["customer"]) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(val: string | number) {
  return Number(val).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  quote: QuoteData;
  userRole: string;
}

export function QuoteDetail({ quote: initialQuote, userRole }: Props) {
  const router = useRouter();
  const isManager = ["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(userRole);
  const isDraft = initialQuote.status === "DRAFT";

  const [quote, setQuote] = useState(initialQuote);
  const [acting, setActing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inline edit
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(quote.notes || "");
  const [editTitle, setEditTitle] = useState(quote.title || "");
  const [editValidUntil, setEditValidUntil] = useState(quote.validUntil ? quote.validUntil.slice(0, 10) : "");
  const [editItems, setEditItems] = useState<QuoteItem[]>(quote.items);
  const [editTaxRate, setEditTaxRate] = useState(String(quote.taxRate));
  const [saving, setSaving] = useState(false);

  const doAction = async (action: string) => {
    setActing(action);
    try {
      const res = await fetch(`/api/teklifler/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Hata oluştu");
      setQuote(data.quote);
    } finally {
      setActing(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teklifler/${quote.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Silinemedi"); return; }
      router.push("/teklifler");
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const validItems = editItems.filter((it) => it.name.trim());
      const res = await fetch(`/api/teklifler/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle || undefined,
          notes: editNotes || undefined,
          validUntil: editValidUntil || null,
          items: validItems,
          taxRate: Number(editTaxRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(JSON.stringify(data.error));
      setQuote(data.quote);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const editSubtotal = editItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const editTaxAmt = editSubtotal * Number(editTaxRate) / 100;
  const editTotal = editSubtotal + editTaxAmt;

  const cfg = STATUS_CONFIG[quote.status];
  const canEdit = isManager && isDraft;
  const canSend = isManager && quote.status === "DRAFT";
  const canApproveReject = isManager && quote.status === "SENT";
  const canRevert = isManager && ["SENT", "REJECTED"].includes(quote.status);
  const canDelete = isManager && ["DRAFT", "REJECTED", "EXPIRED"].includes(quote.status);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Geri + başlık */}
      <div className="flex items-center gap-3">
        <Link href="/teklifler" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{quote.quoteNumber}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
              {cfg.icon}{cfg.label}
            </span>
          </div>
          {quote.title && <p className="text-sm text-gray-500 mt-0.5">{quote.title}</p>}
        </div>
      </div>

      {/* Aksiyon bar */}
      {(canSend || canApproveReject || canRevert || canDelete) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-2 flex-wrap">
          {canSend && (
            <button
              onClick={() => doAction("send")}
              disabled={!!acting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {acting === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Müşteriye Gönder
            </button>
          )}
          {canApproveReject && (
            <>
              <button
                onClick={() => doAction("approve")}
                disabled={!!acting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {acting === "approve" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Onayla
              </button>
              <button
                onClick={() => doAction("reject")}
                disabled={!!acting}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {acting === "reject" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reddet
              </button>
            </>
          )}
          {canRevert && (
            <button
              onClick={() => doAction("revert_draft")}
              disabled={!!acting}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {acting === "revert_draft" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Taslağa Al
            </button>
          )}
          {canEdit && !editing && (
            <button
              onClick={() => {
                setEditTitle(quote.title || "");
                setEditNotes(quote.notes || "");
                setEditValidUntil(quote.validUntil ? quote.validUntil.slice(0, 10) : "");
                setEditItems(quote.items);
                setEditTaxRate(String(quote.taxRate));
                setEditing(true);
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors ml-auto"
            >
              <Edit3 size={14} />Düzenle
            </button>
          )}
          {canDelete && !editing && (
            <button
              onClick={() => setConfirmDelete(true)}
              className={`flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition-colors ${canEdit ? "" : "ml-auto"}`}
            >
              <Trash2 size={14} />Sil
            </button>
          )}
        </div>
      )}

      {/* Silme onay */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-4">
          <p className="flex-1 text-sm text-red-700">Bu teklifi silmek istediğinizden emin misiniz?</p>
          <button onClick={doDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {deleting ? "Siliniyor..." : "Evet, Sil"}
          </button>
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-100">
            Vazgeç
          </button>
        </div>
      )}

      {/* Zaman çizelgesi */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-800 text-sm mb-3">Süreç</h2>
        <div className="flex items-center gap-0">
          {[
            { label: "Oluşturuldu", date: quote.createdAt, done: true },
            { label: "Gönderildi", date: quote.sentAt, done: !!quote.sentAt },
            { label: quote.status === "REJECTED" ? "Reddedildi" : "Onaylandı", date: quote.approvedAt || quote.rejectedAt, done: !!quote.approvedAt || !!quote.rejectedAt },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.done ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {i + 1}
                </div>
                <div className="text-[10px] text-gray-500 text-center mt-1 w-20">{step.label}</div>
                {step.date && <div className="text-[9px] text-gray-400 text-center">{fmtDate(step.date)}</div>}
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${step.done && arr[i + 1].done ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Müşteri */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-semibold text-gray-800 text-sm mb-3">Müşteri</h2>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            {quote.customer.type === "CORPORATE" ? <Building2 size={16} className="text-gray-600" /> : <User size={16} className="text-gray-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/musteriler/${quote.customer.id}`} className="font-semibold text-gray-800 hover:text-blue-600 hover:underline">
              {cName(quote.customer)}
            </Link>
            <div className="text-sm text-gray-500 mt-0.5">{quote.customer.phone}</div>
            {quote.customer.email && <div className="text-xs text-gray-400">{quote.customer.email}</div>}
            {(quote.customer.city || quote.customer.address) && (
              <div className="text-xs text-gray-400 mt-0.5">
                {[quote.customer.address, quote.customer.district, quote.customer.city].filter(Boolean).join(", ")}
              </div>
            )}
            {quote.customer.taxNumber && (
              <div className="text-xs text-gray-400">VKN: {quote.customer.taxNumber} · {quote.customer.taxOffice}</div>
            )}
          </div>
          {quote.serviceReport && (
            <Link href={`/servis/${quote.serviceReport.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <FileText size={11} />{quote.serviceReport.reportNumber}
            </Link>
          )}
        </div>
      </div>

      {/* Kalemler + Tutar */}
      {editing ? (
        <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Düzenleme Modu</h2>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Başlık</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Geçerlilik</label>
              <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 block mb-1">Notlar</label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Kalemler</span>
              <button type="button" onClick={() => setEditItems((p) => [...p, { name: "", quantity: 1, unitPrice: 0 }])}
                className="text-xs text-blue-600 flex items-center gap-1"><Plus size={11} />Ekle</button>
            </div>
            {editItems.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input value={it.name} onChange={(e) => setEditItems((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Ürün/hizmet" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-3">
                  <input value={it.description || ""} onChange={(e) => setEditItems((p) => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    placeholder="Açıklama" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-1">
                  <input type="number" value={it.quantity} onChange={(e) => setEditItems((p) => p.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))}
                    className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <input type="number" value={it.unitPrice} onChange={(e) => setEditItems((p) => p.map((x, j) => j === i ? { ...x, unitPrice: Number(e.target.value) } : x))}
                    className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-right focus:outline-none" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {editItems.length > 1 && <button onClick={() => setEditItems((p) => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">KDV:</span>
            <select value={editTaxRate} onChange={(e) => setEditTaxRate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none">
              {["0","1","8","10","18","20"].map((r) => <option key={r} value={r}>%{r}</option>)}
            </select>
            <span className="flex-1" />
            <span className="font-bold text-blue-600 text-base">₺{editTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm">İptal</button>
            <button onClick={saveEdit} disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4">Teklif Kalemleri</h2>

          {/* Notlar */}
          {quote.notes && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600 italic">{quote.notes}</div>
          )}

          {/* Kalemler tablosu */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left pb-2">Ürün / Hizmet</th>
                  <th className="text-center pb-2 w-16">Adet</th>
                  <th className="text-right pb-2 w-28">Birim Fiyat</th>
                  <th className="text-right pb-2 w-28">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quote.items.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <div className="font-medium text-gray-800">{it.name}</div>
                      {it.description && <div className="text-xs text-gray-400 mt-0.5">{it.description}</div>}
                    </td>
                    <td className="py-2.5 text-center text-gray-700">{it.quantity}</td>
                    <td className="py-2.5 text-right text-gray-700">₺{fmtMoney(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-800">₺{fmtMoney(it.quantity * it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Toplamlar */}
          <div className="border-t border-gray-100 mt-4 pt-4 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Ara Toplam</span>
              <span>₺{fmtMoney(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>KDV (%{Number(quote.taxRate).toFixed(0)})</span>
              <span>₺{fmtMoney(quote.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Genel Toplam</span>
              <span className="text-xl text-blue-600">₺{fmtMoney(quote.total)}</span>
            </div>
          </div>

          {/* Geçerlilik + oluşturan */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            <span>
              {quote.validUntil
                ? `Geçerlilik: ${fmtDate(quote.validUntil)}`
                : "Geçerlilik tarihi belirtilmedi"}
            </span>
            {quote.createdBy && (
              <span>
                Oluşturan: {[quote.createdBy.user.firstName, quote.createdBy.user.lastName].filter(Boolean).join(" ")}
                {" · "}{fmtDateTime(quote.createdAt)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
