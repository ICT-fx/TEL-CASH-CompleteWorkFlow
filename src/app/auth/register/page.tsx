'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Mail, Lock, Smartphone, ArrowRight } from 'lucide-react';

function RegisterContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?redirect=/checkout : retour au parcours d'achat après inscription, même
  // logique que la page de connexion (cf. auth/login/page.tsx).
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    // Confirmation d'email désactivée : signUp ouvre directement une session.
    // Pas de nom demandé ici (friction en moins) — profiles.full_name reste
    // vide jusqu'au premier achat, où /api/checkout le complète depuis le
    // formulaire de livraison (prénom + nom déjà saisis à ce moment-là).
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Session ouverte → connexion immédiate, on repart vers le parcours en
    // cours (checkout…) plutôt que l'accueil, quand un redirect est fourni.
    if (data.session) {
      router.push(redirectTo);
      router.refresh();
      return;
    }

    // Pas de session sans erreur : cas où Supabase masque un email déjà
    // utilisé (réponse volontairement indistincte d'une inscription réussie).
    // On ne tente PAS de connexion ici — cela ferait de cette page un endpoint
    // de login sans rate-limiting et révélerait l'existence du compte. On
    // renvoie vers la page de connexion (qui porte les bonnes protections),
    // en conservant le redirect pour ne pas perdre le parcours en cours.
    router.push(redirectTo !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}` : '/auth/login');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Inscription</h1>
          <p className="text-slate-500 mt-2">Créez votre compte TEL & CASH</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm font-medium">{error}</div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  placeholder="votre@email.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  placeholder="••••••••" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Minimum 6 caractères</p>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/20 gap-2">
              {loading ? 'Création...' : 'Créer mon compte'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Déjà un compte ?{' '}
              <Link
                href={redirectTo !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}` : '/auth/login'}
                className="text-primary font-semibold hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// useSearchParams impose une frontière Suspense sur une page client.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
