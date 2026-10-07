# Meridian

Property listings for Lagos on a live map. Agents post a listing once; buyers filter a map of Lekki, Ikoyi, Victoria Island, Ikeja and Yaba, see the total cost to move in, and WhatsApp the agent.

Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Neon Postgres with PostGIS · Drizzle · Better Auth · MapLibre GL with OpenFreeMap tiles · Cloudinary · Resend with React Email · Vercel Cron.

## Run it locally

You need Node 22 and Postgres 16 with PostGIS.

```bash
npm install                      # also copies the MapLibre worker into public/maplibre
cp .env.example .env.local       # the defaults work against a local database
createdb meridian && psql meridian -c "CREATE EXTENSION postgis;"
npm run db:migrate
npm run db:seed                  # 5 areas, 4 demo agents, ~40 sample listings
npm run dev
```

Open http://localhost:3000. On the For agents page, **Try the agent dashboard** signs you in as the demo agent (`adaeze@demo.meridian.ng` / `meridian-demo`). The demo buyer is `buyer@demo.meridian.ng` with the same password.

Admins are set in the database. Sign up, then:

```bash
npm run make-admin -- you@example.com
```

## Services and keys

Every external service is optional in development. Without its keys, a service falls back to a local stand-in:

| Service | Keys | Without keys |
| --- | --- | --- |
| Database | `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (migrations) | Local Postgres |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | A development secret (never use it in production) |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google button is hidden |
| Images | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Files saved under `public/uploads` (ID documents under `.private-uploads`). **Doesn't work on Vercel.** |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Emails are printed to the server log |
| Cron | `CRON_SECRET` | `dev-cron-secret` |
| Map tiles | `NEXT_PUBLIC_MAP_STYLE_URL` | OpenFreeMap Positron, recoloured in `src/components/map/maplibre.ts` |
| Demo mode | `DEMO_MODE` (`on`/`off`) | `on` |

Google sign-in: add `https://<your-domain>/api/auth/callback/google` as an authorised redirect URI.

## Deploy (Vercel + Neon)

1. Create a Neon project. Use a **development branch** for seed data so it never touches production. On each branch, run `CREATE EXTENSION postgis;` before the first migration.
2. Import this repository into Vercel. Set every key from the table above, plus `NEXT_PUBLIC_SITE_URL` (your domain, used in emails and share links).
3. Run migrations against the unpooled URL: `DATABASE_URL_UNPOOLED=... npm run db:migrate`.
4. Seed the database (`npm run db:seed`, which refuses a Neon URL without `--yes`). If you want the demo live, keep `DEMO_MODE=on`.
5. Crons are in `vercel.json`, all times UTC (Lagos is UTC+1):
   - `alerts` at 06:00: saved-search emails.
   - `expiry` at 05:30: expires listings, sends 5-day reminders, deletes ID documents 30 days after a decision.
   - `demo-reset` at 02:00: reseeds the demo data.

   Vercel sends `Authorization: Bearer $CRON_SECRET`.

Check the current free-tier limits for Neon, Cloudinary, Resend and Vercel Cron before launch; they change.

**At launch:** set `DEMO_MODE=off` and run `npm run db:purge-demo` to delete every `is_demo` row.

## Tests

```bash
npm test                         # unit and database tests (Vitest, uses the meridian_test database)
npm run test:e2e                 # Playwright, against a running dev server
```

The database tests need a `meridian_test` database with PostGIS; they migrate and seed it themselves. To run Playwright with a Chromium already installed on the machine, set `PW_CHROMIUM_PATH`.

## How it's put together

- `src/db/schema.ts`: the twelve tables from the build brief plus Better Auth's. Points are PostGIS `geometry(Point, 4326)` with GiST indexes.
- `src/server/search.ts`: one query feeds both the pins (up to 200 in the map bounds) and the list (pages of 20). Only `public_location` is ever selected; the exact pin never leaves the server.
- `src/lib/listing-schema.ts`: one Zod schema per form step, shared by the browser and the server action.
- `src/server/jobs.ts`: alerts, expiry and cleanup as plain functions, called by `src/app/api/cron/[job]`.
- `src/lib/listing-rules.ts`: total upfront cost, the 150 m public offset, expiry and approval rules.

### Rules worth knowing

- Total upfront = yearly rent + agency fee + legal fee + caution deposit + service charge. It's stored, so it can be filtered.
- An agent's first three listings go to the admin queue; after three approvals, listings publish immediately.
- Listings expire 30 days after publishing or renewing. The reminder email's "Still available" link is signed and works without signing in.
- Three unresolved reports hide a listing until an admin reviews it.
- Demo agents work in a sandbox: anything they create or edit is never in public search, and it resets nightly.
- Sign-in and sign-up are rate-limited in production, with counters in Postgres (`rate_limit`) so the limit holds across serverless instances. Running the end-to-end suite twice in quick succession against a production build can trip it.
- The role is cached in the session cookie for 60 seconds, so a suspension can take up to a minute to bite. The suspended agent's listings come down immediately.
