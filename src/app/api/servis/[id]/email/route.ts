import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Servise Geldi",
  DIAGNOSING: "İnceleniyor",
  DIAGNOSED: "Tespit Yapıldı",
  WAITING_PARTS: "Parça Bekliyor",
  IN_REPAIR: "Montaj Yapılıyor",
  QUALITY_CHECK: "Test Ediliyor",
  READY: "Teslime Hazır",
  DELIVERED: "Teslim Edildi",
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const report = await prisma.serviceReport.findUnique({
    where: { id },
    include: {
      customer: true,
      technician: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  if (!report) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const customerEmail = report.customer.email;
  if (!customerEmail)
    return NextResponse.json({ error: "Müşterinin e-posta adresi yok" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "E-posta servisi yapılandırılmamış (RESEND_API_KEY eksik)" }, { status: 503 });

  const fromEmail = process.env.FROM_EMAIL || "servis@ugursupompalari.com.tr";

  const cName = report.customer.type === "CORPORATE"
    ? report.customer.companyName || "Müşteri"
    : [report.customer.firstName, report.customer.lastName].filter(Boolean).join(" ") || "Müşteri";

  const techName = report.technician
    ? [report.technician.user.firstName, report.technician.user.lastName].filter(Boolean).join(" ")
    : "—";

  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Servis Raporu</title></head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #1e40af; color: white; padding: 24px;">
      <h1 style="margin: 0; font-size: 20px;">UĞUR SU POMPALARI</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Teknik Servis Raporu</p>
    </div>
    <div style="padding: 24px;">
      <p style="color: #374151; margin-top: 0;">Sayın <strong>${cName}</strong>,</p>
      <p style="color: #374151;">Ürününüzün servis durumu hakkında sizi bilgilendirmek istiyoruz.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a; width: 40%;">Rapor No</td>
          <td style="padding: 10px 12px; color: #111827;">${report.reportNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Ürün Durumu</td>
          <td style="padding: 10px 12px; color: #111827;"><strong style="color: #1e40af;">${STATUS_LABELS[report.status] || report.status}</strong></td>
        </tr>
        ${report.deviceBrand || report.deviceModel ? `
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Cihaz</td>
          <td style="padding: 10px 12px; color: #111827;">${[report.deviceBrand, report.deviceModel].filter(Boolean).join(" ")}</td>
        </tr>` : ""}
        ${report.deviceSerial ? `
        <tr>
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Seri No</td>
          <td style="padding: 10px 12px; color: #111827;">${report.deviceSerial}</td>
        </tr>` : ""}
        ${report.diagnosis ? `
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Tespit</td>
          <td style="padding: 10px 12px; color: #111827;">${report.diagnosis.replace(/\n/g, "<br>")}</td>
        </tr>` : ""}
        ${report.estimatedCompletionDate ? `
        <tr>
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Tahmini Tamamlanma</td>
          <td style="padding: 10px 12px; color: #111827;">${fmtDate(report.estimatedCompletionDate)}</td>
        </tr>` : ""}
        ${report.estimatedDate ? `
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Tahmini Teslim</td>
          <td style="padding: 10px 12px; color: #111827;">${fmtDate(report.estimatedDate)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Teknisyen</td>
          <td style="padding: 10px 12px; color: #111827;">${techName}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e3a8a;">Garanti</td>
          <td style="padding: 10px 12px; color: #111827;">${report.isWarranty ? "✅ Garantili" : "Garanti Dışı"}</td>
        </tr>
      </table>

      ${report.customerNote ? `
      <div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
        <p style="margin: 0; color: #1e3a8a; font-weight: 600; font-size: 13px;">Teknisyen Notu</p>
        <p style="margin: 6px 0 0; color: #374151; font-size: 14px;">${report.customerNote}</p>
      </div>` : ""}

      <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Sorularınız için bizi arayabilirsiniz:<br>
      <strong>0549 629 19 12</strong> (Arıza İhbar Hattı)</p>
    </div>
    <div style="background: #1e3a8a; color: #93c5fd; padding: 16px 24px; font-size: 11px; text-align: center;">
      Altay Mah. Söğüt Cad. No:8DA Eryaman / Etimesgut / ANKARA<br>
      Tel: 0312 394 37 52 · www.ugursupompalari.com.tr
    </div>
  </div>
</body>
</html>`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: customerEmail,
      subject: `Servis Raporunuz - ${report.reportNumber} | ${STATUS_LABELS[report.status] || report.status}`,
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error("[email] Resend hatası:", errText);
    return NextResponse.json({ error: "E-posta gönderilemedi" }, { status: 502 });
  }

  // Log
  const personnelRecord = await prisma.personnel.findFirst({ where: { user: { email: user.email } } });
  await prisma.serviceLog.create({
    data: {
      serviceReportId: id,
      type: "CUSTOMER_CONTACT",
      description: `Durum e-postası gönderildi → ${customerEmail}`,
      personnelId: personnelRecord?.id,
    },
  });

  return NextResponse.json({ ok: true });
}
