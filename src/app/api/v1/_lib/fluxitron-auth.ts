import { NextResponse } from 'next/server';

/**
 * Connecteur Fluxitron coupé (cf. spec catalogue-magasin §9).
 * Toutes les routes /api/v1/* appellent ce garde en première instruction et
 * renvoient immédiatement sa réponse : il court-circuite donc l'ensemble du
 * connecteur en 410 Gone, sans aucune écriture/lecture externe. Réversible :
 * pour réactiver, restaurer la validation de clé d'API ci-dessous.
 */
export function validateApiKey(_request: Request): NextResponse {
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

/**
 * Add rate limit headers to response.
 * Simple implementation — can be enhanced with Redis later.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit = 120,
  remaining = 119
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  return response;
}
