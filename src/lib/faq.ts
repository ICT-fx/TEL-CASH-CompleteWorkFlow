// Questions fréquentes de l'accueil — SOURCE UNIQUE.
//
// Lue par :
//   - src/components/home/FAQ.tsx (accordéons visibles)
//   - src/app/page.tsx (JSON-LD FAQPage)
// Le texte du JSON-LD est donc identique au caractère près au texte affiché
// (exigence Google : pas de contenu FAQ caché ou différent).
//
// Textes validés (maquette Main.dc.html, 08/10/2026). Les valeurs qui ont déjà
// une source unique (adresse, frais et délai de livraison) viennent de
// src/lib/shipping.ts. Aucune mention « comme neuf » (décret 2022-190).

import { PICKUP_STORE_ADDRESS_LINE1, formatShippingFee } from '@/lib/shipping';
import { GRADE_BATTERY_MIN } from '@/lib/grades';

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ: FaqItem[] = [
  {
    question: 'Que couvre la garantie 24 mois\u00a0?',
    answer:
      "Pièces et main d'œuvre pendant 24 mois, en magasin ou par envoi. Elle s'ajoute à la garantie légale de conformité.",
  },
  {
    question: 'Comment marche le retrait au magasin\u00a0?',
    answer: `Choisissez « Retrait gratuit au magasin d'Angers » au panier. On vous prévient dès que c'est prêt, puis vous passez au ${PICKUP_STORE_ADDRESS_LINE1}, du lundi au samedi de 10h à 19h.`,
  },
  {
    question: 'Et si je me fais livrer\u00a0?',
    answer: `Livraison à domicile suivie pour ${formatShippingFee()}, sous 5 à 10 jours ouvrés.`,
  },
  {
    question: 'Puis-je payer en plusieurs fois\u00a0?',
    answer: 'Oui, en 3× ou 4× sans frais avec Klarna, au moment du paiement.',
  },
  {
    question: 'Et si le téléphone ne me convient pas\u00a0?',
    answer: 'Vous avez 30 jours pour retourner un achat fait en ligne.',
  },
  {
    question: 'La batterie est-elle neuve\u00a0?',
    answer:
      `Elle est testée : au moins ${GRADE_BATTERY_MIN.C} % de capacité garantie, ${GRADE_BATTERY_MIN.B} % en Très bon état et ${GRADE_BATTERY_MIN.A} % en Parfait état. En dessous, on la remplace.`,
  },
  {
    question: 'Quel état choisir\u00a0?',
    answer:
      "Les 3 états ont les mêmes tests et la même garantie 24 mois. Seul l'aspect change : Parfait état (aucune trace), Très bon état (micro-rayures), État correct (traces visibles).",
  },
];

// JSON-LD FAQPage construit depuis la même liste.
export function faqPageJsonLd(items: FaqItem[] = HOME_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}
