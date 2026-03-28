'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export function Navigation() {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <nav>
      <div className="container">
        <Link href="/" className="logo">📱 TEL &amp; CASH</Link>
        <div className="nav-links">
          <Link href="/products">Catalogue</Link>
          <Link href="/category/telephones">Téléphones</Link>
          <Link href="/category/accessoires">Accessoires</Link>
          <Link href="/cart">🛒 Panier</Link>
          {loading ? null : user ? (
            <>
              <Link href="/account">Mon compte</Link>
              {profile?.role === 'admin' && (
                <Link href="/admin" style={{ fontWeight: 700 }}>⚙️ Admin</Link>
              )}
              <button onClick={signOut} className="btn btn-outline btn-sm">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-outline btn-sm">Connexion</Link>
              <Link href="/auth/register" className="btn btn-primary btn-sm">Inscription</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
