import { getDb } from "../db";
import {
  accounts,
  orders,
  packages,
  paymentConnections,
  paymentReceipts,
  audit,
  analyticsEvents,
} from "../db/schema";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { z } from "zod";
import {
  ApiError,
  json,
  readBody,
  sameOrigin,
  requireOwner,
  requireUser,
  ownerCheck,
  runtime,
  randomToken,
  sha,
  throttle,
  requestOrigin,
} from "./auth";
import { verifyHmac, hasAccess } from "./directory.mjs";
import {
  PROVIDERS,
  CURRENCIES,
  providerById,
  checkoutUrlAllowed,
  type PaymentConfig,
  type Provider,
} from "./payment-catalog";
import { sealSecrets, openSecrets } from "./payment-secrets";
import { safeRecordEvent } from "./analytics";

const modeSchema = z.enum(["test", "live"]);
const configSchema = z.object({
  currency: z.enum(CURRENCIES),
  methods: z.array(z.string().max(30)).min(1).max(8),
  fields: z.record(z.string().max(1500)),
  mappings: z
    .array(
      z.object({
        packageId: z.string().min(1).max(50),
        amountMinor: z.number().int().min(1).max(100000000).nullable(),
        checkoutUrl: z.string().max(1500).default(""),
        productId: z.string().max(150).default(""),
      }),
    )
    .max(30),
  fulfillment: z.enum(["manual", "bridge"]),
  instructions: z.string().max(1000),
});
const configId = (provider: string, mode: string) => `${provider}:${mode}`;
const auditPayment = (userId: string, action: string, details: unknown) =>
  getDb()
    .insert(audit)
    .values({
      id: crypto.randomUUID(),
      userId,
      action,
      details: JSON.stringify(details),
      createdAt: Date.now(),
    });
async function connection(provider: string, mode: string) {
  const row = await getDb()
    .select()
    .from(paymentConnections)
    .where(eq(paymentConnections.id, configId(provider, mode)))
    .get();
  if (!row) return null;
  return {
    ...row,
    config: JSON.parse(row.config) as PaymentConfig,
    secrets: await openSecrets(row.sealedSecrets, row.id),
  };
}
function issues(
  provider: Provider,
  config: PaymentConfig,
  secrets: Record<string, string>,
) {
  const out: string[] = [];
  if (config.methods.some((m) => !provider.methods.includes(m)))
    out.push("Select payment methods supported by this provider.");
  if (["razorpay", "upi"].includes(provider.id) && config.currency !== "INR")
    out.push("This connection requires INR.");
  if (provider.type === "api")
    for (const f of provider.fields.filter((f) => f.key !== "webhookSecret"))
      if (!(f.secret ? secrets[f.key] : config.fields[f.key]))
        out.push(`${f.label} is required.`);
  if (
    provider.id === "razorpay" &&
    config.fields.keyId &&
    !/^rzp_(test|live)_/.test(config.fields.keyId)
  )
    out.push("Use a valid Razorpay key ID.");
  if (
    provider.id === "upi" &&
    (!/^[a-z0-9._-]{2,256}@[a-z0-9.-]{2,64}$/i.test(
      config.fields.upiId || "",
    ) ||
      !config.fields.payeeName?.trim())
  )
    out.push("Enter a valid business UPI ID and payee name.");
  if (provider.id === "bank" && !config.fields.instructions?.trim())
    out.push("Add your business bank instructions.");
  if (!config.mappings.length) out.push("Map at least one package.");
  if (
    new Set(config.mappings.map((m) => m.packageId)).size !==
    config.mappings.length
  )
    out.push("Each package can be mapped once.");
  for (const m of config.mappings) {
    if (config.currency !== "INR" && m.amountMinor === null)
      out.push(
        "Set an explicit package amount for international currency. No exchange-rate conversion is applied.",
      );
    if (
      provider.type === "hosted" &&
      !checkoutUrlAllowed(m.checkoutUrl, provider)
    )
      out.push(
        "Use an HTTPS checkout URL on this provider’s domain for every mapped package.",
      );
  }
  if (config.fulfillment === "bridge" && !secrets.bridgeSecret)
    out.push(
      "Generate an automation secret before enabling bridge confirmation.",
    );
  return out;
}
async function providerFetch(url: string, init: RequestInit) {
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  } catch {
    throw new ApiError(
      502,
      "The provider could not be reached. Please try again.",
    );
  }
  if (!r.ok)
    throw new ApiError(
      502,
      "The provider rejected this request. Check the credentials, account permissions and selected mode.",
    );
  return r.json() as Promise<any>;
}
async function paypalToken(
  c: NonNullable<Awaited<ReturnType<typeof connection>>>,
) {
  const base =
    c.mode === "test"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  const d = await providerFetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(c.config.fields.clientId + ":" + c.secrets.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return { base, token: d.access_token as string };
}
async function apiRequest(
  c: NonNullable<Awaited<ReturnType<typeof connection>>>,
  path: string,
  init: RequestInit = {},
) {
  if (c.provider === "razorpay")
    return providerFetch("https://api.razorpay.com/v1/" + path, {
      ...init,
      headers: {
        Authorization: `Basic ${btoa(c.config.fields.keyId + ":" + c.secrets.keySecret)}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  if (c.provider === "stripe")
    return providerFetch("https://api.stripe.com/v1/" + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${c.secrets.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...init.headers,
      },
    });
  throw new ApiError(400, "This provider uses hosted payment links.");
}
export async function paymentReady() {
  return !!(
    await getDb()
      .select({ id: paymentConnections.id })
      .from(paymentConnections)
      .where(
        and(
          eq(paymentConnections.mode, "live"),
          eq(paymentConnections.enabled, true),
        ),
      )
      .limit(1)
  ).length;
}
export async function settleOrder(
  order: typeof orders.$inferSelect,
  paymentId: string,
  request?: Request,
  actor = "provider",
) {
  const db = getDb(),
    now = Date.now();
  if (order.status === "paid") {
    if (order.paymentId !== paymentId)
      throw new ApiError(409, "This order has a different payment receipt.");
    return;
  }
  if (!["created", "awaiting_review"].includes(order.status))
    throw new ApiError(409, "This order cannot be activated.");
  const receiptId = `${order.provider}:${order.mode}:${paymentId}`;
  // The unique receipt claim and conditional order update prevent reuse and double fulfillment.
  await db.batch([
    db
      .insert(paymentReceipts)
      .values({
        id: receiptId,
        orderId: order.id,
        provider: order.provider,
        paymentId,
        createdAt: now,
      })
      .onConflictDoNothing(),
    db
      .update(orders)
      .set({
        status: "paid",
        paymentId,
        paidAt: now,
        accessUntil: now + 30 * 86400000,
      })
      .where(
        and(
          eq(orders.id, order.id),
          inArray(orders.status, ["created", "awaiting_review"]),
          sql`exists(select 1 from payment_receipts where id=${receiptId} and order_id=${order.id})`,
        ),
      ),
    ...(order.mode === "live"
      ? [
          db
            .update(accounts)
            .set({
              accessUntil: sql`max(coalesce(${accounts.accessUntil},0),(select access_until from orders where id=${order.id}))`,
              packageId: order.packageId,
              accessSource: `payment:${order.id}`,
            })
            .where(
              and(
                eq(accounts.id, order.userId),
                sql`exists(select 1 from orders where id=${order.id} and status='paid' and payment_id=${paymentId})`,
              ),
            ),
        ]
      : []),
  ]);
  const updated = await db
    .select()
    .from(orders)
    .where(eq(orders.id, order.id))
    .get();
  if (updated?.paymentId !== paymentId)
    throw new ApiError(
      409,
      "That receipt is already assigned to another order.",
    );
  await auditPayment(order.userId, "payment_confirmed", {
    orderId: order.id,
    provider: order.provider,
    mode: order.mode,
    actor,
  });
  if (order.mode === "live")
    try {
      const checkout = await db
        .select()
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.userId, order.userId),
            eq(analyticsEvents.kind, "checkout"),
            eq(analyticsEvents.label, order.provider),
            sql`${analyticsEvents.createdAt}>=${order.createdAt - 5000}`,
          ),
        )
        .orderBy(desc(analyticsEvents.createdAt))
        .get();
      if (checkout)
        await db
          .insert(analyticsEvents)
          .values({
            id: `purchase:${order.id}`,
            sessionId: checkout.sessionId,
            userId: order.userId,
            kind: "purchase",
            path: "/billing",
            label: order.provider,
            source: checkout.source,
            device: checkout.device,
            createdAt: now,
          })
          .onConflictDoNothing();
    } catch {
      console.error("Purchase analytics could not be recorded");
    }
}
async function availableConnections(ownerTest = false) {
  const rows = await getDb()
    .select()
    .from(paymentConnections)
    .where(eq(paymentConnections.enabled, true));
  return rows
    .filter((r) => r.mode === "live" || ownerTest)
    .map((r) => {
      const p = providerById(r.provider)!,
        c = JSON.parse(r.config) as PaymentConfig;
      return {
        id: r.id,
        provider: r.provider,
        name: p.name,
        mode: r.mode,
        methods: c.methods,
        currency: c.currency,
        type: p.type,
        packages: c.mappings.map((m) => ({
          packageId: m.packageId,
          amountMinor: m.amountMinor,
        })),
        manual: p.type !== "api" && c.fulfillment === "manual",
      };
    });
}
export async function paymentRoute(
  request: Request,
  path: string,
): Promise<Response | null> {
  if (!path.startsWith("payments/") && !path.startsWith("owner/payments"))
    return null;
  const db = getDb(),
    url = new URL(request.url),
    method = request.method;
  if (path.startsWith("owner/payments")) {
    const owner = await requireOwner();
    if (method === "POST") sameOrigin(request);
    if (path === "owner/payments" && method === "GET") {
      const rows = await db.select().from(paymentConnections);
      const connections = [];
      for (const r of rows) {
        const c = JSON.parse(r.config) as PaymentConfig,
          s = await openSecrets(r.sealedSecrets, r.id);
        connections.push({
          id: r.id,
          provider: r.provider,
          mode: r.mode,
          enabled: r.enabled,
          config: c,
          secretFields: Object.keys(s).filter((k) => !!s[k]),
          testedAt: r.testedAt,
          testStatus: r.testStatus,
          updatedAt: r.updatedAt,
        });
      }
      return json({
        catalog: PROVIDERS,
        connections,
        packages: await db.select().from(packages),
        encryptionReady: !!runtime().PAYMENT_CONFIG_KEY,
      });
    }
    if (path === "owner/payments/save" && method === "POST") {
      const b = z
        .object({
          provider: z.string(),
          mode: modeSchema,
          enabled: z.boolean(),
          config: configSchema,
          secrets: z.record(z.string().max(2000)).default({}),
          clearSecrets: z.array(z.string()).max(10).default([]),
        })
        .parse(await readBody(request));
      const p = providerById(b.provider);
      if (!p) throw new ApiError(400, "Choose a listed provider.");
      const id = configId(p.id, b.mode),
        prior = await connection(p.id, b.mode),
        secrets = { ...(prior?.secrets || {}) };
      const permitted = [
        ...p.fields.filter((f) => f.secret).map((f) => f.key),
        "bridgeSecret",
      ];
      for (const k of b.clearSecrets) {
        if (!permitted.includes(k))
          throw new ApiError(400, "Unknown credential field.");
        delete secrets[k];
      }
      for (const [k, v] of Object.entries(b.secrets)) {
        if (!permitted.includes(k))
          throw new ApiError(400, "Unknown credential field.");
        if (v.trim()) secrets[k] = v.trim();
      }
      const publicKeys = p.fields.filter((f) => !f.secret).map((f) => f.key);
      if (Object.keys(b.config.fields).some((k) => !publicKeys.includes(k)))
        throw new ApiError(400, "Unexpected configuration field.");
      const ids = (await db.select({ id: packages.id }).from(packages)).map(
        (r) => r.id,
      );
      if (b.config.mappings.some((m) => !ids.includes(m.packageId)))
        throw new ApiError(400, "A mapped package no longer exists.");
      if (
        p.id === "razorpay" &&
        b.config.fields.keyId &&
        !b.config.fields.keyId.startsWith(`rzp_${b.mode}_`)
      )
        throw new ApiError(
          400,
          "Razorpay key does not match the selected mode.",
        );
      if (
        p.id === "stripe" &&
        secrets.secretKey &&
        !secrets.secretKey.startsWith(`sk_${b.mode}_`) &&
        !secrets.secretKey.startsWith(`rk_${b.mode}_`)
      )
        throw new ApiError(400, "Stripe key does not match the selected mode.");
      const config = JSON.stringify(b.config),
        changed =
          !prior ||
          JSON.stringify(prior.config) !== config ||
          Object.keys(b.secrets).some((k) => b.secrets[k].trim()) ||
          b.clearSecrets.length > 0;
      const problems = issues(p, b.config, secrets);
      if (b.enabled && problems.length)
        throw new ApiError(400, problems.join(" "));
      if (
        b.enabled &&
        p.type === "api" &&
        (changed || prior?.testStatus !== "passed")
      )
        throw new ApiError(
          400,
          "Save this connection disabled, test its credentials, then enable it.",
        );
      await db
        .insert(paymentConnections)
        .values({
          id,
          provider: p.id,
          mode: b.mode,
          enabled: b.enabled,
          config,
          sealedSecrets: await sealSecrets(secrets, id),
          testStatus: changed ? null : prior?.testStatus,
          testedAt: changed ? null : prior?.testedAt,
          updatedAt: Date.now(),
          updatedBy: owner.id,
        })
        .onConflictDoUpdate({
          target: paymentConnections.id,
          set: {
            enabled: b.enabled,
            config,
            sealedSecrets: await sealSecrets(secrets, id),
            testStatus: changed ? null : prior?.testStatus,
            testedAt: changed ? null : prior?.testedAt,
            updatedAt: Date.now(),
            updatedBy: owner.id,
          },
        });
      await auditPayment(owner.id, "payment_connection_saved", {
        provider: p.id,
        mode: b.mode,
        enabled: b.enabled,
      });
      return json({ ok: true });
    }
    if (
      ["owner/payments/test", "owner/payments/bridge-secret"].includes(path) &&
      method === "POST"
    ) {
      const b = z
        .object({ provider: z.string(), mode: modeSchema })
        .parse(await readBody(request));
      const c = await connection(b.provider, b.mode);
      if (!c) throw new ApiError(400, "Save the connection first.");
      const p = providerById(b.provider)!;
      if (path.endsWith("bridge-secret")) {
        const token = randomToken();
        await db
          .update(paymentConnections)
          .set({
            sealedSecrets: await sealSecrets(
              { ...c.secrets, bridgeSecret: token },
              c.id,
            ),
            updatedAt: Date.now(),
            updatedBy: owner.id,
          })
          .where(eq(paymentConnections.id, c.id));
        await auditPayment(owner.id, "payment_bridge_secret_rotated", {
          provider: p.id,
          mode: b.mode,
        });
        return json({ ok: true, token });
      }
      const problems = issues(p, c.config, c.secrets);
      if (problems.length) throw new ApiError(400, problems.join(" "));
      try {
        if (p.id === "razorpay") await apiRequest(c, "orders?count=1");
        else if (p.id === "stripe") {
          const balance = await apiRequest(c, "balance");
          if (balance.livemode !== (c.mode === "live"))
            throw new ApiError(400, "Stripe account mode did not match.");
        } else if (p.id === "paypal") await paypalToken(c);
        await db
          .update(paymentConnections)
          .set({
            testedAt: Date.now(),
            testStatus: p.type === "api" ? "passed" : "validated",
          })
          .where(eq(paymentConnections.id, c.id));
        return json({
          ok: true,
          message:
            p.type === "api"
              ? "Provider accepted the credentials. Complete a test purchase before enabling live payments."
              : "Configuration is valid. This check does not make a purchase or verify settlement.",
        });
      } catch (e) {
        await db
          .update(paymentConnections)
          .set({ testedAt: Date.now(), testStatus: "failed", enabled: false })
          .where(eq(paymentConnections.id, c.id));
        throw e;
      }
    }
    throw new ApiError(404, "Payment setting not found.");
  }
  if (path === "payments/options" && method === "GET") {
    const test = url.searchParams.get("mode") === "test";
    if (test) await requireOwner();
    return json({ options: await availableConnections(test) });
  }
  if (path === "payments/history" && method === "GET") {
    const a = await requireUser();
    return json({
      orders: await db
        .select()
        .from(orders)
        .where(eq(orders.userId, a.id))
        .orderBy(desc(orders.createdAt))
        .limit(30),
    });
  }
  if (path === "payments/order" && method === "POST") {
    sameOrigin(request);
    const a = await requireUser();
    await throttle(request, "checkout:" + a.id);
    const b = z
      .object({
        packageId: z.string().max(50),
        provider: z.string().default("razorpay"),
        mode: modeSchema.default("live"),
      })
      .parse(await readBody(request));
    if (b.mode === "test") {
      await requireOwner();
    } else if (hasAccess(a))
      throw new ApiError(
        409,
        "Your package is already active. Manage access before starting another purchase.",
      );
    const c = await connection(b.provider, b.mode),
      p = providerById(b.provider);
    if (!c?.enabled || !p)
      throw new ApiError(503, "This payment option is not available.");
    const plan = await db
        .select()
        .from(packages)
        .where(and(eq(packages.id, b.packageId), eq(packages.active, true)))
        .get(),
      mapping = c.config.mappings.find((m) => m.packageId === b.packageId);
    if (!plan || !mapping)
      throw new ApiError(
        400,
        "This package is not connected to that payment option.",
      );
    const problems = issues(p, c.config, c.secrets);
    if (problems.length)
      throw new ApiError(503, "This payment option needs owner configuration.");
    const amount = mapping.amountMinor ?? plan.price * 100,
      currency = c.config.currency,
      id = crypto.randomUUID(),
      now = Date.now();
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new ApiError(
        400,
        "Set a positive package checkout amount before accepting payments.",
      );
    const origin = requestOrigin(request),
      returnUrl = `${origin}/billing?order=${id}`;
    await db.insert(orders).values({
      id,
      userId: a.id,
      packageId: plan.id,
      provider: p.id,
      mode: b.mode,
      amount,
      currency,
      status: "created",
      createdAt: now,
      accessUntil: now + 30 * 86400000,
    });
    try {
      let result: Record<string, unknown> = {
        orderId: id,
        provider: p.id,
        mode: b.mode,
        amount,
        currency,
        email: a.email,
        returnUrl,
      };
      if (p.id === "razorpay") {
        const remote = await apiRequest(c, "orders", {
          method: "POST",
          body: JSON.stringify({
            amount,
            currency,
            receipt: id,
            notes: {
              account_id: a.id,
              package_id: plan.id,
              influvia_order: id,
            },
          }),
        });
        await db
          .update(orders)
          .set({ remoteId: remote.id })
          .where(eq(orders.id, id));
        result = {
          ...result,
          type: "razorpay",
          remoteId: remote.id,
          key: c.config.fields.keyId,
        };
      } else if (p.id === "stripe") {
        const fields = new URLSearchParams({
          mode: "payment",
          success_url: returnUrl,
          cancel_url: returnUrl + "&cancelled=1",
          client_reference_id: id,
          customer_email: a.email,
          "metadata[influvia_order]": id,
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": currency.toLowerCase(),
          "line_items[0][price_data][unit_amount]": String(amount),
          "line_items[0][price_data][product_data][name]": `INFLUVIA ${plan.name} · 30 days`,
        });
        if (
          !c.config.methods.includes("card") &&
          !c.config.methods.includes("apple_pay") &&
          !c.config.methods.includes("google_pay")
        )
          throw new ApiError(400, "Enable card checkout for Stripe.");
        const remote = await apiRequest(c, "checkout/sessions", {
          method: "POST",
          body: fields,
        });
        if (!remote.url || !checkoutUrlAllowed(remote.url, p))
          throw new ApiError(
            502,
            "Provider returned an invalid checkout address.",
          );
        await db
          .update(orders)
          .set({ remoteId: remote.id })
          .where(eq(orders.id, id));
        result = { ...result, type: "redirect", url: remote.url };
      } else if (p.id === "paypal") {
        const auth = await paypalToken(c),
          remote = await providerFetch(auth.base + "/v2/checkout/orders", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.token}`,
              "Content-Type": "application/json",
              "PayPal-Request-Id": id,
            },
            body: JSON.stringify({
              intent: "CAPTURE",
              purchase_units: [
                {
                  reference_id: id,
                  custom_id: id,
                  amount: {
                    currency_code: currency,
                    value: (amount / 100).toFixed(2),
                  },
                },
              ],
              payment_source: {
                paypal: {
                  experience_context: {
                    return_url: returnUrl,
                    cancel_url: returnUrl + "&cancelled=1",
                    user_action: "PAY_NOW",
                  },
                },
              },
            }),
          });
        const target = remote.links?.find(
          (l: any) => l.rel === "payer-action" || l.rel === "approve",
        )?.href;
        if (!target || !checkoutUrlAllowed(target, p))
          throw new ApiError(502, "PayPal did not return an approval link.");
        await db
          .update(orders)
          .set({ remoteId: remote.id })
          .where(eq(orders.id, id));
        result = { ...result, type: "redirect", url: target };
      } else {
        let upiUrl = "";
        if (p.id === "upi")
          upiUrl =
            "upi://pay?" +
            new URLSearchParams({
              pa: c.config.fields.upiId,
              pn: c.config.fields.payeeName,
              am: (amount / 100).toFixed(2),
              cu: "INR",
              tn: `INFLUVIA ${id}`,
              tr: id,
            }).toString();
        result = {
          ...result,
          type: "manual",
          url: p.type === "hosted" ? mapping.checkoutUrl : upiUrl,
          upiId: p.id === "upi" ? c.config.fields.upiId : undefined,
          payeeName: p.id === "upi" ? c.config.fields.payeeName : undefined,
          instructions: c.config.fields.instructions || c.config.instructions,
          confirmation: c.config.fulfillment,
        };
      }
      if (b.mode === "live" && !ownerCheck(a))
        await safeRecordEvent(request, "checkout", a.id, "/billing", p.id);
      return json(result);
    } catch (e) {
      await db
        .update(orders)
        .set({ status: "failed" })
        .where(eq(orders.id, id));
      throw e;
    }
  }
  if (
    [
      "payments/verify",
      "payments/confirm",
      "payments/receipt",
      "payments/instructions",
    ].includes(path) &&
    method === "POST"
  ) {
    sameOrigin(request);
    const a = await requireUser();
    await throttle(request, "payment-confirm:" + a.id);
    const b = z
      .object({
        orderId: z.string().uuid(),
        razorpay_payment_id: z.string().max(150).optional(),
        razorpay_signature: z.string().max(128).optional(),
        reference: z.string().trim().min(3).max(150).optional(),
      })
      .parse(await readBody(request));
    const order = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, b.orderId), eq(orders.userId, a.id)))
      .get();
    if (!order) throw new ApiError(404, "Order not found.");
    if (order.status === "paid")
      return json({ ok: true, paid: true, test: order.mode === "test" });
    const c = await connection(order.provider, order.mode);
    if (!c) throw new ApiError(503, "This payment connection is unavailable.");
    if (path === "payments/instructions") {
      const p = providerById(order.provider),
        mapping = c.config.mappings.find(
          (m) => m.packageId === order.packageId,
        );
      if (
        !p ||
        p.type === "api" ||
        !inArrayPending(order.status) ||
        !c.enabled ||
        c.config.currency !== order.currency
      )
        throw new ApiError(
          409,
          "These payment instructions are no longer available. Please start a new checkout.",
        );
      const target =
        p.id === "upi"
          ? "upi://pay?" +
            new URLSearchParams({
              pa: c.config.fields.upiId,
              pn: c.config.fields.payeeName,
              am: (order.amount / 100).toFixed(2),
              cu: "INR",
              tn: `INFLUVIA ${order.id}`,
              tr: order.id,
            })
          : mapping?.checkoutUrl;
      return json({
        orderId: order.id,
        provider: p.id,
        mode: order.mode,
        type: "manual",
        amount: order.amount,
        currency: order.currency,
        url: target,
        upiId: p.id === "upi" ? c.config.fields.upiId : undefined,
        payeeName: p.id === "upi" ? c.config.fields.payeeName : undefined,
        instructions: c.config.fields.instructions || c.config.instructions,
        confirmation: c.config.fulfillment,
      });
    }
    if (path === "payments/receipt") {
      if (
        providerById(order.provider)?.type === "api" ||
        !b.reference ||
        !inArrayPending(order.status)
      )
        throw new ApiError(400, "This order cannot accept a receipt claim.");
      await db
        .update(orders)
        .set({ receiptReference: b.reference, status: "awaiting_review" })
        .where(
          and(
            eq(orders.id, order.id),
            inArray(orders.status, ["created", "awaiting_review"]),
          ),
        );
      return json({
        ok: true,
        paid: false,
        message: "Receipt submitted. Access opens after payment is verified.",
      });
    }
    let paymentId = "";
    if (order.provider === "razorpay") {
      if (
        !b.razorpay_payment_id ||
        !b.razorpay_signature ||
        !(await verifyHmac(
          c.secrets.keySecret,
          `${order.remoteId}|${b.razorpay_payment_id}`,
          b.razorpay_signature,
        ))
      )
        throw new ApiError(400, "Payment verification failed.");
      const p = await apiRequest(
        c,
        `payments/${encodeURIComponent(b.razorpay_payment_id)}`,
      );
      if (
        p.status !== "captured" ||
        p.order_id !== order.remoteId ||
        p.amount !== order.amount ||
        p.currency !== order.currency
      )
        throw new ApiError(409, "Payment is not yet captured for this order.");
      paymentId = p.id;
    } else if (order.provider === "stripe") {
      const p = await apiRequest(
        c,
        `checkout/sessions/${encodeURIComponent(order.remoteId || "")}`,
      );
      if (
        p.payment_status !== "paid" ||
        p.client_reference_id !== order.id ||
        p.amount_total !== order.amount ||
        p.currency?.toUpperCase() !== order.currency ||
        p.livemode !== (order.mode === "live")
      )
        throw new ApiError(409, "Payment is not yet confirmed for this order.");
      paymentId = p.payment_intent;
    } else if (order.provider === "paypal") {
      const auth = await paypalToken(c),
        headers = {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": "capture-" + order.id,
        };
      let p = await providerFetch(
        auth.base +
          "/v2/checkout/orders/" +
          encodeURIComponent(order.remoteId || ""),
        { headers },
      );
      if (p.status === "APPROVED")
        p = await providerFetch(
          auth.base +
            "/v2/checkout/orders/" +
            encodeURIComponent(order.remoteId || "") +
            "/capture",
          { method: "POST", headers, body: "{}" },
        );
      const unit = p.purchase_units?.[0],
        capture = unit?.payments?.captures?.[0];
      if (
        p.status !== "COMPLETED" ||
        unit.custom_id !== order.id ||
        capture?.status !== "COMPLETED" ||
        Math.round(Number(capture.amount?.value) * 100) !== order.amount ||
        capture.amount.currency_code !== order.currency
      )
        throw new ApiError(
          409,
          "PayPal capture is not complete for this order.",
        );
      paymentId = capture.id;
    } else
      return json({
        ok: true,
        paid: false,
        message: "Payment awaits owner verification.",
      });
    if (!paymentId)
      throw new ApiError(409, "A settled payment reference is required.");
    await settleOrder(order, paymentId, request);
    return json({ ok: true, paid: true, test: order.mode === "test" });
  }
  const bridge = path.match(/^payments\/bridge\/([a-z]+)\/(live|test)$/);
  if (bridge && method === "POST") {
    const c = await connection(bridge[1], bridge[2]);
    if (
      !c?.enabled ||
      c.config.fulfillment !== "bridge" ||
      !c.secrets.bridgeSecret
    )
      throw new ApiError(401, "Automation connection unavailable.");
    const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (
      !supplied ||
      (await sha(supplied)) !== (await sha(c.secrets.bridgeSecret))
    )
      throw new ApiError(401, "Invalid automation credential.");
    const b = z
      .object({
        orderId: z.string().uuid(),
        paymentId: z.string().min(3).max(150),
        amountMinor: z.number().int().positive(),
        currency: z.enum(CURRENCIES),
        status: z.literal("paid"),
      })
      .parse(await readBody(request));
    const o = await db
      .select()
      .from(orders)
      .where(eq(orders.id, b.orderId))
      .get();
    if (
      !o ||
      o.provider !== bridge[1] ||
      o.mode !== bridge[2] ||
      o.amount !== b.amountMinor ||
      o.currency !== b.currency
    )
      throw new ApiError(400, "Payment does not match this order.");
    await settleOrder(o, b.paymentId, undefined, "authenticated-automation");
    return json({ ok: true });
  }
  const webhook = path.match(
    /^payments\/webhook\/(razorpay|stripe)\/(live|test)$/,
  );
  if (webhook && method === "POST") {
    const c = await connection(webhook[1], webhook[2]);
    if (!c?.secrets.webhookSecret)
      throw new ApiError(401, "Webhook unavailable.");
    const raw = await request.text();
    if (raw.length > 1000000) throw new ApiError(413, "Webhook is too large.");
    let valid = false;
    if (c.provider === "razorpay")
      valid = await verifyHmac(
        c.secrets.webhookSecret,
        raw,
        request.headers.get("x-razorpay-signature"),
      );
    else {
      const h = request.headers.get("stripe-signature") || "",
        t = h.match(/(?:^|,)t=(\d+)/)?.[1],
        signatures = [...h.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map((m) => m[1]);
      if (t && Math.abs(Date.now() / 1000 - Number(t)) <= 300)
        for (const s of signatures)
          if (await verifyHmac(c.secrets.webhookSecret, `${t}.${raw}`, s))
            valid = true;
    }
    if (!valid) throw new ApiError(400, "Invalid webhook signature.");
    const e = JSON.parse(raw);
    const p =
      c.provider === "razorpay" ? e.payload?.payment?.entity : e.data?.object;
    const remoteId = c.provider === "razorpay" ? p?.order_id : p?.id;
    const o = remoteId
      ? await db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.remoteId, remoteId),
              eq(orders.provider, c.provider),
              eq(orders.mode, c.mode),
            ),
          )
          .get()
      : null;
    const captured =
      c.provider === "razorpay"
        ? e.event === "payment.captured" && p.status === "captured"
        : [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
          ].includes(e.type) &&
          p.payment_status === "paid" &&
          p.client_reference_id === o?.id &&
          p.livemode === (c.mode === "live");
    if (
      o &&
      captured &&
      (c.provider === "razorpay" ? p.amount : p.amount_total) === o.amount &&
      p.currency?.toUpperCase() === o.currency
    )
      await settleOrder(
        o,
        c.provider === "razorpay" ? p.id : p.payment_intent,
        undefined,
        "signed-webhook",
      );
    return json({ ok: true });
  }
  // Preserve the original environment-based Razorpay webhook for legacy orders.
  if (path === "payments/webhook") return null;
  throw new ApiError(404, "Payment endpoint not found.");
}
function inArrayPending(status: string) {
  return ["created", "awaiting_review"].includes(status);
}
