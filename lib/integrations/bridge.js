import { createHmac, timingSafeEqual } from "node:crypto";
export const BRIDGE_PROVIDERS = {
  tamin: "PAS_TAMIN_BRIDGE_SECRET",
  ihio: "PAS_IHIO_BRIDGE_SECRET",
  diagnostic_center: "PAS_DIAGNOSTIC_BRIDGE_SECRET",
};
export function verifyBridgeSignature({ raw, timestamp, signature, secret, now = Date.now() }) {
  if (typeof secret !== "string" || secret.length < 32 || !/^\d{10}$/.test(String(timestamp)) ||
      !/^[a-f0-9]{64}$/.test(String(signature)) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function readBridgeBody(request, limit = 262144) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
