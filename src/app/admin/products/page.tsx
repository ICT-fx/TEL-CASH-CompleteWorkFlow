'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Trash2, RefreshCw, Info, Smartphone, Headphones, Store, Zap, Eye, EyeOff, LayoutGrid, List } from 'lucide-react';
import { groupProductsByModel, sortModelGroups, buildModelTree, sortModelNodes, type GroupSortKey, type AdminProduct } from './_lib/groupByModel';
import { ModelRow } from './_components/ModelRow';
import { ModelTreeRow } from './_components/ModelTree';
import { SkuRow } from './_components/SkuRow';

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
    label: 'Téléphones boutique',
    icon: <Smartphone className="w-4 h-4" />,
    color: '#2563eb',
    bgColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  {
    id: 'manual-accessoires',
    source: 'manual',
    category: 'accessoires',
    label: 'Accessoires boutique',
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

// LocalStorage keys + allowed values guards
const LS = {
  viewMode: 'admin.products.viewMode',
  groupSort: 'admin.products.groupSort',
  activeTab: 'admin.products.activeTab',
} as const;
const VIEW_MODES = ['grouped', 'flat'] as const;
const GROUP_SORTS: GroupSortKey[] = ['name-asc', 'stock-asc', 'stock-desc', 'price-asc'];

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<string>('manual-telephones');
  const [productsByTab, setProductsByTab] = useState<Record<string, any[]>>({});
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkActivating, setBulkActivating] = useState(false);
  const [bulkAllActivating, setBulkAllActivating] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [groupSort, setGroupSort] = useState<GroupSortKey>('name-asc');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // Tracks whether we've finished restoring values from localStorage — used to
  // avoid persisting the initial SSR defaults over a valid stored value.
  const [hydrated, setHydrated] = useState(false);

  // Pre-fill the search box from a ?search= query param — used by the dashboard
  // "stock faible" links to land the catalogue pre-filtered on a model.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('search');
      if (q) setSearch(q);
    } catch {
      // window/URLSearchParams unavailable — ignore
    }
  }, []);

  // Restore persisted preferences on mount (client-only)
  useEffect(() => {
    try {
      const storedView = localStorage.getItem(LS.viewMode);
      if (storedView && (VIEW_MODES as readonly string[]).includes(storedView)) {
        setViewMode(storedView as 'grouped' | 'flat');
      }
      const storedSort = localStorage.getItem(LS.groupSort);
      if (storedSort && (GROUP_SORTS as readonly string[]).includes(storedSort)) {
        setGroupSort(storedSort as GroupSortKey);
      }
      const storedTab = localStorage.getItem(LS.activeTab);
      if (storedTab && TABS.some(t => t.id === storedTab)) {
        setActiveTab(storedTab);
      }
    } catch {
      // localStorage may be unavailable (private mode, SSR fallback) — ignore
    }
    setHydrated(true);
  }, []);

  // Persist on change (after initial hydration to avoid clobbering)
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS.viewMode, viewMode); } catch {}
  }, [viewMode, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS.groupSort, groupSort); } catch {}
  }, [groupSort, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LS.activeTab, activeTab); } catch {}
  }, [activeTab, hydrated]);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const isFluxitron = currentTab.source === 'fluxitron';
  const products = productsByTab[activeTab] || [];
  
  // Extract unique brands for the dropdown filter
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort() as string[];

  const loadTab = useCallback(async (tab: Tab, force = false) => {
    if (!force && productsByTab[tab.id] !== undefined) return; // already loaded
    setLoadingTab(tab.id);
    try {
      // Fetch ALL products for the tab by paginating until we've collected the
      // full count. A single capped page (the old `limit=200`) silently hid
      // every product past the cap — which made imported items "invisible" and
      // made "select all + delete" only remove the first page, leaving the rest
      // to reappear. Supabase caps a single request at ~1000 rows, so we page.
      const PAGE_SIZE = 500;
      const all: any[] = [];
      for (let page = 1; ; page++) {
        const res = await fetch(
          `/api/admin/products?source=${tab.source}&category=${tab.category}&page=${page}&limit=${PAGE_SIZE}`
        );
        const data = await res.json();
        const batch = data.products || [];
        all.push(...batch);
        const total = data.pagination?.total ?? all.length;
        if (batch.length < PAGE_SIZE || all.length >= total) break;
      }
      setProductsByTab(prev => ({ ...prev, [tab.id]: all }));
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
    setExpandedGroups(new Set());
  };

  const toggleExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupSelection = (group: { variants: AdminProduct[] }, nextState: 'select' | 'deselect') => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (nextState === 'select') {
        group.variants.forEach(v => next.add(v.id));
      } else {
        group.variants.forEach(v => next.delete(v.id));
      }
      return next;
    });
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

      const blocked: string[] = data.blocked || [];
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
          if (!softRes.ok) {
            const softData = await softRes.json().catch(() => ({}));
            alert(softData.error || 'Erreur lors de la désactivation.');
          }
        }
      }

      // Re-sync the list from the database so the UI always matches reality —
      // prevents the "rows vanish then reappear on reload" mismatch when a
      // delete didn't actually persist.
      await loadTab(currentTab, true);
    } catch {
      alert('Erreur réseau lors de la suppression groupée.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const verb = active ? 'Activer' : 'Désactiver';
    if (!confirm(`${verb} ${ids.length} produit${ids.length > 1 ? 's' : ''} ?`)) return;

    setBulkActivating(true);
    try {
      const res = await fetch('/api/admin/products/bulk-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, active }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'Erreur lors de la mise à jour.');
        return;
      }

      const idSet = new Set(ids);
      setProductsByTab(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(p =>
          idSet.has(p.id) ? { ...p, is_active: active } : p
        ),
      }));
      setSelectedIds(new Set());
    } catch {
      alert('Erreur réseau lors de la mise à jour.');
    } finally {
      setBulkActivating(false);
    }
  };

  const activateAllOnTab = async () => {
    const tabProducts = productsByTab[activeTab] || [];
    const inactiveIds = tabProducts.filter(p => !p.is_active).map(p => p.id);
    if (inactiveIds.length === 0) {
      alert('Tous les produits de cet onglet sont déjà actifs.');
      return;
    }

    if (!confirm(`Activer les ${inactiveIds.length} produit${inactiveIds.length > 1 ? 's' : ''} Fluxitron inactif${inactiveIds.length > 1 ? 's' : ''} de cet onglet ?\n\nIls deviendront visibles sur le site immédiatement.`)) {
      return;
    }

    setBulkAllActivating(true);
    try {
      const res = await fetch('/api/admin/products/bulk-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: inactiveIds, active: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'Erreur lors de l\'activation.');
        return;
      }

      const idSet = new Set(inactiveIds);
      setProductsByTab(prev => ({
        ...prev,
        [activeTab]: (prev[activeTab] || []).map(p =>
          idSet.has(p.id) ? { ...p, is_active: true } : p
        ),
      }));
    } catch {
      alert('Erreur réseau lors de l\'activation.');
    } finally {
      setBulkAllActivating(false);
    }
  };

  const filtered = products.filter(p => {
    if (brandFilter && p.brand !== brandFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.brand} ${p.model} ${p.sku || ''}`.toLowerCase().includes(q);
  });

  // Grouped view derives from the same filtered list — filters always apply first.
  // For phone tabs, group by (brand, model, storage, grade A/B/C) and exclude A+/B+/C+/D/E.
  const isTelephones = currentTab.category === 'telephones';
  const groups = useMemo(
    () => sortModelGroups(
      groupProductsByModel(filtered as AdminProduct[], isTelephones),
      groupSort,
    ),
    [filtered, groupSort, isTelephones]
  );

  // Téléphones : cascade Modèle → Stockage → Grade → Couleurs (les couleurs
  // restent dépliées sous chaque grade). Accessoires : on garde le groupement
  // à plat (ModelRow). L'arbre se construit à partir des groupes « grade ».
  const modelTree = useMemo(
    () => (isTelephones ? sortModelNodes(buildModelTree(groups), groupSort) : []),
    [groups, isTelephones, groupSort]
  );

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Catalogue</h1>
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
      {isFluxitron && (() => {
        const inactiveCount = (productsByTab[activeTab] || []).filter(p => !p.is_active).length;
        return (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: '#f0f9ff', border: '1px solid #bae6fd',
            borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          }}>
            <Info className="w-5 h-5 flex-shrink-0" style={{ color: '#0284c7', marginTop: 1 }} />
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem', marginBottom: 2 }}>
                Catalogue synchronisé automatiquement
              </div>
              <div style={{ color: '#0284c7', fontSize: '0.83rem' }}>
                Ces produits sont envoyés par Fluxitron Hub. Vous pouvez les activer ou désactiver pour contrôler leur visibilité sur le site, mais leur contenu (prix, stock, description) est géré automatiquement.
              </div>
            </div>
            {inactiveCount > 0 && (
              <button
                onClick={activateAllOnTab}
                disabled={bulkAllActivating}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10,
                  background: bulkAllActivating ? '#86efac' : '#0284c7',
                  color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem',
                  cursor: bulkAllActivating ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                title="Active tous les produits Fluxitron inactifs de cet onglet"
              >
                <Eye className="w-4 h-4" />
                {bulkAllActivating ? 'Activation…' : `Activer les ${inactiveCount} inactif${inactiveCount > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        );
      })()}

      {/* Search + refresh */}
      <div className="admin-filters" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="admin-search-wrap" style={{ flexGrow: 1, minWidth: 200, margin: 0 }}>
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder={`Rechercher dans ${currentTab.label.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* View mode toggle (regrouped / flat) */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 12, padding: 3 }}>
          <button
            onClick={() => setViewMode('grouped')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, border: 'none',
              background: viewMode === 'grouped' ? '#fff' : 'transparent',
              color: viewMode === 'grouped' ? '#0f172a' : '#64748b',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              boxShadow: viewMode === 'grouped' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
            title="Regrouper les variantes par modèle"
          >
            <LayoutGrid className="w-4 h-4" />
            Regroupée
          </button>
          <button
            onClick={() => setViewMode('flat')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, border: 'none',
              background: viewMode === 'flat' ? '#fff' : 'transparent',
              color: viewMode === 'flat' ? '#0f172a' : '#64748b',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              boxShadow: viewMode === 'flat' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
            title="Voir chaque SKU sur sa propre ligne"
          >
            <List className="w-4 h-4" />
            À plat
          </button>
        </div>

        {/* Group sort selector — only meaningful in grouped view */}
        {viewMode === 'grouped' && (
          <select
            style={{ width: '210px', cursor: 'pointer', padding: '10.5px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#334155', outline: 'none' }}
            value={groupSort}
            onChange={e => setGroupSort(e.target.value as GroupSortKey)}
          >
            <option value="name-asc">Par modèle (A → Z)</option>
            <option value="stock-asc">Stock total (croissant)</option>
            <option value="stock-desc">Stock total (décroissant)</option>
            <option value="price-asc">Prix min (croissant)</option>
          </select>
        )}

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="admin-btn admin-btn-ghost"
              disabled={bulkDeleting || bulkActivating}
            >
              Annuler
            </button>
            <button
              onClick={() => bulkToggleActive(true)}
              disabled={bulkDeleting || bulkActivating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: (bulkDeleting || bulkActivating) ? '#86efac' : '#16a34a',
                color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.88rem',
                cursor: (bulkDeleting || bulkActivating) ? 'not-allowed' : 'pointer',
              }}
            >
              <Eye className="w-4 h-4" />
              {bulkActivating ? 'Mise à jour…' : `Activer (${selectedInView.length})`}
            </button>
            <button
              onClick={() => bulkToggleActive(false)}
              disabled={bulkDeleting || bulkActivating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: (bulkDeleting || bulkActivating) ? '#cbd5e1' : '#475569',
                color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.88rem',
                cursor: (bulkDeleting || bulkActivating) ? 'not-allowed' : 'pointer',
              }}
            >
              <EyeOff className="w-4 h-4" />
              {bulkActivating ? 'Mise à jour…' : `Désactiver (${selectedInView.length})`}
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting || bulkActivating}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: bulkDeleting ? '#fca5a5' : '#dc2626',
                color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.88rem',
                cursor: (bulkDeleting || bulkActivating) ? 'not-allowed' : 'pointer',
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
          ) : viewMode === 'flat' ? (
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
                  <th>Couleur</th>
                  <th>Stockage</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Statut</th>
                  <th style={{ width: isFluxitron ? 100 : 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <SkuRow
                    key={p.id}
                    product={p as AdminProduct}
                    isSelected={selectedIds.has(p.id)}
                    isFluxitron={p.source === 'fluxitron' || isFluxitron}
                    onToggleSelect={toggleSelect}
                    onToggleActive={toggleActive}
                    onDelete={deleteProduct}
                  />
                ))}
              </tbody>
            </table>
          ) : groups.length === 0 ? (
            <div className="admin-empty">Aucun modèle ne correspond à votre recherche.</div>
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
                  <th>Modèle</th>
                  <th>{isTelephones ? 'Détail' : 'Variantes'}</th>
                  <th>Stock total</th>
                  <th>Prix</th>
                  <th>Alertes</th>
                </tr>
              </thead>
              <tbody>
                {isTelephones
                  ? modelTree.map(node => (
                      <ModelTreeRow
                        key={node.key}
                        node={node}
                        handlers={{
                          expandedGroups,
                          selectedIds,
                          onToggleExpand: toggleExpand,
                          onToggleGroupSelection: toggleGroupSelection,
                          onToggleSkuSelect: toggleSelect,
                          onToggleActive: toggleActive,
                          onDelete: deleteProduct,
                        }}
                      />
                    ))
                  : groups.map(g => (
                      <ModelRow
                        key={g.key}
                        group={g}
                        isExpanded={expandedGroups.has(g.key)}
                        selectedIds={selectedIds}
                        onToggleExpand={toggleExpand}
                        onToggleGroupSelection={toggleGroupSelection}
                        onToggleSkuSelect={toggleSelect}
                        onToggleActive={toggleActive}
                        onDelete={deleteProduct}
                      />
                    ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '0.82rem' }}>
            {viewMode === 'grouped' ? (() => {
              const modelCount = isTelephones ? modelTree.length : groups.length;
              return (
                <>
                  {modelCount} modèle{modelCount > 1 ? 's' : ''} ({filtered.length} variante{filtered.length > 1 ? 's' : ''})
                  {search && ` trouvé${modelCount > 1 ? 's' : ''}`}
                </>
              );
            })() : (
              <>
                {filtered.length} produit{filtered.length > 1 ? 's' : ''}
                {search && ` trouvé${filtered.length > 1 ? 's' : ''}`}
                {!search && currentTab.source === 'manual' && ' dans votre boutique'}
                {!search && currentTab.source === 'fluxitron' && ' synchronisés depuis Fluxitron'}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
