import { getDb } from "../db";
import { orders, accounts, financeEntries, audit } from "../db/schema";
import { and, eq, gte, lt, sql, desc, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { ApiError, requireOwner, readBody, sameOrigin, json } from "./auth";
import { reportPeriod } from "./analytics";
import { CURRENCIES, providerById } from "./payment-catalog";
import { settleOrder } from "./payments";
import { reportResponse } from "./report-workbook";
export async function financeRoute(
  request: Request,
  path: string,
): Promise<Response | null> {
  if (!path.startsWith("owner/finance")) return null;
  const owner = await requireOwner(),
    db = getDb(),
    url = new URL(request.url);
  if (request.method === "POST") {
    sameOrigin(request);
    if (path === "owner/finance/entry") {
      const b = z
        .object({
          kind: z.enum(["expense", "income", "fee"]),
          amount: z.number().int().positive().max(100000000),
          currency: z.enum(CURRENCIES),
          category: z.string().trim().min(2).max(80),
          description: z.string().trim().min(3).max(300),
          reference: z.string().trim().max(150),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(await readBody(request));
      const occurredAt = Date.parse(b.date + "T12:00:00+05:30");
      if (!Number.isFinite(occurredAt) || occurredAt > Date.now() + 86400000)
        throw new ApiError(400, "Choose a valid transaction date.");
      const { date, ...values } = b,
        id = crypto.randomUUID(),
        now = Date.now();
      await db.batch([
        db
          .insert(financeEntries)
          .values({
            ...values,
            id,
            occurredAt,
            createdAt: now,
            createdBy: owner.id,
          }),
        db
          .insert(audit)
          .values({
            id: crypto.randomUUID(),
            userId: owner.id,
            action: "finance_entry_added",
            details: JSON.stringify({
              entryId: id,
              kind: b.kind,
              currency: b.currency,
              amount: b.amount,
            }),
            createdAt: now,
          }),
      ]);
      return json({ ok: true });
    }
    if (path === "owner/finance/void") {
      const b = z
        .object({
          id: z.string().uuid(),
          reason: z.string().trim().min(5).max(300),
        })
        .parse(await readBody(request));
      const changed = await db
        .update(financeEntries)
        .set({ voidedAt: Date.now() })
        .where(
          and(eq(financeEntries.id, b.id), isNull(financeEntries.voidedAt)),
        )
        .returning({ id: financeEntries.id });
      if (!changed.length)
        throw new ApiError(
          409,
          "This entry is already void or does not exist.",
        );
      await db
        .insert(audit)
        .values({
          id: crypto.randomUUID(),
          userId: owner.id,
          action: "finance_entry_voided",
          details: JSON.stringify(b),
          createdAt: Date.now(),
        });
      return json({ ok: true });
    }
    if (path === "owner/finance/reconcile") {
      const b = z
        .object({
          orderId: z.string().uuid(),
          action: z.enum(["approve", "reject"]),
          paymentId: z.string().trim().min(3).max(150),
          reason: z.string().trim().min(5).max(300),
        })
        .parse(await readBody(request));
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, b.orderId))
        .get();
      if (!order || !["created", "awaiting_review"].includes(order.status))
        throw new ApiError(
          409,
          "This order is no longer awaiting confirmation.",
        );
      if (providerById(order.provider)?.type === "api")
        throw new ApiError(
          400,
          "API payments must be captured and verified through the provider.",
        );
      if (b.action === "approve")
        await settleOrder(order, b.paymentId, undefined, "owner:" + owner.id);
      else
        await db
          .update(orders)
          .set({ status: "rejected" })
          .where(
            and(
              eq(orders.id, order.id),
              inArray(orders.status, ["created", "awaiting_review"]),
            ),
          );
      await db
        .insert(audit)
        .values({
          id: crypto.randomUUID(),
          userId: owner.id,
          action: "payment_receipt_" + b.action,
          details: JSON.stringify(b),
          createdAt: Date.now(),
        });
      return json({ ok: true });
    }
    if (path === "owner/finance/refund") {
      const b = z
        .object({
          orderId: z.string(),
          amount: z.number().int().positive(),
          reference: z.string().trim().min(3).max(150),
          reason: z.string().trim().min(5).max(300),
        })
        .parse(await readBody(request));
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, b.orderId))
        .get();
      if (!order || order.status !== "paid")
        throw new ApiError(400, "Choose a paid order.");
      const updated = await db
        .update(orders)
        .set({ refundedAmount: sql`${orders.refundedAmount}+${b.amount}` })
        .where(
          and(
            eq(orders.id, order.id),
            sql`${orders.refundedAmount}+${b.amount}<=${orders.amount}`,
          ),
        )
        .returning();
      if (!updated.length)
        throw new ApiError(
          400,
          "Refund exceeds the amount remaining on this payment.",
        );
      if (updated[0].refundedAmount === order.amount)
        await db
          .update(accounts)
          .set({ accessUntil: null, packageId: null, accessSource: null })
          .where(
            and(
              eq(accounts.id, order.userId),
              eq(accounts.accessSource, `payment:${order.id}`),
            ),
          );
      await db
        .insert(audit)
        .values({
          id: crypto.randomUUID(),
          userId: owner.id,
          action: "refund_recorded",
          details: JSON.stringify(b),
          createdAt: Date.now(),
        });
      return json({ ok: true });
    }
    throw new ApiError(404, "Finance action not found.");
  }
  if (request.method !== "GET")
    throw new ApiError(405, "Unsupported report method.");
  const period = reportPeriod(url),
    mode = z
      .enum(["live", "test"])
      .parse(url.searchParams.get("mode") || "live"),
    currency = z
      .enum(CURRENCIES)
      .parse(url.searchParams.get("currency") || "INR"),
    status = z
      .enum(["", "created", "paid", "failed", "awaiting_review", "rejected"])
      .parse(url.searchParams.get("status") || ""),
    provider = url.searchParams.get("provider") || "";
  if (provider && !providerById(provider))
    throw new ApiError(400, "Unknown provider.");
  const base = and(
    gte(orders.createdAt, period.from),
    lt(orders.createdAt, period.to),
    eq(orders.mode, mode),
    eq(orders.currency, currency),
    provider ? eq(orders.provider, provider) : undefined,
    status ? eq(orders.status, status) : undefined,
  );
  const entryWhere = and(
    gte(financeEntries.occurredAt, period.from),
    lt(financeEntries.occurredAt, period.to),
    eq(financeEntries.currency, currency),
  );
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(url.searchParams.get("page") || 1);
  const [totals, entryTotals, count, daily, byProvider, entries, rows] =
    await Promise.all([
      db
        .select({
          collected: sql<number>`coalesce(sum(case when status='paid' then amount else 0 end),0)`,
          refunded: sql<number>`coalesce(sum(refunded_amount),0)`,
          pending: sql<number>`coalesce(sum(case when status in ('created','awaiting_review') then amount else 0 end),0)`,
          paidCount: sql<number>`sum(case when status='paid' then 1 else 0 end)`,
          reviewCount: sql<number>`sum(case when status='awaiting_review' then 1 else 0 end)`,
        })
        .from(orders)
        .where(base)
        .get(),
      db
        .select({
          income: sql<number>`coalesce(sum(case when kind='income' then amount else 0 end),0)`,
          expenses: sql<number>`coalesce(sum(case when kind='expense' then amount else 0 end),0)`,
          fees: sql<number>`coalesce(sum(case when kind='fee' then amount else 0 end),0)`,
        })
        .from(financeEntries)
        .where(and(entryWhere, isNull(financeEntries.voidedAt)))
        .get(),
      db
        .select({ n: sql<number>`count(*)` })
        .from(orders)
        .where(base)
        .get(),
      db
        .select({
          day: sql<string>`date(created_at/1000,'unixepoch','+5 hours','+30 minutes')`,
          collected: sql<number>`sum(case when status='paid' then amount-refunded_amount else 0 end)`,
        })
        .from(orders)
        .where(base)
        .groupBy(
          sql`date(created_at/1000,'unixepoch','+5 hours','+30 minutes')`,
        ),
      db
        .select({
          name: orders.provider,
          count: sql<number>`count(*)`,
          collected: sql<number>`sum(case when status='paid' then amount-refunded_amount else 0 end)`,
        })
        .from(orders)
        .where(base)
        .groupBy(orders.provider),
      db
        .select()
        .from(financeEntries)
        .where(entryWhere)
        .orderBy(desc(financeEntries.occurredAt))
        .limit(200),
      db
        .select({ order: orders, name: accounts.name, email: accounts.email })
        .from(orders)
        .innerJoin(accounts, eq(accounts.id, orders.userId))
        .where(base)
        .orderBy(desc(orders.createdAt))
        .limit(25)
        .offset((page - 1) * 25),
    ]);
  // Book entries are real-world records; they never mix with test checkout balances.
  const book =
    mode === "live" ? entryTotals : { income: 0, expenses: 0, fees: 0 };
  const summary = {
    ...totals,
    ...book,
    net:
      (totals?.collected || 0) -
      (totals?.refunded || 0) +
      (book?.income || 0) -
      (book?.expenses || 0) -
      (book?.fees || 0),
  };
  if (path === "owner/finance/export") {
    if ((count?.n || 0) > 10000)
      throw new ApiError(
        400,
        "Narrow the date range to export at most 10,000 orders.",
      );
    const all = await db
      .select({ order: orders, name: accounts.name, email: accounts.email })
      .from(orders)
      .innerJoin(accounts, eq(accounts.id, orders.userId))
      .where(base)
      .orderBy(desc(orders.createdAt));
    const allEntries =
      mode === "live"
        ? await db
            .select()
            .from(financeEntries)
            .where(entryWhere)
            .orderBy(desc(financeEntries.occurredAt))
        : [];
    await db
      .insert(audit)
      .values({
        id: crypto.randomUUID(),
        userId: owner.id,
        action: "finance_report_exported",
        details: JSON.stringify({
          start: period.start,
          end: period.end,
          currency,
          mode,
          rowCount: all.length,
        }),
        createdAt: Date.now(),
      });
    return reportResponse(
      [
        {
          name: "Summary",
          rows: [
            ["Metric", "Amount / count", "Currency"],
            ...Object.entries(summary).map(([k, v]) => [
              k,
              k.endsWith("Count") ? v : (Number(v) || 0) / 100,
              currency,
            ]),
          ],
        },
        {
          name: "Payments",
          rows: [
            [
              "Order",
              "Customer",
              "Email",
              "Provider",
              "Mode",
              "Status",
              "Amount",
              "Currency",
              "Refund recorded",
              "Payment ID",
              "Receipt claim",
              "Created (UTC)",
              "Paid (UTC)",
            ],
            ...all.map(({ order: o, name, email }) => [
              o.id,
              name,
              email,
              o.provider,
              o.mode,
              o.status,
              o.amount / 100,
              o.currency,
              o.refundedAmount / 100,
              o.paymentId,
              o.receiptReference,
              new Date(o.createdAt).toISOString(),
              o.paidAt ? new Date(o.paidAt).toISOString() : "",
            ]),
          ],
        },
        {
          name: "Book entries",
          rows: [
            [
              "ID",
              "Type",
              "Category",
              "Amount",
              "Currency",
              "Description",
              "Reference",
              "Date (UTC)",
              "Void",
            ],
            ...allEntries.map((e) => [
              e.id,
              e.kind,
              e.category,
              e.amount / 100,
              e.currency,
              e.description,
              e.reference,
              new Date(e.occurredAt).toISOString(),
              e.voidedAt ? "Yes" : "No",
            ]),
          ],
        },
        {
          name: "Report details",
          rows: [
            ["Period", `${period.start} to ${period.end} (IST)`],
            ["Currency", currency],
            ["Mode", mode],
            ["Payment filters", JSON.stringify({ provider, status })],
            [
              "Book entry filters",
              "Date and currency; independent of payment provider/status",
            ],
            [
              "Accounting basis",
              "Payment cohorts by order creation date. Refunds are totals recorded against those orders, not period refund cash flow. Net is recorded operating activity, not a settled bank balance. No currency conversion.",
            ],
            [
              "Refund recording",
              "Recording a refund does not send funds; process it in the provider account first.",
            ],
          ],
        },
      ],
      "influvia-finance",
    );
  }
  return json({
    period,
    mode,
    currency,
    summary,
    daily,
    byProvider,
    entries: mode === "live" ? entries : [],
    rows: rows.map((r) => ({ ...r.order, name: r.name, email: r.email })),
    total: count?.n || 0,
    page,
    pages: Math.max(1, Math.ceil((count?.n || 0) / 25)),
  });
}
