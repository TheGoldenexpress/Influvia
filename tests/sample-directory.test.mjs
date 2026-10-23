import test from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_CREATORS,
  samplePage,
  sampleSearch,
  parseSearchFilters,
} from "../lib/catalog.mjs";
import { readImport } from "../lib/import.mjs";

test("100 fictional profiles have distinct IDs, names and portrait cells, with no fabricated contacts", () => {
  assert.equal(SAMPLE_CREATORS.length, 100);
  for (const key of ["id", "name", "photoIndex"])
    assert.equal(new Set(SAMPLE_CREATORS.map((c) => c[key])).size, 100);
  for (const c of SAMPLE_CREATORS) {
    assert.equal(c.isDemo, true);
    assert.equal(c.photo, "/sample-influencers-color.png");
    assert.ok(c.photoIndex >= 0 && c.photoIndex < 100);
    for (const key of ["instagram", "facebook", "youtube", "phone", "email"])
      assert.equal(c[key], "");
  }
});

test("empty-catalog sample pages enforce free redaction and paid result limits across pagination", () => {
  const f = parseSearchFilters({});
  const free = samplePage(f, false, 10, 99);
  assert.equal(free.total, 100);
  assert.equal(free.available, 10);
  assert.equal(free.pages, 1);
  assert.equal(free.rows.length, 10);
  for (const c of free.rows) {
    assert.equal(c.locked, true);
    for (const key of [
      "instagram",
      "facebook",
      "youtube",
      "phone",
      "email",
      "bio",
    ])
      assert.ok(!Object.hasOwn(c, key));
  }
  const all = Array.from(
    { length: 9 },
    (_, i) => samplePage(f, true, null, i + 1).rows,
  ).flat();
  assert.equal(new Set(all.map((c) => c.id)).size, 100);
  assert.equal(samplePage(f, true, 17, 2).rows.length, 5);
  assert.equal(samplePage(f, true, 200, 9).rows.length, 4);
});

test("sample platform and collaboration filters work without fictional social handles", () => {
  const r = sampleSearch(
    parseSearchFilters({ platform: "instagram", collab: "free" }),
  );
  assert.ok(r.rows.length > 0);
  assert.ok(
    r.rows.every(
      (c) => c.platforms.includes("instagram") && c.acceptsFreeCollab,
    ),
  );
  assert.equal(
    sampleSearch(parseSearchFilters({ q: "unmatched-search-value" })).total,
    0,
  );
});

test("Excel/CSV photo aliases retain supplied URLs and omitted columns preserve existing photos on updates", async () => {
  const fields = "name,region,district,city,niche,language,followers,rate";
  const row =
    "Photo Test,Telangana,Nizamabad,Nizamabad,Food blogger,Telugu,12000,2500";
  for (const alias of ["photo", "photo_url", "image url"]) {
    const [c] = await readImport(
      new File(
        [`${fields},${alias}\n${row},https://example.invalid/photo.jpg`],
        "sample.csv",
      ),
    );
    assert.equal(c.photo, "https://example.invalid/photo.jpg");
  }
  const [c] = await readImport(new File([`${fields}\n${row}`], "sample.csv"));
  assert.ok(!Object.hasOwn(c, "photo"));
});
