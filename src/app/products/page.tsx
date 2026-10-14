import type { Metadata } from 'next';
import CatalogClient from './CatalogClient';
import Link from 'next/link';
import { pageSocial } from '@/lib/seoOg';
import { getCatalogModelLinks } from '@/lib/catalogModelLinks';

// Shell serveur : porte les metadata du listing (impossible sur une page
// 'use client'). Le catalogue interactif (filtres, tri, URL sync) reste
// entièrement client dans CatalogClient.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const metadata: Metadata = {
  title: 'Smartphones reconditionnés — iPhone, Samsung | TEL & CASH Angers',
  description:
    'Tous nos smartphones reconditionnés, testés et certifiés en France : iPhone, Samsung, Xiaomi. Garantie 24 mois, retour 14 jours, livraison suivie.',
  alternates: { canonical: `${BASE_URL}/products` },
  ...pageSocial(
    '/products',
    'Smartphones reconditionnés — TEL & CASH Angers',
    'iPhone, Samsung et Xiaomi reconditionnés, garantis 24 mois. Filtrez par modèle, état, stockage et budget.',
  ),
};

export const revalidate = 3600;

export default async function CatalogPage() {
  const models = await getCatalogModelLinks();
  return (
    <>
      <CatalogClient />
      {models.length > 0 && (
        <nav aria-label="Tous nos modèles" className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-lg font-semibold mb-4">Tous nos modèles</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            {models.map((m) => (
              <li key={m.href}>
                <Link href={m.href} prefetch={false} className="hover:underline">
                  {m.label} reconditionné
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
