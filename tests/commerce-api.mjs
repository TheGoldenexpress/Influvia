import { qaOwnerCookie } from "./qa-session.mjs";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
const origin = "http://127.0.0.1:5173",
  owner = qaOwnerCookie(),
  tag = Date.now();
let checks = 0;
const check = (v, label) => {
  assert.ok(v, label);
  console.log(`PASS ${++checks}: ${label}`);
};
async function request(path, cookie = "", data, headers = {}) {
  return fetch(`${origin}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(data === undefined
        ? {}
        : { Origin: origin, "Content-Type": "application/json" }),
      ...headers,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
async function ok(r) {
  const b = await r.json();
  assert.ok(r.ok, `${r.status}: ${JSON.stringify(b)}`);
  return b;
}
function cookie(r) {
  return r.headers.get("set-cookie")?.split(";")[0] || "";
}
async function user(label, visit = "") {
  if (!visit) {
    const r = await request("analytics/event", "", {
      id: crypto.randomUUID(),
      kind: "page_view",
      path: "/",
      source: "qa",
    });
    await ok(r);
    visit = cookie(r);
  }
  const email = `commerce-${label}-${tag}@influvia.test`;
  const r = await request("auth/register", visit, {
    email,
    name: `Commerce ${label}`,
    password: "Commerce-preview-123",
  });
  await ok(r);
  return { cookie: [cookie(r), visit].filter(Boolean).join("; "), email };
}
await ok(await request("me", owner));
const original = await ok(await request("owner/overview", owner));
const packageId = "commerce-qa";
await ok(
  await request("owner/packages", owner, {
    packages: [
      ...original.packages
        .filter((p) => p.id !== packageId)
        .map((p) => ({ ...p, active: p.active ?? true })),
      {
        id: packageId,
        name: "Commerce QA",
        description: "Local commerce test",
        price: 1999,
        searchLimit: 10,
        resultLimit: 200,
        active: true,
      },
    ],
  }),
);
const settings = await ok(await request("owner/payments", owner));
check(settings.catalog.length === 15, "15 provider options available to owner");
for (const p of [
  "owner/payments",
  "owner/finance",
  "owner/finance/export",
  "owner/analytics",
  "owner/analytics/export",
])
  check((await request(p)).status === 401, `anonymous ${p} rejected`);
const visitor = await request("analytics/event", "", {
  id: crypto.randomUUID(),
  kind: "page_view",
  path: "/",
  source: "qa",
  label: "",
});
await ok(visitor);
const visit = cookie(visitor);
check(
  visit.startsWith("influvia_visit="),
  "anonymous analytics issues a session visit cookie",
);
const alice = await user("alice", visit),
  bob = await user("bob"),
  carol = await user("carol");
check(
  (await request("owner/payments", alice.cookie)).status === 403,
  "customer cannot read payment credentials",
);
check(
  (await request("owner/finance", alice.cookie)).status === 403,
  "customer cannot read finance records",
);
check(
  (await request("payments/options?mode=test", alice.cookie)).status === 403,
  "test checkout options restricted to owners",
);
check(
  (
    await request("analytics/event", visit, {
      id: crypto.randomUUID(),
      kind: "purchase",
      path: "/billing",
    })
  ).status === 400,
  "client cannot forge purchase analytics",
);
const dnt = await ok(
  await request(
    "analytics/event",
    "",
    { id: crypto.randomUUID(), kind: "page_view", path: "/" },
    { DNT: "1" },
  ),
);
check(dnt.skipped, "Do Not Track is respected");
const preference = await request("analytics/preference", visit, {
  enabled: false,
});
await ok(preference);
check(
  preference.headers.get("set-cookie").includes("influvia_analytics=off"),
  "analytics preference is enforced by a server cookie",
);
check(
  (
    await ok(
      await request("analytics/event", visit + "; influvia_analytics=off", {
        id: crypto.randomUUID(),
        kind: "page_view",
        path: "/",
      }),
    )
  ).skipped,
  "server skips opted-out events even with an existing visit cookie",
);
const adminEvent = await ok(
  await request("analytics/event", owner, {
    id: crypto.randomUUID(),
    kind: "page_view",
    path: "/owner",
  }),
);
check(adminEvent.skipped, "owner page activity is excluded");
const base = {
  currency: "INR",
  methods: ["upi"],
  fields: { upiId: "commerce-test@bank", payeeName: "Local QA" },
  mappings: [{ packageId, amountMinor: null, checkoutUrl: "", productId: "" }],
  fulfillment: "manual",
  instructions: "Local QA only",
};
const save = (provider, mode, config, enabled = false, secrets = {}) =>
  request("owner/payments/save", owner, {
    provider,
    mode,
    config,
    enabled,
    secrets,
    clearSecrets: [],
  });
check(
  (
    await save(
      "upi",
      "live",
      { ...base, fields: { upiId: "invalid", payeeName: "QA" } },
      true,
    )
  ).status === 400,
  "invalid UPI ID cannot be enabled",
);
check(
  (
    await request(
      "owner/payments/save",
      owner,
      { provider: "upi", mode: "live", config: base, enabled: true },
      { Origin: "https://other.invalid" },
    )
  ).status === 403,
  "cross-origin payment configuration rejected",
);
await ok(await save("upi", "live", base, true));
const options = await ok(await request("payments/options"));
check(
  options.options.some((o) => o.provider === "upi" && o.mode === "live"),
  "configured live UPI is offered in customer checkout",
);
const aorder = await ok(
  await request("payments/order", alice.cookie, { provider: "upi", packageId }),
);
check(
  aorder.amount === 199900 &&
    aorder.type === "manual" &&
    aorder.url.startsWith("upi://pay?"),
  "UPI order uses server package amount and produces app link",
);
check(
  !(await ok(await request("me", alice.cookie))).account.paid,
  "creating an order does not unlock access",
);
check(
  (
    await ok(
      await request("payments/instructions", alice.cookie, {
        orderId: aorder.orderId,
      }),
    )
  ).upiId === "commerce-test@bank",
  "payment instructions can be reopened after a page refresh",
);
check(
  (
    await request("payments/receipt", bob.cookie, {
      orderId: aorder.orderId,
      reference: "fake-123",
    })
  ).status === 404,
  "another customer cannot claim the order",
);
await ok(
  await request("payments/receipt", alice.cookie, {
    orderId: aorder.orderId,
    reference: "QA-UTR-123",
  }),
);
check(
  !(await ok(await request("me", alice.cookie))).account.paid,
  "a submitted UTR never automatically unlocks access",
);
await ok(
  await request("owner/finance/reconcile", owner, {
    orderId: aorder.orderId,
    action: "approve",
    paymentId: `qa-paid-${tag}`,
    reason: "Verified local test bank fixture",
  }),
);
const me = await ok(await request("me", alice.cookie));
check(
  me.account.paid && me.account.packageId === packageId,
  "owner verified receipt grants the mapped live package",
);
const bOrder = await ok(
  await request("payments/order", bob.cookie, { provider: "upi", packageId }),
);
check(
  (
    await request("owner/finance/reconcile", owner, {
      orderId: bOrder.orderId,
      action: "approve",
      paymentId: `qa-paid-${tag}`,
      reason: "Duplicate local receipt should fail",
    })
  ).status === 409,
  "one receipt cannot activate a different order",
);
check(
  !(await ok(await request("me", bob.cookie))).account.paid,
  "duplicate receipt leaves second customer locked",
);
await ok(await save("upi", "test", base, true));
const tOrder = await ok(
  await request("payments/order", owner, {
    provider: "upi",
    mode: "test",
    packageId,
  }),
);
await ok(
  await request("owner/finance/reconcile", owner, {
    orderId: tOrder.orderId,
    action: "approve",
    paymentId: `qa-test-${tag}`,
    reason: "Verified local test fixture only",
  }),
);
check(
  (
    await request("payments/order", bob.cookie, {
      provider: "upi",
      mode: "test",
      packageId,
    })
  ).status === 403,
  "customers cannot create test orders",
);
const ownerAfter = await ok(await request("me", owner));
check(
  !ownerAfter.account.paid || ownerAfter.account.packageId !== packageId,
  "test payment never grants a real package",
);
const fakeSecret = `qa-secret-never-returned-${tag}`;
const razor = {
  ...base,
  methods: ["card", "upi"],
  fields: { keyId: "rzp_test_qa123" },
  fulfillment: "manual",
};
await ok(
  await save("razorpay", "test", razor, false, {
    keySecret: fakeSecret,
    webhookSecret: "qa-webhook-secret",
  }),
);
const masked = await ok(await request("owner/payments", owner));
check(
  !JSON.stringify(masked).includes(fakeSecret) &&
    masked.connections
      .find((c) => c.provider === "razorpay")
      .secretFields.includes("keySecret"),
  "owner settings report saved credential fields without exposing secret values",
);
check(
  (await save("razorpay", "test", razor, true)).status === 400,
  "native API checkout requires credential validation before enable",
);
check(
  (await save("razorpay", "live", razor, false)).status === 400,
  "test key cannot be configured in live mode",
);
const hosted = {
  ...base,
  methods: ["card"],
  fields: {},
  mappings: [
    {
      packageId,
      amountMinor: 199900,
      checkoutUrl: "https://attacker.invalid/pay",
      productId: "qa",
    },
  ],
};
check(
  (await save("gumroad", "live", hosted, true)).status === 400,
  "hosted checkout URL restricted to provider domain",
);
check(
  (
    await save(
      "gumroad",
      "live",
      {
        ...hosted,
        currency: "USD",
        mappings: [
          {
            ...hosted.mappings[0],
            amountMinor: null,
            checkoutUrl: "https://qa.gumroad.com/l/test",
          },
        ],
      },
      true,
    )
  ).status === 400,
  "international package requires explicit currency amount",
);
const superConfig = {
  ...hosted,
  mappings: [
    {
      ...hosted.mappings[0],
      checkoutUrl: "https://superprofile.bio/qa-checkout",
    },
  ],
  fulfillment: "bridge",
};
await ok(await save("superprofile", "live", superConfig));
const secret = await ok(
  await request("owner/payments/bridge-secret", owner, {
    provider: "superprofile",
    mode: "live",
  }),
);
check(
  /^[a-f0-9]{64}$/.test(secret.token),
  "authenticated automation secret generated for owner",
);
await ok(await save("superprofile", "live", superConfig, true));
const cOrder = await ok(
  await request("payments/order", carol.cookie, {
    provider: "superprofile",
    packageId,
  }),
);
const bridgeBody = {
  orderId: cOrder.orderId,
  paymentId: `super-qa-${tag}`,
  amountMinor: 199900,
  currency: "INR",
  status: "paid",
};
check(
  (await request("payments/bridge/superprofile/live", "", bridgeBody))
    .status === 401,
  "automation bridge rejects missing authentication",
);
check(
  (
    await request(
      "payments/bridge/superprofile/live",
      "",
      { ...bridgeBody, amountMinor: 1 },
      { Authorization: `Bearer ${secret.token}` },
    )
  ).status === 400,
  "automation cannot confirm the wrong payment amount",
);
await ok(
  await request("payments/bridge/superprofile/live", "", bridgeBody, {
    Authorization: `Bearer ${secret.token}`,
  }),
);
const first = await ok(await request("me", carol.cookie));
check(
  first.account.paid,
  "authenticated exact-match automation activates the package",
);
await ok(
  await request("payments/bridge/superprofile/live", "", bridgeBody, {
    Authorization: `Bearer ${secret.token}`,
  }),
);
check(
  (await ok(await request("me", carol.cookie))).account.accessUntil ===
    first.account.accessUntil,
  "automation replay does not extend membership",
);
check(
  (await request("payments/webhook/stripe/live", "", {})).status === 401,
  "unconfigured Stripe webhook cannot grant access",
);
check(
  (await request("payments/webhook/razorpay/test", "", {})).status === 400,
  "forged Razorpay webhook rejected",
);
await ok(
  await request("owner/finance/entry", owner, {
    kind: "expense",
    amount: 25000,
    currency: "INR",
    category: "Hosting",
    description: "=QA literal formula text",
    reference: `QA-INV-${tag}`,
    date: new Date(Date.now() + 19800000).toISOString().slice(0, 10),
  }),
);
const finance = await ok(await request("owner/finance?currency=INR", owner));
check(
  finance.summary.collected >= 399800 &&
    finance.entries.some((e) => e.reference === `QA-INV-${tag}`),
  "finance aggregates confirmed live payments and book entries",
);
const testFinance = await ok(await request("owner/finance?mode=test", owner));
check(
  testFinance.entries.length === 0 && testFinance.summary.expenses === 0,
  "test finance excludes real book entries",
);
const expense = finance.entries.find((e) => e.reference === `QA-INV-${tag}`);
await ok(
  await request("owner/finance/void", owner, {
    id: expense.id,
    reason: "Local QA void preserves record",
  }),
);
check(
  (await ok(await request("owner/finance", owner))).entries.find(
    (e) => e.id === expense.id,
  ).voidedAt,
  "voided entry remains visible for accountability",
);
check(
  (
    await request("owner/finance/refund", owner, {
      orderId: aorder.orderId,
      amount: 200000,
      reference: "QA-refund",
      reason: "Too large refund must fail",
    })
  ).status === 400,
  "refund cannot exceed payment amount",
);
await ok(
  await request("owner/finance/refund", owner, {
    orderId: aorder.orderId,
    amount: 199900,
    reference: "QA-refund",
    reason: "Already processed local full refund fixture",
  }),
);
check(
  !(await ok(await request("me", alice.cookie))).account.paid,
  "full recorded refund revokes access originating from that order",
);
const exported = await request("owner/finance/export", owner);
check(
  exported.ok && exported.headers.get("content-type").includes("spreadsheet"),
  "finance exports genuine Excel workbook",
);
const files = unzipSync(new Uint8Array(await exported.arrayBuffer()));
const xml = Object.values(files).map(strFromU8).join("\n");
check(
  xml.includes("=QA literal formula text") &&
    !xml.includes("<f>") &&
    !xml.includes(fakeSecret) &&
    xml.includes("Payments") &&
    xml.includes("Book entries"),
  "Excel contains literal safe text, multiple report sheets and no credentials",
);
const login = await request("auth/login", bob.cookie, {
  email: bob.email,
  password: "Commerce-preview-123",
});
await ok(login);
const analytics = await ok(await request("owner/analytics", owner));
check(
  analytics.counts.some((c) => c.kind === "page_view") &&
    analytics.counts.some((c) => c.kind === "registration"),
  "analytics records real visit and registration events",
);
check(
  analytics.nonbuyers.some((u) => u.email === bob.email),
  "signed-in non-buyers appear in owner analytics",
);
check(
  (await request("owner/analytics?start=2026-02-31&end=2026-03-10", owner))
    .status === 400,
  "invalid calendar report date rejected",
);
check(
  (await request("owner/finance?start=2020-01-01&end=2026-01-01", owner))
    .status === 400,
  "unbounded report range rejected",
);
check(
  (await request("owner/analytics/export", owner)).headers
    .get("content-type")
    .includes("spreadsheet"),
  "analytics Excel report available to owner",
);
// Leave local QA connections disabled so they cannot be mistaken for real credentials in preview.
for (const [p, m, c] of [
  ["upi", "live", base],
  ["upi", "test", base],
  ["superprofile", "live", superConfig],
])
  await ok(await save(p, m, c, false));
console.log(
  `${checks} commerce checks passed. Local fixtures only; no external charge attempted.`,
);
