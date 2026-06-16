import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { previewPrices } from '@/lib/margins-db';
import { displayGrade } from '@/lib/products';

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || undefined;
  const grade = searchParams.get('grade') || undefined; // 'A'|'B'|'C'

  let comps = await previewPrices(brand ? { brand } : undefined);

  // Filtre d'affichage par grade (après calcul, pour ne pas casser la cohérence).
  if (grade) {
    comps = comps.filter((c) => displayGrade(c.product.grade) === grade);
  }

  const rows = comps.map((c) => ({
    productId: c.product.id,
    brand: c.product.brand,
    model: c.product.model,
    grade: c.product.grade,
    storage: c.product.storage_capacity,
    color: c.product.color,
    cost: c.cost,
    oldPrice: c.oldPrice,
    newPrice: c.newPrice,
    marginPct: c.marginPct,
    ruleApplied: c.ruleApplied,
    coherenceAdjusted: c.coherenceAdjusted,
    lowMargin: c.lowMargin,
    compareAtPrice: c.compareAtPrice,
  }));

  return NextResponse.json({ rows });
}
