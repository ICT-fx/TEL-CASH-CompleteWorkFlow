import { NextResponse } from 'next/server';

/**
 * Valide la clé d'API du connecteur Fluxitron : header `X-Api-Key` comparé à
 * la variable d'env `FLUXITRON_API_KEY`.
 *
 * Convention d'appel (inchangée dans toutes les routes /api/v1/*) :
 *     const authError = validateApiKey(request);
 *     if (authError) return authError;
 *   → renvoie `null` si la requête est AUTORISÉE (la route poursuit),
 *     sinon une réponse d'erreur à retourner immédiatement.
 *
 * Sécurité : si `FLUXITRON_API_KEY` n'est pas configurée, le connecteur est
 * considéré FERMÉ (503) — il faut donc définir l'env pour le réactiver.
 * Fluxitron n'est utilisé que comme miroir de stock fournisseur ; il ne pilote
 * jamais les prix du catalogue magasin (cf. spec 2026-06-24-fluxitron-stock).
 */
export function validateApiKey(request: Request): NextResponse | null {
  const expected = process.env.FLUXITRON_API_KEY;
  if (!expected) {
    return NextResponse.json(
      {
        error: 'Service Unavailable',
        code: 'fluxitron_not_configured',
        message:
          "Le connecteur Fluxitron n'est pas configuré (FLUXITRON_API_KEY manquante).",
      },
      { status: 503 }
    );
  }

  // headers.get est insensible à la casse (Fetch API) → matche X-Api-Key.
  const provided = request.headers.get('x-api-key');
  if (!provided || provided !== expected) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        code: 'invalid_api_key',
        message: 'Clé API invalide ou manquante (header X-Api-Key).',
      },
      { status: 401 }
    );
  }

  return null;
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
