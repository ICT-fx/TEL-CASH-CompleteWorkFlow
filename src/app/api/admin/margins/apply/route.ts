import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { recomputeAndWritePrices } from '@/lib/margins-db';

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const brand: string | undefined = body.brand || undefined;
  const productIds: string[] | undefined = Array.isArray(body.productIds) ? body.productIds : undefined;

  const result = await recomputeAndWritePrices({ brand, productIds });
  return NextResponse.json(result);
}
