'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Circle, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { PaymentBadges } from '@/components/products/PaymentBadges';
import type { RawProduct } from '@/lib/productVariants';

// Fiche ACCESSOIRE : produit simple (pas de grade / couleur / stockage / batterie /
// variantes). Galerie photo transparente centrée (même rendu que les téléphones),
// titre, marque, description, prix, badge « Disponible à la commande », ajout au panier.
// Les câbles « prix à définir » (price ≤ 0) sont « Bientôt disponible » et non
// achetables (masqués du paiement).

interface Props {
  sku: RawProduct & { condition_description?: string | null };
}

export default function AccessoryDetailClient({ sku }: Props) {
  const { addItem, openCart } = useCart();
  const [added, setAdded] = useState(false);

  const price = typeof sku.price === 'string' ? parseFloat(sku.price) : sku.price;
  const hasPrice = Number.isFinite(price) && (price as number) > 0;
  const comingSoon = !hasPrice; // câble « prix à définir »

  const brand = (sku.brand || 'd-power').trim();
  const name = (sku.model || 'Accessoire').trim();
  const description = (sku.condition_description || '').trim();
  const image = resolveProductImage({ brand, model: name, images: sku.images || [] });

  const handleAddToCart = async () => {
    if (comingSoon) return;
    await addItem(sku as any);
    setAdded(true);
    openCart?.();
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between">
          <Link href="/products?category=accessoires" className="flex items-center gap-2 text-sm font-bold text-[#0A0F1E] hover:text-blue-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Retour aux accessoires
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Livraison express 24h-48h</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paiement sécurisé</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-10 items-start">

          {/* Galerie : image transparente, centrée, même rendu que les téléphones */}
          <div className="lg:sticky lg:top-[90px]">
            <div className="bg-white border border-[#F0F0F0] rounded-2xl min-h-[330px] lg:min-h-[460px] flex items-center justify-center p-6 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 w-[360px] h-[360px] bg-[#2F6BFF]/[0.06] blur-[90px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
              <motion.img
                key={image}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                src={image}
                alt={name}
                onError={onImageErrorToPlaceholder(name)}
                className="relative z-10 w-[85%] max-w-[440px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)]"
              />
            </div>
          </div>

          {/* Infos */}
          <div className="flex flex-col items-start w-full">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#2F6BFF]/10 text-[#2F6BFF] font-bold text-[10px] tracking-widest uppercase mb-3">
              ✦ accessoire
            </div>

            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7A99] mb-1">{brand}</p>
            <h1 className="text-2xl md:text-3xl font-black text-[#0B1437] tracking-tight mb-4">{name}</h1>

            {/* Prix */}
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              {hasPrice ? (
                <span className="text-3xl md:text-4xl font-black text-[#0B1437] tracking-tight">
                  {(price as number).toFixed(0)} €
                </span>
              ) : (
                <span className="text-lg font-bold text-[#6B7A99]">Bientôt disponible</span>
              )}
            </div>
            {hasPrice && (
              <span className="text-[11px] text-[#6B7A99] font-medium mb-4">
                ou 3× sans frais de {((price as number) / 3).toFixed(0)} €
              </span>
            )}

            {/* Sell-to-order : disponibilité simple, jamais de niveau de stock ni de rupture */}
            {!comingSoon && (
              <div className="flex items-center gap-2 mb-4 mt-2 text-[11px] font-bold uppercase tracking-widest">
                <Circle className="w-2 h-2 fill-[#16A34A] text-[#16A34A]" />
                <span className="text-emerald-600">Disponible à la commande</span>
              </div>
            )}

            {/* Description */}
            {description && (
              <p className="text-[15px] text-[#3A4253] leading-relaxed mb-6">{description}</p>
            )}

            {/* CTA */}
            <Button
              onClick={handleAddToCart}
              disabled={comingSoon || added}
              className={`w-full px-6 py-3.5 rounded-xl text-sm font-bold shadow-md transition-all ${comingSoon ? 'bg-slate-200 text-slate-500 shadow-none cursor-not-allowed' : 'bg-[#2F6BFF] hover:bg-[#2456d8] text-white shadow-[#2F6BFF]/25'}`}
            >
              {comingSoon ? 'Bientôt disponible' : added ? 'Ajouté au panier ✓' : 'Ajouter au panier'}
            </Button>

            {/* Réassurance */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 w-full text-xs text-[#5A6172]">
              <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#2F6BFF]" />Livraison express 24h-48h</span>
              <span className="inline-flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 text-[#1FA971]" />Retour 30 jours</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1FA971]" />Paiement sécurisé</span>
            </div>

            <PaymentBadges className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
