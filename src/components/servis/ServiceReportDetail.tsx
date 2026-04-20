"use client";

import { useState } from "react";
import Link from "next/link";
import { ServiceStatus, ServiceType, CustomerType, ServiceLogType } from "@prisma/client";
import {
  ChevronLeft, Edit3, Save, X,
  User, Building2, Phone, Wrench,
  Calendar, Clock, Shield, FileText, Download, Receipt, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import { ServiceStatusBadge, STATUS_CONFIG } from "./ServiceStatusBadge";
import { ServiceLogPanel } from "./ServiceLogPanel";
import { SignaturePad } from "./SignaturePad";
import { PartsEditor, type PartItem } from "./PartsEditor";

// ── Types ─────────────────────────────────────────────────────

interface Customer {
  id: string;
  type: CustomerType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
}

interface LogEntry {
  id: string;
  type: ServiceLogType;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string | Date;
  personnel?: {
    user: { firstName: string | null; lastName: string | null };
  } | null;
}

interface Report {
  id: string;
  reportNumber: string;
  status: ServiceStatus;
  serviceType: ServiceType;
  customer: Customer;
  technician: {
    id: string;
    role: string;
    user: { firstName: string | null; lastName: string | null; email: string };
  } | null;
  deviceBrand: string | null;
  deviceModel: string | null;
  deviceSerial: string | null;
  deviceYear: number | null;
  devicePower: string | null;
  deviceVoltage: string | null;
  devicePhase: string | null;
  complaint: string;
  diagnosis: string | null;
  operations: string | null;
  partsUsed: PartItem[] | null;
  isWarranty: boolean;
  warrantyUntil: string | null;
  estimatedDate: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  laborCost: string | null;
  partsCost: string | null;
  totalCost: string | null;
  internalNotes: string | null;
  customerNote: string | null;
  customerSignature: string | null;
  technicianSignature: string | null;
  receivedAt: string;
  createdAt: string;
  logs: LogEntry[];
  invoices: { id: string; invoiceNumber: string; status: string; total: string }[];
}

interface Personnel {
  id: string;
  role: string;
  user: { firstName: string | null; lastName: string | null };
}

interface Props {
  report: Report;
  personnel: Personnel[];
  canEdit: boolean;
  canDelete?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

const STATUS_FLOW: Record<ServiceStatus, ServiceStatus[]> = {
  RECEIVED:       ["DIAGNOSING", "WAITING_PARTS", "CANCELLED"],
  DIAGNOSING:     ["WAITING_PARTS", "IN_REPAIR", "CANCELLED"],
  WAITING_PARTS:  ["IN_REPAIR", "CANCELLED"],
  IN_REPAIR:      ["QUALITY_CHECK", "READY", "CANCELLED"],
  QUALITY_CHECK:  ["READY", "IN_REPAIR"],
  READY:          ["DELIVERED", "WARRANTY_RETURN"],
  DELIVERED:      [],
  CANCELLED:      ["RECEIVED"],
  WARRANTY_RETURN:["RECEIVED"],
};

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  WORKSHOP: "Atölye",
  FIELD: "Saha",
  WARRANTY: "Garanti",
  PERIODIC: "Periyodik",
};

function customerName(c: Customer) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function techName(t: Report["technician"]) {
  if (!t) return null;
  return [t.user.firstName, t.user.lastName].filter(Boolean).join(" ") || "Teknisyen";
}

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtCurrency(val: string | null) {
  if (!val) return "—";
  return `₺${parseFloat(val).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

// ── Component ─────────────────────────────────────────────────

export function ServiceReportDetail({ report: initialReport, personnel, canEdit, canDelete = false }: Props) {
  const [report, setReport] = useState<Report>(initialReport);
  const [tab, setTab] = useState<"details" | "logs" | "signatures">("details");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Edit states
  const [editDiagnosis, setEditDiagnosis] = useState(false);
  const [diagnosisVal, setDiagnosisVal] = useState(report.diagnosis || "");
  const [editOperations, setEditOperations] = useState(false);
  const [operationsVal, setOperationsVal] = useState(report.operations || "");

  // Parts
  const [editParts, setEditParts] = useState(false);
  const [parts, setParts] = useState<PartItem[]>(report.partsUsed || []);

  // Technician edit
  const [editTech, setEditTech] = useState(false);
  const [techId, setTechId] = useState(report.technician?.id || "");

  // Cost edit
  const [editCosts, setEditCosts] = useState(false);
  const [laborCost, setLaborCost] = useState(report.laborCost || "");
  const [partsCostVal, setPartsCostVal] = useState(report.partsCost || "");
  const [totalCostVal, setTotalCostVal] = useState(report.totalCost || "");

  // Signatures
  const [customerSig, setCustomerSig] = useState<string | null>(report.customerSignature);
  const [techSig, setTechSig] = useState<string | null>(report.technicianSignature);
  const [savingSig, setSavingSig] = useState(false);

  // Delete report
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteReport = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/servis/${report.id}`, { method: "DELETE" });
      if (res.ok) { window.location.href = "/servis"; }
    } finally { setDeleting(false); }
  };

  // Invoice creation modal
  const [showInvModal, setShowInvModal] = useState(false);
  const [invDueDate, setInvDueDate] = useState("");
  const [invNotes, setInvNotes]   = useState("");
  const [invLines, setInvLines]   = useState<{ description: string; qty: number; unitPrice: number; vatRate: number }[]>([]);
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError]   = useState("");

  const openInvModal = () => {
    // Pre-populate from report
    const lines: { description: string; qty: number; unitPrice: number; vatRate: number }[] = [];
    if (report.laborCost && parseFloat(report.laborCost) > 0) {
      lines.push({ description: "İşçilik", qty: 1, unitPrice: parseFloat(report.laborCost), vatRate: 20 });
    }
    // Servis ücreti satırı (ayrı, boş — kullanıcı dolduracak)
    lines.push({ description: "Servis Ücreti", qty: 1, unitPrice: 0, vatRate: 20 });
    (report.partsUsed ?? []).forEach((p: PartItem) => {
      lines.push({ description: p.name, qty: p.quantity, unitPrice: p.unitPrice, vatRate: 20 });
    });
    if (lines.length === 0) lines.push({ description: "", qty: 1, unitPrice: 0, vatRate: 20 });
    setInvLines(lines);
    setInvDueDate("");
    setInvNotes("");
    setInvError("");
    setShowInvModal(true);
  };

  const createInvoice = async () => {
    if (invLines.some((l) => !l.description || l.unitPrice < 0)) {
      setInvError("Tüm satırların açıklaması ve fiyatı girilmelidir.");
      return;
    }
    setInvSaving(true);
    setInvError("");
    try {
      // Boş fiyatlı satırları filtrele
      const filteredLines = invLines.filter((l) => l.description.trim() && l.unitPrice > 0);
      if (filteredLines.length === 0) { setInvError("En az bir kalem girilmelidir."); setInvSaving(false); return; }
      // Genel KDV: satırların ağırlıklı ortalaması (API için basit değer)
      const avgVat = Math.round(filteredLines.reduce((s, l) => s + l.vatRate, 0) / filteredLines.length);
      const res = await fetch("/api/muhasebe/faturalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceReportId: report.id,
          customerId: report.customer.id,
          vatRate: avgVat,
          lineItems: filteredLines,
          dueDate: invDueDate || undefined,
          notes: invNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setInvError(typeof data.error === "string" ? data.error : "Fatura oluşturulamadı"); return; }
      const inv = data.invoice;
      setReport((r) => ({
        ...r,
        invoices: [...r.invoices, { id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, total: String(inv.total) }],
      }));
      setShowInvModal(false);
    } catch {
      setInvError("Bağlantı hatası");
    } finally {
      setInvSaving(false);
    }
  };

  const patch = async (data: Record<string, unknown>) => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/servis/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      const { report: updated } = await res.json();
      setReport({ ...report, ...updated });
      return true;
    } catch {
      setSaveError("Güncelleme başarısız");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus: ServiceStatus) => {
    await patch({ status: newStatus });
  };

  const saveDiagnosis = async () => {
    if (await patch({ diagnosis: diagnosisVal })) setEditDiagnosis(false);
  };
  const saveOperations = async () => {
    if (await patch({ operations: operationsVal })) setEditOperations(false);
  };
  const saveParts = async () => {
    const totalParts = parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
    if (await patch({ partsUsed: parts, partsCost: totalParts })) setEditParts(false);
  };
  const saveTech = async () => {
    if (await patch({ technicianId: techId || null })) setEditTech(false);
  };
  const saveCosts = async () => {
    const lc = parseFloat(laborCost) || 0;
    const pc = parseFloat(partsCostVal) || 0;
    const tc = lc + pc; // otomatik hesapla
    if (await patch({ laborCost: lc, partsCost: pc, totalCost: tc })) setEditCosts(false);
  };
  const saveSignatures = async () => {
    setSavingSig(true);
    await patch({ customerSignature: customerSig || null, technicianSignature: techSig || null });
    setSavingSig(false);
  };

  const nextStatuses = STATUS_FLOW[report.status] || [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/servis`}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span className="font-mono text-xs text-gray-400">{report.reportNumber}</span>
              <h1 className="text-xl font-bold text-gray-900">{customerName(report.customer)}</h1>
            </div>
            <div className="flex items-center gap-2">
              <ServiceStatusBadge status={report.status} size="lg" />
              <a
                href={`/api/servis/${report.id}/pdf`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
              >
                <Download size={13} />PDF İndir
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={openInvModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-300 bg-green-50 hover:bg-green-100 transition-colors text-xs font-medium text-green-700"
                >
                  <Receipt size={13} />Fatura Oluştur
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-xs font-medium text-red-600"
                >
                  <Trash2 size={13} />Sil
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Calendar size={11} /> Alınma: {fmt(report.receivedAt)}</span>
            <span className="flex items-center gap-1"><Wrench size={11} /> {SERVICE_TYPE_LABELS[report.serviceType]}</span>
            {report.isWarranty && (
              <span className="flex items-center gap-1 text-green-600"><Shield size={11} /> Garanti</span>
            )}
          </div>
        </div>
      </div>

      {/* Status action bar */}
      {canEdit && nextStatuses.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-2.5">Durumu Güncelle</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                disabled={saving}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
                  s === "CANCELLED" || s === "WARRANTY_RETURN"
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : s === "DELIVERED"
                    ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                    : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                }`}
              >
                → {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {[
          { id: "details" as const, label: "Detaylar" },
          { id: "logs" as const, label: `Müdahaleler (${report.logs.length})` },
          { id: "signatures" as const, label: "İmzalar" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Details ── */}
      {tab === "details" && (
        <div className="space-y-4">
          {/* Customer + Device */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard
              icon={report.customer.type === "CORPORATE" ? <Building2 size={15} /> : <User size={15} />}
              title="Müşteri Bilgileri"
            >
              <InfoRow label="Ad / Firma" value={customerName(report.customer)} bold />
              <InfoRow label="Telefon" value={<a href={`tel:${report.customer.phone}`} className="text-primary">{report.customer.phone}</a>} />
              {report.customer.email && <InfoRow label="E-posta" value={report.customer.email} />}
              {report.customer.city && (
                <InfoRow
                  label="Konum"
                  value={[report.customer.city, report.customer.district].filter(Boolean).join(" / ")}
                />
              )}
            </InfoCard>

            <InfoCard icon={<Wrench size={15} />} title="Cihaz Bilgileri">
              {(report.deviceBrand || report.deviceModel) && (
                <InfoRow label="Marka / Model" value={[report.deviceBrand, report.deviceModel].filter(Boolean).join(" ")} bold />
              )}
              {report.deviceSerial && <InfoRow label="Seri No" value={<span className="font-mono">{report.deviceSerial}</span>} />}
              {report.deviceYear && <InfoRow label="Üretim Yılı" value={String(report.deviceYear)} />}
              {report.devicePower && <InfoRow label="Güç" value={report.devicePower} />}
              {report.deviceVoltage && <InfoRow label="Voltaj" value={report.deviceVoltage} />}
              {report.devicePhase && <InfoRow label="Faz" value={report.devicePhase} />}
              {!report.deviceBrand && !report.deviceModel && !report.deviceSerial && (
                <p className="text-xs text-gray-400 italic">Cihaz bilgisi girilmemiş</p>
              )}
            </InfoCard>
          </div>

          {/* Complaint */}
          <InfoCard icon={<Phone size={15} />} title="Müşteri Şikayeti">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.complaint}</p>
          </InfoCard>

          {/* Diagnosis */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <FileText size={15} className="text-gray-500" />
                Teknik Teşhis
              </h3>
              {canEdit && !editDiagnosis && (
                <button type="button" onClick={() => setEditDiagnosis(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            {editDiagnosis ? (
              <div className="space-y-2">
                <textarea
                  value={diagnosisVal}
                  onChange={(e) => setDiagnosisVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={4}
                  placeholder="Teknik teşhis sonuçlarını girin..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={saveDiagnosis} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50">
                    <Save size={12} /> Kaydet
                  </button>
                  <button onClick={() => setEditDiagnosis(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {report.diagnosis || <span className="text-gray-400 italic">Henüz teşhis girilmedi</span>}
              </p>
            )}
          </div>

          {/* Operations */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <Wrench size={15} className="text-gray-500" />
                Yapılan İşlemler
              </h3>
              {canEdit && !editOperations && (
                <button type="button" onClick={() => setEditOperations(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            {editOperations ? (
              <div className="space-y-2">
                <textarea
                  value={operationsVal}
                  onChange={(e) => setOperationsVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={4}
                  placeholder="Yapılan işlemleri girin..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={saveOperations} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50">
                    <Save size={12} /> Kaydet
                  </button>
                  <button onClick={() => setEditOperations(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {report.operations || <span className="text-gray-400 italic">Henüz işlem girilmedi</span>}
              </p>
            )}
          </div>

          {/* Parts Used */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Kullanılan Parçalar</h3>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {editParts && (
                    <button
                      onClick={saveParts}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      <Save size={12} /> Kaydet
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditParts((v) => !v)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  >
                    {editParts ? <X size={14} /> : <Edit3 size={14} />}
                  </button>
                </div>
              )}
            </div>

            <PartsEditor
              parts={parts}
              onChange={setParts}
              disabled={!editParts}
            />
          </div>

          {/* Costs + Technician + Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={<Clock size={15} />} title="Tarihler & Atama">
              <InfoRow label="Alınma" value={fmt(report.receivedAt)} />
              <InfoRow label="Tahmini Teslim" value={fmt(report.estimatedDate)} />
              <InfoRow label="Tamamlanma" value={fmt(report.completedAt)} />
              <InfoRow label="Teslim" value={fmt(report.deliveredAt)} />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">Teknisyen</span>
                {canEdit && !editTech ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-gray-800">{techName(report.technician) || "—"}</span>
                    <button onClick={() => setEditTech(true)} className="p-1 rounded hover:bg-gray-100"><Edit3 size={10} className="text-gray-400" /></button>
                  </div>
                ) : editTech ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={techId}
                      onChange={(e) => setTechId(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="">Seçilmedi</option>
                      {personnel.map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.user.firstName, p.user.lastName].filter(Boolean).join(" ")}
                        </option>
                      ))}
                    </select>
                    <button onClick={saveTech} disabled={saving} className="p-1 rounded bg-primary text-white"><Save size={10} /></button>
                    <button onClick={() => setEditTech(false)} className="p-1 rounded hover:bg-gray-100"><X size={10} /></button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-gray-800">{techName(report.technician) || "—"}</span>
                )}
              </div>
            </InfoCard>

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-sm">Maliyet</h3>
                {canEdit && !editCosts && (
                  <button onClick={() => setEditCosts(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit3 size={14} /></button>
                )}
              </div>
              {editCosts ? (
                <div className="space-y-2">
                  {[
                    { label: "İşçilik (₺)", val: laborCost, set: setLaborCost },
                    { label: "Parça (₺)", val: partsCostVal, set: setPartsCostVal },
                  ].map(({ label, val, set }) => (
                    <div key={label} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-24">{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                  {/* Hesaplanan toplam önizleme */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-500 w-24">Toplam</span>
                    <span className="text-xs font-bold text-gray-800">
                      ₺{((parseFloat(laborCost) || 0) + (parseFloat(partsCostVal) || 0)).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveCosts} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs disabled:opacity-50">
                      <Save size={12} /> Kaydet
                    </button>
                    <button onClick={() => setEditCosts(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <InfoRow label="İşçilik" value={fmtCurrency(report.laborCost)} />
                  <InfoRow label="Parça" value={fmtCurrency(report.partsCost)} />
                  <div className="pt-1 border-t border-gray-100">
                    {/* Toplam = işçilik + parça (totalCost 0 ise otomatik hesapla) */}
                    <InfoRow
                      label="Toplam"
                      value={(() => {
                        const tc = parseFloat(report.totalCost ?? "0") || 0;
                        const auto = (parseFloat(report.laborCost ?? "0") || 0) + (parseFloat(report.partsCost ?? "0") || 0);
                        const val = tc > 0 ? tc : auto;
                        return val > 0 ? `₺${val.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "—";
                      })()}
                      bold
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(report.internalNotes || report.customerNote) && (
            <InfoCard icon={<FileText size={15} />} title="Notlar">
              {report.internalNotes && <InfoRow label="İç Not" value={report.internalNotes} />}
              {report.customerNote && <InfoRow label="Müşteri Notu" value={report.customerNote} />}
            </InfoCard>
          )}

          {/* Invoices */}
          {report.invoices.length > 0 && (
            <InfoCard icon={<Receipt size={15} />} title="Faturalar">
              {report.invoices.map((inv) => {
                const STATUS_TR: Record<string, string> = { DRAFT: "Taslak", SENT: "Gönderildi", PARTIALLY_PAID: "Kısmi Ödeme", PAID: "Ödendi", OVERDUE: "Gecikmiş", CANCELLED: "İptal" };
                const statusColor: Record<string, string> = { PAID: "text-green-600 bg-green-50", OVERDUE: "text-red-600 bg-red-50", DRAFT: "text-gray-500 bg-gray-100", SENT: "text-blue-600 bg-blue-50", PARTIALLY_PAID: "text-yellow-700 bg-yellow-50", CANCELLED: "text-gray-400 bg-gray-100" };
                return (
                  <div key={inv.id} className="flex items-center justify-between text-sm py-0.5">
                    <a href={`/muhasebe/fatura/${inv.id}`} className="font-mono text-blue-600 hover:underline">{inv.invoiceNumber}</a>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800 font-medium">
                        ₺{parseFloat(inv.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[inv.status] ?? "text-gray-400 bg-gray-100"}`}>
                        {STATUS_TR[inv.status] ?? inv.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </InfoCard>
          )}
        </div>
      )}

      {/* ── Tab: Logs ── */}
      {tab === "logs" && (
        <ServiceLogPanel
          reportId={report.id}
          logs={report.logs}
          onLogAdded={(log) =>
            setReport((r) => ({ ...r, logs: [{ ...log, type: log.type as ServiceLogType }, ...r.logs] }))
          }
        />
      )}

      {/* ── Tab: Signatures ── */}
      {tab === "signatures" && (
        <div className="space-y-6 bg-white border border-gray-200 rounded-2xl p-5">
          <SignaturePad
            label="Müşteri İmzası"
            value={customerSig || undefined}
            onChange={setCustomerSig}
            disabled={!canEdit}
          />
          <SignaturePad
            label="Teknisyen İmzası"
            value={techSig || undefined}
            onChange={setTechSig}
            disabled={!canEdit}
          />
          {canEdit && (
            <button
              type="button"
              onClick={saveSignatures}
              disabled={savingSig}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <Save size={15} />
              {savingSig ? "Kaydediliyor..." : "İmzaları Kaydet"}
            </button>
          )}
        </div>
      )}

      {/* ── Rapor Sil Onay ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-gray-900 text-lg">Raporu Sil</h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-mono font-semibold text-gray-700">{report.reportNumber}</span> numaralı rapor kalıcı olarak silinecek.
              </p>
              <p className="text-xs text-red-500 mt-2">Bu işlem geri alınamaz. Bağlı faturalar korunur (rapor bağlantısı kesilir).</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                İptal
              </button>
              <button onClick={deleteReport} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fatura Oluştur Modal ── */}
      {showInvModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Receipt size={16} className="text-green-600" />Fatura Oluştur</h3>
              <button onClick={() => setShowInvModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {invError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{invError}</div>}

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="grid grid-cols-[1fr_40px_80px_52px_20px] gap-1.5 w-full text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
                    <span>Açıklama</span><span className="text-center">Adet</span><span className="text-right">Birim ₺</span><span className="text-center">KDV%</span><span />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {invLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_40px_80px_52px_20px] gap-1.5 items-center">
                      <input
                        value={line.description}
                        onChange={(e) => setInvLines((ls) => ls.map((l, j) => j === i ? { ...l, description: e.target.value } : l))}
                        placeholder="Servis Ücreti, İşçilik…"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-0"
                      />
                      <input
                        type="number" min="1" value={line.qty}
                        onChange={(e) => setInvLines((ls) => ls.map((l, j) => j === i ? { ...l, qty: parseFloat(e.target.value) || 1 } : l))}
                        className="border border-gray-200 rounded-lg px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <input
                        type="number" min="0" step="0.01" value={line.unitPrice}
                        onChange={(e) => setInvLines((ls) => ls.map((l, j) => j === i ? { ...l, unitPrice: parseFloat(e.target.value) || 0 } : l))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      {/* KDV % — serbest giriş */}
                      <div className="relative">
                        <input
                          type="number" min="0" max="100" step="1" value={line.vatRate}
                          onChange={(e) => setInvLines((ls) => ls.map((l, j) => j === i ? { ...l, vatRate: parseFloat(e.target.value) ?? 0 } : l))}
                          className="w-full border border-gray-200 rounded-lg pl-1 pr-4 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                      </div>
                      <button type="button" onClick={() => setInvLines((ls) => ls.filter((_, j) => j !== i))}
                        className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setInvLines((l) => [...l, { description: "", qty: 1, unitPrice: 0, vatRate: 20 }])}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
                  <Plus size={12} />Satır Ekle
                </button>
              </div>

              {/* Vade tarihi */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Vade Tarihi</label>
                <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notlar</label>
                <textarea value={invNotes} onChange={(e) => setInvNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>

              {/* Özet — per-line KDV hesaplı */}
              {(() => {
                const rows = invLines.filter((l) => l.unitPrice > 0);
                const sub  = rows.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                const vat  = rows.reduce((s, l) => s + l.qty * l.unitPrice * (l.vatRate / 100), 0);
                return (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
                    {rows.map((l, i) => l.vatRate > 0 && (
                      <div key={i} className="flex justify-between text-gray-500 text-xs">
                        <span>{l.description || `Kalem ${i+1}`} KDV (%{l.vatRate})</span>
                        <span>₺{(l.qty * l.unitPrice * l.vatRate / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-1"><span>Ara Toplam</span><span>₺{sub.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Toplam KDV</span><span>₺{vat.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1 text-base"><span>Toplam</span><span>₺{(sub + vat).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span></div>
                  </div>
                );
              })()}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowInvModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">İptal</button>
              <button onClick={createInvoice} disabled={invSaving}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {invSaving ? "Oluşturuluyor..." : "Fatura Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2.5">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-500 flex-shrink-0 text-xs">{label}</span>
      <span className={`text-right ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>
        {value}
      </span>
    </div>
  );
}
