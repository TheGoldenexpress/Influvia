import assert from 'node:assert/strict';
let verified=false;
export async function qaQuery(sql,params=[]) {
  const endpoint=process.env.INFLUVIA_QA_DATABASE_URL;
  const token=process.env.INFLUVIA_QA_DATABASE_TOKEN;
  assert.ok(endpoint && token,'Configure the isolated QA database explicitly.');
  const invoke=async statements=>{
    const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','x-region':'ap-northeast-1'},body:JSON.stringify({statements})});
    const result=await r.json();
    assert.ok(r.ok,'QA query failed: '+(result.code||r.status));
    return result.results;
  };
  if(!verified){
    const [result]=await invoke([{sql:'select current_schema(), current_user',params:[]}]);
    assert.deepEqual(result.rows[0],['influvia_qa','influvia_qa_runtime'],'Refusing to mutate a production database.');
    verified=true;
  }
  return (await invoke([{sql,params}]))[0];
}
