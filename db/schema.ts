import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  accessUntil: integer("access_until"),
  accessSource: text("access_source"),
  packageId: text("package_id"),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  ownerPasswordEnabled: integer("owner_password_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
});
export const creators = sqliteTable(
  "creators",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    niche: text("niche").notNull(),
    language: text("language").notNull(),
    instagram: text("instagram").notNull().default(""),
    youtube: text("youtube").notNull().default(""),
    facebook: text("facebook").notNull().default(""),
    followers: integer("followers").notNull(),
    engagement: real("engagement").notNull().default(0),
    rate: integer("rate").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    photo: text("photo").notNull().default(""),
    updatedAt: integer("updated_at").notNull(),
    region: text("region").notNull().default("Telangana"),
    district: text("district").notNull().default("Hyderabad"),
    acceptsFreeCollab: integer("accepts_free_collab", { mode: "boolean" })
      .notNull()
      .default(false),
    bio: text("bio").notNull().default(""),
  },
  (t) => [index("creator_filters").on(t.city, t.niche, t.followers)],
);
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => accounts.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  paymentId: text("payment_id"),
  createdAt: integer("created_at").notNull(),
  paidAt: integer("paid_at"),
  accessUntil: integer("access_until").notNull(),
  packageId: text("package_id"),
  provider: text("provider").notNull().default("razorpay"),
  mode: text("mode").notNull().default("live"),
  remoteId: text("remote_id"),
  refundedAmount: integer("refunded_amount").notNull().default(0),
  receiptReference: text("receipt_reference"),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  searchLimit: integer("search_limit"),
  resultLimit: integer("result_limit"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
});
export const searches = sqliteTable(
  "searches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => accounts.id),
    filters: text("filters").notNull(),
    resultLimit: integer("result_limit"),
    isPaid: integer("is_paid", { mode: "boolean" }).notNull(),
    month: text("month").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("search_quota").on(t.userId, t.month, t.isPaid)],
);
export const credentials = sqliteTable("credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => accounts.id),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
});
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => accounts.id),
  expiresAt: integer("expires_at").notNull(),
});
export const identities = sqliteTable("identities", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => accounts.id),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
});
export const authAttempts = sqliteTable("auth_attempts", {
  id: text("id").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const oauthStates = sqliteTable("oauth_states", {
  state: text("state").primaryKey(),
  provider: text("provider").notNull(),
  verifier: text("verifier").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const ownerInvitations = sqliteTable("owner_invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  acceptedAt: integer("accepted_at"),
  revokedAt: integer("revoked_at"),
});

export const paymentConnections = sqliteTable("payment_connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  mode: text("mode").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  config: text("config").notNull(),
  sealedSecrets: text("sealed_secrets").notNull(),
  testedAt: integer("tested_at"),
  testStatus: text("test_status"),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});
export const paymentReceipts = sqliteTable("payment_receipts", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  provider: text("provider").notNull(),
  paymentId: text("payment_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const financeEntries = sqliteTable("finance_entries", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  reference: text("reference").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  voidedAt: integer("voided_at"),
});
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    path: text("path").notNull(),
    label: text("label").notNull().default(""),
    source: text("source").notNull().default("Direct"),
    device: text("device").notNull().default("desktop"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("analytics_period").on(t.createdAt, t.kind),
    index("analytics_session").on(t.sessionId, t.createdAt),
  ],
);
