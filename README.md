# MoGrillz Ops

MoGrillz Ops is the private admin app for the MoGrillz always-open, pickup-first business. It opens to an operations-first dashboard and expands into orders, inventory, menu controls, customers, analytics, and AI insights.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Run `supabase/seed.sql` if you want the starter demo data.
4. Copy `.env.example` to `.env.local` for local work, then set these values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_USE_MOCK_DATA=false
```

5. Start the app with `npm run dev`.

## First Admin

Use the server-only bootstrap script to create or invite the first founder account and attach it to `admin_memberships`:

```bash
npm run admin:create -- --email you@example.com --name "Chef Mo" --mode create --password "temporary-or-final-password"
```

If you omit `--password`, the script falls back to an invite flow instead of creating the password-based login directly.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Security Model

The app uses Supabase Row Level Security so only authenticated admins can read or modify ops data. The bootstrap script is intended to run on a trusted machine or server with the service role key available.
