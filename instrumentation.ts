// Record server failures without request headers, bodies, credentials or cookies.
export function onRequestError(
  error: Error,
  request: { path: string },
  context: { routeType?: string },
) {
  console.error("INFLUVIA server request failed", {
    path: request.path.split("?")[0],
    routeType: context.routeType,
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
}
