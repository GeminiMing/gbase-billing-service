# GBase Billing Service

Shared Stripe billing microservice for GBase apps. Supports Freemium model (Free/Pro/Enterprise).

## Quick Start

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Stripe keys and API keys

# 4. Run migrations
npm run db:generate
npm run db:migrate

# 5. Start dev server
npm run dev
```

## API

All `/api/billing/*` routes require `X-API-Key` header.

### POST /api/billing/checkout

Create a Stripe Checkout Session for upgrading to a paid plan.

```bash
curl -X POST http://localhost:3100/api/billing/checkout \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gbase_sk_app1_xxxxx" \
  -d '{
    "app_id": "app1",
    "user_id": "user_123",
    "plan": "pro",
    "success_url": "https://app1.example.com/billing?success=true",
    "cancel_url": "https://app1.example.com/billing?canceled=true"
  }'
```

Response: `{ "checkout_url": "https://checkout.stripe.com/..." }`

### POST /api/billing/portal

Create a Stripe Customer Portal session for self-service subscription management.

```bash
curl -X POST http://localhost:3100/api/billing/portal \
  -H "Content-Type: application/json" \
  -H "X-API-Key: gbase_sk_app1_xxxxx" \
  -d '{
    "app_id": "app1",
    "user_id": "user_123",
    "return_url": "https://app1.example.com/settings"
  }'
```

Response: `{ "portal_url": "https://billing.stripe.com/..." }`

### GET /api/billing/subscription

Query current subscription status. Returns `free` plan if no subscription exists.

```bash
curl "http://localhost:3100/api/billing/subscription?app_id=app1&user_id=user_123" \
  -H "X-API-Key: gbase_sk_app1_xxxxx"
```

Response: `{ "plan": "pro", "status": "active", "current_period_end": "2026-04-25T00:00:00.000Z" }`

### POST /api/webhooks/stripe

Stripe webhook endpoint (no API key required — verified by Stripe signature).

Configure in Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://your-domain.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

## Adding a New App

1. Create a Product + Prices in [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Add the Price IDs to `src/lib/plans.ts`:
   ```typescript
   export const APP_PLANS = {
     "your-app": {
       pro: "price_xxx",
       enterprise: "price_yyy",
     },
   };
   ```
3. Add an API key to `.env`:
   ```
   API_KEYS=your-app:gbase_sk_yourapp_xxxxx
   ```
4. Restart the service

## Deploy

```bash
# Build Docker image
docker build -t gbase-billing-service .

# Run
docker run -p 3100:3100 --env-file .env gbase-billing-service
```

Works with Fly.io, Railway, Render, or any Docker host.
