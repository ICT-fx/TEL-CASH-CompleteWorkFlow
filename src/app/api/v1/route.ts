import { NextResponse } from 'next/server';

// Index public du connecteur Fluxitron (métadonnées, sans secret). Réactivé :
// Fluxitron sert de miroir de stock fournisseur (les prix restent manuels).
export async function GET() {
  return NextResponse.json({
    name: 'TEL & CASH — Fluxitron connector',
    status: 'active',
    version: 'v1',
    role: 'supplier-stock-mirror',
  });
}
