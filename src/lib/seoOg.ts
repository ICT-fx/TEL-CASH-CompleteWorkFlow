import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

// Image de partage par défaut : photo réelle de la boutique (public/boutique.jpg, 1024×768).
// Next ne fusionne pas openGraph entre layout et page : chaque page qui définit
// son openGraph doit donc répéter l'image.
const DEFAULT_OG_IMAGE = {
  url: '/boutique.jpg',
  width: 1024,
  height: 768,
  alt: 'La boutique TEL & CASH, 10 rue Saint-Étienne à Angers',
};

/** openGraph + twitter cohérents (og:url, og:title, description, image boutique) pour une page statique. */
export function pageSocial(path: string, title: string, description: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      title,
      description,
      url: `${BASE_URL}${path}`,
      siteName: 'TEL & CASH',
      locale: 'fr_FR',
      type: 'website',
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE.url] },
  };
}

export const DEFAULT_OG_IMAGES = [DEFAULT_OG_IMAGE];
