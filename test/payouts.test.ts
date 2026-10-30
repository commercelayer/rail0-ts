import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import { describeError } from '../src/core/error.js'
import { PAYOUT_DETAILS_CONFIRMATION } from '../src/resources/payout_destinations.js'
import type {
  CreatePayoutDestinationRequest,
  Payout,
  PayoutDestination,
  UpdatePayoutDestinationRequest,
} from '../src/resources/types.js'
import { signPayoutTransaction, signTransaction } from '../src/signing.js'
import {
  ERC20_TRANSFER_SELECTOR,
  type PayoutTxExpectation,
  verifyPayoutTransaction,
} from '../src/tx-verify.js'

// Payouts (rail0-gateway#455): the merchant routes, and the pre-sign check of the ERC-20
// transfer a prepare returns. For a plain transfer the calldata IS the money, so the
// refusal cases below are the point of the file.

const BASE_URL = 'http://localhost:3000'
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const CHAIN_ID = 5042002
const TOKEN = '0x3600000000000000000000000000000000000000'
const OTHER_TOKEN = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const DEST_ADDRESS = '0x1111111111111111111111111111111111111111'
const ATTACKER = '0x9999999999999999999999999999999999999999'
const DEST_ID = '018e1111-2222-7abc-9def-012345678901'
const PAYOUT_ID = '018e3333-4444-7abc-9def-012345678902'
const WALLET_ID = '018e5555-6666-7abc-9def-012345678903'
const AMOUNT = '25500000' // 25.5 USDC (6 decimals)

function transferData(to = DEST_ADDRESS, amount = AMOUNT, trailing = ''): string {
  return `0x${ERC20_TRANSFER_SELECTOR}${to.slice(2).toLowerCase().padStart(64, '0')}${BigInt(amount)
    .toString(16)
    .padStart(64, '0')}${trailing}`
}

function unsignedTx(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    chain_id: CHAIN_ID,
    from: SIGNER,
    to: TOKEN,
    value: 0,
    data: transferData(),
    nonce: 3,
    gas_limit: 65000,
    max_priority_fee_per_gas: 1000000,
    max_fee_per_gas: 2000000000,
    ...overrides,
  })
}

function makePayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: PAYOUT_ID,
    destination_id: DEST_ID,
    wallet_id: WALLET_ID,
    chain_id: CHAIN_ID,
    token: TOKEN,
    token_symbol: 'USDC',
    address: DEST_ADDRESS,
    amount: AMOUNT,
    amount_formatted: '25.5',
    purpose: 'payout',
    status: 'pending',
    signed: false,
    unsigned_transaction: unsignedTx(),
    created_at: '2026-10-30T10:00:00Z',
    ...overrides,
  }
}

const destination: PayoutDestination = {
  id: DEST_ID,
  wallet_id: WALLET_ID,
  chain_id: CHAIN_ID,
  token: TOKEN,
  address: DEST_ADDRESS,
  kind: 'exchange',
  status: 'verified',
  created_at: '2026-10-29T10:00:00Z',
}

function expectation(overrides: Partial<PayoutTxExpectation> = {}): PayoutTxExpectation {
  return { payout: makePayout(), ...overrides }
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) })
}

// ─────────────────────────────────────────────────────────────────────────────
//  verifyPayoutTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyPayoutTransaction', () => {
  it('derives the ERC-20 transfer selector', () => {
    expect(ERC20_TRANSFER_SELECTOR).toBe('a9059cbb')
  })

  it('accepts exactly transfer(destination, amount) on the token', () => {
    const tx = verifyPayoutTransaction(unsignedTx(), expectation(), SIGNER)
    expect(tx.to).toBe(TOKEN)
  })

  it('accepts the caller-side checks when they agree', () => {
    expect(() =>
      verifyPayoutTransaction(
        unsignedTx(),
        expectation({ destination, amount: '25.50', decimals: 6, maxAmount: AMOUNT }),
        SIGNER,
      ),
    ).not.toThrow()
  })

  it('compares addresses case-insensitively and accepts a 0X prefix', () => {
    const tx = unsignedTx({
      to: TOKEN.toUpperCase().replace('0X', '0x'),
      data: transferData().replace('0x', '0X'),
    })
    expect(() => verifyPayoutTransaction(tx, expectation(), SIGNER.toLowerCase())).not.toThrow()
  })

  const refusals: [string, () => unknown, RegExp][] = [
    [
      'a wrong recipient in the calldata',
      () => verifyPayoutTransaction(unsignedTx({ data: transferData(ATTACKER) }), expectation()),
      /the transfer pays 0x9999.* but the payout's destination is/,
    ],
    [
      'a wrong amount in the calldata',
      () =>
        verifyPayoutTransaction(
          unsignedTx({ data: transferData(DEST_ADDRESS, '99000000') }),
          expectation(),
        ),
      /the transfer moves 99000000 base units but the payout is for 25500000/,
    ],
    [
      'a transaction to another token contract',
      () => verifyPayoutTransaction(unsignedTx({ to: OTHER_TOKEN }), expectation()),
      /addressed to 0x036C.* but this payout's token is/,
    ],
    [
      'a non-zero native value',
      () => verifyPayoutTransaction(unsignedTx({ value: '1' }), expectation()),
      /attaches native currency/,
    ],
    [
      'a hex native value',
      () => verifyPayoutTransaction(unsignedTx({ value: '0x01' }), expectation()),
      /attaches native currency/,
    ],
    [
      'a wrong chain',
      () => verifyPayoutTransaction(unsignedTx({ chain_id: 8453 }), expectation()),
      /targets chain 8453 but this payout is on chain 5042002/,
    ],
    [
      'trailing bytes after the two arguments',
      () =>
        verifyPayoutTransaction(
          unsignedTx({ data: transferData(DEST_ADDRESS, AMOUNT, '00') }),
          expectation(),
        ),
      /1 bytes after the transfer's two arguments/,
    ],
    [
      'a trailing word after the two arguments',
      () =>
        verifyPayoutTransaction(
          unsignedTx({ data: transferData(DEST_ADDRESS, AMOUNT, '0'.repeat(64)) }),
          expectation(),
        ),
      /32 bytes after/,
    ],
    [
      'truncated calldata',
      () =>
        verifyPayoutTransaction(unsignedTx({ data: transferData().slice(0, 74) }), expectation()),
      /too short for a transfer/,
    ],
    [
      'approve() instead of transfer()',
      () =>
        verifyPayoutTransaction(
          unsignedTx({ data: transferData().replace(ERC20_TRANSFER_SELECTOR, '095ea7b3') }),
          expectation(),
        ),
      /the call is selector 0x095ea7b3, not transfer\(address,uint256\)/,
    ],
    [
      'a recipient word with dirty upper bytes',
      () =>
        verifyPayoutTransaction(
          unsignedTx({
            data: `0x${ERC20_TRANSFER_SELECTOR}${'ff'.repeat(12)}${DEST_ADDRESS.slice(2)}${BigInt(
              AMOUNT,
            )
              .toString(16)
              .padStart(64, '0')}`,
          }),
          expectation(),
        ),
      /not a left-padded address/,
    ],
    [
      'no calldata at all',
      () => verifyPayoutTransaction(unsignedTx({ data: '0x' }), expectation()),
      /carries no function call/,
    ],
    [
      'a missing recipient (contract creation)',
      () => verifyPayoutTransaction(unsignedTx({ to: '' }), expectation()),
      /would deploy a contract/,
    ],
    [
      'a transaction from another account than the key',
      () => verifyPayoutTransaction(unsignedTx({ from: ATTACKER }), expectation(), SIGNER),
      /prepared from 0x9999.* but the signing key is/,
    ],
    [
      'no unsigned transaction',
      () => verifyPayoutTransaction(null, expectation()),
      /has no unsigned transaction/,
    ],
    ['invalid JSON', () => verifyPayoutTransaction('{not json', expectation()), /not valid JSON/],
    [
      'a payout without its amount',
      () => verifyPayoutTransaction(unsignedTx(), { payout: { ...makePayout(), amount: '' } }),
      /amount "" is not base units/,
    ],
    [
      'a payout without its token',
      () => verifyPayoutTransaction(unsignedTx(), { payout: { ...makePayout(), token: null } }),
      /payout's token null is not an address/,
    ],
    [
      'a payout on another chain than the destination',
      () =>
        verifyPayoutTransaction(
          unsignedTx(),
          expectation({ destination: { ...destination, chain_id: 8453 } }),
        ),
      /payout is on chain 5042002 but the destination is on chain 8453/,
    ],
    [
      'a payout in another token than the destination',
      () =>
        verifyPayoutTransaction(
          unsignedTx(),
          expectation({ destination: { ...destination, token: OTHER_TOKEN } }),
        ),
      /the destination takes 0x036C/,
    ],
    [
      'a payout to another address than the destination',
      () =>
        verifyPayoutTransaction(
          unsignedTx(),
          expectation({ destination: { ...destination, address: ATTACKER } }),
        ),
      /the destination's address is 0x9999/,
    ],
    [
      'a payout for another destination id',
      () =>
        verifyPayoutTransaction(
          unsignedTx(),
          expectation({ destination: { ...destination, id: 'other-destination' } }),
        ),
      /is for destination .* not other-destination/,
    ],
    [
      'a payout for another amount than the one typed',
      () => verifyPayoutTransaction(unsignedTx(), expectation({ amount: '25', decimals: 6 })),
      /the payout moves 25500000 base units but you asked for 25000000/,
    ],
    [
      'a typed amount without the token decimals',
      () => verifyPayoutTransaction(unsignedTx(), expectation({ amount: '25.5' })),
      /decimals are unknown/,
    ],
    [
      'a payout above the ceiling',
      () => verifyPayoutTransaction(unsignedTx(), expectation({ maxAmount: '1000000' })),
      /more than the 1000000 allowed/,
    ],
  ]

  for (const [name, run, message] of refusals) {
    it(`refuses ${name}`, () => {
      expect(run).toThrow(/^refusing to sign: /)
      expect(run).toThrow(message)
    })
  }

  it('does not check an "all" amount exactly (the gateway decides it)', () => {
    expect(() =>
      verifyPayoutTransaction(unsignedTx(), expectation({ amount: 'all', maxAmount: AMOUNT })),
    ).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  signPayoutTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('signPayoutTransaction', () => {
  it('signs a verified transfer with the shared EIP-1559 signer', () => {
    const payout = makePayout()
    const raw = signPayoutTransaction(payout.unsigned_transaction, PRIVATE_KEY, { payout })
    expect(raw.startsWith('0x02')).toBe(true)
    // Same bytes as the payment signer produces for the same transaction.
    expect(raw).toBe(signTransaction(payout.unsigned_transaction as string, PRIVATE_KEY))
  })

  it('refuses before signing when the transfer pays someone else', () => {
    const payout = makePayout({
      unsigned_transaction: unsignedTx({ data: transferData(ATTACKER) }),
    })
    expect(() =>
      signPayoutTransaction(payout.unsigned_transaction, PRIVATE_KEY, { payout }),
    ).toThrow(/^refusing to sign: the transfer pays/)
  })

  it("refuses a transaction prepared from another wallet than the key's", () => {
    const payout = makePayout({ unsigned_transaction: unsignedTx({ from: ATTACKER }) })
    expect(() =>
      signPayoutTransaction(payout.unsigned_transaction, PRIVATE_KEY, { payout }),
    ).toThrow(/signing key is/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
//  Resources
// ─────────────────────────────────────────────────────────────────────────────

describe('payout resources', () => {
  let client: Rail0Client

  beforeEach(() => {
    client = new Rail0Client({ baseUrl: BASE_URL })
    vi.restoreAllMocks()
  })

  function call(
    spy: ReturnType<typeof vi.spyOn>,
    i = 0,
  ): { url: string; method: string; body: unknown } {
    const [url, init] = spy.mock.calls[i] as [string, RequestInit]
    return {
      url: String(url),
      method: String(init?.method),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
  }

  describe('payoutDestinations', () => {
    it('lists with filters and folds the paging headers', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          json([destination], 200, { 'x-total-count': '7', 'x-page': '2', 'x-per-page': '1' }),
        )
      const res = await client.payoutDestinations.list({
        wallet_id: WALLET_ID,
        status: 'verified',
        page: 2,
        per_page: 1,
      })
      const { url, method } = call(spy)
      expect(method).toBe('GET')
      expect(url).toBe(
        `${BASE_URL}/payout_destinations?wallet_id=${WALLET_ID}&status=verified&page=2&per_page=1`,
      )
      expect(res.data[0]?.id).toBe(DEST_ID)
      expect(res.meta).toMatchObject({ page: 2, per_page: 1, total: 7 })
    })

    it('creates with the explicit confirmation', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json({ ...destination, status: 'unverified' }, 201))
      const body: CreatePayoutDestinationRequest = {
        wallet_id: WALLET_ID,
        chain_id: CHAIN_ID,
        token: TOKEN,
        address: DEST_ADDRESS,
        kind: 'exchange',
        min_amount: '11000000',
        confirm_details: true,
      }
      await client.payoutDestinations.create(body)
      expect(call(spy)).toMatchObject({
        url: `${BASE_URL}/payout_destinations`,
        method: 'POST',
        body,
      })
    })

    it('makes the confirmation and the minimum compile-time requirements', () => {
      // @ts-expect-error confirm_details is required on create
      const missing: CreatePayoutDestinationRequest = {
        wallet_id: WALLET_ID,
        chain_id: CHAIN_ID,
        token: TOKEN,
        address: DEST_ADDRESS,
        min_amount: '0',
      }
      // @ts-expect-error confirm_details cannot be false
      const refused: CreatePayoutDestinationRequest = { ...missing, confirm_details: false }
      // @ts-expect-error min_amount is required on create ("0" when the venue has none)
      const noMinimum: CreatePayoutDestinationRequest = {
        wallet_id: WALLET_ID,
        chain_id: CHAIN_ID,
        token: TOKEN,
        address: DEST_ADDRESS,
        confirm_details: true,
      }
      // @ts-expect-error changing min_amount needs confirm_details: true
      const minOnly: UpdatePayoutDestinationRequest = { min_amount: '5000000' }
      const label: UpdatePayoutDestinationRequest = { label: 'Kraken' }
      const min: UpdatePayoutDestinationRequest = { min_amount: '5000000', confirm_details: true }
      expect([missing, refused, noMinimum, minOnly, label, min]).toHaveLength(6)
    })

    it('sends "0" as given when the venue has no minimum', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json({ ...destination, status: 'unverified', min_amount: '0' }, 201))
      const body: CreatePayoutDestinationRequest = {
        wallet_id: WALLET_ID,
        chain_id: CHAIN_ID,
        token: TOKEN,
        address: DEST_ADDRESS,
        min_amount: '0',
        confirm_details: true,
      }
      await client.payoutDestinations.create(body)
      expect(call(spy).body).toEqual(body)
    })

    it('surfaces minimum_required from the gateway', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        json(
          {
            code: 'minimum_required',
            title: 'Minimum deposit required',
            detail: 'min_amount is required',
          },
          422,
        ),
      )
      await expect(
        client.payoutDestinations.update(DEST_ID, { min_amount: '', confirm_details: true }),
      ).rejects.toMatchObject({ status: 422, code: 'minimum_required' })
    })

    it('quotes the details_v1 text verbatim', () => {
      expect(PAYOUT_DETAILS_CONFIRMATION.version).toBe('details_v1')
      expect(PAYOUT_DETAILS_CONFIRMATION.text).toBe(
        "I have checked the address, network, token and minimum deposit on the venue's deposit page and confirm they are correct. Funds sent to a wrong address or network, or below the venue's minimum, may be permanently lost and cannot be recovered by rail0.",
      )
    })

    it('gets, updates, confirms and reads events on the right routes', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json(destination))
        .mockResolvedValueOnce(json(destination))
        .mockResolvedValueOnce(json(destination))
        .mockResolvedValueOnce(
          json([{ id: 'e1', action: 'destination.verified' }], 200, { 'x-total-count': '1' }),
        )
      await client.payoutDestinations.get(DEST_ID)
      await client.payoutDestinations.update(DEST_ID, { min_amount: '0', confirm_details: true })
      await client.payoutDestinations.confirm(DEST_ID)
      const events = await client.payoutDestinations.events(DEST_ID, { per_page: 50 })
      expect(call(spy, 0)).toMatchObject({
        url: `${BASE_URL}/payout_destinations/${DEST_ID}`,
        method: 'GET',
      })
      expect(call(spy, 1)).toMatchObject({
        url: `${BASE_URL}/payout_destinations/${DEST_ID}`,
        method: 'PATCH',
        body: { min_amount: '0', confirm_details: true },
      })
      expect(call(spy, 2)).toMatchObject({
        url: `${BASE_URL}/payout_destinations/${DEST_ID}/confirm`,
        method: 'POST',
      })
      expect(call(spy, 3).url).toBe(`${BASE_URL}/payout_destinations/${DEST_ID}/events?per_page=50`)
      expect(events.data[0]?.action).toBe('destination.verified')
    })
  })

  describe('payouts', () => {
    it('lists with a multi-status filter sent comma-separated', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json([makePayout()]))
      await client.payouts.list({
        destination_id: DEST_ID,
        status: ['failed', 'confirmed'],
        purpose: 'payout',
      })
      expect(call(spy).url).toBe(
        `${BASE_URL}/payouts?destination_id=${DEST_ID}&status=failed,confirmed&purpose=payout`,
      )
    })

    it('hits each write route with its body', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(makePayout()))
      await client.payouts.prepare({ destination_id: DEST_ID, amount: 'all' })
      await client.payouts.prepare({ destination_id: DEST_ID, purpose: 'proof' })
      await client.payouts.submit(PAYOUT_ID, { signed_transaction: '0x02ab' })
      await client.payouts.resend(PAYOUT_ID)
      await client.payouts.cancel(PAYOUT_ID)
      await client.payouts.submitByHash(PAYOUT_ID, { transaction_hash: `0x${'aa'.repeat(32)}` })
      await client.payouts.get(PAYOUT_ID)
      await client.payouts.events(PAYOUT_ID)
      const calls = spy.mock.calls.map((_, i) => call(spy, i))
      expect(calls.map((c) => `${c.method} ${c.url.slice(BASE_URL.length)}`)).toEqual([
        'POST /payouts/prepare',
        'POST /payouts/prepare',
        `POST /payouts/${PAYOUT_ID}/submit`,
        `POST /payouts/${PAYOUT_ID}/resend`,
        `POST /payouts/${PAYOUT_ID}/cancel`,
        `POST /payouts/${PAYOUT_ID}/submitted`,
        `GET /payouts/${PAYOUT_ID}`,
        `GET /payouts/${PAYOUT_ID}/events`,
      ])
      expect(calls[0]?.body).toEqual({ destination_id: DEST_ID, amount: 'all' })
      expect(calls[1]?.body).toEqual({ destination_id: DEST_ID, purpose: 'proof' })
      expect(calls[2]?.body).toEqual({ signed_transaction: '0x02ab' })
      expect(calls[5]?.body).toEqual({ transaction_hash: `0x${'aa'.repeat(32)}` })
    })

    it('makes amount a compile-time requirement of a payout prepare', () => {
      // @ts-expect-error a payout needs an amount
      const p = client.payouts.prepare.bind(client.payouts, { destination_id: DEST_ID })
      expect(p).toBeTypeOf('function')
    })

    it('signAndSubmit verifies, signs and submits', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json(makePayout({ status: 'submitted' }), 202))
      const payout = makePayout()
      const res = await client.payouts.signAndSubmit(payout, PRIVATE_KEY, { destination })
      expect(res.status).toBe('submitted')
      const { url, body } = call(spy)
      expect(url).toBe(`${BASE_URL}/payouts/${PAYOUT_ID}/submit`)
      expect(body).toEqual({
        signed_transaction: signTransaction(payout.unsigned_transaction as string, PRIVATE_KEY),
      })
    })

    it('signAndSubmit refuses a tampered transfer and sends nothing', async () => {
      const spy = vi.spyOn(globalThis, 'fetch')
      const payout = makePayout({
        unsigned_transaction: unsignedTx({ data: transferData(ATTACKER) }),
      })
      await expect(client.payouts.signAndSubmit(payout, PRIVATE_KEY)).rejects.toThrow(
        /^refusing to sign/,
      )
      expect(spy).not.toHaveBeenCalled()
    })

    it('prepareAndSubmit holds the prepared payout to the amount typed', async () => {
      const spy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json(makePayout(), 201))
        .mockResolvedValueOnce(json(makePayout({ status: 'submitted' }), 202))
      const res = await client.payouts.prepareAndSubmit(
        { destination_id: DEST_ID, amount: '25.5' },
        PRIVATE_KEY,
        {
          decimals: 6,
          destination,
        },
      )
      expect(res.status).toBe('submitted')
      expect(call(spy, 0).body).toEqual({ destination_id: DEST_ID, amount: '25.5' })
      expect(call(spy, 1).url).toBe(`${BASE_URL}/payouts/${PAYOUT_ID}/submit`)
    })

    it('prepareAndSubmit refuses a payout for more than asked, before submitting', async () => {
      const inflated = makePayout({
        amount: '25500000000',
        unsigned_transaction: unsignedTx({ data: transferData(DEST_ADDRESS, '25500000000') }),
      })
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(inflated, 201))
      await expect(
        client.payouts.prepareAndSubmit({ destination_id: DEST_ID, amount: '25.5' }, PRIVATE_KEY, {
          decimals: 6,
        }),
      ).rejects.toThrow(/you asked for 25500000/)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('prepareAndSubmit fails closed on a typed amount without decimals', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(makePayout(), 201))
      await expect(
        client.payouts.prepareAndSubmit({ destination_id: DEST_ID, amount: '25.5' }, PRIVATE_KEY),
      ).rejects.toThrow(/decimals are unknown/)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('prepareAndSubmit refuses a payout prepared for another destination or purpose', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json(makePayout({ destination_id: 'another' }), 201))
        .mockResolvedValueOnce(json(makePayout({ purpose: 'payout' }), 201))
      await expect(
        client.payouts.prepareAndSubmit({ destination_id: DEST_ID, amount: 'all' }, PRIVATE_KEY),
      ).rejects.toThrow(/to destination another, not/)
      await expect(
        client.payouts.prepareAndSubmit({ destination_id: DEST_ID, purpose: 'proof' }, PRIVATE_KEY),
      ).rejects.toThrow(/prepared a payout, not a proof/)
    })
  })
})

describe('payout error hints', () => {
  it.each([
    'confirmation_required',
    'minimum_required',
    'payout_destination_minimum_unset',
    'payout_below_minimum',
    'payout_destination_unverified',
    'payout_destination_disabled',
    'payout_destination_proof_missing',
    'payout_already_signed',
    'payout_not_pending',
    'payout_not_signed',
    'payout_hash_in_use',
    'payout_limit_reached',
    'insufficient_balance',
    'foreign_transfer_hash',
    'payout_destination_exists',
    'payout_destination_is_contract',
    'invalid_amount',
  ])('has a hint for %s', (code) => {
    expect(describeError(code)).toBeTypeOf('string')
  })
})
