'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { Avatar } from '@/components/admin/ui/Avatar';
import { normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { pickupAwareLabel } from '@/lib/orderStatus';

// Écran « Aujourd'hui » — remplace l'ancien tableau de bord.
// Il répond d'abord à « qu'est-ce que je dois faire maintenant ? », puis
// donne les chiffres de la semaine (CA net, même calcul partout :
// lib/admin/sales) et les alertes. Données : GET /api/admin/today.

interface Today {
  actions: {
    toPrepare: number; toPreparePickup: number; waitingSupplier: number;
    pickupsReady: number; returnsToHandle: number; cartsOpen: number; cartsValue: number;
  };
  week: {
    net: number; netDelta: number | null; orders: number; ordersDiff: number;
    avgBasket: number; avgBasketDelta: number | null; refunded: number;
    margin: number; marginKnown: boolean; days: { date: string; total: number }[];
  };
  alerts: {
    bestSellersLow: {
      id: string; brand: string | null; model: string | null; stock: number;
      storage_capacity: string | null; grade: string | null; color: string | null; sold30: number;
    }[];
    excludedTestOrders: number;
  };
  recentOrders: any[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const pct = (n: number | null) => (n == null ? null : `${n > 0 ? '+' : ''}${Math.round(n)} %`);

function Delta({ value, suffix }: { value: string | null; suffix?: string }) {
  if (!value) return <p className="bo-kpi-d bo-muted">{suffix || ' '}</p>;
  const down = value.startsWith('-') || value.startsWith('−');
  return <p className={`bo-kpi-d ${down ? 'bo-down' : 'bo-up'}`}>{value}{suffix ? ` ${suffix}` : ''}</p>;
}

function WeekBars({ days }: { days: { date: string; total: number }[] }) {
  const max = Math.max(500, ...days.map((d) => d.total));
  const step = max > 2000 ? 1000 : 500;
  const top = Math.ceil(max / step) * step;
  const W = 560, H = 160, pl = 40, pb = 24, pt = 8;
  const bw = (W - pl) / days.length;
  const y = (v: number) => H - pb - (v / top) * (H - pb - pt);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const today = new Date().toISOString().slice(0, 10);
  const label = days.map((d) => `${new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'long' })} ${eur(d.total)}`).join(', ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`CA net par jour sur 7 jours : ${label}`} style={{ display: 'block', marginTop: 14 }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W} y1={y(t)} y2={y(t)} stroke="#E3E8F2" />
          <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#5B6478">{t.toLocaleString('fr-FR')}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pl + i * bw + bw * 0.22;
        const h = (d.total / top) * (H - pb - pt);
        const isToday = d.date === today;
        return (
          <g key={d.date}>
            <rect x={x} y={H - pb - h} width={bw * 0.56} height={Math.max(h, 0)} rx="5" fill={isToday ? '#2563EB' : '#BFD2FF'}>
              <title>{`${new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${eur(d.total)}`}</title>
            </rect>
            <text x={x + bw * 0.28} y={H - 6} textAnchor="middle" fontSize="11" fill="#5B6478">
              {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function lowStockLabel(p: Today['alerts']['bestSellersLow'][number]): string {
  const grade = normalizeGradeLetter(p.grade);
  return [
    [p.brand, p.model].filter(Boolean).join(' '),
    p.storage_capacity || null,
    grade ? `Grade ${grade}` : null,
    p.color ? colorLabelFr(p.color) : null,
  ].filter(Boolean).join(' · ');
}

export default function AdminTodayPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/today')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0];
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (error) {
    return <div className="bo-card" role="alert">Impossible de charger l&apos;écran. Recharge la page dans un instant.</div>;
  }
  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }} aria-busy="true" aria-label="Chargement">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { actions: a, week: w, alerts } = data;
  const marginPct = w.net > 0 ? Math.round((w.margin / w.net) * 100) : null;
  const alertCount = alerts.bestSellersLow.length + (a.waitingSupplier > 0 ? 1 : 0);

  const cards = [
    {
      n: a.toPrepare, label: a.toPrepare > 1 ? 'Commandes à préparer' : 'Commande à préparer',
      hint: a.toPreparePickup > 0 ? `payées · dont ${a.toPreparePickup} en retrait boutique` : 'payées, pas encore expédiées',
      go: 'Préparer', href: '/admin/orders?status=paid', hot: a.toPrepare > 0,
    },
    {
      n: a.pickupsReady, label: a.pickupsReady > 1 ? 'Retraits en boutique' : 'Retrait en boutique',
      hint: 'prêtes, le client doit passer', go: 'Vérifier un code', href: '/admin/verification-retrait', hot: false,
    },
    {
      n: a.returnsToHandle, label: a.returnsToHandle > 1 ? 'Retours à traiter' : 'Retour à traiter',
      hint: 'demandés, reçus ou en contrôle', go: 'Ouvrir', href: '/admin/returns', hot: a.returnsToHandle > 0,
    },
    {
      n: a.cartsOpen, label: a.cartsOpen > 1 ? 'Paniers à relancer' : 'Panier à relancer',
      hint: a.cartsOpen > 0 ? `${eur(a.cartsValue)} en attente · 7 derniers jours` : '7 derniers jours',
      go: 'Relancer', href: '/admin/carts', hot: false,
    },
  ];

  return (
    <div className="bo-page">
      <header className="bo-head">
        <h1>{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h1>
        <p>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · voilà ce qui t&apos;attend aujourd&apos;hui</p>
      </header>

      <section aria-label="À faire" className="bo-grid bo-g4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={`bo-act ${c.hot ? 'bo-act-hot' : ''}`}>
            <span className="bo-act-n">{c.n}</span>
            <span className="bo-act-l">{c.label}</span>
            <span className="bo-act-h">{c.hint}</span>
            <span className="bo-act-go">{c.go} <ArrowRight className="w-3.5 h-3.5" aria-hidden /></span>
          </Link>
        ))}
      </section>

      <div className="bo-grid bo-g21" style={{ marginTop: 14 }}>
        <section className="bo-card" aria-labelledby="bo-week">
          <div className="bo-card-h">
            <h2 id="bo-week">Ces 7 derniers jours</h2>
            <span className="bo-muted">comparé aux 7 jours d&apos;avant</span>
          </div>
          <div className="bo-grid bo-g4 bo-kpis">
            <div>
              <p className="bo-kpi-l">CA net</p>
              <p className="bo-kpi-v">{eur(w.net)}</p>
              <Delta value={pct(w.netDelta)} />
              <p className="bo-kpi-why">remboursements déduits, tests exclus</p>
            </div>
            <div>
              <p className="bo-kpi-l">Commandes payées</p>
              <p className="bo-kpi-v">{w.orders}</p>
              <Delta value={w.ordersDiff === 0 ? null : `${w.ordersDiff > 0 ? '+' : ''}${w.ordersDiff}`} suffix={w.ordersDiff === 0 ? 'comme avant' : undefined} />
            </div>
            <div>
              <p className="bo-kpi-l">Panier moyen</p>
              <p className="bo-kpi-v">{w.orders ? eur(w.avgBasket) : '—'}</p>
              <Delta value={pct(w.avgBasketDelta)} />
            </div>
            <div>
              <p className="bo-kpi-l">Marge brute</p>
              <p className="bo-kpi-v">{w.orders ? eur(w.margin) : '—'}</p>
              <p className="bo-kpi-d bo-muted">
                {marginPct != null ? `${marginPct} % du CA` : ' '}
                {!w.marginKnown ? ' · coût manquant sur certaines lignes' : ''}
              </p>
            </div>
          </div>
          <WeekBars days={w.days} />
          {w.refunded > 0 && <p className="bo-muted" style={{ marginTop: 8 }}>{eur(w.refunded)} remboursés sur la période, déjà déduits.</p>}
        </section>

        <section className="bo-card" aria-labelledby="bo-watch">
          <div className="bo-card-h"><h2 id="bo-watch">À surveiller</h2>{alertCount > 0 && <span className="bo-pill">{alertCount}</span>}</div>
          <ul className="bo-alerts">
            {alerts.bestSellersLow.map((p) => (
              <li key={p.id} className="bo-al bo-al-red">
                <AlertTriangle className="w-4 h-4" aria-hidden />
                <div>
                  <b>{lowStockLabel(p)}</b>
                  <span>{p.stock <= 0 ? 'en rupture' : 'plus que 1 en stock'} · vendu {p.sold30} fois en 30 jours</span>
                </div>
                <button type="button" className="bo-link" onClick={() => router.push(`/admin/products?search=${encodeURIComponent([p.brand, p.model].filter(Boolean).join(' '))}`)}>Voir</button>
              </li>
            ))}
            {a.waitingSupplier > 0 && (
              <li className="bo-al bo-al-amber">
                <Info className="w-4 h-4" aria-hidden />
                <div><b>{a.waitingSupplier} commande{a.waitingSupplier > 1 ? 's' : ''} chez le fournisseur</b><span>payées, en attente de réception</span></div>
                <Link className="bo-link" href="/admin/orders?status=supplier_ordered">Voir</Link>
              </li>
            )}
            {alerts.excludedTestOrders > 0 && (
              <li className="bo-al bo-al-green">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                <div><b>{alerts.excludedTestOrders} commande{alerts.excludedTestOrders > 1 ? 's' : ''} de l&apos;équipe ignorée{alerts.excludedTestOrders > 1 ? 's' : ''}</b><span>passées par un compte admin, hors des chiffres (30 jours)</span></div>
              </li>
            )}
            {alertCount === 0 && alerts.excludedTestOrders === 0 && (
              <li className="bo-al bo-al-green">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                <div><b>Rien à signaler</b><span>aucun modèle qui se vend bien n&apos;est en rupture</span></div>
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="bo-card bo-flush" style={{ marginTop: 14 }} aria-labelledby="bo-recent">
        <div className="bo-card-h" style={{ padding: '16px 20px 6px' }}>
          <h2 id="bo-recent">Dernières commandes</h2>
          <Link href="/admin/orders" className="bo-link">Tout voir <ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="bo-muted" style={{ padding: '0 20px 18px' }}>Aucune commande pour l&apos;instant.</p>
        ) : (
          <ul className="bo-orders">
            {data.recentOrders.map((o: any) => {
              const isPickup = o.delivery_method === 'pickup';
              const refunded = o.status === 'cancelled' && Boolean(o.refunded_at || o.refund_amount);
              const who = o.profile?.full_name || o.profile?.email || o.guest_email || 'Client';
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="bo-order">
                    <Avatar name={o.profile?.full_name} email={o.profile?.email || o.guest_email} size={34} />
                    <span className="bo-order-who">
                      <b>{who}</b>
                      <span>{o.order_number != null ? `n°${o.order_number} · ` : ''}{new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="bo-order-amt" style={{ textDecoration: refunded ? 'line-through' : 'none' }}>
                      {parseFloat(o.total_amount).toFixed(2).replace('.', ',')} €
                    </span>
                    <StatusBadge status={o.status} label={pickupAwareLabel(o.status, isPickup)} refunded={refunded} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
