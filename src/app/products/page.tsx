import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';
import { pageSocial } from '@/lib/seoOg';

// Shell serveur : porte les metadata du listing (impossible sur une page
// 'use client'). Le catalogue interactif (filtres, tri, URL sync) reste
// entièrement client dans CatalogClient.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const metadata: Metadata = {
  title: 'Smartphones reconditionnés — iPhone, Samsung | TEL & CASH Angers',
  description:
    'Tous nos smartphones reconditionnés, testés et certifiés en France : iPhone, Samsung, Xiaomi. Garantie 24 mois, retour 30 jours, livraison suivie.',
  alternates: { canonical: `${BASE_URL}/products` },
  ...pageSocial(
    '/products',
    'Smartphones reconditionnés — TEL & CASH Angers',
    'iPhone, Samsung et Xiaomi reconditionnés, garantis 24 mois. Filtrez par modèle, état, stockage et budget.',
  ),
};

export default function CatalogPage() {
  return <CatalogClient />;
}
