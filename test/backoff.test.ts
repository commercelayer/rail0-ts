import { describe, expect, it } from 'vitest'
import { throttleDelayMs } from '../src/core/backoff.js'

/**
 * The two decisions that are easy to get backwards, and invisible once they are: a client
 * that waits too little walks back into the limiter, one that waits too long looks hung.
 *
 * Mirrors spec/backoff_spec.rb in rail0-ruby — same rules, so the SDKs behave the same
 * against the same server.
 */
describe('throttleDelayMs', () => {
  it('honours a server-instructed wait in full, and only ADDS jitter', () => {
    // Scaling the gateway's own number down (textbook full jitter) means retrying before
    // the window it named has passed — a second 429 by construction.
    const delay = throttleDelayMs({
      retryAfterSeconds: 30,
      attempt: 1,
      baseMs: 200,
      capMs: 60_000,
      jitter: 0.5,
    })
    expect(delay).toBe(30_100)
    expect(delay).toBeGreaterThan(30_000)
  })

  it('caps an instructed wait', () => {
    // A gateway older than rail0-gateway#201 sends the whole period, not the time left.
    const delay = throttleDelayMs({
      retryAfterSeconds: 3600,
      attempt: 1,
      baseMs: 200,
      capMs: 60_000,
      jitter: 0,
    })
    expect(delay).toBe(60_000)
  })

  it('treats absent, zero, negative and non-finite as no instruction', () => {
    // Zero IS a valid duration, which is the trap: honouring it produces a burst of
    // back-to-back requests against the limiter that just asked for a pause.
    for (const retryAfterSeconds of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const delay = throttleDelayMs({
        retryAfterSeconds,
        attempt: 1,
        baseMs: 500,
        capMs: 60_000,
        jitter: 1,
      })
      expect(delay).toBe(500)
    }
  })

  it('backs off exponentially, jittered and capped, when there is no instruction', () => {
    expect(throttleDelayMs({ attempt: 3, baseMs: 200, capMs: 60_000, jitter: 1 })).toBe(800)
    expect(throttleDelayMs({ attempt: 3, baseMs: 200, capMs: 60_000, jitter: 0.5 })).toBe(400)
    expect(throttleDelayMs({ attempt: 20, baseMs: 200, capMs: 60_000, jitter: 1 })).toBe(60_000)
  })

  it('draws its own jitter, and never dips below the instruction', () => {
    const delays = Array.from({ length: 20 }, () =>
      throttleDelayMs({ retryAfterSeconds: 10, attempt: 1, baseMs: 1000, capMs: 60_000 }),
    )
    expect(new Set(delays).size).toBeGreaterThan(1)
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(10_000)
      expect(delay).toBeLessThanOrEqual(11_000)
    }
  })
})
