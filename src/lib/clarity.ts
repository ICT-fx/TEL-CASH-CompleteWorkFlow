// Microsoft Clarity (gratuit, illimité) : cartes de chaleur des VRAIS clics,
// profondeur de défilement et enregistrements de sessions anonymisés.
// Chargé UNIQUEMENT pour les visiteurs qui acceptent les cookies de mesure
// (AnalyticsGate), avec le signal de consentement exigé en Europe depuis le
// 31/10/2025. Tant que l'identifiant est vide, rien n'est chargé.
//
// Identifiant du projet : clarity.microsoft.com → Paramètres → Vue d'ensemble
// (10 caractères, ex. « abcd1234ef »). Ce n'est pas un secret.
export const CLARITY_PROJECT_ID = (process.env.NEXT_PUBLIC_CLARITY_ID || '').trim();

export const CLARITY_DASHBOARD_URL = CLARITY_PROJECT_ID
  ? `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/heatmaps`
  : null;
