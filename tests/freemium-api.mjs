import { qaOwnerCookie } from "./qa-session.mjs";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
const base = "http://127.0.0.1:5173",
  owner = qaOwnerCookie();
let count = 0;
async function request(path, { cookie = "", data, origin = base } = {}) {
  return fetch(`${base}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: origin }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
const check = (value, label) => {
  assert.ok(value, label);
  console.log(`PASS ${++count}: ${label}`);
};
const payload = async (r) => {
  const d = await r.json();
  if (r.status >= 500) throw new Error(JSON.stringify(d));
  return d;
};
const plans = [
  {
    id: "basic",
    name: "Basic",
    description: "Focused local discovery.",
    price: 1499,
    searchLimit: 2,
    resultLimit: 200,
    active: true,
  },
  {
    id: "studio",
    name: "Studio",
    description: "Room for every possibility.",
    price: 3999,
    searchLimit: null,
    resultLimit: null,
    active: true,
  },
];
check(
  (await request("search", { data: { filters: {} } })).status === 401,
  "anonymous search requires free account",
);
check(
  (await request("owner/overview")).status === 401,
  "anonymous admin access rejected",
);
await request("me", { cookie: owner });
check(
  (
    await request("owner/packages", {
      cookie: owner,
      data: { packages: plans },
    })
  ).status === 200,
  "owner sets package prices and limits",
);
const tag = `E2E ${Date.now()}`;
const rows = Array.from({ length: 230 }, (_, i) => ({
  name: `${tag} Creator ${String(i).padStart(3, "0")}`,
  region: "Telangana",
  district: i < 215 ? "Nizamabad" : "Sangareddy",
  city: i < 215 ? "Nizamabad" : "Sangareddy",
  niche: i % 2 ? "Real estate" : "Food blogger",
  language: ["Telugu", "Urdu", "Hindi", "English"][i % 4],
  followers: 3000 + i * 100,
  rate: 1000 + i * 20,
  engagement: 4.5,
  instagram: `https://www.instagram.com/e2e_${tag.replaceAll(" ", "_")}_${i}/`,
  email: `e2e${i}@example.invalid`,
  phone: "+91 0012345678",
  acceptsFreeCollab: i % 3 === 0,
  bio: "PRIVATE BIO WITH contact-secret@example.invalid",
}));
const imported = await request("owner/import", {
  cookie: owner,
  data: { rows },
});
check(imported.status === 200, "owner imports 230 influencer records");
const email = `e2e-${Date.now()}@example.invalid`,
  password = "LocalTest!Password2026";
const registered = await request("auth/register", {
  data: { name: "Local Test Customer", email, password },
});
check(
  registered.status === 200,
  "email registration is free and creates account",
);
let userCookie = registered.headers.get("set-cookie").split(";")[0];
let me = await payload(await request("me", { cookie: userCookie }));
check(
  !me.account.paid && !me.account.owner,
  "new email account has free access and no owner role",
);
check(
  (
    await request("owner/packages", {
      cookie: userCookie,
      data: { packages: plans },
    })
  ).status === 403,
  "free account cannot mutate packages",
);
check(
  (
    await request("auth/login", {
      data: { email, password: "WrongPassword!!" },
    })
  ).status === 401,
  "wrong password rejected",
);
const login = await request("auth/login", { data: { email, password } });
check(login.status === 200, "email password login succeeds");
userCookie = login.headers.get("set-cookie").split(";")[0];
const free = await payload(
  await request("search", {
    cookie: userCookie,
    data: { filters: { q: tag, region: "Telangana" } },
  }),
);
check(
  free.available === 10 && free.rows.length === 10 && free.total === 230,
  "free search returns exactly 10 of 230 matching results",
);
const freeRaw = JSON.stringify(free.rows);
check(
  !freeRaw.includes("instagram.com") &&
    !freeRaw.includes("example.invalid") &&
    !freeRaw.includes("0012345678") &&
    !freeRaw.includes("e2e_E2E"),
  "free API has no URLs, handles, email, phone or private bio",
);
check(
  free.rows.every(
    (c) =>
      !Object.hasOwn(c, "instagram") &&
      !Object.hasOwn(c, "email") &&
      c.platforms.includes("instagram"),
  ),
  "only platform labels are exposed, no protected properties",
);
const page2 = await payload(
  await request(`search?id=${free.searchId}&page=2`, { cookie: userCookie }),
);
check(
  page2.page === 1 && page2.rows.length === 10,
  "free pagination cannot bypass 10-result limit",
);
check(
  (
    await request("exports", {
      cookie: userCookie,
      data: { searchId: free.searchId },
    })
  ).status === 403,
  "free Excel export denied",
);
check(
  (
    await request("profile", {
      cookie: userCookie,
      data: { name: "Nope", company: "" },
      origin: "https://untrusted.invalid",
    })
  ).status === 403,
  "cross-origin mutation denied",
);
check(
  (
    await request("owner/access", {
      cookie: owner,
      data: {
        userId: me.account.id,
        packageId: "basic",
        grant: true,
        reason: "Local fixture payment verified",
      },
    })
  ).status === 200,
  "owner activates chosen Basic package",
);
const paid1 = await payload(
  await request("search", {
    cookie: userCookie,
    data: { filters: { q: tag, region: "Telangana" } },
  }),
);
check(
  paid1.available === 200 &&
    paid1.total === 230 &&
    paid1.rows[0].email &&
    paid1.rows[0].instagram,
  "Basic exposes 200 results and unlocks business details",
);
const paged = await payload(
  await request(`search?id=${paid1.searchId}&page=17`, { cookie: userCookie }),
);
check(
  paged.rows.length === 8 && paged.available === 200,
  "last Basic page stops at result 200",
);
const exported = await request("exports", {
  cookie: userCookie,
  data: { searchId: paid1.searchId, ids: [] },
});
check(exported.status === 200, "paid export succeeds for existing search");
const workbook = unzipSync(new Uint8Array(await exported.arrayBuffer()));
const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]);
check(
  (sheet.match(/<row /g) || []).length === 201 &&
    sheet.includes("+91 0012345678"),
  "Excel respects 200-result package limit and preserves phone text",
);
let afterExport = await payload(await request("me", { cookie: userCookie }));
check(
  afterExport.account.searchesUsed === 1,
  "paging and export do not consume more searches",
);
const paid2 = await payload(
  await request("search", {
    cookie: userCookie,
    data: {
      filters: {
        q: tag,
        region: "Telangana",
        district: "Nizamabad",
        industry: "Food blogger",
        language: "Telugu",
        collab: "free",
        minRate: "1000",
        maxRate: "3000",
        minFollowers: "3000",
        maxFollowers: "20000",
      },
    },
  }),
);
check(
  paid2.rows.length > 0 &&
    paid2.rows.every(
      (c) =>
        c.district === "Nizamabad" &&
        c.acceptsFreeCollab &&
        c.language === "Telugu" &&
        c.niche === "Food blogger" &&
        c.rate <= 3000,
    ),
  "district, language, industry, price, follower and free-collaboration filters combine",
);
const quota = await request("search", {
  cookie: userCookie,
  data: { filters: { q: tag } },
});
check(quota.status === 429, "Basic search quota enforced on server");
const history = await payload(await request("exports", { cookie: userCookie }));
check(
  history.rows.length === 1 &&
    JSON.parse(history.rows[0].details).rowCount === 200,
  "paid export is audited",
);
check(
  (await request(`search?id=${paid1.searchId}`)).status === 401,
  "search snapshots require account identity",
);
await request("owner/access", {
  cookie: owner,
  data: {
    userId: me.account.id,
    packageId: "studio",
    grant: true,
    reason: "Local unlimited package upgrade",
  },
});
const unlimited = await payload(
  await request("search", {
    cookie: userCookie,
    data: { filters: { q: tag } },
  }),
);
check(
  unlimited.available === 230 && unlimited.searchLimit === null,
  "higher package permits unlimited searches and full results",
);
const first = unlimited.rows[0];
const updated = await request("owner/creators", {
  cookie: owner,
  data: {
    ...rows.find((r) => r.name === first.name),
    id: first.id,
    rate: 7777,
    acceptsFreeCollab: true,
  },
});
check(updated.status === 200, "owner edits influencer rate and information");
const updatedSearch = await payload(
  await request("search", {
    cookie: userCookie,
    data: { filters: { q: first.name } },
  }),
);
check(
  updatedSearch.rows[0].rate === 7777,
  "edited rate is reflected in customer search",
);
const before = await payload(
  await request("owner/overview", { cookie: owner }),
);
await request("owner/import", {
  cookie: owner,
  data: {
    rows: [
      { ...rows.find((r) => r.name === first.name), id: first.id, rate: 8888 },
    ],
  },
});
const after = await payload(await request("owner/overview", { cookie: owner }));
check(
  before.totalCreators === after.totalCreators,
  "Excel/CSV-style upsert updates existing ID without duplication",
);
await request("owner/access", {
  cookie: owner,
  data: {
    userId: me.account.id,
    grant: false,
    reason: "Local fixture revocation",
  },
});
const revoked = await payload(
  await request(`search?id=${unlimited.searchId}`, { cookie: userCookie }),
);
check(
  revoked.available === 10 && !revoked.rows[0].email,
  "revocation re-redacts old paid search snapshots and caps results",
);
check(
  (
    await request("exports", {
      cookie: userCookie,
      data: { searchId: unlimited.searchId },
    })
  ).status === 403,
  "revocation immediately blocks exports",
);
await request("auth/logout", { cookie: userCookie, data: {} });
check(
  (await payload(await request("me", { cookie: userCookie }))).account === null,
  "logout invalidates the server session",
);
await request("owner/packages", {
  cookie: owner,
  data: { packages: [{ ...plans[0], searchLimit: 10 }, plans[1]] },
});
console.log(
  `${count} freemium integration checks passed. Local Basic restored to 10 searches / 200 results.`,
);
