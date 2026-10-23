-- Database bootstrap reference. Provision a dedicated influvia_runtime LOGIN role before applying.
ALTER ROLE influvia_runtime SET search_path TO influvia, pg_catalog;
ALTER ROLE influvia_runtime SET statement_timeout TO '15s';
ALTER ROLE influvia_runtime SET lock_timeout TO '5s';
CREATE SCHEMA influvia;
REVOKE ALL ON SCHEMA influvia FROM PUBLIC, anon, authenticated;
SET search_path TO influvia, pg_catalog;
CREATE TABLE "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "company" text NOT NULL DEFAULT '',
  "created_at" bigint NOT NULL,
  "access_until" bigint,
  "access_source" text,
  "package_id" text,
  "email_verified" bigint NOT NULL DEFAULT 0,
  "owner_password_enabled" bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "accounts_email_unique" ON "accounts" ("email");
CREATE TABLE "audit" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "action" text NOT NULL,
  "details" text NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE TABLE "creators" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "city" text NOT NULL,
  "niche" text NOT NULL,
  "language" text NOT NULL,
  "instagram" text NOT NULL DEFAULT '',
  "youtube" text NOT NULL DEFAULT '',
  "facebook" text NOT NULL DEFAULT '',
  "followers" bigint NOT NULL,
  "engagement" double precision NOT NULL DEFAULT 0,
  "rate" bigint NOT NULL,
  "email" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "photo" text NOT NULL DEFAULT '',
  "updated_at" bigint NOT NULL,
  "region" text NOT NULL DEFAULT 'Telangana',
  "district" text NOT NULL DEFAULT 'Hyderabad',
  "accepts_free_collab" bigint NOT NULL DEFAULT 0,
  "bio" text NOT NULL DEFAULT ''
);
CREATE INDEX "creator_filters" ON "creators" ("city","niche","followers");
CREATE TABLE "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "amount" bigint NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL,
  "payment_id" text,
  "created_at" bigint NOT NULL,
  "paid_at" bigint,
  "access_until" bigint NOT NULL,
  "package_id" text,
  "provider" text NOT NULL DEFAULT 'razorpay',
  "mode" text NOT NULL DEFAULT 'live',
  "remote_id" text,
  "refunded_amount" bigint NOT NULL DEFAULT 0,
  "receipt_reference" text,
  FOREIGN KEY ("user_id") REFERENCES "accounts" ("id")
);
CREATE TABLE "auth_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "attempts" bigint NOT NULL,
  "expires_at" bigint NOT NULL
);
CREATE TABLE "credentials" (
  "user_id" text PRIMARY KEY NOT NULL,
  "password_hash" text NOT NULL,
  "salt" text NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "accounts" ("id")
);
CREATE TABLE "identities" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_id" text NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "accounts" ("id")
);
CREATE TABLE "oauth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "verifier" text NOT NULL,
  "expires_at" bigint NOT NULL
);
CREATE TABLE "packages" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "price" bigint NOT NULL,
  "search_limit" bigint,
  "result_limit" bigint,
  "active" bigint NOT NULL DEFAULT 1,
  "updated_at" bigint NOT NULL
);
CREATE TABLE "searches" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "filters" text NOT NULL,
  "result_limit" bigint,
  "is_paid" bigint NOT NULL,
  "month" text NOT NULL,
  "created_at" bigint NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "accounts" ("id")
);
CREATE INDEX "search_quota" ON "searches" ("user_id","month","is_paid");
CREATE TABLE "sessions" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "expires_at" bigint NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "accounts" ("id")
);
CREATE TABLE "owner_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "accepted_at" bigint,
  "revoked_at" bigint
);
CREATE UNIQUE INDEX "owner_invitations_token_hash_unique" ON "owner_invitations" ("token_hash");
CREATE TABLE "analytics_events" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "user_id" text,
  "kind" text NOT NULL,
  "path" text NOT NULL,
  "label" text NOT NULL DEFAULT '',
  "source" text NOT NULL DEFAULT 'Direct',
  "device" text NOT NULL DEFAULT 'desktop',
  "created_at" bigint NOT NULL
);
CREATE INDEX "analytics_session" ON "analytics_events" ("session_id","created_at");
CREATE INDEX "analytics_period" ON "analytics_events" ("created_at","kind");
CREATE TABLE "finance_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "amount" bigint NOT NULL,
  "currency" text NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "reference" text NOT NULL,
  "occurred_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "created_by" text NOT NULL,
  "voided_at" bigint
);
CREATE TABLE "payment_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "mode" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 0,
  "config" text NOT NULL,
  "sealed_secrets" text NOT NULL,
  "tested_at" bigint,
  "test_status" text,
  "updated_at" bigint NOT NULL,
  "updated_by" text NOT NULL
);
CREATE TABLE "payment_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL,
  "provider" text NOT NULL,
  "payment_id" text NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE INDEX "orders_user" ON "orders" ("user_id");
CREATE INDEX "sessions_user" ON "sessions" ("user_id");
CREATE INDEX "identities_user" ON "identities" ("user_id");
CREATE INDEX "orders_reports" ON "orders" ("mode","currency","created_at");
CREATE INDEX "finance_period" ON "finance_entries" ("currency","occurred_at");
CREATE INDEX "owner_invitation_email" ON "owner_invitations" ("email");
CREATE INDEX "analytics_user" ON "analytics_events" ("user_id","kind","created_at");
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "accounts" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "audit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "audit" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "creators" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "creators" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "orders" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "auth_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "auth_attempts" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "credentials" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "identities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "identities" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "oauth_states" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "packages" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "searches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "searches" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "sessions" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "owner_invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "owner_invitations" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "analytics_events" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "finance_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "finance_entries" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "payment_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "payment_connections" TO influvia_runtime USING (true) WITH CHECK (true);
ALTER TABLE "payment_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_access ON "payment_receipts" TO influvia_runtime USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA influvia TO influvia_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA influvia TO influvia_runtime;
