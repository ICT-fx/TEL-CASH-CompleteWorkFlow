# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

There are no test commands configured.

## Architecture Overview

**TEL & CASH** is a full-stack e-commerce platform for refurbished smartphones, built with:

- **Next.js 15 App Router** — server and client components, API routes under `/src/app/api/`
- **Supabase** — PostgreSQL database with Row-Level Security, Supabase Auth, and Storage for images
- **Stripe** — payment processing with webhook at `/api/webhooks/stripe`
- **Zustand** — client-side cart state (`/src/store/useCart.ts`)
- **Tailwind CSS + Framer Motion** — styling and animations

### Key Architectural Patterns

**Three Supabase clients** are used for different contexts:
- `lib/supabase.ts` — browser client (public operations)
- `lib/supabase-server.ts` — server components and API routes
- `lib/supabase-admin.ts` — admin operations using service role key (bypasses RLS)

**Authentication flow**: Supabase Auth sessions → middleware refreshes tokens on each request → admin role checked via `profiles.role` column → `/admin/*` and `/api/admin/*` routes protected in `middleware.ts`.

**AuthContext** (`/src/contexts/AuthContext.tsx`) provides client-side user/profile state. The `profiles` table extends Supabase auth users with a `role` field (admin/user).

### Route Structure

- `/` — homepage with marketing sections
- `/products` — product catalog with filtering (brand, storage, grade, color)
- `/products/[id]` — product detail
- `/category/[slug]` — category pages
- `/cart` — shopping cart (Zustand store + server sync)
- `/checkout` — Stripe checkout flow → `/checkout/success`
- `/account/orders` — user order history
- `/account/loyalty` — loyalty points
- `/auth/login`, `/auth/register` — authentication pages
- `/admin/*` — protected admin panel (clients, products, orders management)

### Database Schema

Core tables: `profiles`, `products`, `cart_items`, `orders`, `order_items`, `loyalty_points`, `referral_codes`. Products have fields: brand, model, storage, grade, battery, price, images (array), stock, category.

Order statuses: `pending` → `processing` → `shipped` → `delivered`.

### Fluxitron Custom Store Connector

All endpoints under `/api/v1/` implement the Fluxitron Hub integration:
- **Auth**: API Key via `X-Api-Key` header, validated against `FLUXITRON_API_KEY` env var
- **Products**: CRUD + cursor pagination — 1 product = 1 variant (no multi-variant)
- **Prices/Stock**: Batch endpoints for bulk updates
- **Orders**: Read + status/tracking/notes updates, financial ↔ fulfillment status mapping
- **Categories**: CRUD with parent/child hierarchy
- **Webhooks**: `src/lib/fluxitron-webhook.ts` sends order events (create/update/cancel) to Hub
- **OpenAPI spec**: `public/openapi.yaml` — provide to Fluxitron for connector setup

Data mappers in `src/app/api/v1/_lib/mappers.ts` handle DB ↔ Fluxitron format conversion.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
FLUXITRON_API_KEY
FLUXITRON_WEBHOOK_URL
FLUXITRON_WEBHOOK_API_KEY
```

### Path Alias

`@/*` maps to `./src/*`.

### Language

The UI is in French. Use French for user-facing text, error messages, and labels.
