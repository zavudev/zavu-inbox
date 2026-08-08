import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Zavu signs webhooks with `X-Zavu-Signature: t=<unix_seconds>[,v1=<hex>][,v2=<hex>]`.
 *
 *   v1 = HMAC_SHA256(secret, body)
 *   v2 = HMAC_SHA256(secret, "{t}.{body}")
 *
 * Which one arrives is a per-receiver setting, and a header can carry both
 * during a migration. v2 is the current scheme: binding the timestamp into the
 * signed payload is what makes the freshness window mean anything, because with
 * v1 an attacker who captures one delivery can replay it with any `t` they like.
 *
 * Both signatures in a "v1+v2" header share one `t`, so it is read once and
 * each version is checked against its own payload form. Unknown parts are
 * ignored, so a future v3 will not turn this into a hard failure.
 */

export interface VerifyResult {
  valid: boolean;
  /** Which signature actually verified. Useful for logging a migration. */
  version?: "v1" | "v2";
  reason?: "missing_header" | "malformed_header" | "stale" | "mismatch";
}

interface ParsedHeader {
  t?: number;
  v1?: string;
  v2?: string;
}

export function parseSignatureHeader(header: string): ParsedHeader {
  const out: ParsedHeader = {};

  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key === "t") {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) out.t = seconds;
    } else if (key === "v1") {
      out.v1 = value;
    } else if (key === "v2") {
      out.v2 = value;
    }
  }

  return out;
}

export function verifyZavuSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options?: { maxAgeSeconds?: number; now?: number }
): VerifyResult {
  if (!header) return { valid: false, reason: "missing_header" };

  const parsed = parseSignatureHeader(header);

  if (parsed.t === undefined || (!parsed.v1 && !parsed.v2)) {
    return { valid: false, reason: "malformed_header" };
  }

  const maxAge = options?.maxAgeSeconds ?? 300;
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.t) > maxAge) {
    return { valid: false, reason: "stale" };
  }

  // v2 first: when both are present it is the stronger of the two, and a header
  // carrying both is a receiver mid-migration.
  if (parsed.v2) {
    const expected = hmac(secret, `${parsed.t}.${rawBody}`);
    if (constantTimeEquals(expected, parsed.v2)) {
      return { valid: true, version: "v2" };
    }
  }

  if (parsed.v1) {
    const expected = hmac(secret, rawBody);
    if (constantTimeEquals(expected, parsed.v1)) {
      return { valid: true, version: "v1" };
    }
  }

  return { valid: false, reason: "mismatch" };
}

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
