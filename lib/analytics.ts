import { getDb } from "../db";
import { analyticsEvents, accounts, orders, authAttempts } from "../db/schema";
import { and, eq, gte, lt, sql, desc } from "drizzle-orm";
import { z } from "zod";
import {
  ApiError,
  currentUser,
  ownerCheck,
  requireOwner,
  json,
  readBody,
  sameOrigin,
  sha,
  randomToken,
  requestAddress,
} from "./auth";
import { reportResponse } from "./report-workbook";

export function reportPeriod(url: URL) {
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const end = url.searchParams.get("end") || today;
  const start =
    url.searchParams.get("start") ||
    new Date(Date.now() + 19800000 - 29 * 86400000).toISOString().slice(0, 10);
  for (const s of [start, end])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      !Number.isFinite(Date.parse(s)) ||
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
    )
      throw new ApiError(400, "Choose valid report dates.");
  const from = Date.parse(start + "T00:00:00+05:30"),
    to = Date.parse(end + "T00:00:00+05:30") + 86400000;
  if (to <= from || to - from > 92 * 86400000)
    throw new ApiError(400, "Choose a range of up to 92 days.");
  return { start, end, from, to };
}
const validPath = (path: string) =>
  /^\/(?:$|brand$|discover$|demo$|join$|register$|login$|billing$|account$|exports$|privacy$|terms$)/.test(
    path,
  )
    ? path
    : "/";
function sessionToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.match(/(?:^|; )influvia_visit=([a-f0-9]{64})(?:;|$)/)?.[1];
}
export async function recordEvent(
  request: Request,
  kind: string,
  userId?: string,
  path = "/",
  label = "",
) {
  if (request.headers.get("cookie")?.includes("influvia_analytics=off")) return;
  if (
    request.headers.get("dnt") === "1" ||
    request.headers.get("sec-gpc") === "1"
  )
    return;
  const token = sessionToken(request);
  if (!token) return;
  await getDb()
    .insert(analyticsEvents)
    .values({
      id: crypto.randomUUID(),
      sessionId: await sha(token),
      userId: userId || null,
      kind,
      path: validPath(path),
      label,
      createdAt: Date.now(),
    });
}
export async function safeRecordEvent(...args: Parameters<typeof recordEvent>) {
  try {
    await recordEvent(...args);
  } catch {
    console.error("Analytics event could not be recorded");
  }
}
export async function analyticsRoute(
  request: Request,
  path: string,
): Promise<Response | null> {
  const db = getDb();
  if (path === "analytics/preference" && request.method === "POST") {
    sameOrigin(request);
    const b = z.object({ enabled: z.boolean() }).parse(await readBody(request));
    const response = json({ ok: true });
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    response.headers.append(
      "Set-Cookie",
      `influvia_analytics=${b.enabled ? "on" : "off"}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    );
    if (!b.enabled)
      response.headers.append(
        "Set-Cookie",
        `influvia_visit=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      );
    return response;
  }
  if (path === "analytics/event" && request.method === "POST") {
    sameOrigin(request);
    if (
      request.headers.get("cookie")?.includes("influvia_analytics=off") ||
      request.headers.get("dnt") === "1" ||
      request.headers.get("sec-gpc") === "1"
    )
      return json({ ok: true, skipped: true });
    const b = z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["page_view", "click", "share"]),
        path: z.string().max(100),
        label: z.string().max(80).default(""),
        source: z.string().max(100).default("Direct"),
      })
      .parse(await readBody(request));
    if (b.path.startsWith("/owner") || b.path.startsWith("/admin"))
      return json({ ok: true, skipped: true });
    const user = await currentUser();
    if (user && ownerCheck(user)) return json({ ok: true, skipped: true });
    const now = Date.now(),
      rateId = await sha(
        "analytics:" + requestAddress(request),
      );
    await db
      .insert(authAttempts)
      .values({ id: rateId, attempts: 1, expiresAt: now + 60000 })
      .onConflictDoUpdate({
        target: authAttempts.id,
        set: {
          attempts: sql`case when ${authAttempts.expiresAt}<${now} then 1 else ${authAttempts.attempts}+1 end`,
          expiresAt: sql`case when ${authAttempts.expiresAt}<${now} then ${now + 60000} else ${authAttempts.expiresAt} end`,
        },
      });
    const rate = await db
      .select()
      .from(authAttempts)
      .where(eq(authAttempts.id, rateId))
      .get();
    if ((rate?.attempts || 0) > 120)
      throw new ApiError(429, "Please try again shortly.");
    const token = sessionToken(request) || randomToken(),
      ua = request.headers.get("user-agent") || "";
    const device = /ipad|tablet/i.test(ua)
      ? "tablet"
      : /mobile|android/i.test(ua)
        ? "mobile"
        : "desktop";
    const source = /^[a-z0-9 ._-]{1,100}$/i.test(b.source)
      ? b.source
      : "Referral";
    // No query strings, fragments, form values, IP addresses or full referrer URLs are stored.
    await db
      .insert(analyticsEvents)
      .values({
        id: b.id,
        sessionId: await sha(token),
        userId: user?.id || null,
        kind: b.kind,
        path: validPath(b.path),
        label: b.label.replace(/[^a-z0-9 /#._→&-]/gi, "").slice(0, 80),
        source,
        device,
        createdAt: now,
      })
      .onConflictDoNothing();
    const response = json({ ok: true });
    response.headers.append(
      "Set-Cookie",
      `influvia_visit=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    );
    await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt, now - 93 * 86400000));
    return response;
  }
  if (!["owner/analytics", "owner/analytics/export"].includes(path))
    return null;
  await requireOwner();
  if (request.method !== "GET")
    throw new ApiError(405, "Use a report request.");
  const period = reportPeriod(new URL(request.url));
  await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt,Date.now()-93*86400000));
  const predicate = and(
    gte(analyticsEvents.createdAt, period.from),
    lt(analyticsEvents.createdAt, period.to),
  );
  const [counts, days, pages, sources, clicks, devices, nonbuyers, summary] =
    await Promise.all([
      db
        .select({
          kind: analyticsEvents.kind,
          count: sql<number>`count(*)`,
          sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
        })
        .from(analyticsEvents)
        .where(predicate)
        .groupBy(analyticsEvents.kind),
      db
        .select({
          day: sql<string>`date(${analyticsEvents.createdAt}/1000,'unixepoch','+5 hours','+30 minutes')`,
          views: sql<number>`sum(case when kind='page_view' then 1 else 0 end)`,
          searches: sql<number>`sum(case when kind='search' then 1 else 0 end)`,
          purchases: sql<number>`sum(case when kind='purchase' then 1 else 0 end)`,
        })
        .from(analyticsEvents)
        .where(predicate)
        .groupBy(
          sql`date(${analyticsEvents.createdAt}/1000,'unixepoch','+5 hours','+30 minutes')`,
        ),
      db
        .select({ name: analyticsEvents.path, count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(and(predicate, eq(analyticsEvents.kind, "page_view")))
        .groupBy(analyticsEvents.path)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          name: analyticsEvents.source,
          count: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
        })
        .from(analyticsEvents)
        .where(and(predicate, eq(analyticsEvents.kind, "page_view")))
        .groupBy(analyticsEvents.source)
        .orderBy(desc(sql`count(*)`))
        .limit(15),
      db
        .select({ name: analyticsEvents.label, count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(and(predicate, eq(analyticsEvents.kind, "click")))
        .groupBy(analyticsEvents.label)
        .orderBy(desc(sql`count(*)`))
        .limit(15),
      db
        .select({
          name: analyticsEvents.device,
          count: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
        })
        .from(analyticsEvents)
        .where(and(predicate, eq(analyticsEvents.kind, "page_view")))
        .groupBy(analyticsEvents.device),
      db
        .select({
          id: accounts.id,
          name: accounts.name,
          email: accounts.email,
          lastSignIn: sql<number>`max(${analyticsEvents.createdAt})`,
        })
        .from(analyticsEvents)
        .innerJoin(accounts, eq(accounts.id, analyticsEvents.userId))
        .where(
          and(
            predicate,
            eq(analyticsEvents.kind, "sign_in"),
            sql`not exists(select 1 from orders where user_id=${accounts.id} and status='paid' and mode='live')`,
          ),
        )
        .groupBy(accounts.id)
        .orderBy(desc(sql`max(${analyticsEvents.createdAt})`))
        .limit(100),
      db
        .select({
          sessions: sql<number>`count(distinct case when kind='page_view' then session_id end)`,
          signedInWithoutPurchase: sql<number>`count(distinct case when kind='sign_in' and user_id is not null and not exists(select 1 from orders where orders.user_id=analytics_events.user_id and orders.status='paid' and orders.mode='live') then user_id end)`,
        })
        .from(analyticsEvents)
        .where(predicate)
        .get(),
    ]);
  const result = {
    period,
    counts,
    days,
    pages,
    sources,
    clicks,
    devices,
    nonbuyers,
    summary,
    retentionDays: 93,
  };
  if (path.endsWith("/export"))
    return reportResponse(
      [
        {
          name: "Metrics",
          rows: [
            ["Event", "Events", "Sessions"],
            ...counts.map((c) => [c.kind, c.count, c.sessions]),
          ],
        },
        {
          name: "Daily activity",
          rows: [
            ["Day (IST)", "Page views", "Searches", "Purchases"],
            ...days.map((d) => [d.day, d.views, d.searches, d.purchases]),
          ],
        },
        {
          name: "Top pages",
          rows: [["Page", "Views"], ...pages.map((p) => [p.name, p.count])],
        },
        {
          name: "Sources",
          rows: [
            ["Source", "Sessions"],
            ...sources.map((p) => [p.name, p.count]),
          ],
        },
        {
          name: "Non-buyers",
          rows: [
            ["Name", "Email", "Last sign-in (UTC)"],
            ...nonbuyers.map((u) => [
              u.name,
              u.email,
              new Date(u.lastSignIn).toISOString(),
            ]),
          ],
        },
        {
          name: "Report details",
          rows: [
            ["Start", period.start],
            ["End", period.end],
            ["Timezone", "Asia/Kolkata"],
            [
              "Non-buyers",
              "Up to 100 recent users who signed in during this period and have no live paid order",
            ],
            [
              "Tracking",
              "Starts at deployment; opt-outs and owner activity excluded. Sessions are 30-minute browser visits, not unique people.",
            ],
          ],
        },
      ],
      "influvia-analytics",
    );
  return json(result);
}
