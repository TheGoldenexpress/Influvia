import { and, eq, desc, gt, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, getBinding } from "../db";
import { accounts, audit, ownerInvitations } from "../db/schema";
import {
  ApiError,
  hashPassword,
  json,
  ownerEmails,
  randomToken,
  readBody,
  requireOwner,
  runtime,
  sameOrigin,
  sessionCookie,
  sha,
  throttle,
  requestOrigin,
} from "./auth";

const tokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "This invitation link is invalid.");
const emailSchema = z.string().trim().toLowerCase().email().max(200);
const unavailable = () =>
  new ApiError(
    410,
    "This invitation has expired, was revoked, or has already been used. Ask an owner for a new invitation.",
  );

// Only hashes are configured at deployment. Re-reading cannot resurrect a consumed invitation.
async function seedInvitations() {
  const text = runtime().OWNER_INVITE_SEEDS;
  if (!text) return;
  const seeds = z
    .array(
      z.object({
        id: z.string().uuid(),
        email: emailSchema,
        tokenHash: tokenSchema,
        createdAt: z.number().int().positive(),
        expiresAt: z.number().int().positive(),
      }),
    )
    .max(10)
    .parse(JSON.parse(text));
  const allowed = ownerEmails();
  const rows = seeds
    .filter((s) => allowed.includes(s.email) && s.expiresAt > Date.now())
    .map((s) => ({ ...s, createdBy: "deployment" }));
  if (rows.length)
    await getDb().insert(ownerInvitations).values(rows).onConflictDoNothing();
}

async function findInvitation(token: string) {
  const invitation = await getDb()
    .select()
    .from(ownerInvitations)
    .where(
      and(
        eq(ownerInvitations.tokenHash, await sha(token)),
        gt(ownerInvitations.expiresAt, Date.now()),
        isNull(ownerInvitations.acceptedAt),
        isNull(ownerInvitations.revokedAt),
      ),
    )
    .get();
  if (!invitation || !ownerEmails().includes(invitation.email))
    throw unavailable();
  return invitation;
}

export async function ownerInvitationRoute(
  request: Request,
  path: string,
): Promise<Response | null> {
  if (
    ![
      "auth/owner-invitation",
      "auth/owner-accept",
      "owner/invitations",
      "owner/invitations/revoke",
    ].includes(path)
  )
    return null;
  const db = getDb();
  if (path.startsWith("auth/")) {
    if (request.method !== "POST")
      throw new ApiError(405, "Use the invitation form to continue.");
    sameOrigin(request);
    await throttle(request, "owner-invitation");
    const body = z
      .object({ token: tokenSchema })
      .passthrough()
      .parse(await readBody(request));
    await seedInvitations();
    const invitation = await findInvitation(body.token);
    if (path === "auth/owner-invitation")
      return json({ email: invitation.email, expiresAt: invitation.expiresAt });
    const input = z
      .object({
        email: emailSchema,
        name: z.string().trim().min(2).max(100),
        password: z.string().min(10, "Use at least 10 characters.").max(128),
      })
      .parse(body);
    if (input.email !== invitation.email)
      throw new ApiError(
        400,
        "Use the email address this invitation was issued to.",
      );
    const salt = randomToken();
    const passwordHash = await hashPassword(input.password, salt);
    const now = Date.now();
    const id = crypto.randomUUID();
    const guard =
      "EXISTS (SELECT 1 FROM owner_invitations WHERE token_hash = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?)";
    const args = [invitation.tokenHash, invitation.email, now];
    const binding = getBinding();
    if (!binding)
      throw new ApiError(
        503,
        "The account database is unavailable. Please try again.",
      );
    // Every mutation is guarded; the database batch is a serializable transaction.
    // Two simultaneous submissions cannot both consume an invitation or change credentials.
    const result = await binding.batch([
      binding
        .prepare(
          `INSERT INTO accounts (id,email,name,email_verified,owner_password_enabled,created_at) SELECT ?,?,?,1,1,? WHERE ${guard} ON CONFLICT(email) DO UPDATE SET name=excluded.name,email_verified=1,owner_password_enabled=1`,
        )
        .bind(id, invitation.email, input.name, now, ...args),
      binding
        .prepare(
          `INSERT INTO credentials (user_id,password_hash,salt) SELECT (SELECT id FROM accounts WHERE email=?),?,? WHERE ${guard} ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt`,
        )
        .bind(invitation.email, passwordHash, salt, ...args),
      binding
        .prepare(
          `DELETE FROM sessions WHERE user_id=(SELECT id FROM accounts WHERE email=?) AND ${guard}`,
        )
        .bind(invitation.email, ...args),
      binding
        .prepare(
          `INSERT INTO audit (id,user_id,action,details,created_at) SELECT ?,(SELECT id FROM accounts WHERE email=?),'owner_invitation_accepted',?,? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          invitation.email,
          JSON.stringify({
            email: invitation.email,
            invitationId: invitation.id,
          }),
          now,
          ...args,
        ),
      binding
        .prepare(
          `UPDATE owner_invitations SET accepted_at=? WHERE token_hash=? AND email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?`,
        )
        .bind(now, ...args),
    ]);
    if (result[4].meta.changes !== 1) throw unavailable();
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, invitation.email))
      .get();
    if (!account)
      throw new ApiError(500, "Please sign in with your new owner password.");
    const response = json({ ok: true });
    response.headers.append(
      "Set-Cookie",
      await sessionCookie(request, account.id, passwordHash),
    );
    return response;
  }
  const owner = await requireOwner();
  if (request.method !== "GET" && request.method !== "POST")
    throw new ApiError(405, "Unsupported method.");
  if (request.method === "POST") sameOrigin(request);
  await seedInvitations();
  if (path === "owner/invitations" && request.method === "GET") {
    const emails = ownerEmails();
    const invitations = await db
      .select({
        id: ownerInvitations.id,
        email: ownerInvitations.email,
        createdAt: ownerInvitations.createdAt,
        expiresAt: ownerInvitations.expiresAt,
        acceptedAt: ownerInvitations.acceptedAt,
        revokedAt: ownerInvitations.revokedAt,
      })
      .from(ownerInvitations)
      .orderBy(desc(ownerInvitations.createdAt))
      .limit(100);
    const owners = emails.length
      ? await db
          .select({
            email: accounts.email,
            name: accounts.name,
            enabled: accounts.ownerPasswordEnabled,
          })
          .from(accounts)
          .where(inArray(accounts.email, emails))
      : [];
    return json({
      owners: emails.map((email) => ({
        email,
        name: owners.find((a) => a.email === email)?.name || "Invited owner",
        enabled: owners.some((a) => a.email === email && a.enabled),
      })),
      invitations,
    });
  }
  if (path === "owner/invitations" && request.method === "POST") {
    const { email } = z
      .object({ email: emailSchema })
      .parse(await readBody(request));
    if (!ownerEmails().includes(email))
      throw new ApiError(
        400,
        "Invitations can only be issued to authorised owner emails.",
      );
    const token = randomToken(),
      now = Date.now(),
      id = crypto.randomUUID();
    const expiresAt = now + 72 * 3600000;
    await db.batch([
      db
        .update(ownerInvitations)
        .set({ revokedAt: now })
        .where(
          and(
            eq(ownerInvitations.email, email),
            isNull(ownerInvitations.acceptedAt),
            isNull(ownerInvitations.revokedAt),
          ),
        ),
      db.insert(ownerInvitations).values({
        id,
        email,
        tokenHash: await sha(token),
        createdAt: now,
        expiresAt,
        createdBy: owner.id,
      }),
      db.insert(audit).values({
        id: crypto.randomUUID(),
        userId: owner.id,
        action: "owner_invitation_created",
        details: JSON.stringify({ email, invitationId: id }),
        createdAt: now,
      }),
    ]);
    const link = new URL("/owner/accept-invite", requestOrigin(request));
    link.hash = `token=${token}`;
    return json({ ok: true, url: link.toString(), email, expiresAt });
  }
  if (path === "owner/invitations/revoke" && request.method === "POST") {
    const { id } = z
      .object({ id: z.string().uuid() })
      .parse(await readBody(request));
    const changed = await db
      .update(ownerInvitations)
      .set({ revokedAt: Date.now() })
      .where(
        and(
          eq(ownerInvitations.id, id),
          isNull(ownerInvitations.acceptedAt),
          isNull(ownerInvitations.revokedAt),
        ),
      )
      .returning({ id: ownerInvitations.id });
    if (!changed.length)
      throw new ApiError(409, "This invitation is no longer pending.");
    await db.insert(audit).values({
      id: crypto.randomUUID(),
      userId: owner.id,
      action: "owner_invitation_revoked",
      details: JSON.stringify({ invitationId: id }),
      createdAt: Date.now(),
    });
    return json({ ok: true });
  }
  throw new ApiError(405, "Unsupported method.");
}
