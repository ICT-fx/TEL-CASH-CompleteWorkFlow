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
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Catalogue', icon: Package },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
  { href: '/admin/clients', label: 'Clients', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return; // still loading auth state
    if (!user || !profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }
    setAuthorized(true);
  }, [user, profile, loading, router]);

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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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
