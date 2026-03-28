'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingBag, Package, Loader2, ChevronRight, ArrowLeft, Clock } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'En attente',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  paid:      { label: 'Payée',       color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  shipped:   { label: 'Expédiée',    color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  delivered: { label: 'Livrée',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'Annulée',     color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch('/api/orders')
      .then((r) => r.json())
      .then((d) => { setOrders(d.orders || []); setLoading(false); });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

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
            href="/account"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Mon compte
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-lg shadow-primary/30">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Mes commandes</h1>
              <p className="text-slate-500 text-sm mt-0.5">{orders.length} commande{orders.length !== 1 ? 's' : ''} au total</p>
            </div>
          </div>
        </motion.div>

        {/* Empty state */}
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-3xl shadow-md border border-slate-100 p-16 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Aucune commande</h2>
            <p className="text-slate-400 text-sm mb-8">Vous n&apos;avez pas encore passé de commande.</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300"
            >
              Parcourir le catalogue
              <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        ) : (

          /* Orders list */
          <div className="space-y-4">
            {orders.map((order: any, i: number) => {
              const s = statusConfig[order.status] || { label: order.status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 * i }}
                >
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="group flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 p-6 transition-all duration-300"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-colors duration-200">
                        <ShoppingBag className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors duration-200" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-lg font-black text-slate-900">{parseFloat(order.total_amount).toFixed(2)} €</p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${s.bg} ${s.color}`}>
                        {s.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
