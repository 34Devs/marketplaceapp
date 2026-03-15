# VendorHub - Multi-Vendor Marketplace for Shopify

Turn any Shopify store into a fully-featured multi-vendor marketplace. Vendors can register, list products, manage orders, and receive payouts — all while the store owner earns commission on every sale.

## Features

- **Vendor Management** — Registration, approval workflow, profiles, and ratings
- **Product Sync** — Vendors create products that sync to Shopify via GraphQL API
- **Order Splitting** — Automatic vendor-level order breakdown with line item mapping
- **Commission Engine** — Cascade resolution: Product > Vendor > Plan > Store default
- **Payout System** — Stripe Connect + PayPal Payouts with minimum thresholds and scheduling
- **Subscription Plans** — Tiered vendor plans with product limits and commission overrides
- **Vendor Portal** — Full-featured vendor dashboard rendered within the store theme (App Proxy)
- **Admin Dashboard** — Polaris-based admin panel embedded in Shopify Admin
- **Analytics** — Revenue, vendor performance, and sales analytics with charts
- **Messaging** — Thread-based vendor ↔ admin communication
- **Reviews** — Customer-to-vendor review system (1-5 stars)
- **Theme Extension** — Vendor badge, profile card, and shop-by-vendor blocks
- **Multi-language** — i18n support (EN, TR, ES, FR, DE)
- **Audit Logging** — Full action trail for compliance

## Tech Stack

- **Framework**: [Remix](https://remix.run) (Shopify App Template)
- **Database**: PostgreSQL + [Prisma](https://prisma.io) ORM
- **UI**: [Shopify Polaris](https://polaris.shopify.com) (admin) + Custom CSS (portal)
- **Payments**: Stripe Connect + PayPal Payouts API
- **i18n**: remix-i18next
- **Testing**: Vitest
- **CI**: GitHub Actions

## Prerequisites

- Node.js >= 20.19
- Docker & Docker Compose (for local PostgreSQL + Redis)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- Shopify Partner account + development store

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start PostgreSQL and Redis
docker-compose up -d

# Setup environment
cp .env.example .env
# Edit .env with your database URL, Stripe/PayPal keys, etc.

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Seed demo data (optional)
npx prisma db seed

# Start development server
shopify app dev
```

## Demo Credentials

After seeding, you can log into the vendor portal with:

| Email | Password | Status |
|---|---|---|
| alice@techgadgets.com | demo1234 | Approved |
| bob@handmadegoods.com | demo1234 | Approved |
| carol@fitnessfirst.com | demo1234 | Pending |
| david@vintagevinyl.com | demo1234 | Approved |

## Project Structure

```
vendorhub/
├── app/
│   ├── components/         # UI components (admin, portal, shared)
│   ├── graphql/            # Shopify GraphQL mutations/queries
│   ├── i18n/               # i18next config + locale files
│   ├── lib/                # Server-side business logic
│   │   ├── commission.server.ts    # Commission calculation engine
│   │   ├── payout.server.ts        # Payout processing
│   │   ├── stripe.server.ts        # Stripe Connect integration
│   │   ├── paypal.server.ts        # PayPal Payouts API
│   │   ├── product-sync.server.ts  # Shopify product sync
│   │   ├── order-split.server.ts   # Order splitting engine
│   │   ├── vendor.server.ts        # Vendor CRUD + auth
│   │   └── ...
│   ├── routes/
│   │   ├── app.*            # Admin panel (Shopify embedded)
│   │   ├── portal.*         # Vendor portal (App Proxy)
│   │   ├── api.*            # API endpoints
│   │   ├── webhooks.*       # Shopify webhook handlers
│   │   └── storefront.*    # Public vendor pages
│   ├── db.server.ts
│   └── shopify.server.ts
├── extensions/
│   └── vendorhub-theme/    # Theme app extension (Liquid blocks)
├── prisma/
│   ├── schema.prisma       # Database schema (14 models)
│   └── seed.ts             # Demo seed data
├── tests/                  # Unit tests
├── docker-compose.yml      # PostgreSQL + Redis
└── shopify.app.toml        # Shopify app config
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Shopify CLI |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type check |
| `npx vitest run` | Run unit tests |
| `npm run deploy` | Deploy to Shopify |

## Deployment

### Docker (Fly.io recommended)

```bash
# Build and run with Docker
docker build -t vendorhub .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SHOPIFY_API_KEY="..." \
  -e SHOPIFY_API_SECRET="..." \
  vendorhub
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SHOPIFY_API_KEY` | Shopify app API key |
| `SHOPIFY_API_SECRET` | Shopify app secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PAYPAL_CLIENT_ID` | PayPal app client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal app secret |
| `SESSION_SECRET` | Cookie session encryption key |

## License

Private — 34Devs
