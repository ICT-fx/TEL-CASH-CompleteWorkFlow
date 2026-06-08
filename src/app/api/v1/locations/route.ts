import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';

// GET /api/v1/locations — List warehouse/fulfillment locations
// Single-location store: returns one item
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const res = NextResponse.json([
    {
      id: 'loc_main',
      name: 'Entrepôt Principal',
      address1: null,
      address2: null,
      city: null,
      country: 'France',
      countryCode: 'FR',
      zip: null,
      phone: null,
      active: true,
    },
  ]);

  return addRateLimitHeaders(res);
}
