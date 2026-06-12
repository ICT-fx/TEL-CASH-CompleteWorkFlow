'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { Mail, KeyRound, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError("Impossible d'envoyer l'email. Vérifiez l'adresse saisie et réessayez.");
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
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
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Mot de passe oublié</h1>
          <p className="text-slate-500 mt-2">
            Saisissez votre email, nous vous enverrons un lien de réinitialisation.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
                Si un compte existe pour <strong>{email}</strong>, un email de
                réinitialisation vient d&apos;être envoyé. Pensez à vérifier vos spams.
              </div>
              <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                      placeholder="votre@email.com"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/20"
                >
                  {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <Link href="/auth/login" className="text-sm text-primary font-semibold hover:underline">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
