import type { Metadata } from 'next';

// Pages privées / sans valeur de recherche : exclues de l'index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
