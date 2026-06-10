import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité — TEL & CASH',
  description:
    "Politique de confidentialité et de protection des données personnelles de Tel and Cash (PC ANGERS) : données collectées, finalités, durées de conservation, droits RGPD et cookies.",
};

const LAST_UPDATE = '8 juin 2026';

const SUMMARY: { id: string; label: string }[] = [
  { id: 'sec-1', label: '1. Responsable du traitement' },
  { id: 'sec-2', label: '2. Données que nous collectons' },
  { id: 'sec-3', label: '3. Finalités et bases légales' },
  { id: 'sec-4', label: '4. Destinataires et sous-traitants' },
  { id: 'sec-5', label: '5. Transferts hors UE' },
  { id: 'sec-6', label: '6. Durées de conservation' },
  { id: 'sec-7', label: '7. Vos droits' },
  { id: 'sec-8', label: '8. Cookies' },
  { id: 'sec-9', label: '9. Sécurité' },
  { id: 'sec-10', label: '10. Réclamation (CNIL)' },
];

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
          Protection des données
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">
          Politique de confidentialité
        </h1>
        <p className="text-slate-600 text-lg mb-2">
          Tel and Cash (PC ANGERS) accorde une grande importance à la protection de vos données
          personnelles. La présente politique décrit, conformément au Règlement général sur la
          protection des données (RGPD) et à la loi « Informatique et Libertés », la manière dont
          vos données sont collectées et traitées sur le site <strong>telandcash.fr</strong>.
        </p>
        <p className="text-sm text-slate-400 mb-12">Dernière mise à jour : {LAST_UPDATE}</p>

        {/* Sommaire */}
        <nav className="mb-14 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
            Sommaire
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {SUMMARY.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-slate-600 hover:text-primary transition-colors">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          <Article id="sec-1" title="1. Responsable du traitement">
            <P>
              Le responsable du traitement des données est la société <strong>PC ANGERS</strong>{' '}
              (enseigne Tel and Cash), EURL au capital de 10 000 euros, immatriculée au RCS
              d&apos;Angers sous le numéro 985 009 695, dont le siège social est situé 10 rue
              Saint-Étienne, 49100 Angers.
            </P>
            <P>
              Pour toute question relative à vos données, vous pouvez nous écrire à{' '}
              <a href="mailto:contact@telandcash.fr" className="text-primary underline">
                contact@telandcash.fr
              </a>{' '}
              ou par courrier à l&apos;adresse du siège social.
            </P>
          </Article>

          <Article id="sec-2" title="2. Données que nous collectons">
            <P>Selon votre utilisation du site, nous sommes amenés à collecter :</P>
            <Ul>
              <li>
                <strong>Données de compte :</strong> nom, prénom, adresse email, mot de passe
                (stocké de façon chiffrée).
              </li>
              <li>
                <strong>Données de commande et de livraison :</strong> adresse postale, numéro de
                téléphone, contenu du panier, historique des commandes.
              </li>
              <li>
                <strong>Données de paiement :</strong> traitées directement par notre prestataire
                Stripe. Nous ne stockons jamais vos numéros de carte bancaire.
              </li>
              <li>
                <strong>Données relatives au SAV et aux retours :</strong> motif, échanges,
                pièces jointes éventuelles (photos, IMEI).
              </li>
              <li>
                <strong>Données de fidélité et de parrainage :</strong> points de fidélité,
                codes de parrainage.
              </li>
              <li>
                <strong>Données de navigation :</strong> adresse IP, type de navigateur, pages
                consultées, via les cookies (voir section 8).
              </li>
            </Ul>
          </Article>

          <Article id="sec-3" title="3. Finalités et bases légales">
            <P>Vos données sont traitées pour les finalités suivantes :</P>
            <Ul>
              <li>
                <strong>Gestion des commandes, paiements, livraisons et SAV</strong> — base
                légale : exécution du contrat de vente.
              </li>
              <li>
                <strong>Gestion de votre compte client et du programme de fidélité</strong> —
                base légale : exécution du contrat / intérêt légitime.
              </li>
              <li>
                <strong>Respect de nos obligations légales et comptables</strong> (facturation,
                garanties) — base légale : obligation légale.
              </li>
              <li>
                <strong>Envoi d&apos;informations commerciales et de la newsletter</strong> —
                base légale : consentement, révocable à tout moment.
              </li>
              <li>
                <strong>Amélioration du site, mesure d&apos;audience et prévention de la
                fraude</strong> — base légale : intérêt légitime.
              </li>
            </Ul>
          </Article>

          <Article id="sec-4" title="4. Destinataires et sous-traitants">
            <P>
              Vos données sont destinées aux services internes de Tel and Cash habilités. Nous
              faisons appel à des sous-traitants techniques, qui agissent sur nos instructions et
              présentent des garanties conformes au RGPD :
            </P>
            <Ul>
              <li><strong>Supabase</strong> — hébergement de la base de données, authentification et stockage des fichiers.</li>
              <li><strong>Vercel</strong> — hébergement et diffusion du site.</li>
              <li><strong>Stripe</strong> — traitement sécurisé des paiements.</li>
              <li><strong>Transporteurs partenaires</strong> (ex. Chronopost) — acheminement des colis.</li>
            </Ul>
            <P>
              Vos données ne sont jamais vendues à des tiers. Elles peuvent être communiquées aux
              autorités compétentes en cas d&apos;obligation légale.
            </P>
          </Article>

          <Article id="sec-5" title="5. Transferts hors Union européenne">
            <P>
              Certains de nos prestataires peuvent être situés ou héberger des données en dehors
              de l&apos;Union européenne. Dans ce cas, les transferts sont encadrés par des
              garanties appropriées (clauses contractuelles types de la Commission européenne ou
              mécanismes équivalents) afin d&apos;assurer un niveau de protection adéquat.
            </P>
          </Article>

          <Article id="sec-6" title="6. Durées de conservation">
            <Ul>
              <li><strong>Données de compte :</strong> tant que le compte est actif, puis jusqu&apos;à 3 ans après le dernier contact.</li>
              <li><strong>Données de commande et factures :</strong> 10 ans au titre des obligations comptables et fiscales.</li>
              <li><strong>Données de garantie et SAV :</strong> pendant la durée de la garantie applicable, puis le temps nécessaire à la gestion d&apos;un éventuel litige.</li>
              <li><strong>Prospection / newsletter :</strong> jusqu&apos;au retrait du consentement, et au maximum 3 ans après le dernier contact.</li>
              <li><strong>Cookies :</strong> 13 mois maximum.</li>
            </Ul>
          </Article>

          <Article id="sec-7" title="7. Vos droits">
            <P>
              Conformément au RGPD, vous disposez des droits suivants sur vos données :
            </P>
            <Ul>
              <li>droit d&apos;accès et de copie ;</li>
              <li>droit de rectification ;</li>
              <li>droit à l&apos;effacement (« droit à l&apos;oubli ») ;</li>
              <li>droit à la limitation et droit d&apos;opposition au traitement ;</li>
              <li>droit à la portabilité de vos données ;</li>
              <li>droit de retirer votre consentement à tout moment ;</li>
              <li>droit de définir des directives sur le sort de vos données après votre décès.</li>
            </Ul>
            <P>
              Vous pouvez exercer ces droits en nous écrivant à{' '}
              <a href="mailto:contact@telandcash.fr" className="text-primary underline">
                contact@telandcash.fr
              </a>
              . Une réponse vous sera apportée dans un délai d&apos;un mois. Une preuve
              d&apos;identité pourra être demandée en cas de doute raisonnable.
            </P>
          </Article>

          <Article id="sec-8" title="8. Cookies">
            <P>
              Le site utilise des cookies et traceurs nécessaires à son bon fonctionnement
              (gestion de session, panier, authentification) ainsi que, sous réserve de votre
              consentement, des cookies de mesure d&apos;audience.
            </P>
            <Ul>
              <li><strong>Cookies strictement nécessaires :</strong> indispensables à la navigation et à la sécurité, ils ne requièrent pas votre consentement.</li>
              <li><strong>Cookies de mesure et de personnalisation :</strong> déposés uniquement avec votre accord.</li>
            </Ul>
            <P>
              Vous pouvez à tout moment configurer votre navigateur pour refuser ou supprimer les
              cookies. Le refus de certains cookies peut affecter le fonctionnement du site.
            </P>
          </Article>

          <Article id="sec-9" title="9. Sécurité">
            <P>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées
              (chiffrement des mots de passe, connexions sécurisées HTTPS, contrôle des accès,
              externalisation du paiement chez un prestataire certifié PCI-DSS) afin de protéger
              vos données contre tout accès, altération, divulgation ou destruction non autorisés.
            </P>
          </Article>

          <Article id="sec-10" title="10. Réclamation auprès de la CNIL">
            <P>
              Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés,
              vous pouvez introduire une réclamation auprès de la Commission Nationale de
              l&apos;Informatique et des Libertés (CNIL) :
            </P>
            <Callout>
              <strong>CNIL</strong>
              <br />
              3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07
              <br />
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                https://www.cnil.fr
              </a>
            </Callout>
          </Article>
        </div>

        <div className="mt-16 p-6 bg-slate-100 rounded-2xl text-sm text-slate-600">
          <p className="mb-2"><strong>Une question sur vos données ?</strong></p>
          <p>
            Écrivez-nous à{' '}
            <a href="mailto:contact@telandcash.fr" className="text-primary underline">
              contact@telandcash.fr
            </a>{' '}
            ou consultez nos{' '}
            <Link href="/cgv" className="text-primary underline">
              Conditions Générales de Vente
            </Link>{' '}
            et nos{' '}
            <Link href="/mentions" className="text-primary underline">
              mentions légales
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Article({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28">
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
