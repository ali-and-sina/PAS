export function hasSameOrigin(request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin === "null") return false;
    // Next can build an internal URL with a different host behind a proxy.
    // Match the browser's destination, as Server Actions do. The hosting proxy
    // must overwrite forwarded headers before forwarding untrusted requests.
    const internal = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || internal.host;
    const protocol = request.headers.get("x-forwarded-proto") || internal.protocol.slice(0, -1);
    if (!/^(https|http)$/.test(protocol)) return false;
    const expected = new URL(`${protocol}://${host}`);
    if (expected.username || expected.password || expected.pathname !== "/" || expected.search || expected.hash) return false;
    return new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}
