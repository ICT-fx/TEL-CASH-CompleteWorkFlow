'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, ShoppingBag, Gift,
  Save, Loader2, CheckCircle, AlertCircle,
  Package, Clock, ChevronRight, Copy, Check,
  Star, TrendingUp, LogOut, Zap
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: 'En attente',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
  paid:      { label: 'Payée',       color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500' },
  shipped:   { label: 'Expédiée',    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
  delivered: { label: 'Livrée',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Annulée',     color: 'text-red-700',     bg: 'bg-red-50 border-red-200',       dot: 'bg-red-400' },
};

export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Loyalty
  const [totalPoints, setTotalPoints] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState<any>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!user) return;
    // Fetch orders
    fetch('/api/orders')
      .then(r => r.json())
      .then(d => { setOrders(d.orders || []); setOrdersLoading(false); })
      .catch(() => setOrdersLoading(false));

    // Fetch loyalty
    Promise.all([
      fetch('/api/loyalty/points').then(r => r.json()),
      fetch('/api/referral/my-code').then(r => r.json()),
    ]).then(([loyalty, referral]) => {
      setTotalPoints(loyalty.totalPoints || 0);
      setTransactions(loyalty.transactions || []);
      setReferralCode(referral.referralCode || null);
      setLoyaltyLoading(false);
    }).catch(() => setLoyaltyLoading(false));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    if (res.ok) setMessage({ type: 'success', text: 'Profil mis à jour !' });
    else setMessage({ type: 'error', text: 'Une erreur est survenue.' });
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const generateCode = async () => {
    setGenerating(true);
    const res = await fetch('/api/referral/generate', { method: 'POST' });
    const data = await res.json();
    setReferralCode(data.referralCode);
    setGenerating(false);
  };

  const copyCode = () => {
    if (referralCode?.code) {
      navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() || '?';

  const totalSpent = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay },
  });

  return (
    <div className="min-h-screen bg-[#F4F4F4] pb-24">

      {/* Hero header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <motion.div {...fade(0)} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-primary/30 flex-shrink-0">
                {initials}
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  {fullName || 'Mon compte'}
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{orders.length} commande{orders.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{totalSpent.toFixed(2)} € dépensés</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{totalPoints} points</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors px-4 py-2 rounded-xl hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-10 space-y-10">

        {/* ── 1. Informations personnelles ─────────────────────── */}
        <motion.section {...fade(0.05)}>
          <SectionHeader icon={<User className="w-5 h-5 text-primary" />} title="Informations personnelles" />
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">

            {message && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {message.type === 'success'
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {message.text}
              </motion.div>
            )}

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-150 bg-slate-50 text-slate-400 text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Full name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33 6 00 00 00 00"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </motion.section>

        {/* ── 2. Historique des commandes ──────────────────────── */}
        <motion.section {...fade(0.1)}>
          <SectionHeader icon={<ShoppingBag className="w-5 h-5 text-primary" />} title="Historique des commandes" badge={orders.length > 0 ? `${orders.length}` : undefined} />
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            {ordersLoading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="font-bold text-slate-700 mb-1">Aucune commande</h3>
                <p className="text-slate-400 text-sm mb-6">Vous n&apos;avez pas encore passé de commande.</p>
                <Link href="/products" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 text-sm">
                  Parcourir le catalogue <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {orders.map((order: any, i: number) => {
                  const s = statusConfig[order.status] || { label: order.status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' };
                  return (
                    <Link
                      key={order.id}
                      href={`/account/orders/${order.id}`}
                      className="group flex items-center justify-between px-6 py-5 hover:bg-slate-50/70 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors duration-200">
                          <ShoppingBag className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors duration-200" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <p className="text-base font-black text-slate-900 hidden sm:block">{parseFloat(order.total_amount).toFixed(2)} €</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${s.bg} ${s.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>

        {/* ── 3. Fidélité & Parrainage ─────────────────────────── */}
        <motion.section {...fade(0.15)}>
          <SectionHeader icon={<Gift className="w-5 h-5 text-primary" />} title="Fidélité & Parrainage" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Points */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              {loyaltyLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-slate-900">Mes points fidélité</h3>
                      <p className="text-xs text-slate-400 mt-0.5">1 point = 1 € dépensé</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-amber-500">{totalPoints}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">points</div>
                    </div>
                  </div>

                  {/* Points bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min((totalPoints / 500) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-right font-medium mb-6">{totalPoints} / 500 pts pour la prochaine récompense</p>

                  {/* Transactions */}
                  {transactions.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Historique</p>
                      {transactions.slice(0, 5).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-sm text-slate-700 font-medium">{t.reason}</p>
                            <p className="text-[11px] text-slate-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <span className="font-black text-emerald-600 text-sm">+{t.points}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">Passez votre première commande pour gagner des points !</p>
                  )}
                </>
              )}
            </div>

            {/* Referral */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Mon code parrainage</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Partagez et gagnez ensemble</p>
                </div>
              </div>

              {loyaltyLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : referralCode ? (
                <>
                  <div
                    onClick={copyCode}
                    className="group cursor-pointer flex items-center justify-between bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-2xl px-6 py-5 transition-all duration-200 mb-6"
                  >
                    <span className="font-mono text-2xl font-black text-slate-900 tracking-[0.2em]">{referralCode.code}</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${copied ? 'bg-emerald-100' : 'bg-white group-hover:bg-violet-100'}`}>
                      {copied
                        ? <Check className="w-4 h-4 text-emerald-600" />
                        : <Copy className="w-4 h-4 text-slate-400 group-hover:text-violet-600" />
                      }
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-black text-slate-900">{referralCode.times_used}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Utilisations</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-black text-violet-600">
                        {parseFloat(referralCode.discount_value).toFixed(0)}{referralCode.discount_type === 'percent' ? '%' : '€'}
                      </p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Réduction offerte</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    Cliquez sur le code pour le copier, puis partagez-le avec vos amis pour leur offrir une réduction exclusive !
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-violet-300" />
                  </div>
                  <p className="text-sm text-slate-500 mb-6">Vous n&apos;avez pas encore de code parrainage.</p>
                  <button
                    onClick={generateCode}
                    disabled={generating}
                    className="flex items-center gap-2 mx-auto px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 text-sm"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {generating ? 'Génération...' : 'Générer mon code'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
      {badge && (
        <span className="ml-1 px-2.5 py-0.5 bg-primary text-white text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}
