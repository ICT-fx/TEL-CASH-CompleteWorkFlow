'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  Plus, Minus, ShoppingBag, ArrowRight, ChevronLeft, Loader2, Tag, X, Check, Lock,
  ShieldCheck, Undo2, Phone,
} from 'lucide-react';
import { useCart, MAX_CART_QTY } from '@/store/useCart';
import { displayGradeMeta } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';
import { SHIPPING_FEE_EUR, PICKUP_STORE_PHONE, formatShippingFee } from '@/lib/shipping';
import { computeDiscountAmount } from '@/lib/referral';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { KlarnaBadge } from '@/components/payment/Klarna';
import { DeliveryChoice } from '@/components/cart/DeliveryChoice';

// « 379 € » pour un montant rond, « 289,90 € » sinon.
function fmtPrice(n: number): string {
  const c = Math.round(n * 100);
  return c % 100 === 0 ? `${c / 100} €` : `${(c / 100).toFixed(2).replace('.', ',')} €`;
}
// Toujours 2 décimales (récapitulatif).
function fmtAmount(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

interface AppliedDiscount { discount_type: 'fixed' | 'percent'; discount_value: number }

export default function CartPage() {
  // Panier consultable SANS compte (panier invité persisté en local), mais le
  // paiement exige un compte : guest checkout désactivé (hotfix checkout).
  const { user, loading: authLoading } = useAuth();
  const { items, loading, updateQuantity, removeItem, fetchCart } = useCart();
  const promoCode = useCart((s) => s.promoCode);
  const setPromoCode = useCart((s) => s.setPromoCode);
  const deliveryMethod = useCart((s) => s.deliveryMethod);

  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user, fetchCart]);

  const applyPromo = async (code: string) => {
    if (!code.trim()) return;
    setPromoStatus('checking');
    try {
      const res = await fetch('/api/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoCode(code);
        setAppliedDiscount({ discount_type: data.discount_type, discount_value: parseFloat(data.discount_value) });
        setPromoStatus('valid');
      } else {
        setPromoCode(null);
        setAppliedDiscount(null);
        setPromoStatus('invalid');
      }
    } catch {
      setPromoStatus('invalid');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    // Priorité au ?promo= de l'URL (lien de relance) ; sinon on revalide le
    // code déjà en mémoire (Zustand persist) pour réafficher son état après
    // un rechargement de page.
    const promo = params.get('promo') || promoCode;
    if (promo) {
      setPromoInput(promo);
      applyPromo(promo);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- lecture unique au montage

  const removePromo = () => {
    setPromoCode(null);
    setAppliedDiscount(null);
    setPromoInput('');
    setPromoStatus('idle');
  };

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  // Même calcul que le checkout : livraison incluse, réduction plafonnée.
  const shipping = deliveryMethod === 'pickup' ? 0 : SHIPPING_FEE_EUR;
  const discountAmount = appliedDiscount ? computeDiscountAmount(appliedDiscount, subtotal, shipping) : 0;
  const total = subtotal + shipping - discountAmount;

  if (authLoading || (loading && items.length === 0)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-220px)] bg-[#F9F8F5] pt-4 pb-16 text-[#0A0F1E] md:pt-8">
      <div className="container mx-auto max-w-5xl px-4">
        {/* En-tête */}
        <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
          <div className="flex items-center gap-1">
            <Link
              href="/products"
              aria-label="Continuer mes achats"
              className="-ml-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#0A0F1E] hover:bg-white"
            >
              <ChevronLeft className="h-[22px] w-[22px]" />
            </Link>
            <h1 className="text-[22px] font-extrabold tracking-tight md:text-3xl">
              Mon panier{items.length > 0 ? ` (${itemCount})` : ''}
            </h1>
          </div>
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#157F3D]">
            <Lock className="h-4 w-4" aria-hidden="true" /> Sécurisé
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#E4E8F0] bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F4F9]">
              <ShoppingBag className="h-9 w-9 text-[#5B6478]" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Votre panier est vide</h2>
            <p className="mb-6 text-[#47506A]">Découvrez nos smartphones reconditionnés, testés en atelier à Angers.</p>
            <Link href="/products" className="tc-btn">
              Voir le catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            {/* Colonne gauche : articles + mode de réception */}
            <div className="flex flex-col gap-3.5">
              {items.map((item) => {
                // Libellé d'état depuis la source unique (lib/grades via products.ts).
                const details = [
                  colorLabelFr(item.color),
                  displayGradeMeta(item.grade)?.label ?? null,
                ].filter(Boolean).join(' · ');
                const storage = normalizeStorage(item.storage);
                return (
                  <div key={item.id} className="flex gap-3.5 rounded-2xl border border-[#E4E8F0] bg-white p-4">
                    <div className="flex h-24 w-[84px] flex-none items-center justify-center rounded-xl bg-[#F1F4F9] p-2">
                      <img
                        src={resolveProductImage({ model: item.name, images: item.image ? [item.image] : null, color: item.color })}
                        alt={`${item.name} reconditionné`}
                        onError={onImageErrorToPlaceholder(item.name)}
                        className="max-h-[78px] max-w-[70px] object-contain mix-blend-multiply"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <b className="text-base leading-snug">
                        {item.name}{storage ? ` · ${storage}` : ''}
                      </b>
                      {details && <span className="text-sm font-semibold text-[#5B6478]">{details}</span>}
                      <span className="text-[13px] font-bold text-[#157F3D]">Garantie 24 mois incluse</span>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl border border-[#E4E8F0] bg-[#F9F8F5]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                              disabled={item.quantity <= 1}
                              aria-label={`Diminuer la quantité de ${item.name}`}
                              className="flex h-11 w-11 items-center justify-center text-[#47506A] hover:text-[#0A0F1E] disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold" aria-live="polite">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, MAX_CART_QTY))}
                              disabled={item.quantity >= MAX_CART_QTY}
                              aria-label={`Augmenter la quantité de ${item.name}`}
                              className="flex h-11 w-11 items-center justify-center text-[#47506A] hover:text-[#0A0F1E] disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="h-11 px-1 text-sm font-bold text-[#47506A] underline underline-offset-2 hover:text-[#0A0F1E]"
                          >
                            Supprimer
                          </button>
                        </div>
                        <b className="text-[17px]">{fmtPrice(item.price * item.quantity)}</b>
                      </div>
                    </div>
                  </div>
                );
              })}

              <section className="mt-1">
                <DeliveryChoice />
              </section>
            </div>

            {/* Colonne droite : récapitulatif + paiement */}
            <div className="flex flex-col gap-3.5 lg:sticky lg:top-28 lg:self-start">
              <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E4E8F0] bg-white p-4">
                <div className="flex justify-between text-[15px]">
                  <span className="text-[#47506A]">Sous-total</span>
                  <span>{fmtAmount(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[15px]">
                  <span className="text-[#47506A]">
                    {deliveryMethod === 'pickup' ? 'Retrait au magasin' : 'Livraison à domicile'}
                  </span>
                  {deliveryMethod === 'pickup'
                    ? <span className="font-bold text-[#157F3D]">Gratuit</span>
                    : <span>{formatShippingFee()}</span>}
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[15px]">
                    <span className="text-[#157F3D]">Code {promoCode}</span>
                    <span className="font-bold text-[#157F3D]">− {fmtAmount(discountAmount)}</span>
                  </div>
                )}
                <div className="h-px bg-[#E4E8F0]" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{fmtAmount(total)}</span>
                </div>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#47506A]">
                  ou 3× {fmtAmount(Math.round((total / 3) * 100) / 100)} sans frais avec <KlarnaBadge size={18} />
                </p>
              </div>

              {/* Code promo */}
              <div>
                {promoStatus === 'valid' && appliedDiscount ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#157F3D]">
                      <Check className="h-4 w-4" />
                      Code {promoCode} appliqué
                      {' — '}
                      {appliedDiscount.discount_type === 'percent'
                        ? `-${appliedDiscount.discount_value}%`
                        : `-${appliedDiscount.discount_value.toFixed(2).replace('.', ',')} €`}
                    </div>
                    <button
                      type="button"
                      onClick={removePromo}
                      aria-label="Retirer le code promo"
                      className="flex h-11 w-11 items-center justify-center text-[#157F3D] hover:text-emerald-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B6478]" />
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoStatus('idle'); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(promoInput); } }}
                          placeholder="Code promo"
                          aria-label="Code promo"
                          className="h-11 w-full rounded-xl border border-[#E4E8F0] bg-white pl-9 pr-3 text-sm uppercase outline-none focus:border-[#2457E6] focus:ring-2 focus:ring-[#2457E6]/20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => applyPromo(promoInput)}
                        disabled={promoStatus === 'checking' || !promoInput.trim()}
                        className="h-11 rounded-xl border border-[#E4E8F0] bg-white px-4 text-sm font-bold text-[#0A0F1E] hover:border-[#C9D1E0] disabled:opacity-50"
                      >
                        {promoStatus === 'checking' ? '…' : 'Appliquer'}
                      </button>
                    </div>
                    {promoStatus === 'invalid' && (
                      <p className="mt-2 text-[13px] text-red-600">Code invalide ou expiré.</p>
                    )}
                  </div>
                )}
              </div>

              <Link href="/checkout" className="tc-btn w-full text-[17px]">
                Commander · {fmtPrice(Math.round(total * 100) / 100)} <ArrowRight className="h-[18px] w-[18px]" />
              </Link>

              {/* Paiement réservé aux comptes (guest checkout désactivé) */}
              {!user && (
                <p className="-mt-1 text-center text-sm leading-normal text-[#47506A]">
                  Connexion ou création de compte à l&apos;étape suivante.
                  <br />
                  <Link
                    href="/auth/login?redirect=/checkout"
                    className="inline-flex min-h-[44px] items-center font-bold text-[#2457E6] hover:text-[#163DAA]"
                  >
                    J&apos;ai déjà un compte
                  </Link>
                </p>
              )}

              {/* Moyens de paiement (ceux dont le site a déjà les logos) */}
              <div className="flex flex-wrap justify-center gap-2 pt-1" aria-label="Moyens de paiement acceptés">
                {['CB', 'Visa', 'Mastercard'].map((m) => (
                  <span key={m} className="flex h-[30px] items-center rounded-lg border border-[#E4E8F0] bg-white px-2.5 text-[13px] font-bold">
                    {m}
                  </span>
                ))}
                <span className="flex h-[30px] items-center rounded-lg bg-[#FFB3C7] px-2.5 text-[13px] font-extrabold text-[#0B051D]">
                  Klarna
                </span>
              </div>

              {/* Réassurance */}
              <ul className="mt-1 flex flex-col gap-2.5 rounded-2xl border border-[#E4E8F0] bg-white p-4 text-sm">
                <li className="flex items-center gap-2.5">
                  <ShieldCheck className="h-[18px] w-[18px] flex-none text-[#2457E6]" aria-hidden="true" />
                  Garantie 24 mois, pièces et main d&apos;œuvre
                </li>
                <li className="flex items-center gap-2.5">
                  <Undo2 className="h-[18px] w-[18px] flex-none text-[#2457E6]" aria-hidden="true" />
                  30 jours pour retourner un achat fait en ligne
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="h-[18px] w-[18px] flex-none text-[#2457E6]" aria-hidden="true" />
                  <span>
                    Une question ?{' '}
                    <a href={`tel:${PICKUP_STORE_PHONE.replace(/\s/g, '')}`} className="inline-flex min-h-[44px] items-center font-bold text-[#2457E6] hover:text-[#163DAA] -my-3">
                      {PICKUP_STORE_PHONE}
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
