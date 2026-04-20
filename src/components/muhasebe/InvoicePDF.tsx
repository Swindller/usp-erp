import path from "path";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";

// ── Noto Sans (Unicode – Turkish chars + ₺) ────────────────────────────────
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});

const blue        = "#1e40af";
const darkBlue    = "#1e3a8a";
const lightGray   = "#f3f4f6";
const borderColor = "#9ca3af";
const gray        = "#6b7280";
const black       = "#000000";
const green       = "#166534";

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSans", fontWeight: 400,
    fontSize: 8, color: black,
    padding: "18 22 22 22", backgroundColor: "#ffffff",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  logoTitle:   { fontSize: 14, fontWeight: 700, color: blue, letterSpacing: 0.5 },
  logoSub:     { fontSize: 6.5, color: darkBlue, marginTop: 2 },
  logoCompany: { fontSize: 6, color: gray, marginTop: 1 },
  invBox:      { alignItems: "flex-end", borderWidth: 1.5, borderColor: blue, padding: "5 10", borderRadius: 3, minWidth: 130 },
  invTitle:    { fontSize: 12, fontWeight: 700, color: blue },
  invNumber:   { fontSize: 8, fontWeight: 700, color: darkBlue, marginTop: 2 },
  invDate:     { fontSize: 7, color: gray, marginTop: 1 },

  // ── Two-column card ───────────────────────────────────────────────────────
  cards:       { flexDirection: "row", gap: 8, marginBottom: 8 },
  card:        { flex: 1, border: 1, borderColor: borderColor, borderRadius: 2, padding: "5 7" },
  cardTitle:   { fontSize: 7, fontWeight: 700, color: blue, textTransform: "uppercase", marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: borderColor, paddingBottom: 2 },
  cardRow:     { flexDirection: "row", marginBottom: 2 },
  cardLabel:   { fontSize: 6.5, color: gray, width: 60 },
  cardValue:   { fontSize: 7, color: black, flex: 1 },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableTitle:  { fontSize: 8, fontWeight: 700, color: blue, marginBottom: 3 },
  table:       { border: 1, borderColor: borderColor, marginBottom: 8 },
  thead:       { flexDirection: "row", backgroundColor: blue },
  th:          { padding: "3 5", justifyContent: "center" },
  thText:      { fontSize: 7.5, fontWeight: 700, color: "#ffffff" },
  trow:        { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: borderColor },
  trowAlt:     { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: borderColor, backgroundColor: lightGray },
  td:          { padding: "3 5", justifyContent: "center" },
  tdText:      { fontSize: 7.5, color: black },

  // ── Totals ────────────────────────────────────────────────────────────────
  totals:      { alignItems: "flex-end", marginBottom: 8 },
  totalRow:    { flexDirection: "row", marginBottom: 2 },
  totalLabel:  { fontSize: 7.5, color: gray, width: 100, textAlign: "right", marginRight: 8 },
  totalValue:  { fontSize: 7.5, color: black, width: 80, textAlign: "right" },
  grandLabel:  { fontSize: 9, fontWeight: 700, color: blue, width: 100, textAlign: "right", marginRight: 8 },
  grandValue:  { fontSize: 9, fontWeight: 700, color: blue, width: 80, textAlign: "right" },
  paidRow:     { flexDirection: "row", marginTop: 2 },
  paidLabel:   { fontSize: 7.5, color: green, width: 100, textAlign: "right", marginRight: 8 },
  paidValue:   { fontSize: 7.5, color: green, width: 80, textAlign: "right" },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notesBox:    { border: 1, borderColor: borderColor, borderRadius: 2, padding: "5 7", marginBottom: 8 },
  notesTitle:  { fontSize: 7, fontWeight: 700, color: gray, marginBottom: 3 },
  notesText:   { fontSize: 7.5, color: black },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer:      { borderTopWidth: 0.5, borderTopColor: borderColor, paddingTop: 5, marginTop: "auto" },
  footerText:  { fontSize: 6, color: gray, textAlign: "center" },
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  lineTotal?: number;
}

export interface InvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    invoiceDate: string | Date;
    dueDate?: string | Date | null;
    status: string;
    subtotal: number | string;
    vatRate: number | string;
    vatAmount: number | string;
    total: number | string;
    paidAmount?: number | string;
    lineItems: LineItem[];
    notes?: string | null;
    customerSnapshot?: {
      name?: string | null;
      phone?: string | null;
      taxNumber?: string | null;
      taxOffice?: string | null;
      address?: string | null;
    } | null;
    customer?: {
      type: string;
      firstName?: string | null;
      lastName?: string | null;
      companyName?: string | null;
      phone: string;
      email?: string | null;
      taxNumber?: string | null;
      taxOffice?: string | null;
      address?: string | null;
    } | null;
    serviceReport?: { reportNumber: string } | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTL(v: number | string) {
  const n = parseFloat(String(v)) || 0;
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  SENT: "Gönderildi",
  PAID: "Ödendi",
  PARTIALLY_PAID: "Kısmi Ödeme",
  OVERDUE: "Vadesi Geçti",
  CANCELLED: "İptal",
};

// ── Component ─────────────────────────────────────────────────────────────────
export function InvoicePDF({ invoice }: InvoicePDFProps) {
  // Müşteri adı: snapshot > live customer
  const snap = invoice.customerSnapshot;
  const cust = invoice.customer;
  let customerName = "—";
  let phone = "—";
  let taxNumber: string | null = null;
  let taxOffice: string | null = null;
  let address: string | null = null;

  if (snap?.name) {
    customerName = snap.name;
    phone = snap.phone ?? "—";
    taxNumber = snap.taxNumber ?? null;
    taxOffice = snap.taxOffice ?? null;
    address = snap.address ?? null;
  } else if (cust) {
    customerName = cust.type === "CORPORATE"
      ? (cust.companyName ?? "Kurumsal")
      : [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "İsimsiz";
    phone = cust.phone;
    taxNumber = cust.taxNumber ?? null;
    taxOffice = cust.taxOffice ?? null;
    address = cust.address ?? null;
  }

  const subtotal   = parseFloat(String(invoice.subtotal)) || 0;
  const vatAmount  = parseFloat(String(invoice.vatAmount)) || 0;
  const total      = parseFloat(String(invoice.total)) || 0;
  const paidAmount = parseFloat(String(invoice.paidAmount ?? 0)) || 0;
  const remaining  = total - paidAmount;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logoTitle}>USP TEKNİK SERVİS</Text>
            <Text style={s.logoSub}>Pompa ve Su Sistemleri Servis Merkezi</Text>
            <Text style={s.logoCompany}>Grundfos Yetkili Servis</Text>
          </View>
          <View style={s.invBox}>
            <Text style={s.invTitle}>FATURA</Text>
            <Text style={s.invNumber}>{invoice.invoiceNumber}</Text>
            <Text style={s.invDate}>Tarih: {fmtDate(invoice.invoiceDate)}</Text>
            {invoice.dueDate && <Text style={s.invDate}>Vade: {fmtDate(invoice.dueDate)}</Text>}
            <Text style={[s.invDate, { marginTop: 3, color: blue, fontWeight: 700 }]}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </Text>
          </View>
        </View>

        {/* ── Müşteri + Fatura bilgileri ── */}
        <View style={s.cards}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Müşteri Bilgileri</Text>
            <View style={s.cardRow}><Text style={s.cardLabel}>Ad / Unvan:</Text><Text style={s.cardValue}>{customerName}</Text></View>
            <View style={s.cardRow}><Text style={s.cardLabel}>Telefon:</Text><Text style={s.cardValue}>{phone}</Text></View>
            {taxNumber && <View style={s.cardRow}><Text style={s.cardLabel}>Vergi No:</Text><Text style={s.cardValue}>{taxNumber}</Text></View>}
            {taxOffice && <View style={s.cardRow}><Text style={s.cardLabel}>Vergi D.:</Text><Text style={s.cardValue}>{taxOffice}</Text></View>}
            {address && <View style={s.cardRow}><Text style={s.cardLabel}>Adres:</Text><Text style={s.cardValue}>{address}</Text></View>}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Fatura Detayı</Text>
            <View style={s.cardRow}><Text style={s.cardLabel}>Fatura No:</Text><Text style={s.cardValue}>{invoice.invoiceNumber}</Text></View>
            <View style={s.cardRow}><Text style={s.cardLabel}>Tarih:</Text><Text style={s.cardValue}>{fmtDate(invoice.invoiceDate)}</Text></View>
            {invoice.dueDate && <View style={s.cardRow}><Text style={s.cardLabel}>Vade:</Text><Text style={s.cardValue}>{fmtDate(invoice.dueDate)}</Text></View>}
            {invoice.serviceReport && (
              <View style={s.cardRow}><Text style={s.cardLabel}>Servis Raporu:</Text><Text style={s.cardValue}>{invoice.serviceReport.reportNumber}</Text></View>
            )}
            <View style={s.cardRow}><Text style={s.cardLabel}>Durum:</Text><Text style={s.cardValue}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Text></View>
          </View>
        </View>

        {/* ── Kalemler ── */}
        <Text style={s.tableTitle}>Fatura Kalemleri</Text>
        <View style={s.table}>
          <View style={s.thead}>
            <View style={[s.th, { flex: 4 }]}><Text style={s.thText}>Açıklama</Text></View>
            <View style={[s.th, { flex: 1, borderLeftWidth: 0.5, borderLeftColor: "#ffffff" }]}><Text style={[s.thText, { textAlign: "center" }]}>Adet</Text></View>
            <View style={[s.th, { flex: 1.5, borderLeftWidth: 0.5, borderLeftColor: "#ffffff" }]}><Text style={[s.thText, { textAlign: "right" }]}>Birim Fiyat</Text></View>
            <View style={[s.th, { flex: 1, borderLeftWidth: 0.5, borderLeftColor: "#ffffff" }]}><Text style={[s.thText, { textAlign: "center" }]}>KDV%</Text></View>
            <View style={[s.th, { flex: 1.5, borderLeftWidth: 0.5, borderLeftColor: "#ffffff" }]}><Text style={[s.thText, { textAlign: "right" }]}>Toplam</Text></View>
          </View>
          {(invoice.lineItems ?? []).map((line, i) => {
            const lineTotal = line.lineTotal ?? (line.qty * line.unitPrice);
            const isAlt = i % 2 === 1;
            return (
              <View key={i} style={isAlt ? s.trowAlt : s.trow}>
                <View style={[s.td, { flex: 4 }]}><Text style={s.tdText}>{line.description}</Text></View>
                <View style={[s.td, { flex: 1, borderLeftWidth: 0.5, borderLeftColor: borderColor }]}><Text style={[s.tdText, { textAlign: "center" }]}>{line.qty}</Text></View>
                <View style={[s.td, { flex: 1.5, borderLeftWidth: 0.5, borderLeftColor: borderColor }]}><Text style={[s.tdText, { textAlign: "right" }]}>{fmtTL(line.unitPrice)}</Text></View>
                <View style={[s.td, { flex: 1, borderLeftWidth: 0.5, borderLeftColor: borderColor }]}><Text style={[s.tdText, { textAlign: "center" }]}>%{line.vatRate}</Text></View>
                <View style={[s.td, { flex: 1.5, borderLeftWidth: 0.5, borderLeftColor: borderColor }]}><Text style={[s.tdText, { textAlign: "right" }]}>{fmtTL(lineTotal)}</Text></View>
              </View>
            );
          })}
        </View>

        {/* ── Toplamlar ── */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Ara Toplam:</Text>
            <Text style={s.totalValue}>{fmtTL(subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>KDV:</Text>
            <Text style={s.totalValue}>{fmtTL(vatAmount)}</Text>
          </View>
          <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: blue, paddingTop: 3, marginTop: 2 }]}>
            <Text style={s.grandLabel}>GENEL TOPLAM:</Text>
            <Text style={s.grandValue}>{fmtTL(total)}</Text>
          </View>
          {paidAmount > 0 && (
            <>
              <View style={s.paidRow}>
                <Text style={s.paidLabel}>Ödenen:</Text>
                <Text style={s.paidValue}>{fmtTL(paidAmount)}</Text>
              </View>
              {remaining > 0 && (
                <View style={s.paidRow}>
                  <Text style={[s.paidLabel, { color: "#dc2626" }]}>Kalan:</Text>
                  <Text style={[s.paidValue, { color: "#dc2626" }]}>{fmtTL(remaining)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Notlar ── */}
        {invoice.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesTitle}>NOTLAR</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            USP Teknik Servis · Grundfos Yetkili Servis Merkezi · Bu belge elektronik ortamda oluşturulmuştur.
          </Text>
        </View>

      </Page>
    </Document>
  );
}
