import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postgresQuery, createPostgresBinding } from '../db/postgres-compat.mjs';

test('binds values independently, preserving quoted question marks and comments',()=>{
  assert.deepEqual(postgresQuery(`select '?' as "what?", ? as a -- ?\n, ? as b /* ? */`,["a' OR true",2]),{sql:`select '?' as "what?", $1 as a -- ?\n, $2 as b /* ? */`,params:["a' OR true",2]});
  assert.throws(()=>postgresQuery('select ?',[1,2]),/parameter count/);
});
test('translates scalar maximum, string search and India report dates while keeping aggregate max',()=>{
  const q=postgresQuery(`select max(created_at), max(coalesce(access_until,0),?), instr(lower(name),?), date("analytics_events"."created_at"/1000,'unixepoch','+5 hours','+30 minutes')`,[1,'hi']).sql;
  assert.match(q,/max\(created_at\)/);
  assert.match(q,/greatest\(coalesce\(access_until,0\),\$1\)/);
  assert.match(q,/strpos\(lower\(name\),\$2\)/);
  assert.match(q,/AT TIME ZONE 'Asia\/Kolkata'/);
  assert.doesNotMatch(q,/unixepoch/);
});
test('Postgres upsert conflict targets contain unqualified index columns',()=>{
  assert.equal(postgresQuery('insert into "accounts" ("id") values (?) on conflict ("accounts"."id") do nothing',[1]).sql,'insert into "accounts" ("id") values ($1) on conflict ("id") do nothing');
});
test('retains positional column order, counts and one atomic batch request',async()=>{
  const calls=[];
  const db=createPostgresBinding('https://example.test/function','private',async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({results:[{columns:['name','id'],rows:[['Creator','1']],count:1},{columns:[],rows:[],count:3}]});});
  const results=await db.batch([db.prepare('select name,id from creators where id=?').bind('1'),db.prepare('delete from sessions where expires_at < ?').bind(100)]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].statements.length,2);
  assert.deepEqual(Object.keys(results[0].results[0]),['name','id']);
  assert.equal(results[1].meta.changes,3);
});
