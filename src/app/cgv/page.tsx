import Link from 'next/link';

export const metadata = {
  title: 'Conditions Générales de Vente — TEL & CASH',
  description:
    "Conditions Générales de Vente de Tel and Cash (PC ANGERS) : commande, paiement, livraison, droit de rétractation, garanties légales et commerciale, SAV.",
};

const LAST_UPDATE = '8 juin 2026';

const SUMMARY: { id: string; label: string }[] = [
  { id: 'art-1', label: '1. Identité du vendeur' },
  { id: 'art-2', label: '2. Objet' },
  { id: 'art-3', label: "3. Champ d'application" },
  { id: 'art-4', label: '4. Informations précontractuelles' },
  { id: 'art-5', label: '5. Produits' },
  { id: 'art-6', label: '6. Disponibilité' },
  { id: 'art-7', label: '7. Prix' },
  { id: 'art-8', label: '8. Commande' },
  { id: 'art-9', label: '9. Paiement' },
  { id: 'art-10', label: '10. Réserve de propriété' },
  { id: 'art-11', label: '11. Livraison' },
  { id: 'art-12', label: '12. Rétractation' },
  { id: 'art-13', label: '13. Garanties légales' },
  { id: 'art-14', label: '14. Garantie commerciale Tel and Cash' },
  { id: 'art-15', label: '15. Procédure SAV / retour sous garantie' },
  { id: 'art-16', label: '16. Responsabilité' },
  { id: 'art-17', label: '17. Avis clients' },
  { id: 'art-18', label: '18. Données personnelles' },
  { id: 'art-19', label: '19. Propriété intellectuelle' },
  { id: 'art-20', label: '20. Force majeure' },
  { id: 'art-21', label: '21. Nullité partielle' },
  { id: 'art-22', label: '22. Médiation et litiges' },
  { id: 'art-23', label: '23. Droit applicable' },
];

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
          Informations légales
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">
          Conditions Générales de Vente
        </h1>
        <p className="text-slate-600 text-lg mb-2">
          Les présentes Conditions Générales de Vente (« CGV ») régissent toute commande
          passée sur le site <strong>telandcash.fr</strong>, exploité par PC ANGERS (Tel and Cash).
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
          <Article id="art-1" title="1. Identité du vendeur">
            <P>Le site telandcash.fr est exploité par :</P>
            <P>
              <strong>PC ANGERS</strong>, EURL au capital social de 10 000 euros, immatriculée
              au RCS d&apos;Angers sous le numéro <strong>985 009 695</strong>, dont le siège
              social est situé 10 rue Saint-Étienne, 49100 Angers, numéro de TVA
              intracommunautaire <strong>FR48985009695</strong>.
            </P>
            <P>Nom commercial / enseigne : <strong>Tel and Cash</strong>.</P>
            <P className="font-bold text-slate-900 pt-2">Contact service client</P>
            <Ul>
              <li>Adresse : 10 rue Saint-Étienne, 49100 Angers</li>
              <li>
                Téléphone :{' '}
                <a href="tel:0285359532" className="text-primary underline">02 85 35 95 32</a>
              </li>
              <li>
                Email :{' '}
                <a href="mailto:contact@telandcash.fr" className="text-primary underline">
                  contact@telandcash.fr
                </a>
              </li>
            </Ul>
          </Article>

          <Article id="art-2" title="2. Objet">
            <P>
              Les présentes Conditions Générales de Vente ont pour objet de définir les droits
              et obligations de Tel and Cash et de tout consommateur effectuant un achat à
              distance sur le site.
            </P>
            <P>
              Elles s&apos;appliquent à toute commande de produits commercialisés sur le site,
              notamment smartphones reconditionnés, tablettes reconditionnées, accessoires et,
              le cas échéant, tout autre produit proposé à la vente.
            </P>
          </Article>

          <Article id="art-3" title="3. Champ d'application">
            <P>
              Les présentes CGV s&apos;appliquent exclusivement aux ventes conclues avec des
              consommateurs et non-professionnels au sens du Code de la consommation.
            </P>
            <P>
              Toute commande passée sur le site implique l&apos;acceptation pleine et entière
              des présentes CGV par le client, à l&apos;exclusion de tout autre document. Les
              CGV applicables sont celles en vigueur au jour de la commande.
            </P>
          </Article>

          <Article id="art-4" title="4. Informations précontractuelles">
            <P>
              Avant toute commande, le client reconnaît avoir pris connaissance, de manière
              lisible et compréhensible, des informations suivantes :
            </P>
            <Ul>
              <li>les caractéristiques essentielles du produit ;</li>
              <li>le prix du produit ;</li>
              <li>les frais, délais et modalités de livraison ;</li>
              <li>l&apos;identité du vendeur ;</li>
              <li>les garanties légales et, le cas échéant, la garantie commerciale ;</li>
              <li>les modalités d&apos;exercice du droit de rétractation ;</li>
              <li>les moyens de paiement acceptés ;</li>
              <li>les conditions du service après-vente.</li>
            </Ul>
          </Article>

          <Article id="art-5" title="5. Produits">
            <P>
              Les produits proposés à la vente sont ceux présentés sur le site au jour de sa
              consultation par le client, dans la limite des stocks disponibles.
            </P>
            <P>
              Les photographies, visuels, descriptions, fiches techniques et indications de
              compatibilité sont fournis à titre contractuel pour décrire le plus fidèlement
              possible les produits. Toutefois, une différence minime de teinte, de présentation
              ou de packaging ne saurait engager la responsabilité du vendeur, dès lors que le
              produit livré est conforme à ses caractéristiques essentielles.
            </P>

            <SubTitle>5.1 Produits reconditionnés</SubTitle>
            <P>
              Les smartphones, tablettes et appareils reconditionnés vendus sur le site sont des
              produits d&apos;occasion ayant fait l&apos;objet de tests, de vérifications, et, si
              nécessaire, d&apos;opérations de remise en état. Sauf mention contraire sur la
              fiche produit :
            </P>
            <Ul>
              <li>les appareils sont 100 % fonctionnels ;</li>
              <li>ils sont testés sur plus de 60 points de contrôle ;</li>
              <li>
                ils sont vendus avec une batterie présentant au minimum 85 % de capacité, ou
                remplacée si ce seuil n&apos;est pas atteint avant mise en vente ;
              </li>
              <li>ils sont vendus selon un grade esthétique précisé sur la fiche produit.</li>
            </Ul>

            <SubTitle>5.2 Grades esthétiques</SubTitle>
            <P>Le grade esthétique est communiqué avant achat.</P>
            <Ul>
              <li>
                <strong>Grade A – Parfait état</strong> : état esthétique premium, écran intact,
                absence de rayure significative, coque impeccable ou quasi impeccable.
              </li>
              <li>
                <strong>Grade B – Très bon état</strong> : très légères traces d&apos;usage,
                micro-rayures peu visibles à distance normale.
              </li>
              <li>
                <strong>Grade C – État correct</strong> : rayures visibles et/ou traces
                d&apos;usure plus marquées, sans incidence sur le fonctionnement.
              </li>
            </Ul>
            <P>
              Le grade concerne uniquement l&apos;aspect esthétique. Sauf mention contraire, les
              performances fonctionnelles de l&apos;appareil restent garanties.
            </P>

            <SubTitle>5.3 Batterie</SubTitle>
            <P>
              Pour les produits reconditionnés, la batterie est testée avant mise en vente et
              doit présenter une capacité supérieure ou égale à 85 % de sa capacité initiale. En
              dessous de ce seuil, elle peut être remplacée avant commercialisation.
            </P>
            <P>
              Le client reconnaît qu&apos;une batterie est un composant d&apos;usure dont
              l&apos;autonomie varie selon l&apos;usage, les réglages, les mises à jour
              logicielles, la température, les cycles de charge et les applications installées.
            </P>

            <SubTitle>5.4 Compatibilité / activation / réseau</SubTitle>
            <P>
              Le client est seul responsable de vérifier la compatibilité du produit avec ses
              usages, accessoires, opérateur, applications, services, eSIM, cartes SIM, comptes
              utilisateurs, sauvegardes ou équipements tiers.
            </P>
            <P>
              Sauf mention contraire, les appareils sont vendus comme « libres tout opérateur ».
              En cas de blocage ultérieur lié à un compte cloud, à un compte utilisateur, à une
              erreur de manipulation, à une suspension opérateur, à une déclaration d&apos;usage
              frauduleux ou à un événement extérieur postérieur à la livraison, la responsabilité
              du vendeur ne pourra être engagée si le produit était conforme lors de
              l&apos;expédition.
            </P>
          </Article>

          <Article id="art-6" title="6. Disponibilité">
            <P>
              Les offres de produits sont valables tant qu&apos;elles sont visibles sur le site
              et dans la limite des stocks disponibles.
            </P>
            <P>
              En cas d&apos;indisponibilité après passation de commande, le client sera informé
              dans les meilleurs délais. La commande pourra être annulée et les sommes versées
              remboursées sans délai indu.
            </P>
          </Article>

          <Article id="art-7" title="7. Prix">
            <P>
              Les prix sont indiqués en euros, toutes taxes comprises, hors éventuels frais de
              livraison lorsque ceux-ci s&apos;appliquent.
            </P>
            <P>
              Le prix applicable est celui affiché sur le site au moment de la validation de la
              commande. Tel and Cash se réserve le droit de modifier ses prix à tout moment, sans
              que cette modification n&apos;affecte les commandes déjà validées.
            </P>
            <P>
              En cas d&apos;erreur manifeste de prix, purement dérisoire ou manifestement
              incohérente, le vendeur pourra annuler la commande après information du client et
              remboursement intégral des sommes versées.
            </P>
          </Article>

          <Article id="art-8" title="8. Commande">
            <P>
              Le client sélectionne le ou les produits qu&apos;il souhaite acheter, les ajoute à
              son panier, puis suit le processus de commande en ligne. La commande est réputée
              passée lorsque le client :
            </P>
            <Ul>
              <li>a vérifié le détail de sa commande ;</li>
              <li>a corrigé d&apos;éventuelles erreurs ;</li>
              <li>a accepté les présentes CGV ;</li>
              <li>a validé son obligation de paiement ;</li>
              <li>a procédé au paiement.</li>
            </Ul>
            <P>
              Le vendeur adresse ensuite un accusé de réception de la commande par voie
              électronique, sous réserve de la bonne réception du paiement.
            </P>
            <P>
              Le vendeur se réserve le droit de refuser ou d&apos;annuler toute commande en cas
              de litige antérieur, de suspicion de fraude, de défaut de paiement, d&apos;adresse
              manifestement erronée ou de demande anormale.
            </P>
          </Article>

          <Article id="art-9" title="9. Paiement">
            <P>Le paiement est exigible en totalité au moment de la commande.</P>
            <P>
              Les moyens de paiement acceptés sont ceux affichés sur le site au moment de la
              commande, notamment carte bancaire et PayPal, sous réserve de disponibilité
              technique. Le client garantit qu&apos;il dispose des autorisations nécessaires pour
              utiliser le moyen de paiement choisi.
            </P>
            <P>
              Le vendeur se réserve le droit de suspendre toute commande ou livraison en cas de
              refus d&apos;autorisation de paiement, de non-paiement ou de contrôle antifraude.
            </P>
          </Article>

          <Article id="art-10" title="10. Réserve de propriété">
            <P>
              Les produits demeurent la propriété pleine et entière du vendeur jusqu&apos;à
              encaissement effectif et intégral du prix.
            </P>
            <P>
              Le transfert des risques intervient au moment où le client, ou un tiers désigné par
              lui, prend physiquement possession du produit.
            </P>
          </Article>

          <Article id="art-11" title="11. Livraison">
            <SubTitle>11.1 Zone de livraison</SubTitle>
            <P>
              Les produits sont livrés à l&apos;adresse indiquée par le client lors de la
              commande, dans la zone géographique proposée sur le site au moment de l&apos;achat.
            </P>
            <SubTitle>11.2 Délais</SubTitle>
            <P>
              Les délais de préparation et de livraison sont indiqués sur le site ou au cours du
              processus de commande. Lorsqu&apos;un engagement commercial de type « expédition le
              jour même » ou « livraison 24/48h » est affiché, il s&apos;entend hors cas de force
              majeure, incident transporteur, erreur du client, période exceptionnelle ou
              indisponibilité indépendante de la volonté du vendeur.
            </P>
            <SubTitle>11.3 Frais</SubTitle>
            <P>
              Les frais de livraison sont indiqués avant validation définitive de la commande. Si
              la livraison est annoncée comme offerte, cette gratuité s&apos;applique dans les
              conditions précisées sur le site.
            </P>
            <SubTitle>11.4 Réception</SubTitle>
            <P>
              Le client est tenu de vérifier l&apos;état du colis au moment de la livraison.
              Toute anomalie apparente doit être signalée sans délai au transporteur et au
              vendeur, avec toutes réserves utiles, photos à l&apos;appui lorsque cela est
              possible.
            </P>
          </Article>

          <Article id="art-12" title="12. Rétractation">
            <P>
              Conformément au Code de la consommation, le client consommateur dispose d&apos;un
              délai de <strong>quatorze jours</strong> à compter de la réception du produit pour
              exercer son droit de rétractation, sans avoir à motiver sa décision.
            </P>
            <P>
              Le client peut exercer ce droit par tout moyen dénué d&apos;ambiguïté, notamment
              par email ou courrier, en précisant ses coordonnées, le numéro de commande et le
              produit concerné.
            </P>
            <P>
              Le produit doit être retourné, au plus tard dans les quatorze jours suivant la
              communication de la décision de rétractation :
            </P>
            <Ul>
              <li>complet ;</li>
              <li>dans son état d&apos;origine compatible avec un simple essai ;</li>
              <li>avec ses accessoires éventuels ;</li>
              <li>dans son emballage d&apos;origine si disponible.</li>
            </Ul>
            <P>
              Le client est informé qu&apos;il peut être tenu responsable d&apos;une dépréciation
              du bien résultant de manipulations autres que celles nécessaires pour établir la
              nature, les caractéristiques et le bon fonctionnement du produit.
            </P>
            <P>
              Les frais directs de retour sont à la charge du client, sauf mention contraire. Le
              remboursement interviendra dans les quatorze jours à compter de la réception de la
              décision de rétractation, le vendeur pouvant différer le remboursement jusqu&apos;à
              récupération du produit ou réception d&apos;une preuve d&apos;expédition.
            </P>

            <SubTitle>12.1 Exclusions du droit de rétractation</SubTitle>
            <P>
              Le droit de rétractation ne s&apos;applique pas dans les cas prévus par la loi,
              notamment pour :
            </P>
            <Ul>
              <li>
                les produits confectionnés selon les spécifications du client ou nettement
                personnalisés ;
              </li>
              <li>
                les produits descellés par le client et ne pouvant être renvoyés pour des raisons
                d&apos;hygiène ou de protection de la santé, lorsque cette exception est
                applicable ;
              </li>
              <li>tout autre cas légal d&apos;exclusion.</li>
            </Ul>

            <SubTitle>12.2 Politique commerciale « 30 jours »</SubTitle>
            <P>
              Si le site affiche une politique commerciale « 30 jours pour changer d&apos;avis »,
              celle-ci constitue un avantage commercial supplémentaire distinct du droit légal de
              rétractation de 14 jours. Les conditions précises d&apos;application de cette
              faculté commerciale sont celles définies par Tel and Cash au jour de la commande.
            </P>
          </Article>

          <Article id="art-13" title="13. Garanties légales">
            <P>
              Le client bénéficie de la garantie légale de conformité ainsi que de la garantie
              légale des vices cachés, dans les conditions prévues par la loi.
            </P>
            <P>
              Le consommateur dispose d&apos;un délai de deux ans à compter de la délivrance du
              bien pour agir au titre de la garantie légale de conformité. Le client peut
              également décider de mettre en œuvre la garantie contre les défauts cachés de la
              chose vendue.
            </P>
            <Callout>
              Articles applicables (à reproduire intégralement) : la garantie légale de conformité
              (art. L217-3 et suivants du Code de la consommation) et la garantie des vices cachés
              (art. 1641 et suivants du Code civil) s&apos;appliquent indépendamment de toute
              garantie commerciale.
            </Callout>
          </Article>

          <Article id="art-14" title="14. Garantie commerciale Tel and Cash">
            <P>
              En complément des garanties légales, certains produits vendus sur le site
              bénéficient d&apos;une garantie commerciale, lorsque celle-ci est mentionnée sur la
              fiche produit ou sur le site.
            </P>
            <SubTitle>14.1 Durée</SubTitle>
            <P>Sauf mention contraire :</P>
            <Ul>
              <li>smartphones et tablettes reconditionnés : garantie commerciale de 24 mois ;</li>
              <li>
                certains grades ou catégories spécifiques peuvent afficher une durée différente
                sur le site ou la fiche produit.
              </li>
            </Ul>
            <SubTitle>14.2 Étendue</SubTitle>
            <P>
              La garantie commerciale couvre les pannes matérielles et défauts techniques non
              causés par le client, notamment, selon le diagnostic du vendeur :
            </P>
            <Ul>
              <li>dysfonctionnements électroniques ;</li>
              <li>défauts de boutons ;</li>
              <li>défaillance caméra ;</li>
              <li>défaut de connecteur ;</li>
              <li>défauts affectant le fonctionnement normal du produit.</li>
            </Ul>
            <P>Pièces et main-d&apos;œuvre sont comprises lorsque la garantie s&apos;applique.</P>
            <SubTitle>14.3 Exclusions</SubTitle>
            <P>Sont notamment exclus de la garantie commerciale :</P>
            <Ul>
              <li>la casse, la fissure, le choc, l&apos;écrasement, la chute ;</li>
              <li>l&apos;oxydation, l&apos;infiltration de liquide, l&apos;humidité ;</li>
              <li>l&apos;ouverture, la réparation ou la modification par un tiers non autorisé ;</li>
              <li>l&apos;usure normale ;</li>
              <li>
                les dommages résultant d&apos;une mauvaise utilisation, d&apos;un accessoire
                inadapté, d&apos;une surtension, d&apos;un défaut d&apos;entretien ou d&apos;un
                usage non conforme ;
              </li>
              <li>
                les défauts liés à un logiciel tiers, à une mauvaise configuration, à un virus, à
                une réinitialisation incomplète ou à un blocage de compte ;
              </li>
              <li>
                l&apos;usure de la batterie en dessous de 80 % de capacité maximale au-delà du
                sixième mois, conformément aux engagements affichés sur le site ;
              </li>
              <li>les éléments consommables ou accessoires, sauf mention contraire.</li>
            </Ul>
            <SubTitle>14.4 Mise en œuvre</SubTitle>
            <P>Toute demande de prise en charge doit être adressée au service client avec :</P>
            <Ul>
              <li>numéro de commande ;</li>
              <li>description détaillée de la panne ;</li>
              <li>photographies ou vidéos si nécessaire.</li>
            </Ul>
            <P>
              Le vendeur pourra demander le retour du produit pour diagnostic. Aucun
              remboursement ou échange ne pourra intervenir avant expertise technique. Si la panne
              entre dans le champ de la garantie commerciale, le vendeur choisira, selon le cas :
              la réparation, l&apos;échange, ou, si ces solutions sont impossibles ou
              disproportionnées, le remboursement total ou partiel.
            </P>
          </Article>

          <Article id="art-15" title="15. Procédure SAV / retour sous garantie">
            <P>
              Avant tout retour, le client doit contacter le service support afin d&apos;obtenir
              la procédure à suivre. Le produit retourné doit être :
            </P>
            <Ul>
              <li>correctement emballé ;</li>
              <li>désactivé de tout compte personnel lorsque cela est nécessaire ;</li>
              <li>sauvegardé et réinitialisé lorsque cela est demandé.</li>
            </Ul>
            <P>
              Le client est invité à effectuer une sauvegarde complète de ses données avant tout
              envoi. Le vendeur n&apos;est pas responsable de la perte, de l&apos;altération ou de
              la suppression de données lors des opérations de test, diagnostic, remise en état,
              réinitialisation ou réparation.
            </P>
            <P>
              En cas de produit non couvert par la garantie, un devis ou une proposition pourra
              être communiqué au client.
            </P>
          </Article>

          <Article id="art-16" title="16. Responsabilité">
            <P>
              Le vendeur ne saurait être tenu responsable de l&apos;inexécution ou de la mauvaise
              exécution du contrat imputable :
            </P>
            <Ul>
              <li>au client ;</li>
              <li>au fait imprévisible et insurmontable d&apos;un tiers ;</li>
              <li>à un cas de force majeure.</li>
            </Ul>
            <P>
              La responsabilité du vendeur est en tout état de cause limitée aux dommages directs
              et prévisibles résultant d&apos;une faute prouvée, sous réserve des dispositions
              légales impératives. Le vendeur ne pourra être tenu responsable :
            </P>
            <Ul>
              <li>d&apos;une incompatibilité avec un usage spécifique non signalé ;</li>
              <li>d&apos;une perte de données ;</li>
              <li>d&apos;une indisponibilité temporaire du site ;</li>
              <li>d&apos;un dommage résultant d&apos;une mauvaise utilisation du produit.</li>
            </Ul>
          </Article>

          <Article id="art-17" title="17. Avis clients">
            <P>
              Les avis affichés sur le site ont une vocation informative et commerciale. Lorsque
              le site mentionne des « avis vérifiés », il appartient au vendeur de pouvoir
              justifier le mode de collecte, de vérification et de publication des avis affichés.
            </P>
          </Article>

          <Article id="art-18" title="18. Données personnelles">
            <P>
              Les données personnelles collectées dans le cadre des commandes, de la relation
              client, du support, des retours, de la garantie et, le cas échéant, de la
              newsletter, sont traitées conformément à la{' '}
              <Link href="/confidentialite" className="text-primary underline">
                politique de confidentialité
              </Link>{' '}
              du site.
            </P>
            <P>
              Le client dispose des droits prévus par la réglementation applicable en matière de
              protection des données personnelles.
            </P>
          </Article>

          <Article id="art-19" title="19. Propriété intellectuelle">
            <P>
              Tous les éléments du site, y compris textes, visuels, graphismes, logos, images,
              vidéos, bases de données, structure et charte graphique, sont protégés par le droit
              de la propriété intellectuelle.
            </P>
            <P>
              Toute reproduction, représentation, exploitation ou utilisation, totale ou
              partielle, sans autorisation préalable écrite, est interdite.
            </P>
          </Article>

          <Article id="art-20" title="20. Force majeure">
            <P>
              L&apos;exécution des obligations du vendeur peut être suspendue en cas de force
              majeure au sens du droit applicable et de la jurisprudence française.
            </P>
          </Article>

          <Article id="art-21" title="21. Nullité partielle">
            <P>
              Si une clause des présentes CGV était déclarée nulle, illégale ou inopposable, les
              autres stipulations demeureraient en vigueur.
            </P>
          </Article>

          <Article id="art-22" title="22. Médiation et litiges">
            <P>
              En cas de litige, le client est invité à contacter en priorité le service client
              afin de rechercher une solution amiable.
            </P>
            <P>
              Conformément au Code de la consommation, le consommateur peut recourir gratuitement
              à un médiateur de la consommation :
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
            <P>
              La plateforme européenne de règlement en ligne des litiges pouvant évoluer, le
              vendeur indiquera le cas échéant les références à jour applicables. À défaut
              d&apos;accord amiable, les litiges seront portés devant les juridictions compétentes
              selon les règles légales applicables.
            </P>
          </Article>

          <Article id="art-23" title="23. Droit applicable">
            <P>Les présentes CGV sont soumises au droit français.</P>
          </Article>
        </div>

        <div className="mt-16 p-6 bg-slate-100 rounded-2xl text-sm text-slate-600">
          <p className="mb-2"><strong>Une question sur nos conditions de vente ?</strong></p>
          <p>
            Contactez-nous via la{' '}
            <Link href="/contact" className="text-primary underline">page contact</Link> ou par
            email à{' '}
            <a href="mailto:contact@telandcash.fr" className="text-primary underline">
              contact@telandcash.fr
            </a>
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

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-800 pt-3">{children}</h3>;
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
