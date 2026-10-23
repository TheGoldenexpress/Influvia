# INFLUVIA

Influencer discovery, paid search access and filtered Excel exports. Built with Next.js, React, Three.js, GSAP and a private Supabase Postgres database; deployed on Vercel.

Customers register for free. Free searches return at most ten redacted profiles. Paid packages unlock contact information and Excel downloads, with the owner's configured monthly search and result limits. The portal does not send messages to influencers.

Owners sign in at `/owner/login` using an invited email and password. The admin studio manages creators, Excel imports, accounts, packages, payment connections, finance records and visitor analytics. Google and Facebook login require their provider app credentials. Existing password authentication is retained in private application tables; this deployment does not silently switch users to Supabase Auth.

## Hosting and data

- GitHub: `TheGoldenexpress/Influvia`
- Vercel project: `influvia`
- Supabase project: `xzvlqswqyonbmmuomkxm`
- Production tables: private `influvia` schema. Test fixtures: separate `influvia_qa` schema and restricted role.
- Browser requests go through authenticated Next.js API handlers. Protected tables are not exposed to anonymous or authenticated Supabase Data API clients.

The database transport in `supabase/functions/influvia-database` authenticates a server-only credential, then connects as a dedicated Postgres role with access only to its application schema. It does not use the Supabase administrator password or service-role key for application queries. `verify_jwt` is disabled because this endpoint validates its own high-entropy credential before opening a database connection. The committed credential map contains SHA-256 fingerprints, not usable passwords.

`db/postgres-compat.mjs` retains the existing Drizzle query builders while translating the small SQLite dialect surface used by this app. Data is stored in native Postgres tables. Bound values stay separate from SQL. Each write or batch executes in a serializable transaction; serialization failures retry the complete transaction. Do not introduce unsupported dialect features or interactive `db.transaction()` calls without extending and testing this adapter. Use `db.batch()` for atomic operations.

The Edge transport is invoked in Tokyo near the project's database. Explicit regional invocation has no automatic regional failover. Request-owned database connections are closed after each call to avoid reusing sockets after an Edge isolate sleeps. The role's default schema, statement timeout and lock timeout must be maintained when rotating or recreating runtime roles.

`supabase/schema.sql` is a bootstrap reference, not a command to rerun against an existing project. Apply future reviewed changes through versioned Supabase migrations. Keep RLS enabled and schema grants restricted to the corresponding server role. Never grant browser roles access to credentials, contacts, sessions, invitations or finance tables.

## Runtime configuration

Use Node.js 24. Install with `npm ci`, run `npm run dev`, and build with `npm run build`. Local environment files and generated output are ignored by Git.

Set these variables only on the server, as encrypted Vercel environment values:

- `INFLUVIA_DATABASE_URL`: the project's `influvia-database` function URL.
- `INFLUVIA_DATABASE_TOKEN`: generated dedicated-role password matching the deployed credential fingerprint. Production and preview must use their respective schemas and roles.
- `OWNER_EMAILS`: comma-separated owner allowlist. A matching email alone never grants owner access; invitation activation is also required.
- `PAYMENT_CONFIG_KEY`: 32 random bytes encoded as 64 hexadecimal characters. Keep the same key on hosts that share payment connections. Preserve it securely; changing it without re-encrypting existing connections makes their saved secrets unreadable.

Optional Google/Facebook OAuth client IDs and secrets are named in `.env.example`. Register callback URLs for the final website hostname before enabling those providers. Payment API credentials are entered through the owner payment settings and encrypted at rest. No payment provider is enabled automatically by deployment.

The GitHub main branch is the Vercel production source. Review commits and run checks before publishing. Configure secrets before deploying; never commit `.env`, private invitation links, database exports, session cookies or runtime credentials.

## Verification

`npm test` runs unit tests covering paywalls, filtering, Excel safety, sample records and the SQL transport. API suites in `tests/*-api.mjs` run against a local app connected to the isolated QA schema. They require an explicit `INFLUVIA_QA_OWNER_COOKIE` obtained through normal owner password login. Invitation fixture mutations additionally require `INFLUVIA_QA_DATABASE_URL` and `INFLUVIA_QA_DATABASE_TOKEN`; the test helper verifies the QA schema and role before changing any data.

Live payment credentials are not included. Automated commerce checks use manual UPI fixtures and authenticated automation fixtures; they do not charge money or prove that a merchant's future live API credentials work. Native API providers must pass their connection test in the owner panel before being enabled. Finance refund entries record refunds already processed externally; they do not issue a gateway refund.
