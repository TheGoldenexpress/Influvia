import { zipSync, strToU8 } from "fflate";
const xml = (v) =>
  String(v ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const col = (i) => {
  let s = "";
  for (i++; i; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
const columns = [
  ["Creator", "name"],
  ["City", "city"],
  ["Niche", "niche"],
  ["Language", "language"],
  ["Instagram URL", "instagram"],
  ["YouTube URL", "youtube"],
  ["Facebook URL", "facebook"],
  ["Followers", "followers"],
  ["Engagement (%)", "engagement"],
  ["Indicative rate (INR)", "rate"],
  ["Business email", "email"],
  ["Business phone", "phone"],
  ["Region", "region"],
  ["District", "district"],
  ["Open to free collaborations", "acceptsFreeCollab"],
];
export function makeWorkbook(creators, { sample = false, filters = {} } = {}) {
  const sheets = [
    {
      name: sample ? "Sample creators" : "Creators",
      rows: [
        columns.map((c) => c[0]),
        ...creators.map((c) =>
          columns.map((k) =>
            k[1] === "acceptsFreeCollab"
              ? c[k[1]]
                ? "Yes"
                : "No"
              : (c[k[1]] ?? ""),
          ),
        ),
      ],
    },
    {
      name: "Export details",
      rows: [
        [
          "INFLUVIA",
          sample
            ? "SAMPLE DATA — fictional records, not for outreach"
            : "Creator directory export",
        ],
        ["Exported at", new Date().toISOString()],
        ["Rows", creators.length],
        ["Filters", JSON.stringify(filters)],
        ["Rates", "Indicative only. Confirm independently."],
        [
          "Data type",
          sample ? "Fictional sample data" : "Imported directory records",
        ],
      ],
    },
  ];
  const files = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123E32"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`,
    ),
  };
  sheets.forEach((sheet, i) => {
    const links = [];
    const data = sheet.rows
      .map(
        (r, ri) =>
          `<row r="${ri + 1}"${ri === 0 ? ' ht="26" customHeight="1"' : ""}>${r
            .map((v, ci) => {
              const ref = `${col(ci)}${ri + 1}`;
              if (
                i === 0 &&
                !sample &&
                ri > 0 &&
                ci >= 4 &&
                ci <= 6 &&
                /^https:\/\//.test(String(v))
              )
                links.push({ ref, url: String(v) });
              return typeof v === "number" && Number.isFinite(v)
                ? `<c r="${ref}"><v>${v}</v></c>`
                : `<c r="${ref}" t="inlineStr" s="${ri === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
            })
            .join("")}</row>`,
      )
      .join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sheet.rows[0].map((_, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${ci >= 4 && ci <= 6 ? 44 : ci === 10 ? 32 : 22}" customWidth="1"/>`).join("")}</cols><sheetData>${data}</sheetData>${i === 0 ? `<autoFilter ref="A1:O${sheet.rows.length}"/>` : ""}${links.length ? `<hyperlinks>${links.map((l, j) => `<hyperlink ref="${l.ref}" r:id="rId${j + 1}"/>`).join("")}</hyperlinks>` : ""}</worksheet>`,
    );
    if (links.length)
      files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map((l, j) => `<Relationship Id="rId${j + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(l.url)}" TargetMode="External"/>`).join("")}</Relationships>`,
      );
  });
  return zipSync(files, { level: 6 });
}
