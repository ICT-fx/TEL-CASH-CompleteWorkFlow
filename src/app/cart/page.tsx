'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Loader2, Tag, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart, MAX_CART_QTY } from '@/store/useCart';
import { displayGrade } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';
import { formatShippingFee } from '@/lib/shipping';
import { computeDiscountAmount } from '@/lib/referral';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { KlarnaInstallment } from '@/components/payment/Klarna';

interface AppliedDiscount { discount_type: 'fixed' | 'percent'; discount_value: number }

export default function CartPage() {
  // Panier consultable SANS compte : le panier invité est persisté en local
  // (Zustand persist) et le login n'est exigé qu'au moment du paiement.
  const { user, loading: authLoading } = useAuth();
  const { items, loading, updateQuantity, removeItem, fetchCart } = useCart();
  const promoCode = useCart((s) => s.promoCode);
  const setPromoCode = useCart((s) => s.setPromoCode);

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

  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = appliedDiscount ? computeDiscountAmount(appliedDiscount, total) : 0;
  const totalAfterDiscount = total - discountAmount;

  if (authLoading || (loading && items.length === 0)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-[calc(100vh-220px)] bg-gradient-to-b from-slate-50 to-white pt-8 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-8"
        >
          Mon Panier
        </motion.h1>

        {items.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Votre panier est vide</h2>
            <p className="text-slate-500 mb-6">Découvrez nos smartphones reconditionnés premium.</p>
            <Link href="/products">
              <Button className="gap-2">
                Voir le catalogue <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item, index) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex gap-6"
                >
                  <div className="w-24 h-24 bg-slate-50 rounded-xl p-3 flex-shrink-0 flex items-center justify-center border border-slate-100">
                    <img
                      src={resolveProductImage({ model: item.name, images: item.image ? [item.image] : null, color: item.color })}
                      alt={item.name}
                      onError={onImageErrorToPlaceholder(item.name)}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[normalizeStorage(item.storage), `Grade ${displayGrade(item.grade) ?? '—'}`, colorLabelFr(item.color)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1">
                        <button 
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} 
                          className="p-1.5 text-slate-500 hover:text-slate-900"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, MAX_CART_QTY))}
                          className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          disabled={item.quantity >= MAX_CART_QTY}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-lg">
                          {(item.price * item.quantity).toFixed(2).replace('.', ',')} €
                        </span>
                        <button 
                          onClick={() => removeItem(item.id)} 
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-28">
                <h3 className="font-bold text-lg mb-6">Résumé</h3>

                {/* Code promo */}
                <div className="mb-6">
                  {promoStatus === 'valid' && appliedDiscount ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
                        <Check className="w-4 h-4" />
                        Code {promoCode} appliqué
                        {' — '}
                        {appliedDiscount.discount_type === 'percent'
                          ? `-${appliedDiscount.discount_value}%`
                          : `-${appliedDiscount.discount_value.toFixed(2)} €`}
                      </div>
                      <button onClick={removePromo} className="text-emerald-600 hover:text-emerald-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={promoInput}
                            onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoStatus('idle'); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(promoInput); } }}
                            placeholder="Code promo"
                            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none uppercase"
                          />
                        </div>
                        <button
                          onClick={() => applyPromo(promoInput)}
                          disabled={promoStatus === 'checking' || !promoInput.trim()}
                          className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          {promoStatus === 'checking' ? '…' : 'Appliquer'}
                        </button>
                      </div>
                      {promoStatus === 'invalid' && (
                        <p className="text-xs text-red-500 mt-2">Code invalide ou expiré.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Sous-total</span>
                    <span className="font-medium">{total.toFixed(2).replace('.', ',')} €</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Réduction</span>
                      <span className="font-medium text-emerald-600">− {discountAmount.toFixed(2).replace('.', ',')} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Livraison</span>
                    <span className="font-bold text-emerald-600">Gratuite en boutique</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Ou {formatShippingFee()} à domicile — choisissez le mode de livraison à l&apos;étape suivante.
                  </p>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-black text-2xl">{totalAfterDiscount.toFixed(2).replace('.', ',')} €</span>
                </div>
                <Link href="/checkout">
                  <Button className="w-full h-14 text-base gap-2 shadow-xl shadow-primary/30">
                    Passer au paiement <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>

                {/* Paiement en plusieurs fois — mis en avant avant le checkout */}
                <KlarnaInstallment
                  className="mt-4"
                  subtitle="Sans frais — sélectionnez Klarna sur la page de paiement sécurisée."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
