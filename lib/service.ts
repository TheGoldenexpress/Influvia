import { getDb } from "../db";
import {
  accounts,
  creators,
  orders,
  audit,
  packages,
  searches,
} from "../db/schema";
import {
  eq,
  and,
  or,
  gte,
  lte,
  asc,
  desc,
  ne,
  inArray,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  currentUser,
  requireUser,
  requireOwner,
  ownerCheck,
  authRoute,
  ApiError,
  json,
  readBody,
  sameOrigin,
  runtime,
} from "./auth";
import { hasAccess, verifyHmac } from "./directory.mjs";
import {
  INDUSTRIES,
  LANGUAGES,
  GEOGRAPHY,
  PACKAGE_DRAFTS,
  parseSearchFilters,
  monthKey,
  publicCreator,
  sampleSearch,
  samplePage,
} from "./catalog.mjs";
import { makeWorkbook } from "./excel.mjs";
import { ownerInvitationRoute } from "./owner-invitations";
import { paymentRoute, paymentReady } from "./payments";
import { financeRoute } from "./finance";
import { analyticsRoute, safeRecordEvent } from "./analytics";
const log = (userId: string, action: string, details: unknown) =>
  getDb()
    .insert(audit)
    .values({
      id: crypto.randomUUID(),
      userId,
      action,
      details: JSON.stringify(details),
      createdAt: Date.now(),
    });
async function planFor(user: typeof accounts.$inferSelect) {
  return hasAccess(user) && user.packageId
    ? (await getDb()
        .select()
        .from(packages)
        .where(eq(packages.id, user.packageId))
        .get()) || null
    : null;
}
async function usage(userId: string) {
  const d = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(searches)
    .where(
      and(
        eq(searches.userId, userId),
        eq(searches.month, monthKey()),
        eq(searches.isPaid, true),
      ),
    )
    .get();
  return d?.count || 0;
}
const safeUrl = (domain: string) =>
  z
    .string()
    .max(500)
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          (u.hostname === domain || u.hostname.endsWith(`.${domain}`))
        );
      } catch {
        return false;
      }
    }, `Use an https://${domain} profile URL`);
const creatorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  region: z.enum(Object.keys(GEOGRAPHY) as [string, ...string[]]),
  district: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  niche: z.enum(INDUSTRIES as [string, ...string[]]),
  language: z.enum(LANGUAGES as [string, ...string[]]),
  instagram: safeUrl("instagram.com").default(""),
  youtube: safeUrl("youtube.com").default(""),
  facebook: safeUrl("facebook.com").default(""),
  followers: z.number().int().min(0).max(1e9),
  engagement: z.number().min(0).max(100).default(0),
  rate: z.number().int().min(0).max(1e8),
  email: z.union([z.string().email().max(200), z.literal("")]).default(""),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d ()-]*$/)
    .default(""),
  bio: z.string().trim().max(600).default(""),
  photo: z
    .string()
    .max(1000)
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && !u.username && !u.password;
      } catch {
        return false;
      }
    }, "Use an HTTPS photo URL")
    .optional(),
  acceptsFreeCollab: z.boolean().default(false),
});
const packageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(180),
  price: z.number().int().min(1).max(1000000),
  searchLimit: z.number().int().min(1).max(100000).nullable(),
  resultLimit: z.number().int().min(10).max(1000000).nullable(),
  active: z.boolean(),
});
function where(f: ReturnType<typeof parseSearchFilters>) {
  const p = [];
  if (f.q) {
    const q = `%${f.q.replace(/[!%_]/g, "!$&")}%`;
    p.push(
      or(
        sql`${creators.name} LIKE ${q} ESCAPE '!'`,
        sql`${creators.niche} LIKE ${q} ESCAPE '!'`,
        sql`${creators.city} LIKE ${q} ESCAPE '!'`,
      ),
    );
  }
  if (f.region) p.push(eq(creators.region, f.region));
  if (f.district) p.push(eq(creators.district, f.district));
  if (f.city) p.push(sql`lower(${creators.city})=lower(${f.city})`);
  if (f.industry) p.push(eq(creators.niche, f.industry));
  if (f.language) p.push(eq(creators.language, f.language));
  if (f.platform)
    p.push(
      ne(creators[f.platform as "instagram" | "youtube" | "facebook"], ""),
    );
  if (f.minFollowers !== null) p.push(gte(creators.followers, f.minFollowers));
  if (f.maxFollowers !== null) p.push(lte(creators.followers, f.maxFollowers));
  if (f.minRate !== null) p.push(gte(creators.rate, f.minRate));
  if (f.maxRate !== null) p.push(lte(creators.rate, f.maxRate));
  if (f.collab) p.push(eq(creators.acceptsFreeCollab, f.collab === "free"));
  return and(...p);
}
const orderBy = (f: ReturnType<typeof parseSearchFilters>) =>
  f.sort === "followers-desc"
    ? desc(creators.followers)
    : f.sort === "followers-asc"
      ? asc(creators.followers)
      : f.sort === "rate-asc"
        ? asc(creators.rate)
        : f.sort === "name"
          ? asc(creators.name)
          : desc(creators.engagement);
async function searchRecord(userId: string, id: string) {
  const r = await getDb()
    .select()
    .from(searches)
    .where(and(eq(searches.id, id), eq(searches.userId, userId)))
    .get();
  if (!r)
    throw new ApiError(404, "This search was not found. Run a new search.");
  return r;
}
const minCap = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b);
async function searchResults(
  user: typeof accounts.$inferSelect,
  record: typeof searches.$inferSelect,
  page = 1,
) {
  const plan = await planFor(user);
  const cap = minCap(record.resultLimit, plan ? plan.resultLimit : 10);
  const f = parseSearchFilters(JSON.parse(record.filters));
  const db = getDb();
  const catalogCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(creators)
    .get();
  if (!catalogCount?.count) {
    return {
      ...samplePage(f, !!plan, cap, page),
      searchId: record.id,
      paid: !!plan,
      plan: plan?.name || "Free",
      searchesUsed: await usage(user.id),
      searchLimit: plan?.searchLimit ?? null,
      resultLimit: cap,
      filters: f,
    };
  }
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(creators)
    .where(where(f))
    .get();
  const total = count?.count || 0,
    available = cap === null ? total : Math.min(total, cap);
  const pages = Math.max(1, Math.ceil(available / 12));
  page = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const take = Math.min(12, Math.max(0, available - (page - 1) * 12));
  const rows = take
    ? await db
        .select()
        .from(creators)
        .where(where(f))
        .orderBy(orderBy(f), asc(creators.id))
        .limit(take)
        .offset((page - 1) * 12)
    : [];
  return {
    searchId: record.id,
    rows: rows.map((c) => publicCreator(c, !!plan)),
    total,
    available,
    page,
    pages,
    paid: !!plan,
    plan: plan?.name || "Free",
    searchesUsed: await usage(user.id),
    searchLimit: plan?.searchLimit ?? null,
    resultLimit: cap,
    filters: f,
  };
}
const xlsx = (bytes: Uint8Array, name: string) =>
  new Response(bytes as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function razorpay(path: string, init?: RequestInit) {
  const e = runtime();
  if (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET)
    throw new ApiError(
      503,
      "Payments are not open yet. Your free account is ready to use.",
    );
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${e.RAZORPAY_KEY_ID}:${e.RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok)
    throw new ApiError(
      502,
      "The payment provider is temporarily unavailable. Please try again.",
    );
  return r.json() as Promise<any>;
}
async function activate(order: typeof orders.$inferSelect, paymentId: string) {
  const db = getDb();
  await db.batch([
    db
      .update(orders)
      .set({
        status: "paid",
        paymentId,
        paidAt: Date.now(),
        accessUntil: Date.now() + 30 * 86400000,
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, "created"))),
    db
      .update(accounts)
      .set({
        accessUntil: sql`max(coalesce(${accounts.accessUntil},0),(select access_until from orders where id=${order.id}))`,
        packageId: order.packageId,
        accessSource: "payment",
      })
      .where(
        and(
          eq(accounts.id, order.userId),
          sql`exists(select 1 from orders where id=${order.id} and status='paid' and payment_id=${paymentId})`,
        ),
      ),
  ]);
}
async function upsertCreators(
  rows: z.infer<typeof creatorSchema>[],
  userId: string,
  preview = false,
) {
  const db = getDb();
  const mutations = [];
  const seen = new Set<string>();
  const ids = rows.map(row => row.id).filter((id): id is string => !!id);
  const links = (["instagram", "youtube", "facebook"] as const).map(key => ({
    key, values: [...new Set(rows.map(row => row[key]).filter(Boolean))],
  }));
  const predicates = [
    ...(ids.length ? [inArray(creators.id, ids)] : []),
    ...links.filter(item => item.values.length).map(item => inArray(creators[item.key], item.values)),
  ];
  // Resolve the complete upload in one round trip. A 500-row import must not
  // perform hundreds of remote lookups before its atomic write transaction.
  const candidates = predicates.length
    ? await db.select().from(creators).where(or(...predicates))
    : [];
  const byId = new Map(candidates.map(creator => [creator.id, creator]));
  let added = 0,
    updated = 0;
  for (const row of rows) {
    const { id, ...values } = row;
    let existing = id ? byId.get(id) : undefined;
    if (id && !existing)
      throw new ApiError(400, `Creator ID not found for ${row.name}.`);
    if (!existing) {
      const matches = candidates.filter(creator =>
        (["instagram", "youtube", "facebook"] as const).some(key => row[key] && row[key] === creator[key]),
      );
      if (matches.length > 1)
        throw new ApiError(400, `Social links match multiple creators for ${row.name}. Use the correct creator ID.`);
      existing = matches[0];
    }
    const key =
      existing?.id ||
      [row.instagram, row.youtube, row.facebook].filter(Boolean).join("|") ||
      `new:${added}`;
    if (seen.has(key))
      throw new ApiError(400, `Duplicate creator in this upload: ${row.name}.`);
    seen.add(key);
    if (existing) {
      mutations.push(
        db
          .update(creators)
          .set({ ...values, updatedAt: Date.now() })
          .where(eq(creators.id, existing.id)),
      );
      updated++;
    } else {
      mutations.push(
        db.insert(creators).values({
          ...values,
          id: crypto.randomUUID(),
          photo: values.photo || "",
          updatedAt: Date.now(),
        }),
      );
      added++;
    }
  }
  if (!preview)
    await db.batch([
      ...mutations,
      log(userId, "creator_upsert", { added, updated, rowCount: rows.length }),
    ] as any);
  return { ok: true, added, updated, preview };
}
export async function dispatch(
  request: Request,
  path: string,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      method = request.method,
      db = getDb();
    for (const handler of [paymentRoute, financeRoute, analyticsRoute]) {
      const result = await handler(request, path);
      if (result) return result;
    }
    const invitationResponse = await ownerInvitationRoute(request, path);
    if (invitationResponse) return invitationResponse;
    if (path.startsWith("auth/")) {
      const r = await authRoute(request, path);
      if (r) return r;
    }
    if (method === "POST" && path !== "payments/webhook") sameOrigin(request);
    if (path === "packages" && method === "GET") {
      const rows = await db
        .select()
        .from(packages)
        .where(eq(packages.active, true));
      return json({
        packages: rows.length
          ? rows.map((p) => ({ ...p, configured: true }))
          : PACKAGE_DRAFTS,
      });
    }
    if (path === "me" && method === "GET") {
      const a = await currentUser();
      if (!a)
        return json({
          account: null,
          paymentReady: await paymentReady(),
        });
      const plan = await planFor(a);
      return json({
        account: {
          ...a,
          paid: !!plan,
          owner: ownerCheck(a),
          plan: plan || { name: "Free", searchLimit: null, resultLimit: 10 },
          searchesUsed: await usage(a.id),
        },
        paymentReady: await paymentReady(),
      });
    }
    if (path === "profile" && method === "POST") {
      const a = await requireUser();
      const p = z
        .object({
          name: z.string().trim().min(2).max(100),
          company: z.string().trim().max(150),
        })
        .parse(await readBody(request));
      await db.update(accounts).set(p).where(eq(accounts.id, a.id));
      return json({ ok: true });
    }
    if (path === "search" && method === "POST") {
      const a = await requireUser(),
        plan = await planFor(a),
        b = await readBody(request),
        f = parseSearchFilters(b.filters);
      const id = crypto.randomUUID(),
        month = monthKey();
      const result = await db.run(
        sql`insert into searches(id,user_id,filters,result_limit,is_paid,month,created_at) select ${id},${a.id},${JSON.stringify(f)},${plan ? plan.resultLimit : 10},${plan ? 1 : 0},${month},${Date.now()} where ${!plan || plan.searchLimit === null ? 1 : 0}=1 or (select count(*) from searches where user_id=${a.id} and month=${month} and is_paid=1)<${plan?.searchLimit || 0}`,
      );
      if (result.meta.changes !== 1)
        throw new ApiError(
          429,
          "You’ve used all searches in your package this month. Upgrade for more discovery.",
        );
      const record = await searchRecord(a.id, id);
      if (!ownerCheck(a))
        await safeRecordEvent(request, "search", a.id, "/brand");
      return json(await searchResults(a, record));
    }
    if (path === "search" && method === "GET") {
      const a = await requireUser();
      return json(
        await searchResults(
          a,
          await searchRecord(a.id, url.searchParams.get("id") || ""),
          Number(url.searchParams.get("page") || 1),
        ),
      );
    }
    if (path === "exports" && method === "POST") {
      const a = await requireUser(),
        plan = await planFor(a);
      if (!plan)
        throw new ApiError(
          403,
          "Upgrade to unlock contact details and Excel exports.",
        );
      const b = z
        .object({
          searchId: z.string().uuid(),
          ids: z.array(z.string().max(100)).max(5000).default([]),
        })
        .parse(await readBody(request));
      const record = await searchRecord(a.id, b.searchId);
      const f = parseSearchFilters(JSON.parse(record.filters)),
        cap = minCap(record.resultLimit, plan.resultLimit);
      let rows: any[] = await db
        .select()
        .from(creators)
        .where(where(f))
        .orderBy(orderBy(f), asc(creators.id))
        .limit(cap === null ? 50001 : Math.min(cap, 50001));
      const catalogCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(creators)
        .get();
      const sample = !catalogCount?.count;
      if (sample)
        rows = sampleSearch(f, true).rows.slice(
          0,
          cap === null ? undefined : cap,
        );
      if (b.ids.length) {
        const wanted = new Set(b.ids);
        rows = rows.filter((c) => wanted.has(c.id));
        if (rows.length !== wanted.size)
          throw new ApiError(
            400,
            "Selected creators must belong to the accessible results of this search.",
          );
      }
      if (rows.length > 50000)
        throw new ApiError(
          400,
          "Narrow your filters to 50,000 creators or fewer for a single Excel file.",
        );
      if (!rows.length)
        throw new ApiError(400, "No creators match this selection.");
      await log(a.id, "export", {
        searchId: record.id,
        filters: f,
        rowCount: rows.length,
        selectedIds: b.ids,
      });
      if (!ownerCheck(a))
        await safeRecordEvent(request, "export", a.id, "/exports");
      return xlsx(
        makeWorkbook(rows, { filters: f, sample }),
        `influvia-creators-${new Date().toISOString().slice(0, 10)}`,
      );
    }
    if (path === "exports" && method === "GET") {
      const a = await requireUser();
      return json({
        rows: await db
          .select()
          .from(audit)
          .where(and(eq(audit.userId, a.id), eq(audit.action, "export")))
          .orderBy(desc(audit.createdAt))
          .limit(100),
      });
    }
    if (path === "demo/export" && method === "POST") {
      throw new ApiError(
        410,
        "Run a directory search and export its saved results.",
      );
    }
    if (path === "payments/order" && method === "POST") {
      const a = await requireUser(),
        b = z
          .object({ packageId: z.string().max(40) })
          .parse(await readBody(request));
      const p = await db
        .select()
        .from(packages)
        .where(and(eq(packages.id, b.packageId), eq(packages.active, true)))
        .get();
      if (!p) throw new ApiError(400, "This package is not available yet.");
      if (hasAccess(a))
        throw new ApiError(
          409,
          "Your package is active. Contact the administrator to change an active package.",
        );
      const amount = p.price * 100;
      const remote = await razorpay("orders", {
        method: "POST",
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: crypto.randomUUID(),
          notes: { account_id: a.id, package_id: p.id },
        }),
      });
      await db.insert(orders).values({
        id: remote.id,
        userId: a.id,
        packageId: p.id,
        amount,
        currency: "INR",
        status: "created",
        createdAt: Date.now(),
        accessUntil: Date.now() + 30 * 86400000,
      });
      return json({
        orderId: remote.id,
        amount,
        currency: "INR",
        key: runtime().RAZORPAY_KEY_ID,
        email: a.email,
      });
    }
    if (path === "payments/verify" && method === "POST") {
      const a = await requireUser();
      const b = z
        .object({
          razorpay_order_id: z.string().max(100),
          razorpay_payment_id: z.string().max(100),
          razorpay_signature: z.string().max(128),
        })
        .parse(await readBody(request));
      const order = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, b.razorpay_order_id), eq(orders.userId, a.id)))
        .get();
      if (
        !order ||
        !(await verifyHmac(
          runtime().RAZORPAY_KEY_SECRET,
          `${order.id}|${b.razorpay_payment_id}`,
          b.razorpay_signature,
        ))
      )
        throw new ApiError(400, "Payment verification failed.");
      const p = await razorpay(
        `payments/${encodeURIComponent(b.razorpay_payment_id)}`,
      );
      if (
        p.order_id !== order.id ||
        p.amount !== order.amount ||
        p.currency !== order.currency ||
        p.status !== "captured"
      )
        throw new ApiError(
          409,
          "Payment is awaiting capture. Refresh your account shortly.",
        );
      if (order.status === "created") await activate(order, p.id);
      return json({ ok: true });
    }
    if (path === "payments/webhook" && method === "POST") {
      const raw = await request.text();
      if (
        raw.length > 1000000 ||
        !(await verifyHmac(
          runtime().RAZORPAY_WEBHOOK_SECRET,
          raw,
          request.headers.get("x-razorpay-signature"),
        ))
      )
        throw new ApiError(400, "Invalid webhook signature.");
      const e = JSON.parse(raw),
        p = e.payload?.payment?.entity;
      if (e.event === "payment.captured" && p?.status === "captured") {
        const order = await db
          .select()
          .from(orders)
          .where(eq(orders.id, p.order_id))
          .get();
        if (
          order &&
          order.status === "created" &&
          order.amount === p.amount &&
          order.currency === p.currency
        )
          await activate(order, p.id);
      }
      return json({ ok: true });
    }
    if (path.startsWith("owner/")) {
      const a = await requireOwner();
      if (path === "owner/creators" && method === "GET") {
        const f = parseSearchFilters(url.searchParams);
        const predicate = where(f);
        const requested = z.coerce
          .number()
          .int()
          .min(1)
          .max(1000000)
          .parse(url.searchParams.get("page") || 1);
        const count = await db
          .select({ count: sql<number>`count(*)` })
          .from(creators)
          .where(predicate)
          .get();
        const total = count?.count || 0,
          pages = Math.max(1, Math.ceil(total / 25)),
          page = Math.min(requested, pages);
        const rows = await db
          .select()
          .from(creators)
          .where(predicate)
          .orderBy(desc(creators.updatedAt), asc(creators.id))
          .limit(25)
          .offset((page - 1) * 25);
        return json({ rows, total, pages, page });
      }
      if (path === "owner/users" && method === "GET") {
        const q = (url.searchParams.get("q") || "")
          .trim()
          .toLowerCase()
          .slice(0, 100);
        const status = z
          .enum(["", "paid", "free", "expired"])
          .parse(url.searchParams.get("status") || "");
        const predicate = and(
          q
            ? sql`instr(lower(${accounts.name} || ' ' || ${accounts.email} || ' ' || ${accounts.company}),${q}) > 0`
            : undefined,
          status === "paid"
            ? and(
                gte(accounts.accessUntil, Date.now()),
                sql`${accounts.packageId} is not null`,
              )
            : status === "free"
              ? sql`${accounts.accessUntil} is null`
              : status === "expired"
                ? lte(accounts.accessUntil, Date.now())
                : undefined,
        );
        const requested = z.coerce
          .number()
          .int()
          .min(1)
          .max(1000000)
          .parse(url.searchParams.get("page") || 1);
        const count = await db
          .select({ count: sql<number>`count(*)` })
          .from(accounts)
          .where(predicate)
          .get();
        const total = count?.count || 0,
          pages = Math.max(1, Math.ceil(total / 25)),
          page = Math.min(requested, pages);
        const rows = await db
          .select()
          .from(accounts)
          .where(predicate)
          .orderBy(desc(accounts.createdAt), asc(accounts.id))
          .limit(25)
          .offset((page - 1) * 25);
        return json({ rows, total, pages, page });
      }
      if (path === "owner/overview" && method === "GET") {
        const monthStart = Date.parse(`${monthKey()}-01T00:00:00+05:30`);
        const [
          users,
          rows,
          events,
          plans,
          count,
          revenue,
          quality,
          industries,
          districts,
          monthSearches,
          monthExports,
        ] = await Promise.all([
          db.select().from(accounts).orderBy(desc(accounts.createdAt)),
          db
            .select()
            .from(creators)
            .orderBy(desc(creators.updatedAt))
            .limit(500),
          db.select().from(audit).orderBy(desc(audit.createdAt)).limit(100),
          db.select().from(packages),
          db
            .select({ count: sql<number>`count(*)` })
            .from(creators)
            .get(),
          db
            .select({
              amount: sql<number>`coalesce(sum(amount-refunded_amount),0)`,
            })
            .from(orders)
            .where(
              and(
                eq(orders.status, "paid"),
                eq(orders.mode, "live"),
                eq(orders.currency, "INR"),
              ),
            )
            .get(),
          db
            .select({
              freeCollabs: sql<number>`coalesce(sum(case when ${creators.acceptsFreeCollab}=1 then 1 else 0 end),0)`,
              withPhotos: sql<number>`coalesce(sum(case when ${creators.photo}<>'' then 1 else 0 end),0)`,
              withContacts: sql<number>`coalesce(sum(case when ${creators.email}<>'' or ${creators.phone}<>'' then 1 else 0 end),0)`,
            })
            .from(creators)
            .get(),
          db
            .select({ name: creators.niche, count: sql<number>`count(*)` })
            .from(creators)
            .groupBy(creators.niche),
          db
            .select({ name: creators.district, count: sql<number>`count(*)` })
            .from(creators)
            .groupBy(creators.district)
            .orderBy(desc(sql`count(*)`))
            .limit(6),
          db
            .select({ count: sql<number>`count(*)` })
            .from(searches)
            .where(eq(searches.month, monthKey()))
            .get(),
          db
            .select({ count: sql<number>`count(*)` })
            .from(audit)
            .where(
              and(eq(audit.action, "export"), gte(audit.createdAt, monthStart)),
            )
            .get(),
        ]);
        return json({
          users,
          creators: rows,
          audit: events,
          packages: plans.length ? plans : PACKAGE_DRAFTS,
          totalCreators: count?.count || 0,
          revenue: (revenue?.amount || 0) / 100,
          stats: {
            ...quality,
            industries,
            districts,
            monthSearches: monthSearches?.count || 0,
            monthExports: monthExports?.count || 0,
          },
        });
      }
      if (path === "owner/packages" && method === "POST") {
        const rows = z
          .array(packageSchema)
          .min(1)
          .max(10)
          .parse((await readBody(request)).packages);
        await db.batch([
          ...rows.map((p) =>
            db
              .insert(packages)
              .values({ ...p, updatedAt: Date.now() })
              .onConflictDoUpdate({
                target: packages.id,
                set: { ...p, updatedAt: Date.now() },
              }),
          ),
          log(a.id, "packages_updated", { packages: rows }),
        ] as any);
        return json({ ok: true });
      }
      if (
        (path === "owner/import" ||
          path === "owner/import/preview" ||
          path === "owner/creators") &&
        method === "POST"
      ) {
        const b = await readBody(request);
        const rows = z
          .array(creatorSchema)
          .min(1)
          .max(500)
          .parse(path.startsWith("owner/import") ? b.rows : [b]);
        return json(
          await upsertCreators(rows, a.id, path === "owner/import/preview"),
        );
      }
      if (path === "owner/access" && method === "POST") {
        const b = z
          .object({
            userId: z.string().min(1).max(200),
            grant: z.boolean(),
            packageId: z.string().max(40).optional(),
            reason: z.string().trim().min(5).max(300),
          })
          .parse(await readBody(request));
        const target = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, b.userId))
          .get();
        if (!target) throw new ApiError(404, "Account not found.");
        if (
          b.grant &&
          !(await db
            .select()
            .from(packages)
            .where(eq(packages.id, b.packageId || ""))
            .get())
        )
          throw new ApiError(400, "Choose a configured package first.");
        await db.batch([
          db
            .update(accounts)
            .set({
              accessUntil: b.grant ? Date.now() + 30 * 86400000 : null,
              packageId: b.grant ? b.packageId : null,
              accessSource: b.grant ? "owner" : null,
            })
            .where(eq(accounts.id, b.userId)),
          log(a.id, b.grant ? "access_granted" : "access_revoked", b),
        ]);
        return json({ ok: true });
      }
    }
    throw new ApiError(404, "This page or endpoint was not found.");
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 4)
            .join("; "),
        },
        400,
      );
    if (error instanceof Error && error.message.startsWith("Invalid "))
      return json({ error: error.message }, 400);
    console.error(
      "INFLUVIA request failed",
      error instanceof Error
        ? {name:error.name, cause:error.cause instanceof Error ? error.cause.message.replace(/params:[\s\S]*/,"[redacted]") : undefined}
        : "Unknown error",
    );
    return json(
      { error: "We couldn’t complete that request. Please try again." },
      500,
    );
  }
}
