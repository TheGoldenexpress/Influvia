import { cookies } from "next/headers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDb, getBinding } from "../db";
import {
  accounts,
  credentials,
  sessions,
  identities,
  oauthStates,
  authAttempts,
} from "../db/schema";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { safeRecordEvent } from "./analytics";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const runtime = () => process.env;
export const requestAddress = (r: Request) =>
  process.env.VERCEL
    ? r.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "loopback";
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function requestOrigin(r: Request) {
  const url = new URL(r.url);
  const protocol = process.env.VERCEL
    ? (r.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol)
    : url.protocol;
  return `${protocol}//${r.headers.get("host") || url.host}`;
}
export function sameOrigin(r: Request) {
  if (r.headers.get("origin") !== requestOrigin(r))
    throw new ApiError(403, "Please submit this request from INFLUVIA.");
}
export async function readBody(r: Request) {
  if (Number(r.headers.get("content-length") || 0) > 2_000_000)
    throw new ApiError(413, "Upload at most 500 rows and 2 MB at once.");
  const s = await r.text();
  if (s.length > 2_000_000) throw new ApiError(413, "Request is too large.");
  try {
    return JSON.parse(s);
  } catch {
    throw new ApiError(400, "Invalid request.");
  }
}
const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(b))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export const sha = async (v: string) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
function secureCookie(
  r: Request,
  name: string,
  value: string,
  seconds: number,
) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
}
function sessionName(r: Request) {
  return new URL(r.url).protocol === "https:"
    ? "__Host-influvia_session"
    : "influvia_session";
}
export async function sessionCookie(
  r: Request,
  id: string,
  expectedPasswordHash?: string,
) {
  const token = randomToken();
  if (expectedPasswordHash) {
    const binding = getBinding();
    if (!binding)
      throw new ApiError(
        503,
        "The account database is unavailable. Please try again.",
      );
    const result = await binding
      .prepare(
        "INSERT INTO sessions (token_hash,user_id,expires_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM credentials WHERE user_id=? AND password_hash=?)",
      )
      .bind(
        await sha(token),
        id,
        Date.now() + 30 * 86400000,
        id,
        expectedPasswordHash,
      )
      .run();
    if (result.meta.changes !== 1)
      throw new ApiError(401, "Your password changed. Please sign in again.");
    return secureCookie(r, sessionName(r), token, 30 * 86400);
  }
  await getDb()
    .insert(sessions)
    .values({
      tokenHash: await sha(token),
      userId: id,
      expiresAt: Date.now() + 30 * 86400000,
    });
  return secureCookie(r, sessionName(r), token, 30 * 86400);
}
export async function currentUser() {
  const db = getDb();
  const c = await cookies();
  const token =
    c.get("__Host-influvia_session")?.value || c.get("influvia_session")?.value;
  if (token) {
    const row = await db
      .select({ user: accounts })
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, await sha(token)),
          gt(sessions.expiresAt, Date.now()),
        ),
      )
      .get();
    return row
      ? { ...row.user, ownerAuthenticated: row.user.ownerPasswordEnabled }
      : null;
  }
  const native = await getChatGPTUser();
  if (!native) return null;
  const existing = await db
    .select()
    .from(accounts)
    .where(
      or(
        eq(accounts.id, native.userId),
        eq(accounts.email, native.email.toLowerCase()),
      ),
    )
    .get();
  const nativeAccountId = existing?.id || native.userId;
  await db
    .insert(accounts)
    .values({
      id: nativeAccountId,
      name: native.displayName,
      email: native.email.toLowerCase(),
      emailVerified: true,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({ target: accounts.id, set: { emailVerified: true } });
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, nativeAccountId))
    .get();
  return account ? { ...account, ownerAuthenticated: true } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user)
    throw new ApiError(
      401,
      "Create a free account or sign in to search creators.",
    );
  return user;
}
export function ownerEmails() {
  return String(runtime().OWNER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export function ownerCheck(
  user: typeof accounts.$inferSelect & { ownerAuthenticated?: boolean },
) {
  return (
    user.emailVerified &&
    user.ownerAuthenticated === true &&
    ownerEmails().includes(user.email.toLowerCase())
  );
}
export async function requireOwner() {
  const user = await requireUser();
  if (!ownerCheck(user))
    throw new ApiError(
      403,
      "This area is available to authorised owners only.",
    );
  return user;
}
export async function throttle(r: Request, email: string) {
  const id = await sha(
    `${requestAddress(r)}|${email}`,
  );
  const now = Date.now();
  const db = getDb();
  await db
    .insert(authAttempts)
    .values({ id, attempts: 1, expiresAt: now + 15 * 60000 })
    .onConflictDoUpdate({
      target: authAttempts.id,
      set: {
        attempts: sql`case when ${authAttempts.expiresAt}<${now} then 1 else ${authAttempts.attempts}+1 end`,
        expiresAt: sql`case when ${authAttempts.expiresAt}<${now} then ${now + 15 * 60000} else ${authAttempts.expiresAt} end`,
      },
    });
  const a = await db
    .select()
    .from(authAttempts)
    .where(eq(authAttempts.id, id))
    .get();
  if (a && a.attempts > 12)
    throw new ApiError(
      429,
      "Too many attempts. Please try again in 15 minutes.",
    );
}
const authSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  name: z.string().trim().max(100).optional(),
});
export async function authRoute(r: Request, path: string) {
  const db = getDb();
  if (path === "auth/providers" && r.method === "GET")
    return json({
      google: !!runtime().GOOGLE_CLIENT_ID && !!runtime().GOOGLE_CLIENT_SECRET,
      facebook:
        !!runtime().FACEBOOK_CLIENT_ID && !!runtime().FACEBOOK_CLIENT_SECRET,
    });
  if (path === "auth/register" && r.method === "POST") {
    sameOrigin(r);
    const b = authSchema
      .extend({ name: z.string().trim().min(2).max(100) })
      .parse(await readBody(r));
    await throttle(r, b.email);
    if (
      await db.select().from(accounts).where(eq(accounts.email, b.email)).get()
    )
      throw new ApiError(
        409,
        "An account already exists with this email. Please sign in.",
      );
    const id = crypto.randomUUID(),
      salt = randomToken();
    const passwordHash = await hashPassword(b.password, salt);
    await db.batch([
      db.insert(accounts).values({
        id,
        email: b.email,
        name: b.name,
        emailVerified: false,
        createdAt: Date.now(),
      }),
      db.insert(credentials).values({ userId: id, passwordHash, salt }),
    ]);
    await safeRecordEvent(r, "registration", id, "/join");
    const response = json({ ok: true });
    response.headers.append("Set-Cookie", await sessionCookie(r, id));
    return response;
  }
  if (
    (path === "auth/login" || path === "auth/owner-login") &&
    r.method === "POST"
  ) {
    sameOrigin(r);
    const b = authSchema.parse(await readBody(r));
    await throttle(r, b.email);
    const row = await db
      .select({ account: accounts, credential: credentials })
      .from(accounts)
      .innerJoin(credentials, eq(accounts.id, credentials.userId))
      .where(eq(accounts.email, b.email))
      .get();
    const candidate = await hashPassword(
      b.password,
      row?.credential.salt || "invalid-account-timing-salt",
    );
    if (!row || candidate !== row.credential.passwordHash)
      throw new ApiError(401, "The email or password doesn’t match.");
    if (
      path === "auth/owner-login" &&
      !ownerCheck({
        ...row.account,
        ownerAuthenticated: row.account.ownerPasswordEnabled,
      })
    )
      throw new ApiError(
        403,
        "Accept your owner invitation before signing in to the admin studio.",
      );
    if (!ownerEmails().includes(row.account.email))
      await safeRecordEvent(r, "sign_in", row.account.id, "/login");
    const response = json({ ok: true });
    response.headers.append(
      "Set-Cookie",
      await sessionCookie(r, row.account.id, row.credential.passwordHash),
    );
    return response;
  }
  if (path === "auth/logout" && r.method === "POST") {
    sameOrigin(r);
    const c = await cookies();
    const token =
      c.get("__Host-influvia_session")?.value ||
      c.get("influvia_session")?.value;
    if (token)
      await db.delete(sessions).where(eq(sessions.tokenHash, await sha(token)));
    const response = json({ ok: true, native: !!(await getChatGPTUser()) });
    response.headers.append(
      "Set-Cookie",
      secureCookie(r, sessionName(r), "", 0),
    );
    return response;
  }
  const start = path.match(/^auth\/(google|facebook)$/);
  const callback = path.match(/^auth\/(google|facebook)\/callback$/);
  if (!start && !callback) return null;
  const provider = (start || callback)![1],
    e = runtime(),
    google = provider === "google";
  const clientId = google ? e.GOOGLE_CLIENT_ID : e.FACEBOOK_CLIENT_ID;
  const secret = google ? e.GOOGLE_CLIENT_SECRET : e.FACEBOOK_CLIENT_SECRET;
  if (!clientId || !secret)
    return Response.redirect(
      new URL(`/login?notice=${provider}-setup`, r.url),
      303,
    );
  const origin = requestOrigin(r),
    redirectUri = `${origin}/api/auth/${provider}/callback`;
  if (start) {
    const state = randomToken(),
      verifier = randomToken();
    await db.insert(oauthStates).values({
      state,
      provider,
      verifier,
      expiresAt: Date.now() + 10 * 60000,
    });
    const target = new URL(
      google
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://www.facebook.com/v23.0/dialog/oauth",
    );
    target.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: google ? "openid email profile" : "email,public_profile",
      state,
    }).toString();
    if (google) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier),
      );
      target.searchParams.set(
        "code_challenge",
        btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", ""),
      );
      target.searchParams.set("code_challenge_method", "S256");
    }
    const response = Response.redirect(target, 303);
    const out = new Response(null, response);
    out.headers.append(
      "Set-Cookie",
      secureCookie(r, "influvia_oauth_state", state, 600),
    );
    return out;
  }
  const url = new URL(r.url),
    state = url.searchParams.get("state"),
    code = url.searchParams.get("code");
  const c = await cookies();
  if (!state || state !== c.get("influvia_oauth_state")?.value || !code)
    throw new ApiError(400, "Sign-in was not completed. Please try again.");
  const stored = await db
    .select()
    .from(oauthStates)
    .where(
      and(
        eq(oauthStates.state, state),
        eq(oauthStates.provider, provider),
        gt(oauthStates.expiresAt, Date.now()),
      ),
    )
    .get();
  if (!stored)
    throw new ApiError(
      400,
      "This sign-in request expired. Please start again.",
    );
  await db.delete(oauthStates).where(eq(oauthStates.state, state));
  const tokenResponse = await fetch(
    google
      ? "https://oauth2.googleapis.com/token"
      : "https://graph.facebook.com/v23.0/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
        ...(google ? { code_verifier: stored.verifier } : {}),
      }),
    },
  );
  if (!tokenResponse.ok)
    throw new ApiError(
      400,
      "The sign-in provider could not verify this request.",
    );
  const tokens = (await tokenResponse.json()) as any;
  const profileResponse = await fetch(
    google
      ? "https://openidconnect.googleapis.com/v1/userinfo"
      : "https://graph.facebook.com/v23.0/me?fields=id,name,email",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  if (!profileResponse.ok)
    throw new ApiError(400, "We couldn’t load your sign-in profile.");
  const profile = (await profileResponse.json()) as any;
  const email = String(profile.email || "").toLowerCase();
  if (
    !z.string().email().safeParse(email).success ||
    (google && !profile.email_verified)
  )
    throw new ApiError(
      400,
      "A verified email address is required from your sign-in provider.",
    );
  const providerId = String(google ? profile.sub : profile.id);
  const identityId = `${provider}:${providerId}`;
  let identity = await db
    .select()
    .from(identities)
    .where(eq(identities.id, identityId))
    .get();
  let id = identity?.userId;
  if (!id) {
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .get();
    if (existing && !google)
      throw new ApiError(
        409,
        "This email already has an account. Sign in with its existing method before linking another provider.",
      );
    id = existing?.id || crypto.randomUUID();
    await db.batch([
      db
        .insert(accounts)
        .values({
          id,
          email,
          name: String(profile.name || email).slice(0, 100),
          emailVerified: google,
          createdAt: Date.now(),
        })
        .onConflictDoNothing(),
      db
        .insert(identities)
        .values({ id: identityId, userId: id, provider, providerId }),
    ]);
    if (google)
      await db
        .update(accounts)
        .set({ emailVerified: true })
        .where(eq(accounts.id, id));
  }
  const response = new Response(null, {
    status: 303,
    headers: { Location: `${origin}/brand` },
  });
  if (!ownerEmails().includes(email))
    await safeRecordEvent(r, "sign_in", id!, "/login", provider);
  response.headers.append("Set-Cookie", await sessionCookie(r, id));
  response.headers.append(
    "Set-Cookie",
    secureCookie(r, "influvia_oauth_state", "", 0),
  );
  return response;
}
