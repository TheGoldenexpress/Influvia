import assert from "node:assert/strict";
import { qaOwnerCookie } from "./qa-session.mjs";
import { qaQuery } from "./qa-database.mjs";
const base = "http://127.0.0.1:5173",
  nativeOwner = qaOwnerCookie();
const email = "invited-owner@influvia.test",
  password = "Owner QA Password 2026!";
let count = 0,
  requestId = 0;
const check = (value, label) => {
  assert.ok(value, label);
  console.log(`PASS ${++count}: ${label}`);
};
const request = (path, cookie = "", data, origin = base, ip) =>
  fetch(`${base}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      "cf-connecting-ip": ip || `198.51.100.${(++requestId % 240) + 1}`,
      ...(data === undefined
        ? {}
        : { Origin: origin, "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
const body = async (response) => {
  const result = await response.json();
  assert.ok(response.status < 500, JSON.stringify(result));
  return result;
};
const cookie = (response) =>
  response.headers.get("set-cookie")?.split(";")[0] || "";
const tokenOf = (link) =>
  new URLSearchParams(new URL(link).hash.slice(1)).get("token");
const issue = async () => {
  const response = await request("owner/invitations", nativeOwner, { email });
  assert.equal(
    response.status,
    200,
    JSON.stringify(await response.clone().json()),
  );
  const data = await response.json();
  return { ...data, token: tokenOf(data.url) };
};
await body(await request("me", nativeOwner));
await qaQuery("delete from auth_attempts");
const bootstrap = await issue();
const bootstrapInfo = await body(
  await request("auth/owner-invitation", "", { token: bootstrap.token }),
);
check(
  bootstrapInfo.email === bootstrap.email,
  "deployment bootstrap invitation resolves without a ChatGPT account",
);
check(
  (await request("auth/owner-invitation", "", { token: "invalid-token" }))
    .status === 400,
  "malformed invitation tokens are rejected",
);
// The second local owner email must be configured in ignored .dev.vars for this suite.
await request("auth/register", "", {
  email,
  password: "Preclaimed Password 2026!",
  name: "Unverified claim",
});
const unverified = await request("auth/login", "", {
  email,
  password: "Preclaimed Password 2026!",
});
const unverifiedCookie = cookie(unverified);
check(
  (await request("owner/invitations")).status === 401,
  "anonymous visitors cannot inspect owner invitations",
);
if (unverifiedCookie) {
  check(
    (await request("owner/invitations", unverifiedCookie)).status === 403,
    "an unverified account claiming an owner email has no owner access",
  );
  check(
    (
      await request("auth/owner-login", "", {
        email,
        password: "Preclaimed Password 2026!",
      })
    ).status === 403,
    "owner login requires invitation activation",
  );
}
check(
  (
    await request("owner/invitations", nativeOwner, {
      email: "outsider@influvia.test",
    })
  ).status === 400,
  "owners cannot invite emails outside the authorised list",
);
const first = await issue();
check(
  first.token?.length === 64 && first.url.includes("#token="),
  "invitation uses a high-entropy fragment token",
);
const info = await body(
  await request("auth/owner-invitation", "", { token: first.token }),
);
check(
  info.email === email && info.expiresAt > Date.now(),
  "valid invitation resolves its email and expiry without consuming it",
);
const history = await body(await request("owner/invitations", nativeOwner));
check(
  !JSON.stringify(history).includes(first.token) &&
    !JSON.stringify(history).includes("tokenHash"),
  "invitation history exposes neither usable tokens nor hashes",
);
check(
  (
    await request("auth/owner-accept", "", {
      token: first.token,
      email: "wrong@influvia.test",
      name: "Wrong email",
      password,
    })
  ).status === 400,
  "invitation cannot activate a different email",
);
check(
  (
    await request("auth/owner-accept", "", {
      token: first.token,
      email,
      name: "Owner",
      password: "short",
    })
  ).status === 400,
  "weak passwords are rejected before activation",
);
check(
  (
    await request(
      "auth/owner-accept",
      "",
      { token: first.token, email, name: "Owner", password },
      "https://untrusted.invalid",
    )
  ).status === 403,
  "cross-origin invitation acceptance is rejected",
);
const replacement = await issue();
check(
  (await request("auth/owner-invitation", "", { token: first.token }))
    .status === 410,
  "reissuing revokes earlier pending links",
);
const accepted = await request("auth/owner-accept", "", {
  token: replacement.token,
  email,
  name: "Invited QA Owner",
  password,
});
check(
  accepted.status === 200 && !!cookie(accepted),
  "invitation acceptance sets a password and creates a secure session",
);
const ownerCookie = cookie(accepted);
const me = await body(await request("me", ownerCookie));
check(
  me.account?.owner && me.account.email === email,
  "invited owner gains server-authorised admin access without ChatGPT",
);
check(
  (await request("owner/overview", ownerCookie)).status === 200,
  "password-authenticated owner can use admin APIs",
);
check(
  (
    await request("auth/owner-accept", "", {
      token: replacement.token,
      email,
      name: "Owner",
      password: "Attacker Replacement!",
    })
  ).status === 410,
  "accepted invitation cannot be replayed to change the password",
);
if (unverifiedCookie)
  check(
    (await body(await request("me", unverifiedCookie))).account === null,
    "activation invalidates sessions from a preclaimed account",
  );
check(
  (
    await request("auth/login", "", {
      email,
      password: "Preclaimed Password 2026!",
    })
  ).status === 401,
  "a preclaim password is invalid after invitation acceptance",
);
const login = await request("auth/owner-login", "", {
  email: email.toUpperCase(),
  password,
});
check(
  login.status === 200 && !!cookie(login),
  "owner email/password login works with case-insensitive email",
);
await request("auth/logout", cookie(login), {});
check(
  (await request("owner/overview", cookie(login))).status === 401,
  "owner logout invalidates the password session",
);
const pending = await issue();
const pendingHistory = await body(
  await request("owner/invitations", nativeOwner),
);
const pendingRow = pendingHistory.invitations.find(
  (x) => x.email === email && !x.acceptedAt && !x.revokedAt,
);
await body(
  await request("owner/invitations/revoke", nativeOwner, { id: pendingRow.id }),
);
check(
  (await request("auth/owner-invitation", "", { token: pending.token }))
    .status === 410,
  "a revoked invitation cannot be opened",
);
const expiring = await issue();
const expiry = await qaQuery("UPDATE owner_invitations SET expires_at=$1 WHERE email=$2 AND accepted_at IS NULL AND revoked_at IS NULL", [Date.now()-1000,email]);
assert.ok(expiry.count > 0,"isolated expiry fixture found");
check(
  (
    await request("auth/owner-accept", "", {
      token: expiring.token,
      email,
      name: "Owner",
      password,
    })
  ).status === 410,
  "expired invitation cannot change credentials",
);
const concurrent = await issue();
const inFlightLogin = request("auth/owner-login", "", { email, password });
const outcomes = await Promise.all(
  ["Concurrent Password A!", "Concurrent Password B!"].map((p) =>
    request("auth/owner-accept", "", {
      token: concurrent.token,
      email,
      name: "Owner",
      password: p,
    }),
  ),
);
check(
  outcomes.filter((x) => x.status === 200).length === 1 &&
    outcomes.filter((x) => x.status === 410).length === 1,
  "concurrent acceptance has exactly one winner",
);
const oldLogin = await inFlightLogin;
check(
  oldLogin.status === 401 ||
    (await body(await request("me", cookie(oldLogin)))).account === null,
  "a racing old-password login cannot survive password replacement",
);
check(
  (await request("owner/overview", ownerCookie)).status === 401,
  "a password reset invitation invalidates earlier owner sessions",
);
const limited = await Promise.all(
  Array.from({ length: 13 }, () =>
    request(
      "auth/owner-invitation",
      "",
      { token: "a".repeat(64) },
      base,
      "203.0.113.240",
    ),
  ),
);
check(
  limited.some((x) => x.status === 429),
  "invitation endpoints throttle repeated attempts",
);
const audit = await body(await request("owner/overview", nativeOwner));
check(
  audit.audit.some((x) => x.action === "owner_invitation_accepted") &&
    !JSON.stringify(audit.audit).includes(concurrent.token),
  "owner invitation changes are audited without secret links",
);
console.log(`${count} owner invitation checks passed.`);
