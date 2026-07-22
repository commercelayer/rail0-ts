import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import { Rail0ApiError } from '../src/core/error.js'
import type { LogEntry } from '../src/core/http.js'
import { debugLogger } from '../src/core/http.js'
import type { PaymentConfig } from '../src/resources/types.js'

// Known test key (Hardhat account #0)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const BASE_URL = 'http://localhost:3000'

const mockPayment: PaymentConfig = {
  payer: '0x1111111111111111111111111111111111111111',
  payee: '0x2222222222222222222222222222222222222222',
  token: '0x3333333333333333333333333333333333333333',
  amount: '1000000',
  authorization_expiry: 9999999999,
  refund_expiry: 9999999999,
}

const mockPaymentId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'

describe('Rail0Client', () => {
  let client: Rail0Client

  beforeEach(() => {
    client = new Rail0Client({ baseUrl: BASE_URL })
    vi.restoreAllMocks()
  })

  describe('payments.get', () => {
    it('returns payment state and config hash', async () => {
      const mockResponse = {
        rail0_id: mockPaymentId,
        status: 'authorized',
        capturable_amount: '1000000',
        refundable_amount: '0',
        config_hash: `0x${'ab'.repeat(32)}`,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      const result = await client.payments.get(mockPaymentId)

      expect(result.rail0_id).toBe(mockPaymentId)
      expect(result.status).toBe('authorized')
      expect(result.capturable_amount).toBe('1000000')
    })

    it('throws Rail0ApiError on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'PaymentNotFound', message: 'No payment found.' }), {
          status: 404,
        }),
      )

      await expect(client.payments.get(mockPaymentId)).rejects.toMatchObject({
        status: 404,
        error: 'PaymentNotFound',
      })
    })
  })

  describe('payments.authorize', () => {
    it('posts to the correct endpoint and returns tx', async () => {
      const mockTx = {
        rail0_id: mockPaymentId,
        status: 'submitting',
      }
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTx), { status: 202 }))

      const result = await client.payments.authorize(mockPaymentId, {
        signed_transaction: '0x02f8ab',
      })

      expect(result.status).toBe('submitting')
      expect(spy).toHaveBeenCalledWith(
        `${BASE_URL}/payments/${mockPaymentId}/authorize`,
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('payments.submitByHash', () => {
    it('posts the tx hash to /:op/submitted', async () => {
      const mockTx = {
        rail0_id: mockPaymentId,
        status: 'submitting',
      }
      const transactionHash = `0x${'ab'.repeat(32)}`
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify(mockTx), { status: 202 }))

      const result = await client.payments.submitByHash(mockPaymentId, 'capture', {
        transaction_hash: transactionHash,
      })

      expect(result.status).toBe('submitting')
      expect(spy).toHaveBeenCalledWith(
        `${BASE_URL}/payments/${mockPaymentId}/capture/submitted`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transaction_hash: transactionHash }),
        }),
      )
    })
  })

  describe('payments.list', () => {
    it('calls GET /payments and returns paginated data', async () => {
      const mockList = { data: [], meta: { page: 1, per_page: 20, total: 0 } }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockList), { status: 200 }),
      )

      const result = await client.payments.list()

      expect(result.data).toBeInstanceOf(Array)
      expect(result.meta.page).toBe(1)
    })

    it('serializes every filter param into the query string', async () => {
      const mockList = { data: [], meta: { page: 2, per_page: 25, total: 0 } }
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify(mockList), { status: 200 }))

      await client.payments.list({
        status: 'authorized',
        mode: 'authorize',
        payer: '0xaaaa',
        payee: '0xbbbb',
        token: '0xcccc',
        chain_id: 8453,
        disputed: true,
        min_amount: '1000000',
        max_amount: '5000000',
        created_from: '2026-01-01T00:00:00Z',
        created_to: '2026-02-01T00:00:00Z',
        rail0_id: '0xdddd',
        sort: '-created_at',
        page: 2,
      })

      const url = String(spy.mock.calls[0]?.[0])
      expect(url).toContain('status=authorized')
      expect(url).toContain('mode=authorize')
      expect(url).toContain('chain_id=8453')
      expect(url).toContain('disputed=true')
      expect(url).toContain('min_amount=1000000')
      expect(url).toContain('max_amount=5000000')
      expect(url).toContain('created_from=')
      expect(url).toContain('created_to=')
      expect(url).toContain('rail0_id=0xdddd')
      expect(url).toContain('sort=-created_at')
      expect(url).toContain('page=2')
    })
  })

  describe('tokens.list', () => {
    it('returns an array of catalog tokens', async () => {
      const tokenAddress = mockPayment.token
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              address: tokenAddress,
              symbol: 'USDC',
              chain_id: 8453,
              chain_slug: 'base',
              decimals: 6,
            },
          ]),
          { status: 200 },
        ),
      )

      const result = await client.tokens.list()

      expect(Array.isArray(result)).toBe(true)
      expect(result[0]?.address).toBe(tokenAddress)
    })
  })

  describe('retry', () => {
    const mockResponse = {
      rail0_id: mockPaymentId,
      status: 'authorized',
      capturable_amount: '1000000',
      refundable_amount: '0',
      config_hash: `0x${'ab'.repeat(32)}`,
    }

    it('succeeds on the third attempt after two network failures', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

      client = new Rail0Client({ baseUrl: BASE_URL, maxRetries: 2, retryDelay: 0 })
      const result = await client.payments.get(mockPaymentId)

      expect(result.rail0_id).toBe(mockPaymentId)
      expect(fetchSpy).toHaveBeenCalledTimes(3)
    })

    it('throws the last error after exhausting all retries', async () => {
      const networkError = new Error('Network failure')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError)

      client = new Rail0Client({ baseUrl: BASE_URL, maxRetries: 2, retryDelay: 0 })

      await expect(client.payments.get(mockPaymentId)).rejects.toBe(networkError)
      expect(fetchSpy).toHaveBeenCalledTimes(3)
    })

    it('does not retry HTTP errors', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'PaymentNotFound', message: 'Not found.' }), {
          status: 404,
        }),
      )

      client = new Rail0Client({ baseUrl: BASE_URL, maxRetries: 2, retryDelay: 0 })

      await expect(client.payments.get(mockPaymentId)).rejects.toBeInstanceOf(Rail0ApiError)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('logger receives attempt and willRetry on retried failures, then attempt on success', async () => {
      const logger = vi.fn<(entry: LogEntry) => void>()
      const networkError = new Error('Network failure')
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

      client = new Rail0Client({ baseUrl: BASE_URL, maxRetries: 1, retryDelay: 0, logger })
      await client.payments.get(mockPaymentId)

      expect(logger).toHaveBeenCalledTimes(2)
      const [[failEntry], [successEntry]] = logger.mock.calls as [[LogEntry], [LogEntry]]
      expect(failEntry.attempt).toBe(1)
      expect(failEntry.willRetry).toBe(true)
      expect(failEntry.error).toBe(networkError)
      expect(successEntry.attempt).toBe(2)
      expect(successEntry.willRetry).toBeUndefined()
      expect(successEntry.error).toBeUndefined()
    })
  })

  describe('Rail0ApiError', () => {
    it('uses the canonical `status` as the code when no `error` sub-code is present', () => {
      const err = new Rail0ApiError(404, { status: 'not_found', message: 'No payment found.' })

      expect(err.status).toBe(404)
      expect(err.error).toBe('not_found')
      expect(err.message).toBe('No payment found.')
      expect(err.retryAfter).toBeUndefined()
      expect(err).toBeInstanceOf(Error)
    })

    it('prefers the more specific `error` sub-code over `status` (invalid_state / contract_revert)', () => {
      const err = new Rail0ApiError(422, {
        status: 'invalid_state',
        error: 'not_capturable',
        message: 'Cannot capture.',
      })

      expect(err.error).toBe('not_capturable')
      // hint map is keyed on the sub-code
      expect(err.hint).toBe("the payment must be 'authorized' or 'partially_captured' to capture")
    })

    it('exposes retryAfter when provided', () => {
      const err = new Rail0ApiError(
        429,
        { status: 'rate_limited', message: 'Too many requests.' },
        30,
      )
      expect(err.retryAfter).toBe(30)
    })
  })

  describe('error body mapping over HTTP', () => {
    it('surfaces the canonical `status` as the code for a status-only error body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'not_found', message: 'No payment found.' }), {
          status: 404,
        }),
      )

      await expect(client.payments.get(mockPaymentId)).rejects.toMatchObject({
        status: 404,
        error: 'not_found',
      })
    })

    it('reads Retry-After (seconds) off a 429 and exposes it as retryAfter', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'rate_limited', message: 'Too many requests. Retry later.' }),
          {
            status: 429,
            headers: { 'Retry-After': '42' },
          },
        ),
      )

      await expect(client.payments.get(mockPaymentId)).rejects.toMatchObject({
        status: 429,
        error: 'rate_limited',
        retryAfter: 42,
      })
    })

    it('leaves retryAfter undefined on a 429 without a Retry-After header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'rate_limited' }), { status: 429 }),
      )

      const err = (await client.payments.get(mockPaymentId).catch((e) => e)) as Rail0ApiError
      expect(err).toBeInstanceOf(Rail0ApiError)
      expect(err.retryAfter).toBeUndefined()
    })
  })

  describe('setAuthToken', () => {
    it('adds a Bearer header to subsequent requests and clears it when unset', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
          async () => new Response(JSON.stringify({ rail0_id: mockPaymentId }), { status: 200 }),
        )

      await client.payments.get(mockPaymentId)
      const before = (spy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>
      expect(before.Authorization).toBeUndefined()

      client.setAuthToken('jwt-abc')
      await client.payments.get(mockPaymentId)
      const after = (spy.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>
      expect(after.Authorization).toBe('Bearer jwt-abc')

      client.setAuthToken(null)
      await client.payments.get(mockPaymentId)
      const cleared = (spy.mock.calls[2]?.[1] as RequestInit).headers as Record<string, string>
      expect(cleared.Authorization).toBeUndefined()
    })
  })

  describe('auth', () => {
    describe('auth.getNonce', () => {
      it('returns nonce and expiresAt from POST /nonces', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response(JSON.stringify({ nonce: 'abc123', expires_at: '2099-01-01T00:00:00Z' }), {
            status: 200,
          }),
        )

        const result = await client.auth.getNonce()

        expect(result.nonce).toBe('abc123')
        expect(result.expiresAt).toBe('2099-01-01T00:00:00Z')
      })
    })

    describe('auth.verify', () => {
      it('posts message and signature to POST /auth and maps account_id → accountId', async () => {
        const mockAuthResponse = {
          token: 'jwt-token',
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          account_id: 'some-uuid',
          expires_at: '2099-01-01T00:00:00Z',
        }
        const spy = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValueOnce(new Response(JSON.stringify(mockAuthResponse), { status: 200 }))

        const result = await client.auth.verify('eip4361message', '0xsignature')

        expect(result.token).toBe('jwt-token')
        expect(result.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
        expect(result.accountId).toBe('some-uuid')
        expect(result.expiresAt).toBe('2099-01-01T00:00:00Z')

        const [, init] = spy.mock.calls[0] as [string, RequestInit]
        const body = JSON.parse(init.body as string) as Record<string, string>
        expect(body.message).toBe('eip4361message')
        expect(body.signature).toBe('0xsignature')
      })
    })

    describe('auth.login', () => {
      it('makes two fetch calls, sends valid EIP-4361 message with signature, returns token', async () => {
        const nonceResponse = { nonce: 'testNonce123', expires_at: '2099-01-01T00:00:00Z' }
        const authResponse = {
          token: 'login-jwt',
          address: TEST_ADDRESS,
          account_id: 'account-uuid',
          expires_at: '2099-01-01T00:00:00Z',
        }
        const fetchSpy = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValueOnce(new Response(JSON.stringify(nonceResponse), { status: 200 }))
          .mockResolvedValueOnce(new Response(JSON.stringify(authResponse), { status: 200 }))

        const result = await client.auth.login(TEST_PRIVATE_KEY, 'localhost')

        // Two calls: POST /nonces, POST /auth
        expect(fetchSpy).toHaveBeenCalledTimes(2)

        // Inspect POST /auth body
        const [, postInit] = fetchSpy.mock.calls[1] as [string, RequestInit]
        const body = JSON.parse(postInit.body as string) as Record<string, string>

        expect(body.message).toBeDefined()
        expect(body.signature).toBeDefined()

        // EIP-4361 message checks
        expect(body.message).toContain('wants you to sign in')
        expect(body.message).toContain(TEST_ADDRESS)
        expect(body.message).toContain('Nonce: testNonce123')

        // Signature: 0x-prefixed 132-char hex (65 bytes)
        expect(body.signature).toMatch(/^0x[0-9a-fA-F]{130}$/)

        expect(result.token).toBe('login-jwt')
      })
    })
  })

  describe('logger', () => {
    it('receives a success entry with correct fields on GET', async () => {
      const logger = vi.fn<(entry: LogEntry) => void>()
      client = new Rail0Client({ baseUrl: BASE_URL, logger })
      const mockResponse = {
        paymentId: mockPaymentId,
        state: { exists: true, capturableAmount: '1000000', refundableAmount: '0' },
        configHash: `0x${'ab'.repeat(32)}`,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      await client.payments.get(mockPaymentId)

      expect(logger).toHaveBeenCalledOnce()
      const [[entry]] = logger.mock.calls as [[LogEntry]]
      expect(entry.method).toBe('GET')
      expect(entry.url).toBe(`${BASE_URL}/payments/${mockPaymentId}`)
      expect(entry.status).toBe(200)
      expect(entry.durationMs).toBeGreaterThanOrEqual(0)
      expect(entry.responseBody).toEqual(mockResponse)
      expect(entry.requestBody).toBeUndefined()
      expect(entry.error).toBeUndefined()
    })

    it('includes requestBody on POST', async () => {
      const logger = vi.fn<(entry: LogEntry) => void>()
      client = new Rail0Client({ baseUrl: BASE_URL, logger })
      const mockTx = { rail0_id: mockPaymentId, status: 'submitting' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockTx), { status: 202 }),
      )
      const params = { signed_transaction: '0x02f8ab' }

      await client.payments.authorize(mockPaymentId, params)

      expect(logger).toHaveBeenCalledOnce()
      const [[entry]] = logger.mock.calls as [[LogEntry]]
      expect(entry.method).toBe('POST')
      expect(entry.status).toBe(202)
      expect(entry.requestBody).toEqual(params)
      expect(entry.error).toBeUndefined()
    })

    it('includes Rail0ApiError and response body on HTTP error', async () => {
      const logger = vi.fn<(entry: LogEntry) => void>()
      client = new Rail0Client({ baseUrl: BASE_URL, logger })
      const errorBody = { error: 'PaymentNotFound', message: 'No payment found.' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), { status: 404 }),
      )

      await expect(client.payments.get(mockPaymentId)).rejects.toBeInstanceOf(Rail0ApiError)

      expect(logger).toHaveBeenCalledOnce()
      const [[entry]] = logger.mock.calls as [[LogEntry]]
      expect(entry.status).toBe(404)
      expect(entry.responseBody).toEqual(errorBody)
      expect(entry.error).toBeInstanceOf(Rail0ApiError)
    })

    it('includes the thrown error and no status on network failure', async () => {
      const logger = vi.fn<(entry: LogEntry) => void>()
      client = new Rail0Client({ baseUrl: BASE_URL, logger })
      const networkError = new Error('Network failure')
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(networkError)

      await expect(client.payments.get(mockPaymentId)).rejects.toThrow('Network failure')

      expect(logger).toHaveBeenCalledOnce()
      const [[entry]] = logger.mock.calls as [[LogEntry]]
      expect(entry.error).toBe(networkError)
      expect(entry.status).toBeUndefined()
      expect(entry.responseBody).toBeUndefined()
    })

    it('debugLogger writes a formatted line to console.debug', async () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      client = new Rail0Client({ baseUrl: BASE_URL, logger: debugLogger })
      const mockResponse = {
        paymentId: mockPaymentId,
        state: { exists: false, capturableAmount: '0', refundableAmount: '0' },
        configHash: `0x${'00'.repeat(32)}`,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      )

      await client.payments.get(mockPaymentId)

      expect(spy).toHaveBeenCalledOnce()
      const [[message]] = spy.mock.calls as [[string, ...unknown[]]]
      expect(message).toMatch(/^\[rail0\] GET 200/)
    })
  })
})
