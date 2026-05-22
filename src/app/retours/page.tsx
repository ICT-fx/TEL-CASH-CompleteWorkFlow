import Link from 'next/link';
import { ShieldCheck, Clock, Package, CreditCard, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Retours & remboursement — TEL & CASH',
  description: 'Politique de retour, droit de rétractation 14 jours, conditions de remboursement.',
};

export default function ReturnsPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-4">
          Retours & remboursement
        </h1>
        <p className="text-slate-600 text-lg mb-12">
          Vous disposez d'un droit de rétractation de 14 jours après réception de votre commande,
          conformément à l'article L221-18 du Code de la consommation.
        </p>

        <Section icon={<Clock className="w-5 h-5" />} title="Délais">
          <ul className="space-y-2 text-slate-700">
            <li>• <strong>14 jours</strong> pour exercer votre droit de rétractation sans avoir à justifier de motif</li>
            <li>• <strong>30 jours</strong> pour signaler un produit défectueux ou non conforme à l'annonce</li>
            <li>• Le délai court à compter du jour de réception du colis</li>
          </ul>
        </Section>

        <Section icon={<Package className="w-5 h-5" />} title="Conditions pour être remboursé">
          <ul className="space-y-2 text-slate-700">
            <li>• Le téléphone doit être <strong>réinitialisé en usine</strong> (compte iCloud, Google, MDM déconnectés)</li>
            <li>• L'<strong>IMEI</strong> doit correspondre exactement à celui qui vous a été expédié (vérification systématique à réception)</li>
            <li>• L'état du produit doit être conforme à celui de l'envoi (photos d'expédition conservées comme preuve)</li>
            <li>• Le téléphone doit être retourné dans son emballage d'origine si possible, avec ses accessoires</li>
          </ul>
        </Section>

        <Section icon={<ShieldCheck className="w-5 h-5" />} title="Comment demander un retour">
          <ol className="space-y-3 text-slate-700">
            <li><strong>1.</strong> Connectez-vous à votre compte → <Link href="/account/orders" className="text-primary underline">Mes commandes</Link></li>
            <li><strong>2.</strong> Sur la commande concernée, cliquez sur <em>Retour / remboursement</em></li>
            <li><strong>3.</strong> Sélectionnez un motif, ajoutez une description et des photos si nécessaire</li>
            <li><strong>4.</strong> Nous validons votre demande sous 48 h ouvrées et vous envoyons une étiquette de retour prépayée par email</li>
            <li><strong>5.</strong> Vous expédiez le téléphone <strong>réinitialisé</strong>, dans son emballage</li>
            <li><strong>6.</strong> À réception, nous inspectons (IMEI + état) sous 3 jours ouvrés</li>
            <li><strong>7.</strong> Si conforme, le remboursement est déclenché sous Stripe et apparaît sur votre carte sous 5 à 10 jours ouvrés</li>
          </ol>
        </Section>

        <Section icon={<CreditCard className="w-5 h-5" />} title="Montant du remboursement">
          <ul className="space-y-2 text-slate-700">
            <li>• <strong>Rétractation 14j</strong> : remboursement intégral, frais de retour à votre charge sauf accord contraire</li>
            <li>• <strong>Produit défectueux / non conforme</strong> : remboursement intégral, étiquette de retour offerte</li>
            <li>• <strong>Téléphone non conforme à l'envoi</strong> (rayures non présentes initialement, casse, IMEI différent…) : remboursement partiel ou refus, à notre discrétion</li>
          </ul>
        </Section>

        <Section icon={<AlertTriangle className="w-5 h-5" />} title="Motifs de refus">
          <p className="text-slate-700 mb-3">Nous nous réservons le droit de refuser un remboursement dans les cas suivants :</p>
          <ul className="space-y-2 text-slate-700">
            <li>• IMEI différent de celui expédié (tentative de fraude)</li>
            <li>• Téléphone non réinitialisé (présence d'un verrou iCloud / FRP)</li>
            <li>• Dommages importants non présents à l'envoi</li>
            <li>• Délai légal dépassé</li>
            <li>• Pièces internes manquantes ou remplacées</li>
          </ul>
          <p className="text-slate-700 mt-4 text-sm">
            En cas de refus, le téléphone vous est renvoyé avec un rapport motivé. Vous pouvez contester sous 7 jours.
          </p>
        </Section>

        <div className="mt-16 p-6 bg-slate-100 rounded-2xl text-sm text-slate-600">
          <p className="mb-2"><strong>Une question ?</strong></p>
          <p>Contactez-nous via la <Link href="/contact" className="text-primary underline">page contact</Link> ou par email à <a href="mailto:contact@telandcash.fr" className="text-primary underline">contact@telandcash.fr</a>.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="pl-13">{children}</div>
    </section>
  );
}
