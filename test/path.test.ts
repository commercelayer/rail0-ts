import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import { path } from '../src/core/path.js'

// Resource paths used to paste ids in raw, so an id carrying "/" or ".." addressed a
// different route than the method named, with the caller's token.
describe('path', () => {
  it('keeps each value inside its own segment', () => {
    expect(path`/payments/${'../webhooks/x'}/sign`).toBe('/payments/..%2Fwebhooks%2Fx/sign')
    expect(path`/a/${'b?c#d'}`).toBe('/a/b%3Fc%23d')
  })

  it('leaves the ids the SDK is normally handed untouched', () => {
    const id = `0x${'ab'.repeat(32)}`
    expect(path`/payments/${id}/transactions/${'019e748b-da9a-7c3f-ba32-50572ffd5388'}`).toBe(
      `/payments/${id}/transactions/019e748b-da9a-7c3f-ba32-50572ffd5388`,
    )
  })
})

describe('resource paths', () => {
  afterEach(() => vi.restoreAllMocks())

  it('never lets an id leave its segment', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
      )
    const client = new Rail0Client({ baseUrl: 'https://api.test' })

    await client.payments.get('../webhooks/x')
    await client.webhooks.get('../../admin/health')

    const urls = spy.mock.calls.map((c) => String(c[0]))
    expect(urls[0]).toBe('https://api.test/payments/..%2Fwebhooks%2Fx')
    expect(urls[1]).toBe('https://api.test/webhooks/..%2F..%2Fadmin%2Fhealth')
  })
})
