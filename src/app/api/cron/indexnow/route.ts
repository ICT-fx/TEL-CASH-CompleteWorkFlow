import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getCatalogModelLinks } from '@/lib/catalogModelLinks';

// Notifie IndexNow (Bing, Yandex, etc. ; relayé entre moteurs participants) des
// URLs publiques du site. Déclenché chaque jour par vercel.json. Clé publique :
// fichier public/d2e84bc7adb9e80b68bdb84ee5cfecd2.txt (la clé IndexNow n'est pas un secret).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEY = 'd2e84bc7adb9e80b68bdb84ee5cfecd2';
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr').replace(/\/+$/, '');
const STATIC_PATHS = [
  '/', '/products', '/iphone-reconditionne-angers', '/reconditionne-ou-occasion', '/engagements', '/reconditionnement',
  '/qui-sommes-nous', '/contact', '/retours', '/accessoires',
];

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  const { response } = await requireAdmin();
  return response ?? null;
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const models = await getCatalogModelLinks();
  const urlList = [
    ...STATIC_PATHS.map((p) => `${BASE_URL}${p}`),
    ...models.map((m) => new URL(m.href, BASE_URL).toString()),
  ].slice(0, 10000);

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(BASE_URL).host,
      key: KEY,
      keyLocation: `${BASE_URL}/${KEY}.txt`,
      urlList,
    }),
  });
  return NextResponse.json({ submitted: urlList.length, status: res.status }, { status: res.ok ? 200 : 502 });
}
