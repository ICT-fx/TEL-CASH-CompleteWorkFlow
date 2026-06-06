'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  LogOut,
  ChevronLeft,
  Menu,
  Store,
  RotateCcw,
  ShieldAlert,
  Gavel,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null },
  { href: '/admin/products', label: 'Catalogue', icon: Package, badgeKey: null },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart, badgeKey: 'pending_orders' as const },
  { href: '/admin/returns', label: 'Retours', icon: RotateCcw, badgeKey: 'pending_returns' as const },
  { href: '/admin/clients', label: 'Clients', icon: Users, badgeKey: null },
  { href: '/admin/blocklist', label: 'Blocklist', icon: ShieldAlert, badgeKey: null },
  { href: '/admin/disputes', label: 'Litiges', icon: Gavel, badgeKey: null },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [counts, setCounts] = useState<{ pending_orders: number; pending_returns: number }>({
    pending_orders: 0,
    pending_returns: 0,
  });

  useEffect(() => {
    if (loading) return; // still loading auth state
    if (!user || !profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }
    setAuthorized(true);
  }, [user, profile, loading, router]);

  // Refresh sidebar notification counts every 30s while admin is open.
  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/admin/notifications');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCounts({ pending_orders: data.pending_orders || 0, pending_returns: data.pending_returns || 0 });
      } catch {}
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authorized, pathname]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="admin-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <Link href="/admin" className="sidebar-logo">
              <Store className="w-5 h-5" />
              <span>TEL & CASH</span>
            </Link>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                style={{ position: 'relative' }}
              >
                <span style={{ position: 'relative', display: 'flex' }}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {collapsed && badgeCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -8,
                      minWidth: 16, height: 16, padding: '0 4px',
                      background: '#dc2626', color: 'white',
                      borderRadius: 999, fontSize: '0.62rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span>{item.label}</span>
                    {badgeCount > 0 && (
                      <span style={{
                        marginLeft: 'auto', minWidth: 18, height: 18,
                        padding: '0 6px', background: '#dc2626', color: 'white',
                        borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-link" title={collapsed ? 'Déconnexion' : undefined}>
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
          {!collapsed && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {profile?.full_name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{profile?.full_name || 'Admin'}</div>
                <div className="sidebar-user-role">Administrateur</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={`admin-main ${collapsed ? 'expanded' : ''}`}>
        <header className="admin-topbar">
          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="admin-breadcrumb">
            {navItems.find(i => i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href))?.label || 'Admin'}
          </div>
          <Link href="/" className="admin-back-site">
            <Store className="w-4 h-4" />
            <span>Voir le site</span>
          </Link>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
