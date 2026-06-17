'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight, AlertTriangle, Zap, Store } from 'lucide-react';
import { SkuRow } from './SkuRow';
import { getStockLevel, type ModelGroup, type StockLevel, type AdminProduct } from '../_lib/groupByModel';

interface ModelRowProps {
  group: ModelGroup;
  isExpanded: boolean;
  selectedIds: Set<string>;
  onToggleExpand: (key: string) => void;
  onToggleGroupSelection: (group: ModelGroup, nextState: 'select' | 'deselect') => void;
  onToggleSkuSelect: (id: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
}

const STOCK_BADGE_STYLE: Record<StockLevel, { bg: string; color: string; label: (n: number) => string }> = {
  empty:    { bg: '#7f1d1d', color: '#fff', label: () => 'Rupture' },
  critical: { bg: '#dc2626', color: '#fff', label: (n) => `${n} en stock` },
  warning:  { bg: '#f59e0b', color: '#fff', label: (n) => `${n} en stock` },
  ok:       { bg: '#16a34a', color: '#fff', label: (n) => `${n} en stock` },
};

export function ModelRow({
  group,
  isExpanded,
  selectedIds,
  onToggleExpand,
  onToggleGroupSelection,
  onToggleSkuSelect,
  onToggleActive,
  onDelete,
}: ModelRowProps) {
  const selectedInGroup = group.variants.filter((v: AdminProduct) => selectedIds.has(v.id)).length;
  const allSelected = selectedInGroup === group.variantCount && group.variantCount > 0;
  const someSelected = selectedInGroup > 0 && !allSelected;

  // Native indeterminate state — only settable via JS
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const stockLevel = getStockLevel(group.totalStock);
  const stockStyle = STOCK_BADGE_STYLE[stockLevel];

  const priceLabel =
    group.minPrice === group.maxPrice
      ? `${group.minPrice.toFixed(0)} €`
      : `${group.minPrice.toFixed(0)} € — ${group.maxPrice.toFixed(0)} €`;

  const isFluxitron = group.representativeSource === 'fluxitron';

  return (
    <>
      {/* Parent (collapsed/expanded header row) */}
      <tr
        style={{
          background: isExpanded ? '#f8fafc' : '#fff',
          borderTop: '1px solid #e2e8f0',
          cursor: 'pointer',
        }}
        onClick={() => onToggleExpand(group.key)}
      >
        <td onClick={(e) => e.stopPropagation()} style={{ verticalAlign: 'middle' }}>
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-label={`Sélectionner toutes les variantes de ${group.brand} ${group.model}`}
            checked={allSelected}
            onChange={() => onToggleGroupSelection(group, allSelected ? 'deselect' : 'select')}
            style={{ cursor: 'pointer', width: 16, height: 16 }}
          />
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ChevronRight
              className="w-4 h-4"
              style={{
                color: '#64748b',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
                flexShrink: 0,
              }}
            />
            <img
              src={group.representativeImage || 'https://placehold.co/88x88/f8fafc/cbd5e1?text=📱'}
              alt={`${group.brand} ${group.model}`}
              className="product-thumb"
            />
            <div>
              <div className="product-name" style={{ fontWeight: 700 }}>
                {group.brand} {group.model} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {group.storage}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.7rem', fontWeight: 700,
                  background: isFluxitron ? '#0e7490' : '#475569',
                  color: '#fff', borderRadius: 6, padding: '1px 6px',
                }}>
                  {isFluxitron ? <><Zap className="w-2.5 h-2.5" /> Fluxitron</> : <><Store className="w-2.5 h-2.5" /> Manuel</>}
                </span>
              </div>
            </div>
          </div>
        </td>
        <td style={{ verticalAlign: 'middle', fontSize: '0.85rem', color: '#475569' }}>
          <strong>{group.variantCount}</strong> variante{group.variantCount > 1 ? 's' : ''}
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {group.activeCount} active{group.activeCount > 1 ? 's' : ''}
          </div>
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8,
              background: stockStyle.bg, color: stockStyle.color,
              fontWeight: 700, fontSize: '0.82rem',
              whiteSpace: 'nowrap',
            }}
          >
            {stockStyle.label(group.totalStock)}
          </span>
        </td>
        <td style={{ verticalAlign: 'middle', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            {priceLabel}
            {group.marginPct != null && (
              <span
                title="Marge moyenne incluse dans le prix (vs prix fournisseur)"
                style={{
                  fontSize: '0.72rem', fontWeight: 700,
                  color: group.marginPct < 0.05 ? '#dc2626' : '#16a34a',
                  background: group.marginPct < 0.05 ? '#fee2e2' : '#dcfce7',
                  borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap',
                }}
              >
                {group.marginPct >= 0 ? '+' : ''}{(group.marginPct * 100).toFixed(0)} %
                {group.marginEuroAvg != null ? ` · ${group.marginEuroAvg >= 0 ? '+' : ''}${group.marginEuroAvg.toFixed(0)} €` : ''}
              </span>
            )}
          </span>
        </td>
        <td style={{ verticalAlign: 'middle' }}>
          {group.riskFlags.length === 0 ? (
            <span style={{ color: '#94a3b8' }}>—</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <AlertTriangle className="w-3 h-3" style={{ color: '#b45309', flexShrink: 0 }} />
              {group.riskFlags.slice(0, 3).map((flag, i) => (
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
              {group.riskFlags.length > 3 && (
                <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8' }}>
                  +{group.riskFlags.length - 3}
                </span>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Expanded: reuse the exact flat-view row component for every variant */}
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
