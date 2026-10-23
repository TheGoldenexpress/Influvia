// Local integration fixtures deliberately require an explicit test cookie.
// This cannot create production owner access or trust hosting identity headers.
export function qaOwnerCookie() {
  const cookie=process.env.INFLUVIA_QA_OWNER_COOKIE;
  if(!cookie) throw new Error('Set INFLUVIA_QA_OWNER_COOKIE from the isolated QA fixture.');
  return cookie;
}
