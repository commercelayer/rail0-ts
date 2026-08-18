import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  expectedWebhookSignature,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from '../src/webhook-signature.js'

/**
 * Webhook delivery verification.
 *
 * What these pin is the pair of ways a verifier is worse than none: accepting a replay
 * because only the digest was checked, and failing open on a missing input (a blank
 * secret makes HMAC trivially forgeable — anyone can compute HMAC("", …)).
 */

const SECRET = 'whsec_2f6a91c0d4e84b7f9a3c5e8d1b7f4a20'
const BODY = '{"id":"evt_1","topic":"payments.captured","data":{"amount":"1500000"}}'
const NOW = 1_800_000_000

function sign(body: string, timestamp: number | string, secret = SECRET): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

describe('expectedWebhookSignature', () => {
  it('matches node crypto byte for byte', () => {
    // The SDK uses @noble/hashes rather than node:crypto (it runs in the browser too).
    // If the two ever disagreed, every delivery would be rejected in production and
    // nothing here would say why — so the equivalence is the test.
    expect(expectedWebhookSignature(BODY, NOW, SECRET)).toBe(sign(BODY, NOW))
  })

  it('signs the timestamp exactly as it arrived, not a normalised copy', () => {
    // The gateway keys the digest with the header string; a number/string round trip
    // must not change it.
    expect(expectedWebhookSignature(BODY, '1800000000', SECRET)).toBe(sign(BODY, 1_800_000_000))
  })
})

describe('verifyWebhookSignature', () => {
  const base = { body: BODY, secret: SECRET, nowSeconds: NOW }

  it('accepts a live, authentic delivery', () => {
    expect(verifyWebhookSignature({ ...base, timestamp: NOW, signature: sign(BODY, NOW) })).toBe(
      true,
    )
  })

  it('accepts an uppercase digest — hex case carries no meaning', () => {
    expect(
      verifyWebhookSignature({
        ...base,
        timestamp: NOW,
        signature: sign(BODY, NOW).toUpperCase(),
      }),
    ).toBe(true)
  })

  it('rejects a body altered by one byte', () => {
    expect(
      verifyWebhookSignature({
        ...base,
        body: BODY.replace('1500000', '9500000'),
        timestamp: NOW,
        signature: sign(BODY, NOW),
      }),
    ).toBe(false)
  })

  it('rejects a signature made with another secret', () => {
    expect(
      verifyWebhookSignature({
        ...base,
        timestamp: NOW,
        signature: sign(BODY, NOW, 'whsec_other'),
      }),
    ).toBe(false)
  })

  it('rejects a replay outside the window, digest or no digest', () => {
    // The whole reason the timestamp is inside the signed string: a captured delivery
    // stays digest-valid forever, so only the clock can retire it.
    const stale = NOW - WEBHOOK_TOLERANCE_SECONDS - 1
    expect(
      verifyWebhookSignature({ ...base, timestamp: stale, signature: sign(BODY, stale) }),
    ).toBe(false)
    // Symmetric: a clock an attacker controls is not evidence of freshness.
    const future = NOW + WEBHOOK_TOLERANCE_SECONDS + 1
    expect(
      verifyWebhookSignature({ ...base, timestamp: future, signature: sign(BODY, future) }),
    ).toBe(false)
  })

  it('accepts the edges of the window', () => {
    for (const ts of [NOW - WEBHOOK_TOLERANCE_SECONDS, NOW + WEBHOOK_TOLERANCE_SECONDS]) {
      expect(verifyWebhookSignature({ ...base, timestamp: ts, signature: sign(BODY, ts) })).toBe(
        true,
      )
    }
  })

  it('honours a custom tolerance', () => {
    const ts = NOW - 60
    expect(
      verifyWebhookSignature({ ...base, timestamp: ts, signature: sign(BODY, ts), tolerance: 30 }),
    ).toBe(false)
    expect(
      verifyWebhookSignature({ ...base, timestamp: ts, signature: sign(BODY, ts), tolerance: 120 }),
    ).toBe(true)
  })

  it('fails closed on every missing or unusable input', () => {
    const good = sign(BODY, NOW)
    expect(verifyWebhookSignature({ ...base, timestamp: NOW, signature: null })).toBe(false)
    expect(verifyWebhookSignature({ ...base, timestamp: NOW, signature: '' })).toBe(false)
    expect(verifyWebhookSignature({ ...base, timestamp: null, signature: good })).toBe(false)
    expect(verifyWebhookSignature({ ...base, timestamp: 'not-a-number', signature: good })).toBe(
      false,
    )
    // A blank secret would make the digest forgeable by anyone.
    expect(
      verifyWebhookSignature({
        ...base,
        secret: '',
        timestamp: NOW,
        signature: sign(BODY, NOW, ''),
      }),
    ).toBe(false)
  })
})
