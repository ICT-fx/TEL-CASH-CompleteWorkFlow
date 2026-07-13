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

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// « −10 % » / « +10 % » (signe toujours affiché, virgule française).
const fmtPct = (p: number): string =>
  `${p > 0 ? '+' : '−'}${String(Math.abs(p)).replace('.', ',')} %`;

// Palette du bandeau « ajustement global actif » (ambre).
const AMBER = { text: '#b45309', bg: '#fffbeb', chip: '#fef3c7', line: '#fcd34d' };

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

  // Reflète la bascule d'activation d'un modèle sur tous ses groupes, pour que
  // le badge ET le filtre « Activés/Désactivés » restent synchrones sans recharger.
  const onToggled = useCallback((model: string, active: boolean) => {
    setGroups((gs) => gs.map((g) => (g.model === model ? { ...g, active } : g)));
  }, []);

  // Regroupe les groupes par modèle (le GET trie déjà modèle→stockage→grade).
  const models = useMemo(() => {
    const byModel = new Map<string, PrixGroup[]>();
    for (const g of groups) {
      const arr = byModel.get(g.model);
      if (arr) arr.push(g); else byModel.set(g.model, [g]);
    }
    return Array.from(byModel.entries()).map(([model, gs]) => ({
      model, brand: gs[0].brand, groups: gs, active: gs.some((x) => x.active),
      // Pourcentages d'ajustement actifs sur ce modèle (badges d'en-tête).
      adjusts: Array.from(new Set(
        gs.map((g) => g.adjustPercent).filter((p): p is number => p != null)
      )).sort((a, b) => a - b),
    }));
  }, [groups]);

  // Résumé des ajustements actifs (bandeau) : nb de modèles par pourcentage.
  const adjustSummary = useMemo(() => {
    const byPct = new Map<number, Set<string>>();
    let lastAt: string | null = null;
    for (const g of groups) {
      if (g.adjustPercent == null) continue;
      let set = byPct.get(g.adjustPercent);
      if (!set) { set = new Set(); byPct.set(g.adjustPercent, set); }
      set.add(g.model);
      if (g.priceUpdatedAt && (!lastAt || Date.parse(g.priceUpdatedAt) > Date.parse(lastAt))) {
        lastAt = g.priceUpdatedAt;
      }
    }
    const items = Array.from(byPct.entries())
      .map(([percent, ms]) => ({ percent, models: ms.size }))
      .sort((a, b) => a.percent - b.percent);
    return { items, lastAt };
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
          Saisis le prix de vente par (modèle, stockage, grade). Chaque modèle est vendable
          en grade A, B et C ; il s&apos;applique aussitôt au catalogue magasin et au catalogue client.
          Laisse un prix <strong>vide</strong> ou à <strong>0</strong> pour griser cette variante
          au catalogue (non vendable).
        </p>
      </div>

      {/* Ajustement ±X % : tout le catalogue, des marques ou des modèles */}
      <GlobalAdjustBar
        summary={adjustSummary}
        brands={brands}
        allModels={models.map((m) => ({ model: m.model, brand: m.brand }))}
        onFlash={(msg, ok) => setFlash({ msg, ok })}
        reload={load}
      />

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
            groups={m.groups} adjustPercents={m.adjusts}
            onSaved={(msg, ok) => setFlash({ msg, ok })} onToggled={onToggled} />
        ))
      )}
    </div>
  );
}

// ── Ajustement ±X % (catalogue entier, marques ou modèles) ──────────────────
// Applique un pourcentage sur la portée choisie (RPC côté serveur, recalcul
// depuis le prix de référence → jamais cumulatif sur une ligne). Plusieurs
// ajustements ciblés peuvent coexister (ex. −10 % Apple et −20 % sur 3
// modèles) ; « Tout revenir à la normale » restaure l'ensemble.
function GlobalAdjustBar({ summary, brands, allModels, onFlash, reload }: {
  summary: { items: Array<{ percent: number; models: number }>; lastAt: string | null };
  brands: string[];
  allModels: Array<{ model: string; brand: string }>;
  onFlash: (msg: string, ok: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [pct, setPct] = useState('');
  const [selBrands, setSelBrands] = useState<string[]>([]);
  const [selModels, setSelModels] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [busy, setBusy] = useState<'apply' | 'revert' | null>(null);
  const active = summary.items.length > 0;

  // Modèles proposés dans le sélecteur : restreints aux marques cochées.
  const pickable = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return allModels.filter((m) =>
      (selBrands.length === 0 || selBrands.includes(m.brand)) &&
      (q === '' || m.model.toLowerCase().includes(q))
    );
  }, [allModels, selBrands, modelSearch]);

  const toggleBrand = (b: string) => {
    setSelBrands((prev) => {
      const next = prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b];
      // Décoche les modèles qui sortent des marques retenues.
      if (next.length > 0) {
        const ok = new Set(allModels.filter((m) => next.includes(m.brand)).map((m) => m.model));
        setSelModels((ms) => ms.filter((m) => ok.has(m)));
      }
      return next;
    });
  };

  const toggleModel = (m: string) =>
    setSelModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  // Portée effective : modèles cochés > marques cochées > tout le catalogue.
  const scopeTxt = selModels.length > 0
    ? `${selModels.length} modèle${selModels.length > 1 ? 's' : ''} sélectionné${selModels.length > 1 ? 's' : ''}`
    : selBrands.length > 0
      ? `tous les modèles ${selBrands.join(', ')}`
      : 'TOUS les prix du catalogue';

  const put = async (payload: Record<string, unknown>) => {
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.json();
  };

  const apply = async () => {
    const p = Number(pct.trim().replace(',', '.'));
    if (!Number.isFinite(p) || p === 0 || p < -90 || p > 200) {
      onFlash('Pourcentage invalide : saisis une valeur entre −90 et +200 (ex. −10 ou 10).', false);
      return;
    }
    const detail = selModels.length > 0
      ? `\n${selModels.slice(0, 8).join(', ')}${selModels.length > 8 ? '…' : ''}`
      : '';
    if (!window.confirm(`Appliquer ${fmtPct(p)} sur ${scopeTxt} ?${detail}\n(Recalcul depuis les prix de référence — jamais cumulatif. Annulable via « Tout revenir à la normale ».)`)) return;
    setBusy('apply');
    const d = await put({
      kind: 'globalAdjust', percent: p,
      ...(selModels.length > 0 ? { models: selModels }
        : selBrands.length > 0 ? { brands: selBrands } : {}),
    });
    setBusy(null);
    if (d.error) { onFlash(`Erreur : ${d.error}`, false); return; }
    setPct(''); setSelModels([]); setSelBrands([]); setModelsOpen(false); setModelSearch('');
    onFlash(`${fmtPct(d.percent)} appliqué sur ${d.adjusted} variante(s) (${scopeTxt}).`, true);
    await reload();
  };

  const revert = async () => {
    if (!window.confirm('Annuler TOUS les ajustements et revenir aux prix de référence ?')) return;
    setBusy('revert');
    const d = await put({ kind: 'globalRevert' });
    setBusy(null);
    if (d.error) { onFlash(`Erreur : ${d.error}`, false); return; }
    onFlash(`Prix de référence restaurés (${d.reverted} variante(s)).`, true);
    await reload();
  };

  const chipBtn = (on: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontSize: '0.76rem',
    fontWeight: on ? 600 : 400,
    border: `1px solid ${on ? C.ink : '#cbd5e1'}`,
    background: on ? C.ink : 'white', color: on ? 'white' : C.sub,
  });

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, marginBottom: 16,
      border: `1px solid ${active ? AMBER.line : C.line}`,
      background: active ? AMBER.bg : C.head,
    }}>
      {/* Ligne 1 : état + retour à la normale */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {active ? (
          <span style={{ fontSize: '0.85rem', color: AMBER.text, fontWeight: 600 }}>
            ⚠️ Ajustement{summary.items.length > 1 || summary.items[0].models > 1 ? 's' : ''} actif{summary.items.length > 1 ? 's' : ''} :{' '}
            {summary.items.map((it) => `${fmtPct(it.percent)} (${it.models} modèle${it.models > 1 ? 's' : ''})`).join(' · ')}
            {summary.lastAt ? ` — dernier le ${fmtDate(summary.lastAt)}` : ''}
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: C.ink, fontWeight: 600 }}>
            Ajustement des prix en %
          </span>
        )}
        {active && (
          <button
            onClick={revert} disabled={busy != null}
            style={{
              marginLeft: 'auto', padding: '6px 14px', background: 'white', color: AMBER.text,
              border: `1px solid ${AMBER.line}`, borderRadius: 6,
              cursor: busy ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.8rem',
            }}
          >
            {busy === 'revert' ? 'Restauration…' : 'Tout revenir à la normale'}
          </button>
        )}
      </div>

      {/* Ligne 2 : portée (marques / modèles) + pourcentage + appliquer */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: '0.78rem', color: C.sub }}>Portée</span>
        {brands.map((b) => (
          <button key={b} onClick={() => toggleBrand(b)} style={chipBtn(selBrands.includes(b))}>
            {b}
          </button>
        ))}

        <div style={{ position: 'relative' }}>
          <button onClick={() => setModelsOpen((o) => !o)} style={chipBtn(selModels.length > 0)}>
            {selModels.length > 0 ? `Modèles (${selModels.length})` : 'Choisir des modèles…'} ▾
          </button>
          {modelsOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
              width: 280, maxHeight: 300, overflowY: 'auto', background: 'white',
              border: `1px solid ${C.line}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(15,23,42,.12)', padding: 8,
            }}>
              <input
                type="text" placeholder="Rechercher un modèle…" value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                style={{ ...inputStyle, maxWidth: '100%', marginBottom: 6 }}
              />
              {selModels.length > 0 && (
                <button
                  onClick={() => setSelModels([])}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.74rem', padding: '0 0 6px 2px' }}
                >
                  Tout décocher ({selModels.length})
                </button>
              )}
              {pickable.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: C.mute, padding: 4 }}>Aucun modèle.</p>
              ) : pickable.map((m) => (
                <label key={m.model} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px',
                  fontSize: '0.8rem', color: C.ink, cursor: 'pointer',
                }}>
                  <input
                    type="checkbox" checked={selModels.includes(m.model)}
                    onChange={() => toggleModel(m.model)}
                  />
                  <span>{m.model}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: C.mute, textTransform: 'uppercase' }}>{m.brand}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <input
            type="number" step="1" min={-90} max={200} placeholder="ex. -10"
            value={pct} onChange={(e) => setPct(e.target.value)}
            style={{ ...inputStyle, maxWidth: 80 }}
          />
          <span style={{ fontSize: '0.82rem', color: C.sub }}>%</span>
          <button
            onClick={apply} disabled={busy != null || pct.trim() === ''}
            title={`Applique le pourcentage sur ${scopeTxt}`}
            style={{
              padding: '6px 14px', background: C.ink, color: 'white', border: 'none',
              borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontWeight: 500, fontSize: '0.8rem',
              opacity: pct.trim() === '' ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {busy === 'apply' ? 'Application…' : `Appliquer sur ${selModels.length > 0 ? `${selModels.length} modèle${selModels.length > 1 ? 's' : ''}` : selBrands.length > 0 ? selBrands.join(' + ') : 'tout'}`}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: active ? AMBER.text : C.mute, marginTop: 8, marginBottom: 0 }}>
        {active
          ? 'Les prix affichés incluent les ajustements (badge sur chaque modèle concerné). Ré-appliquer sur une même ligne recalcule depuis le prix de référence (jamais cumulatif) ; un prix modifié à la main devient le nouveau prix de référence et ne sera pas annulé par « Tout revenir à la normale ».'
          : 'Applique ±X % (ex. −10 pour des soldes) sur tout le catalogue, ou seulement sur les marques / modèles choisis. Les variantes grisées (prix 0) ne sont pas concernées ; « Tout revenir à la normale » restaure les prix d’origine à tout moment.'}
      </p>
    </div>
  );
}

// ── Carte modèle ─────────────────────────────────────────────────────────────
function ModelCard({ model, brand, active, groups, adjustPercents, onSaved, onToggled }: {
  model: string; brand: string; active: boolean; groups: PrixGroup[];
  adjustPercents: number[];
  onSaved: (msg: string, ok: boolean) => void;
  onToggled: (model: string, active: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Bascule l'activation de TOUTES les variantes du modèle au catalogue.
  const toggleActive = async () => {
    const next = !active;
    setToggling(true);
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'toggleModel', model, active: next }),
    });
    const d = await r.json();
    setToggling(false);
    if (d.error) {
      onSaved(`Erreur : ${d.error}`, false);
    } else {
      onToggled(model, next);
      onSaved(`${model} ${next ? 'activé' : 'désactivé'} au catalogue (${d.toggled} variante${d.toggled > 1 ? 's' : ''}).`, true);
    }
  };

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
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'white',
      }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
          }}
        >
          <span style={{ fontSize: '0.7rem', color: C.mute, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
          <span style={{ fontSize: '0.72rem', color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{brand}</span>
          <span style={{ fontSize: '0.98rem', fontWeight: 600, color: C.ink }}>{model}</span>
          {adjustPercents.map((p) => (
            <span
              key={p}
              title="Ajustement actif sur ce modèle : les prix affichés incluent ce pourcentage"
              style={{
                fontSize: '0.7rem', fontWeight: 700, color: AMBER.text, background: AMBER.chip,
                border: `1px solid ${AMBER.line}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
              }}
            >
              {fmtPct(p)}
            </span>
          ))}
        </button>
        <button
          onClick={toggleActive}
          disabled={toggling}
          title={active ? 'Désactiver ce modèle au catalogue' : 'Activer ce modèle au catalogue'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 999, cursor: toggling ? 'wait' : 'pointer',
            fontSize: '0.74rem', fontWeight: 600,
            border: `1px solid ${active ? C.green : C.line}`,
            background: active ? '#f0fdf4' : C.head,
            color: active ? C.green : C.mute,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? C.green : C.mute }} />
          {toggling ? '…' : active ? 'Activé' : 'Désactivé'}
        </button>
      </div>

      {open && (
        <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.rowLine}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: C.head, textAlign: 'left', color: C.sub }}>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Stockage</th>
                {GRADES.map((g) => <th key={g} style={{ padding: '8px 12px', fontWeight: 500 }}>Grade {g}</th>)}
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Maj. prix</th>
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

// ── Ligne stockage : prix A/B/C (toujours éditables) + 1 Appliquer + Promo ───
function StorageRow({ model, storage, groupByGrade, onSaved }: {
  model: string; storage: string | null;
  groupByGrade: Partial<Record<DisplayGrade, PrixGroup>>;
  onSaved: (msg: string, ok: boolean) => void;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.price != null ? String(groupByGrade[g]!.price) : '']))
  );
  const [compareAts, setCompareAts] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, groupByGrade[g]?.compareAtPrice != null ? String(groupByGrade[g]!.compareAtPrice) : '']))
  );
  const [lineDate, setLineDate] = useState<string | null>(() => {
    let best: string | null = null;
    for (const g of GRADES) {
      const d = groupByGrade[g]?.priceUpdatedAt ?? null;
      if (d && (!best || Date.parse(d) > Date.parse(best))) best = d;
    }
    return best;
  });
  const [promoOpen, setPromoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flashOk, setFlashOk] = useState(false);

  const apply = async () => {
    // Un grade laissé VIDE est traité comme prix 0 (⇒ variante grisée / non
    // vendable au catalogue client, cf. `price > 0` dans productVariants.ts) —
    // MAIS seulement s'il a déjà des variantes : on ne crée pas de SKU à 0 pour
    // un grade absent. Un grade renseigné (y compris « 0 » saisi) part tel quel.
    const entries = GRADES
      .filter((g) => prices[g].trim() !== '' || groupByGrade[g] != null)
      .map((g) => {
        const raw = prices[g].trim();
        const e: { grade: DisplayGrade; price: number; compare_at_price?: number | null } = {
          grade: g, price: raw === '' ? 0 : Number(raw),
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
      setLineDate(d.priceUpdatedAt ?? new Date().toISOString());
      setTimeout(() => setFlashOk(false), 1500);
      const createdTxt = d.created ? `, ${d.created} variante(s) créée(s)` : '';
      onSaved(`${storage ?? '—'} : ${d.grades} grade(s) enregistré(s) (${d.updated} variante(s)${createdTxt}).`, true);
    }
  };

  return (
    <>
      <tr style={{ borderTop: `1px solid ${C.rowLine}` }}>
        <td style={{ padding: '6px 12px', fontWeight: 500, color: C.ink, whiteSpace: 'nowrap' }}>{storage ?? '—'}</td>
        {GRADES.map((g) => (
          <td key={g} style={{ padding: '6px 12px' }}>
            <input
              type="number" step="0.01" min={0} placeholder="Prix"
              value={prices[g]} onChange={(e) => setPrices((p) => ({ ...p, [g]: e.target.value }))}
              style={inputStyle}
            />
          </td>
        ))}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap', color: lineDate ? C.sub : C.mute, fontSize: '0.78rem' }}>
          {fmtDate(lineDate)}
        </td>
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
          <button
            onClick={() => setPromoOpen((o) => !o)}
            style={{ marginLeft: 10, padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.74rem' }}
          >
            {promoOpen ? 'Masquer promo' : 'Promo'}
          </button>
        </td>
      </tr>
      {promoOpen && (
        <tr style={{ background: '#fbfdff' }}>
          <td style={{ padding: '4px 12px 8px', fontSize: '0.72rem', color: C.mute }}>Prix barré</td>
          {GRADES.map((g) => (
            <td key={g} style={{ padding: '4px 12px 8px' }}>
              <input
                type="number" step="0.01" min={0} placeholder="—"
                value={compareAts[g]} onChange={(e) => setCompareAts((p) => ({ ...p, [g]: e.target.value }))}
                style={{ ...inputStyle, color: C.mute }}
              />
            </td>
          ))}
          <td />
          <td />
        </tr>
      )}
    </>
  );
}
