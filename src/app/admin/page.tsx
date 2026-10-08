'use client';

import { useEffect, useRef, useState } from 'react';
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

// Courbe du CA net sur 7 jours : une seule couleur, aire légère, point plein
// sur aujourd'hui, valeur au survol (ou au doigt sur téléphone).
function WeekLine({ days }: { days: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Le dessin suit la largeur réelle : les textes gardent leur taille sur téléphone.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(500, ...days.map((d) => d.total));
  const step = max > 4000 ? 2000 : max > 2000 ? 1000 : 500;
  const top = Math.ceil(max / step) * step;
  const H = W < 480 ? 170 : 190, pl = 44, pr = 14, pb = 26, pt = 14;
  const x = (i: number) => pl + ((W - pl - pr) * i) / Math.max(1, days.length - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const pts = days.map((d, i) => [x(i), y(d.total)] as const);
  // Courbe lissée (Catmull-Rom → Bézier), sans dépasser sous zéro.
  let path = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1y = Math.min(y(0), p1[1] + (p2[1] - p0[1]) * t);
    const c2y = Math.min(y(0), p2[1] - (p3[1] - p1[1]) * t);
    path += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${path} L${x(days.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const dayLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const label = days.map((d) => `${dayLong(d.date)} ${eur(d.total)}`).join(', ');
  const last = days.length - 1;
  const h = hover ?? null;
  return (
    <div className="bo-chart-wrap" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`CA net par jour sur 7 jours : ${label}`} style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(last, Math.round(((px - pl) / (W - pl - pr)) * last))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="bo-wk" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.16" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#EEF1F6" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#5B6478">{t >= 1000 ? `${(t / 1000).toLocaleString('fr-FR')} k€` : `${t} €`}</text>
          </g>
        ))}
        {days.map((d, i) => (
          <text key={d.date} x={x(i)} y={H - 7} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="11" fill="#5B6478">
            {i === last ? 'auj.' : new Date(`${d.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })}
          </text>
        ))}
        <path d={area} fill="url(#bo-wk)" />
        <path d={path} fill="none" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {h != null && <line x1={x(h)} x2={x(h)} y1={pt} y2={y(0)} stroke="#C7D2E5" strokeDasharray="3 3" />}
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={i === last || i === h ? 4.5 : 3} fill={i === last ? '#2563EB' : '#FFFFFF'} stroke="#2563EB" strokeWidth="2" />
        ))}
      </svg>
      {h != null && (
        <div className="bo-chart-tip" style={{ left: `${(x(h) / W) * 100}%`, top: `${(pts[h][1] / H) * 100}%` }}>
          {dayLong(days[h].date)} · <b>{eur(days[h].total)}</b>{h === last ? ' (en cours)' : ''}
        </div>
      )}
    </div>
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
      n: a.cartsOpen, label: a.cartsOpen > 1 ? 'Paniers abandonnés' : 'Panier abandonné',
      hint: a.cartsOpen > 0 ? `${eur(a.cartsValue)} · relance automatique par e-mail` : 'relance automatique par e-mail',
      go: 'Voir les relances', href: '/admin/carts', hot: false,
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
          <WeekLine days={w.days} />
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
