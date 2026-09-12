import { NextRequest, NextResponse } from "next/server";

// The client-side CurrencyProvider calls this route instead of hitting the
// external FX API directly. That sidesteps CORS entirely (server-to-server
// requests aren't subject to it) and insulates us from upstream redirects —
// api.frankfurter.app now 301s to api.frankfurter.dev/v1 with no CORS
// headers on the redirect itself, which is what broke the direct-from-browser
// version of this call.
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // re-fetch a given pair at most once an hour

interface CacheEntry {
  rate: number;
  expiresAt: number;
}

const rateCache = new Map<string, CacheEntry>();

function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") ?? "").toUpperCase();
  const to = (searchParams.get("to") ?? "").toUpperCase();

  if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
    return NextResponse.json({ error: "from and to must be 3-letter currency codes" }, { status: 400 });
  }

  if (from === to) {
    return NextResponse.json({ rate: 1 });
  }

  const key = `${from}_${to}`;
  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ rate: cached.rate });
  }

  try {
    const upstream = await fetch(`${FRANKFURTER_URL}?from=${from}&to=${to}`);
    if (!upstream.ok) throw new Error(`upstream responded ${upstream.status}`);

    const data = await upstream.json();
    const rate = data?.rates?.[to];
    if (typeof rate !== "number") throw new Error("unexpected upstream response shape");

    rateCache.set(key, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ rate });
  } catch {
    return NextResponse.json({ error: "exchange rate temporarily unavailable" }, { status: 502 });
  }
}
