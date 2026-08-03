// Génération de QR code EN LOCAL (lib `qrcode`, aucun service externe) — le
// code de retrait ne doit jamais transiter par un tiers. Serveur uniquement.
import QRCode from 'qrcode';

// Retourne un data URI PNG directement embarquable dans un <img src="...">
// d'email (pas d'URL publique à héberger, rendu garanti même hors-ligne pour
// le client une fois l'email reçu).
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 240 });
}
