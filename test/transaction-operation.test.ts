import { describe, expect, it } from 'vitest'
import type { StoredTransactionOperation, Transaction, TransactionOperation } from '../src/index.js'

// Two vocabularies, deliberately different sizes:
//
//   TransactionOperation        the six operations with prepare/submit ENDPOINTS
//   StoredTransactionOperation  every operation a transaction ROW can carry (eight)
//
// Collapsing them is what caused the bug: the generated Transaction.operation
// carried only six, so `tx.operation === 'dispute'` was a TS2367 "comparison
// appears unintentional" for a value that genuinely arrives at runtime, and the row
// was reachable only through a cast (#14, unblocked by
// commercelayer/rail0-gateway#177).
//
// These assertions are mostly for `tsc`: the runtime `expect`s exist so the file
// also fails visibly under vitest, but the real guard is that this file must
// COMPILE. A regression in either union breaks typecheck.
describe('transaction operation vocabularies', () => {
  it('lets a stored row be compared against dispute and close_dispute', () => {
    // The exact expression that used to be a type error.
    const row = { operation: 'dispute' } as Pick<Transaction, 'operation'>

    expect(row.operation === 'dispute').toBe(true)
    expect(row.operation === 'close_dispute').toBe(false)
  })

  it('accepts all eight values as a stored operation', () => {
    const all: StoredTransactionOperation[] = [
      'authorize',
      'charge',
      'capture',
      'void',
      'release',
      'refund',
      'dispute',
      'close_dispute',
    ]

    expect(all).toHaveLength(8)
  })

  // The endpoint union must NOT be widened along with it: it is the argument type
  // of prepare/submit/submitByHash, and dispute/close_dispute have their own
  // payer-only routes rather than living under `/payments/:id/:operation`.
  it('keeps the endpoint union at the six generic-namespace operations', () => {
    const endpoints: TransactionOperation[] = [
      'authorize',
      'charge',
      'capture',
      'void',
      'release',
      'refund',
    ]

    expect(endpoints).toHaveLength(6)

    // Every endpoint operation is also a stored one — the subset relation, asserted
    // at the type level.
    const widened: StoredTransactionOperation[] = endpoints
    expect(widened).toEqual(endpoints)

    // @ts-expect-error dispute has its own route and is not a generic-namespace operation
    const wrong: TransactionOperation = 'dispute'
    expect(wrong).toBe('dispute')
  })
})
