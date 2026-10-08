'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';

// « Ventes et marge » (maquette V2 validée) : ce que la boutique gagne vraiment.
// CA net (remboursements déduits, commandes de l'équipe exclues) et marge par
// modèle, triée en euros. Lecture seule — les prix se changent dans Catalogue › Prix.
// Données : GET /api/admin/sales.

interface Model { label: string; qty: number; revenue: number; margin: number; pct: number | null; estimated: boolean }
interface Data {
  kpis: {
    net: number; netDelta: number | null; orders: number; ordersDiff: number; avgBasket: number; refunded: number;
    margin: number; marginPct: number | null; estimatedOrders: number; unknownOrders: number;
  };
  byModel: Model[];
}

const PERIODS = [{ key: '7', label: '7 jours' }, { key: '30', label: '30 jours' }, { key: '365', label: '12 mois' }];
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const pct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const tone = (p: number | null) => (p == null ? '' : p < 15 ? 'bo-mg-bad' : p < 20 ? 'bo-mg-warn' : 'bo-mg-ok');

export default function AdminSalesPage() {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/sales?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [period]);

  const label = PERIODS.find((p) => p.key === period)?.label.toLowerCase() ?? '';
  const k = data?.kpis;
  const rows = data?.byModel ?? [];
  const totalMargin = rows.reduce((s, r) => s + Math.max(0, r.margin), 0) || 1;
  const top = Math.max(1, ...rows.map((r) => r.margin));
  const weak = rows.filter((r) => r.pct != null && r.pct < 15);

  return (
    <div className="bo-page">
      <header className="bo-head bo-head-row">
        <div>
          <h1>Ventes et marge</h1>
          <p>Ce que la boutique gagne vraiment · {label}</p>
        </div>
        <div className="bo-head-tools">
          <div className="bo-seg" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <a className="bo-btn" href="/api/admin/orders/export" title="Fichier des commandes payées, expédiées et livrées, pour Excel">
            <Download className="w-4 h-4" aria-hidden /> Export pour le comptable
          </a>
        </div>
      </header>

      {error && <div className="bo-card" role="alert">Impossible de charger les ventes. Recharge la page dans un instant.</div>}

      <section className="bo-grid bo-g4" aria-label="Chiffres clés">
        <div className="bo-card"><p className="bo-kpi-l">CA net</p><p className="bo-kpi-v">{k ? eur(k.net) : '—'}</p>
          <p className={`bo-kpi-d ${k?.netDelta != null && k.netDelta < 0 ? 'bo-down' : 'bo-up'}`}>{k?.netDelta != null ? `${k.netDelta > 0 ? '+' : ''}${Math.round(k.netDelta)} % vs avant` : ' '}</p></div>
        <div className="bo-card"><p className="bo-kpi-l">Marge brute</p><p className="bo-kpi-v">{k ? `${k.estimatedOrders ? '≈ ' : ''}${eur(k.margin)}` : '—'}</p>
          <p className="bo-kpi-d bo-muted">{k?.marginPct != null ? `${pct(k.marginPct)} du CA` : ' '}</p></div>
        <div className="bo-card"><p className="bo-kpi-l">Ventes</p><p className="bo-kpi-v">{k ? k.orders : '—'}</p>
          <p className={`bo-kpi-d ${k && k.ordersDiff < 0 ? 'bo-down' : 'bo-up'}`}>{k ? (k.ordersDiff === 0 ? 'comme avant' : `${k.ordersDiff > 0 ? '+' : ''}${k.ordersDiff} vs avant`) : ' '}</p></div>
        <div className="bo-card"><p className="bo-kpi-l">Marge moyenne par vente</p><p className="bo-kpi-v">{k && k.orders ? eur(k.margin / Math.max(1, k.orders - k.unknownOrders)) : '—'}</p>
          <p className="bo-kpi-d bo-muted">panier moyen {k ? eur(k.avgBasket) : '—'}</p></div>
      </section>

      <section className="bo-card bo-flush" style={{ marginTop: 14 }} aria-labelledby="bo-models">
        <div className="bo-card-h" style={{ padding: '16px 20px 4px' }}>
          <h2 id="bo-models">Ce qui rapporte vraiment</h2>
          <span className="bo-muted">trié par marge en euros, pas par nombre de ventes</span>
        </div>
        {data === null && !error ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }} aria-busy="true" aria-label="Chargement">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="bo-muted" style={{ padding: '8px 20px 20px' }}>Aucune vente sur la période.</p>
        ) : (
          <table className="bo-otable bo-stable">
            <thead><tr><th>Modèle</th><th className="r">Ventes</th><th className="r bo-hide-m">CA</th><th className="r">Marge</th><th className="r">Marge %</th><th className="bo-hide-m" style={{ width: '26%' }}>Part de la marge totale</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td><b>{r.label}</b></td>
                  <td className="r">{r.qty}</td>
                  <td className="r bo-hide-m">{eur(r.revenue)}</td>
                  <td className="r"><b>{r.estimated ? '≈ ' : ''}{eur(r.margin)}</b></td>
                  <td className="r"><span className={`bo-mg ${tone(r.pct)}`}><b>{r.pct != null ? pct(r.pct) : '—'}</b></span></td>
                  <td className="bo-hide-m">
                    <span className="bo-share"><i style={{ width: `${Math.max(0, (r.margin / top) * 100)}%` }} /></span>
                    <small className="bo-share-n">{Math.round((Math.max(0, r.margin) / totalMargin) * 100)} %</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {weak.length > 0 && (
          <div className="bo-weak">
            <span><b>{weak.map((w) => w.label).join(', ')}</b> : moins de 15 % de marge. À vérifier dans Catalogue › Prix.</span>
            <Link href="/admin/prix" className="bo-btn">Voir les prix</Link>
          </div>
        )}
      </section>
      <p className="bo-muted" style={{ marginTop: 10 }}>
        Marge brute = prix de vente − prix d’achat. « ≈ » : prix d’achat pas enregistré au moment de la vente, estimé avec le prix fournisseur actuel.
        Remboursements déduits du CA, commandes de l’équipe exclues.
        {k && k.unknownOrders > 0 ? ` ${k.unknownOrders} vente${k.unknownOrders > 1 ? 's' : ''} sans prix d’achat connu ne ${k.unknownOrders > 1 ? 'sont' : 'est'} pas dans la marge.` : ''}
      </p>
    </div>
  );
}
