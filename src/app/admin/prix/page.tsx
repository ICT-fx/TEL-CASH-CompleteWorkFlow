'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { PrixGroup } from '@/app/api/admin/prix/route';
import { DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

const NO_STORE: RequestInit = { cache: 'no-store' };
const GRADES: DisplayGrade[] = DISPLAY_GRADE_ORDER;
type StatusFilter = 'all' | 'active' | 'inactive';

const C = {
  ink: '#0f172a', sub: '#64748b', mute: '#94a3b8', line: '#e2e8f0',
  rowLine: '#f1f5f9', head: '#f8fafc', green: '#16a34a', red: '#dc2626',
};
const inputStyle: React.CSSProperties = {
  width: '100%', maxWidth: 96, padding: '5px 8px',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem',
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PrixPage() {
  const [groups, setGroups] = useState<PrixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/prix', NO_STORE);
    const d = await r.json();
    setGroups(d.groups ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Regroupe les groupes par modèle (le GET trie déjà modèle→stockage→grade).
  const models = useMemo(() => {
    const byModel = new Map<string, PrixGroup[]>();
    for (const g of groups) {
      const arr = byModel.get(g.model);
      if (arr) arr.push(g); else byModel.set(g.model, [g]);
    }
    return Array.from(byModel.entries()).map(([model, gs]) => ({
      model, brand: gs[0].brand, groups: gs, active: gs.some((x) => x.active),
    }));
  }, [groups]);

  const brands = useMemo(
    () => Array.from(new Set(groups.map((g) => g.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [groups]
  );

  const visible = models.filter((m) =>
    (brandFilter === '' || m.brand === brandFilter) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? m.active : !m.active))
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: C.ink, marginBottom: 4 }}>Prix</h1>
        <p style={{ fontSize: '0.85rem', color: C.sub }}>
          Saisis le prix de vente par (modèle, stockage, grade). Il s&apos;applique aussitôt
          au catalogue magasin et au catalogue client.
        </p>
      </div>

      {/* Barre de filtres */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
        padding: '12px 16px', background: C.head, border: `1px solid ${C.line}`,
        borderRadius: 12, marginBottom: 16,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: C.sub }}>
          Marque
          <select
            value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem', background: 'white' }}
          >
            <option value="">Toutes</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: C.sub }}>
          Statut
          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
            {([['all', 'Tous'], ['active', 'Activés'], ['inactive', 'Désactivés']] as const).map(([val, label]) => (
              <button
                key={val} onClick={() => setStatusFilter(val)}
                style={{
                  padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                  fontWeight: statusFilter === val ? 600 : 400,
                  background: statusFilter === val ? C.ink : 'white',
                  color: statusFilter === val ? 'white' : C.sub,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: C.mute }}>
          {visible.length} modèle{visible.length > 1 ? 's' : ''}
        </span>
      </div>

      {flash && (
        <p style={{ color: flash.ok ? C.green : C.red, fontSize: '0.85rem', marginBottom: 12 }}>{flash.msg}</p>
      )}

      {loading ? (
        <p style={{ color: C.mute, fontSize: '0.9rem' }}>Chargement…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: C.mute, fontSize: '0.9rem' }}>Aucun modèle pour ces filtres.</p>
      ) : (
        visible.map((m) => (
          <ModelCard key={m.model} model={m.model} brand={m.brand} active={m.active}
            groups={m.groups} onSaved={(msg, ok) => setFlash({ msg, ok })} />
        ))
      )}
    </div>
  );
}

// ── Carte modèle ─────────────────────────────────────────────────────────────
function ModelCard({ model, brand, active, groups, onSaved }: {
  model: string; brand: string; active: boolean; groups: PrixGroup[];
  onSaved: (msg: string, ok: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  // Stockages distincts (string | null), triés.
  const storages = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const g of groups) seen.set(g.storage ?? '', g.storage);
    return Array.from(seen.values()).sort((a, b) => (a ?? '').localeCompare(b ?? ''));
  }, [groups]);

  const byKey = useMemo(
    () => new Map(groups.map((g) => [`${g.storage ?? ''}|${g.grade}`, g] as const)),
    [groups]
  );

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden', background: 'white' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: C.mute, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
        <span style={{ fontSize: '0.72rem', color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{brand}</span>
        <span style={{ fontSize: '0.98rem', fontWeight: 600, color: C.ink }}>{model}</span>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: '0.74rem', fontWeight: 600, color: active ? C.green : C.mute,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? C.green : C.mute }} />
          {active ? 'Activé' : 'Désactivé'}
        </span>
      </button>

      {open && (
        <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.rowLine}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: C.head, textAlign: 'left', color: C.sub }}>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Stockage</th>
                {GRADES.map((g) => <th key={g} style={{ padding: '8px 12px', fontWeight: 500 }}>Grade {g}</th>)}
                <th style={{ padding: '8px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {storages.map((s) => (
                <StorageRow
                  key={s ?? '∅'} model={model} storage={s}
                  groupByGrade={Object.fromEntries(
                    GRADES.map((g) => [g, byKey.get(`${s ?? ''}|${g}`)])
                  ) as Partial<Record<DisplayGrade, PrixGroup>>}
                  onSaved={onSaved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ligne stockage : prix A/B/C + 1 bouton Appliquer + dépliable Promo ───────
function StorageRow({ model, storage, groupByGrade, onSaved }: {
  model: string; storage: string | null;
  groupByGrade: Partial<Record<DisplayGrade, PrixGroup>>;
  onSaved: (msg: string, ok: boolean) => void;
}) {
  const present = GRADES.filter((g) => groupByGrade[g]);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.price != null ? String(groupByGrade[g]!.price) : '']))
  );
  const [compareAts, setCompareAts] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.compareAtPrice != null ? String(groupByGrade[g]!.compareAtPrice) : '']))
  );
  const [promoOpen, setPromoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flashOk, setFlashOk] = useState(false);

  const apply = async () => {
    const entries = present
      .filter((g) => prices[g].trim() !== '')
      .map((g) => {
        const e: { grade: DisplayGrade; price: number; compare_at_price?: number | null } = {
          grade: g, price: Number(prices[g]),
        };
        if (promoOpen) e.compare_at_price = compareAts[g].trim() === '' ? null : Number(compareAts[g]);
        return e;
      });
    if (entries.length === 0) { onSaved('Aucun prix à enregistrer sur cette ligne.', false); return; }

    setBusy(true);
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'rowPrices', model, storage, prices: entries }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) {
      onSaved(`Erreur : ${d.error}`, false);
    } else {
      setFlashOk(true);
      setTimeout(() => setFlashOk(false), 1500);
      onSaved(`${storage ?? '—'} : ${d.grades} grade(s) enregistré(s) (${d.updated} variante(s)).`, true);
    }
  };

  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.rowLine}` }}>
        <td style={{ padding: '6px 12px', fontWeight: 500, color: C.ink, whiteSpace: 'nowrap' }}>{storage ?? '—'}</td>
        {GRADES.map((g) => (
          <td key={g} style={{ padding: '6px 12px' }}>
            {groupByGrade[g] ? (
              <input
                type="number" step="0.01" min={0} placeholder="Prix"
                value={prices[g]} onChange={(e) => setPrices((p) => ({ ...p, [g]: e.target.value }))}
                style={inputStyle}
              />
            ) : (
              <span style={{ color: '#cbd5e1' }}>—</span>
            )}
          </td>
        ))}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
          <button
            onClick={apply} disabled={busy}
            style={{
              padding: '5px 12px', background: flashOk ? C.green : C.ink, color: 'white',
              border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
              fontWeight: 500, fontSize: '0.78rem',
            }}
          >
            {busy ? 'Enregistrement…' : flashOk ? '✓ Enregistré' : 'Appliquer'}
          </button>
          {present.length > 0 && (
            <button
              onClick={() => setPromoOpen((o) => !o)}
              style={{ marginLeft: 10, padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.74rem' }}
            >
              {promoOpen ? 'Masquer promo' : 'Promo'}
            </button>
          )}
        </td>
      </tr>
      {promoOpen && (
        <tr style={{ background: '#fbfdff' }}>
          <td style={{ padding: '4px 12px 8px', fontSize: '0.72rem', color: C.mute }}>Prix barré</td>
          {GRADES.map((g) => (
            <td key={g} style={{ padding: '4px 12px 8px' }}>
              {groupByGrade[g] ? (
                <input
                  type="number" step="0.01" min={0} placeholder="—"
                  value={compareAts[g]} onChange={(e) => setCompareAts((p) => ({ ...p, [g]: e.target.value }))}
                  style={{ ...inputStyle, color: C.mute }}
                />
              ) : null}
            </td>
          ))}
          <td />
        </tr>
      )}
    </>
  );
}
