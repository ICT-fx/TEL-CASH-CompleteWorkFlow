'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.push('/'); return; }
    fetch('/api/admin/products')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); });
  }, [profile]);

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

  return (
    <div className="page">
      <div className="container">
        <div className="flex-between mb-2">
          <div>
            <Link href="/admin">← Dashboard</Link>
            <h1 style={{ marginTop: 8 }}>Gestion des produits</h1>
          </div>
          <Link href="/admin/products/new" className="btn btn-primary">+ Nouveau produit</Link>
        </div>

        {loading ? <p>Chargement...</p> : (
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Grade</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                  <td><strong>{p.brand}</strong> {p.model}</td>
                  <td>{p.category}</td>
                  <td>{p.grade ? <span className={`grade grade-${p.grade}`}>{p.grade}</span> : '—'}</td>
                  <td>{parseFloat(p.price).toFixed(2)} €</td>
                  <td style={{ color: p.stock <= 2 ? 'var(--danger)' : 'inherit' }}>{p.stock}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${p.is_active ? 'btn-success' : 'btn-outline'}`}
                      onClick={() => toggleActive(p.id, p.is_active)}
                    >
                      {p.is_active ? 'Oui' : 'Non'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Link href={`/admin/products/${p.id}`} className="btn btn-outline btn-sm">Modifier</Link>
                      <button onClick={() => deleteProduct(p.id)} className="btn btn-danger btn-sm">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
