import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { toBaseUnits } from './amounts.js'

// ================================================================
//  Pre-sign verification of a gateway-built unsigned transaction
// ================================================================
//
// `signTransaction` used to sign whatever `unsigned_transaction` came back from a
// prepare step. A hostile or merely misconfigured gateway endpoint could therefore
// have the merchant's own key sign an arbitrary transaction — an `approve(spender,
// MAX)` on the token, a capture answered to a void prepare, a capture for a larger
// amount than asked. The checks below run on data the caller already holds (the
// payment record, the operation it asked for, the amount it typed) BEFORE the key
// touches the transaction, so they add no gateway round-trip. A mismatch throws an
// Error whose message starts with "refusing to sign:" and names the field; no
// signature is produced.
//
// Ported from the rail0 CLI's cmd/tx_verify.go, which is the reference for the
// check order and the fail-closed rules.

/** The eight RAIL0 entry points, by the gateway's wire name for the operation. */
export type Rail0Operation =
  | 'authorize'
  | 'charge'
  | 'capture'
  | 'void'
  | 'release'
  | 'refund'
  | 'dispute'
  | 'close_dispute'

/**
 * What the caller independently knows about the transaction it asked the gateway to
 * build. `payment` is the record the caller already has (from `create()` or `get()`);
 * `operation` is the prepare it called; `amount` is the human decimal it passed to
 * `capturePrepare` / `refundPrepare`, and is REQUIRED for those two.
 */
export interface TxExpectation {
  payment: {
    chain_id?: number | null
    rail0_id?: string | null
    rail0_contract?: string | null
    /** The token's decimals, used to scale `amount`; a capture/refund without it is refused. */
    decimals?: number | null
  }
  operation: Rail0Operation | string
  /** Human decimal, exactly as passed to the prepare call (capture and refund only). */
  amount?: string | undefined
}

// RAIL0.sol's `Payment` struct as the ABI encodes it: payer, payee, token, amount
// (uint120), authorizationExpiry and refundExpiry (uint48). All static types, so the
// tuple is encoded INLINE — six 32-byte words right after the paymentId — which is
// what fixes the position of the amount argument below.
const PAYMENT_TUPLE = '(address,address,address,uint120,uint48,uint48)'

/**
 * The RAIL0 function signatures, keyed by operation. Copied from RAIL0.sol; the test
 * suite pins the derived selectors against the contract's compiled
 * `methodIdentifiers`, so a typo here cannot agree with itself.
 */
export const RAIL0_FUNCTION_SIGNATURES: Readonly<Record<Rail0Operation, string>> = {
  authorize: `authorize(bytes32,${PAYMENT_TUPLE},uint8,bytes32,bytes32)`,
  charge: `charge(bytes32,${PAYMENT_TUPLE},uint8,bytes32,bytes32)`,
  capture: `capture(bytes32,${PAYMENT_TUPLE},uint256)`,
  void: `void(bytes32,${PAYMENT_TUPLE})`,
  release: `release(bytes32,${PAYMENT_TUPLE})`,
  refund: `refund(bytes32,${PAYMENT_TUPLE},uint256,uint8,bytes32,bytes32)`,
  dispute: `dispute(bytes32,${PAYMENT_TUPLE},bytes32)`,
  close_dispute: `closeDispute(bytes32,${PAYMENT_TUPLE},bytes32)`,
}

function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

/**
 * Operation → 4-byte selector as 8 lowercase hex chars: the first four bytes of
 * keccak256(signature), computed from the table above rather than hand-copied.
 */
export const RAIL0_SELECTORS: Readonly<Record<Rail0Operation, string>> = Object.fromEntries(
  Object.entries(RAIL0_FUNCTION_SIGNATURES).map(([op, sig]) => [
    op,
    bytesToHex(keccak_256(new TextEncoder().encode(sig)).slice(0, 4)),
  ]),
) as Record<Rail0Operation, string>

// Calldata position (in 32-byte words after the selector) of the `uint256 amount`
// argument of capture and refund: word 0 is the paymentId, words 1-6 the inline
// Payment tuple, so the amount is word 7. Only these two operations take an amount.
const AMOUNT_WORD: Readonly<Partial<Record<Rail0Operation, number>>> = { capture: 7, refund: 7 }

const SELECTOR_LEN = 8 // hex chars
const WORD_LEN = 64 // hex chars

/**
 * Folds the vocabularies an operation arrives in onto the wire name: `closeDispute`
 * (the SDK method), `close dispute` (a label) and `close_dispute` (the gateway) are one
 * operation.
 */
export function canonicalOperation(op: string): string {
  return op
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function refuse(message: string): never {
  throw new Error(`refusing to sign: ${message}`)
}

/**
 * The encodings a zero native value legitimately arrives in — absent, null, the number
 * 0, or the string "0" / "0x0". A whitelist, deliberately: anything unrecognised must
 * refuse the signature rather than be guessed at.
 */
function isZeroNativeValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'number') return value === 0
  if (typeof value === 'bigint') return value === 0n
  if (typeof value !== 'string') return false
  const s = value.trim()
  return s === '' || s === '0' || s.toLowerCase() === '0x0'
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase()
}

/** Names a selector for an error message: the RAIL0 function when it is one of ours. */
function describeSelector(sel: string): string {
  for (const [op, s] of Object.entries(RAIL0_SELECTORS)) {
    if (s === sel) {
      const sig = RAIL0_FUNCTION_SIGNATURES[op as Rail0Operation]
      return `${sig.slice(0, sig.indexOf('('))}()`
    }
  }
  return `selector 0x${sel}`
}

/**
 * Asserts the call is the RAIL0 function for `operation` and, for capture and refund,
 * that it moves exactly the amount asked for.
 *
 * Checking the paymentId alone binds the transaction to the right PAYMENT but not to
 * the right OPERATION: every RAIL0 function takes the paymentId first, so a hostile
 * endpoint could answer a void prepare with capture calldata (settling the escrow to
 * the merchant instead of returning it). The selector closes that; the amount word
 * closes the remaining capture/refund swap — the right function for a different
 * quantity than the caller typed.
 *
 * FAIL-CLOSED: an operation with no known selector, or an amount-taking operation
 * whose amount cannot be scaled locally (no amount, no decimals), refuses rather than
 * skips. `wantBaseUnits` is the caller's own input scaled by the token's decimals —
 * the gateway's word for the amount is never the right-hand side here.
 */
function checkCalldataCall(data: string, operation: string, wantBaseUnits: string | undefined) {
  const key = canonicalOperation(operation) as Rail0Operation
  const want = RAIL0_SELECTORS[key]
  if (!want) refuse(`no known RAIL0 function for operation "${operation}"`)
  const raw = stripHex(data)
  if (raw.length < SELECTOR_LEN) {
    refuse(`calldata is ${raw.length} hex chars, too short to carry a function selector`)
  }
  const got = raw.slice(0, SELECTOR_LEN)
  if (got !== want) {
    refuse(
      `the call is ${describeSelector(got)} but you asked to ${key} (${RAIL0_FUNCTION_SIGNATURES[key]})`,
    )
  }

  const word = AMOUNT_WORD[key]
  if (word === undefined) return
  if (wantBaseUnits === undefined) {
    refuse(`cannot check the ${key} amount without the amount you asked for`)
  }
  let wantInt: bigint
  try {
    wantInt = BigInt(wantBaseUnits)
  } catch {
    refuse(`expected amount "${wantBaseUnits}" is not a base-unit integer`)
  }
  const start = SELECTOR_LEN + word * WORD_LEN
  if (raw.length < start + WORD_LEN) {
    refuse(`calldata is ${raw.length} hex chars, too short to carry the ${key} amount`)
  }
  const gotInt = BigInt(`0x${raw.slice(start, start + WORD_LEN)}`)
  if (gotInt !== wantInt) {
    refuse(`the call would ${key} ${gotInt} base units but you asked for ${wantInt}`)
  }
}

/**
 * Asserts the call's first argument is THIS payment's id.
 *
 * All eight RAIL0 operations take `bytes32 paymentId` first, so under ABI encoding the
 * id always occupies bytes 4..36 of the calldata. A hostile gateway's most profitable
 * swap is `approve(spender, MAX)` on the token contract, which this rejects: approve's
 * first argument is a left-padded address, so it cannot be a rail0_id. Skipped only
 * when there is no usable rail0_id to compare against.
 */
function checkCalldataPaymentId(data: string, rail0Id: string | null | undefined) {
  const want = stripHex(rail0Id ?? '')
  if (want.length !== WORD_LEN) return
  const raw = stripHex(data)
  if (raw.length < SELECTOR_LEN + WORD_LEN) {
    refuse(`calldata is ${raw.length} hex chars, too short to carry a paymentId`)
  }
  const got = raw.slice(SELECTOR_LEN, SELECTOR_LEN + WORD_LEN)
  if (got !== want) refuse(`the call acts on payment 0x${got} but you asked for 0x${want}`)
}

function stripHex(s: string): string {
  const lower = s.trim().toLowerCase()
  return lower.startsWith('0x') ? lower.slice(2) : lower
}

/** The address a private key signs as — the one `from` must name. */
export function signerAddress(privateKey: `0x${string}` | Uint8Array): string {
  const keyBytes =
    privateKey instanceof Uint8Array
      ? privateKey
      : Uint8Array.from(stripHex(privateKey).match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16))
  const pub = secp256k1.getPublicKey(keyBytes, false) // 0x04 || X || Y
  return `0x${bytesToHex(keccak_256(pub.slice(1)).slice(12))}`
}

/**
 * Verifies a gateway-built `unsigned_transaction` against what the caller asked for,
 * BEFORE any key touches it. Throws `Error("refusing to sign: …")` naming the first
 * field that disagrees; returns the parsed transaction otherwise.
 *
 * In order:
 *  1. the JSON parses;
 *  2. `value` is zero — every RAIL0 operation is value-0, funds move as token
 *     transfers the contract performs, so a non-zero value is the gateway asking for ETH;
 *  3. `chain_id` is the payment's chain;
 *  4. `from`, when present, is the signing key's address (`signer`);
 *  5. `to` is the payment's `rail0_contract` — a consistency check (the address comes
 *     from the same gateway), but it catches a response stitched from two payments;
 *  6. the 4-byte selector is the RAIL0 function for `operation`, and for capture and
 *     refund the amount word equals `amount` scaled by the payment's `decimals`;
 *  7. the paymentId word is the payment's `rail0_id`.
 *
 * Every right-hand side is something the caller supplied or derived locally — never
 * the prepare response itself.
 */
export function verifyUnsignedTransaction(
  unsignedTransaction: string | Record<string, unknown>,
  expectation: TxExpectation,
  signer?: string,
): Record<string, unknown> {
  let tx: Record<string, unknown>
  if (typeof unsignedTransaction === 'string') {
    try {
      tx = JSON.parse(unsignedTransaction)
    } catch (err) {
      refuse(`the gateway's unsigned transaction is not valid JSON: ${(err as Error).message}`)
    }
  } else {
    tx = unsignedTransaction
  }
  if (tx === null || typeof tx !== 'object') refuse('the unsigned transaction is not an object')

  const { payment, operation } = expectation
  if (!payment) refuse('cannot check the transaction without the payment it is for')

  if (!isZeroNativeValue(tx.value)) {
    refuse(
      `transaction attaches native currency (value=${String(tx.value)}); every RAIL0 operation is value-0`,
    )
  }

  if (payment.chain_id && Number(tx.chain_id) !== payment.chain_id) {
    refuse(
      `transaction targets chain ${tx.chain_id} but this payment is on chain ${payment.chain_id}`,
    )
  }

  const from = typeof tx.from === 'string' ? tx.from : ''
  if (signer && from && !same(from, signer)) {
    refuse(`transaction is prepared from ${from} but the signing key is ${signer}`)
  }

  const to = typeof tx.to === 'string' ? tx.to : ''
  if (payment.rail0_contract && to && !same(to, payment.rail0_contract)) {
    refuse(
      `transaction is addressed to ${to} but this payment's RAIL0 contract is ${payment.rail0_contract}`,
    )
  }

  const data = typeof tx.data === 'string' ? tx.data : ''
  // The operation before the payment id, so a swapped operation is named as such.
  checkCalldataCall(data, operation, expectedBaseUnits(expectation))
  checkCalldataPaymentId(data, payment.rail0_id)
  return tx
}

/**
 * Scales the human amount the CALLER typed by the token's decimals, for comparison
 * against the calldata. Undefined when the operation takes no amount; for one that
 * does, a missing amount or unknown decimals leaves `checkCalldataCall` to refuse —
 * the whole guard exists for that comparison, so it must not be skipped.
 */
function expectedBaseUnits({ payment, operation, amount }: TxExpectation): string | undefined {
  const key = canonicalOperation(operation) as Rail0Operation
  if (AMOUNT_WORD[key] === undefined) return undefined
  if (amount === undefined || amount === '') {
    refuse(`cannot check the ${key} amount without the amount you asked for`)
  }
  if (payment.decimals === undefined || payment.decimals === null) {
    refuse(
      `the payment's token decimals are unknown, so the ${key} amount cannot be checked (fetch the payment with get() first)`,
    )
  }
  try {
    return toBaseUnits(amount, payment.decimals)
  } catch (err) {
    refuse(`amount "${amount}": ${(err as Error).message}`)
  }
}
