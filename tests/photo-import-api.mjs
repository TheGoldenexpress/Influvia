import { qaOwnerCookie } from "./qa-session.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:5173";
async function req(path, cookie = "", data) {
  return fetch(`${base}/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(data === undefined
        ? {}
        : { Origin: base, "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
let count = 0;
const check = (value, label) => {
  assert.ok(value, label);
  console.log(`PASS ${++count}: ${label}`);
};
const owner = qaOwnerCookie();
await req("me", owner);
const tag = `Photo import ${Date.now()}`;
const photo = "https://example.invalid/creator-portrait.jpg";
const row = {
  name: tag,
  region: "Telangana",
  district: "Nizamabad",
  city: "Nizamabad",
  niche: "Food blogger",
  language: "Telugu",
  followers: 12000,
  rate: 2200,
  photo,
  instagram: `https://instagram.com/sample_${Date.now()}`,
  email: "photo-test@example.invalid",
  phone: "+910012345678",
  acceptsFreeCollab: true,
};
check(
  (await req("owner/import", owner, { rows: [row] })).status === 200,
  "bulk import accepts an HTTPS portrait URL",
);
const email = `preview-${Date.now()}@example.invalid`,
  password = "PreviewOnly!2026";
const registered = await req("auth/register", "", {
  name: "Preview Customer",
  email,
  password,
});
check(registered.status === 200, "free test account created");
const cookie = registered.headers.get("set-cookie").split(";")[0];
await writeFile(
  "outputs/preview-account.json",
  JSON.stringify({ email, password }),
);
const r = await (await req("search", cookie, { filters: { q: tag } })).json();
check(
  r.total === 1 && !r.sample && r.rows[0].name === tag,
  "newly imported influencer appears in live customer results",
);
check(
  r.rows[0].photo === photo,
  "supplied photo URL reaches the customer portrait component",
);
check(
  !Object.hasOwn(r.rows[0], "instagram") &&
    !Object.hasOwn(r.rows[0], "phone") &&
    !Object.hasOwn(r.rows[0], "email"),
  "free photo access does not reveal contact or social fields",
);
const id = r.rows[0].id;
const { photo: omitted, ...update } = row;
check(
  (await req("owner/import", owner, { rows: [{ ...update, id, rate: 3300 }] }))
    .status === 200,
  "Excel-style update can omit the photo column",
);
const refreshed = await (await req(`search?id=${r.searchId}`, cookie)).json();
check(
  refreshed.rows[0].photo === photo && refreshed.rows[0].rate === 3300,
  "refresh displays updated rates and preserves the existing portrait",
);
for (const unsafe of [
  "javascript:alert(1)",
  "http://example.invalid/portrait.jpg",
  "https://user:password@example.invalid/a.jpg",
])
  check(
    (
      await req("owner/import", owner, {
        rows: [{ ...row, id, photo: unsafe }],
      })
    ).status === 400,
    `unsafe portrait URL rejected: ${unsafe.split(":")[0]}`,
  );
check(
  (await req("demo/export", cookie, { filters: {} })).status === 410,
  "legacy sample export cannot bypass saved-search membership limits",
);
console.log(`${count} photo import integration checks passed.`);
