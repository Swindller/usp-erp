import { NextResponse } from "next/server";

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

// In-memory cache: 1 saat TTL
let cache: { rate: number; fetchedAt: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

async function fetchEURRate(): Promise<number> {
  const res = await fetch(TCMB_URL, { next: { revalidate: 3600 } });
  const xml = await res.text();

  // EUR BanknoteSelling (efektif satış)
  const efektifMatch = xml.match(
    /<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/
  );
  if (efektifMatch) return parseFloat(efektifMatch[1].replace(",", "."));

  // Fallback: ForexSelling
  const forexMatch = xml.match(
    /<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/
  );
  if (forexMatch) return parseFloat(forexMatch[1].replace(",", "."));

  throw new Error("EUR kuru bulunamadı");
}

export async function GET() {
  // Cache geçerliyse direkt dön
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return NextResponse.json({ rate: cache.rate, currency: "EUR", cached: true });
  }

  try {
    const rate = await fetchEURRate();
    cache = { rate, fetchedAt: Date.now() };
    return NextResponse.json({ rate, currency: "EUR", cached: false });
  } catch {
    // TCMB ulaşılamazsa (tatil/hafta sonu) cache'i kullan ya da fallback
    if (cache) {
      return NextResponse.json({ rate: cache.rate, currency: "EUR", cached: true, stale: true });
    }
    return NextResponse.json({ rate: 38.5, currency: "EUR", cached: false, fallback: true });
  }
}
