import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/index.js'
import type { PaymentConfig } from '../src/resources/types.js'

const BASE_URL = 'http://localhost:3000'

const PAYMENT_ID = '0x1111111111111111111111111111111111111111111111111111111111111111' as const
const PAYER = '0xBuyerAddress000000000000000000000000000000' as const
const PAYEE = '0xMerchantAddress0000000000000000000000000000' as const

const PAYMENT: PaymentConfig = {
  payer: PAYER,
  payee: PAYEE,
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: '100000000',
  authorization_expiry: 9999999999,
  refund_expiry: 9999999999,
}

const CONFIG_HASH = `0x${'ff'.repeat(32)}`

function client() {
  return new Rail0Client({ baseUrl: BASE_URL })
}

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ================================================================
//  Payments
// ================================================================

describe('payments', () => {
  it('GET /payments/:rail0_id returns status and config fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({
        rail0_id: PAYMENT_ID,
        status: 'authorized',
        mode: 'authorize',
        amount: '50000000',
        payer: PAYER,
        payee: PAYEE,
        token: PAYMENT.token,
        chain_id: 8453,
        authorization_expiry: 9999999999,
        refund_expiry: 9999999999,
        config_hash: CONFIG_HASH,
      }),
    )
    const res = await client().payments.get(PAYMENT_ID)

    expect(res).toMatchObject({
      rail0_id: expect.any(String),
      status: expect.any(String),
      mode: expect.any(String),
    })
  })

  it('POST authorize returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.authorize(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
    expect(res.status).toBe('submitting')
  })

  it('POST charge returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.charge(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
  })

  it('POST capture returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.capture(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
  })

  it('POST void returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.void(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
  })

  it('POST release returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.release(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
  })

  it('POST refund returns a submitting transaction', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ rail0_id: PAYMENT_ID, status: 'submitting' }),
    )
    const res = await client().payments.refund(PAYMENT_ID, {
      signed_transaction: '0x02f8ab',
    })

    expect(res.status).toBe('submitting')
  })

  it('GET /payments returns paginated list', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({ data: [], meta: { page: 1, per_page: 20, total: 0 } }),
    )
    const res = await client().payments.list()

    expect(res.data).toBeInstanceOf(Array)
    expect(typeof res.meta.total).toBe('number')
  })

  it('POST /payments/hash returns a bytes32 digest via create', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok({
        rail0_id: PAYMENT_ID,
        config_hash: `0x${'dd'.repeat(32)}`,
        payment: PAYMENT,
        chain_id: 8453,
        rail0_contract: '0x1234567890123456789012345678901234567890',
        signing_payload: {
          domain: {},
          types: {},
          primaryType: 'TransferWithAuthorization',
          message: {},
        },
      }),
    )
    const res = await client().payments.create({
      chain_id: 8453,
      mode: 'authorize',
      amount: PAYMENT.amount,
      token: PAYMENT.token,
      payer: PAYMENT.payer,
      payee: PAYMENT.payee,
    })

    expect(res.config_hash).toMatch(/^0x[0-9a-f]{64}$/i)
  })
})

// ================================================================
//  Tokens
// ================================================================

describe('tokens', () => {
  it('GET /tokens returns array of catalog tokens', async () => {
    const token = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      ok([{ address: token, symbol: 'USDC', chain_id: 8453, chain_slug: 'base', decimals: 6 }]),
    )
    const res = await client().tokens.list()

    expect(Array.isArray(res)).toBe(true)
    expect(res[0]?.address).toBe(token)
  })
})
