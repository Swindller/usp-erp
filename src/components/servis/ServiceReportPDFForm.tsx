"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Plus, Loader2, Check, Building2, User, Download } from "lucide-react";
import { SignaturePad, SignaturePadRef } from "./SignaturePad";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  type: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
}

interface Personnel {
  id: string;
  role: string;
  user: { firstName: string | null; lastName: string | null };
}

interface Props {
  personnel: Personnel[];
}

type ServiceType = "WORKSHOP" | "FIELD" | "WARRANTY" | "PERIODIC";
interface PartRow {
  ad: string;
  adet: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_PARTS: PartRow[] = Array.from({ length: 5 }, () => ({ ad: "", adet: "" }));

// ── Helper ────────────────────────────────────────────────────────────────────

function cName(c: Customer) {
  if (c.type === "CORPORATE") return c.companyName || "Kurumsal";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "İsimsiz";
}

function today() {
  return new Date().toLocaleDateString("tr-TR");
}

// ── Inline input styles ───────────────────────────────────────────────────────

const inp =
  "border-0 outline-none bg-transparent text-[11px] w-full placeholder:text-gray-300 placeholder:italic";

// ── Cell helpers ──────────────────────────────────────────────────────────────

function LabelVal({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-1.5 ${className}`}>
      <span className="font-bold text-blue-900 text-[10px] mr-0.5">{label}</span>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1e40af] text-white font-bold px-2 py-0.5 text-[10px]">
      {children}
    </div>
  );
}

// ── New Customer quick-form ───────────────────────────────────────────────────

function NewCustomerInline({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: "INDIVIDUAL" as "INDIVIDUAL" | "CORPORATE",
    firstName: "", lastName: "", companyName: "",
    phone: "", email: "", address: "", city: "", district: "",
    taxOffice: "", taxNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.phone) { setErr("Telefon zorunludur"); return; }
    if (form.type === "INDIVIDUAL" && !form.firstName && !form.lastName) {
      setErr("Ad veya soyad zorunludur"); return;
    }
    if (form.type === "CORPORATE" && !form.companyName) {
      setErr("Firma adı zorunludur"); return;
    }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/musteriler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setErr("Müşteri oluşturulamadı"); return; }
      const { customer } = await res.json();
      onCreated(customer);
    } finally { setLoading(false); }
  };

  return (
    <div className="absolute z-30 left-0 top-full mt-1 bg-white border border-gray-300 shadow-xl rounded-lg p-3 w-72 text-[11px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-700 text-[12px]">Yeni Müşteri</span>
        <button type="button" onClick={onCancel}><X size={13} className="text-gray-400" /></button>
      </div>
      <div className="flex gap-2 mb-2">
        {(["INDIVIDUAL", "CORPORATE"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, type: t }))}
            className={`flex-1 py-1 rounded border text-[10px] font-medium transition-colors ${form.type === t ? "bg-blue-800 text-white border-blue-800" : "border-gray-300 text-gray-600"}`}>
            {t === "INDIVIDUAL" ? "Şahıs" : "Kurumsal"}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {form.type === "INDIVIDUAL" ? (
          <div className="grid grid-cols-2 gap-1.5">
            <input placeholder="Ad" value={form.firstName} onChange={set("firstName")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
            <input placeholder="Soyad" value={form.lastName} onChange={set("lastName")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
          </div>
        ) : (
          <input placeholder="Firma Adı *" value={form.companyName} onChange={set("companyName")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
        )}
        <input placeholder="Telefon *" value={form.phone} onChange={set("phone")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
        <input placeholder="E-posta" value={form.email} onChange={set("email")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
        <div className="grid grid-cols-2 gap-1.5">
          <input placeholder="Şehir" value={form.city} onChange={set("city")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
          <input placeholder="İlçe" value={form.district} onChange={set("district")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
        </div>
        <input placeholder="Adres" value={form.address} onChange={set("address")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
        {form.type === "CORPORATE" && (
          <div className="grid grid-cols-2 gap-1.5">
            <input placeholder="Vergi Dairesi" value={form.taxOffice} onChange={set("taxOffice")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
            <input placeholder="Vergi No" value={form.taxNumber} onChange={set("taxNumber")} className="border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-400 w-full" />
          </div>
        )}
        {err && <p className="text-red-500 text-[10px]">{err}</p>}
        <button type="button" onClick={handleCreate} disabled={loading}
          className="w-full py-1.5 bg-blue-800 text-white rounded text-[11px] font-medium flex items-center justify-center gap-1 disabled:opacity-50">
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Müşteri Oluştur
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ServiceReportPDFForm({ personnel }: Props) {
  const router = useRouter();

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [serviceType, setServiceType] = useState<ServiceType>("WORKSHOP");
  const [isWarranty, setIsWarranty] = useState(false);
  const [completedAt, setCompletedAt] = useState("");
  const [ilgiliKisi, setIlgiliKisi] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [deviceYear, setDeviceYear] = useState("");
  const [deviceWeek, setDeviceWeek] = useState("");
  const [devicePower, setDevicePower] = useState("");
  const [complaint, setComplaint] = useState("");
  const [diagnoses, setDiagnoses] = useState<string[]>(Array(9).fill(""));
  const [ops, setOps] = useState<string[]>(Array(9).fill(""));
  const [internalNotes, setInternalNotes] = useState("");
  const [parts, setParts] = useState<PartRow[]>(EMPTY_PARTS);
  const [technicianId, setTechnicianId] = useState("");

  // Signatures
  const customerSigRef = useRef<SignaturePadRef>(null);
  const techSigRef = useRef<SignaturePadRef>(null);
  const [customerSig, setCustomerSig] = useState<string | null>(null);
  const [techSig, setTechSig] = useState<string | null>(null);

  // Signer info
  const [techSignerName, setTechSignerName] = useState("");
  const [techSignerRole, setTechSignerRole] = useState("Teknik Servis Uzmanı");
  const [custSignerName, setCustSignerName] = useState("");
  const [custSignerRole, setCustSignerRole] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Customer search ──────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/musteriler?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.customers || []);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Müşteri seçilince custSignerName otomatik doldur
  useEffect(() => {
    if (customer) setCustSignerName(cName(customer));
  }, [customer]);

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (andDownload = false) => {
    if (!customer) { setError("Müşteri seçiniz"); return; }
    if (!complaint.trim()) { setError("Müşteri şikayeti zorunludur"); return; }
    setSubmitting(true); setError("");

    const diagnosisText = diagnoses.filter(Boolean).join("\n");
    const operationsText = ops.filter(Boolean).join("\n");
    const partsUsed = parts
      .filter((p) => p.ad.trim())
      .map((p) => ({
        productId: "manual",
        name: p.ad.trim(),
        partNo: "",
        quantity: parseInt(p.adet) || 1,
        unitPrice: 0,
      }));

    const notes = [
      internalNotes,
      ilgiliKisi ? `İlgili Kişi: ${ilgiliKisi}` : "",
    ].filter(Boolean).join("\n");

    const payload = {
      customerId: customer.id,
      serviceType,
      isWarranty,
      complaint,
      diagnosis: diagnosisText || undefined,
      operations: operationsText || undefined,
      partsUsed: partsUsed.length ? partsUsed : undefined,
      deviceBrand: deviceBrand || undefined,
      deviceModel: deviceModel || undefined,
      deviceSerial: deviceSerial || undefined,
      deviceYear: deviceYear ? parseInt(deviceYear) : undefined,
      deviceWeek: deviceWeek ? parseInt(deviceWeek) : undefined,
      devicePower: devicePower || undefined,
      technicianId: technicianId || undefined,
      estimatedDate: completedAt || undefined,
      internalNotes: notes || undefined,
      customerSignature: customerSig || undefined,
      technicianSignature: techSig || undefined,
      techSignerName: techSignerName || undefined,
      techSignerRole: techSignerRole || undefined,
      custSignerName: custSignerName || undefined,
      custSignerRole: custSignerRole || undefined,
    };

    try {
      const res = await fetch("/api/servis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Kayıt hatası");
        return;
      }
      const { report } = await res.json();

      if (andDownload) {
        // Yeni sekmede PDF indir, sonra detay sayfasına git
        window.open(`/api/servis/${report.id}/pdf`, "_blank");
        router.push(`/servis/${report.id}`);
      } else {
        router.push(`/servis/${report.id}`);
      }
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-[820px] mx-auto pb-12 select-none">

      {/* ── Üst aksiyon çubuğu ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Geri
        </button>
        <div className="flex items-center gap-3">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {submitting ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            Kaydet
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-[#1e40af] text-white text-sm font-medium flex items-center gap-2 hover:bg-blue-900 disabled:opacity-50 transition"
          >
            <Download size={14} />
            Kaydet & PDF İndir
          </button>
        </div>
      </div>

      {/* ── A4 Kağıt ── */}
      <div className="bg-white border border-gray-400 shadow-2xl font-sans text-[11px] text-black">

        {/* ── HEADER ── */}
        <div className="flex justify-between items-start p-3 pb-2 border-b border-gray-300">
          <div>
            <div className="text-[17px] font-extrabold text-[#1e40af] tracking-wide leading-tight">
              UĞUR SU POMPALARI
            </div>
            <div className="text-[8.5px] font-semibold text-[#1e3a8a] mt-0.5">
              ELEKTRİK İNŞAAT TARIM HAYVANCILIK SAN. VE TİC. LTD. ŞTİ.
            </div>
            <div className="text-[8px] text-gray-500 mt-0.5">
              Grundfos İç Anadolu Bölgesi Yetkili Servisi
            </div>
          </div>
          <div className="border border-[#1e40af] p-2 text-right min-w-[200px]">
            <div className="text-[9px] font-bold text-[#1e40af]">DENETİMLİ GRUNDFOS YETKİLİ SERVİSİ</div>
            <div className="text-[8px] text-gray-500 mt-0.5">servis@ugursupompalari.com.tr</div>
            <div className="text-[13px] font-bold text-[#1e3a8a] mt-1">Arıza İhbar: 0549 629 19 12</div>
          </div>
        </div>

        {/* ── DOKÜMAN SATIRI ── */}
        <div className="flex border-b border-gray-300">
          <div className="flex-[3] border-r border-gray-300 p-1.5">
            <span className="font-bold text-[#1e40af] text-[10px]">Teknik Servis Raporu</span>
          </div>
          <div className="flex-[2] border-r border-gray-300 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Doküman No: </span>
            <span className="text-gray-400 italic text-[10px]">Otomatik</span>
          </div>
          <div className="flex-[1.5] border-r border-gray-300 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Revizyon No: </span>
            <span className="text-[10px]">00</span>
          </div>
          <div className="flex-[2] p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Yayın Tarihi: </span>
            <span className="text-[10px]">{today()}</span>
          </div>
        </div>
        <div className="flex border-b border-gray-300">
          <div className="flex-1 border-r border-gray-300 p-1.5 flex items-center gap-1">
            <span className="font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap">Servis İsteğinin İletim Şekli:</span>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
              className="border-0 outline-none bg-transparent text-[11px] flex-1 cursor-pointer"
            >
              <option value="WORKSHOP">Atölye Servisi</option>
              <option value="FIELD">Saha Servisi</option>
              <option value="WARRANTY">Garanti Servisi</option>
              <option value="PERIODIC">Periyodik Bakım</option>
            </select>
          </div>
          <div className="flex-1 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Tarih(G): </span>
            <span className="text-[11px]">{today()}</span>
          </div>
        </div>

        {/* ── MÜŞTERİ ── */}
        <SectionHeader>Müşterinin</SectionHeader>

        {/* Adı-İli-Projesi + Tarih(Ç) */}
        <div className="flex border-b border-gray-300">
          <div className="flex-1 border-r border-gray-300 p-1.5 relative" ref={searchRef}>
            <span className="font-bold text-[#1e3a8a] text-[10px]">Adı-İli-Projesi: </span>
            {customer ? (
              <span className="inline-flex items-center gap-1 text-[11px]">
                {cName(customer)}
                {customer.city ? ` / ${customer.city}` : ""}
                <button type="button" onClick={() => setCustomer(null)}
                  className="text-gray-400 hover:text-red-500 ml-1">
                  <X size={10} />
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Search size={10} className="text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Müşteri ara..."
                  className={inp + " max-w-[160px]"}
                  autoComplete="off"
                />
                {searching && <Loader2 size={10} className="animate-spin text-gray-400" />}
              </span>
            )}

            {/* Search results dropdown */}
            {searchResults.length > 0 && !customer && (
              <div className="absolute z-20 left-0 top-full mt-0.5 bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden w-64">
                {searchResults.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => { setCustomer(c); setSearchQuery(""); setSearchResults([]); }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-100 last:border-0">
                    {c.type === "CORPORATE" ? <Building2 size={12} className="text-gray-400 flex-shrink-0" /> : <User size={12} className="text-gray-400 flex-shrink-0" />}
                    <div>
                      <div className="text-[11px] font-medium text-gray-800">{cName(c)}</div>
                      <div className="text-[10px] text-gray-400">{c.phone}</div>
                    </div>
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setSearchResults([]); setShowNewCustomer(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-green-50 text-[11px] text-green-700 font-medium">
                  <Plus size={12} /> Yeni müşteri oluştur
                </button>
              </div>
            )}
            {!customer && searchQuery.length === 0 && (
              <button type="button" onClick={() => setShowNewCustomer(true)}
                className="ml-2 text-[10px] text-blue-600 hover:underline">
                + Yeni
              </button>
            )}
            {showNewCustomer && (
              <NewCustomerInline
                onCreated={(c) => { setCustomer(c); setShowNewCustomer(false); }}
                onCancel={() => setShowNewCustomer(false)}
              />
            )}
          </div>
          <div className="flex-1 p-1.5 flex items-center gap-1">
            <span className="font-bold text-[#1e3a8a] text-[10px] whitespace-nowrap">Tarih(Ç):</span>
            <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)}
              className={inp} />
          </div>
        </div>

        {/* İlgili Kişi */}
        <div className="border-b border-gray-300 p-1.5">
          <span className="font-bold text-[#1e3a8a] text-[10px]">İlgili Kişi: </span>
          <input value={ilgiliKisi} onChange={(e) => setIlgiliKisi(e.target.value)}
            placeholder="İsim girin" className={inp + " max-w-xs"} />
        </div>

        {/* Adres */}
        <div className="border-b border-gray-300 p-1.5">
          <span className="font-bold text-[#1e3a8a] text-[10px]">Adres: </span>
          <span className="text-[11px] text-gray-700">
            {customer ? [customer.address, customer.district, customer.city].filter(Boolean).join(", ") || "—" : ""}
          </span>
        </div>

        {/* Telefon + Web */}
        <div className="flex border-b border-gray-300">
          <div className="flex-1 border-r border-gray-300 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Telefon: </span>
            <span className="text-[11px]">{customer?.phone || ""}</span>
          </div>
          <div className="flex-1 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Web: </span>
            <span className="text-[11px] text-gray-400">—</span>
          </div>
        </div>

        {/* Vergi Dairesi + E-Mail */}
        <div className="flex border-b border-gray-300">
          <div className="flex-1 border-r border-gray-300 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">Vergi Dairesi: </span>
            <span className="text-[11px]">{customer?.taxOffice || ""}</span>
          </div>
          <div className="flex-1 p-1.5">
            <span className="font-bold text-[#1e3a8a] text-[10px]">E-Mail: </span>
            <span className="text-[11px]">{customer?.email || ""}</span>
          </div>
        </div>

        {/* ── ARIZALI ÜRÜN ── */}
        <SectionHeader>Arızalı Ürünün</SectionHeader>

        <div className="flex border-b border-gray-300">
          <LabelVal label="Ürün No'su:" className="flex-1 border-r border-gray-300">
            <input value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)}
              placeholder="Marka / Ürün No" className={inp} />
          </LabelVal>
          <LabelVal label="Modeli:" className="flex-1">
            <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)}
              placeholder="Model" className={inp} />
          </LabelVal>
        </div>
        <div className="flex border-b border-gray-300">
          <LabelVal label="Seri No:" className="flex-1 border-r border-gray-300">
            <input value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)}
              placeholder="Seri numarası" className={inp} />
          </LabelVal>
          <LabelVal label="Üretim Tarihi:" className="flex-1 border-r border-gray-300">
            <div className="flex gap-1">
              <select value={deviceWeek} onChange={(e) => setDeviceWeek(e.target.value)} className={`${inp} w-20`}>
                <option value="">Hafta</option>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={String(w)}>{w}. Hafta</option>
                ))}
              </select>
              <select value={deviceYear} onChange={(e) => setDeviceYear(e.target.value)} className={`${inp} flex-1`}>
                <option value="">Yıl</option>
                {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </LabelVal>
          <LabelVal label="Üretim Yeri:" className="flex-1">
            <input value={devicePower} onChange={(e) => setDevicePower(e.target.value)}
              placeholder="Ülke / Şehir" className={inp} />
          </LabelVal>
        </div>

        {/* ── NOT ── */}
        <div className="bg-gray-50 border-y border-gray-300 px-3 py-1 text-[8.5px] text-gray-500 text-center">
          ( Bu Kısım UĞUR SU POMPALARI LTD. ŞTİ. Tarafından Doldurulacaktır.
          Arızanın Meydana Gelmesi ve Yapılacak İşlemler Kısaca Belirtilecektir. )
        </div>

        {/* ── MÜŞTERİ ŞİKAYETİ ── */}
        <div className="border-b border-gray-300 p-1.5">
          <span className="font-bold text-[#1e3a8a] text-[10px]">Müşteri Şikayeti: </span>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Müşteri tarafından bildirilen arıza veya şikayet..."
            rows={2}
            className={inp + " resize-none align-top leading-relaxed"}
          />
        </div>

        {/* ── TESPİT / YAPILACAK ── */}
        <div className="border-b border-gray-300">
          <div className="flex border-b border-gray-300">
            <div className="w-1/2 bg-[#1e40af] text-white font-bold px-2 py-0.5 text-[10px] border-r border-white/20">
              Tespit Edilen Arızalar:
            </div>
            <div className="w-1/2 bg-[#1e40af] text-white font-bold px-2 py-0.5 text-[10px]">
              Yapılacak İşler:
            </div>
          </div>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex border-b border-gray-100 last:border-0 min-h-[18px]">
              <div className="w-1/2 border-r border-gray-200 px-1.5 py-0.5 flex items-center gap-1">
                <span className="font-bold text-[#1e3a8a] text-[10px] flex-shrink-0 select-none">{i + 1}:</span>
                <input
                  value={diagnoses[i]}
                  onChange={(e) => {
                    const d = [...diagnoses]; d[i] = e.target.value; setDiagnoses(d);
                  }}
                  className={inp}
                  placeholder={i === 0 ? "Tespit edilen arıza..." : ""}
                />
              </div>
              <div className="w-1/2 px-1.5 py-0.5 flex items-center gap-1">
                <span className="font-bold text-[#1e3a8a] text-[10px] flex-shrink-0 select-none">{i + 1}:</span>
                <input
                  value={ops[i]}
                  onChange={(e) => {
                    const o = [...ops]; o[i] = e.target.value; setOps(o);
                  }}
                  className={inp}
                  placeholder={i === 0 ? "Yapılacak iş..." : ""}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── KİŞİSEL DÜŞÜNCELER ── */}
        <div className="border-b border-gray-300 p-1.5">
          <div className="font-bold text-[#1e3a8a] text-[10px] mb-0.5">Kişisel Düşünceler</div>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="Notlar..."
            className={inp + " resize-none leading-relaxed"}
          />
        </div>

        {/* ── BAKIM / MÜDAHALE ── */}
        <div className="flex border-b border-gray-300">
          {/* Bakım Şekli */}
          <div className="flex-1 border-r border-gray-300">
            <SectionHeader>Bakım Şekli</SectionHeader>
            <div className="p-2 space-y-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="warranty" checked={isWarranty}
                  onChange={() => setIsWarranty(true)} className="w-3 h-3 accent-blue-800" />
                <span className="text-[11px]">Garantili</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="warranty" checked={!isWarranty}
                  onChange={() => setIsWarranty(false)} className="w-3 h-3 accent-blue-800" />
                <span className="text-[11px]">Garanti Dışı</span>
              </label>
            </div>
          </div>

          {/* Müdahale Yeri */}
          <div className="flex-1">
            <SectionHeader>Müdahale Yeri</SectionHeader>
            <div className="p-2 space-y-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="serviceLocation" checked={serviceType === "FIELD"}
                  onChange={() => setServiceType("FIELD")} className="w-3 h-3 accent-blue-800" />
                <span className="text-[11px]">Yerinde</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="serviceLocation" checked={serviceType !== "FIELD"}
                  onChange={() => { if (serviceType === "FIELD") setServiceType("WORKSHOP"); }}
                  className="w-3 h-3 accent-blue-800" />
                <span className="text-[11px]">Serviste</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── KULLANILAN MALZEMELER ── */}
        <div className="bg-[#1e40af] text-white font-bold px-2 py-0.5 text-[10px] text-center">
          Kullanılan Malzemelerin
        </div>
        <div className="border-b border-gray-300">
          {/* Header */}
          <div className="flex border-b border-gray-200">
            <div className="flex-1 border-r border-gray-300 bg-[#1e40af] text-white text-[10px] font-bold px-2 py-0.5">Adı</div>
            <div className="w-16 bg-[#1e40af] text-white text-[10px] font-bold px-2 py-0.5">Adedi</div>
          </div>
          {/* Rows */}
          {parts.map((part, i) => (
            <div key={i} className="flex border-b border-gray-100 last:border-0 min-h-[16px]">
              <div className="flex-1 border-r border-gray-200 px-1.5 py-0.5 flex items-center gap-0.5">
                <span className="text-[#1e3a8a] font-bold text-[10px] flex-shrink-0">{i + 1}:</span>
                <input value={part.ad}
                  onChange={(e) => setParts(parts.map((r, j) => j === i ? { ...r, ad: e.target.value } : r))}
                  className={inp} placeholder="Malzeme adı" />
              </div>
              <div className="w-16 px-1.5 py-0.5">
                <input value={part.adet}
                  onChange={(e) => setParts(parts.map((r, j) => j === i ? { ...r, adet: e.target.value } : r))}
                  className={inp} placeholder="1" />
              </div>
            </div>
          ))}
        </div>

        {/* ── İMZALAR ── */}
        <div className="flex border-b border-gray-300">
          {/* Düzenleyen */}
          <div className="flex-1 border-r border-gray-300 p-2">
            <div className="font-bold text-[#1e3a8a] text-[10px] mb-1.5">Düzenleyen</div>
            <div className="text-[10px] mb-0.5 flex items-center gap-1">
              <span className="flex-shrink-0 text-[#1e3a8a] font-bold">Teknisyen:</span>
              <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}
                className="border-0 outline-none bg-transparent text-[11px] cursor-pointer flex-1">
                <option value="">— Teknisyen seç —</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || "Teknisyen"}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[10px] mb-0.5 flex items-center gap-1">
              <span className="flex-shrink-0 text-[#1e3a8a] font-bold">Adı ve Soyadı:</span>
              <input value={techSignerName} onChange={(e) => setTechSignerName(e.target.value)} className={inp} placeholder="İsim" />
            </div>
            <div className="text-[10px] mb-0.5 flex items-center gap-1">
              <span className="flex-shrink-0 text-[#1e3a8a] font-bold">Görevi:</span>
              <input value={techSignerRole} onChange={(e) => setTechSignerRole(e.target.value)} className={inp} placeholder="Görev" />
            </div>
            <div className="text-[10px] mb-1">İmza:</div>
            <SignaturePad ref={techSigRef} label="" value={techSig || undefined} onChange={setTechSig} />
          </div>

          {/* Müşteri Onayı */}
          <div className="flex-1 p-2">
            <div className="font-bold text-[#1e3a8a] text-[10px] mb-1.5">Müşteri Onayı</div>
            <div className="text-[10px] mb-0.5 flex items-center gap-1">
              <span className="flex-shrink-0 text-[#1e3a8a] font-bold">Adı ve Soyadı:</span>
              <input value={custSignerName} onChange={(e) => setCustSignerName(e.target.value)} className={inp} placeholder="İsim" />
            </div>
            <div className="text-[10px] mb-0.5 flex items-center gap-1">
              <span className="flex-shrink-0 text-[#1e3a8a] font-bold">Görevi:</span>
              <input value={custSignerRole} onChange={(e) => setCustSignerRole(e.target.value)} className={inp} placeholder="Görev" />
            </div>
            <div className="text-[10px] mb-1">İmza:</div>
            <SignaturePad ref={customerSigRef} label="" value={customerSig || undefined} onChange={setCustomerSig} />
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="p-2 text-center space-y-0.5">
          <p className="text-[8px] text-gray-600">
            <strong>Merkez:</strong> Altay Mahallesi Söğüt Caddesi No:8DA A Blok Dükkan No: 2 Eryaman / Etimesgut / ANKARA
          </p>
          <p className="text-[8px] text-gray-600">
            <strong>Tel:</strong> 0312 394 37 52 - 0312 394 37 54&nbsp;&nbsp;
            <strong>Gsm:</strong> 0549 629 19 04&nbsp;&nbsp;
            <strong>Fax:</strong> 0312 394 37 19
          </p>
          <p className="text-[8px] text-gray-600">www.ugursupompalari.com.tr</p>
        </div>

      </div>{/* /A4 */}

      {/* ── Alt aksiyon çubuğu ── */}
      <div className="flex justify-end gap-3 mt-5">
        {error && <p className="text-red-500 text-sm self-center">{error}</p>}
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          İptal
        </button>
        <button type="button" onClick={() => handleSubmit(false)} disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
          Kaydet
        </button>
        <button type="button" onClick={() => handleSubmit(true)} disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-[#1e40af] text-white text-sm font-semibold flex items-center gap-2 hover:bg-blue-900 disabled:opacity-50 transition">
          {submitting
            ? <><Loader2 size={15} className="animate-spin" /> Kaydediliyor...</>
            : <><Download size={15} /> Kaydet & PDF İndir</>}
        </button>
      </div>
    </div>
  );
}
