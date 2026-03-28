'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg text-center"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8"
          >
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </motion.div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-4">
            Commande confirmée !
          </h1>
          <p className="text-slate-500 text-lg mb-2">
            Votre paiement a été accepté avec succès.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Un email de confirmation vous a été envoyé.
          </p>

          {sessionId && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-8 border border-slate-100">
              <p className="text-xs text-slate-400 font-medium">
                Référence Stripe : {sessionId.slice(0, 24)}...
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/account/orders">
              <Button className="gap-2 w-full sm:w-auto">
                <Package className="w-4 h-4" />
                Mes commandes
              </Button>
            </Link>
            <Link href="/products">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                Continuer mes achats
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
