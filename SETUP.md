# RecipeExtractor — Setup Guide

## Stack
- **Frontend + Backend**: Next.js 15 (App Router, API routes)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v4 (email/password, JWT sessions)
- **Payments**: Stripe (subscription billing)
- **AI Extraction**: OpenAI GPT-4o-mini (with schema.org JSON-LD fast path)
- **Scraping**: `cheerio` for HTML parsing
- **Styling**: Tailwind CSS

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```
Then fill in your values in `.env.local` (see below).

### 3. Set up the database
```bash
# Push schema to your PostgreSQL database
npm run db:push

# (Optional) Open Prisma Studio to inspect data
npm run db:studio
```

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Required
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |

### OpenAI (for AI fallback extraction)
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key (sk-...) |

> **Note**: Many popular recipe sites (AllRecipes, Food Network, etc.) use schema.org markup, so the app will work without OpenAI for those. OpenAI is only needed for sites without structured data.

### Stripe (for subscriptions)
| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Your Stripe secret key (sk_test_...) |
| `STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key (pk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | Price ID for Premium plan |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Price ID for Pro monthly plan |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Price ID for Pro yearly plan |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same as publishable key (exposed to client) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

### Setting up Stripe
1. Create a [Stripe account](https://stripe.com)
2. In the Stripe dashboard → Products, create two products:
   - **Premium** — $4.99/month recurring → copy the Price ID
   - **Pro** — $9.99/month + optional $99/year → copy the Price IDs
3. Paste the Price IDs into `.env.local`
4. For webhooks locally, install the Stripe CLI and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home page
│   ├── login/page.tsx              # Sign in
│   ├── signup/page.tsx             # Register
│   ├── dashboard/page.tsx          # User dashboard
│   ├── pricing/page.tsx            # Pricing page
│   ├── recipe/[id]/page.tsx        # Single recipe view
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handler
│       ├── auth/register/          # POST /api/auth/register
│       ├── extract/                # POST /api/extract
│       ├── recipes/                # GET /api/recipes
│       ├── recipes/[id]/           # GET/DELETE /api/recipes/:id
│       ├── user/usage/             # GET /api/user/usage
│       └── stripe/
│           ├── create-checkout/    # POST — create Stripe checkout
│           ├── portal/             # POST — Stripe billing portal
│           └── webhook/            # POST — Stripe events
├── components/
│   ├── Header.tsx
│   ├── RecipeExtractor.tsx         # URL input + extraction UI
│   ├── RecipeResult.tsx            # Rendered recipe (ingredients + steps)
│   ├── RecipeCard.tsx              # Saved recipe list item
│   └── UsageCounter.tsx            # Monthly usage progress bar
├── lib/
│   ├── auth.ts                     # NextAuth config
│   ├── prisma.ts                   # Prisma client singleton
│   ├── stripe.ts                   # Stripe client + plan config
│   ├── recipe-extractor.ts         # Scraper + AI extractor
│   └── usage.ts                    # Tier limits + counter logic
└── types/
    └── next-auth.d.ts              # Session type augmentation
prisma/
└── schema.prisma                   # DB schema (User, Recipe, Subscription)
```

---

## Access Tiers

| Feature | Free | Premium | Pro |
|---|---|---|---|
| Extractions/month | 1 (guest) | 10 | Unlimited |
| Save history | ✗ | ✓ | ✓ |
| Saved recipe limit | — | Unlimited | Unlimited |
| Price | $0 | $4.99/mo | $9.99/mo |

---

## Deployment (Vercel + Supabase)

1. Push your code to GitHub
2. Create a [Supabase](https://supabase.com) project — copy the connection string
3. Import the repo on [Vercel](https://vercel.com)
4. Add all environment variables in Vercel project settings
5. Set `NEXTAUTH_URL` to your production domain
6. Run `npm run db:push` once against your production DB:
   ```bash
   DATABASE_URL="your-prod-url" npx prisma db push
   ```
7. Add your production URL to Stripe's webhook endpoints in the dashboard

---

## Development Notes

- Extraction uses a two-step strategy:
  1. Parse `schema.org/Recipe` JSON-LD from the page (fast, free, works on most major recipe sites)
  2. If no structured data found, fall back to OpenAI GPT-4o-mini with the page text
- Guest extractions are tracked in-memory per IP (resets on server restart). For production, consider Redis.
- Monthly usage counters reset automatically when a new calendar month begins.
