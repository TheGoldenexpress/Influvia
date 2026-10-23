import postgres from "npm:postgres@3.4.9";
import credentials from "./credentials.json" with { type: "json" };

type Parameter = string | number | boolean | null;
type Statement = { sql: string; params: Parameter[] };
const projects = credentials as Record<string, { role: string; schema: string }>;
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,"0")).join("");

// This endpoint is exclusively for the trusted application server. It never uses
// the Supabase service role, postgres administrator login or browser credentials.
Deno.serve(async (request: Request) => {
  const started=performance.now();
  let sql: ReturnType<typeof postgres> | undefined;
  if (request.method !== "POST") return response({error:"Method not allowed"},405);
  const password = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!password) return response({error:"Unauthorized"},401);
  const principal = projects[await digest(password)];
  if (!principal) return response({error:"Unauthorized"},401);
  try {
    if (Number(request.headers.get("content-length") || 0) > 4_000_000) return response({error:"Request too large"},413);
    const text = await request.text();
    if (text.length > 4_000_000) return response({error:"Request too large"},413);
    const statements = JSON.parse(text).statements as Statement[];
    if (!Array.isArray(statements) || !statements.length || statements.length > 510 || statements.some(s => !s || typeof s.sql !== "string" || s.sql.length > 200_000 || !Array.isArray(s.params) || s.params.length > 12000 || s.params.some(p=>p !== null && typeof p !== "string" && typeof p !== "boolean" && !(typeof p === "number" && Number.isFinite(p))))) return response({error:"Invalid statements"},400);
    {
      const url = new URL(Deno.env.get("SUPABASE_DB_URL")!);
      // Prefer the project's direct connection from inside Supabase's network.
      url.hostname = "db.xzvlqswqyonbmmuomkxm.supabase.co";
      url.port = "5432";
      url.username = principal.role;
      url.password = password;
      url.search = "";
      sql = postgres(url.href, {
        ssl:"require", max:1, prepare:false, idle_timeout:5, connect_timeout:10,
        connection:{application_name:"influvia-server"},
        types:{bigint:{to:20,from:[20],serialize:(v:string|number)=>String(v),parse:(v:string)=>{const n=Number(v);return Number.isSafeInteger(n)?n:v;}},numeric:{to:1700,from:[1700],serialize:(v:string|number)=>String(v),parse:(v:string)=>{const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)throw new Error("Numeric result exceeds safe range");return n;}}},
      });
    }
    for (let attempt=0;;attempt++) {
      try {
        const results = await sql.begin("isolation level serializable", async tx => {
          const output=[];
          for (const s of statements) {
            const rows = await tx.unsafe(s.sql,s.params).values();
            output.push({rows:[...rows],columns:rows.columns?.map(c=>c.name) || [],count:rows.count});
          }
          return output;
        });
        return response({results,durationMs:Math.round(performance.now()-started),region:Deno.env.get("SB_REGION")});
      } catch(error) {
        const code=(error as {code?:string}).code;
        if ((code!=="40001" && code!=="40P01") || attempt>=5) throw error;
        await new Promise(resolve=>setTimeout(resolve,25*2**attempt+Math.random()*25));
      }
    }
  } catch(error) {
    const code=(error as {code?:string}).code;
    // SQL text, bound values, connection URLs and credentials stay out of logs.
    console.error("INFLUVIA database operation failed", {code:code||"unknown"});
    return response({error:"Database operation failed",code:code||"unknown"},500);
  } finally {
    // Edge isolates can sleep between requests. Close request-owned TCP clients
    // rather than reusing sockets whose idle timers paused with their isolate.
    if(sql) await sql.end({timeout:1});
  }
});
