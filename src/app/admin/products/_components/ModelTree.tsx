'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight, AlertTriangle, Zap, Store } from 'lucide-react';
import { SkuRow } from './SkuRow';
import {
  getStockLevel,
  type ModelNode,
  type StorageNode,
  type ModelGroup,
  type StockLevel,
  type AdminProduct,
} from '../_lib/groupByModel';

// Cascade téléphones : Modèle → Stockage → Grade → Couleurs.
// Les trois niveaux intermédiaires (modèle / stockage / grade) sont des <tr>
// de la table extérieure, indentés ; au niveau du grade, le dépliage rend la
// sous-table de SKU couleur (même motif que ModelRow). L'état d'expansion et la
// sélection groupée sont partagés via le Set `expandedGroups` de la page (clés
// distinctes par niveau : brand|model, brand|model|storage, brand|model|storage|grade).

const PLACEHOLDER = 'https://placehold.co/88x88/f8fafc/cbd5e1?text=📱';

const STOCK_BADGE_STYLE: Record<StockLevel, { bg: string; color: string; label: (n: number) => string }> = {
  empty:    { bg: '#7f1d1d', color: '#fff', label: () => 'Rupture' },
  critical: { bg: '#dc2626', color: '#fff', label: (n) => `${n} en stock` },
  warning:  { bg: '#f59e0b', color: '#fff', label: (n) => `${n} en stock` },
  ok:       { bg: '#16a34a', color: '#fff', label: (n) => `${n} en stock` },
};

interface SharedHandlers {
  expandedGroups: Set<string>;
  selectedIds: Set<string>;
  onToggleExpand: (key: string) => void;
  onToggleGroupSelection: (group: { variants: AdminProduct[] }, nextState: 'select' | 'deselect') => void;
  onToggleSkuSelect: (id: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
}

function StockBadge({ total }: { total: number }) {
  const s = STOCK_BADGE_STYLE[getStockLevel(total)];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 10px', borderRadius: 8,
        background: s.bg, color: s.color,
        fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap',
      }}
    >
      {s.label(total)}
    </span>
  );
}

function priceRange(min: number, max: number): string {
  if (min <= 0 && max <= 0) return '—';
  return min === max ? `${min.toFixed(0)} €` : `${min.toFixed(0)} € — ${max.toFixed(0)} €`;
}

function AlertCell({ flags }: { flags: string[] }) {
  if (flags.length === 0) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      <AlertTriangle className="w-3 h-3" style={{ color: '#b45309', flexShrink: 0 }} />
      {flags.slice(0, 3).map((flag, i) => (
        <span
          key={i}
          style={{
            fontSize: '0.68rem', fontWeight: 500,
            background: flag.endsWith('rupture') ? '#fee2e2' : '#fef3c7',
            color: flag.endsWith('rupture') ? '#b91c1c' : '#b45309',
            borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap',
          }}
        >
          {flag}
        </span>
      ))}
      {flags.length > 3 && (
        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8' }}>+{flags.length - 3}</span>
      )}
    </div>
  );
}

// Case à cocher de sélection groupée (état indéterminé géré via ref) — partagée
// par les trois niveaux intermédiaires. Sélectionne/désélectionne toutes les
// variantes feuilles du nœud.
function GroupCheckbox({
  variants,
  selectedIds,
  onToggleGroupSelection,
  ariaLabel,
}: {
  variants: AdminProduct[];
  selectedIds: Set<string>;
  onToggleGroupSelection: SharedHandlers['onToggleGroupSelection'];
  ariaLabel: string;
}) {
  const selectedCount = variants.filter((v) => selectedIds.has(v.id)).length;
  const allSelected = selectedCount === variants.length && variants.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={allSelected}
      onChange={() => onToggleGroupSelection({ variants }, allSelected ? 'deselect' : 'select')}
      style={{ cursor: 'pointer', width: 16, height: 16 }}
    />
  );
}

function sourceBadgeStyle(isFluxitron: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: '0.7rem', fontWeight: 700,
    background: isFluxitron ? '#0e7490' : '#475569',
    color: '#fff', borderRadius: 6, padding: '1px 6px',
  };
}

function Chevron({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <ChevronRight
      className="w-4 h-4"
      style={{
        color,
        transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
        transition: 'transform 0.15s',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Niveau 3 : Grade (ligne porteuse du prix) → déplie les couleurs ─────────
function GradeTreeRow({ group, handlers }: { group: ModelGroup; handlers: SharedHandlers }) {
  const { expandedGroups, selectedIds, onToggleExpand, onToggleGroupSelection, onToggleSkuSelect, onToggleActive, onDelete } = handlers;
  const isExpanded = expandedGroups.has(group.key);
  const letter = group.gradeLetter ?? '';
  const badgeClass = letter === 'A' ? 'admin-badge-green' : letter === 'B' ? 'admin-badge-yellow' : 'admin-badge-red';
  const isFluxitron = group.representativeSource === 'fluxitron';
  const price =
    group.minPrice === group.maxPrice
      ? `${group.minPrice.toFixed(0)} €`
      : `${group.minPrice.toFixed(0)} € — ${group.maxPrice.toFixed(0)} €`;

  return (
    <>
      <tr
        style={{ background: '#fff', borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
        onClick={() => onToggleExpand(group.key)}
      >
        <td onClick={(e) => e.stopPropagation()} style={{ verticalAlign: 'middle' }}>
          <GroupCheckbox
            variants={group.variants}
            selectedIds={selectedIds}
            onToggleGroupSelection={onToggleGroupSelection}
            ariaLabel={`Sélectionner ${group.brand} ${group.model} ${group.storage} grade ${letter}`}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 80 }}>
            <Chevron expanded={isExpanded} color="#cbd5e1" />
            <span className={`admin-badge ${badgeClass}`}>Grade {letter}</span>
          </div>
        </td>
        <td style={{ verticalAlign: 'middle', fontSize: '0.85rem', color: '#475569' }}>
          <strong>{group.colorCount}</strong> couleur{group.colorCount > 1 ? 's' : ''}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {group.activeCount} active{group.activeCount > 1 ? 's' : ''}
          </div>
        </td>
        <td style={{ verticalAlign: 'middle' }}><StockBadge total={group.totalStock} /></td>
        <td style={{ verticalAlign: 'middle', fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>{price}</td>
        <td style={{ verticalAlign: 'middle' }}><AlertCell flags={group.riskFlags} /></td>
      </tr>

      {/* Couleurs : on réutilise la sous-table SKU (1 ligne par couleur) */}
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: '#fafafa' }}>
            <table className="admin-table" style={{ background: 'transparent' }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Variante</th>
                  <th>Grade</th>
                  <th>Couleur</th>
                  <th>Stockage</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Statut</th>
                  <th style={{ width: isFluxitron ? 100 : 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.variants.map((v) => (
                  <SkuRow
                    key={v.id}
                    product={v}
                    isSelected={selectedIds.has(v.id)}
                    isFluxitron={v.source === 'fluxitron'}
                    onToggleSelect={onToggleSkuSelect}
                    onToggleActive={onToggleActive}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Niveau 2 : Stockage → déplie les grades ─────────────────────────────────
function StorageTreeRow({ node, handlers }: { node: StorageNode; handlers: SharedHandlers }) {
  const { expandedGroups, selectedIds, onToggleExpand, onToggleGroupSelection } = handlers;
  const isExpanded = expandedGroups.has(node.key);

  return (
    <>
      <tr
        style={{ background: '#fcfdff', borderTop: '1px solid #eef2f7', cursor: 'pointer' }}
        onClick={() => onToggleExpand(node.key)}
      >
        <td onClick={(e) => e.stopPropagation()} style={{ verticalAlign: 'middle' }}>
          <GroupCheckbox
            variants={node.variants}
            selectedIds={selectedIds}
            onToggleGroupSelection={onToggleGroupSelection}
            ariaLabel={`Sélectionner le stockage ${node.storage}`}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 40 }}>
            <Chevron expanded={isExpanded} color="#94a3b8" />
            <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.92rem' }}>{node.storage}</span>
          </div>
        </td>
        <td style={{ verticalAlign: 'middle', fontSize: '0.85rem', color: '#475569' }}>
          <strong>{node.grades.length}</strong> grade{node.grades.length > 1 ? 's' : ''}
        </td>
        <td style={{ verticalAlign: 'middle' }}><StockBadge total={node.totalStock} /></td>
        <td style={{ verticalAlign: 'middle', fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
          {priceRange(node.minPrice, node.maxPrice)}
        </td>
        <td />
      </tr>

      {isExpanded && node.grades.map((g) => (
        <GradeTreeRow key={g.key} group={g} handlers={handlers} />
      ))}
    </>
  );
}

// ─── Niveau 1 : Modèle → déplie les stockages ────────────────────────────────
export function ModelTreeRow({ node, handlers }: { node: ModelNode; handlers: SharedHandlers }) {
  const { expandedGroups, selectedIds, onToggleExpand, onToggleGroupSelection } = handlers;
  const isExpanded = expandedGroups.has(node.key);
  const isFluxitron = node.representativeSource === 'fluxitron';

  return (
    <>
      <tr
        style={{ background: isExpanded ? '#f8fafc' : '#fff', borderTop: '1px solid #e2e8f0', cursor: 'pointer' }}
        onClick={() => onToggleExpand(node.key)}
      >
        <td onClick={(e) => e.stopPropagation()} style={{ verticalAlign: 'middle' }}>
          <GroupCheckbox
            variants={node.variants}
            selectedIds={selectedIds}
            onToggleGroupSelection={onToggleGroupSelection}
            ariaLabel={`Sélectionner toutes les variantes de ${node.brand} ${node.model}`}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Chevron expanded={isExpanded} color="#64748b" />
            <img
              src={node.representativeImage || PLACEHOLDER}
              alt={`${node.brand} ${node.model}`}
              className="product-thumb"
            />
            <div>
              <div className="product-name" style={{ fontWeight: 700 }}>
                {node.brand} {node.model}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={sourceBadgeStyle(isFluxitron)}>
                  {isFluxitron ? <><Zap className="w-2.5 h-2.5" /> Fluxitron</> : <><Store className="w-2.5 h-2.5" /> Manuel</>}
                </span>
              </div>
            </div>
          </div>
        </td>
        <td style={{ verticalAlign: 'middle', fontSize: '0.85rem', color: '#475569' }}>
          <strong>{node.storageCount}</strong> stockage{node.storageCount > 1 ? 's' : ''}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {node.activeCount} active{node.activeCount > 1 ? 's' : ''}
          </div>
        </td>
        <td style={{ verticalAlign: 'middle' }}><StockBadge total={node.totalStock} /></td>
        <td style={{ verticalAlign: 'middle', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
          {priceRange(node.minPrice, node.maxPrice)}
        </td>
        <td style={{ verticalAlign: 'middle' }}><AlertCell flags={node.riskFlags} /></td>
      </tr>

      {isExpanded && node.storages.map((s) => (
        <StorageTreeRow key={s.key} node={s} handlers={handlers} />
      ))}
    </>
  );
}
