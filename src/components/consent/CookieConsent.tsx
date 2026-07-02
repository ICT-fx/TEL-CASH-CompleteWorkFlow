'use client';

// Bannière de consentement cookies (RGPD/CNIL) — discrète, premium, cohérente
// avec le design du site (navy #0B1437, bleu #2F6BFF, glass léger). Pas d'overlay
// bloquant : on peut naviguer sans répondre. Réouvrable via le footer.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Lock, BarChart3, Check } from 'lucide-react';
import { useConsent } from '@/store/useConsent';

export function CookieConsent() {
  const { loaded, decided, panelOpen, load, acceptAll, refuseAll, save, openPanel, closePanel } = useConsent();
  // Case « Mesure d'audience » du panneau (activée par défaut, décochable).
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => { load(); }, [load]);

  // Rien tant que non hydraté, ou si un choix a déjà été fait (et panneau fermé).
  if (!loaded || decided) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cookie-banner"
        role="dialog"
        aria-label="Gestion des cookies"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed z-[120] bottom-4 left-4 right-4 sm:right-auto sm:max-w-[400px]"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(11,20,55,0.10)',
          borderRadius: 18,
          boxShadow: '0 18px 50px -18px rgba(11,20,55,0.45)',
          padding: 18,
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{ width: 38, height: 38, background: 'rgba(47,107,255,0.10)' }}
          >
            <Cookie className="w-5 h-5" style={{ color: '#2F6BFF' }} />
          </span>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0B1437', marginBottom: 3 }}>
              Cookies &amp; confidentialité
            </p>
            <p style={{ fontSize: '0.8rem', lineHeight: 1.45, color: '#5A6172' }}>
              On utilise des cookies pour améliorer votre expérience et mesurer notre audience.{' '}
              <Link href="/confidentialite" style={{ color: '#2F6BFF', fontWeight: 600 }} className="hover:underline">
                En savoir plus
              </Link>
            </p>
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {!panelOpen ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="flex-1 rounded-xl text-white font-bold transition-colors"
                  style={{ background: '#2F6BFF', padding: '10px 14px', fontSize: '0.84rem' }}
                >
                  Tout accepter
                </button>
                <button
                  type="button"
                  onClick={refuseAll}
                  className="rounded-xl font-bold transition-colors"
                  style={{ background: '#F1F4FB', color: '#0B1437', padding: '10px 16px', fontSize: '0.84rem', border: '1px solid rgba(11,20,55,0.08)' }}
                >
                  Refuser
                </button>
              </div>
              <button
                type="button"
                onClick={openPanel}
                className="mt-2.5 w-full text-center hover:underline"
                style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7A99' }}
              >
                Personnaliser
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 overflow-hidden"
            >
              {/* Essentiels — toujours actifs */}
              <div
                className="flex items-center gap-3 rounded-xl"
                style={{ background: '#F8F9FC', padding: '11px 12px', marginBottom: 8 }}
              >
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: '#6B7A99' }} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0B1437' }}>Essentiels</p>
                  <p style={{ fontSize: '0.72rem', color: '#8A92A0', lineHeight: 1.35 }}>
                    Panier, session, paiement. Toujours actifs.
                  </p>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8A92A0' }}>Requis</span>
              </div>

              {/* Mesure d'audience — décochable */}
              <button
                type="button"
                onClick={() => setAnalyticsChecked((v) => !v)}
                className="w-full flex items-center gap-3 rounded-xl text-left"
                style={{ background: '#F8F9FC', padding: '11px 12px', border: '1px solid rgba(11,20,55,0.06)' }}
              >
                <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: '#2F6BFF' }} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0B1437' }}>Mesure d&apos;audience</p>
                  <p style={{ fontSize: '0.72rem', color: '#8A92A0', lineHeight: 1.35 }}>
                    Statistiques de visite (Vercel Analytics + interne).
                  </p>
                </div>
                {/* Toggle */}
                <span
                  className="flex-shrink-0 rounded-full transition-colors"
                  style={{
                    width: 38, height: 22, padding: 2,
                    background: analyticsChecked ? '#2F6BFF' : '#CBD5E1',
                    display: 'inline-flex', alignItems: 'center',
                    justifyContent: analyticsChecked ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {analyticsChecked && <Check className="w-3 h-3" style={{ color: '#2F6BFF' }} strokeWidth={3} />}
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2.5 mt-3.5">
                <button
                  type="button"
                  onClick={() => save(analyticsChecked)}
                  className="flex-1 rounded-xl text-white font-bold"
                  style={{ background: '#2F6BFF', padding: '10px 14px', fontSize: '0.84rem' }}
                >
                  Enregistrer mes choix
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-xl font-bold"
                  style={{ background: '#F1F4FB', color: '#0B1437', padding: '10px 16px', fontSize: '0.84rem', border: '1px solid rgba(11,20,55,0.08)' }}
                >
                  Retour
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
