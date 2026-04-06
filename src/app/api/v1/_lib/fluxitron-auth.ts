import { NextResponse } from 'next/server';

/**
 * Validate Fluxitron API Key from request headers.
 * Checks X-Api-Key header (default) against FLUXITRON_API_KEY env var.
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function validateApiKey(request: Request): NextResponse | null {
  const apiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.headers.get('api-token');

  const expectedKey = process.env.FLUXITRON_API_KEY;

  if (!expectedKey) {
    console.error('FLUXITRON_API_KEY is not set in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized', details: 'Invalid API key' },
      { status: 401 }
    );
  }

  return null; // Valid
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
