import { NextResponse } from 'next/server';

// Connecteur Fluxitron coupé (cf. spec catalogue-magasin §9) : l'index v1
// n'appelle pas validateApiKey, on renvoie donc 410 explicitement ici.
export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      code: 'fluxitron_disabled',
      message:
        "Le connecteur Fluxitron est désactivé. Les routes /api/v1/* ne sont plus disponibles. Le catalogue est désormais géré manuellement en magasin.",
    },
    { status: 410 }
  );
}
