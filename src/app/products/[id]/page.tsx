'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShieldCheck, Battery, Truck, ChevronRight, ShoppingCart, Check, ArrowLeft, Zap, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addItem, openCart } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          const apiProduct = data;
          
          if (apiProduct) {
            setProduct({
              ...apiProduct,
              name: `${apiProduct.brand} ${apiProduct.model}`,
              price: parseFloat(apiProduct.price),
              originalPrice: apiProduct.original_price ? parseFloat(apiProduct.original_price) : null,
              image: apiProduct.images?.[0] || '/products/iphone-13-pro-blue.png',
              storage: apiProduct.storage_capacity,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }

    await addItem(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-3xl font-black text-[#0A0F1E] mb-4">Oups !</h2>
          <p className="text-slate-500 mb-8">Ce produit semble avoir disparu de notre catalogue ou n'existe pas encore.</p>
          <Link href="/products">
            <Button className="bg-[#0A0F1E] text-white px-8 py-4 rounded-xl font-bold">Retour au catalogue</Button>
          </Link>
        </div>
      </div>
    );
  }

  const originalPrice = product.originalPrice || product.price * 1.3;
  const savings = Math.round(originalPrice - product.price);

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      {/* Navigation Top Bar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="container mx-auto px-4 max-w-7xl h-16 flex items-center justify-between">
          <Link href="/products" className="flex items-center gap-2 text-sm font-bold text-[#0A0F1E] hover:text-blue-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Boutique
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <span className="text-sm font-bold text-slate-400">Garantie 24 mois incluse</span>
            <span className="text-sm font-bold text-slate-400">Livraison offerte</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xl font-black text-[#0A0F1E]">{product.price.toFixed(0)}€</span>
            <Button onClick={handleAddToCart} className="bg-[#3b82f6] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-blue-500/20">
              Acheter
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          
          {/* Left: Visual Staging (Apple Style) */}
          <div className="relative">
            {/* Cursive annotation */}
            <div className="absolute -top-10 left-0 z-10">
              <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
                comme neuf, le prix en moins
              </span>
              <svg width="40" height="30" viewBox="0 0 48 30" className="fill-none mt-1 ml-4" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M 6 4 C 10 4 30 8 36 22" stroke="#3b82f6" strokeWidth="1.5"/>
                <path d="M 36 22 L 40 14 M 36 22 L 28 18" stroke="#3b82f6" strokeWidth="1.5"/>
              </svg>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="bg-white rounded-[40px] p-12 md:p-20 flex items-center justify-center min-h-[400px] md:min-h-[600px] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group"
            >
              {/* Abstract Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-50/50 blur-[100px] rounded-full pointer-events-none" />
              
              <motion.img
                key={selectedImageIndex}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                src={product.image}
                alt={product.name}
                className="max-h-[350px] md:max-h-[500px] w-auto object-contain drop-shadow-[0_40px_80px_rgba(0,0,0,0.15)] z-10 transition-transform duration-700 group-hover:scale-105"
              />

              {/* Sparkle FX */}
              <motion.div 
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }} 
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-1/4 right-1/4 z-20"
              >
                <Sparkles className="w-8 h-8 text-blue-400 opacity-40" />
              </motion.div>
            </motion.div>

            {/* Thumbnails */}
            <div className="flex justify-center gap-4 mt-8">
              {(product.images?.length > 0 ? product.images : [product.image]).slice(0, 3).map((imgUrl: string, i: number) => (
                <button 
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`w-20 h-20 rounded-2xl bg-white border-2 transition-all p-3 flex items-center justify-center ${i === selectedImageIndex ? 'border-blue-500 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-contain opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Right: Product Details */}
          <div className="flex flex-col">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-[#2563EB] rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                ✦ En stock • Grade {product.grade || 'A'}
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-[#0A0F1E] tracking-tighter mb-4 leading-none">
                {product.name}
              </h1>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-400 font-bold line-through">{originalPrice.toFixed(0)}€ Neuf</span>
                  <span className="text-4xl md:text-5xl font-black text-[#3b82f6] tracking-tight">{product.price.toFixed(0)}€</span>
                </div>
                <div className="h-12 w-px bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wide">Vous économisez</span>
                  <span className="text-xl font-black text-[#2563EB]">{savings}€</span>
                </div>
              </div>

              {/* Selectors */}
              <div className="space-y-8 mb-12">
                <div className="flex flex-col gap-4">
                  <span className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest">Couleur : <span className="text-[#3b82f6]">{product.color || 'Standard'}</span></span>
                </div>

                <div className="flex flex-col gap-4">
                  <span className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest">Capacité stockage</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button 
                      className="py-4 px-6 rounded-2xl border-2 font-bold text-sm transition-all border-blue-500 bg-blue-50/30 text-blue-600"
                    >
                      {product.storage || 'Standard'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Actions */}
              <div className="space-y-4 mb-12">
                <Button 
                  onClick={handleAddToCart}
                  disabled={addedToCart}
                  className={`w-full py-8 rounded-2xl text-xl font-black transition-all shadow-2xl ${addedToCart ? 'bg-[#2563EB] text-white' : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/20'}`}
                >
                  <AnimatePresence mode="wait">
                    {addedToCart ? (
                      <motion.span key="added" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3">
                        Ajouté au panier <Check className="w-6 h-6" />
                      </motion.span>
                    ) : (
                      <motion.span key="add" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3">
                        Ajouter au panier
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
                
                {/* Secondary reassurance */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Garantie 24 mois</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center gap-2">
                    <Truck className="w-6 h-6 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Livraison offerte</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center gap-2">
                    <Zap className="w-6 h-6 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Retour 30 jours</span>
                  </div>
                </div>
              </div>

              {/* Technical Grid (Apple style) */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-black text-[#0A0F1E] mb-6 flex items-center gap-3">
                    Ce qui est inclus
                    <div className="h-0.5 flex-grow bg-slate-100" />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: <Zap className="w-4 h-4" />, label: "Chargeur rapide inclus" },
                      { icon: <Check className="w-4 h-4" />, label: "Boîte Tel & Cash premium" },
                      { icon: <ShieldCheck className="w-4 h-4" />, label: "Garantie commerciale 24 mois" },
                      { icon: <Battery className="w-4 h-4" />, label: `Batterie testée > ${product.battery_health || 80}%` }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-50 text-slate-700 font-bold text-sm">
                        <div className="text-blue-500">{item.icon}</div>
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
