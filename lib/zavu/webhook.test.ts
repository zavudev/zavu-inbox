import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignatureHeader, verifyZavuSignature } from "./webhook";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "message.inbound" });
const NOW = 1_700_000_000;

function hmac(payload: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

const v1 = (body = BODY) => hmac(body);
const v2 = (body = BODY, t = NOW) => hmac(`${t}.${body}`);

describe("parseSignatureHeader", () => {
  it("reads t, v1 and v2", () => {
    expect(parseSignatureHeader(`t=${NOW},v1=aaa,v2=bbb`)).toEqual({
      t: NOW,
      v1: "aaa",
      v2: "bbb",
    });
  });

  it("ignores a future version rather than choking on it", () => {
    expect(parseSignatureHeader(`t=${NOW},v2=bbb,v3=ccc`)).toEqual({
      t: NOW,
      v2: "bbb",
    });
  });
});

describe("verifyZavuSignature", () => {
  it("accepts v2, the current scheme", () => {
    const header = `t=${NOW},v2=${v2()}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: true,
      version: "v2",
    });
  });

  it("accepts v1, which older receivers stay on", () => {
    const header = `t=${NOW},v1=${v1()}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: true,
      version: "v1",
    });
  });

  it("prefers v2 when a receiver mid-migration sends both", () => {
    const header = `t=${NOW},v1=${v1()},v2=${v2()}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: true,
      version: "v2",
    });
  });

  it("still accepts a both-header whose v2 is wrong but whose v1 holds", () => {
    const header = `t=${NOW},v1=${v1()},v2=${"0".repeat(64)}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: true,
      version: "v1",
    });
  });

  it("does not accept a v1 digest presented as v2", () => {
    // The two cover different payloads; accepting either against either would
    // silently undo what v2 is for.
    const header = `t=${NOW},v2=${v1()}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("binds v2 to its timestamp, so a replay under a new t fails", () => {
    // Same body, same signature, attacker-chosen fresh timestamp.
    const header = `t=${NOW + 120},v2=${v2(BODY, NOW)}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW + 120 })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a tampered body", () => {
    const header = `t=${NOW},v2=${v2()}`;
    const tampered = JSON.stringify({ id: "evt_1", type: "message.failed" });

    expect(verifyZavuSignature(tampered, header, SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a signature made with another secret", () => {
    const header = `t=${NOW},v2=${hmac(`${NOW}.${BODY}`, "wrong")}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a delivery outside the freshness window", () => {
    const header = `t=${NOW},v2=${v2()}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW + 600 })).toEqual({
      valid: false,
      reason: "stale",
    });
  });

  it("tolerates a clock slightly ahead", () => {
    const t = NOW + 60;
    const header = `t=${t},v2=${v2(BODY, t)}`;

    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW }).valid).toBe(true);
  });

  it("rejects a missing, empty or timestamp-only header", () => {
    expect(verifyZavuSignature(BODY, null, SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "missing_header",
    });
    expect(verifyZavuSignature(BODY, "nonsense", SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "malformed_header",
    });
    expect(verifyZavuSignature(BODY, `t=${NOW}`, SECRET, { now: NOW })).toEqual({
      valid: false,
      reason: "malformed_header",
    });
  });

  it("does not throw when a digest has the wrong length", () => {
    const header = `t=${NOW},v2=abc`;

    expect(() => verifyZavuSignature(BODY, header, SECRET, { now: NOW })).not.toThrow();
    expect(verifyZavuSignature(BODY, header, SECRET, { now: NOW }).valid).toBe(false);
  });
});
