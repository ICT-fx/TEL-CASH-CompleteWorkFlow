'use client';

import { motion } from 'framer-motion';
import { Truck, Package, Store, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export function Delivery() {
  const options = [
    {
      title: "Chronopost 24h",
      description: "Expédié depuis notre boutique. Livraison le lendemain avant 13h.",
      price: "12,90 €",
      icon: <Truck className="w-8 h-8 text-blue-500" />
    },
    {
      title: "Colissimo 48h",
      description: "Livraison standard avec suivi à domicile. Gratuit à partir de 200€.",
      price: "Offert",
      icon: <Package className="w-8 h-8 text-green-500" />
    },
    {
      title: "Click & Collect",
      description: "Retrait en boutique (Paris 11e) en 2h. Gratuit et immédiat.",
      price: "Gratuit",
      icon: <Store className="w-8 h-8 text-primary" />
    },
    {
      title: "FedEx International",
      description: "Expédié depuis fournisseur pour certains modèles. Livraison 3-5 jours.",
      price: "19,90 €",
      icon: <Globe className="w-8 h-8 text-purple-500" />
    }
  ];

  return (
    <section className="py-24 bg-muted/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Modes de livraison</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Rapide, sécurisé et assuré à 100%. Choisissez l'option qui vous convient le mieux lors du paiement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {options.map((option, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="h-full bg-white hover:-translate-y-2 transition-transform duration-300">
                <CardContent className="p-8 flex flex-col h-full">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
                    {option.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{option.title}</h3>
                  <p className="text-muted-foreground flex-grow mb-6">{option.description}</p>
                  <div className="text-lg font-black text-foreground">
                    {option.price}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
