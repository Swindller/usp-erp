import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER"];

// SGK için son ödeme tarihi: bir sonraki ayın 23'ü
// Muhtasar için son ödeme tarihi: bir sonraki ayın 23'ü
// KDV için: bir sonraki ayın 26'sı
function dueDate(year: number, month: number, day: number): string {
  // month = 1-12, bir sonraki ay
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12)
    return NextResponse.json({ error: "Geçersiz yıl/ay" }, { status: 400 });

  // O aya ait tüm bordro kayıtlarını çek
  const payrolls = await prisma.payroll.findMany({
    where: { year, month },
    select: {
      grossSalary:    true,
      baseSalary:     true,
      sgkEmployee:    true,
      unemploymentEmp:true,
      incomeTax:      true,
      stampTax:       true,
      sgkEmployer:    true,
      unemploymentEmp2: true,
      absenceDays:    true,
    },
  });

  if (payrolls.length === 0) {
    return NextResponse.json({
      year, month,
      payrollCount: 0,
      sgkPrim:  null,
      muhtasar: null,
      message: `${month}/${year} için bordro kaydı bulunamadı`,
    });
  }

  const n = (v: unknown) => Number(v ?? 0);

  // SGK Primi = işçi payı + işveren payı (toplamı SGK'ya yatırılır)
  const sgkIscipay    = payrolls.reduce((s, p) => s + n(p.sgkEmployee) + n(p.unemploymentEmp), 0);
  const sgkIsverenPay = payrolls.reduce((s, p) => s + n(p.sgkEmployer) + n(p.unemploymentEmp2), 0);
  const sgkTotal      = sgkIscipay + sgkIsverenPay;

  // Muhtasar = gelir vergisi stopajı + damga vergisi
  const incomeTaxTotal = payrolls.reduce((s, p) => s + n(p.incomeTax), 0);
  const stampTaxTotal  = payrolls.reduce((s, p) => s + n(p.stampTax), 0);
  const muhtasarTotal  = incomeTaxTotal + stampTaxTotal;

  // Brüt maaş toplamı (matrah)
  const grossTotal = payrolls.reduce((s, p) => s + n(p.grossSalary), 0);

  return NextResponse.json({
    year,
    month,
    payrollCount: payrolls.length,
    sgkPrim: {
      baseAmount: Math.round(grossTotal   * 100) / 100,
      taxAmount:  Math.round(sgkTotal     * 100) / 100,
      detail: {
        sgkIsci:    Math.round(sgkIscipay    * 100) / 100,
        sgkIsveren: Math.round(sgkIsverenPay * 100) / 100,
      },
      dueDate: dueDate(year, month, 23),
    },
    muhtasar: {
      baseAmount: Math.round(grossTotal    * 100) / 100,
      taxAmount:  Math.round(muhtasarTotal * 100) / 100,
      detail: {
        incomeTax: Math.round(incomeTaxTotal * 100) / 100,
        stampTax:  Math.round(stampTaxTotal  * 100) / 100,
      },
      dueDate: dueDate(year, month, 23),
    },
  });
}
