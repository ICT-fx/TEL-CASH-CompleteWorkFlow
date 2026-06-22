// Forme applicative des caractéristiques techniques stockées sur products.specs
// (jsonb). Miroir de IphoneSpec (cf. iphoneSpecs.ts) — la « Garantie » n'en fait
// PAS partie : elle est lue depuis products.warranty au moment de l'affichage.
// Pur — pas de React, pas de DB.

import { getIphoneSpecs } from './iphoneSpecs';

export interface ProductSpecs {
  ecran: string;
  resistance: string;
  poids: string;
  puce: string;
  reseau: '4G' | '5G' | '';
  connectique: string;
  photo: string;
  selfie: string;
  video: string;
  autonomie: string;
  annee: number | null;
}

export const EMPTY_SPECS: ProductSpecs = {
  ecran: '', resistance: '', poids: '',
  puce: '', reseau: '', connectique: '',
  photo: '', selfie: '', video: '',
  autonomie: '', annee: null,
};

export type SpecFieldType = 'text' | 'number' | 'reseau';

export interface SpecField {
  key: keyof ProductSpecs;
  label: string;
  type: SpecFieldType;
}

export interface SpecTheme {
  title: string;
  fields: SpecField[];
}

// Mêmes 4 thèmes que la fiche produit (sans la ligne « Garantie », gérée à part).
export const SPEC_THEMES: SpecTheme[] = [
  {
    title: 'Écran & design',
    fields: [
      { key: 'ecran', label: 'Écran', type: 'text' },
      { key: 'resistance', label: 'Résistance eau', type: 'text' },
      { key: 'poids', label: 'Poids', type: 'text' },
    ],
  },
  {
    title: 'Performances & réseau',
    fields: [
      { key: 'puce', label: 'Puce', type: 'text' },
      { key: 'reseau', label: 'Réseau', type: 'reseau' },
      { key: 'connectique', label: 'Connectique', type: 'text' },
    ],
  },
  {
    title: 'Photo & vidéo',
    fields: [
      { key: 'photo', label: 'Appareil photo', type: 'text' },
      { key: 'selfie', label: 'Caméra avant', type: 'text' },
      { key: 'video', label: 'Vidéo', type: 'text' },
    ],
  },
  {
    title: 'Autonomie & infos',
    fields: [
      { key: 'autonomie', label: 'Autonomie', type: 'text' },
      { key: 'annee', label: 'Année de sortie', type: 'number' },
    ],
  },
];

// Convertit l'entrée dictionnaire iPhone (si connue) vers ProductSpecs.
export function specsFromIphone(model: string | null | undefined): ProductSpecs | null {
  const s = getIphoneSpecs(model);
  if (!s) return null;
  return {
    ecran: s.ecran,
    resistance: s.resistance,
    poids: s.poids,
    puce: s.puce,
    reseau: s.reseau,
    connectique: s.connectique,
    photo: s.photo,
    selfie: s.selfie,
    video: s.video,
    autonomie: s.autonomie,
    annee: s.annee,
  };
}

// true si aucun champ utile n'est renseigné (sert à écrire NULL plutôt qu'un
// objet vide, et à préférer le dictionnaire à l'affichage).
export function isSpecsEmpty(s: ProductSpecs | null | undefined): boolean {
  if (!s) return true;
  const text = [
    s.ecran, s.resistance, s.poids, s.puce, s.reseau,
    s.connectique, s.photo, s.selfie, s.video, s.autonomie,
  ];
  return text.every((v) => !v || !v.trim()) && s.annee == null;
}
