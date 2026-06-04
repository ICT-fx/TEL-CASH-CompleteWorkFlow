// INGESTION DÉSACTIVÉE — helper partagé renvoyant 410 Gone pour toutes les
// routes /api/v1/* tant que la connexion Foxway/Fluxitron reste coupée.
import { NextResponse } from 'next/server';

export function gone() {
  return NextResponse.json(
    { error: 'Ingestion Foxway désactivée' },
    { status: 410 },
  );
}
