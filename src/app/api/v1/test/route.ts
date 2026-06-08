import { NextResponse } from 'next/server';
import { validateApiKey, addRateLimitHeaders } from '../_lib/fluxitron-auth';

// GET /api/v1/test — Verify credentials and connectivity
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const res = NextResponse.json({
    success: true,
    message: 'Connected to TEL & CASH v1.0',
    details: {
      platform: 'tel-and-cash',
      version: '1.0.0',
      storeName: 'TEL & CASH',
    },
  });

  return addRateLimitHeaders(res);
}
