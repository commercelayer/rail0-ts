import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'

// Cursor paging on the two keyset-paged lists (payments.list, payouts.list): `after` goes
// out as a query param, the next cursor comes back as meta.next_cursor — from
// x-next-cursor, else from the Link `next`'s `after`. Page-number paging is unchanged.

const BASE_URL = 'http://localhost:3000'

function page(items: unknown[], headers: Record<string, string>): Response {
  return new Response(JSON.stringify(items), { status: 200, headers })
}

describe('cursor paging', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts a cursor walk with after="" and reads x-next-cursor', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(page([{ id: 'p1' }], { 'x-per-page': '1', 'x-next-cursor': 'c1' }))
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const res = await client.payments.list({ after: '', per_page: 1 })
    expect(String(spy.mock.calls[0]?.[0])).toBe(`${BASE_URL}/payments?after=&per_page=1`)
    expect(res.meta.next_cursor).toBe('c1')
  })

  it('walks every payout page by cursor until next_cursor is absent', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(page([{ id: 'a' }, { id: 'b' }], { 'x-next-cursor': 'c+1/=' }))
      .mockResolvedValueOnce(
        // No x-next-cursor: the cursor comes from the Link header's `next`.
        page([{ id: 'c' }], { link: '</payouts?after=c2&per_page=2>; rel="next"' }),
      )
      .mockResolvedValueOnce(page([{ id: 'd' }], { 'x-per-page': '2' }))
    const client = new Rail0Client({ baseUrl: BASE_URL })

    const seen: string[] = []
    let after: string | undefined = ''
    while (after !== undefined) {
      const res = await client.payouts.list({ after, per_page: 2, status: 'confirmed' })
      seen.push(...res.data.map((p) => p.id))
      after = res.meta.next_cursor
    }

    expect(seen).toEqual(['a', 'b', 'c', 'd'])
    const urls = spy.mock.calls.map((c) => String(c[0]).slice(BASE_URL.length))
    expect(urls).toEqual([
      '/payouts?after=&per_page=2&status=confirmed',
      '/payouts?after=c%2B1%2F%3D&per_page=2&status=confirmed',
      '/payouts?after=c2&per_page=2&status=confirmed',
    ])
  })

  it('leaves page-number paging unchanged, with no next_cursor', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      page([{ id: 'p1' }], {
        'x-total-count': '3',
        'x-total-pages': '3',
        'x-page': '2',
        'x-per-page': '1',
        link: '</payments?page=1&per_page=1>; rel="first", </payments?page=1&per_page=1>; rel="prev", </payments?page=3&per_page=1>; rel="next", </payments?page=3&per_page=1>; rel="last"',
      }),
    )
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const res = await client.payments.list({ page: 2, per_page: 1 })
    expect(String(spy.mock.calls[0]?.[0])).toBe(`${BASE_URL}/payments?page=2&per_page=1`)
    expect(res.meta).toEqual({
      page: 2,
      per_page: 1,
      total: 3,
      total_pages: 3,
      links: {
        first: '/payments?page=1&per_page=1',
        prev: '/payments?page=1&per_page=1',
        next: '/payments?page=3&per_page=1',
        last: '/payments?page=3&per_page=1',
      },
    })
    expect('next_cursor' in res.meta).toBe(false)
  })
})
