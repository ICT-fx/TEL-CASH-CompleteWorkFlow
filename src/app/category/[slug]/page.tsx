'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function CategoryPage() {
  const params = useParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryName = params.slug === 'telephones' ? 'Téléphones' : 'Accessoires';

  useEffect(() => {
    fetch(`/api/products?category=${params.slug}&limit=50`)
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false); });
  }, [params.slug]);

  return (
    <div className="page">
      <div className="container">
        <h1>{categoryName}</h1>
        <Link href="/products">← Tout le catalogue</Link>

        {loading ? <p style={{ marginTop: 20 }}>Chargement...</p> : (
          <div className="product-grid" style={{ marginTop: 20 }}>
            {products.length === 0 && <p className="text-muted">Aucun produit dans cette catégorie.</p>}
            {products.map((p: any) => (
              <Link href={`/products/${p.id}`} key={p.id} className="product-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <img src={p.images?.[0] || 'https://placehold.co/600x400/eee/999?text=Photo'} alt={p.model} />
                <div className="info">
                  <div className="brand">{p.brand}</div>
                  <div className="name">{p.model}{p.storage_capacity ? ` — ${p.storage_capacity}` : ''}</div>
                  <div>
                    <span className="price">{parseFloat(p.price).toFixed(2)} €</span>
                    {p.compare_at_price && <span className="old-price">{parseFloat(p.compare_at_price).toFixed(2)} €</span>}
                  </div>
                  {p.grade && <span className={`grade grade-${p.grade === 'Parfait État' ? 'A' : p.grade === 'Très Bon État' ? 'B' : 'C'}`}>{p.grade}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
