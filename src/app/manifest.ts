import type { MetadataRoute } from 'next';

// Manifest PWA : permet l'« ajout à l'écran d'accueil » mobile avec l'icône
// TEL & CASH (les arrière-plans transparents servent d'icônes « any », la
// version 512 sert aussi de maskable sur Android).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TEL & CASH — Smartphones reconditionnés',
    short_name: 'TEL & CASH',
    description: 'Smartphones reconditionnés premium, testés et certifiés en France.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a8a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
