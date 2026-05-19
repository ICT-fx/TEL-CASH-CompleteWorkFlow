'use client';

import Link from 'next/link';
import { Pencil, Trash2, Power } from 'lucide-react';
import { colorToCss, normalizeGradeLetter } from '../_lib/display';
import type { AdminProduct } from '../_lib/groupByModel';

interface SkuRowProps {
  product: AdminProduct;
  isSelected: boolean;
  isFluxitron: boolean;            // controls visibility of edit link + "Auto" tag
  onToggleSelect: (id: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
}

// Single SKU row — shared between the flat catalog view and the
// expandable sub-table inside a grouped model row.
// All actions delegate back to the parent page so we keep a single source of truth.
export function SkuRow({
  product: p,
  isSelected,
  isFluxitron,
  onToggleSelect,
  onToggleActive,
  onDelete,
}: SkuRowProps) {
  const letter = normalizeGradeLetter(p.grade);
  const priceNum = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
  const compareNum =
    p.compare_at_price == null
      ? null
      : typeof p.compare_at_price === 'string'
        ? parseFloat(p.compare_at_price)
        : p.compare_at_price;

  return (
    <tr key={p.id} className={!p.is_active ? 'row-inactive' : ''}>
      <td>
        <input
          type="checkbox"
          aria-label={`Sélectionner ${p.brand} ${p.model}`}
          checked={isSelected}
          onChange={() => onToggleSelect(p.id)}
          style={{ cursor: 'pointer', width: 16, height: 16 }}
        />
      </td>
      <td>
        <div className="product-cell">
          <img
            src={p.images?.[0] || 'https://placehold.co/88x88/f8fafc/cbd5e1?text=📱'}
            alt={p.model || ''}
            className="product-thumb"
          />
          <div>
            <div className="product-name">{p.brand} {p.model}</div>
            <div className="product-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.sku ? <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#94a3b8' }}>{p.sku}</span> : null}
            </div>
          </div>
        </div>
      </td>
      <td>
        {letter ? (
          <span className={`admin-badge ${letter === 'A' ? 'admin-badge-green' : letter === 'B' ? 'admin-badge-yellow' : 'admin-badge-red'}`}>
            Grade {letter}
          </span>
        ) : <span style={{ color: '#94a3b8' }}>—</span>}
      </td>
      <td>
        {p.color ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#475569' }}>
            <span style={{
              display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
              background: colorToCss(p.color), border: '1px solid #e2e8f0',
            }} />
            {p.color}
          </span>
        ) : <span style={{ color: '#94a3b8' }}>—</span>}
      </td>
      <td style={{ color: '#475569', fontSize: '0.88rem' }}>
        {p.storage_capacity || '—'}
      </td>
      <td>
        <div style={{ fontWeight: 600 }}>{Number(priceNum).toFixed(2)} €</div>
        {compareNum != null && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
            {Number(compareNum).toFixed(2)} €
          </div>
        )}
      </td>
      <td>
        <span className={p.stock <= 2 ? 'admin-badge admin-badge-red' : p.stock <= 5 ? 'admin-badge admin-badge-yellow' : ''}>
          {p.stock}
        </span>
      </td>
      <td>
        <button
          className={`admin-badge ${p.is_active ? 'admin-badge-green' : 'admin-badge-gray'}`}
          onClick={() => onToggleActive(p.id, p.is_active)}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <Power className="w-3 h-3" />
          {p.is_active ? 'En ligne' : 'Hors ligne'}
        </button>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!isFluxitron && (
            <Link href={`/admin/products/${p.id}`} className="admin-icon-btn" title="Modifier">
              <Pencil className="w-4 h-4" />
            </Link>
          )}
          <button onClick={() => onDelete(p.id)} className="admin-icon-btn admin-icon-btn-danger" title="Supprimer définitivement">
            <Trash2 className="w-4 h-4" />
          </button>
          {isFluxitron && (
            <span
              title="Contenu géré par Fluxitron"
              style={{ color: '#94a3b8', fontSize: '0.7rem', fontStyle: 'italic', padding: '0 2px' }}
            >
              Auto
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
