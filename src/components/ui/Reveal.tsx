'use client';

// Effet d'apparition au scroll — signature visuelle du site.
//
// Pattern "safe" : l'état NET est la valeur PAR DÉFAUT (cf. globals.css). Le
// flou initial n'est appliqué que lorsque ce manager a confirmé son init en
// posant `reveal-ready` sur <html>, et uniquement sur les cibles pas encore
// révélées. Si le JS plante, rien n'est masqué — jamais de page floue.
//
// Un SEUL IntersectionObserver partagé, déclenché une seule fois (unobserve
// après reveal). Tout ce qui est DÉJÀ visible (ou déjà passé au-dessus) est
// révélé SYNCHRONEMENT (pas de flash sur le haut de page).

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Sélecteur unique des cibles reveal (réutilisé par le filet de sécurité).
const REVEAL_SELECTOR =
  'main section:not([data-no-reveal]), [data-reveal], [data-reveal-stagger] > *';

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
      // threshold 0 (le moindre pixel visible déclenche) : une section plus
      // haute que l'écran n'atteint jamais 15 % d'aire visible et resterait
      // floue. rootMargin bas négatif → déclenche quand elle entre d'environ 10 %.
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
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
  // Tout ce dont le HAUT est déjà au-dessus du bord bas du viewport est soit
  // visible (haut de page), soit déjà passé au-dessus (contenu async monté
  // après scroll) : on le révèle SYNCHRONEMENT → aucun flash, et l'IO ne le
  // redéclencherait de toute façon jamais pour ce qui est hors écran en haut.
  // On n'observe donc que ce qui est ENTIÈREMENT sous le viewport.
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (el.getBoundingClientRect().top < vh) {
    el.classList.add('is-visible');
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
// changement de route ET à chaque mutation du DOM : indispensable pour les
// pages client (ex. /products/[id]) dont les sections — description, avis,
// produits liés — n'arrivent dans le DOM qu'APRÈS leurs fetchs async. Sans ça,
// ces sections n'étaient jamais observées et restaient figées floues/blanches.
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

    // 1) On scanne (révèle le visible, observe le reste) PUIS on confirme l'init
    //    en posant `reveal-ready` : le flou n'apparaît donc que sur les cibles
    //    encore sous le viewport. Le haut de page, déjà `is-visible`, reste net.
    const raf = requestAnimationFrame(() => {
      scan();
      document.documentElement.classList.add('reveal-ready');
    });

    // 2) Filet de sécurité : ~1,5 s après le chargement, on force `is-visible`
    //    UNIQUEMENT sur les éléments encore floutés DANS le viewport — c'est le
    //    seul vrai mode de panne (élément visible mais jamais révélé). Tout ce
    //    qui est sous le fold reste géré par l'IntersectionObserver, sinon
    //    l'animation signature ne jouerait plus après les 1,5 premières
    //    secondes. Le filet se réarme à chaque scroll (throttlé) pour couvrir
    //    aussi un IO défaillant en cours de navigation.
    const forceVisibleInViewport = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        if (el.classList.contains('is-visible')) return;
        const rect = el.getBoundingClientRect();
        const inViewport = rect.top < vh && rect.bottom > 0;
        if (inViewport) el.classList.add('is-visible');
      });
    };
    const armSafety = () => window.setTimeout(forceVisibleInViewport, 1500);
    let safety = 0;
    if (document.readyState === 'complete') {
      safety = armSafety();
    } else {
      window.addEventListener('load', () => { safety = armSafety(); }, { once: true });
    }

    // Anti-blocage au scroll : si un élément visible reste flou > ~1 s après
    // un scroll (IO cassé), on le révèle. Throttle large pour rester gratuit.
    let scrollSafety = 0;
    const onScroll = () => {
      if (scrollSafety) return;
      scrollSafety = window.setTimeout(() => {
        scrollSafety = 0;
        forceVisibleInViewport();
      }, 1000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Re-scan debouncé à chaque arrivée de contenu async (fetch terminé, etc.).
    // On observe uniquement `childList`/`subtree` (ajout-retrait de nœuds) : les
    // toggles de classe ou animations CSS ne déclenchent donc rien. L'observer
    // reste actif toute la durée de la route — certaines sections (produits
    // liés, accessoires) ne montent qu'après plusieurs secondes de fetch, et un
    // arrêt anticipé les laissait floues. Il est déconnecté au cleanup ci-dessous
    // (changement de route).
    let pending = 0;
    const queueScan = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        scan();
      });
    };
    const mo = new MutationObserver(queueScan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      if (pending) cancelAnimationFrame(pending);
      if (safety) window.clearTimeout(safety);
      if (scrollSafety) window.clearTimeout(scrollSafety);
      window.removeEventListener('scroll', onScroll);
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
