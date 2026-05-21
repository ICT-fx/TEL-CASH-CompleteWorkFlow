'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Truck, ShoppingCart, Check, ArrowLeft, Zap, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildVariantMatrix,
  getOptionAvailability,
  pickInitialSelection,
  pickSkuForSelection,
  reconcileSelection,
  type OptionAvailability,
  type RawProduct,
  type VariantAxis,
} from '@/lib/productVariants';
import { colorToCss, gradeLabelFr, normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage } from '@/lib/productImage';

export default function ProductDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [initialSku, setInitialSku] = useState<RawProduct | null>(null);
  const [siblings, setSiblings] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);

  // User selection
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // 1. Fetch the SKU pointed at by the URL, then 2. fetch its siblings
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/products/${params.id}`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const sku: RawProduct = await res.json();
        if (cancelled) return;
        setInitialSku(sku);

        // Fetch siblings first, then pick a stock-aware initial selection so
        // the customer doesn't land on an out-of-stock combination silently.
        const skuList: RawProduct[] = await (async () => {
          if (!sku.brand || !sku.model) return [sku];
          const url = `/api/products?brand=${encodeURIComponent(sku.brand)}&model=${encodeURIComponent(sku.model)}&limit=all`;
          try {
            const sibRes = await fetch(url);
            if (!sibRes.ok) return [sku];
            const data = await sibRes.json();
            return (data.products as RawProduct[]) || [sku];
          } catch {
            return [sku];
          }
        })();

        if (cancelled) return;
        setSiblings(skuList);

        const matrix = buildVariantMatrix(skuList);
        const initial = pickInitialSelection(matrix, {
          storage: (sku.storage_capacity || '').trim() || null,
          grade: normalizeGradeLetter(sku.grade) || (sku.grade || '').trim() || null,
          color: (sku.color || '').trim() || null,
        });
        setSelectedStorage(initial.storage);
        setSelectedGrade(initial.grade);
        setSelectedColor(initial.color);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (params.id) run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const matrix = useMemo(() => buildVariantMatrix(siblings), [siblings]);

  const currentPick = useMemo(
    () => pickSkuForSelection(matrix, selectedStorage, selectedGrade, selectedColor),
    [matrix, selectedStorage, selectedGrade, selectedColor]
  );

  // Image source: prefer the selected variant's image, then the initial SKU's images.
  const variantImage = currentPick?.image;
  const fallbackImages =
    (Array.isArray(initialSku?.images) && initialSku!.images!.length > 0
      ? initialSku!.images!
      : [resolveProductImage(initialSku, selectedColor)]) as string[];
  const galleryImages = useMemo(() => {
    if (variantImage && !fallbackImages.includes(variantImage)) {
      return [variantImage, ...fallbackImages];
    }
    return fallbackImages;
  }, [variantImage, fallbackImages]);

  // Reset thumbnail focus when variant image changes
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [variantImage]);

  const handleOptionClick = (axis: VariantAxis, value: string) => {
    const current = { storage: selectedStorage, grade: selectedGrade, color: selectedColor };
    const avail = getOptionAvailability(matrix, value, axis, current.storage, current.grade, current.color);

    // 'available' → keep the other axes untouched, just apply the new value.
    // 'out_of_stock' OR 'incompatible' → run reconcile to find an in-stock
    // combination (or, failing that, surface the rupture clearly).
    if (avail === 'available') {
      if (axis === 'storage') setSelectedStorage(value);
      if (axis === 'grade') setSelectedGrade(value);
      if (axis === 'color') setSelectedColor(value);
      return;
    }

    const next = reconcileSelection(matrix, axis, value, current);
    if (next) {
      setSelectedStorage(next.storage);
      setSelectedGrade(next.grade);
      setSelectedColor(next.color);
    }
  };

  const handleAddToCart = async () => {
    if (!currentPick) return;
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    // Find the raw SKU in our siblings list — useCart.addItem expects a product-like object
    const sku = siblings.find((s) => s.id === currentPick.skuId);
    if (!sku) return;
    await addItem(sku as any);
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

  if (notFound || !initialSku) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-3xl font-black text-[#0A0F1E] mb-4">Oups !</h2>
          <p className="text-slate-500 mb-8">Ce produit semble avoir disparu de notre catalogue ou n&apos;existe pas encore.</p>
          <Link href="/products">
            <Button className="bg-[#0A0F1E] text-white px-8 py-4 rounded-xl font-bold">Retour au catalogue</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = `${initialSku.brand} ${initialSku.model}`;
  const currentPrice = currentPick?.price ?? null;
  const originalPrice = currentPrice ? currentPrice * 1.3 : null;
  const savings = currentPrice && originalPrice ? Math.round(originalPrice - currentPrice) : 0;
  const currentStock = currentPick?.stock ?? 0;
  const stockLabel =
    currentStock === 0
      ? 'Rupture sur cette combinaison'
      : currentStock <= 3
        ? `Plus que ${currentStock} disponible${currentStock > 1 ? 's' : ''}`
        : 'En stock';
  const stockColor = currentStock === 0 ? 'text-rose-600' : currentStock <= 3 ? 'text-amber-600' : 'text-emerald-600';

  const cartDisabled = !currentPick || currentStock === 0;

  // Visual styling driven by the 3-state availability flag. Buttons stay
  // clickable in every state — clicking on out_of_stock / incompatible
  // triggers reconcile() inside handleOptionClick.
  const optionClass = (
    isSelected: boolean,
    avail: OptionAvailability,
    base: string
  ): { className: string; style: React.CSSProperties | undefined } => {
    if (isSelected) {
      return { className: `${base} border-blue-500 bg-blue-50/50 text-blue-600`, style: undefined };
    }
    if (avail === 'available') {
      return { className: `${base} border-slate-200 text-slate-700 hover:border-slate-300`, style: undefined };
    }
    if (avail === 'out_of_stock') {
      return { className: `${base} border-slate-200 text-slate-500`, style: { opacity: 0.5 } };
    }
    // incompatible
    return { className: `${base} border-slate-100 text-slate-300`, style: { opacity: 0.3 } };
  };

  const availTitle = (avail: OptionAvailability, label: string): string | undefined => {
    if (avail === 'available') return label;
    if (avail === 'out_of_stock') return `${label} — rupture (cliquer pour ajuster)`;
    return `${label} — combinaison indisponible (cliquer pour ajuster)`;
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
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
            {currentPrice != null && (
              <span className="text-xl font-black text-[#0A0F1E]">{currentPrice.toFixed(0)}€</span>
            )}
            <Button
              onClick={handleAddToCart}
              disabled={cartDisabled}
              className="bg-[#3b82f6] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-blue-500/20 disabled:bg-slate-300 disabled:shadow-none"
            >
              Acheter
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left: gallery */}
          <div className="relative">
            <div className="absolute -top-10 left-0 z-10">
              <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
                comme neuf, le prix en moins
              </span>
              <svg width="40" height="30" viewBox="0 0 48 30" className="fill-none mt-1 ml-4" style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M 6 4 C 10 4 30 8 36 22" stroke="#3b82f6" strokeWidth="1.5" />
                <path d="M 36 22 L 40 14 M 36 22 L 28 18" stroke="#3b82f6" strokeWidth="1.5" />
              </svg>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="bg-white rounded-[40px] p-12 md:p-20 flex items-center justify-center min-h-[400px] md:min-h-[600px] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-50/50 blur-[100px] rounded-full pointer-events-none" />

              <motion.img
                key={galleryImages[selectedImageIndex] || 'image'}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                src={galleryImages[selectedImageIndex]}
                alt={displayName}
                className="max-h-[350px] md:max-h-[500px] w-auto object-contain rounded-2xl drop-shadow-[0_40px_80px_rgba(0,0,0,0.15)] z-10 transition-transform duration-700 group-hover:scale-105"
              />

              <motion.div
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-1/4 right-1/4 z-20"
              >
                <Sparkles className="w-8 h-8 text-blue-400 opacity-40" />
              </motion.div>
            </motion.div>

            {galleryImages.length > 1 && (
              <div className="flex justify-center gap-4 mt-8 flex-wrap">
                {galleryImages.map((imgUrl, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-20 h-20 rounded-2xl bg-white border-2 transition-all p-2 flex items-center justify-center overflow-hidden ${i === selectedImageIndex ? 'border-blue-500 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <img src={imgUrl} alt={`${displayName} - vue ${i + 1}`} className={`w-full h-full object-contain rounded-xl transition-opacity ${i === selectedImageIndex ? 'opacity-100' : 'opacity-60'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: details + selectors */}
          <div className="flex flex-col">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 ${currentStock === 0 ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-[#2563EB]'}`}>
                ✦ {stockLabel} {selectedGrade && `• ${gradeLabelFr(selectedGrade)}`}
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-[#0A0F1E] tracking-tighter mb-4 leading-none">
                {displayName}
              </h1>

              <div className="flex items-center gap-6 mb-8">
                {currentPrice != null ? (
                  <>
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-400 font-bold line-through">{originalPrice!.toFixed(0)}€ Neuf</span>
                      <span className="text-4xl md:text-5xl font-black text-[#3b82f6] tracking-tight">{currentPrice.toFixed(0)}€</span>
                    </div>
                    <div className="h-12 w-px bg-slate-200" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wide">Vous économisez</span>
                      <span className="text-xl font-black text-[#2563EB]">{savings}€</span>
                    </div>
                  </>
                ) : (
                  <div className="text-lg font-bold text-slate-500">Sélectionnez une option valide</div>
                )}
              </div>

              {/* Selectors */}
              <div className="space-y-8 mb-12">
                {/* Storage */}
                {matrix.availableStorages.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <span className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest">
                      Capacité {selectedStorage && <span className="text-[#3b82f6]">: {selectedStorage}</span>}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {matrix.availableStorages.map((s) => {
                        const avail = getOptionAvailability(matrix, s, 'storage', null, selectedGrade, selectedColor);
                        const isSelected = selectedStorage === s;
                        const { className, style } = optionClass(isSelected, avail, 'py-3 px-5 rounded-2xl border-2 font-bold text-sm transition-all flex flex-col items-center');
                        return (
                          <button
                            key={s}
                            onClick={() => handleOptionClick('storage', s)}
                            className={className}
                            style={style}
                            title={availTitle(avail, s)}
                          >
                            <span>{s}</span>
                            {avail === 'out_of_stock' && (
                              <span className="text-[9px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">rupture</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grade */}
                {matrix.availableGrades.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <span className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest">
                      État {selectedGrade && <span className="text-[#3b82f6]">: {gradeLabelFr(selectedGrade)}</span>}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {matrix.availableGrades.map((g) => {
                        const avail = getOptionAvailability(matrix, g, 'grade', selectedStorage, null, selectedColor);
                        const isSelected = selectedGrade === g;
                        const { className, style } = optionClass(isSelected, avail, 'py-3 px-5 rounded-2xl border-2 font-bold text-sm transition-all flex flex-col items-center');
                        return (
                          <button
                            key={g}
                            onClick={() => handleOptionClick('grade', g)}
                            title={availTitle(avail, gradeLabelFr(g))}
                            className={className}
                            style={style}
                          >
                            <span>Grade {g}</span>
                            {avail === 'out_of_stock' && (
                              <span className="text-[9px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">rupture</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Color */}
                {matrix.availableColors.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <span className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest">
                      Couleur {selectedColor && <span className="text-[#3b82f6]">: {colorLabelFr(selectedColor)}</span>}
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {matrix.availableColors.map((c) => {
                        const avail = getOptionAvailability(matrix, c, 'color', selectedStorage, selectedGrade, null);
                        const isSelected = selectedColor === c;
                        const { className, style } = optionClass(isSelected, avail, 'flex items-center gap-2 py-2 px-3 rounded-2xl border-2 font-semibold text-sm transition-all');
                        return (
                          <button
                            key={c}
                            onClick={() => handleOptionClick('color', c)}
                            title={availTitle(avail, colorLabelFr(c))}
                            className={className}
                            style={style}
                          >
                            <span
                              className="inline-block w-5 h-5 rounded-full border border-slate-200"
                              style={{ background: colorToCss(c) }}
                            />
                            <span>{colorLabelFr(c)}</span>
                            {avail === 'out_of_stock' && (
                              <span className="text-[9px] font-bold text-rose-500 ml-1 uppercase tracking-wider">rupture</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Stock + cart */}
              <div className="space-y-4 mb-12">
                <p className={`text-sm font-bold ${stockColor}`}>{stockLabel}</p>
                <Button
                  onClick={handleAddToCart}
                  disabled={cartDisabled || addedToCart}
                  className={`w-full py-8 rounded-2xl text-xl font-black transition-all shadow-2xl ${cartDisabled ? 'bg-slate-300 text-slate-100 shadow-none cursor-not-allowed' : addedToCart ? 'bg-[#2563EB] text-white' : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/20'}`}
                >
                  <AnimatePresence mode="wait">
                    {addedToCart ? (
                      <motion.span key="added" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 justify-center">
                        Ajouté au panier <Check className="w-6 h-6" />
                      </motion.span>
                    ) : (
                      <motion.span key="add" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 justify-center">
                        <ShoppingCart className="w-5 h-5" />
                        {cartDisabled ? 'Indisponible' : 'Ajouter au panier'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>

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

              {/* Technical specs */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-black text-[#0A0F1E] mb-6 flex items-center gap-3">
                    Ce qui est inclus
                    <div className="h-0.5 flex-grow bg-slate-100" />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: <Zap className="w-4 h-4" />, label: 'Chargeur rapide inclus' },
                      { icon: <Check className="w-4 h-4" />, label: 'Boîte Tel & Cash premium' },
                      { icon: <ShieldCheck className="w-4 h-4" />, label: (initialSku.warranty as string) || 'Garantie commerciale 24 mois' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-50 text-slate-700 font-bold text-sm">
                        <div className="text-blue-500">{item.icon}</div>
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#0A0F1E] mb-6 flex items-center gap-3">
                    Spécifications
                    <div className="h-0.5 flex-grow bg-slate-100" />
                  </h3>
                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
                    {[
                      { label: 'Marque', value: initialSku.brand },
                      { label: 'Modèle', value: initialSku.model },
                      { label: 'Stockage', value: selectedStorage },
                      { label: 'Couleur', value: selectedColor ? colorLabelFr(selectedColor) : null },
                      { label: 'État (Grade)', value: selectedGrade ? `${selectedGrade} — ${gradeLabelFr(selectedGrade)}` : null },
                      { label: 'Garantie', value: initialSku.warranty as string | undefined },
                    ]
                      .filter((row) => row.value)
                      .map((row, i) => (
                        <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                          <span className="font-bold text-slate-500">{row.label}</span>
                          <span className="font-black text-[#0A0F1E] text-right break-all">{row.value as string}</span>
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
