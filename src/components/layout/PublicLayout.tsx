'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FeaturesBar } from '@/components/home/FeaturesBar';
import { MiniCart } from '@/components/cart/MiniCart';
import { RevealManager } from '@/components/ui/Reveal';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <RevealManager />
      <FeaturesBar />
      <Footer />
      <MiniCart />
    </div>
  );
}
