import { describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'

// Allineamento con commercelayer/rail0-gateway#330, #331, #332.
const BASE_URL = 'http://localhost:3000'
const RAIL0_ID = `0x${'ab'.repeat(32)}` as `0x${string}`

function ok(body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status: 200, ...(headers ? { headers } : {}) })
}

describe('#330 — one transaction by id', () => {
  it('GETs the transaction path rather than the list', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ id: 'tx-1', operation: 'capture' }))

    const tx = await client.payments.getTransaction(RAIL0_ID, 'tx-1')

    expect(tx.id).toBe('tx-1')
    expect(String(spy.mock.calls[0]?.[0])).toBe(
      `${BASE_URL}/payments/${RAIL0_ID}/transactions/tx-1`,
    )
    vi.restoreAllMocks()
  })
})

describe('#331 — Idempotency-Key on prepare', () => {
  it('sends the header when a key is given, and omits it otherwise', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })

    const withKey = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'tx-1' }))
    await client.payments.prepare(
      RAIL0_ID,
      'capture',
      { amount: '1.00' },
      { idempotencyKey: 'k-1' },
    )
    const sentWith = (withKey.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
    expect(sentWith['Idempotency-Key']).toBe('k-1')
    vi.restoreAllMocks()

    const noKey = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'tx-2' }))
    await client.payments.prepare(RAIL0_ID, 'capture', { amount: '1.00' })
    const sentWithout = (noKey.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
    expect(sentWithout['Idempotency-Key']).toBeUndefined()
    vi.restoreAllMocks()
  })
  // Every typed prepare takes the same `opts` and forwards it the same way, so a caller
  // never has to fall back to the generic form just to get replay safety.
  const typed: Array<{
    name: string
    call: (c: Rail0Client, opts?: { idempotencyKey?: string }) => Promise<unknown>
    path: string
    body: unknown
  }> = [
    {
      name: 'authorizePrepare',
      call: (c, o) => c.payments.authorizePrepare(RAIL0_ID, o),
      path: 'authorize',
      body: undefined,
    },
    {
      name: 'chargePrepare',
      call: (c, o) => c.payments.chargePrepare(RAIL0_ID, o),
      path: 'charge',
      body: undefined,
    },
    {
      name: 'capturePrepare',
      call: (c, o) => c.payments.capturePrepare(RAIL0_ID, '1.00', o),
      path: 'capture',
      body: { amount: '1.00' },
    },
    {
      name: 'voidPrepare',
      call: (c, o) => c.payments.voidPrepare(RAIL0_ID, o),
      path: 'void',
      body: undefined,
    },
    {
      name: 'releasePrepare',
      call: (c, o) => c.payments.releasePrepare(RAIL0_ID, undefined, o),
      path: 'release',
      body: undefined,
    },
    {
      name: 'refundPrepare',
      call: (c, o) => c.payments.refundPrepare(RAIL0_ID, { amount: '1.00' }, o),
      path: 'refund',
      body: { amount: '1.00' },
    },
  ]

  for (const t of typed) {
    it(`${t.name} forwards opts.idempotencyKey, and omits the header without it`, async () => {
      const client = new Rail0Client({ baseUrl: BASE_URL })

      const withKey = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'tx-1' }))
      await t.call(client, { idempotencyKey: 'k-typed' })
      const [url, init] = withKey.mock.calls[0] as [string, RequestInit]
      expect(String(url)).toBe(`${BASE_URL}/payments/${RAIL0_ID}/${t.path}/prepare`)
      expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-typed')
      expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(t.body)
      vi.restoreAllMocks()

      const noKey = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 'tx-2' }))
      await t.call(client)
      const headers = (noKey.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
      expect(headers['Idempotency-Key']).toBeUndefined()
      vi.restoreAllMocks()
    })
  }
})

describe('#332 — total_pages and Link', () => {
  it('folds the headers into meta and parses every rel', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ok([{ id: 'p1' }], {
        'x-total-count': '7',
        'x-total-pages': '4',
        'x-page': '2',
        'x-per-page': '2',
        link: '</payments?page=1&per_page=2>; rel="first", </payments?page=1&per_page=2>; rel="prev", </payments?page=3&per_page=2>; rel="next", </payments?page=4&per_page=2>; rel="last"',
      }),
    )

    const res = await client.payments.list()

    expect(res.meta.total_pages).toBe(4)
    expect(res.meta.links.first).toBe('/payments?page=1&per_page=2')
    expect(res.meta.links.next).toBe('/payments?page=3&per_page=2')
    expect(res.meta.links.last).toBe('/payments?page=4&per_page=2')
    vi.restoreAllMocks()
  })

  // Assente su collezione vuota, non presente-e-vuoto: il gateway omette
  // l'header del tutto invece di mandarne uno che non punta a nulla.
  it('leaves links empty when the header is absent', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ok([], { 'x-total-count': '0', 'x-total-pages': '0' }),
    )

    const res = await client.payments.list()

    expect(res.meta.total_pages).toBe(0)
    expect(res.meta.links).toEqual({})
    vi.restoreAllMocks()
  })
})
