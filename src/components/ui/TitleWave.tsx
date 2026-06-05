// Titre marque/modèle (ou titre de section) + vague animée alignée pile sur la
// largeur du texte. Réutilisé sur la fiche produit (A1) et sur la page « Nos
// engagements » (C4). Le titre reste TOUJOURS sur une seule ligne : si le
// modèle est long, c'est la police qui rétrécit via clamp(), jamais un retour
// à la ligne.

'use client';

import styles from './TitleWave.module.css';

interface TitleWaveProps {
  title: string;
  /** Petit label uppercase au-dessus du titre (ex. « APPLE »). */
  eyebrow?: string;
  as?: 'h1' | 'h2' | 'h3';
  /** Override CSS de la taille du titre (ex. 'clamp(1.1rem, 4.5vw, 2rem)'). */
  titleSize?: string;
  /** Couleur de la vague (ADN bleu par défaut). */
  waveColor?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function TitleWave({
  title,
  eyebrow,
  as = 'h1',
  titleSize,
  waveColor = '#2F6BFF',
  align = 'left',
  className = '',
}: TitleWaveProps) {
  const Tag = as;
  return (
    <div className={className} style={{ textAlign: align }}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <span className={styles.wrap}>
        <Tag className={styles.title} style={titleSize ? { fontSize: titleSize } : undefined}>
          {title}
        </Tag>
        <svg className={styles.wave} viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 6 Q 25 0, 50 6 T 100 6 T 150 6 T 200 6 T 250 6 T 300 6"
            fill="none"
            stroke={waveColor}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            pathLength={100}
          />
        </svg>
      </span>
    </div>
  );
}
