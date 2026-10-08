'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, ShoppingCart, Store, Truck, RotateCcw, Smartphone, Monitor, Tablet } from 'lucide-react';
import { ActivityGlobe } from '@/components/admin/ActivityGlobe';
import { LineChart } from '@/components/admin/ui/LineChart';

// Écran « Activité » (maquette v4 validée) : qui est sur le site maintenant,
// d'où, ce qu'il regarde, ce qui s'est passé aujourd'hui, les colis en route.
// Données réelles : GET /api/admin/live, rafraîchi toutes les 20 secondes.
// Le suivi ne garde que le pays (jamais l'adresse ni l'IP) : le globe place les
// visiteurs par pays. Les colis sont placés au département de livraison.

interface Live {
  trackingReady: boolean;
  online: number;
  visitsToday: number;
  salesToday: { net: number; orders: number };
  countries: { name: string; lonlat: [number, number] | null; n: number }[];
  visitors: { id: string; country: string; device: string | null; page: string; pages: number; minutes: number; source: string; atCheckout: boolean; inCart: boolean }[];
  watched: { page: string; path: string; n: number }[];
  events: { at: string; kind: 'sale' | 'cart' | 'pickup' | 'shipped' | 'return'; text: string; amount: number | null; href: string | null }[];
  parcels: { id: string; ref: string; city: string; lonlat: [number, number] | null; carrier: string; since: string }[];
  affluence: { today: number[]; lastWeek: number[] };
  parisHour: number;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const ICON = { sale: ShoppingBag, cart: ShoppingCart, pickup: Store, shipped: Truck, return: RotateCcw };
const DEVICE = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as Record<string, typeof Smartphone>;

function ago(iso: string, now: number): string {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : `hier ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`;
}

export default function AdminActivityPage() {
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState(false);
  const [hoverParcel, setHoverParcel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sale' | 'cart'>('all');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    fetch('/api/admin/live', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setData(d); setError(false); setNow(Date.now()); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) return <div className="bo-card" role="alert">Impossible de charger l’activité. Recharge la page dans un instant.</div>;

  const d = data;
  const events = (d?.events ?? []).filter((e) => filter === 'all' || e.kind === filter);
  // Heure de Paris donnée par le serveur (même découpage que les chiffres).
  const hour = d?.parisHour ?? new Date(now).getHours();
  // Visiteurs cumulés heure par heure, jusqu'à l'heure en cours.
  const affPoints = Array.from({ length: 24 }, (_, h) => ({ label: `${h} h`, long: `à ${h} h`, value: d?.affluence.today[h] ?? d?.affluence.today[d.affluence.today.length - 1] ?? 0 }));

  return (
    <div className="bo-page" style={{ maxWidth: 1400 }}>
      <header className="bo-head bo-head-row">
        <div>
          <h1>Activité</h1>
          <p>Qui est sur le site en ce moment, d’où, ce qu’il fait, et les colis qui partent</p>
        </div>
        <span className="bo-live"><span className="bo-live-dot" aria-hidden />En direct · mis à jour toutes les 20 s</span>
      </header>

      {d && !d.trackingReady && (
        <div className="bo-cart-warn" role="status"><span><b>Le suivi des visites n’est pas encore actif.</b> Les ventes et les colis s’affichent quand même.</span></div>
      )}

      <section className="bo-stage" aria-label="En direct">
        <ActivityGlobe
          visitors={(d?.countries ?? []).filter((c) => c.lonlat).map((c) => ({ name: c.name, lonlat: c.lonlat as [number, number], n: c.n }))}
          parcels={(d?.parcels ?? []).filter((p) => p.lonlat).map((p) => ({ id: p.id, city: p.city, lonlat: p.lonlat as [number, number], sub: `${p.ref} · ${p.carrier}` }))}
          hoverParcel={hoverParcel}
          onHoverParcel={setHoverParcel}
        />

        <div className="bo-glass bo-g-now">
          <p className="bo-glass-k"><span className="bo-live-dot" aria-hidden />Visiteurs en ligne</p>
          <p className="bo-g-big"><b>{d?.online ?? '—'}</b><small>sur les 5 dernières min</small></p>
          <div className="bo-g-row">
            <div><b>{d ? eur(d.salesToday.net) : '—'}</b><span>ventes du jour</span></div>
            <div><b>{d?.salesToday.orders ?? '—'}</b><span>commandes</span></div>
            <div><b>{d?.visitsToday ?? '—'}</b><span>visiteurs du jour</span></div>
          </div>
        </div>

        <div className="bo-glass bo-g-parcels">
          <h2>Colis en route <span>{d?.parcels.length ?? 0}</span></h2>
          {d && d.parcels.length === 0 && <p className="bo-glass-empty">Aucun colis en route.</p>}
          <ul>
            {(d?.parcels ?? []).map((p) => (
              <li key={p.id} className={hoverParcel === p.id ? 'hl' : ''} onMouseEnter={() => setHoverParcel(p.id)} onMouseLeave={() => setHoverParcel(null)}>
                <Link href={`/admin/orders/${p.id}`}><b>{p.city}</b><small>{p.ref} · {p.carrier}</small></Link>
                <span>parti {ago(p.since, now)}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="bo-glass bo-g-who" aria-labelledby="bo-who">
          <div className="bo-g-who-h"><h2 id="bo-who">Qui est là</h2><span>{d?.online ?? 0} personne{(d?.online ?? 0) > 1 ? 's' : ''}</span></div>
          {d && d.visitors.length === 0 && <p className="bo-glass-empty">Personne sur le site en ce moment.</p>}
          <ul>
            {(d?.visitors ?? []).map((v) => {
              const Dev = DEVICE[v.device || ''] || Smartphone;
              return (
                <li key={v.id}>
                  <span className="bo-who-av" aria-hidden><Dev className="w-4 h-4" /></span>
                  <span className="bo-who-t"><b>Visiteur {v.id}</b><small>{v.country} · {v.page}</small></span>
                  <span className="bo-who-r">
                    <small>{v.minutes} min</small>
                    {v.atCheckout ? <em className="pay">au paiement</em> : v.inCart ? <em>panier</em> : <small>{v.source}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="bo-glass-priv">Pays seulement, jamais l’adresse ni l’IP</p>
        </aside>
      </section>

      <div className="bo-grid bo-g21" style={{ marginTop: 16 }}>
        <section className="bo-card bo-flush" aria-labelledby="bo-feed">
          <div className="bo-card-h" style={{ padding: '16px 20px 6px' }}>
            <h2 id="bo-feed">Fil d’activité</h2>
            <div className="bo-seg" role="group" aria-label="Filtrer le fil">
              {(['all', 'sale', 'cart'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {k === 'all' ? 'Tout' : k === 'sale' ? 'Ventes' : 'Paniers'}
                </button>
              ))}
            </div>
          </div>
          {events.length === 0 ? (
            <p className="bo-muted" style={{ padding: '6px 20px 18px' }}>{d ? 'Rien sur les dernières 36 heures.' : 'Chargement…'}</p>
          ) : (
            <ul className="bo-feed">
              {events.slice(0, 15).map((e, i) => {
                const I = ICON[e.kind];
                const body = (
                  <>
                    <span className={`bo-feed-ic bo-feed-${e.kind}`} aria-hidden><I className="w-4 h-4" /></span>
                    <span className="bo-feed-t">{e.text}</span>
                    {e.amount != null && <b className="bo-feed-a">{eur(e.amount)}</b>}
                    <time dateTime={e.at}>{ago(e.at, now)}</time>
                  </>
                );
                return <li key={`${e.at}-${i}`}>{e.href ? <Link href={e.href}>{body}</Link> : <div>{body}</div>}</li>;
              })}
            </ul>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="bo-card" aria-labelledby="bo-aff">
            <div className="bo-card-h">
              <h2 id="bo-aff">Affluence aujourd’hui</h2>
              <div className="bo-legend"><span><i className="bo-lg-cur" /> aujourd’hui</span><span><i className="bo-lg-prev" /> il y a 7 jours</span></div>
            </div>
            <p className="bo-aff-n"><b>{d?.visitsToday ?? '—'}</b> visiteurs à {hour} h · même heure il y a 7 jours : {d ? d.affluence.lastWeek[hour] ?? 0 : '—'}</p>
            <LineChart
              points={affPoints.slice(0, hour + 1)}
              previous={(d?.affluence.lastWeek ?? []).slice(0, hour + 1)}
              format={(n) => String(Math.round(n))}
              ariaLabel="Visiteurs cumulés par heure aujourd’hui, comparés au même jour la semaine dernière"
              height={180}
              lastSuffix="(maintenant)"
            />
          </section>
          <section className="bo-card" aria-labelledby="bo-watch">
            <div className="bo-card-h"><h2 id="bo-watch">Regardé en ce moment</h2><span className="bo-muted">30 dernières minutes</span></div>
            {(d?.watched ?? []).length === 0 ? <p className="bo-muted">Aucune fiche produit ouverte.</p> : (
              <ul className="bo-watched">
                {d!.watched.map((w) => <li key={w.path}><span>{w.page}</span><b>{w.n} vue{w.n > 1 ? 's' : ''}</b></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
