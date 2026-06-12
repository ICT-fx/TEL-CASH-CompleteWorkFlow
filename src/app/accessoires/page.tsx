'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';

interface AccessoryProduct {
  id: string;
  brand?: string | null;
  model?: string | null;
  product_type?: string | null;
  price: string | number;
  compare_at_price?: string | number | null;
  images?: string[] | null;
  is_active?: boolean;
}

// Libellés FR conviviaux pour les types stockés en base (product_type).
// Un type inconnu retombe sur une version « jolie » de sa valeur brute.
const TYPE_LABELS: Record<string, string> = {
  chargeur: 'Chargeurs',
  cable: 'Câbles',
  batterie: 'Batteries externes',
  coque: 'Coques',
  verre: "Protections d'écran",
  ecouteurs: 'Écouteurs',
  protection: 'Protections',
  support: 'Supports',
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1);
}

export default function AccessoiresPage() {
  const [products, setProducts] = useState<AccessoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/products?category=accessoires&limit=all&fields=card')
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  // Types disponibles dérivés du catalogue réel (+ compteur), comme le filtre marques.
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const t = (p.product_type || '').trim().toLowerCase();
      if (p.is_active !== false && t) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      if (p.is_active === false) return false;
      if (typeFilter.length === 0) return true;
      return typeFilter.includes((p.product_type || '').trim().toLowerCase());
    });
  }, [products, typeFilter]);

  const toggleType = (t: string) =>
    setTypeFilter((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#0A0F1E] tracking-tight">Accessoires</h1>
        <p className="text-slate-500 mt-1">Chargeurs, câbles, coques, protections et plus.</p>
      </div>

      {/* Filtres par type */}
      {types.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-8">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 mr-1" />
          <button
            onClick={() => setTypeFilter([])}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              typeFilter.length === 0
                ? 'bg-[#0A0F1E] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tous
          </button>
          {types.map(({ type, count }) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                typeFilter.includes(type)
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {typeLabel(type)}{' '}
              <span className={typeFilter.includes(type) ? 'text-white/70' : 'text-slate-400'}>
                ({count})
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-slate-400 py-20 text-center">Aucun accessoire disponible pour le moment.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {visible.map((p) => {
            const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
            const oldPrice =
              p.compare_at_price != null
                ? typeof p.compare_at_price === 'string'
                  ? parseFloat(p.compare_at_price)
                  : p.compare_at_price
                : null;
            return (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                  <img
                    src={resolveProductImage(p)}
                    alt={p.model || 'Accessoire'}
                    onError={onImageErrorToPlaceholder(p.model || null)}
                    className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  {p.product_type && (
                    <div className="text-[0.7rem] font-bold uppercase tracking-wider text-[#3b82f6] mb-1">
                      {typeLabel(p.product_type.trim().toLowerCase())}
                    </div>
                  )}
                  <div className="text-sm font-bold text-[#0A0F1E] leading-snug line-clamp-2 min-h-[2.5rem]">
                    {p.model}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-black text-[#0A0F1E]">
                      {Number.isFinite(price as number) ? (price as number).toFixed(2) : '—'} €
                    </span>
                    {oldPrice != null && (
                      <span className="text-xs text-slate-400 line-through">{oldPrice.toFixed(2)} €</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
