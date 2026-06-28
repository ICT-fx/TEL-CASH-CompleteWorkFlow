'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Health {
  greying_enabled?: boolean;
  freshness_hours?: number;
  min_supplier_rows?: number;
  manual_active?: number;
  manual_matched?: number;
  manual_unmatched?: number;
  greyed_now?: number;
  would_grey_if_enabled?: number;
  supplier_keys?: number;
  supplier_last_sync?: string;
  supplier_feed_fresh?: boolean;
  supplier_fresh_keys?: number;
  supplier_stale_keys?: number;
  supplier_orphan_keys?: number;
  unmapped_colors?: string[];
}

interface Settings {
  greying_enabled: boolean;
  freshness_hours: number;
}

const num = (v: number | undefined) => (typeof v === 'number' ? v.toLocaleString('fr-FR') : '—');

// Panneau « Santé du flux Fluxitron » : interrupteur du grisage fournisseur
// + diagnostic (matchs, périmées, orphelines, couleurs non mappées).
// Autonome : ne dépend pas de l'état de la page Catalogue.
export default function SupplierSyncPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [health, setHealth] = useState<Health>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/supplier-sync', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      setSettings(d.settings);
      setHealth(d.health || {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/supplier-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greying_enabled: !settings.greying_enabled }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      setSettings(d.settings);
      await load(); // recharge les compteurs (greyed_now change avec l'interrupteur)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }, [settings, load]);

  const enabled = settings?.greying_enabled ?? false;
  const unmapped = health.unmapped_colors ?? [];

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 20,
      background: enabled ? '#f0fdf4' : '#fffbeb',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap className="w-4 h-4" style={{ color: enabled ? '#16a34a' : '#d97706' }} />
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
              Santé du flux Fluxitron
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Fail-closed : seules les variantes en stock frais chez Foxway sont
              vendables ; toutes les autres sont grisées (seuil : {settings?.freshness_hours ?? 48} h)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            className="admin-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Rafraîchir le diagnostic"
          >
            <RefreshCw className="w-4 h-4" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
          </button>
          <button
            onClick={toggle}
            disabled={saving || !settings}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: '0.85rem',
              background: enabled ? '#16a34a' : '#475569', color: '#fff',
            }}
          >
            {enabled ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {enabled ? 'Grisage ACTIF' : 'Grisage INACTIF'}
            <span style={{ opacity: 0.8, fontWeight: 500 }}>
              · {saving ? '…' : enabled ? 'désactiver' : 'activer'}
            </span>
          </button>
        </div>
      </div>

      {!enabled && (
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#92400e' }}>
          ⚠️ Grisage inactif : aucune variante n'est grisée côté client.
          En fail-closed, <strong>{num(health.would_grey_if_enabled)}</strong> variantes
          seraient grisées si vous activiez (seules celles en stock frais chez Foxway
          resteraient vendables). Vérifiez le garde-fou ci-dessous avant d'activer.
        </div>
      )}
      {health.supplier_feed_fresh === false && (
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
          🛟 Garde-fou ACTIF : le feed n'est pas frais (dernière sync trop ancienne ou
          &lt; {num(health.min_supplier_rows)} lignes) → <strong>aucun grisage appliqué</strong>,
          tout reste vendable. Le grisage reprendra après une sync saine.
        </div>
      )}
      {err && (
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#b91c1c' }}>{err}</div>
      )}

      {/* Compteurs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 8, marginTop: 14,
      }}>
        <Stat label="Variantes magasin" value={num(health.manual_active)} />
        <Stat label="Vendables (stock Foxway)" value={num((health.manual_active ?? 0) - (health.would_grey_if_enabled ?? 0))} tone="#16a34a" />
        <Stat label={enabled ? 'Grisées actuellement' : 'Seraient grisées (si activé)'} value={num(enabled ? health.greyed_now : health.would_grey_if_enabled)} tone={enabled ? '#dc2626' : '#d97706'} />
        <Stat label="Garde-fou feed frais" value={health.supplier_feed_fresh === false ? 'NON ⚠️' : 'OK'} tone={health.supplier_feed_fresh === false ? '#dc2626' : '#16a34a'} />
        <Stat label="Avec correspondance" value={num(health.manual_matched)} tone="#64748b" />
        <Stat label="Sans correspondance" value={num(health.manual_unmatched)} tone="#64748b" />
        <Stat label="Clés miroir Fluxitron" value={num(health.supplier_keys)} />
        <Stat label="Miroir frais" value={num(health.supplier_fresh_keys)} tone="#16a34a" />
        <Stat label="Miroir périmé" value={num(health.supplier_stale_keys)} tone="#d97706" />
        <Stat label="Orphelines (miroir seul)" value={num(health.supplier_orphan_keys)} tone="#64748b" />
      </div>

      {unmapped.length > 0 && (
        <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#475569' }}>
          <strong>Couleurs probablement non mappées</strong> (modèle/stockage/grade matchés
          mais couleur absente du miroir — à cartographier) :{' '}
          <span style={{ color: '#0f172a' }}>{unmapped.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = '#0f172a' }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}
