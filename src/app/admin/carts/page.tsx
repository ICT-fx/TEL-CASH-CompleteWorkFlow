'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, MailWarning } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { normalizeGradeLetter } from '@/lib/products';
import { CRON_HOUR_UTC } from '@/lib/abandonedCart';

// Paniers abandonnés : le client a commencé à payer puis s'est arrêté.
// La relance est AUTOMATIQUE (cron /api/cron/abandoned-cart) : cet écran ne
// relance rien, il montre seulement où en est chaque panier. Données :
// GET /api/admin/carts (mêmes règles que le cron, lib/abandonedCart).

type Kind = 'sent' | 'recovered' | 'scheduled' | 'cooldown' | 'no_email' | 'opted_out' | 'too_old' | 'grouped';

interface Cart {
  id: string;
  created_at: string;
  total_amount: number;
  name: string | null;
  email: string | null;
  items: { title: string; quantity: number; storage: string | null; grade: string | null }[];
  reminder: { kind: Kind; at: string | null; afterReminder: boolean };
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

function when(iso: string, approx = false): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const hh = d.getHours(), mm = d.getMinutes();
  const time = (approx ? 'vers ' : '') + (mm === 0 ? `${hh} h` : `${hh} h ${String(mm).padStart(2, '0')}`);
  if (diff === 0) return `aujourd’hui ${time}`;
  if (diff === -1) return `hier ${time}`;
  if (diff === 1) return `demain ${time}`;
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} ${time}`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function status(r: Cart['reminder']): { label: string; tone: 'blue' | 'green' | 'ok' | 'mute' } {
  switch (r.kind) {
    case 'scheduled': return { label: `Relance prévue ${r.at ? when(r.at, true) : ''}`.trim(), tone: 'blue' };
    case 'sent': return { label: `Relance envoyée ${r.at ? when(r.at) : ''}`.trim(), tone: 'ok' };
    case 'recovered': return { label: r.afterReminder ? 'Racheté après la relance' : 'A racheté ensuite', tone: 'green' };
    case 'grouped': return { label: 'Relance déjà prévue pour son autre panier', tone: 'mute' };
    case 'cooldown': return { label: 'Déjà relancé ce mois-ci', tone: 'mute' };
    case 'no_email': return { label: 'Pas de relance · aucun e-mail', tone: 'mute' };
    case 'opted_out': return { label: 'Pas de relance · désinscrit', tone: 'mute' };
    case 'too_old': return { label: 'Trop ancien pour relancer', tone: 'mute' };
  }
}

export default function AdminCartsPage() {
  const [carts, setCarts] = useState<Cart[] | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [error, setError] = useState(false);
  // Heure de passage du cron dans le fuseau d'Édouard (calculée côté navigateur).
  const [cronHour, setCronHour] = useState('midi');
  useEffect(() => {
    const h = (month: number) => new Date(Date.UTC(2026, month, 1, CRON_HOUR_UTC)).getHours();
    setCronHour(h(6) === h(0) ? `${h(6)} h` : `${h(6)} h (${h(0)} h en hiver)`);
  }, []);

  useEffect(() => {
    fetch('/api/admin/carts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setCarts(d.carts || []); setEmailConfigured(d.emailConfigured !== false); })
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="bo-card" role="alert">Impossible de charger les paniers. Recharge la page dans un instant.</div>;

  const list = carts ?? [];
  const total = list.reduce((s, c) => s + c.total_amount, 0);
  const sent = list.filter((c) => c.reminder.kind === 'sent' || (c.reminder.kind === 'recovered' && c.reminder.afterReminder)).length;
  const recovered = list.filter((c) => c.reminder.kind === 'recovered' && c.reminder.afterReminder);

  return (
    <div className="bo-page">
      <header className="bo-head">
        <h1>Paniers abandonnés</h1>
        <p>Des clients ont commencé à payer puis se sont arrêtés · 30 derniers jours</p>
      </header>

      {!emailConfigured && (
        <div className="bo-cart-warn" role="status">
          <MailWarning className="w-4 h-4" aria-hidden />
          <span><b>Les relances ne partent pas pour l’instant.</b> Aucun service d’e-mail n’est branché sur le site (Resend ou SMTP). Tout est prêt : dès qu’il est branché, les relances partent toutes seules.</span>
        </div>
      )}

      <section className="bo-grid bo-g3c" aria-label="Résumé">
        <div className="bo-card"><p className="bo-kpi-l">Paniers</p><p className="bo-kpi-v">{carts ? list.length : '—'}</p><p className="bo-kpi-why">{carts ? `${eur(total)} au total` : ' '}</p></div>
        <div className="bo-card"><p className="bo-kpi-l">Relances envoyées</p><p className="bo-kpi-v">{carts ? sent : '—'}</p><p className="bo-kpi-why">par e-mail, automatiquement</p></div>
        <div className="bo-card"><p className="bo-kpi-l">Rachetés après la relance</p><p className="bo-kpi-v">{carts ? recovered.length : '—'}</p><p className="bo-kpi-why">{recovered.length ? `${eur(recovered.reduce((s, c) => s + c.total_amount, 0))} récupérés` : ' '}</p></div>
      </section>

      <section className="bo-card bo-flush" style={{ marginTop: 14 }} aria-label="Liste des paniers">
        {carts === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }} aria-busy="true" aria-label="Chargement">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="bo-cart-empty">
            <ShoppingCart className="w-7 h-7" aria-hidden />
            <b>Aucun panier abandonné</b>
            <span>Quand un client s’arrête au paiement, il apparaît ici avec l’état de sa relance.</span>
          </div>
        ) : (
          <ul className="bo-carts">
            <li className="bo-cart bo-cart-head" aria-hidden>
              <span>Client</span><span>Panier</span><span className="r">Valeur</span><span>Parti</span><span>Relance automatique</span>
            </li>
            {list.map((c) => {
              const s = status(c.reminder);
              const first = c.items[0];
              const grade = first ? normalizeGradeLetter(first.grade) : null;
              return (
                <li key={c.id} className="bo-cart">
                  <span className="bo-cart-who">
                    <Avatar name={c.name} email={c.email} size={30} />
                    <span><b>{c.name || c.email || 'Client sans compte'}</b>{c.name && c.email && <small>{c.email}</small>}</span>
                  </span>
                  <span className="bo-cart-dev">
                    {first ? (
                      <>
                        {first.title}{first.storage ? ` ${first.storage}` : ''}{grade ? ` · ${grade}` : ''}
                        {c.items.length > 1 && <small>+ {c.items.length - 1} autre{c.items.length > 2 ? 's' : ''} article{c.items.length > 2 ? 's' : ''}</small>}
                      </>
                    ) : <small>panier vide</small>}
                  </span>
                  <span className="bo-cart-amt r">{eur(c.total_amount)}</span>
                  <span className="bo-cart-when">{when(c.created_at)}</span>
                  <span><span className={`bo-tag bo-tag-${s.tone}`}>{s.label}</span></span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="bo-cart-note">
          Le site relance tout seul par e-mail : chaque jour à {cronHour}, il écrit aux clients dont le panier attend depuis plus de 2 jours
          (jusqu’à 14 jours), avec le panier et un lien pour payer. Une seule relance par client et par mois, jamais aux désinscrits. Rien à faire de ton côté.
        </p>
      </section>
    </div>
  );
}
