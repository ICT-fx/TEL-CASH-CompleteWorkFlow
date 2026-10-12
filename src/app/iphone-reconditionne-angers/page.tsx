import type { Metadata } from 'next';
import Link from 'next/link';
import { pageSocial } from '@/lib/seoOg';
import { CLIENT_GRADES } from '@/lib/grades';
import {
  PICKUP_STORE_ADDRESS_LINE1,
  PICKUP_STORE_ADDRESS_LINE2,
  PICKUP_STORE_PHONE,
  PICKUP_STORE_HOURS,
} from '@/lib/shipping';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';
const PATH = '/iphone-reconditionne-angers';
const TITLE = 'iPhone reconditionné à Angers — boutique TEL & CASH';
const DESCRIPTION =
  'Acheter un iPhone reconditionné à Angers : boutique au 10 rue Saint-Étienne, retrait gratuit, grades A/B/C, garantie 24 mois. Ou commandez en ligne.';
const UPDATED = '12 octobre 2026';

export const metadata: Metadata = {
  alternates: { canonical: PATH },
  title: TITLE,
  description: DESCRIPTION,
  ...pageSocial(PATH, TITLE, DESCRIPTION),
};

const FAQ = [
  {
    q: 'Où acheter un iPhone reconditionné à Angers ?',
    a: `Chez TEL & CASH, ${PICKUP_STORE_ADDRESS_LINE1}, ${PICKUP_STORE_ADDRESS_LINE2}. La boutique est ouverte ${PICKUP_STORE_HOURS.replace('Lundi-Samedi', 'du lundi au samedi')}. Vous pouvez aussi commander sur telandcash.fr et choisir le retrait gratuit en boutique.`,
  },
  {
    q: 'Le retrait en boutique est-il gratuit ?',
    a: 'Oui. Vous commandez en ligne, puis vous retirez votre appareil gratuitement au 10 rue Saint-Étienne à Angers. La livraison à domicile avec suivi reste possible.',
  },
  {
    q: 'Quelle garantie sur un iPhone reconditionné ?',
    a: 'Tous nos appareils, grades A, B et C, sont garantis 24 mois.',
  },
  {
    q: 'Quelle est la différence entre les grades A, B et C ?',
    a: `Le grade ${CLIENT_GRADES[0].letter} (${CLIENT_GRADES[0].label.toLowerCase()}) n'a aucune marque d'usure visible, le grade ${CLIENT_GRADES[1].letter} (${CLIENT_GRADES[1].label.toLowerCase()}) a de très légères micro-rayures, le grade ${CLIENT_GRADES[2].letter} (${CLIENT_GRADES[2].label.toLowerCase()}) a des traces d'usage visibles. Le fonctionnement est identique, la batterie minimale garantie change selon le grade.`,
  },
  {
    q: 'Puis-je retourner mon achat ?',
    a: 'Les achats effectués sur le site peuvent être retournés sous 30 jours. Ce délai ne s’applique pas aux achats réalisés en boutique.',
  },
  {
    q: 'Proposez-vous aussi le rachat et la réparation ?',
    a: 'Oui, la boutique rachète et répare des smartphones. Contactez-nous au ' + PICKUP_STORE_PHONE + ' pour en parler.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${BASE_URL}${PATH}#webpage`,
      url: `${BASE_URL}${PATH}`,
      name: TITLE,
      description: DESCRIPTION,
      dateModified: '2026-10-12',
      inLanguage: 'fr-FR',
      about: { '@id': `${BASE_URL}/#store` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'iPhone reconditionné à Angers', item: `${BASE_URL}${PATH}` },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

const link = 'text-[#3b82f6] font-semibold underline underline-offset-2';

export default function IphoneReconditionneAngersPage() {
  return (
    <main className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="container mx-auto px-4 max-w-3xl py-16 md:py-24 text-slate-600 leading-relaxed">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] mb-6 leading-[1.1]">
          iPhone reconditionné à Angers
        </h1>

        <p className="text-lg font-medium text-slate-700 mb-10">
          TEL &amp; CASH vend des iPhone reconditionnés au {PICKUP_STORE_ADDRESS_LINE1}, {PICKUP_STORE_ADDRESS_LINE2},
          avec une garantie de 24 mois sur tous les grades. Vous pouvez venir les voir en boutique ou les commander
          en ligne et les retirer gratuitement à Angers.
        </p>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-3">La boutique</h2>
        <ul className="list-disc pl-6 mb-10 space-y-1">
          <li>Adresse : {PICKUP_STORE_ADDRESS_LINE1}, {PICKUP_STORE_ADDRESS_LINE2}</li>
          <li>Téléphone : <a className={link} href={`tel:${PICKUP_STORE_PHONE.replace(/\s+/g, '')}`}>{PICKUP_STORE_PHONE}</a></li>
          <li>Horaires : {PICKUP_STORE_HOURS}</li>
          <li>Retrait gratuit des commandes passées sur le site</li>
          <li>Rachat et réparation de smartphones</li>
        </ul>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-3">Boutique ou achat 100 % en ligne</h2>
        <div className="overflow-x-auto mb-10">
          <table className="w-full text-left text-sm border border-slate-200">
            <thead className="bg-slate-50 text-[#0A0F1E]">
              <tr>
                <th className="p-3">&nbsp;</th>
                <th className="p-3">En boutique</th>
                <th className="p-3">En ligne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><th className="p-3 font-semibold">Récupération</th><td className="p-3">Sur place, à Angers</td><td className="p-3">Retrait gratuit en boutique ou livraison à domicile avec suivi</td></tr>
              <tr><th className="p-3 font-semibold">Garantie</th><td className="p-3">24 mois</td><td className="p-3">24 mois</td></tr>
              <tr><th className="p-3 font-semibold">Retour</th><td className="p-3">Pas de retour de 30 jours</td><td className="p-3">Retour sous 30 jours</td></tr>
              <tr><th className="p-3 font-semibold">Voir l’appareil avant</th><td className="p-3">Oui</td><td className="p-3">Non (photos de la fiche)</td></tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-3">Les grades et la batterie minimum</h2>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          {CLIENT_GRADES.map((g) => (
            <li key={g.letter}>
              <strong>Grade {g.letter} — {g.label}</strong> : {g.sub} Batterie ≥ {g.battery} %, garantie 24 mois.
            </li>
          ))}
        </ul>
        <p className="mb-10">
          Chaque appareil passe plus de 60 points de contrôle avant la mise en vente. Le détail est sur la page{' '}
          <Link href="/reconditionnement" className={link}>le reconditionnement</Link>, nos garanties sur{' '}
          <Link href="/engagements" className={link}>nos engagements</Link>.
        </p>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-4">Questions fréquentes</h2>
        <div className="space-y-5 mb-10">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-bold text-[#0A0F1E]">{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>

        <p className="mb-2">
          <Link href="/products" className={link}>Voir tous les smartphones reconditionnés</Link>
          {' · '}
          <Link href="/contact" className={link}>Nous contacter</Link>
        </p>
        <p className="text-sm text-slate-400">Dernière mise à jour : {UPDATED}</p>
      </article>
    </main>
  );
}
