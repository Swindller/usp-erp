import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "TECHNICIAN"];
type ItType = "telefonlar" | "bilgisayarlar" | "yazicilar" | "kameralar" | "switchler";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } },
  alignment: { horizontal: "center", vertical: "middle" },
  border: {
    bottom: { style: "thin", color: { argb: "FFBFDBFE" } },
    right:  { style: "thin", color: { argb: "FFBFDBFE" } },
  },
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => { Object.assign(cell, HEADER_STYLE); });
  sheet.getRow(1).height = 22;
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  });
}

function stripeRows(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, rowNum) => {
    if (rowNum < 2) return;
    if (rowNum % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FF" } };
      });
    }
  });
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !ALLOWED_ROLES.includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "telefonlar") as ItType;

  const wb = new ExcelJS.Workbook();
  wb.creator  = "USP ERP";
  wb.created  = new Date();
  wb.modified = new Date();

  if (type === "telefonlar") {
    const data = await prisma.itPhone.findMany({ orderBy: { siraNo: "asc" } });
    const ws = wb.addWorksheet("Telefonlar");
    ws.columns = [
      { header: "S.No",          key: "siraNo",       },
      { header: "GSM Numarası",  key: "gsmNumara",     },
      { header: "Kısa Kod",      key: "kisaKod",       },
      { header: "Kullanıcı",     key: "kullaniciAdi",  },
      { header: "Departman",     key: "departman",     },
      { header: "Görev",         key: "gorev",         },
      { header: "Hat Durum",     key: "hatDurum",      },
      { header: "Cihaz Marka",   key: "cihazMarka",    },
      { header: "Cihaz Model",   key: "cihazModel",    },
      { header: "IMEI 1",        key: "imei1",         },
      { header: "IMEI 2",        key: "imei2",         },
      { header: "Fatura No",     key: "faturaNo",      },
      { header: "Tarife",        key: "tarife",        },
      { header: "Tarife Hakları",key: "tarifeHaklari", },
      { header: "PIN",           key: "pin",           },
      { header: "Teslim Durumu", key: "teslimDurumu",  },
      { header: "Teslim Tarihi", key: "teslimTarihi",  },
      { header: "Açıklama",      key: "aciklama",      },
    ];
    data.forEach((r) => ws.addRow({ ...r, teslimTarihi: r.teslimTarihi ? new Date(r.teslimTarihi).toLocaleDateString("tr-TR") : "" }));
    styleHeader(ws); autoWidth(ws); stripeRows(ws);

  } else if (type === "bilgisayarlar") {
    const data = await prisma.itComputer.findMany({ orderBy: { bolum: "asc" } });
    const ws = wb.addWorksheet("Bilgisayarlar");
    ws.columns = [
      { header: "PC Adı",              key: "pcAdi"              },
      { header: "Kullanıcı/Zimmetli",  key: "kullanici"          },
      { header: "Bölüm",               key: "bolum"              },
      { header: "Monitör",             key: "monitor"            },
      { header: "İşlemci",             key: "islemci"            },
      { header: "RAM",                 key: "ram"                },
      { header: "Grafik Kartı",        key: "grafikKarti"        },
      { header: "Depolama",            key: "depolama"           },
      { header: "İşletim Sistemi",     key: "isletimSistemi"     },
      { header: "Kurulan Programlar",  key: "kuralanProgramlar"  },
      { header: "Yazıcı",              key: "yazici"             },
      { header: "Harici Donanım",      key: "hariciDonanim"      },
      { header: "Kullanıcı Adı (AD)",  key: "kullaniciAdi"       },
      { header: "Ürün Anahtarı",       key: "urunAnahtari"       },
      { header: "Açıklama",            key: "aciklama"           },
    ];
    data.forEach((r) => ws.addRow(r));
    styleHeader(ws); autoWidth(ws); stripeRows(ws);

  } else if (type === "yazicilar") {
    const data = await prisma.itPrinter.findMany({ orderBy: { departman: "asc" } });
    const ws = wb.addWorksheet("Yazıcılar");
    ws.columns = [
      { header: "Departman",  key: "departman" },
      { header: "Kullanan",   key: "kullanan"  },
      { header: "Yazıcı Adı", key: "yaziciAdi" },
      { header: "Bağlantı",   key: "baglanti"  },
      { header: "Açıklama",   key: "aciklama"  },
    ];
    data.forEach((r) => ws.addRow(r));
    styleHeader(ws); autoWidth(ws); stripeRows(ws);

  } else if (type === "kameralar") {
    const data = await prisma.itCamera.findMany({ orderBy: { kameraNo: "asc" } });
    const ws = wb.addWorksheet("Kameralar");
    ws.columns = [
      { header: "Kamera No",  key: "kameraNo" },
      { header: "İsim/Konum", key: "isim"     },
      { header: "IP Adresi",  key: "ip"       },
      { header: "Konum",      key: "konum"    },
      { header: "MAC",        key: "mac"      },
      { header: "Tip",        key: "tip"      },
      { header: "Switch",     key: "switch"   },
      { header: "Port",       key: "port"     },
      { header: "Açıklama",   key: "aciklama" },
    ];
    data.forEach((r) => ws.addRow(r));
    styleHeader(ws); autoWidth(ws); stripeRows(ws);

  } else {
    const data = await prisma.itSwitch.findMany({ orderBy: { lokasyon: "asc" } });
    const ws = wb.addWorksheet("Switchler");
    ws.columns = [
      { header: "SW Adı",    key: "swAdi"    },
      { header: "IP",        key: "ip"       },
      { header: "Lokasyon",  key: "lokasyon" },
      { header: "Bölge",     key: "bolge"    },
      { header: "Marka",     key: "marka"    },
      { header: "Port",      key: "port"     },
      { header: "BB",        key: "bb"       },
      { header: "Açıklama",  key: "aciklama" },
    ];
    data.forEach((r) => ws.addRow(r));
    styleHeader(ws); autoWidth(ws); stripeRows(ws);
  }

  const TYPE_NAMES: Record<ItType, string> = {
    telefonlar:    "Telefonlar",
    bilgisayarlar: "Bilgisayarlar",
    yazicilar:     "Yazıcılar",
    kameralar:     "Kameralar",
    switchler:     "Switchler",
  };
  const filename = `IT_Envanter_${TYPE_NAMES[type]}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
