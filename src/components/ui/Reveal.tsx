'use client';

// Effet d'apparition au scroll — signature visuelle du site.
// Un SEUL IntersectionObserver partagé, déclenché une seule fois (unobserve
// après reveal). L'état initial/visible est porté par le CSS (.reveal-js, cf.
// globals.css), ce qui évite tout flash (la classe reveal-js est posée par un
// script inline avant le paint) et toute erreur d'hydratation.

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// ── Observer partagé ───────────────────────────────────────────────────────
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            sharedObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
  }
  return sharedObserver;
}

export function observeReveal(el: Element | null) {
  if (!el || el.classList.contains('is-visible')) return;
  const o = getObserver();
  if (!o) {
    el.classList.add('is-visible'); // pas d'IO → on affiche directement
    return;
  }
  o.observe(el);
}

// ── Composant wrapper opt-in (stagger via `index`) ─────────────────────────
interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  /** Décalage de stagger : index de l'item dans son groupe. */
  index?: number;
  /** Pas du stagger en ms (défaut 70). */
  step?: number;
  className?: string;
}

export function Reveal({ children, as, index = 0, step = 70, className }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    observeReveal(ref.current);
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-reveal=""
      className={className}
      style={{ '--reveal-delay': `${index * step}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

// ── Manager global : applique l'effet à TOUTES les sections du site ─────────
// Observe `main section` + tout `[data-reveal]` + les enfants des groupes
// `[data-reveal-stagger]` (avec délai progressif). Re-scanne à chaque
// changement de route et après un court délai (contenus chargés en async).
export function RevealManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const scan = () => {
      const main = document.querySelector('main');
      if (!main) return;

      // Groupes à stagger : on numérote les enfants (delay progressif).
      main.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          (child as HTMLElement).style.setProperty('--reveal-delay', `${i * 70}ms`);
          observeReveal(child);
        });
      });

      // Sections + éléments explicitement marqués.
      main
        .querySelectorAll<HTMLElement>('section:not([data-no-reveal]), [data-reveal]')
        .forEach((el) => observeReveal(el));
    };

    const raf = requestAnimationFrame(scan);
    const t = window.setTimeout(scan, 450); // 2e passe pour le contenu async
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
