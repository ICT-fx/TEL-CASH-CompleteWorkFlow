// C2 — Composant réutilisable d'animation « engagement » : carte blanche
// flottante + symbole SVG qui se dessine au tracé + halo bleu pulsé + boucle 5s
// avec reset propre. Conversion fidèle (timing/couleurs) du modèle validé
// (type « garantie »). Un symbole par thème via la prop `type`.

import styles from './EngagementAnimation.module.css';

export type EngagementType =
  | 'garantie'
  | 'retour'
  | 'recyclage'
  | 'sav'
  | 'certification'
  | 'livraison'
  | 'paiement';

interface Props {
  type: EngagementType;
  title: string;
}

export function EngagementAnimation({ type, title }: Props) {
  return (
    <div className={styles.visual} role="img" aria-label={`Illustration animée : ${title}`}>
      <div className={styles.glow} />
      <div className={styles.stage}>
        <div className={styles.card}>{renderSymbol(type)}</div>
        {type === 'garantie' && (
          <svg className={styles.loupe} viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="24" cy="24" r="15" fill="rgba(47,107,255,.10)" stroke="#2F6BFF" strokeWidth="4" />
            <circle cx="19" cy="19" r="5" fill="none" stroke="#9FB8FF" strokeWidth="2" />
            <line x1="35" y1="35" x2="50" y2="50" stroke="#2F6BFF" strokeWidth="6" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

function renderSymbol(type: EngagementType) {
  switch (type) {
    case 'garantie':
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.fill} d="M48 10 L82 24 L82 50 C82 72 67 86 48 92 C29 86 14 72 14 50 L14 24 Z" fill="#DCE6FF" />
          <path className={styles.stroke} pathLength={100} d="M48 10 L82 24 L82 50 C82 72 67 86 48 92 C29 86 14 72 14 50 L14 24 Z" />
          <path className={styles.accent} pathLength={100} d="M34 50 L44 60 L64 38" />
        </svg>
      );

    case 'retour':
      // Flèche circulaire qui se trace + petit colis qui repart vers la droite.
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.stroke} pathLength={100} d="M74 40 A28 28 0 1 1 64 24" />
          <path className={styles.accent} pathLength={100} d="M64 24 L76 26 M64 24 L66 12" />
          <g className={styles.move}>
            <rect className={styles.fill} x="38" y="40" width="22" height="18" rx="3" fill="#DCE6FF" />
            <path className={styles.stroke} pathLength={100} d="M38 40 H60 V58 H38 Z M38 49 H60" />
          </g>
        </svg>
      );

    case 'recyclage':
      // Boucle de renouvellement (cycle) + feuille qui apparaît (seconde vie).
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.stroke} pathLength={100} d="M70 34 A26 26 0 1 0 76 52" />
          <path className={styles.accent} pathLength={100} d="M76 52 L72 40 M76 52 L86 46" />
          <path className={styles.fill} d="M48 40 C36 40 32 52 34 62 C44 64 56 60 56 48 C56 43 53 40 48 40 Z" fill="#DCE6FF" />
          <path className={styles.accent} pathLength={100} d="M40 60 C44 54 50 50 54 48" />
        </svg>
      );

    case 'sav':
      // Devanture de boutique qui se dessine + petit cœur (esprit humain).
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.fill} d="M14 42 L82 42 L77 28 L19 28 Z" fill="#DCE6FF" />
          <path className={styles.stroke} pathLength={100} d="M18 42 L18 82 L78 82 L78 42 M40 82 L40 60 L56 60 L56 82 M19 28 L77 28 L82 42 L14 42 Z" />
          <path className={styles.accentFill} d="M48 12 c-2.4-4.6-9-3.8-9 1.6 c0 3.8 5.2 6.8 9 9.4 c3.8-2.6 9-5.6 9-9.4 c0-5.4-6.6-6.2-9-1.6 Z" fill="#1E40AF" />
        </svg>
      );

    case 'certification':
      // Presse-papiers + 3 coches qui apparaissent l'une après l'autre.
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.stroke} pathLength={100} d="M28 22 H68 V84 H28 Z M40 16 H56 V26 H40 Z" />
          <path className={styles.chk1} pathLength={100} d="M36 40 l5 5 l11 -13" />
          <path className={styles.chk2} pathLength={100} d="M36 56 l5 5 l11 -13" />
          <path className={styles.chk3} pathLength={100} d="M36 72 l5 5 l11 -13" />
        </svg>
      );

    case 'livraison':
      // Colis / camionnette qui file + lignes de vitesse.
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.speed} d="M6 40 H26" />
          <path className={styles.speed} d="M2 52 H22" />
          <path className={styles.speed} d="M8 64 H24" />
          <g className={styles.move}>
            <rect className={styles.fill} x="30" y="38" width="30" height="26" rx="3" fill="#DCE6FF" />
            <path className={styles.stroke} pathLength={100} d="M30 38 H60 V64 H30 Z M60 46 H72 L82 56 V64 H60 Z" />
            <circle cx="42" cy="68" r="6" fill="none" stroke="#1E40AF" strokeWidth="4" />
            <circle cx="72" cy="68" r="6" fill="none" stroke="#1E40AF" strokeWidth="4" />
          </g>
        </svg>
      );

    case 'paiement':
      // Cadenas : l'anse se trace (descend) puis le corps + serrure.
      return (
        <svg className={styles.sym} viewBox="0 0 96 96" aria-hidden="true">
          <path className={styles.stroke} pathLength={100} d="M34 46 V34 a14 14 0 0 1 28 0 V46" />
          <rect className={styles.fill} x="26" y="46" width="44" height="36" rx="6" fill="#DCE6FF" />
          <rect className={styles.stroke} pathLength={100} x="26" y="46" width="44" height="36" rx="6" />
          <path className={styles.accent} pathLength={100} d="M48 60 V70" />
          <circle className={styles.accentFill} cx="48" cy="60" r="4" fill="#1E40AF" />
        </svg>
      );

    default:
      return null;
  }
}
