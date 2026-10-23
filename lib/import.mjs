function csvRows(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("An opening quote is missing its closing quote.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export async function readImport(file) {
  if (file.size > 2_000_000)
    throw new Error("Choose a file smaller than 2 MB.");
  let rows;
  if (file.name.toLowerCase().endsWith(".csv"))
    rows = csvRows((await file.text()).replace(/^\uFEFF/, ""));
  else if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { unzipSync, strFromU8 } = await import("fflate");
    let total = 0;
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => {
        total += f.originalSize;
        if (total > 10_000_000)
          throw new Error("This workbook exceeds the 10 MB expanded limit.");
        return /^(xl\/sharedStrings.xml|xl\/worksheets\/sheet1.xml)$/.test(
          f.name,
        );
      },
    });
    const doc = (path) => {
      if (!files[path]) return null;
      const d = new DOMParser().parseFromString(
        strFromU8(files[path]),
        "application/xml",
      );
      if (d.querySelector("parsererror"))
        throw new Error("The workbook contains invalid XML.");
      return d;
    };
    const shared = [
      ...(doc("xl/sharedStrings.xml")?.getElementsByTagName("si") || []),
    ].map((el) =>
      [...el.getElementsByTagName("t")].map((t) => t.textContent).join(""),
    );
    const sheet = doc("xl/worksheets/sheet1.xml");
    if (!sheet)
      throw new Error("Put your creator table in the workbook’s first sheet.");
    rows = [...sheet.getElementsByTagName("row")].map((r) => {
      const cells = [];
      for (const c of r.getElementsByTagName("c")) {
        if (c.getElementsByTagName("f").length)
          throw new Error("Replace formulas with values before importing.");
        const letter = c.getAttribute("r")?.match(/^[A-Z]+/)?.[0] || "A";
        let index = 0;
        for (const s of letter) index = index * 26 + s.charCodeAt(0) - 64;
        if (index > 50) throw new Error("Use at most 50 columns.");
        const v = c.getElementsByTagName("v")[0]?.textContent || "";
        cells[index - 1] =
          c.getAttribute("t") === "s"
            ? shared[Number(v)] || ""
            : c.getAttribute("t") === "inlineStr"
              ? [...c.getElementsByTagName("t")]
                  .map((t) => t.textContent)
                  .join("")
              : v;
      }
      return cells;
    });
  } else throw new Error("Choose a .csv or .xlsx file.");
  if (rows.length < 2)
    throw new Error("Add a header row and at least one creator row.");
  if (rows.length > 501)
    throw new Error("Import up to 500 creators at a time.");
  const headers = rows[0].map((v) => {
    const key = String(v || "")
      .trim()
      .toLowerCase();
    return key === "industry"
      ? "niche"
      : ["photo url", "photo_url", "image", "image url", "image_url"].includes(
            key,
          )
        ? "photo"
        : key === "acceptsfreecollab"
          ? "acceptsFreeCollab"
          : key;
  });
  for (const key of [
    "name",
    "region",
    "district",
    "city",
    "niche",
    "language",
    "followers",
    "rate",
  ])
    if (!headers.includes(key))
      throw new Error(`Missing required column: ${key}`);
  return rows
    .slice(1)
    .filter((r) => r.some((v) => String(v || "").trim()))
    .map((r) => {
      const record = {};
      headers.forEach((h, i) => {
        if (h)
          record[h] = ["followers", "engagement", "rate"].includes(h)
            ? Number(String(r[i] || "0").replace(/,/g, ""))
            : String(r[i] || "").trim();
      });
      if (!record.id) delete record.id;
      record.acceptsFreeCollab = ["yes", "true", "1"].includes(
        String(record.acceptsFreeCollab || "").toLowerCase(),
      );
      if (!headers.includes("photo")) delete record.photo;
      return record;
    });
}
