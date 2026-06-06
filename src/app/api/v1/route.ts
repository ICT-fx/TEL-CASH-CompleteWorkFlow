import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'TEL & CASH API',
    version: '1.0.0',
    endpoints: [
      '/api/v1/products',
      '/api/v1/categories',
      '/api/v1/orders',
      '/api/v1/prices/batch',
      '/api/v1/stock/batch',
      '/api/v1/locations',
    ],
  });
}
