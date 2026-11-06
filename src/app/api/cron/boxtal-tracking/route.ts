import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { syncAllPendingTracking } from '@/lib/trackingSync';

// Cron quotidien (vercel.json) : récupère chez Boxtal le vrai n° Chronopost des
// colis dont le bordereau a été généré, puis envoie au client l'email
// « commande expédiée » avec ce numéro. Cf. lib/trackingSync.ts.
// Aussi déclenchable à la main par un admin connecté (GET dans le navigateur).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  const { response } = await requireAdmin();
  return response ?? null;
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const results = await syncAllPendingTracking(createAdminClient());
  return NextResponse.json({
    checked: results.length,
    updated: results.filter((r) => r.updated).length,
    results,
  });
}
