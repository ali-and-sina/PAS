/** Per-response policy. Keep the Supabase connection scoped to this project. */
export function buildContentSecurityPolicy({ nonce, supabaseUrl, development = false }) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  const remote = new URL(supabaseUrl);
  if (!["https:", "http:"].includes(remote.protocol)) throw new Error("Invalid Supabase URL");
  const socket = new URL(remote.origin);
  socket.protocol = remote.protocol === "https:" ? "wss:" : "ws:";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React, Radix and charts position elements with inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${remote.origin} ${socket.origin}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    `media-src 'self' blob: ${remote.origin}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
