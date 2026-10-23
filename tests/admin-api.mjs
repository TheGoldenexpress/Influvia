import { qaOwnerCookie } from "./qa-session.mjs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5173",
  owner = qaOwnerCookie();
let count = 0;
const check = (value, label) => {
  assert.ok(value, label);
  console.log(`PASS ${++count}: ${label}`);
};
const request = (path, cookie = "", data) =>
  fetch(`${base}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(data === undefined
        ? {}
        : { Origin: base, "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
const body = async (r) => {
  const d = await r.json();
  assert.ok(r.status < 500, JSON.stringify(d));
  return d;
};
await request("me", owner);
const before = await body(await request("owner/overview", owner));
const tag = `Admin QA ${Date.now()}`;
const rows = Array.from({ length: 31 }, (_, i) => ({
  name: `${tag} ${String(i).padStart(2, "0")}`,
  region: "Telangana",
  district: "Nizamabad",
  city: "Nizamabad",
  niche: i % 2 ? "Real estate" : "Food blogger",
  language: "Telugu",
  followers: 10000 + i,
  engagement: 3.5,
  rate: 2000 + i,
  acceptsFreeCollab: i % 2 === 0,
}));
check(
  (await request("owner/creators")).status === 401,
  "anonymous influencer administration rejected",
);
const preview = await body(
  await request("owner/import/preview", owner, { rows }),
);
check(
  preview.preview && preview.added === 31 && preview.updated === 0,
  "spreadsheet preview counts new rows",
);
const afterPreview = await body(await request("owner/overview", owner));
check(
  before.totalCreators === afterPreview.totalCreators &&
    before.audit.length === afterPreview.audit.length,
  "preview writes no profiles or activity records",
);
check(
  (
    await request("owner/import/preview", owner, {
      rows: [rows[0], { ...rows[1], rate: -1 }],
    })
  ).status === 400,
  "invalid spreadsheet row rejected before import",
);
const committed = await body(await request("owner/import", owner, { rows }));
check(
  committed.added === 31 && !committed.preview,
  "confirmed bulk import publishes all validated rows",
);
const q = encodeURIComponent(tag);
const page1 = await body(await request(`owner/creators?q=${q}`, owner));
const page2 = await body(await request(`owner/creators?q=${q}&page=2`, owner));
check(
  page1.total === 31 &&
    page1.rows.length === 25 &&
    page1.pages === 2 &&
    page2.rows.length === 6,
  "admin influencer results paginate beyond 25 records",
);
check(
  new Set([...page1.rows, ...page2.rows].map((c) => c.id)).size === 31,
  "paged influencer rows do not overlap",
);
const filtered = await body(
  await request(
    `owner/creators?q=${q}&industry=Food%20blogger&region=Telangana`,
    owner,
  ),
);
check(
  filtered.total === 16 &&
    filtered.rows.every((c) => c.niche === "Food blogger"),
  "server combines administrator search and industry/region filters",
);
const clamped = await body(
  await request(`owner/creators?q=${q}&page=999`, owner),
);
check(
  clamped.page === 2 && clamped.rows.length === 6,
  "out-of-range page clamps to the final page",
);
const one = page1.rows[0];
const update = await body(
  await request("owner/import/preview", owner, {
    rows: [{ ...one, rate: 7800 }],
  }),
);
check(
  update.updated === 1 && update.added === 0,
  "spreadsheet preview detects ID updates",
);
const unchanged = await body(
  await request(`owner/creators?q=${encodeURIComponent(one.name)}`, owner),
);
check(
  unchanged.rows[0].rate !== 7800,
  "update preview preserves the stored rate",
);
const email = `admin-qa-${Date.now()}@example.invalid`;
const registered = await request("auth/register", "", {
  name: tag,
  email,
  password: "AdminQA!Password2026",
});
check(registered.status === 200, "test customer registered");
const customer = registered.headers.get("set-cookie").split(";")[0];
check(
  (await request("owner/users", customer)).status === 403 &&
    (await request("owner/import/preview", customer, { rows })).status === 403,
  "customer accounts cannot list users or validate admin imports",
);
const users = await body(
  await request(
    `owner/users?q=${encodeURIComponent(email.toUpperCase())}`,
    owner,
  ),
);
check(
  users.total === 1 && users.rows[0].email === email,
  "admin user search matches account email without case sensitivity",
);
check(
  !JSON.stringify(users).includes("passwordHash") &&
    !JSON.stringify(users).includes("tokenHash"),
  "admin user results contain no authentication secrets",
);
await request("owner/access", owner, {
  userId: users.rows[0].id,
  grant: true,
  packageId: "basic",
  reason: "Local admin QA membership activation",
});
const active = await body(
  await request(
    `owner/users?q=${encodeURIComponent(email)}&status=paid`,
    owner,
  ),
);
check(
  active.total === 1,
  "membership status filter includes active package accounts",
);
await request("owner/access", owner, {
  userId: users.rows[0].id,
  grant: false,
  reason: "Local admin QA membership revocation",
});
const free = await body(
  await request(
    `owner/users?q=${encodeURIComponent(email)}&status=free`,
    owner,
  ),
);
check(free.total === 1, "revoked account returns to the free user filter");
const overview = await body(await request("owner/overview", owner));
check(
  overview.stats.industries.reduce((n, c) => n + c.count, 0) ===
    overview.totalCreators &&
    overview.stats.freeCollabs <= overview.totalCreators,
  "dashboard coverage and quality counts include the entire catalog",
);
console.log(`${count} admin integration checks passed.`);
