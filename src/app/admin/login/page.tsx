'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function AdminLoginPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && profile?.role === 'admin') {
        router.push('/admin');
      } else if (user && profile?.role !== 'admin') {
        router.push('/account');
      }
    }
  }, [user, profile, loading]);

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
        <h1>Administration</h1>
        <div className="card" style={{ padding: 40 }}>
          <p className="text-muted mb-2">
            Connectez-vous avec un compte admin pour accéder au back-office.
          </p>
          <a href="/auth/login" className="btn btn-primary">Se connecter</a>
        </div>
      </div>
    </div>
  );
}
