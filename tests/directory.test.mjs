import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import {
  hasAccess,
  isOwner,
  verifyHmac,
  parseFilters,
  filterSamples,
  DEMO_CREATORS,
} from "../lib/directory.mjs";
import { makeWorkbook } from "../lib/excel.mjs";
import { readImport } from "../lib/import.mjs";
import {
  parseSearchFilters,
  sampleSearch,
  redactCreator,
  monthKey,
} from "../lib/catalog.mjs";

test("only active, unexpired entitlements grant access", () => {
  assert.equal(hasAccess(null), false);
  assert.equal(hasAccess({ accessUntil: null }), false);
  assert.equal(hasAccess({ accessUntil: 100 }, 100), false);
  assert.equal(hasAccess({ accessUntil: 101 }, 100), true);
  assert.equal(hasAccess({ paid: true, accessUntil: 0 }), false);
});
test("owner allowlist is explicit, exact and case insensitive", () => {
  assert.equal(
    isOwner("owner1@example.invalid", " owner1@example.invalid, owner2@example.invalid "),
    true,
  );
  assert.equal(isOwner("attacker+owner1@example.invalid", "owner1@example.invalid"), false);
  assert.equal(isOwner("visitor@example.com", ""), false);
});
test("payment signatures bind both payment and stored order; forged and malformed signatures fail", async () => {
  const secret = "test-only-secret";
  const raw = "order_123|pay_456";
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(await verifyHmac(secret, raw, signature), true);
  assert.equal(
    await verifyHmac(secret, "order_other|pay_456", signature),
    false,
  );
  assert.equal(await verifyHmac(secret, raw, "00".repeat(32)), false);
  assert.equal(await verifyHmac(secret, raw, "invalid"), false);
  assert.equal(await verifyHmac("", raw, signature), false);
});
test("combined filters and sort match exact creator selections", () => {
  const rows = filterSamples(
    parseFilters({
      city: "Hyderabad",
      niche: "Food",
      platform: "instagram",
      language: "Telugu",
      minFollowers: "10000",
      maxFollowers: "20000",
      maxRate: "4000",
    }),
  );
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Aditi Sharma"],
  );
  assert.equal(filterSamples(parseFilters({ q: "not-present" })).length, 0);
  const sorted = filterSamples(parseFilters({ sort: "rate-asc" }));
  assert.equal(sorted[0].name, "Vikram Das");
  assert.equal(filterSamples(parseFilters({ maxRate: "0" })).length, 0);
});
test("invalid filter values and bounds are rejected", () => {
  for (const f of [
    { platform: "other" },
    { city: "invalid" },
    { maxRate: "-1" },
    { minFollowers: "Infinity" },
    { sort: "sql injection" },
    { minFollowers: "20", maxFollowers: "10" },
  ])
    assert.throws(() => parseFilters(f));
});
test("Excel is a real OOXML zip; text is formula safe and phones retain + and leading zeros", () => {
  const workbook = makeWorkbook([
    {
      ...DEMO_CREATORS[0],
      name: '=HYPERLINK("https://evil.invalid")',
      phone: "+91 0012345678",
      email: "=cmd|calc",
      instagram: "https://www.instagram.com/business/",
    },
  ]);
  const f = unzipSync(workbook);
  assert.ok(f["[Content_Types].xml"]);
  assert.ok(f["xl/workbook.xml"]);
  const sheet = strFromU8(f["xl/worksheets/sheet1.xml"]);
  assert.ok(sheet.includes("+91 0012345678"));
  assert.ok(sheet.includes('t="inlineStr"'));
  assert.ok(!/<f[\s>]/.test(sheet));
  assert.ok(sheet.includes('xml:space="preserve"'));
  assert.ok(sheet.includes('<c r="H2"><v>11400</v></c>'));
  assert.ok(sheet.includes('<autoFilter ref="A1:O2"/>'));
  assert.ok(f["xl/worksheets/_rels/sheet1.xml.rels"]);
});
test("sample exports are labelled and never link fictional social handles", () => {
  const f = unzipSync(
    makeWorkbook(DEMO_CREATORS.slice(0, 2), { sample: true }),
  );
  assert.ok(strFromU8(f["xl/workbook.xml"]).includes("Sample creators"));
  assert.ok(strFromU8(f["xl/worksheets/sheet2.xml"]).includes("SAMPLE DATA"));
  assert.ok(!f["xl/worksheets/_rels/sheet1.xml.rels"]);
});
test("CSV import supports quoted commas, newlines, plus-prefixed phones and missing optional data", async () => {
  const csv =
    'name,region,district,city,niche,language,followers,rate,phone,acceptsFreeCollab\r\n"Creator, One",Telangana,Nizamabad,Nizamabad,Food blogger,Telugu,"11,400",3500,+91 0012345678,yes\r\n';
  const rows = await readImport(new File([csv], "creators.csv"));
  assert.equal(rows[0].name, "Creator, One");
  assert.equal(rows[0].followers, 11400);
  assert.equal(rows[0].phone, "+91 0012345678");
  assert.equal(rows[0].acceptsFreeCollab, true);
  await assert.rejects(
    () => readImport(new File(["name,city\na,b"], "bad.csv")),
    /Missing required/,
  );
  await assert.rejects(
    () => readImport(new File(['"unterminated'], "bad.csv")),
    /closing quote/,
  );
});
test("free projections whitelist safe fields and omit private content", () => {
  const row = redactCreator({
    id: "1",
    name: "Creator",
    region: "Telangana",
    district: "Nizamabad",
    city: "Nizamabad",
    niche: "Food blogger",
    language: "Urdu",
    followers: 15000,
    engagement: 5,
    rate: 2500,
    photo: "",
    instagram: "https://instagram.com/private_handle",
    email: "private@example.invalid",
    phone: "+9100123",
    bio: "private@example.invalid",
    acceptsFreeCollab: true,
  });
  assert.deepEqual(row.platforms, ["instagram"]);
  for (const key of [
    "instagram",
    "youtube",
    "facebook",
    "email",
    "phone",
    "bio",
  ])
    assert.ok(!Object.hasOwn(row, key));
  assert.ok(!JSON.stringify(row).includes("private"));
});
test("region, language, industry, follower, rate and collaboration filters combine", () => {
  const f = parseSearchFilters({
    region: "Telangana",
    district: "Hyderabad",
    industry: "Food blogger",
    language: "Telugu",
    collab: "free",
    minFollowers: "1000",
    maxFollowers: "100000",
    minRate: "0",
    maxRate: "10000",
  });
  const r = sampleSearch(f);
  assert.ok(r.rows.length > 0);
  assert.ok(
    r.rows.every(
      (c) =>
        c.district === "Hyderabad" &&
        c.language === "Telugu" &&
        c.acceptsFreeCollab &&
        c.niche === "Food blogger",
    ),
  );
  assert.throws(() => parseSearchFilters({ minRate: "5000", maxRate: "1000" }));
  assert.throws(() => parseSearchFilters({ language: "invalid" }));
});
test("free sample preview is capped at ten and India month boundaries are consistent", () => {
  assert.equal(sampleSearch(parseSearchFilters({}), false).rows.length, 10);
  assert.equal(monthKey(Date.parse("2026-10-31T18:29:59Z")), "2026-10");
  assert.equal(monthKey(Date.parse("2026-10-31T18:30:00Z")), "2026-11");
});
