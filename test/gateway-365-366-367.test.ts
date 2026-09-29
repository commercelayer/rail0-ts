import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import type {
  components,
  ListPaymentsParams,
  ListTransactionsParams,
  Payment,
  PaymentStatus,
  TransactionStatus,
  WebhookTopic,
} from '../src/index.js'
import { formatAmount } from '../src/index.js'

// Alignment with commercelayer/rail0-gateway#366 (payments.authorization_expiring) and
// #367 (decimals, multi-value status filter, in_flight). #365 (Blockchain.settlement) is
// covered in blockchain-type.test.ts next to the rest of the Blockchain type.
const BASE_URL = 'http://localhost:3000'
const RAIL0_ID = `0x${'ab'.repeat(32)}`

function okList(items: unknown[]): Response {
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'x-total-count': String(items.length), 'x-page': '1', 'x-per-page': '25' },
  })
}

// A list row as the gateway now serialises it: decimals and in_flight on every payment.
const ROW = {
  id: '018e1234-5678-7abc-9def-012345678901',
  chain_id: 84532,
  rail0_id: RAIL0_ID,
  status: 'authorized',
  mode: 'authorize',
  amount: '12500000',
  capturable_amount: '12500000',
  refundable_amount: '0',
  payer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  payee: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  decimals: 6,
  in_flight: true,
  authorization_expiry: 1_790_000_000,
  refund_expiry: 1_790_600_000,
  created_at: '2026-09-29T10:00:00Z',
}

afterEach(() => vi.restoreAllMocks())

describe('#367 G6 — multi-value status filter', () => {
  it('types status as one value or a list, on payments and on transactions', () => {
    expectTypeOf<ListPaymentsParams['status']>().toEqualTypeOf<
      PaymentStatus | PaymentStatus[] | undefined
    >()
    expectTypeOf<ListTransactionsParams['status']>().toEqualTypeOf<
      TransactionStatus | TransactionStatus[] | undefined
    >()
  })

  it('sends a list comma-separated with literal commas, and a single value unchanged', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => okList([]))

    await client.payments.list({ status: ['authorized', 'expired'], per_page: 50 })
    await client.payments.list({ status: 'authorized' })
    await client.payments.list({ status: ['captured'] })

    expect(String(spy.mock.calls[0]?.[0])).toBe(
      `${BASE_URL}/payments?status=authorized,expired&per_page=50`,
    )
    expect(String(spy.mock.calls[1]?.[0])).toBe(`${BASE_URL}/payments?status=authorized`)
    expect(String(spy.mock.calls[2]?.[0])).toBe(`${BASE_URL}/payments?status=captured`)
  })

  it('drops an empty list rather than sending status= (a 400)', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => okList([]))

    await client.payments.list({ status: [] })

    expect(String(spy.mock.calls[0]?.[0])).toBe(`${BASE_URL}/payments`)
  })

  it('serialises the transaction status list the same way', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => okList([]))

    await client.payments.transactions(RAIL0_ID, {
      operation: 'capture',
      status: ['submitting', 'submitted'],
    })

    expect(String(spy.mock.calls[0]?.[0])).toBe(
      `${BASE_URL}/payments/${RAIL0_ID}/transactions?operation=capture&status=submitting,submitted`,
    )
  })
})

describe('#367 G4/G7 — decimals and in_flight on payments', () => {
  it('types both on Payment, matching the schema', () => {
    expectTypeOf<Payment['decimals']>().toEqualTypeOf<number | null | undefined>()
    expectTypeOf<Payment['in_flight']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<Payment['decimals']>().toEqualTypeOf<
      components['schemas']['Payment']['decimals']
    >()
    expectTypeOf<Payment['in_flight']>().toEqualTypeOf<
      components['schemas']['Payment']['in_flight']
    >()
  })

  it('reaches list rows: an amount renders with no tokens join', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okList([ROW]))

    const { data } = await client.payments.list()
    const row = data[0]

    expect(row?.decimals).toBe(6)
    expect(row?.in_flight).toBe(true)
    expect(row && row.decimals != null && formatAmount(row.amount, row.decimals)).toBe('12.5')
  })

  it('reaches the payment embedded in GET /disputes, null decimals included', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      okList([{ id: 'd1', status: 'open', payment: { ...ROW, decimals: null, in_flight: false } }]),
    )

    const { data } = await client.disputes.list()

    expect(data[0]?.payment?.decimals).toBeNull()
    expect(data[0]?.payment?.in_flight).toBe(false)
  })
})

describe('#366 F1 — payments.authorization_expiring topic', () => {
  it('is a WebhookTopic, matching the schema enum', () => {
    expectTypeOf<'payments.authorization_expiring'>().toMatchTypeOf<WebhookTopic>()
    expectTypeOf<WebhookTopic>().toEqualTypeOf<components['schemas']['WebhookTopic']>()
  })

  it('can be subscribed to and filtered on', async () => {
    const client = new Rail0Client({ baseUrl: BASE_URL })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'w1', topics: ['payments.authorization_expiring'] }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(okList([]))

    await client.webhooks.create({
      name: 'expiry',
      callback_url: 'https://example.com/hook',
      topics: ['payments.authorization_expiring', 'payments.expired'],
    })
    await client.webhooks.list({ topic: 'payments.authorization_expiring' })

    const sent = JSON.parse((spy.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(sent.topics).toEqual(['payments.authorization_expiring', 'payments.expired'])
    expect(String(spy.mock.calls[1]?.[0])).toBe(
      `${BASE_URL}/webhooks?topic=payments.authorization_expiring`,
    )
  })
})
