'use client';

// « Les plus demandés » — refonte v4 (maquettes Main.dc.html / Accueil-ordi.dc.html).
//
// Source de données INCHANGÉE : GET /api/products?limit=all&fields=card (même
// requête qu'avant). Seul le rendu change : cartes propres « marque, modèle,
// dès X € », sans prix barré, sans étoiles, sans compteur d'avis.
//
// Le chargement est mutualisé (une seule requête par page) via useHomeModels(),
// réutilisé par PetitsPrix (« Moins de 300 € ») et par le héros (prix « dès »
// de l'iPhone 13).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { priceValue, formatEur } from '@/lib/price';
import { productUrl } from '@/lib/productUrl';

interface ApiProduct {
  id: string;
  brand: string;
  model: string;
  storage_capacity?: string | null;
  grade?: string | null;
  color?: string | null;
  price: string | number;
  stock?: number | null;
  images?: string[] | null;
  category?: string | null;
  greyed_by_supplier?: boolean | null;
}

/** Un modèle affichable sur l'accueil (une carte = un modèle). */
// Affichage seulement : noms fournisseur peu lisibles → nom courant.
// (Les URL et la base ne changent pas.)
export function prettyModelName(model: string): string {
  return model
    .replace(/\s*\(2nd generation\)/i, ' (2020)')
    .replace(/\s*\(3rd generation\)/i, ' (2022)');
}

// « Les plus demandés » : modèles les plus recherchés en reconditionné, dans cet
// ordre ; complétés si besoin par les plus gros stocks (ancien critère).
const MOST_WANTED = [
  'iPhone 13', 'iPhone 14', 'iPhone 12', 'iPhone 15',
  'iPhone 11', 'Galaxy S23 FE 5G', 'iPhone 13 Pro', 'Galaxy A55 5G',
];

export interface HomeModel {
  key: string;
  brand: string;
  model: string;
  /** Prix « dès » = SKU vendable le moins cher du modèle (prix stocké brut). */
  minPrice: number;
  /** Fiche du SKU le moins cher → même prix que celui affiché sur la carte. */
  href: string;
  /** Vraie photo (jamais de placeholder) : variante la moins chère dont la couleur a un packshot. */
  image: string;
  /** Stock cumulé du modèle (proxy « plus demandés », comme avant). */
  stock: number;
}

// ── Chargement mutualisé ───────────────────────────────────────────────────
let modelsPromise: Promise<HomeModel[]> | null = null;

function buildModels(all: ApiProduct[]): HomeModel[] {
  const realPhoto = (p: ApiProduct): string | null => {
    const src = resolveProductImage(
      { brand: p.brand, model: p.model, images: p.images ?? [] },
      p.color,
      { strict: true },
    );
    return src.startsWith('data:') ? null : src;
  };

  type Acc = { cheapest: ApiProduct; cheapestPrice: number; photo: string | null; photoPrice: number; stock: number };
  const byModel = new Map<string, Acc>();

  for (const p of all) {
    if (p.category === 'accessoires') continue;
    const model = (p.model || '').trim();
    if (!model) continue;
    const price = priceValue(p.price);
    if (price === null) continue; // jamais de « 0 € »
    // Un SKU grisé chez le fournisseur n'est pas vendable : il ne fixe pas le « dès ».
    if (p.greyed_by_supplier === true) continue;

    const key = `${(p.brand || '').trim()}|${model}`;
    const photo = realPhoto(p);
    const acc = byModel.get(key);
    if (!acc) {
      byModel.set(key, {
        cheapest: p,
        cheapestPrice: price,
        photo,
        photoPrice: photo ? price : Infinity,
        stock: Number(p.stock) || 0,
      });
      continue;
    }
    acc.stock += Number(p.stock) || 0;
    if (price < acc.cheapestPrice) {
      acc.cheapest = p;
      acc.cheapestPrice = price;
    }
    if (photo && price < acc.photoPrice) {
      acc.photo = photo;
      acc.photoPrice = price;
    }
  }

  const out: HomeModel[] = [];
  for (const [key, acc] of byModel) {
    // VITRINE : uniquement les modèles avec une VRAIE photo.
    if (!acc.photo) continue;
    out.push({
      key,
      brand: (acc.cheapest.brand || '').trim(),
      model: prettyModelName((acc.cheapest.model || '').trim()),
      minPrice: acc.cheapestPrice,
      href: productUrl(acc.cheapest),
      image: acc.photo,
      stock: acc.stock,
    });
  }
  return out;
}

export function loadHomeModels(): Promise<HomeModel[]> {
  if (!modelsPromise) {
    modelsPromise = fetch('/api/products?limit=all&fields=card')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => buildModels((data?.products || []) as ApiProduct[]))
      .catch((err) => {
        console.error('Error fetching home products:', err);
        modelsPromise = null; // nouvel essai possible au prochain montage
        return [] as HomeModel[];
      });
  }
  return modelsPromise;
}

export function useHomeModels(): { models: HomeModel[]; loading: boolean } {
  const [state, setState] = useState<{ models: HomeModel[]; loading: boolean }>({ models: [], loading: true });
  useEffect(() => {
    let alive = true;
    loadHomeModels().then((models) => {
      if (alive) setState({ models, loading: false });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** « 289 € » (entier) ou « 289,90 € » — jamais d'arrondi vers le haut d'un prix « dès ». */
export function formatFromPrice(n: number): string {
  return (Number.isInteger(n) ? formatEur(n) : formatEur(n, { decimals: 2 })) ?? '';
}

// ── Carte produit partagée (accueil) ───────────────────────────────────────
export function HomeProductCard({ m, compact = false, className = '' }: { m: HomeModel; compact?: boolean; className?: string }) {
  return (
    <Link
      href={m.href}
      data-umami-event="accueil-produit"
      data-umami-event-section={compact ? 'moins-300' : 'plus-demandes'}
      data-umami-event-modele={m.model}
      className={`group flex flex-col bg-white border border-[#E7E9EF] rounded-[18px] md:rounded-[20px] overflow-hidden text-[#0A0F1E] shadow-[0_10px_24px_-18px_rgba(11,20,55,.45)] md:shadow-[0_14px_30px_-22px_rgba(11,20,55,.5)] transition-shadow hover:shadow-[0_18px_36px_-20px_rgba(11,20,55,.5)] ${className}`}
    >
      <div
        className={`flex items-center justify-center ${compact ? 'h-[132px] p-3.5' : 'h-[150px] p-3.5 md:h-[220px] md:p-5'}`}
        style={{ background: 'radial-gradient(90% 80% at 50% 30%,#FFFFFF 0%,#EEF2F9 60%,#E3E9F4 100%)' }}
      >
        <img
          src={m.image}
          alt={`${m.model} reconditionné`}
          onError={onImageErrorToPlaceholder(`${m.brand} ${m.model}`)}
          loading="lazy"
          decoding="async"
          className={`max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04] ${compact ? 'max-h-[108px]' : 'max-h-[122px] md:max-h-[180px]'}`}
          style={{ filter: 'drop-shadow(0 10px 12px rgba(11,20,55,.18))' }}
        />
      </div>
      <div className={`flex flex-col gap-0.5 ${compact ? 'px-3 pt-3 pb-3.5' : 'px-3 pt-3 pb-3.5 md:px-[18px] md:pt-4 md:pb-[18px]'}`}>
        <span className="text-[13px] md:text-xs font-bold tracking-[.08em] uppercase text-[#5B6478]">{m.brand}</span>
        <span className="text-[15px] md:text-[17px] font-bold leading-snug">{m.model}</span>
        <span className="mt-1.5 md:mt-2 text-[15px] md:text-base font-semibold">
          dès <b className="text-lg md:text-xl font-extrabold">{formatFromPrice(m.minPrice)}</b>
        </span>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[18px] md:rounded-[20px] border border-[#E7E9EF] bg-white overflow-hidden animate-pulse ${className}`} aria-hidden="true">
      <div className="h-[150px] md:h-[220px] bg-[#EEF2F9]" />
      <div className="p-3 md:p-4 flex flex-col gap-2">
        <div className="h-3 w-12 rounded bg-[#E7E9EF]" />
        <div className="h-4 w-24 rounded bg-[#E7E9EF]" />
        <div className="h-4 w-16 rounded bg-[#E7E9EF]" />
      </div>
    </div>
  );
}

const BRAND_CHIPS = [
  { label: 'iPhone', href: '/products?brand=apple' },
  { label: 'Samsung', href: '/products?brands=Samsung' },
  { label: 'Google Pixel', href: '/products?brands=Google' },
  { label: 'Xiaomi', href: '/products?brands=Xiaomi' },
];

const chipClass =
  'inline-flex items-center h-11 px-5 rounded-full border border-[#DCE2EC] text-[15px] font-semibold text-[#0A0F1E] whitespace-nowrap shadow-[inset_0_1px_0_#fff,0_2px_6px_-3px_rgba(11,20,55,.18)] hover:border-[#9FB0CF] transition-colors';
const chipStyle = { background: 'linear-gradient(180deg,#fff,#F6F7FA)' };

export function BestOffers() {
  const { models, loading } = useHomeModels();

  const wanted = MOST_WANTED
    .map((name) => models.find((m) => m.model.toLowerCase() === name.toLowerCase()))
    .filter((m): m is HomeModel => Boolean(m));
  const rest = [...models]
    .filter((m) => !wanted.includes(m))
    .sort((a, b) => b.stock - a.stock || a.minPrice - b.minPrice);
  const top = [...wanted, ...rest].slice(0, 8);

  return (
    <section className="bg-[#F9F8F5]">
      <div className="mx-auto max-w-[1232px] px-4 pt-8 pb-9 md:pt-12 md:pb-[88px] flex flex-col gap-3.5 md:gap-7">
        <div className="flex items-center md:items-end justify-between gap-6">
          <h2 className="m-0 text-2xl md:text-[38px] font-black tracking-[-.03em] md:tracking-[-.035em] text-[#0A0F1E]">
            Les plus demandés
          </h2>
          <Link
            href="/products"
            className="md:hidden inline-flex items-center min-h-[44px] text-sm font-bold text-[#2457E6] hover:text-[#163DAA]"
          >
            Tout voir
          </Link>
          <nav aria-label="Marques" className="hidden md:flex flex-wrap justify-end gap-2.5">
            {BRAND_CHIPS.map((c) => (
              <Link key={c.label} href={c.href} className={chipClass} style={chipStyle}>
                {c.label}
              </Link>
            ))}
            <Link href="/products" className={chipClass} style={chipStyle}>
              Tout voir
            </Link>
          </nav>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-[22px]">
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <ProductCardSkeleton key={i} className={i >= 6 ? 'hidden md:block' : ''} />
              ))
            : top.map((m, i) => (
                // Mobile : 6 cartes (maquette) ; ordinateur : 8.
                <HomeProductCard key={m.key} m={m} className={i >= 6 ? 'hidden md:flex' : ''} />
              ))}
        </div>

        {!loading && top.length === 0 && (
          <p className="text-center text-[#5B6478] py-10">
            Le catalogue est momentanément indisponible.{' '}
            <Link href="/products" className="font-bold text-[#2457E6]">Voir tous les smartphones</Link>
          </p>
        )}
      </div>
    </section>
  );
}
