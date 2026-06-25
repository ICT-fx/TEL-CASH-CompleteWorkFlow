import Link from 'next/link';

export const metadata = {
  title: 'Mentions légales — TEL & CASH',
  description:
    "Mentions légales du site telandcash.fr : éditeur PC ANGERS (Tel and Cash), directeur de publication, hébergeur, propriété intellectuelle et contact.",
};

const LAST_UPDATE = '8 juin 2026';

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
          Informations légales
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">
          Mentions légales
        </h1>
        <p className="text-slate-600 text-lg mb-2">
          Conformément aux articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l&apos;économie numérique (LCEN), les présentes mentions précisent
          l&apos;identité des différents intervenants dans le cadre du site{' '}
          <strong>telandcash.fr</strong>.
        </p>
        <p className="text-sm text-slate-400 mb-12">Dernière mise à jour : {LAST_UPDATE}</p>

        <div className="space-y-12">
          <Article title="1. Éditeur du site">
            <P>Le site telandcash.fr est édité par :</P>
            <Ul>
              <li><strong>Dénomination sociale :</strong> PC ANGERS</li>
              <li><strong>Forme juridique :</strong> EURL (entreprise unipersonnelle à responsabilité limitée)</li>
              <li><strong>Capital social :</strong> 10 000 euros</li>
              <li><strong>Nom commercial / enseigne :</strong> Tel and Cash</li>
              <li><strong>Siège social :</strong> 10 rue Saint-Étienne, 49100 Angers, France</li>
              <li><strong>RCS :</strong> Angers — 985 009 695</li>
              <li><strong>Numéro SIREN :</strong> 985 009 695</li>
              <li><strong>TVA intracommunautaire :</strong> FR48985009695</li>
              <li>
                <strong>Téléphone :</strong>{' '}
                <a href="tel:0285359532" className="text-primary underline">02 85 35 95 32</a>
              </li>
              <li>
                <strong>Email :</strong>{' '}
                <a href="mailto:infos@telandcash.fr" className="text-primary underline">
                  infos@telandcash.fr
                </a>
              </li>
            </Ul>
          </Article>

          <Article title="2. Directeur de la publication">
            <P>
              Le directeur de la publication du site est le représentant légal (gérant) de la
              société PC ANGERS, joignable à l&apos;adresse du siège social ou par email à{' '}
              <a href="mailto:infos@telandcash.fr" className="text-primary underline">
                infos@telandcash.fr
              </a>
              .
            </P>
          </Article>

          <Article title="3. Hébergement du site">
            <P>Le site est hébergé par :</P>
            <Ul>
              <li><strong>Hébergeur :</strong> Vercel Inc.</li>
              <li><strong>Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
              <li>
                <strong>Site web :</strong>{' '}
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  vercel.com
                </a>
              </li>
            </Ul>
            <P>
              L&apos;infrastructure de base de données et d&apos;authentification est fournie par
              Supabase. Le traitement des paiements est assuré par Stripe Payments Europe, Ltd.
            </P>
          </Article>

          <Article title="4. Propriété intellectuelle">
            <P>
              L&apos;ensemble des éléments composant le site telandcash.fr (textes, visuels,
              graphismes, logos, photographies, icônes, vidéos, bases de données, structure et
              charte graphique) est protégé par le droit de la propriété intellectuelle et
              demeure la propriété exclusive de PC ANGERS ou de ses partenaires.
            </P>
            <P>
              Toute reproduction, représentation, modification, publication ou adaptation, totale
              ou partielle, de ces éléments, quel que soit le moyen ou le procédé utilisé, est
              interdite sans l&apos;autorisation écrite préalable de PC ANGERS, sous peine de
              constituer une contrefaçon sanctionnée par les articles L335-2 et suivants du Code
              de la propriété intellectuelle.
            </P>
          </Article>

          <Article title="5. Données personnelles et cookies">
            <P>
              Les traitements de données à caractère personnel mis en œuvre dans le cadre du site
              ainsi que l&apos;usage des cookies sont détaillés dans notre{' '}
              <Link href="/confidentialite" className="text-primary underline">
                politique de confidentialité
              </Link>
              .
            </P>
          </Article>

          <Article title="6. Conditions de vente">
            <P>
              Les ventes réalisées sur le site sont régies par nos{' '}
              <Link href="/cgv" className="text-primary underline">
                Conditions Générales de Vente
              </Link>
              , que le client accepte avant toute commande.
            </P>
          </Article>

          <Article title="7. Médiation de la consommation">
            <P>
              Conformément à l&apos;article L612-1 du Code de la consommation, le consommateur
              peut recourir gratuitement à un médiateur de la consommation :
            </P>
            <Callout>
              <strong>Médiation de la consommation FEVAD</strong>
              <br />
              <a
                href="https://www.mediateurfevad.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                https://www.mediateurfevad.fr/
              </a>
            </Callout>
          </Article>

          <Article title="8. Responsabilité">
            <P>
              PC ANGERS s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des
              informations diffusées sur le site, mais ne saurait être tenue responsable des
              erreurs, omissions ou d&apos;une indisponibilité temporaire du service. Les liens
              hypertextes présents sur le site pointant vers d&apos;autres ressources n&apos;engagent
              pas la responsabilité de PC ANGERS quant à leur contenu.
            </P>
          </Article>
        </div>

        <div className="mt-16 p-6 bg-slate-100 rounded-2xl text-sm text-slate-600">
          <p className="mb-2"><strong>Une question ?</strong></p>
          <p>
            Contactez-nous via la{' '}
            <Link href="/contact" className="text-primary underline">page contact</Link> ou par
            email à{' '}
            <a href="mailto:infos@telandcash.fr" className="text-primary underline">
              infos@telandcash.fr
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-28">
      <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-slate-700 leading-relaxed ${className}`}>{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 text-slate-700 list-disc pl-5 marker:text-primary">{children}</ul>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-slate-700 text-sm leading-relaxed">
      {children}
    </div>
  );
}
