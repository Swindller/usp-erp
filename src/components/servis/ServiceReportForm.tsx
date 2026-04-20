"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerType } from "@prisma/client";
import {
  Search,
  Plus,
  User,
  Building2,
  ChevronRight,
  ChevronLeft,
  Check,
  Wrench,
  MapPin,
  Shield,
  RefreshCcw,
  Loader2,
  X,
} from "lucide-react";
import { SignaturePad, SignaturePadRef } from "./SignaturePad";

// ── Types ────────────────────────────────────────────────────

interface Customer {
  id: string;
  type: CustomerType;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
}

const PERSONNEL_ROLE_LABELS: Record<string, string> = {
  TECHNICIAN: "Teknisyen",
  FIELD_TECHNICIAN: "Saha Teknisyeni",
  WORKSHOP_TECHNICIAN: "Atölye Teknisyeni",
  SUPERVISOR: "Süpervizör",
  MANAGER: "Yönetici",
};

interface Personnel {
  id: string;
  role: string;
  user: { firstName: string | null; lastName: string | null };
}

interface Props {
  personnel: Personnel[];
}

type ServiceType = "WORKSHOP" | "FIELD" | "WARRANTY" | "PERIODIC";
type Step = "customer" | "device" | "complaint" | "signature";

const STEPS: { id: Step; label: string; shortLabel: string }[] = [
  { id: "customer",  label: "Müşteri Seçimi",  shortLabel: "Müşteri" },
  { id: "device",    label: "Cihaz Bilgileri",  shortLabel: "Cihaz" },
  { id: "complaint", label: "Arıza Detayları",  shortLabel: "Arıza" },
  { id: "signature", label: "İmza & Tamamla",   shortLabel: "İmza" },
];

const SERVICE_TYPE_OPTIONS: {
  value: ServiceType;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  { value: "WORKSHOP", label: "Atölye",   icon: <Wrench  size={18} />, desc: "Müşteri cihazı getirdi" },
  { value: "FIELD",    label: "Saha",     icon: <MapPin  size={18} />, desc: "Adrese gidilecek" },
  { value: "WARRANTY", label: "Garanti",  icon: <Shield  size={18} />, desc: "Garanti kapsamında" },
  { value: "PERIODIC", label: "Periyodik",icon: <RefreshCcw size={18} />, desc: "Bakım & kontrol" },
];

const PHASE_OPTIONS = ["Monofaz (1~)", "Trifaz (3~)", "DC"];

// ── Helpers ──────────────────────────────────────────────────

function customerDisplayName(c: Customer) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function inputClass(error?: string) {
  return `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
    error ? "border-red-400 bg-red-50" : "border-gray-200 bg-white focus:border-primary"
  }`;
}

// ── New Customer Form ─────────────────────────────────────────

function NewCustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<CustomerType>("INDIVIDUAL");
  const [form, setForm] = useState({
    firstName: "", lastName: "", tcNumber: "",
    companyName: "", taxNumber: "", taxOffice: "",
    phone: "", email: "", address: "", city: "", district: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.phone) errs.phone = "Telefon zorunludur";
    if (type === "INDIVIDUAL" && !form.firstName && !form.lastName)
      errs.firstName = "Ad veya soyad zorunludur";
    if (type === "CORPORATE" && !form.companyName)
      errs.companyName = "Firma adı zorunludur";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/musteriler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrors(data.error || {});
        return;
      }
      const { customer } = await res.json();
      onCreated(customer);
    } catch {
      setErrors({ phone: "Sunucu hatası" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Yeni Müşteri</h3>
        <button type="button" onClick={onCancel}><X size={16} className="text-gray-400" /></button>
      </div>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["INDIVIDUAL", "CORPORATE"] as CustomerType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {t === "INDIVIDUAL" ? <User size={15} /> : <Building2 size={15} />}
            {t === "INDIVIDUAL" ? "Şahıs" : "Kurumsal"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {type === "INDIVIDUAL" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input placeholder="Ad" value={form.firstName} onChange={set("firstName")} className={inputClass(errors.firstName)} />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
            </div>
            <input placeholder="Soyad" value={form.lastName} onChange={set("lastName")} className={inputClass()} />
          </div>
        ) : (
          <div>
            <input placeholder="Firma Adı *" value={form.companyName} onChange={set("companyName")} className={inputClass(errors.companyName)} />
            {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
          </div>
        )}

        <div>
          <input placeholder="Telefon *" type="tel" value={form.phone} onChange={set("phone")} className={inputClass(errors.phone)} />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <input placeholder="E-posta" type="email" value={form.email} onChange={set("email")} className={inputClass()} />

        {type === "CORPORATE" && (
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Vergi No" value={form.taxNumber} onChange={set("taxNumber")} className={inputClass()} />
            <input placeholder="Vergi Dairesi" value={form.taxOffice} onChange={set("taxOffice")} className={inputClass()} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Şehir" value={form.city} onChange={set("city")} className={inputClass()} />
          <input placeholder="İlçe" value={form.district} onChange={set("district")} className={inputClass()} />
        </div>

        <textarea
          placeholder="Adres"
          value={form.address}
          onChange={set("address")}
          className={`${inputClass()} resize-none`}
          rows={2}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Müşteri Oluştur
        </button>
      </form>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────

export function ServiceReportForm({ personnel }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("customer");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Step 1
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // Step 2
  const [device, setDevice] = useState({
    deviceBrand: "",
    deviceModel: "",
    deviceSerial: "",
    deviceYear: "",
    devicePower: "",
    deviceVoltage: "",
    devicePhase: "",
  });

  // Step 3
  const [serviceType, setServiceType] = useState<ServiceType>("WORKSHOP");
  const [complaint, setComplaint] = useState("");
  const [isWarranty, setIsWarranty] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 4
  const [customerNote, setCustomerNote] = useState("");
  const [customerSig, setCustomerSig] = useState<string | null>(null);
  const [technicianSig, setTechnicianSig] = useState<string | null>(null);
  const customerSigRef = useRef<SignaturePadRef>(null);
  const technicianSigRef = useRef<SignaturePadRef>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Debounced customer search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/musteriler?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.customers || []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const selectCustomer = useCallback((c: Customer) => {
    setSelectedCustomer(c);
    setSearchQuery("");
    setSearchResults([]);
    setShowNewCustomer(false);
  }, []);

  const validateStep = (step: Step): boolean => {
    const errs: Record<string, string> = {};
    if (step === "customer" && !selectedCustomer) {
      errs.customer = "Müşteri seçimi zorunludur";
    }
    if (step === "complaint" && !complaint.trim()) {
      errs.complaint = "Müşteri şikayeti zorunludur";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    const idx = stepIndex;
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const goPrev = () => {
    const idx = stepIndex;
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) return;
    setSubmitting(true);
    setSubmitError("");

    const payload = {
      customerId: selectedCustomer.id,
      ...device,
      deviceYear: device.deviceYear ? parseInt(device.deviceYear) : undefined,
      serviceType,
      complaint,
      isWarranty,
      technicianId: technicianId || undefined,
      estimatedDate: estimatedDate || undefined,
      internalNotes: internalNotes || undefined,
      customerNote: customerNote || undefined,
      customerSignature: customerSig || undefined,
      technicianSignature: technicianSig || undefined,
    };

    try {
      const res = await fetch("/api/servis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(
          typeof data.error === "string" ? data.error : "Kayıt oluşturulamadı."
        );
        return;
      }

      const { report } = await res.json();
      router.push(`/servis/${report.id}`);
    } catch {
      setSubmitError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  const setDeviceField = (k: keyof typeof device) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDevice((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => {
                  if (i < stepIndex) setCurrentStep(step.id);
                }}
                className={`flex items-center gap-2 ${i < stepIndex ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    i < stepIndex
                      ? "bg-green-500 text-white"
                      : i === stepIndex
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i < stepIndex ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    i === stepIndex ? "text-primary" : i < stepIndex ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {step.shortLabel}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    i < stepIndex ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-lg font-bold text-gray-900">
          {STEPS[stepIndex].label}
        </p>
      </div>

      {/* ── Step 1: Customer ── */}
      {currentStep === "customer" && (
        <div className="space-y-4">
          {selectedCustomer ? (
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                {selectedCustomer.type === "CORPORATE"
                  ? <Building2 size={18} className="text-primary" />
                  : <User size={18} className="text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{customerDisplayName(selectedCustomer)}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                {selectedCustomer.city && (
                  <p className="text-xs text-gray-400">{[selectedCustomer.city, selectedCustomer.district].filter(Boolean).join(" / ")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              {!showNewCustomer && (
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Ad, telefon veya firma ile ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    autoFocus
                  />
                  {searching && (
                    <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                </div>
              )}

              {searchResults.length > 0 && !showNewCustomer && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {c.type === "CORPORATE"
                          ? <Building2 size={15} className="text-gray-500" />
                          : <User size={15} className="text-gray-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{customerDisplayName(c)}</p>
                        <p className="text-xs text-gray-400">{c.phone}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              )}

              {!showNewCustomer && (
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors text-sm"
                >
                  <Plus size={16} />
                  Yeni müşteri oluştur
                </button>
              )}

              {showNewCustomer && (
                <NewCustomerForm
                  onCreated={selectCustomer}
                  onCancel={() => setShowNewCustomer(false)}
                />
              )}
            </>
          )}

          {errors.customer && (
            <p className="text-sm text-red-500">{errors.customer}</p>
          )}
        </div>
      )}

      {/* ── Step 2: Device ── */}
      {currentStep === "device" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Marka</label>
              <input
                placeholder="örn. Grundfos, Lowara"
                value={device.deviceBrand}
                onChange={setDeviceField("deviceBrand")}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Model</label>
              <input
                placeholder="örn. CM5-6 A-R-I-E-AVBE"
                value={device.deviceModel}
                onChange={setDeviceField("deviceModel")}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Seri Numarası</label>
              <input
                placeholder="Seri / ürün numarası"
                value={device.deviceSerial}
                onChange={setDeviceField("deviceSerial")}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Üretim Yılı</label>
              <input
                type="number"
                placeholder="örn. 2021"
                min={1980}
                max={new Date().getFullYear()}
                value={device.deviceYear}
                onChange={setDeviceField("deviceYear")}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Güç (kW / HP)</label>
              <input
                placeholder="örn. 2.2 kW / 3 HP"
                value={device.devicePower}
                onChange={setDeviceField("devicePower")}
                className={inputClass()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Voltaj</label>
              <input
                placeholder="örn. 220V / 380V"
                value={device.deviceVoltage}
                onChange={setDeviceField("deviceVoltage")}
                className={inputClass()}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Faz</label>
              <div className="grid grid-cols-3 gap-2">
                {PHASE_OPTIONS.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setDevice((p) => ({ ...p, devicePhase: ph }))}
                    className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                      device.devicePhase === ph
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 italic">
            Cihaz bilgileri opsiyoneldir, sonradan da eklenebilir.
          </p>
        </div>
      )}

      {/* ── Step 3: Complaint ── */}
      {currentStep === "complaint" && (
        <div className="space-y-5">
          {/* Service type */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Servis Türü</label>
            <div className="grid grid-cols-2 gap-2.5">
              {SERVICE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setServiceType(opt.value)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-colors ${
                    serviceType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`mt-0.5 ${serviceType === opt.value ? "text-primary" : "text-gray-400"}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${serviceType === opt.value ? "text-primary" : "text-gray-700"}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Warranty toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-800">Garanti Kapsamında</p>
              <p className="text-xs text-gray-400">Bu servis garanti dahilinde mi?</p>
            </div>
            <button
              type="button"
              onClick={() => setIsWarranty((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isWarranty ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  isWarranty ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Complaint */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Müşteri Şikayeti <span className="text-red-500">*</span>
            </label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Müşteri tarafından bildirilen arıza veya sorun detaylarını buraya yazın..."
              rows={4}
              className={`${inputClass(errors.complaint)} resize-none`}
            />
            {errors.complaint && (
              <p className="text-xs text-red-500 mt-1">{errors.complaint}</p>
            )}
          </div>

          {/* Technician */}
          {personnel.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Teknisyen Ataması</label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className={inputClass()}
              >
                <option value="">— Teknisyen seç —</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || "Teknisyen"} · {PERSONNEL_ROLE_LABELS[p.role] ?? p.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estimated date */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tahmini Teslim Tarihi</label>
            <input
              type="date"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className={inputClass()}
            />
          </div>

          {/* Internal notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              İç Notlar <span className="text-gray-400">(müşteriye gösterilmez)</span>
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Teknisyen için ek bilgi veya uyarılar..."
              rows={2}
              className={`${inputClass()} resize-none`}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Signature ── */}
      {currentStep === "signature" && (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Müşteriye Not</label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Müşteriye verilecek bilgi veya talimatlar..."
              rows={3}
              className={`${inputClass()} resize-none`}
            />
          </div>

          <SignaturePad
            label="Müşteri İmzası"
            value={customerSig || undefined}
            onChange={setCustomerSig}
          />

          <SignaturePad
            ref={technicianSigRef}
            label="Teknisyen İmzası"
            value={technicianSig || undefined}
            onChange={setTechnicianSig}
          />

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          {/* Summary card */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Özet</h4>
            <SummaryRow label="Müşteri" value={customerDisplayName(selectedCustomer!)} />
            {device.deviceBrand && (
              <SummaryRow label="Cihaz" value={[device.deviceBrand, device.deviceModel].filter(Boolean).join(" ")} />
            )}
            {device.deviceSerial && <SummaryRow label="Seri No" value={device.deviceSerial} />}
            <SummaryRow
              label="Servis Türü"
              value={SERVICE_TYPE_OPTIONS.find((o) => o.value === serviceType)?.label || ""}
            />
            <SummaryRow label="Garanti" value={isWarranty ? "Evet" : "Hayır"} />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
            Geri
          </button>
        )}

        <div className="flex-1" />

        {currentStep !== "signature" ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Devam
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Check size={16} />
                Servis Kaydı Oluştur
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value}</span>
    </div>
  );
}
