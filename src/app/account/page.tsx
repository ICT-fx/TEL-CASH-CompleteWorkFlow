'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AccountPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [user, profile, loading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    if (res.ok) setMessage('✅ Profil mis à jour');
    else setMessage('❌ Erreur');
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) return <div className="page"><div className="container"><p>Chargement...</p></div></div>;

  return (
    <div className="page">
      <div className="container">
        <h1>Mon compte</h1>
        <div className="two-col">
          <div>
            <div className="card">
              <h2>Informations personnelles</h2>
              {message && <div className="alert alert-success">{message}</div>}
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={user?.email || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Nom complet</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Téléphone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </form>
            </div>
          </div>
          <div>
            <div className="card">
              <h2>Navigation rapide</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ padding: '8px 0' }}><Link href="/account/orders">📦 Historique commandes</Link></li>
                <li style={{ padding: '8px 0' }}><Link href="/account/loyalty">🎁 Fidélité &amp; Parrainage</Link></li>
                <li style={{ padding: '8px 0' }}><Link href="/cart">🛒 Mon panier</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
