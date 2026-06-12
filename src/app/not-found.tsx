import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Smartphone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page introuvable — TEL & CASH',
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white px-4 text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-6">
        <Smartphone className="w-9 h-9 text-[#2F6BFF]" />
      </div>
      <p className="text-sm font-black uppercase tracking-widest text-[#2F6BFF] mb-2">Erreur 404</p>
      <h1 className="text-3xl md:text-4xl font-black text-[#0B1437] mb-3">
        Cette page n&apos;existe pas (ou plus)
      </h1>
      <p className="text-slate-600 mb-8 max-w-md">
        Le produit a peut-être été vendu, ou le lien est erroné. Nos smartphones
        reconditionnés vous attendent au catalogue.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-bold text-white bg-[#2F6BFF] hover:bg-blue-700 transition-colors"
        >
          Voir le catalogue <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-12 px-6 rounded-xl font-bold text-[#0B1437] border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
