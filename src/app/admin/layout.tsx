'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  Home,
  Package,
  ShoppingCart,
  Users,
  LogOut,
  ChevronLeft,
  Menu,
  Store,
  RotateCcw,
  BarChart3,
} from 'lucide-react';

// Menu regroupé (12 entrées → 6) : chaque entrée couvre plusieurs pages
// existantes, affichées en onglets en haut de la zone de contenu. Aucune
// page n'est déplacée ni supprimée : les anciennes adresses marchent toujours.
type BadgeKey = 'pending_orders' | 'pending_returns';
interface NavTab { href: string; label: string }
interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  match: string[];
  badgeKey?: BadgeKey;
  tabs?: NavTab[];
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { href: '/admin', label: "Aujourd'hui", icon: Home, exact: true, match: ['/admin'] },
      { href: '/admin/stats', label: 'Statistiques', icon: BarChart3, match: ['/admin/stats'] },
    ],
  },
  {
    title: 'Boutique',
    items: [
      {
        href: '/admin/orders', label: 'Commandes', icon: ShoppingCart, badgeKey: 'pending_orders',
        match: ['/admin/orders', '/admin/verification-retrait', '/admin/carts'],
        tabs: [
          { href: '/admin/orders', label: 'Commandes' },
          { href: '/admin/verification-retrait', label: 'Vérifier un retrait' },
          { href: '/admin/carts', label: 'Paniers abandonnés' },
        ],
      },
      {
        href: '/admin/products', label: 'Catalogue', icon: Package,
        match: ['/admin/products', '/admin/prix', '/admin/margins'],
        tabs: [
          { href: '/admin/products', label: 'Produits' },
          { href: '/admin/prix', label: 'Prix' },
          { href: '/admin/margins', label: 'Marges' },
        ],
      },
      {
        href: '/admin/clients', label: 'Clients', icon: Users,
        match: ['/admin/clients', '/admin/blocklist', '/admin/disputes'],
        tabs: [
          { href: '/admin/clients', label: 'Clients' },
          { href: '/admin/blocklist', label: 'Liste noire' },
          { href: '/admin/disputes', label: 'Litiges' },
        ],
      },
      { href: '/admin/returns', label: 'Retours et SAV', icon: RotateCcw, badgeKey: 'pending_returns', match: ['/admin/returns'] },
    ],
  },
];

const BADGE_COLORS: Record<BadgeKey, string> = { pending_orders: '#2563EB', pending_returns: '#C2263D' };

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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

  const activeItem = navGroups.flatMap((g) => g.items).find((i) => isItemActive(i, pathname));

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

        <nav className="sidebar-nav" aria-label="Menu du back-office">
          {navGroups.map((group) => (
            <div key={group.title} className="sidebar-group">
              {!collapsed && <p className="sidebar-group-title">{group.title}</p>}
              {group.items.map((item) => {
                const isActive = isItemActive(item, pathname);
                const badgeCount = item.badgeKey ? counts[item.badgeKey] : 0;
                const badgeColor = item.badgeKey ? BADGE_COLORS[item.badgeKey] : '#2563EB';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    style={{ position: 'relative' }}
                  >
                    <span style={{ position: 'relative', display: 'flex' }}>
                      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden />
                      {collapsed && badgeCount > 0 && (
                        <span className="sidebar-badge sidebar-badge-dot" style={{ background: badgeColor }}>
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span>{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="sidebar-badge" style={{ background: isActive ? 'rgba(255,255,255,.25)' : badgeColor }}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
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
            {activeItem?.label || 'Admin'}
          </div>
          <Link href="/" className="admin-back-site">
            <Store className="w-4 h-4" />
            <span>Voir le site</span>
          </Link>
        </header>
        <div className="admin-content">
          {activeItem?.tabs && (
            <nav className="admin-subtabs" aria-label={`Sections de ${activeItem.label}`}>
              {activeItem.tabs.map((tab) => {
                const current = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link key={tab.href} href={tab.href} className={`admin-subtab ${current ? 'active' : ''}`} aria-current={current ? 'page' : undefined}>
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
