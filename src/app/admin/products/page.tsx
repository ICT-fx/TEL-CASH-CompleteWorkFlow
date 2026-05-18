'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Power, RefreshCw, Info, Smartphone, Headphones, Store, Zap } from 'lucide-react';

type Source = 'manual' | 'fluxitron';
type Category = 'telephones' | 'accessoires';

interface Tab {
  id: string;
  source: Source;
  category: Category;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const TABS: Tab[] = [
  {
    id: 'manual-telephones',
    source: 'manual',
    category: 'telephones',
    label: 'Téléphones Boutique',
    icon: <Smartphone className="w-4 h-4" />,
    color: '#2563eb',
    bgColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  {
    id: 'manual-accessoires',
    source: 'manual',
    category: 'accessoires',
    label: 'Accessoires Boutique',
    icon: <Headphones className="w-4 h-4" />,
    color: '#7c3aed',
    bgColor: '#ede9fe',
    borderColor: '#c4b5fd',
  },
  {
    id: 'fluxitron-telephones',
    source: 'fluxitron',
    category: 'telephones',
    label: 'Téléphones Fluxitron',
    icon: <Smartphone className="w-4 h-4" />,
    color: '#0e7490',
    bgColor: '#cffafe',
    borderColor: '#67e8f9',
  },
  {
    id: 'fluxitron-accessoires',
    source: 'fluxitron',
    category: 'accessoires',
    label: 'Accessoires Fluxitron',
    icon: <Headphones className="w-4 h-4" />,
    color: '#0f766e',
    bgColor: '#ccfbf1',
    borderColor: '#5eead4',
  },
];

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<string>('manual-telephones');
  const [productsByTab, setProductsByTab] = useState<Record<string, any[]>>({});
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const isFluxitron = currentTab.source === 'fluxitron';
  const products = productsByTab[activeTab] || [];
  
  // Extract unique brands for the dropdown filter
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort() as string[];

  const loadTab = useCallback(async (tab: Tab) => {
    if (productsByTab[tab.id] !== undefined) return; // already loaded
    setLoadingTab(tab.id);
    try {
      const res = await fetch(
        `/api/admin/products?source=${tab.source}&category=${tab.category}&limit=200`
      );
      const data = await res.json();
      setProductsByTab(prev => ({ ...prev, [tab.id]: data.products || [] }));
    } catch {
      setProductsByTab(prev => ({ ...prev, [tab.id]: [] }));
    } finally {
      setLoadingTab(null);
    }
  }, [productsByTab]);

  // Load initial tab
  useEffect(() => {
    loadTab(currentTab);
  }, [activeTab]); // eslint-disable-line

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearch('');
    setBrandFilter('');
    setSelectedIds(new Set());
  };

  const refresh = async () => {
    setSelectedIds(new Set());
    setProductsByTab(prev => {
      const next = { ...prev };
      delete next[activeTab];
      return next;
    });
    await loadTab(currentTab);
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentState }),
    });
    setProductsByTab(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).map(p =>
        p.id === id ? { ...p, is_active: !currentState } : p
      ),
    }));
  };

  const deleteProduct = async (id: string) => {
    const product = (productsByTab[activeTab] || []).find(p => p.id === id);
    const label = product ? `${product.brand} ${product.model}` : 'ce produit';
    if (!confirm(`Supprimer définitivement ${label} ?\n\nCette action est irréversible. Le produit sera retiré du catalogue.`)) return;

    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });

    if (res.ok) {
      setProductsByTab(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).filter(p => p.id !== id),
      }));
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data.code === 'PRODUCT_HAS_ORDERS') {
      if (confirm(`${data.error}\n\nVoulez-vous le désactiver maintenant ?`)) {
        const softRes = await fetch(`/api/admin/products/${id}?mode=soft`, { method: 'DELETE' });
        if (softRes.ok) {
          setProductsByTab(prev => ({
            ...prev,
            [activeTab]: (prev[activeTab] || []).map(p =>
              p.id === id ? { ...p, is_active: false } : p
            ),
          }));
        } else {
          alert('Erreur lors de la désactivation du produit.');
        }
      }
      return;
    }

    alert(data.error || 'Erreur lors de la suppression du produit.');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (filteredIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = filteredIds.length > 0 && filteredIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Supprimer définitivement ${ids.length} produit${ids.length > 1 ? 's' : ''} ?\n\nCette action est irréversible. Les produits liés à des commandes passées ne pourront pas être supprimés — vous pourrez choisir de les désactiver.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, fallbackToSoft: false }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'Erreur lors de la suppression groupée.');
        return;
      }

      const deletedIds = new Set(ids.filter(id => !(data.blocked || []).includes(id)));
      const blocked: string[] = data.blocked || [];

      // Remove successfully deleted ones from UI
      setProductsByTab(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).filter(p => !deletedIds.has(p.id)),
      }));
      setSelectedIds(new Set());

      if (blocked.length > 0) {
        const proceed = confirm(
          `${data.deletedCount} produit(s) supprimé(s).\n${blocked.length} produit(s) sont liés à des commandes passées et n'ont pas pu être supprimés.\n\nVoulez-vous les désactiver à la place ?`
        );
        if (proceed) {
          const softRes = await fetch('/api/admin/products/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: blocked, fallbackToSoft: true }),
          });
          if (softRes.ok) {
            setProductsByTab(prev => ({
              ...prev,
              [activeTab]: (prev[activeTab] || []).map(p =>
                blocked.includes(p.id) ? { ...p, is_active: false } : p
              ),
            }));
          } else {
            const softData = await softRes.json().catch(() => ({}));
            alert(softData.error || 'Erreur lors de la désactivation.');
          }
        }
      } else if (data.deletedCount > 0) {
        // Silent success — UI already reflects the change
      }
    } catch {
      alert('Erreur réseau lors de la suppression groupée.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const filtered = products.filter(p => {
    if (brandFilter && p.brand !== brandFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.brand} ${p.model} ${p.sku || ''}`.toLowerCase().includes(q);
  });

  const isLoading = loadingTab === activeTab;
  const filteredIds = filtered.map(p => p.id);
  const selectedInView = filteredIds.filter(id => selectedIds.has(id));
  const allSelected = filteredIds.length > 0 && selectedInView.length === filteredIds.length;
  const someSelected = selectedInView.length > 0 && !allSelected;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Catalogue</h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Gérez vos produits par source et catégorie
          </p>
        </div>
        {!isFluxitron && (
          <Link href="/admin/products/new" className="admin-btn admin-btn-primary admin-btn-lg">
            <Plus className="w-4 h-4" />
            Ajouter un produit
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const tabProducts = productsByTab[tab.id];
          const count = tabProducts?.length;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                border: `2px solid ${isActive ? tab.borderColor : '#e2e8f0'}`,
                background: isActive ? tab.bgColor : '#fff',
                color: isActive ? tab.color : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              <span style={{ color: isActive ? tab.color : '#94a3b8' }}>{tab.icon}</span>
              {tab.label}
              {tab.source === 'fluxitron' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: isActive ? tab.color : '#94a3b8',
                  color: '#fff', borderRadius: 6, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  <Zap className="w-2.5 h-2.5" /> Auto
                </span>
              )}
              {tab.source === 'manual' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: isActive ? tab.color : '#94a3b8',
                  color: '#fff', borderRadius: 6, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  <Store className="w-2.5 h-2.5" /> Manuel
                </span>
              )}
              {count !== undefined && (
                <span style={{
                  background: isActive ? tab.color : '#e2e8f0',
                  color: isActive ? '#fff' : '#64748b',
                  borderRadius: '999px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fluxitron info banner */}
      {isFluxitron && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
        }}>
          <Info className="w-5 h-5 flex-shrink-0" style={{ color: '#0284c7', marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem', marginBottom: 2 }}>
              Catalogue synchronisé automatiquement
            </div>
            <div style={{ color: '#0284c7', fontSize: '0.83rem' }}>
              Ces produits sont envoyés par Fluxitron Hub. Vous pouvez les activer ou désactiver pour contrôler leur visibilité sur le site, mais leur contenu (prix, stock, description) est géré automatiquement.
            </div>
          </div>
        </div>
      )}

      {/* Search + refresh */}
      <div className="admin-filters" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="admin-search-wrap" style={{ flexGrow: 1, margin: 0 }}>
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder={`Rechercher dans ${currentTab.label.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          style={{ width: '200px', cursor: 'pointer', padding: '10.5px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#334155', outline: 'none' }}
          value={brandFilter} 
          onChange={e => setBrandFilter(e.target.value)}
        >
          <option value="">Toutes les marques</option>
          {uniqueBrands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <button
          onClick={refresh}
          className="admin-btn admin-btn-ghost"
          title="Rafraîchir"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedInView.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 18px', marginBottom: 12,
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
        }}>
          <div style={{ fontSize: '0.9rem', color: '#991b1b', fontWeight: 600 }}>
            {selectedInView.length} produit{selectedInView.length > 1 ? 's' : ''} sélectionné{selectedInView.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="admin-btn admin-btn-ghost"
              disabled={bulkDeleting}
            >
              Annuler
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: bulkDeleting ? '#fca5a5' : '#dc2626',
                color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.88rem',
                cursor: bulkDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 className="w-4 h-4" />
              {bulkDeleting ? 'Suppression…' : `Supprimer (${selectedInView.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="admin-panel">
        <div className="admin-panel-body">
          {isLoading ? (
            <div className="admin-empty">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              {search ? 'Aucun résultat pour cette recherche' : (
                isFluxitron
                  ? 'Aucun produit Fluxitron dans cette catégorie pour l\'instant'
                  : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>📦</div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Aucun produit encore</div>
                      <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
                        <Plus className="w-4 h-4" /> Ajouter un produit
                      </Link>
                    </div>
                  )
              )}
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={() => toggleSelectAll(filteredIds)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </th>
                  <th>Produit</th>
                  <th>Grade</th>
                  <th>Stockage</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Statut</th>
                  <th style={{ width: isFluxitron ? 100 : 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id} className={!p.is_active ? 'row-inactive' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${p.brand} ${p.model}`}
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                    <td>
                      <div className="product-cell">
                        <img
                          src={p.images?.[0] || 'https://placehold.co/88x88/f8fafc/cbd5e1?text=📱'}
                          alt={p.model}
                          className="product-thumb"
                        />
                        <div>
                          <div className="product-name">{p.brand} {p.model}</div>
                          <div className="product-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {p.sku ? <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#94a3b8' }}>{p.sku}</span> : null}
                            {p.color ? <span>· {p.color}</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.grade ? (
                        <span className={`admin-badge ${p.grade === 'Parfait État' ? 'admin-badge-green' : p.grade === 'Très Bon État' ? 'admin-badge-yellow' : 'admin-badge-red'}`}>
                          {p.grade}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.88rem' }}>
                      {p.storage_capacity || '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{parseFloat(p.price).toFixed(2)} €</div>
                      {p.compare_at_price && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                          {parseFloat(p.compare_at_price).toFixed(2)} €
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
                        onClick={() => toggleActive(p.id, p.is_active)}
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
                        <button onClick={() => deleteProduct(p.id)} className="admin-icon-btn admin-icon-btn-danger" title="Supprimer définitivement">
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
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '0.82rem' }}>
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            {search && ` trouvé${filtered.length > 1 ? 's' : ''}`}
            {!search && currentTab.source === 'manual' && ' dans votre boutique'}
            {!search && currentTab.source === 'fluxitron' && ' synchronisés depuis Fluxitron'}
          </div>
        )}
      </div>
    </div>
  );
}
