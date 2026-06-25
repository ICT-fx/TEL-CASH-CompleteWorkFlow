import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';

// Shell serveur : porte les metadata du listing (impossible sur une page
// 'use client'). Le catalogue interactif (filtres, tri, URL sync) reste
// entièrement client dans CatalogClient.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const metadata: Metadata = {
  title: 'Smartphones reconditionnés — iPhone, Samsung | TEL & CASH',
  description:
    'Tous nos smartphones reconditionnés, testés et certifiés en France : iPhone, Samsung, Xiaomi. Garantie 24 mois, retour 30 jours, livraison suivie.',
  alternates: { canonical: `${BASE_URL}/products` },
  openGraph: {
    title: 'Smartphones reconditionnés — TEL & CASH',
    description:
      'iPhone, Samsung et Xiaomi reconditionnés, garantis 24 mois. Filtrez par modèle, état, stockage et budget.',
    url: `${BASE_URL}/products`,
    siteName: 'TEL & CASH',
    locale: 'fr_FR',
    type: 'website',
  },
};

export default function CatalogPage() {
  return <CatalogClient />;
}
