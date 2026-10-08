'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Package, User, Smartphone, CornerDownLeft } from 'lucide-react';

// Recherche rapide du back-office : Ctrl K (ou ⌘ K), ou le bouton « Rechercher ».
// Pages et actions filtrées localement, commandes / clients / produits via
// GET /api/admin/search. Clavier : ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.

interface Hit { type: 'page' | 'order' | 'client' | 'product'; title: string; sub: string; href: string }

const PAGES: Hit[] = [
  { type: 'page', title: "Aujourd'hui", sub: 'Ce qui t’attend', href: '/admin' },
  { type: 'page', title: 'Commandes à préparer', sub: 'Payées, pas encore expédiées', href: '/admin/orders?status=paid' },
  { type: 'page', title: 'Vérifier un code de retrait', sub: 'Client en boutique', href: '/admin/verification-retrait' },
  { type: 'page', title: 'Paniers abandonnés', sub: 'Relances automatiques', href: '/admin/carts' },
  { type: 'page', title: 'Toutes les commandes', sub: 'Commandes', href: '/admin/orders' },
  { type: 'page', title: 'Produits', sub: 'Catalogue · santé du flux', href: '/admin/products' },
  { type: 'page', title: 'Prix', sub: 'Catalogue', href: '/admin/prix' },
  { type: 'page', title: 'Marges', sub: 'Catalogue', href: '/admin/margins' },
  { type: 'page', title: 'Ajouter un produit', sub: 'Catalogue', href: '/admin/products/new' },
  { type: 'page', title: 'Clients', sub: 'Fiches clients', href: '/admin/clients' },
  { type: 'page', title: 'Retours et SAV', sub: 'Demandes de retour', href: '/admin/returns' },
  { type: 'page', title: 'Statistiques', sub: 'Trafic et ventes', href: '/admin/stats' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ICON = { page: ArrowRight, order: Package, client: User, product: Smartphone };
const GROUP = { page: 'Aller à', order: 'Commandes', client: 'Clients', product: 'Produits' };

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    setQ(''); setRemote([]); setSel(0);
    const t = setTimeout(() => input.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  // Recherche distante, 200 ms après la dernière frappe.
  useEffect(() => {
    if (!open || q.trim().length < 2) { setRemote([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d) => { setRemote(d.hits || []); setLoading(false); })
        .catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  const nq = norm(q.trim());
  const pages = nq ? PAGES.filter((p) => norm(`${p.title} ${p.sub}`).includes(nq)) : PAGES.slice(0, 6);
  const hits = [...remote, ...pages];

  useEffect(() => { setSel(0); }, [q, remote.length]);

  const go = useCallback((h: Hit) => { onClose(); router.push(h.href); }, [onClose, router]);

  if (!open) return null;

  let lastType = '';
  return (
    <div className="bo-k-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bo-k" role="dialog" aria-modal="true" aria-label="Recherche rapide">
        <div className="bo-k-in">
          <Search className="w-4 h-4" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="N° de commande, client, modèle, page…"
            aria-label="Rechercher"
            role="combobox"
            aria-expanded="true"
            aria-controls="bo-k-list"
            aria-activedescendant={hits[sel] ? `bo-k-${sel}` : undefined}
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              else if (e.key === 'Tab') { e.preventDefault(); } // le focus reste dans la recherche (↑ ↓ pour choisir)
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); go(hits[sel]); }
            }}
          />
          <kbd>Échap</kbd>
        </div>
        <ul className="bo-k-list" id="bo-k-list" role="listbox">
          {hits.map((h, i) => {
            const Icon = ICON[h.type];
            const head = h.type !== lastType ? GROUP[h.type] : null;
            lastType = h.type;
            return (
              <li key={`${h.type}-${h.href}`} role="presentation">
                {head && <p className="bo-k-group">{head}</p>}
                <button
                  type="button"
                  id={`bo-k-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  className="bo-k-item"
                  onMouseMove={() => setSel(i)}
                  onClick={() => go(h)}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  <span><b>{h.title}</b><small>{h.sub}</small></span>
                  {i === sel && <CornerDownLeft className="w-3.5 h-3.5 bo-k-enter" aria-hidden />}
                </button>
              </li>
            );
          })}
          {hits.length === 0 && (
            <li className="bo-k-empty" role="presentation">{loading ? 'Recherche…' : 'Aucun résultat'}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
