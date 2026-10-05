# Reisin Race Hub

Team sales and runner registration for Reisin races (Sal a Valle, Baja Crossing). Built on the same stack as Optimist Vendors (`optimist-vendor-tracker`), so it deploys the same way.

- **Portal** (`/`, public): captains buy a team and get a **captain code** (e.g. `SAV-7K2QX`), then set a **team password**. Runners pick their team, enter the password, fill in their details, accept the waiver and pay if there's a fee. Each runner gets the next bib number.
- **Admin** (`/admin`, login): create races, see teams, runners and payments per race, edit anything, add teams sold offline, mark offline payments, reset captain codes and team passwords, export runners to CSV, manage staff logins.
- Spanish by default, English toggle on every screen.

## Tech stack

Same as Optimist Vendors: Next.js 14 (App Router) + TypeScript, **Postgres** via `pg` (`DATABASE_URL`), Tailwind, and the same lightweight email/password login (JWT session cookie signed with `SESSION_SECRET`). Tables are created automatically on first request (`src/lib/db.ts`, `ensureSchema`).

Payments: **Stripe Checkout** in MXN. Until `STRIPE_SECRET_KEY` is set, checkout runs in **test mode** (a simulated card form, no money moves), so the whole flow works from day one.

Captains and runners never log in. The portal gives them short-lived signed, httpOnly cookies (`src/lib/team-session.ts`), the same idea as the public check-in door link in Optimist Vendors. Team passwords are stored as bcrypt hashes.

## Deploy (same as Optimist Vendors)

1. **GitHub**: create an empty private repo `reisin-app` under `rafarivero23`, then from this folder:
   ```bash
   git remote add origin https://github.com/rafarivero23/reisin-app.git
   git push -u origin main
   ```
2. **Vercel** → team **OPTIMIST** → *Add New → Project* → import `reisin-app`. Framework is detected as Next.js; no build settings to change.
3. **Database**: in the Vercel project, *Storage → Create Database → Neon (Postgres)*. Vercel adds `DATABASE_URL` for you. Use the **pooled** connection string. You can also reuse the same Neon account as Optimist Vendors with a new database.
4. **Environment variables** (Vercel → Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | added by step 3 |
   | `SESSION_SECRET` | `openssl rand -base64 48` |
   | `STRIPE_SECRET_KEY` | optional, leave empty for test mode |
   | `STRIPE_WEBHOOK_SECRET` | optional, see Stripe below |
5. **Redeploy**, then create the first admin login from your laptop:
   ```bash
   npm install
   DATABASE_URL="<the Neon URL>" SEED_ADMIN_PASSWORD="<pick one>" npm run db:seed
   ```
   Log in at `https://<your-domain>/login` and add the rest of the team under **Equipo Reisin**.

Commits must be authored with the email on your Vercel account (`rr@optimistinc.mx`), or Vercel's Hobby plan blocks the deploy ("not a member of the team"). This repo is already set up that way.

## Stripe (when you're ready to charge)

1. Add `STRIPE_SECRET_KEY` in Vercel (`sk_test_…` first, `sk_live_…` later).
2. Stripe → *Developers → Webhooks → Add endpoint*: `https://<your-domain>/api/stripe/webhook`, event `checkout.session.completed`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Redeploy.

## Daily use

1. **Admin → Nueva carrera**: name, brand, date, venue, team price, runner fee (0 if included in the team price), runners per team, team capacity, categories, first bib number, waiver text. Set status to **Abierta** to show it in the portal.
2. Share the portal link (`https://<your-domain>/`, or the race link on the race's *Resumen* tab).
3. Team sold by transfer or invoice? **Agregar equipo** in the admin, mark it paid, and send the captain their **código de capitán**. They use it under **Soy capitán** to set the team password.
4. Captains share the join link and team password with their runners.

## Running locally

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and SESSION_SECRET
npm run db:seed           # tables + first admin login
npm run dev
```

## Notes

- Team capacity counts paid teams, teams added in the admin, and checkouts started in the last 30 minutes (so two people can't buy the last spot). Abandoned checkouts free their spot after 30 minutes and never show in the admin.
- Bibs are assigned in order from the race's first bib number. A unique index stops two runners from getting the same number. Admins can change a bib by editing the runner.
- Deleting a race deletes its teams and runners. Deleting a team deletes its runners.
