'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, loading, updateQuantity, removeItem, fetchCart } = useCart();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user, fetchCart]);

  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

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
                      src={item.image || '/products/iphone-13-pro-blue.png'} 
                      alt={item.name} 
                      className="w-full h-full object-contain mix-blend-multiply" 
                    />
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.storage} Go · {item.grade} · {item.color}
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
                          onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.stock))} 
                          className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          disabled={item.quantity >= item.stock}
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
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Sous-total</span>
                    <span className="font-medium">{total.toFixed(2).replace('.', ',')} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Livraison</span>
                    <span className="font-bold text-green-600">Offerte</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-black text-2xl">{total.toFixed(2).replace('.', ',')} €</span>
                </div>
                <Link href="/checkout">
                  <Button className="w-full h-14 text-base gap-2 shadow-xl shadow-primary/30">
                    Passer au paiement <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
