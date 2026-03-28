'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Power } from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/products')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); });
  }, []);

  const toggleActive = async (id: string, currentState: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentState }),
    });
    setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentState } : p));
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Désactiver ce produit ?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    setProducts(products.map(p => p.id === id ? { ...p, is_active: false } : p));
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.brand} ${p.model}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Catalogue</h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>{products.length} produit{products.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/products/new" className="admin-btn admin-btn-primary admin-btn-lg">
          <Plus className="w-4 h-4" /> Ajouter un téléphone
        </Link>
      </div>

      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-body">
          {loading ? (
            <div className="admin-empty">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">Aucun produit trouvé</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Grade</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Statut</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className={!p.is_active ? 'row-inactive' : ''}>
                    <td>
                      <div className="product-cell">
                        <img
                          src={p.images?.[0] || 'https://placehold.co/88x88/f8fafc/cbd5e1?text=📱'}
                          alt={p.model}
                          className="product-thumb"
                        />
                        <div>
                          <div className="product-name">{p.brand} {p.model}</div>
                          <div className="product-sub">
                            {p.storage_capacity || '—'} {p.color ? `· ${p.color}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.grade ? (
                        <span className={`admin-badge ${p.grade === 'A' ? 'admin-badge-green' : p.grade === 'B' ? 'admin-badge-yellow' : 'admin-badge-red'}`}>
                          Grade {p.grade}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{parseFloat(p.price).toFixed(2)} €</td>
                    <td>
                      <span className={p.stock <= 2 ? 'admin-badge admin-badge-red' : ''}>
                        {p.stock}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`admin-badge ${p.is_active ? 'admin-badge-green' : 'admin-badge-gray'}`}
                        onClick={() => toggleActive(p.id, p.is_active)}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        <Power className="w-3 h-3" />
                        {p.is_active ? 'En ligne' : 'Hors ligne'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Link href={`/admin/products/${p.id}`} className="admin-icon-btn" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button onClick={() => deleteProduct(p.id)} className="admin-icon-btn admin-icon-btn-danger" title="Désactiver">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
