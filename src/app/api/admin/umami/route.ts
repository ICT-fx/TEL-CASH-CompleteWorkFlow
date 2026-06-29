import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/umami?period=7|30|90|365
// Proxy serveur de l'API Umami Cloud : la clé API reste côté serveur (jamais
// exposée au client). Agrège stats + série temporelle + répartitions
// (pages, sources, navigateurs, OS, devices, pays) + visiteurs en direct.
// Fail-safe : si UMAMI_API_KEY absente, renvoie { configured: false }.

export const dynamic = 'force-dynamic';

const PERIODS: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };
const API_BASE = process.env.UMAMI_API_BASE || 'https://api.umami.is/v1';
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || 'c86da298-85af-468e-9451-928fc9cd493a';

interface Metric { x: string | null; y: number }

export async function GET(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const key = (process.env.UMAMI_API_KEY || '').trim();
  if (!key) {
    return NextResponse.json({ configured: false });
  }

  const periodKey = req.nextUrl.searchParams.get('period') || '30';
  const days = PERIODS[periodKey] ?? 30;
  const monthly = days >= 365;

  const endAt = Date.now();
  const startAt = endAt - days * 86400_000;
  const unit = monthly ? 'month' : 'day';

  const headers = { 'x-umami-api-key': key, accept: 'application/json' };
  const base = `${API_BASE}/websites/${WEBSITE_ID}`;
  const range = `startAt=${startAt}&endAt=${endAt}`;

  // Appel générique tolérant : renvoie null si l'appel échoue (ne casse pas tout).
  const get = async <T,>(url: string): Promise<T | null> => {
    try {
      const r = await fetch(url, { headers, cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.json()) as T;
    } catch {
      return null;
    }
  };

  const [stats, series, urls, referrers, browsers, os, devices, countries, active] =
    await Promise.all([
      get<Record<string, number | Record<string, number>>>(`${base}/stats?${range}`),
      get<{ pageviews: Metric[]; sessions: Metric[] }>(
        `${base}/pageviews?${range}&unit=${unit}&timezone=Europe/Paris`
      ),
      get<Metric[]>(`${base}/metrics?${range}&type=url&limit=10`),
      get<Metric[]>(`${base}/metrics?${range}&type=referrer&limit=10`),
      get<Metric[]>(`${base}/metrics?${range}&type=browser&limit=8`),
      get<Metric[]>(`${base}/metrics?${range}&type=os&limit=8`),
      get<Metric[]>(`${base}/metrics?${range}&type=device&limit=8`),
      get<Metric[]>(`${base}/metrics?${range}&type=country&limit=10`),
      get<{ visitors: number }>(`${base}/active`),
    ]);

  if (!stats) {
    // Clé présente mais l'API ne répond pas / non autorisée.
    return NextResponse.json({ configured: true, ok: false, error: 'API Umami injoignable' });
  }

  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const cmp = (stats.comparison as Record<string, number>) || {};
  const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

  const pageviews = num(stats.pageviews);
  const visitors = num(stats.visitors);
  const visits = num(stats.visits);
  const bounces = num(stats.bounces);
  const totaltime = num(stats.totaltime); // secondes cumulées

  const prevVisits = num(cmp.visits);
  const bounceRate = visits > 0 ? (bounces / visits) * 100 : 0;
  const prevBounceRate = prevVisits > 0 ? (num(cmp.bounces) / prevVisits) * 100 : 0;
  const avgDuration = visits > 0 ? totaltime / visits : 0; // secondes / visite
  const prevAvgDuration = prevVisits > 0 ? num(cmp.totaltime) / prevVisits : 0;

  // Fusion des deux séries (pageviews + sessions) par horodatage.
  const seriesMap = new Map<string, { date: string; pageviews: number; sessions: number }>();
  for (const p of series?.pageviews || []) {
    if (!p.x) continue;
    seriesMap.set(p.x, { date: p.x.slice(0, 10), pageviews: p.y, sessions: 0 });
  }
  for (const s of series?.sessions || []) {
    if (!s.x) continue;
    const e = seriesMap.get(s.x);
    if (e) e.sessions = s.y;
    else seriesMap.set(s.x, { date: s.x.slice(0, 10), pageviews: 0, sessions: s.y });
  }
  const timeSeries = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    configured: true,
    ok: true,
    period: periodKey,
    live: num(active?.visitors),
    stats: {
      visitors: { value: visitors, delta: pct(visitors, num(cmp.visitors)) },
      visits: { value: visits, delta: pct(visits, prevVisits) },
      pageviews: { value: pageviews, delta: pct(pageviews, num(cmp.pageviews)) },
      bounceRate: { value: bounceRate, delta: pct(bounceRate, prevBounceRate) },
      avgDuration: { value: avgDuration, delta: pct(avgDuration, prevAvgDuration) },
    },
    series: timeSeries,
    metrics: {
      url: urls || [],
      referrer: referrers || [],
      browser: browsers || [],
      os: os || [],
      device: devices || [],
      country: countries || [],
    },
  });
}
