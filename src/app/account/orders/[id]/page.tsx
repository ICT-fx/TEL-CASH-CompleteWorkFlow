'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Clock, Truck, MapPin, Tag,
  Loader2, AlertCircle, Receipt
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string; step: number }> = {
  pending:   { label: 'Attente paiement',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     step: 1 },
  paid:      { label: 'Payée',       color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       step: 2 },
  shipped:   { label: 'Expédiée',    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200',   step: 3 },
  delivered: { label: 'Livrée',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', step: 4 },
  cancelled: { label: 'Annulée',     color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         step: 0 },
};

const steps = [
  { id: 1, label: 'Attente paiement' },
  { id: 2, label: 'Payée' },
  { id: 3, label: 'Expédiée' },
  { id: 4, label: 'Livrée' },
];

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch(`/api/orders/${params.id}`)
      .then((r) => r.json())
      .then((d) => { setOrder(d.order); setItems(d.items || []); setLoading(false); });
  }, [user, params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Commande introuvable</h2>
          <Link href="/account/orders" className="text-primary font-semibold hover:underline">
            ← Retour à mes commandes
          </Link>
        </div>
      </div>
    );
  }

  const s = statusConfig[order.status] || { label: order.status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', step: 0 };
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Mes commandes
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-lg shadow-primary/30">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Commande #{order.id.slice(0, 8).toUpperCase()}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-400">
                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${s.bg} ${s.color}`}>
              {s.label}
            </span>
          </div>
        </motion.div>

        {/* Progress bar */}
        {!isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-3xl shadow-md border border-slate-100 p-6 mb-6"
          >
            <div className="flex items-start justify-between relative">
              {/* Track line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 mx-12" />
              <div
                className="absolute top-5 left-0 h-0.5 bg-primary mx-12 transition-all duration-700"
                style={{ width: `${((s.step - 1) / (steps.length - 1)) * (100 - 0)}%` }}
              />
              {steps.map((step) => {
                const done = s.step >= step.id;
                const current = s.step === step.id;
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      done
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-slate-200 text-slate-300'
                    } ${current ? 'ring-4 ring-primary/20' : ''}`}>
                      <span className="text-xs font-bold">{step.id}</span>
                    </div>
                    <span className={`text-xs font-semibold text-center ${done ? 'text-slate-700' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Articles commandés</h2>
              </div>

              <div className="divide-y divide-slate-50">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.product?.brand} {item.product?.model}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Qté : {item.quantity}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {parseFloat(item.price_at_purchase).toFixed(2)} €
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Total</span>
                <span className="text-xl font-black text-slate-900">{parseFloat(order.total_amount).toFixed(2)} €</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-semibold">
                    Réduction appliquée : -{parseFloat(order.discount_amount).toFixed(2)} €
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Delivery info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Livraison</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Mode</p>
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {order.shipping_method?.replace(/_/g, ' ') || '—'}
                    </p>
                  </div>
                </div>

                {order.tracking_number && (
                  <div className="flex items-start gap-3">
                    <Truck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Numéro de suivi</p>
                      <p className="text-sm font-mono font-semibold text-primary">{order.tracking_number}</p>
                    </div>
                  </div>
                )}
                {order.tracking_url && (
                  <div className="flex items-start gap-3">
                    <Truck className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Suivi de livraison</p>
                      <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Suivre mon colis →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
