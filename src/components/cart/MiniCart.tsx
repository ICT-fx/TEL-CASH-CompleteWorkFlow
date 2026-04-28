'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function MiniCart() {
  const { items, isOpen, closeCart, updateQuantity, removeItem } = useCart();
  const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeCart} className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white z-[60] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-2xl font-black flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> Mon Panier</h2>
              <button onClick={closeCart} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-grow overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-muted-foreground" /></div>
                  <div><h3 className="text-xl font-bold mb-2">Votre panier est vide</h3><p className="text-muted-foreground">Découvrez nos smartphones reconditionnés premium et trouvez votre bonheur.</p></div>
                  <Link href="/products" onClick={closeCart}><Button>Découvrir le catalogue</Button></Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <div className="w-24 h-24 bg-white rounded-xl p-2 flex-shrink-0 border border-border flex items-center justify-center overflow-hidden">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                      <div className="flex flex-col flex-grow justify-between py-1">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-lg leading-tight">{item.name}</h4>
                            <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-2 mt-1 font-medium">
                            {item.storage && <span className="bg-white px-2 py-0.5 rounded border">{item.storage}</span>}
                            {item.grade && <span className="bg-white px-2 py-0.5 rounded border">{item.grade}</span>}
                            {item.color && <span className="bg-white px-2 py-0.5 rounded border">{item.color}</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-3 bg-white border border-border rounded-lg px-1 py-1">
                            <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-1 text-muted-foreground hover:text-foreground"><Minus className="w-3 h-3" /></button>
                            <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.stock))} disabled={item.quantity >= item.stock} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                          </div>
                          <div className="font-black text-lg">{item.price * item.quantity} €</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {items.length > 0 && (
              <div className="p-6 border-t border-border bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-medium text-muted-foreground">Sous-total</span>
                  <span className="text-3xl font-black">{total} €</span>
                </div>
                <Link href="/checkout" onClick={closeCart}>
                  <Button className="w-full h-14 text-lg shadow-xl shadow-primary/30">Passer au paiement sécurisé</Button>
                </Link>
                <p className="text-center text-xs text-muted-foreground mt-4 font-medium flex items-center justify-center gap-1">
                  Paiement 100% sécurisé via Alma (3X, 4X) ou CB
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
