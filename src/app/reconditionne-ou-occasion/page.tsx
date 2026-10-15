import type { Metadata } from 'next';
import Link from 'next/link';
import { pageSocial } from '@/lib/seoOg';
import { CLIENT_GRADES } from '@/lib/grades';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';
const PATH = '/reconditionne-ou-occasion';
const TITLE = 'Smartphone reconditionné ou d’occasion : les différences — TEL & CASH Angers';
const DESCRIPTION =
  'Reconditionné ou occasion ? Diagnostic, 60 points de contrôle, batterie minimum par grade et garantie 24 mois : ce qui change chez TEL & CASH, à Angers.';
const UPDATED = '15 octobre 2026';

export const metadata: Metadata = {
  alternates: { canonical: PATH },
  title: TITLE,
  description: DESCRIPTION,
  ...pageSocial(PATH, TITLE, DESCRIPTION),
};

const FAQ = [
  {
    q: 'Un smartphone reconditionné est-il la même chose qu’un smartphone d’occasion ?',
    a: 'Non. Un produit d’occasion est revendu en l’état. Un produit reconditionné est diagnostiqué, réparé si nécessaire, nettoyé puis testé sur plus de 60 points de contrôle avant la vente.',
  },
  {
    q: 'Quelle garantie sur un smartphone reconditionné chez TEL & CASH ?',
    a: 'Tous nos appareils, grades A, B et C, sont garantis 24 mois.',
  },
  {
    q: 'Quelle batterie minimum sur un smartphone reconditionné ?',
    a: CLIENT_GRADES.map((g) => `grade ${g.letter} : ${g.battery} % minimum`).join(', ') + '.',
  },
  {
    q: 'Peut-on dire « comme neuf » pour un smartphone reconditionné ?',
    a: 'Non. Le décret 2022-190 interdit les mentions « comme neuf », « état neuf » et « quasi neuf » pour un produit reconditionné. Nous parlons de « Parfait état », « Très bon état » et « État correct ».',
  },
  {
    q: 'Peut-on voir l’appareil avant d’acheter ?',
    a: 'Oui, à la boutique TEL & CASH d’Angers (10 rue Saint-Étienne). En ligne, la fiche produit présente des photos de l’appareil.',
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
      dateModified: '2026-10-15',
      inLanguage: 'fr-FR',
      about: { '@id': `${BASE_URL}/#store` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Reconditionné ou occasion', item: `${BASE_URL}${PATH}` },
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

export default function ReconditionneOuOccasionPage() {
  return (
    <main className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="container mx-auto px-4 max-w-3xl py-16 md:py-24 text-slate-600 leading-relaxed">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] mb-6 leading-[1.1]">
          Smartphone reconditionné ou d’occasion ?
        </h1>

        <p className="text-lg font-medium text-slate-700 mb-10">
          Un smartphone d’occasion est revendu en l’état ; un smartphone reconditionné est diagnostiqué, réparé si
          nécessaire, puis testé sur plus de 60 points de contrôle. Chez TEL &amp; CASH (Angers), tous les appareils
          reconditionnés, grades A, B et C, sont garantis 24 mois.
        </p>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-3">Le comparatif</h2>
        <div className="overflow-x-auto mb-10">
          <table className="w-full text-left text-sm border border-slate-200">
            <thead className="bg-slate-50 text-[#0A0F1E]">
              <tr>
                <th className="p-3">&nbsp;</th>
                <th className="p-3">Occasion (en général)</th>
                <th className="p-3">Reconditionné TEL &amp; CASH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><th className="p-3 font-semibold">État de l’appareil</th><td className="p-3">Revendu en l’état</td><td className="p-3">Diagnostiqué, réparé si nécessaire, nettoyé</td></tr>
              <tr><th className="p-3 font-semibold">Contrôle</th><td className="p-3">Non défini</td><td className="p-3">Plus de 60 points de contrôle</td></tr>
              <tr><th className="p-3 font-semibold">Batterie</th><td className="p-3">Non définie</td><td className="p-3">{CLIENT_GRADES.map((g) => `${g.letter} ≥ ${g.battery} %`).join(' · ')}</td></tr>
              <tr><th className="p-3 font-semibold">Garantie</th><td className="p-3">Variable selon le vendeur</td><td className="p-3">24 mois (grades A, B et C)</td></tr>
              <tr><th className="p-3 font-semibold">Aspect</th><td className="p-3">Non classé</td><td className="p-3">Grades A, B, C</td></tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-black text-[#0A0F1E] mb-3">Les grades</h2>
        <ul className="list-disc pl-6 mb-10 space-y-1">
          {CLIENT_GRADES.map((g) => (
            <li key={g.letter}>
              <strong>Grade {g.letter} — {g.label}</strong> : {g.sub}
            </li>
          ))}
        </ul>

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
          <Link href="/reconditionnement" className={link}>Le reconditionnement en détail</Link>
          {' · '}
          <Link href="/engagements" className={link}>Nos engagements</Link>
          {' · '}
          <Link href="/iphone-reconditionne-angers" className={link}>Boutique à Angers</Link>
          {' · '}
          <Link href="/products" className={link}>Voir le catalogue</Link>
        </p>
        <p className="text-sm text-slate-400">Dernière mise à jour : {UPDATED}</p>
      </article>
    </main>
  );
}
