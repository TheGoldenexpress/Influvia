// Compatibility for the app's existing Drizzle query builders. Native Postgres
// tables hold all data; this translates only the SQL constructs used by INFLUVIA.
export function postgresQuery(input, params) {
  let query = input
    .replace(/on conflict\s*\(([^)]+)\)/gi, (_, columns) =>
      "on conflict (" + columns.replace(/"[^"]+"\."([^"]+)"/g, '"$1"') + ")")
    .replace(/\bmax\(coalesce\(/gi, "greatest(coalesce(")
    .replace(/\binstr\(/gi, "strpos(")
    .replace(/date\(([^()]+?)\/1000,\s*'unixepoch',\s*'\+5 hours',\s*'\+30 minutes'\)/gi,
      "to_char(to_timestamp(($1)/1000.0) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')");
  let output = "", index = 0, quote = "", lineComment = false, blockComment = false;
  for (let i = 0; i < query.length; i++) {
    const c = query[i], next = query[i + 1];
    if (lineComment) { output += c; if (c === "\n") lineComment = false; continue; }
    if (blockComment) { output += c; if (c === "*" && next === "/") {output += next;i++;blockComment=false;} continue; }
    if (quote) {
      output += c;
      if (c === quote) { if (next === quote) {output+=next;i++;} else quote=""; }
      continue;
    }
    if (c === "'" || c === '"') {quote=c;output+=c;continue;}
    if (c === "-" && next === "-") {lineComment=true;output+=c+next;i++;continue;}
    if (c === "/" && next === "*") {blockComment=true;output+=c+next;i++;continue;}
    output += c === "?" ? "$" + (++index) : c;
  }
  if (index !== params.length) throw new Error("Database parameter count mismatch.");
  return {sql:output,params};
}

export function createPostgresBinding(endpoint, token, request = fetch) {
  if (!endpoint || !token) throw new Error("The application database is not configured.");
  async function execute(statements) {
    const response = await request(endpoint, {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"x-region":"ap-northeast-1"},
      body:JSON.stringify({statements:statements.map(s=>postgresQuery(s.query,s.params))}),
      cache:"no-store", signal:AbortSignal.timeout(45_000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Application database failed (${body.code || response.status}).`);
    return body.results;
  }
  const objects = r => r.rows.map(row=>Object.fromEntries(r.columns.map((name,i)=>[name,row[i]])));
  const result = r => ({success:true,results:objects(r),meta:{changes:r.count || 0}});
  const binding = {
    prepare(query) {
      const make = params => ({
        query,params,
        bind(...values) {return make(values);},
        async raw(options) {const [r]=await execute([this]);return options?.columnNames ? [r.columns,...r.rows] : r.rows;},
        async all() {return result((await execute([this]))[0]);},
        async run() {return result((await execute([this]))[0]);},
        async first(column) {const r=objects((await execute([this]))[0])[0];return column ? r?.[column] ?? null : r ?? null;},
      });
      return make([]);
    },
    async batch(statements) {return (await execute(statements)).map(result);},
  };
  return binding;
}
