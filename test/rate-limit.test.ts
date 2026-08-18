import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'

/**
 * How the client behaves when the gateway says "too many".
 *
 * The gateway throttles the public surface per IP (100/60s) and everything authenticated
 * per session (300/60s), answering 429 with a Retry-After. This client surfaced the header
 * and never acted on it; these pin the opt-in that now does, and — more importantly — that
 * it stays OFF unless asked, because an automatic sleep in a browser is a frozen click.
 */

const BASE_URL = 'http://localhost:3000'

function throttled(retryAfter?: string): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (retryAfter !== undefined) headers.set('Retry-After', retryAfter)
  return new Response(
    JSON.stringify({ code: 'rate_limited', detail: 'Rate limit reached. Retry in 1 seconds.' }),
    { status: 429, headers },
  )
}

const ok = () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })

// Each test counts its own calls; the spy is process-wide otherwise.
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('429 handling', () => {
  it('surfaces Retry-After on the error and does not retry by default', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(throttled('60'))
    const client = new Rail0Client({ baseUrl: BASE_URL })

    await expect(client.health.get()).rejects.toMatchObject({ status: 429, retryAfter: 60 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('retries once from the flag alone, without maxRetries', async () => {
    // Requiring both would make retryOn429 a silent no-op — the footgun this avoids.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled('0.001'))
      .mockResolvedValueOnce(ok())
    const client = new Rail0Client({
      baseUrl: BASE_URL,
      retryOn429: true,
      retryDelay: 0,
      retryAfterCapMs: 1,
    })

    await expect(client.health.get()).resolves.toMatchObject({ status: 'ok' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('gives up after the budget and throws the last 429', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(throttled('0.001'))
    const client = new Rail0Client({
      baseUrl: BASE_URL,
      retryOn429: true,
      maxRetries: 2,
      retryDelay: 0,
      retryAfterCapMs: 1,
    })

    await expect(client.health.get()).rejects.toMatchObject({ status: 429 })
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('retries a POST as readily as a GET', async () => {
    // Safe specifically because the gateway rejects a 429 in middleware, before the request
    // reaches the application: nothing ran, so nothing can run twice. Not true of a 502.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled('0.001'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nonce: 'abc' }), { status: 201 }))
    const client = new Rail0Client({
      baseUrl: BASE_URL,
      retryOn429: true,
      retryDelay: 0,
      retryAfterCapMs: 1,
    })

    await expect(client.auth.getNonce()).resolves.toMatchObject({ nonce: 'abc' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('never retries another error status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ code: 'server_error' }), { status: 502 }))
    const client = new Rail0Client({ baseUrl: BASE_URL, retryOn429: true, retryDelay: 0 })

    await expect(client.health.get()).rejects.toMatchObject({ status: 502 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('cancellation', () => {
  it('aborts a waiting retry instead of firing it', async () => {
    // The point of the signal: retryOn429 can hold a promise for a minute, and before this
    // the client had no caller-side cancellation at all.
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Cancel while the client is about to wait out the 429.
      setTimeout(() => controller.abort(new Error('caller gave up')), 0)
      return throttled('60')
    })
    const client = new Rail0Client({
      baseUrl: BASE_URL,
      retryOn429: true,
      signal: controller.signal,
    })

    await expect(client.health.get()).rejects.toThrow('caller gave up')
    // One attempt: the wait was cancelled, not slept through.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('forwards the caller signal to fetch, so an aborted one never reaches the wire', async () => {
    // Asserted on what is handed to fetch rather than on a rejection: the mock ignores the
    // signal, while a real fetch refuses on an aborted one.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok())
    const client = new Rail0Client({
      baseUrl: BASE_URL,
      signal: AbortSignal.abort(new Error('already gone')),
    })

    await client.health.get()
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect((init.signal as AbortSignal).aborted).toBe(true)
  })
})
