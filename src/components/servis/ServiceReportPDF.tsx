import {
  Document, Page, Text, View, StyleSheet, Image, Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [],
});

const blue = "#1e40af";
const darkBlue = "#1e3a8a";
const lightBlue = "#dbeafe";
const black = "#000000";
const gray = "#6b7280";
const lightGray = "#f3f4f6";
const borderColor = "#9ca3af";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 7.5, color: black, padding: "14 18 18 18", backgroundColor: "#ffffff" },

  // ── Header ──────────────────────────────────────────────────────
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  logoBox: { flexDirection: "column" },
  logoTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: blue, letterSpacing: 1 },
  logoSub: { fontSize: 6.5, color: darkBlue, marginTop: 1 },
  logoCompany: { fontSize: 6, color: gray, marginTop: 1 },

  rightBox: { alignItems: "flex-end", borderWidth: 1, borderColor: blue, padding: "4 8", borderRadius: 3 },
  grundfosTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: blue },
  grundfosLine: { fontSize: 6, color: gray },
  hotline: { fontSize: 11, fontFamily: "Helvetica-Bold", color: darkBlue, marginTop: 2 },

  // ── Section header ───────────────────────────────────────────────
  sectionHeader: { backgroundColor: blue, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7.5, padding: "2 4", marginTop: 5 },

  // ── Table helpers ────────────────────────────────────────────────
  table: { border: 1, borderColor: borderColor, marginTop: 0 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: borderColor, minHeight: 14 },
  rowLast: { flexDirection: "row", minHeight: 14 },
  cell: { borderRightWidth: 1, borderRightColor: borderColor, padding: "2 3", justifyContent: "center" },
  cellLast: { padding: "2 3", justifyContent: "center" },
  label: { fontFamily: "Helvetica-Bold", fontSize: 7, color: darkBlue },
  value: { fontSize: 7.5, color: black, marginTop: 1 },
  headerCell: { backgroundColor: blue, padding: "3 4", justifyContent: "center" },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: "#ffffff" },

  // ── Checkbox ─────────────────────────────────────────────────────
  checkRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  checkBox: { width: 8, height: 8, border: "1 solid #374151", borderRadius: 1 },
  checkBoxFilled: { width: 8, height: 8, backgroundColor: blue, borderRadius: 1 },
  checkLabel: { fontSize: 7 },

  // ── Footer ───────────────────────────────────────────────────────
  footer: { marginTop: 8, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 4 },
  footerText: { fontSize: 6, color: gray, textAlign: "center" },
  footerBold: { fontFamily: "Helvetica-Bold" },

  // ── Signature area ───────────────────────────────────────────────
  signArea: { flexDirection: "row", marginTop: 4, border: 1, borderColor: borderColor },
  signCell: { flex: 1, padding: "4 6", borderRightWidth: 1, borderRightColor: borderColor },
  signCellLast: { flex: 1, padding: "4 6" },
  signTitle: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: darkBlue, marginBottom: 3 },
  signField: { fontSize: 7, color: black, marginBottom: 2 },
  signImg: { width: 90, height: 36, marginTop: 4 },
});

interface ReportPDFProps {
  report: {
    reportNumber: string;
    serviceType: string;
    status: string;
    isWarranty: boolean;
    complaint: string;
    diagnosis: string | null;
    operations: string | null;
    internalNotes: string | null;
    laborCost: string | null;
    partsCost: string | null;
    totalCost: string | null;
    receivedAt: string | Date;
    completedAt: string | Date | null;
    deviceBrand: string | null;
    deviceModel: string | null;
    deviceSerial: string | null;
    deviceYear: number | null;
    devicePower: string | null;
    customerSignature: string | null;
    technicianSignature: string | null;
    partsUsed: { productId: string; name: string; qty: number; unitPrice: number }[] | null;
    customer: {
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
    technician: {
      user: { firstName: string | null; lastName: string | null };
    } | null;
  };
}

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.checkItem}>
      <View style={checked ? s.checkBoxFilled : s.checkBox}>
        {checked && <Text style={{ fontSize: 5.5, color: "#fff", textAlign: "center", lineHeight: 1.4 }}>✓</Text>}
      </View>
      <Text style={s.checkLabel}>{label}</Text>
    </View>
  );
}

function splitLines(text: string | null, max = 9): string[] {
  if (!text) return [];
  return text.split(/\n|;/).map((l) => l.trim()).filter(Boolean).slice(0, max);
}

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function customerName(c: ReportPDFProps["report"]["customer"]) {
  if (c.type === "CORPORATE") return c.companyName || "—";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  WORKSHOP: "Atölye", FIELD: "Saha", WARRANTY: "Garanti", PERIODIC: "Periyodik",
};

export function ServiceReportPDF({ report }: ReportPDFProps) {
  const c = report.customer;
  const diagnoses = splitLines(report.diagnosis);
  const operations = splitLines(report.operations);
  const parts = report.partsUsed ?? [];
  const techName = report.technician
    ? [report.technician.user.firstName, report.technician.user.lastName].filter(Boolean).join(" ")
    : "—";

  // Status checkboxes
  const statuses = [
    { key: "RECEIVED", label: "Sıra Bekliyor" },
    { key: "DIAGNOSING", label: "Serviste Onaylanıyor" },
    { key: "WAITING_PARTS", label: "Parça Bekliyor" },
    { key: "IN_REPAIR", label: "Onarımda" },
    { key: "QUALITY_CHECK", label: "Kontrol Aşamasında" },
    { key: "READY", label: "Hazır" },
    { key: "DELIVERED", label: "Teslim Edildi" },
    { key: "CANCELLED", label: "İptal" },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoTitle}>UĞUR SU POMPALARI</Text>
            <Text style={s.logoSub}>ELEKTRİK İNŞAAT TARIM HAYVANCILIK SAN. VE TİC. LTD. ŞTİ.</Text>
            <Text style={s.logoCompany}>Grundfos İç Anadolu Bölgesi Yetkili Servisi</Text>
          </View>
          <View style={s.rightBox}>
            <Text style={s.grundfosTitle}>DENETİMLİ GRUNDFOS YETKİLİ SERVİSİ</Text>
            <Text style={s.grundfosLine}>servis@ugursupompalari.com.tr</Text>
            <Text style={s.hotline}>Arıza İhbar: 0549 629 19 12</Text>
          </View>
        </View>

        {/* ── Doküman bilgileri ── */}
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.cell, { flex: 3 }]}>
              <Text style={s.label}>Teknik Servis Raporu</Text>
            </View>
            <View style={[s.cell, { flex: 2 }]}>
              <Text style={s.label}>Doküman No: <Text style={s.value}>{report.reportNumber}</Text></Text>
            </View>
            <View style={[s.cell, { flex: 1.5 }]}>
              <Text style={s.label}>Revizyon No: <Text style={s.value}>00</Text></Text>
            </View>
            <View style={[s.cellLast, { flex: 2 }]}>
              <Text style={s.label}>Yayın Tarihi: <Text style={s.value}>{fmtDate(report.receivedAt)}</Text></Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, { flex: 4 }]}>
              <Text style={s.label}>Servis İsteğinin İletim Şekli: <Text style={s.value}>{SERVICE_TYPE_LABELS[report.serviceType] ?? report.serviceType}</Text></Text>
            </View>
            <View style={[s.cellLast, { flex: 4.5 }]}>
              <Text style={s.label}>Tarih (G - Giriş): <Text style={s.value}>{fmtDate(report.receivedAt)}</Text></Text>
            </View>
          </View>
        </View>

        {/* ── Müşteri bilgileri ── */}
        <Text style={s.sectionHeader}>MÜŞTERİ BİLGİLERİ</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Adı / Projesi</Text>
              <Text style={s.value}>{customerName(c)}</Text>
            </View>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>Tarih (Ç - Çıkış)</Text>
              <Text style={s.value}>{fmtDate(report.completedAt)}</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Adres</Text>
              <Text style={s.value}>{[c.address, c.district, c.city].filter(Boolean).join(", ") || "—"}</Text>
            </View>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>Telefon</Text>
              <Text style={s.value}>{c.phone}</Text>
            </View>
          </View>
          <View style={s.rowLast}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Vergi Dairesi</Text>
              <Text style={s.value}>{c.taxOffice || "—"}</Text>
            </View>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>E-Mail</Text>
              <Text style={s.value}>{c.email || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── Arızalı ürün ── */}
        <Text style={s.sectionHeader}>ARIZALI ÜRÜN BİLGİLERİ</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Ürün No / Markası</Text>
              <Text style={s.value}>{report.deviceBrand || "—"}</Text>
            </View>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>Modeli</Text>
              <Text style={s.value}>{report.deviceModel || "—"}</Text>
            </View>
          </View>
          <View style={s.rowLast}>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Seri No</Text>
              <Text style={s.value}>{report.deviceSerial || "—"}</Text>
            </View>
            <View style={[s.cell, { flex: 1 }]}>
              <Text style={s.label}>Üretim Tarihi / Yılı</Text>
              <Text style={s.value}>{report.deviceYear ? String(report.deviceYear) : "—"}</Text>
            </View>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>Güç / Gerilim</Text>
              <Text style={s.value}>{[report.devicePower, report.devicePower].filter(Boolean).join(" / ") || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── Not ── */}
        <View style={{ backgroundColor: lightGray, padding: "4 6", marginTop: 4, borderRadius: 2 }}>
          <Text style={{ fontSize: 6.5, color: gray, fontFamily: "Helvetica-BoldOblique" }}>
            ( Bu Kısım UĞUR SU POMPALARI LTD. ŞTİ. Tarafından Doldurulacaktır. Arızanın Meydana Gelmesi ve Yapılacak İşlemler Kısaca Belirtilecektir. )
          </Text>
        </View>

        {/* ── Müşteri şikayeti ── */}
        <View style={[s.table, { marginTop: 4 }]}>
          <View style={s.rowLast}>
            <View style={[s.cellLast, { flex: 1 }]}>
              <Text style={s.label}>Müşteri Şikayeti</Text>
              <Text style={[s.value, { marginTop: 2 }]}>{report.complaint || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── Tespit / Yapılacak ── */}
        <View style={[s.table, { marginTop: 4 }]}>
          <View style={s.row}>
            <View style={[s.headerCell, { flex: 1 }]}>
              <Text style={s.headerText}>Tespit Edilen Arızalar</Text>
            </View>
            <View style={[s.headerCell, { flex: 1, borderLeftWidth: 1, borderLeftColor: "#fff" }]}>
              <Text style={s.headerText}>Yapılacak İşler</Text>
            </View>
          </View>
          {Array.from({ length: 9 }).map((_, i) => {
            const diag = diagnoses[i] ?? "";
            const op = operations[i] ?? "";
            const isLast = i === 8;
            return (
              <View key={i} style={isLast ? s.rowLast : s.row}>
                <View style={[s.cell, { flex: 1, minHeight: 13 }]}>
                  <Text style={s.value}>{i + 1}: {diag}</Text>
                </View>
                <View style={[s.cellLast, { flex: 1, minHeight: 13 }]}>
                  <Text style={s.value}>{i + 1}: {op}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Kişisel Düşünceler ── */}
        {report.internalNotes && (
          <View style={[s.table, { marginTop: 4 }]}>
            <View style={s.rowLast}>
              <View style={[s.cellLast, { flex: 1, minHeight: 18 }]}>
                <Text style={s.label}>Kişisel Düşünceler / Notlar</Text>
                <Text style={[s.value, { marginTop: 2 }]}>{report.internalNotes}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Durum / Bakım / Müdahale ── */}
        <View style={[s.table, { marginTop: 4 }]}>
          <View style={s.row}>
            <View style={[s.headerCell, { flex: 1.5 }]}>
              <Text style={s.headerText}>Ürünün Durumu</Text>
            </View>
            <View style={[s.headerCell, { flex: 1, borderLeftWidth: 1, borderLeftColor: "#ffffff40" }]}>
              <Text style={s.headerText}>Bakım Şekli</Text>
            </View>
            <View style={[s.headerCell, { flex: 1, borderLeftWidth: 1, borderLeftColor: "#ffffff40" }]}>
              <Text style={s.headerText}>Müdahale Yeri</Text>
            </View>
          </View>
          <View style={s.rowLast}>
            <View style={[s.cell, { flex: 1.5, padding: "4 6" }]}>
              <View style={s.checkRow}>
                {statuses.map((st) => (
                  <Checkbox key={st.key} checked={report.status === st.key} label={st.label} />
                ))}
              </View>
            </View>
            <View style={[s.cell, { flex: 1, padding: "4 6" }]}>
              <View style={s.checkRow}>
                <Checkbox checked={report.isWarranty} label="Garantili" />
                <Checkbox checked={!report.isWarranty} label="Garanti Dışı" />
              </View>
            </View>
            <View style={[s.cellLast, { flex: 1, padding: "4 6" }]}>
              <View style={s.checkRow}>
                <Checkbox checked={report.serviceType === "FIELD"} label="Yerinde" />
                <Checkbox checked={report.serviceType !== "FIELD"} label="Serviste" />
              </View>
            </View>
          </View>
        </View>

        {/* ── Kullanılan Malzemeler ── */}
        <Text style={s.sectionHeader}>KULLANILAN MALZEMELER</Text>
        <View style={s.table}>
          <View style={s.row}>
            <View style={[s.headerCell, { flex: 1 }]}><Text style={s.headerText}>Kodu</Text></View>
            <View style={[s.headerCell, { flex: 3, borderLeftWidth: 1, borderLeftColor: "#ffffff40" }]}><Text style={s.headerText}>Adı</Text></View>
            <View style={[s.headerCell, { flex: 1.5, borderLeftWidth: 1, borderLeftColor: "#ffffff40" }]}><Text style={s.headerText}>Bedeli (KDV Hariç)</Text></View>
          </View>
          {Array.from({ length: 5 }).map((_, i) => {
            const part = parts[i];
            const isLast = i === 4;
            return (
              <View key={i} style={isLast ? s.rowLast : s.row}>
                <View style={[s.cell, { flex: 1, minHeight: 12 }]}>
                  <Text style={s.value}>{i + 1}: {part ? (part.productId?.slice(0, 8) || "—") : ""}</Text>
                </View>
                <View style={[s.cell, { flex: 3, minHeight: 12 }]}>
                  <Text style={s.value}>{part?.name ?? ""}</Text>
                </View>
                <View style={[s.cellLast, { flex: 1.5, minHeight: 12 }]}>
                  <Text style={s.value}>{part ? `₺${(part.qty * part.unitPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : ""}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Ödeme Şekli ── */}
        <View style={[s.table, { marginTop: 4 }]}>
          <View style={s.rowLast}>
            <View style={[s.cell, { flex: 1, padding: "4 6" }]}>
              <Text style={s.label}>Ödeme Şekli: (KDV Hariç)</Text>
              <View style={[s.checkRow, { marginTop: 4 }]}>
                <Checkbox checked={false} label="Nakit" />
                <Checkbox checked={false} label="Havale" />
                <Checkbox checked={false} label="Cari" />
                <Checkbox checked={false} label="Fatura" />
                <Checkbox checked={false} label="Çek" />
              </View>
            </View>
            <View style={[s.cellLast, { flex: 1, padding: "4 6" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.label}>İşçilik: <Text style={s.value}>{report.laborCost ? `₺${parseFloat(report.laborCost).toLocaleString("tr-TR")}` : "—"}</Text></Text>
                <Text style={s.label}>Parça: <Text style={s.value}>{report.partsCost ? `₺${parseFloat(report.partsCost).toLocaleString("tr-TR")}` : "—"}</Text></Text>
                <Text style={[s.label, { color: blue }]}>Toplam: <Text style={[s.value, { fontFamily: "Helvetica-Bold", color: blue }]}>{report.totalCost ? `₺${parseFloat(report.totalCost).toLocaleString("tr-TR")}` : "—"}</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── İmzalar ── */}
        <View style={s.signArea}>
          <View style={s.signCell}>
            <Text style={s.signTitle}>Düzenleyen (Teknisyen)</Text>
            <Text style={s.signField}>Adı ve Soyadı: {techName}</Text>
            <Text style={s.signField}>Görevi: Teknik Servis Uzmanı</Text>
            <Text style={s.signField}>Onay:</Text>
            <Text style={[s.signField, { marginTop: 2 }]}>İmza:</Text>
            {report.technicianSignature && (
              <Image src={report.technicianSignature} style={s.signImg} />
            )}
          </View>
          <View style={s.signCellLast}>
            <Text style={s.signTitle}>Müşteri Onayı</Text>
            <Text style={s.signField}>Adı ve Soyadı: {customerName(c)}</Text>
            <Text style={s.signField}>Görevi:</Text>
            <Text style={s.signField}>Onay:</Text>
            <Text style={[s.signField, { marginTop: 2 }]}>İmza:</Text>
            {report.customerSignature && (
              <Image src={report.customerSignature} style={s.signImg} />
            )}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            <Text style={s.footerBold}>Merkez: </Text>
            Altay Mahallesi Söğüt Caddesi No:8DA A Blok Dükkan No: 2 Eryaman / Etimesgut / ANKARA
          </Text>
          <Text style={s.footerText}>
            <Text style={s.footerBold}>Tel: </Text>0312 394 37 52 - 0312 394 37 54   <Text style={s.footerBold}>Gsm: </Text>0549 629 19 04   <Text style={s.footerBold}>Fax: </Text>0312 394 37 19
          </Text>
          <Text style={s.footerText}>www.ugursupompalari.com.tr</Text>
        </View>

      </Page>
    </Document>
  );
}
