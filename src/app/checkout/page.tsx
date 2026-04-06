'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/store/useCart';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Truck, 
  CreditCard, 
  ChevronRight, 
  ArrowLeft, 
  Check, 
  MapPin, 
  Phone, 
  Info,
  Loader2,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

type Step = 2 | 3;

interface AddressForm {
  firstName: string;
  lastName: string;
  country: string;
  address: string;
  complement?: string;
  details?: string; // étage, bâtiment, digicode
  zipCode: string;
  city: string;
  phoneCode: string;
  phone: string;
  addressName?: string;
  isDefaultDelivery: boolean;
  isDefaultBilling: boolean;
}

const steps = [
  { id: 1, name: 'Panier', icon: ShoppingBag, path: '/cart' },
  { id: 2, name: 'Livraison', icon: Truck, path: null },
  { id: 3, name: 'Paiement', icon: CreditCard, path: null },
];

export default function CheckoutPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { items, fetchCart } = useCart();
  
  const [step, setStep] = useState<Step>(2);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  
  const [shippingMethod, setShippingMethod] = useState('chronopost_domicile');
  const [formData, setFormData] = useState<AddressForm>({
    firstName: '',
    lastName: '',
    country: 'France métropolitaine',
    address: '',
    zipCode: '',
    city: '',
    phoneCode: '+33',
    phone: '',
    isDefaultDelivery: true,
    isDefaultBilling: true,
  });

  const shippingCosts: Record<string, number> = {
    mondial_relay: 0,
    chronopost_domicile: 0,
    chronopost_relay: 0,
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      fetchCart().finally(() => setLoading(false));
      if (profile) {
        const names = profile.full_name?.split(' ') || [];
        setFormData(prev => ({
          ...prev,
          firstName: names[0] || '',
          lastName: names.slice(1).join(' ') || '',
          phone: profile.phone || '',
        }));
      }
    }
  }, [user, authLoading, profile, router, fetchCart]);

  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shipping = shippingCosts[shippingMethod] || 0;
  const total = subtotal + shipping;

  const handleNextStep = async () => {
    if (step === 2) {
      // Validate form
      if (!formData.firstName || !formData.lastName || !formData.address || !formData.zipCode || !formData.city || !formData.phone) {
        setError('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      setStep(3);
      window.scrollTo(0, 0);
    } else {
      handleFinalCheckout();
    }
  };

  const handleFinalCheckout = async () => {
    setProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_method: shippingMethod,
          shipping_address: {
            ...formData,
            phone: `${formData.phoneCode || '+33'}${formData.phone.replace(/^0/, '')}`
          },
        }),
      });
      const data = await res.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        setError(data.error || 'Erreur lors du checkout');
        setProcessing(false);
      }
    } catch {
      setError('Erreur réseau');
      setProcessing(false);
    }
  };

  if (authLoading || (loading && items.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <ShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Votre panier est vide</h1>
        <p className="text-slate-500 mb-6">Ajoutez des articles à votre panier avant de passer commande.</p>
        <Link href="/products"><Button>Retour au catalogue</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] pb-20">
      {/* Header / Progress Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="text-2xl font-black tracking-tighter text-slate-900">
            TEL <span className="text-[#0062E6]">&amp;</span> CASH
          </Link>
          
          <div className="flex items-center gap-0 md:gap-4">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <Link 
                  href={s.id === 1 ? '/cart' : '#'}
                  onClick={(e) => s.id !== 1 && e.preventDefault()}
                  className={`flex flex-col items-center gap-1 group transition-all ${
                    s.id === step ? 'scale-110' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    s.id < step ? 'bg-[#333] border-[#333] text-white' : 
                    s.id === step ? 'border-[#333] text-[#333] font-bold' : 
                    'border-slate-200 text-slate-400'
                  }`}>
                    {s.id < step ? <Check className="w-5 h-5" /> : <span>{s.id}</span>}
                  </div>
                  <span className={`text-[11px] uppercase tracking-wider font-bold ${
                    s.id <= step ? 'text-slate-900' : 'text-slate-400'
                  }`}>
                    {s.name}
                  </span>
                </Link>
                {i < steps.length - 1 && (
                  <div className={`w-8 md:w-16 h-[2px] mx-2 mb-4 transition-all ${
                    s.id < step ? 'bg-[#333]' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="hidden lg:flex items-center gap-2 text-slate-500 text-sm">
            <Lock className="w-4 h-4" />
            <span>Paiement sécurisé</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {step === 2 ? (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 mb-2">
                    <button 
                      onClick={() => router.push('/cart')}
                      className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-3xl font-black text-slate-900 uppercase">Vos modes de livraison</h1>
                  </div>

                  {/* Cart Items Recap */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                        Choisissez lors de cette étape la livraison du produit vendu et livré par <span className="text-[#0062E6]">TEL &amp; CASH</span> ({items.length} produit{items.length > 1 ? 's' : ''})
                      </p>
                      <ChevronRight className="w-5 h-5 rotate-90 text-slate-400" />
                    </div>
                    <div className="p-5 divide-y divide-slate-100">
                      {items.map((item) => (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-lg p-2 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{item.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{item.storage} Go · Grade {item.grade} · {item.color}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900 text-sm">{item.price.toFixed(2)} €</p>
                            <p className="text-[10px] text-slate-400 uppercase mt-1">Qté: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Form */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-8">
                    <div>
                      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-[#0062E6]" />
                        Adresse de livraison
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Prénom</label>
                          <input 
                            type="text" 
                            value={formData.firstName}
                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="Ex: Fantin" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nom</label>
                          <input 
                            type="text" 
                            value={formData.lastName}
                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="Ex: Schellekens" 
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Sélectionner un pays</label>
                          <select 
                            value={formData.country}
                            onChange={(e) => setFormData({...formData, country: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]"
                          >
                            <option>France métropolitaine</option>
                            <option>Belgique</option>
                            <option>Luxembourg</option>
                            <option>Suisse</option>
                          </select>
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Adresse postale</label>
                          <input 
                            type="text" 
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="Ex: 8 rue de la Mairie" 
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Complément d&apos;adresse (facultatif)</label>
                          <input 
                            type="text" 
                            value={formData.complement}
                            onChange={(e) => setFormData({...formData, complement: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Étage, bâtiment, digicode... (facultatif)</label>
                          <input 
                            type="text" 
                            value={formData.details}
                            onChange={(e) => setFormData({...formData, details: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Code postal</label>
                          <input 
                            type="text" 
                            value={formData.zipCode}
                            onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="75001" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Ville</label>
                          <input 
                            type="text" 
                            value={formData.city}
                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="Paris" 
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Numéro de téléphone</label>
                          <div className="flex border-b-2 border-transparent focus-within:border-[#0062E6] transition-all bg-[#F8F9FA]">
                            <select 
                              value={formData.phoneCode || '+33'}
                              onChange={(e) => setFormData({...formData, phoneCode: e.target.value})}
                              className="w-24 h-12 bg-transparent outline-none font-bold text-slate-600 px-2 border-r border-slate-200"
                            >
                              <option value="+33">🇫🇷 +33</option>
                              <option value="+32">🇧🇪 +32</option>
                              <option value="+352">🇱🇺 +352</option>
                              <option value="+41">🇨🇭 +41</option>
                            </select>
                            <input 
                              type="tel" 
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                              className="flex-grow h-12 bg-transparent px-4 outline-none font-medium text-slate-900" 
                              placeholder="612345678" 
                            />
                          </div>
                          <div className="flex items-start gap-2 pt-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                                <Info className="w-3 h-3 text-yellow-600" />
                            </div>
                            <p className="text-[11px] text-slate-500 leading-tight">
                                Le numéro de téléphone permet de faciliter votre livraison par nos transporteurs partenaires.
                            </p>
                          </div>
                        </div>
                        <div className="md:col-span-2 space-y-1.5 pt-4">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nom de l&apos;adresse (facultatif)</label>
                          <input 
                            type="text" 
                            value={formData.addressName}
                            onChange={(e) => setFormData({...formData, addressName: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-b-2 border-transparent focus:border-[#0062E6] transition-all px-4 outline-none font-medium text-slate-900 bg-[#F8F9FA]" 
                            placeholder="Ex: Maison, Travail..." 
                          />
                          <div className="flex items-start gap-2 pt-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                                <Info className="w-3 h-3 text-yellow-600" />
                            </div>
                            <p className="text-[11px] text-slate-500 leading-tight">
                                Nommer votre adresse vous permettra de la retrouver plus facilement dans votre liste d&apos;adresses.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group w-fit">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                formData.isDefaultDelivery ? 'bg-[#00b06b] border-[#00b06b]' : 'border-slate-200'
                            }`}>
                                {formData.isDefaultDelivery && <Check className="w-4 h-4 text-white" />}
                                <input 
                                    type="checkbox" 
                                    checked={formData.isDefaultDelivery} 
                                    onChange={(e) => setFormData({...formData, isDefaultDelivery: e.target.checked})}
                                    className="hidden" 
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Adresse de livraison par défaut</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group w-fit">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                formData.isDefaultBilling ? 'bg-[#00b06b] border-[#00b06b]' : 'border-slate-200'
                            }`}>
                                {formData.isDefaultBilling && <Check className="w-4 h-4 text-white" />}
                                <input 
                                    type="checkbox" 
                                    checked={formData.isDefaultBilling} 
                                    onChange={(e) => setFormData({...formData, isDefaultBilling: e.target.checked})}
                                    className="hidden" 
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Adresse de facturation par défaut</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#0062E6]" />
                        Mode de livraison
                      </h2>
                      <div className="p-5 rounded-2xl border-2 border-[#00b06b] bg-green-50/30 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#00b06b] uppercase text-sm tracking-tight">Livraison Express Offerte</p>
                          <p className="text-xs text-slate-500 mt-1">Livraison sécurisée à domicile sous 24h-48h</p>
                        </div>
                        <Check className="w-6 h-6 text-[#00b06b]" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4 mb-2">
                    <button 
                      onClick={() => setStep(2)}
                      className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-3xl font-black text-slate-900 uppercase">Paiement sécurisé</h1>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Prêt pour le paiement</h2>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Vos informations de livraison ont été enregistrées. Cliquez sur le bouton ci-dessous pour être redirigé vers notre plateforme de paiement sécurisée Stripe.
                        </p>
                    </div>
                    
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Livraison à</span>
                            <span className="text-slate-900 font-bold">{formData.firstName} {formData.lastName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Adresse</span>
                            <span className="text-slate-900 font-medium text-right">{formData.address}, {formData.zipCode} {formData.city}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Méthode</span>
                            <span className="text-slate-900 font-bold uppercase">{shippingMethod.replace('_', ' ')}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-50">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" alt="Visa" className="h-4" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" className="h-8" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png" alt="Stripe" className="h-6" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-36">
              <h3 className="font-bold text-xl mb-6 uppercase tracking-tight">Récapitulatif</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Panier ({items.length} {items.length > 1 ? 'articles' : 'article'})</span>
                  <span className="font-bold text-slate-900">{subtotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Frais de livraison</span>
                  <span className={`font-bold ${shipping === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                    {shipping === 0 ? 'Gratuit' : `${shipping.toFixed(2)} €`}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 mb-8">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-lg font-black uppercase tracking-tight">Total <span className="text-[10px] text-slate-400 font-normal">(TVA incluse)</span></span>
                  <span className="text-3xl font-black text-[#0062E6]">{total.toFixed(2)} €</span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold mb-6 animate-shake">
                    {error}
                </div>
              )}

              <Button 
                onClick={handleNextStep}
                disabled={processing}
                className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:translate-y-0"
              >
                {processing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <span>
                        {step === 2 ? "Passer à l'étape suivante" : "Procéder au paiement"}
                    </span>
                )}
              </Button>

              <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Modes de paiement sécurisés</p>
                <div className="flex items-center justify-center gap-4 grayscale opacity-30">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" alt="Visa" className="h-2" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" className="h-5" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png" alt="Stripe" className="h-4" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
