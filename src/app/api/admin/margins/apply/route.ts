import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// PRIX MANUELS (design 2026-06-22 §6 & §9) : le moteur de marges automatique est
// débranché. Les prix sont saisis à la main via la grille /admin/prix. Cette route
// d'application en masse n'a plus de raison d'être et renvoie 410 Gone.
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  return NextResponse.json(
    {
      error: 'Moteur de marges automatique désactivé.',
      hint: 'Les prix sont désormais manuels. Utilisez la grille /admin/prix.',
    },
    { status: 410 }
  );
}
