import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'

// Covers the resources/params that were previously untested: chains, tokens
// filters, health, wallets, webhooks, paginated disputes, create idempotency,
// and the configurable SIWE login chainId. Mirrors client.test.ts (fetch spy).

const BASE_URL = 'http://localhost:3000'
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ACCOUNT_ID = '018e1234-5678-7abc-9def-012345678901'
const WALLET_ID = '018e2222-3333-7abc-9def-012345678902'
const WEBHOOK_ID = '018e3333-4444-7abc-9def-012345678903'
const RAIL0_ID = `0x${'ab'.repeat(32)}`

function ok(body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status: 200, ...(headers ? { headers } : {}) })
}

// Bare-array body + pagination headers, as the gateway returns for list endpoints.
function okList(items: unknown[], total = items.length, page = 1, perPage = 25): Response {
  return ok(items, {
    'x-total-count': String(total),
    'x-page': String(page),
    'x-per-page': String(perPage),
  })
}

describe('resource alignment', () => {
  let client: Rail0Client

  beforeEach(() => {
    client = new Rail0Client({ baseUrl: BASE_URL })
    vi.restoreAllMocks()
  })

  // ── Catalog ────────────────────────────────────────────────────────────────

  describe('chains.list', () => {
    it('returns the blockchain catalog', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok([{ chain_id: 84532, native_symbol: 'ETH' }]))
      const chains = await client.chains.list()
      expect(chains[0]?.chain_id).toBe(84532)
    })

    it('serializes network_type and symbol filters', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok([]))
      await client.chains.list({ network_type: 'testnet', symbol: 'ETH' })
      const url = String(spy.mock.calls[0]?.[0])
      expect(url).toContain('network_type=testnet')
      expect(url).toContain('symbol=ETH')
    })
  })

  describe('tokens.list', () => {
    it('sends no query for no args, chain_id for a number, and both filters', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok([{ symbol: 'USDC' }]))
      await client.tokens.list()
      await client.tokens.list(84532)
      await client.tokens.list(84532, 'USDC')
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/\/tokens$/)
      expect(String(spy.mock.calls[1]?.[0])).toContain('chain_id=84532')
      const third = String(spy.mock.calls[2]?.[0])
      expect(third).toContain('chain_id=84532')
      expect(third).toContain('symbol=USDC')
    })
  })

  // ── Health ───────────────────────────────────────────────────────────────

  describe('health.get', () => {
    it('returns the health payload', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ status: 'ok', api_version: 'v1' }))
      const h = await client.health.get()
      expect(h.status).toBe('ok')
      expect(h.api_version).toBe('v1')
    })
  })

  // ── Wallets ────────────────────────────────────────────────────────────────

  describe('wallets', () => {
    it('list returns a paginated envelope and forwards the default filter', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(okList([{ id: WALLET_ID, address: '0xabc' }], 1))
      const res = await client.wallets.list(ACCOUNT_ID, { chain_id: 84532, default: true, active: true })
      expect(res.meta).toEqual({ page: 1, per_page: 25, total: 1 })
      const url = String(spy.mock.calls[0]?.[0])
      expect(url).toContain(`/accounts/${ACCOUNT_ID}/wallets`)
      expect(url).toContain('default=true')
      expect(url).toContain('chain_id=84532')
    })

    it('get / create / update (PATCH) / delete / balances hit the right endpoints', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      spy.mockResolvedValueOnce(ok({ id: WALLET_ID }))
      await client.wallets.get(ACCOUNT_ID, WALLET_ID)

      spy.mockResolvedValueOnce(ok({ id: WALLET_ID }))
      await client.wallets.create(ACCOUNT_ID, { address: '0xabc', label: 'w' })

      spy.mockResolvedValueOnce(ok({ id: WALLET_ID, label: 'renamed' }))
      await client.wallets.update(ACCOUNT_ID, WALLET_ID, { label: 'renamed' })

      spy.mockResolvedValueOnce(new Response(null, { status: 204 }))
      await client.wallets.delete(ACCOUNT_ID, WALLET_ID)

      spy.mockResolvedValueOnce(ok({ wallet_id: WALLET_ID, balances: [] }))
      await client.wallets.balances(ACCOUNT_ID, WALLET_ID, { chain_id: 84532 })

      const methods = spy.mock.calls.map((c) => (c[1] as RequestInit).method)
      expect(methods).toEqual(['GET', 'POST', 'PATCH', 'DELETE', 'GET'])
      expect(String(spy.mock.calls[4]?.[0])).toContain(`/wallets/${WALLET_ID}/balances`)
    })
  })

  // ── Webhooks ─────────────────────────────────────────────────────────────

  describe('webhooks', () => {
    it('create returns the one-time secret; list paginates; actions use PUT', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')

      spy.mockResolvedValueOnce(ok({ id: WEBHOOK_ID, shared_secret: 'whsec_x' }))
      const created = await client.webhooks.create({
        name: 'orders',
        callback_url: 'https://m.example/hook',
        topic: 'payments.captured',
      })
      expect(created.shared_secret).toBe('whsec_x')

      spy.mockResolvedValueOnce(okList([{ id: WEBHOOK_ID, topic: 'payments.captured' }], 1))
      const list = await client.webhooks.list({ topic: 'payments.captured', active: true })
      expect(list.data[0]?.id).toBe(WEBHOOK_ID)
      expect(String(spy.mock.calls[1]?.[0])).toContain('topic=payments.captured')

      spy.mockResolvedValueOnce(ok({ id: WEBHOOK_ID }))
      await client.webhooks.enable(WEBHOOK_ID)
      spy.mockResolvedValueOnce(ok({ id: WEBHOOK_ID }))
      await client.webhooks.disable(WEBHOOK_ID)
      spy.mockResolvedValueOnce(ok({ id: WEBHOOK_ID, shared_secret: 'whsec_y' }))
      const rotated = await client.webhooks.rotateSecret(WEBHOOK_ID)
      expect(rotated.shared_secret).toBe('whsec_y')
      spy.mockResolvedValueOnce(ok({ id: WEBHOOK_ID }))
      await client.webhooks.resetCircuit(WEBHOOK_ID)

      spy.mockResolvedValueOnce(okList([{ id: 'cb1', status: 'failed' }], 1))
      const cbs = await client.webhooks.eventCallbacks(WEBHOOK_ID, { status: 'failed' })
      expect(cbs.data[0]?.status).toBe('failed')

      spy.mockResolvedValueOnce(new Response(null, { status: 204 }))
      await client.webhooks.delete(WEBHOOK_ID)

      const actionMethods = [2, 3, 4, 5].map((i) => (spy.mock.calls[i]?.[1] as RequestInit).method)
      expect(actionMethods).toEqual(['PUT', 'PUT', 'PUT', 'PUT'])
    })
  })

  // ── Payments: paginated disputes + idempotent create ────────────────────────

  describe('payments.disputes', () => {
    it('returns a paginated envelope and forwards the status filter', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okList([{ status: 'open' }], 1))
      const res = await client.payments.disputes(RAIL0_ID, { status: 'open' })
      expect(res.data[0]?.status).toBe('open')
      expect(res.meta.total).toBe(1)
      expect(String(spy.mock.calls[0]?.[0])).toContain('status=open')
    })
  })

  describe('payments.create idempotency', () => {
    it('sends the Idempotency-Key header only when provided', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok({ rail0_id: RAIL0_ID }))
      const body = {
        chain_id: 84532,
        mode: 'charge' as const,
        amount: '1',
        token: '0xccc',
        payer: '0xaaa',
        payee: '0xbbb',
      }
      await client.payments.create(body)
      await client.payments.create(body, 'key-123')

      const first = (spy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
      const second = (spy.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>
      expect(first['Idempotency-Key']).toBeUndefined()
      expect(second['Idempotency-Key']).toBe('key-123')
    })
  })

  // ── Disputes (account-level, open + closed) ────────────────────────────────

  describe('disputes.list', () => {
    it('returns paginated disputes with embedded payment and forwards status', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          okList(
            [{ id: 'd1', status: 'closed', closed_by: 'payee', payment: { rail0_id: RAIL0_ID, status: 'refunded' } }],
            1,
          ),
        )
      const res = await client.disputes.list({ status: 'closed' })
      expect(res.data[0]?.status).toBe('closed')
      expect(res.data[0]?.payment?.rail0_id).toBe(RAIL0_ID)
      expect(String(spy.mock.calls[0]?.[0])).toContain('/disputes?status=closed')
    })
  })

  // ── Auth login chainId ───────────────────────────────────────────────────

  describe('auth.login chainId', () => {
    it('embeds chainId 1 by default and a custom chainId when given', async () => {
      const nonce = () => ok({ nonce: 'testNonce123', expires_at: '2099-01-01T00:00:00Z' })
      const session = () =>
        ok({ token: 't', address: '0x0', account_id: ACCOUNT_ID, name: 'M', expires_at: '2026-01-02T00:00:00Z' })

      const spy = vi.spyOn(globalThis, 'fetch')
      spy.mockResolvedValueOnce(nonce()).mockResolvedValueOnce(session())
      await client.auth.login(KEY, 'localhost')
      const defBody = JSON.parse((spy.mock.calls[1]?.[1] as RequestInit).body as string)
      expect(defBody.message).toContain('Chain ID: 1')

      spy.mockResolvedValueOnce(nonce()).mockResolvedValueOnce(session())
      await client.auth.login(KEY, 'localhost', 5042002)
      const customBody = JSON.parse((spy.mock.calls[3]?.[1] as RequestInit).body as string)
      expect(customBody.message).toContain('Chain ID: 5042002')
    })

    it('surfaces an account-less session (null account_id/name)', async () => {
      // The gateway issues a token for an address with no account (a buyer):
      // account_id and name come back null, and the SDK must pass them through
      // rather than coercing to a string.
      const nonce = () => ok({ nonce: 'testNonce123', expires_at: '2099-01-01T00:00:00Z' })
      const session = () =>
        ok({ token: 't', address: '0x0', account_id: null, name: null, expires_at: '2026-01-02T00:00:00Z' })

      const spy = vi.spyOn(globalThis, 'fetch')
      spy.mockResolvedValueOnce(nonce()).mockResolvedValueOnce(session())
      const res = await client.auth.login(KEY, 'localhost')
      expect(res.accountId).toBeNull()
      expect(res.name).toBeNull()
      expect(res.token).toBe('t')
    })
  })
})
