import assert from "node:assert/strict";
const origin = process.env.INFLUVIA_TEST_ORIGIN || "http://127.0.0.1:5173";
for (const path of [
  "/",
  "/owner/login",
  "/owner/accept-invite",
  "/join",
  "/brand",
  "/owner/payments",
  "/owner/finance",
  "/owner/analytics",
  "/billing",
  "/privacy",
]) {
  const response = await fetch(origin + path);
  const html = await response.text();
  assert.equal(
    response.status,
    200,
    `${path} must server-render successfully in the production Worker`,
  );
  assert.ok(
    !html.includes('id="__next_error__"'),
    `${path} must not render the framework error shell`,
  );
  assert.ok(html.includes("INFLUVIA"));
  if (path === "/owner/login") {
    assert.ok(html.includes("Owner sign in."));
    assert.ok(!html.includes('href="/signin-with-chatgpt'));
  }
  console.log(`PASS: production Worker renders ${path}`);
}
for(const path of ["owner/payments","owner/finance","owner/analytics"]){
  const response=await fetch(origin+"/api/"+path);assert.equal(response.status,401);console.log(`PASS: production Worker protects ${path}`);
}
const optionsResponse=await fetch(origin+"/api/payments/options"),options=await optionsResponse.json();
assert.equal(optionsResponse.status,200);assert.ok(Array.isArray(options.options));assert.ok(options.options.every(o=>o.mode==="live"));console.log("PASS: public checkout exposes only enabled live payment choices");
