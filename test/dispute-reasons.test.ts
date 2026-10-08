import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import { describeError, Rail0ApiError } from '../src/core/error.js'
import type { Dispute } from '../src/index.js'
import {
  DISPUTE_CLOSE_REASONS,
  DISPUTE_OPEN_REASONS,
  DISPUTE_SYSTEM_CLOSE_REASONS,
  lookupDisputeReason,
  UNRECOGNISED_DISPUTE_REASON,
} from '../src/index.js'

// The dispute-reason dictionary (rail0-gateway#381): build-time constants emitted by
// gen/generate.ts from the spec's x-enum-* arrays, and the now-required `reason` on
// the two dispute prepare calls.

const BASE_URL = 'http://localhost:3000'
const RAIL0_ID = `0x${'ab'.repeat(32)}`

const reasonHash = (code: string): string =>
  `0x${bytesToHex(keccak_256(new TextEncoder().encode(`rail0.dispute.${code}`)))}`

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('dispute-reason dictionary constants', () => {
  it('carries the 9 open, 4 close and 1 system reasons, in spec order', () => {
    expect(DISPUTE_OPEN_REASONS.map((r) => r.code)).toEqual([
      'not_received',
      'not_as_described',
      'damaged_or_defective',
      'duplicate',
      'incorrect_amount',
      'cancelled',
      'refund_not_received',
      'unauthorized',
      'other',
    ])
    expect(DISPUTE_CLOSE_REASONS.map((r) => r.code)).toEqual([
      'resolved_with_merchant',
      'withdrawn',
      'item_received',
      'other',
    ])
    expect(DISPUTE_SYSTEM_CLOSE_REASONS.map((r) => r.code)).toEqual(['full_refund'])
  })

  it('maps every code to keccak256("rail0.dispute.<code>") and a description', () => {
    for (const r of [
      ...DISPUTE_OPEN_REASONS,
      ...DISPUTE_CLOSE_REASONS,
      ...DISPUTE_SYSTEM_CLOSE_REASONS,
    ]) {
      expect(r.bytes32).toBe(reasonHash(r.code))
      expect(r.description.length).toBeGreaterThan(0)
    }
  })
})

describe('lookupDisputeReason', () => {
  it('finds a reason by code or by bytes32 in any case', () => {
    expect(lookupDisputeReason('not_received', 'open')?.description).toBe(
      'Goods or service not received',
    )
    const hash = reasonHash('withdrawn')
    expect(lookupDisputeReason(hash.toUpperCase().replace('0X', '0x'), 'close')?.code).toBe(
      'withdrawn',
    )
  })

  it('keeps the sides apart: `other` reads differently on open and close', () => {
    expect(lookupDisputeReason('other', 'open')?.description).toBe(
      'Other reason, detailed off-chain',
    )
    expect(lookupDisputeReason('other', 'close')?.description).toBe('Other reason')
    expect(lookupDisputeReason('withdrawn', 'open')).toBeUndefined()
  })

  it('resolves the system full_refund on the close side only', () => {
    expect(lookupDisputeReason(reasonHash('full_refund'), 'close')?.code).toBe('full_refund')
    expect(lookupDisputeReason('full_refund', 'open')).toBeUndefined()
  })

  it('is undefined outside the dictionary (zero reason, null, empty)', () => {
    expect(lookupDisputeReason(`0x${'00'.repeat(32)}`, 'open')).toBeUndefined()
    expect(lookupDisputeReason(null, 'close')).toBeUndefined()
    expect(lookupDisputeReason('', 'open')).toBeUndefined()
    expect(UNRECOGNISED_DISPUTE_REASON).toBe('Unrecognised reason')
  })
})

describe('dispute prepare: required reason', () => {
  let client: Rail0Client

  beforeEach(() => {
    client = new Rail0Client({ baseUrl: BASE_URL })
    vi.restoreAllMocks()
  })

  it('sends the open reason code in the body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 't1' }))
    await client.payments.disputePrepare(RAIL0_ID, 'not_received')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/payments/${RAIL0_ID}/dispute/prepare`)
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'not_received' })
  })

  it('sends a close reason bytes32 verbatim', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok({ id: 't2' }))
    const hash = reasonHash('item_received')
    await client.payments.closeDisputePrepare(RAIL0_ID, hash, { idempotencyKey: 'k1' })
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/payments/${RAIL0_ID}/dispute/close/prepare`)
    expect(JSON.parse(init.body as string)).toEqual({ reason: hash })
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('k1')
  })

  it('rejects a missing reason at compile time', () => {
    // Type-level only: the calls are never awaited, so nothing reaches the network.
    const typecheckOnly = () => {
      // @ts-expect-error reason is required
      void client.payments.disputePrepare(RAIL0_ID)
      // @ts-expect-error reason is required
      void client.payments.closeDisputePrepare(RAIL0_ID)
    }
    expect(typecheckOnly).toBeTypeOf('function')
  })

  it('surfaces 422 unknown_dispute_reason with a hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'unknown_dispute_reason',
          title: 'Unknown dispute reason',
          detail: 'That reason is not in the dispute-reason dictionary.',
        }),
        { status: 422 },
      ),
    )
    const err = await client.payments.disputePrepare(RAIL0_ID, 'other').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Rail0ApiError)
    expect((err as Rail0ApiError).code).toBe('unknown_dispute_reason')
    expect((err as Rail0ApiError).hint).toBe(describeError('unknown_dispute_reason'))
    expect(describeError('unknown_dispute_reason')).toContain('DISPUTE_OPEN_REASONS')
  })
})

describe('Dispute type', () => {
  it('carries the reason codes and descriptions, nullable when unrecognised', () => {
    const d: Dispute = {
      status: 'closed',
      reason: `0x${'00'.repeat(32)}`,
      reason_code: null,
      reason_description: UNRECOGNISED_DISPUTE_REASON,
      close_reason: reasonHash('full_refund'),
      close_reason_code: 'full_refund',
      close_reason_description: 'Closed automatically by a full refund',
    }
    expect(d.reason_code).toBeNull()
    expect(d.close_reason_code).toBe('full_refund')
  })
})
