import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Verification for the signature the gateway puts on every webhook delivery.
 *
 * The SDK handed out `shared_secret` on create/rotate, told the reader to verify
 * deliveries with it, and shipped nothing to verify with — so every consumer had to
 * reverse-engineer the scheme, and getting it wrong is a security bug in THEIR app
 * rather than a failed request. rail0-go and rail0-ruby have had this for a while;
 * TypeScript is the SDK that actually receives the webhooks (a Next.js route handler),
 * which made it the worst one to be missing it.
 *
 * A delivery carries:
 *
 *   X-Rail0-Topic      the topic, e.g. "payments.captured"
 *   X-Rail0-Timestamp  unix seconds, as a string
 *   X-Rail0-Signature  hex HMAC-SHA256 over "{timestamp}.{body}", keyed by the secret
 *
 * The timestamp is inside the signed string on purpose: without it a captured delivery
 * is replayable forever, because the body alone stays valid indefinitely. That is why a
 * stale timestamp is rejected even when the digest matches — checking the digest and
 * ignoring the clock leaves the replay window wide open.
 *
 * No `node:crypto`. This package has no node builtins anywhere (it runs in the browser
 * too, where it signs), and reaching for one here would break the bundlers that
 * currently resolve it cleanly. `@noble/hashes` is already a dependency, and its HMAC
 * output is byte-identical to node's — pinned by a test.
 */

const encoder = new TextEncoder()

/** Header names a delivery carries, so a handler does not hardcode strings. */
export const WEBHOOK_TOPIC_HEADER = 'X-Rail0-Topic'
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Rail0-Timestamp'
export const WEBHOOK_SIGNATURE_HEADER = 'X-Rail0-Signature'

/**
 * Accepted clock skew in seconds, applied SYMMETRICALLY — a timestamp too far in the
 * future is rejected too, since a clock an attacker controls is not evidence of
 * freshness. Matches the gateway's own ±5 minutes, and rail0-go's
 * `WebhookToleranceSecs`.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300

export interface VerifyWebhookOptions {
  /**
   * The RAW request body, exactly as received. Re-serialising a parsed object changes
   * key order and whitespace, and the digest with it — so verify BEFORE `JSON.parse`,
   * not after (`await request.text()`, never `await request.json()`).
   */
  body: string
  /** The `X-Rail0-Signature` header, verbatim. */
  signature: string | null | undefined
  /** The `X-Rail0-Timestamp` header, verbatim. */
  timestamp: string | number | null | undefined
  /** The webhook's `shared_secret`, as issued by create/rotateSecret. */
  secret: string
  /** Accepted clock skew in seconds, either direction. */
  tolerance?: number
  /** Injectable clock (unix seconds), for tests. */
  nowSeconds?: number
}

/**
 * Whether a delivery is authentic and fresh.
 *
 * Returns a boolean and never throws: a spoofed request is an expected condition on a
 * public endpoint, not an exception. Every failure mode — missing header, blank secret,
 * unparseable timestamp, stale clock, bad digest — is the same answer, because a
 * handler's only correct response to all of them is 401.
 */
export function verifyWebhookSignature(options: VerifyWebhookOptions): boolean {
  const { body, signature, timestamp, secret } = options
  const tolerance = options.tolerance ?? WEBHOOK_TOLERANCE_SECONDS

  // A blank secret makes the digest trivially forgeable — anyone can compute
  // HMAC("", …) — so it fails rather than failing open.
  if (typeof body !== 'string' || !secret || !signature || timestamp == null) return false

  const seconds = Number.parseInt(String(timestamp).trim(), 10)
  if (!Number.isFinite(seconds)) return false
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - seconds) > tolerance) return false

  // The timestamp is hashed exactly as it arrived on the wire: the gateway keyed the
  // digest with that same string, so a normalised copy would not match.
  const expected = expectedWebhookSignature(body, String(timestamp), secret)
  return timingSafeEqualHex(String(signature).trim(), expected)
}

/**
 * The signature the gateway would send for this `(timestamp, body)` pair.
 *
 * Exposed so a consumer can log or diff the two sides while a delivery is being
 * rejected — comparing digests by eye is otherwise the only way to debug it. Same
 * helper rail0-ruby exposes.
 */
export function expectedWebhookSignature(
  body: string,
  timestamp: string | number,
  secret: string,
): string {
  const mac = hmac(sha256, encoder.encode(secret), encoder.encode(`${timestamp}.${body}`))
  return bytesToHex(mac)
}

/**
 * Constant-time comparison of two hex digests.
 *
 * Hand-written because `node:crypto`'s `timingSafeEqual` is not available in the
 * browser and this package deliberately has no node builtins. A byte-by-byte early
 * return leaks how much of the digest matched, which is enough to forge one byte at a
 * time; XOR-accumulating over the whole string leaks nothing but the length, which the
 * length check has already settled.
 *
 * Case-insensitive on the candidate: hex case carries no meaning, and rejecting an
 * uppercase digest would be a puzzle rather than a defence.
 */
function timingSafeEqualHex(given: string, expected: string): boolean {
  const candidate = given.toLowerCase()
  if (candidate.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}
