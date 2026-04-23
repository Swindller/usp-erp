import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 ERP seed başlıyor...");

  // Admin kullanıcı
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "berkayocal@ugursupompalari.com.tr" },
    update: { role: "SUPER_ADMIN", passwordHash: adminPassword },
    create: {
      email: "berkayocal@ugursupompalari.com.tr",
      passwordHash: adminPassword,
      firstName: "Berkay",
      lastName: "Öcal",
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Admin:", admin.email);

  // Teknisyen kullanıcı
  const techPassword = await hash("tech123", 12);
  const techUser = await prisma.user.upsert({
    where: { email: "alparslan@ugurpompa.com" },
    update: { role: "TECHNICIAN" },
    create: {
      email: "alparslan@ugurpompa.com",
      passwordHash: techPassword,
      firstName: "Alparslan",
      lastName: "Demir",
      phone: "05321234567",
      role: "TECHNICIAN",
    },
  });
  console.log("✅ Teknisyen:", techUser.email);

  // Personnel kaydı
  await prisma.personnel.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      userId: techUser.id,
      role: "TECHNICIAN",
      department: "Teknik Servis",
      speciality: "Pompa ve Hidrofor",
      phone: "05321234567",
    },
  });
  console.log("✅ Personnel kaydı oluşturuldu");

  // ERP Müşterileri
  const customers = [
    {
      type: "CORPORATE" as const,
      companyName: "Güneş İnşaat Taahhüt A.Ş.",
      taxNumber: "1234567890",
      taxOffice: "Antalya VD",
      phone: "02422001122",
      email: "muhasebe@gunesinsat.com",
      city: "Antalya",
      district: "Kepez",
    },
    {
      type: "CORPORATE" as const,
      companyName: "Akdeniz Tarım Sulama Ltd.",
      taxNumber: "9876543210",
      taxOffice: "Manavgat VD",
      phone: "02422443355",
      email: "info@akdeniztarim.com",
      city: "Antalya",
      district: "Manavgat",
    },
    {
      type: "INDIVIDUAL" as const,
      firstName: "Mehmet",
      lastName: "Yılmaz",
      phone: "05551112233",
      email: "mehmet.yilmaz@gmail.com",
      city: "Antalya",
      district: "Muratpaşa",
    },
    {
      type: "INDIVIDUAL" as const,
      firstName: "Ayşe",
      lastName: "Kaya",
      phone: "05442223344",
      email: "ayse.kaya@hotmail.com",
      city: "Antalya",
      district: "Konyaaltı",
    },
    {
      type: "INDIVIDUAL" as const,
      firstName: "Hüseyin",
      lastName: "Çelik",
      phone: "05333334455",
      city: "Antalya",
      district: "Serik",
    },
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (!existing) {
      await prisma.customer.create({ data: c });
      console.log("✅ Müşteri:", c.companyName ?? `${c.firstName} ${c.lastName}`);
    } else {
      console.log("⏭️  Müşteri zaten var:", c.companyName ?? `${c.firstName} ${c.lastName}`);
    }
  }

  console.log("\n🎉 Seed tamamlandı!");
  console.log("Admin: admin@ugurpompa.com / admin123");
  console.log("Teknisyen: alparslan@ugurpompa.com / tech123");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
