import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/track — collecte d'une page vue (tracking maison, first-party).
// Appelé en fire-and-forget depuis le composant client TrafficTracker à chaque
// changement de route. Renvoie toujours 204 : ne doit JAMAIS gêner le client,
// quoi qu'il arrive (table absente, bot, erreur DB → on avale silencieusement).

export const dynamic = 'force-dynamic';

// Bots / crawlers / link-previews évidents : on ne les compte pas.
const BOT_RE = /bot|crawl|spider|slurp|bing|google|baidu|yandex|duckduck|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|headless|monitor|preview|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch/i;

function deviceFromUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobi|phone|blackberry|iemobile|opera mini/.test(s)) return 'mobile';
  return 'desktop';
}

export async function POST(request: Request) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

    const body = await request.json().catch(() => null);
    const path = typeof body?.path === 'string' ? body.path : '';
    const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.slice(0, 64) : '';
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 64) : '';

    // Garde-fous : chemin valide, on ignore l'admin et les routes techniques.
    if (!path || !path.startsWith('/') || !visitorId || !sessionId) {
      return new NextResponse(null, { status: 204 });
    }
    if (path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/_next')) {
      return new NextResponse(null, { status: 204 });
    }

    const referrerRaw = typeof body?.referrer === 'string' ? body.referrer : '';
    // On ne garde que les referrers externes (pas la navigation interne au site).
    let referrer: string | null = referrerRaw ? referrerRaw.slice(0, 512) : null;
    const host = request.headers.get('host') || '';
    if (referrer && host && referrer.includes(host)) referrer = null;

    // Pays : déduit de l'en-tête edge (Vercel). JAMAIS l'IP brute.
    const country =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      null;

    const db = createAdminClient();
    // Insertion volontairement non attendue de manière bloquante côté client
    // (sendBeacon). Ici on await juste l'appel DB, rapide et indexé.
    await db.from('page_views').insert({
      path: path.slice(0, 512),
      referrer,
      visitor_id: visitorId,
      session_id: sessionId,
      device: deviceFromUA(ua),
      country: country ? country.slice(0, 2).toUpperCase() : null,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Fail-safe absolu : on ne remonte jamais d'erreur au client.
    return new NextResponse(null, { status: 204 });
  }
}
