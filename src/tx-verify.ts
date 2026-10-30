import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { toBaseUnits } from './amounts.js'
import type { SigningPayload } from './resources/types.js'

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
 * `payment.rail0_contract` is REQUIRED too: the transaction's `to` is always checked.
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

/**
 * Trims, lowercases and drops a `0x` / `0X` prefix. The one hex normalization of the
 * package: the signer decodes bytes through it too, so the bytes that get signed are
 * the bytes these checks looked at (a `0X…` that verified but was then decoded with
 * its prefix as a byte would sign something else).
 */
export function stripHex(s: string): string {
  const lower = s.trim().toLowerCase()
  return lower.startsWith('0x') ? lower.slice(2) : lower
}

/** A 20-byte hex address, `0x`-prefixed in either case; checksum casing is not enforced. */
function isAddress(s: string): boolean {
  return /^0x[0-9a-f]{40}$/i.test(s.trim())
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
 *  5. `to` is an address — never missing or empty, which would sign a contract
 *     creation — and equals the payment's `rail0_contract`, which must be known. A
 *     consistency check (the address comes from the same gateway), but it catches a
 *     response stitched from two payments;
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

  // FAIL-CLOSED, unlike the checks above: a missing, empty or null `to` is not "nothing
  // to compare" but a CONTRACT-CREATION transaction — RLP encodes an absent recipient
  // as the empty string, and the key would sign a deployment of whatever bytecode the
  // gateway put in `data`. So `to` must be an address, and the payment must name the
  // contract it is compared against.
  const to = typeof tx.to === 'string' ? tx.to.trim() : ''
  if (!isAddress(to)) {
    refuse(
      to === ''
        ? 'transaction has no recipient (`to` is missing or empty), which would deploy a contract'
        : `transaction recipient ${to} is not an address`,
    )
  }
  if (!payment.rail0_contract) {
    refuse(
      "cannot check the transaction's recipient without the payment's rail0_contract (fetch the payment with get() first)",
    )
  }
  if (!same(to, payment.rail0_contract)) {
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

// ================================================================
//  Pre-sign verification of a gateway-built EIP-712 authorization
// ================================================================
//
// The counterpart of verifyUnsignedTransaction for the `signing_payload` the gateway
// hands out at create() (the payer's TransferWithAuthorization / ReceiveWithAuthorization)
// and at refundPrepare phase-1 (the payee's ReceiveWithAuthorization). It is the MORE
// dangerous of the two artifacts: an EIP-3009 authorization is a bearer instrument the
// TOKEN honours on its own, with no RAIL0 involvement, for up to `message.value`. An
// endpoint that answered a refund prepare with {from: <payee>, to: <attacker>, value:
// <the payee's whole balance>} used to get exactly that signed.
//
// Ported from the rail0 CLI's verifySigningPayload (cmd/tx_verify.go): same checks,
// same order, same "refusing to sign: …" wording. Checking does not break the
// sign-the-payload-verbatim rule: the typehash still comes from the payload's own
// primaryType and the digest from its message; this only refuses a message whose
// fields contradict what the caller asked for.
//
// What it does NOT establish: `message.to` is compared with the payment record's
// rail0_contract (the same gateway's word, so not independent), and `message.nonce` is
// not recomputed — that would need the deployment's VERSION(), which no payment
// response carries. The bounded residual is an authorization for the RIGHT token, on
// the RIGHT chain, from the RIGHT signer, for EXACTLY the amount asked for.

/**
 * What the caller independently knows about the authorization it is about to sign.
 *
 * `payment` is the record the caller holds — the `PaymentDetail` from `create()` or
 * `get()`. Its `chain_id`, `token` and `rail0_contract` are REQUIRED (every payment
 * detail carries them); a missing one refuses rather than skips the check.
 *
 * The value right-hand side is `amount` — the human decimal the caller typed, scaled by
 * `payment.decimals` — when given, and the payment's own stored base-unit `amount`
 * otherwise. Pass `amount` for a REFUND: the payment's own amount is the whole payment,
 * not the part being refunded. For the payer's signature after `create()` either works;
 * passing what you sent to `create()` holds the gateway to your own input.
 */
export interface SigningPayloadExpectation {
  payment: {
    chain_id?: number | null
    /** The payment's token — the EIP-712 domain's `verifyingContract` for EIP-3009. */
    token?: string | null
    /** The RAIL0 contract the authorization must pay (`message.to`). */
    rail0_contract?: string | null
    /** Stored amount in base units; the expected value when `amount` is omitted. */
    amount?: string | null
    /** The token's decimals, used to scale `amount`. */
    decimals?: number | null
  }
  /** Human decimal you asked for (e.g. what you passed to `refundPrepare`). */
  amount?: string | undefined
}

/**
 * Verifies a gateway-built EIP-712 `signing_payload` against what the caller asked for,
 * BEFORE any key touches it. Throws `Error("refusing to sign: …")` naming the first
 * field that disagrees; returns the payload otherwise.
 *
 * In order (the CLI's):
 *  1. `message.from` is the signing key's address (`signer`, when given — the checked
 *     `signSigningPayload` always derives it from the key);
 *  2. `domain.chainId` is the payment's `chain_id`;
 *  3. `domain.verifyingContract` is the payment's `token` — what stops an authorization
 *     minted against another token the signer happens to hold;
 *  4. `message.to` is the payment's `rail0_contract`;
 *  5. `message.value` is EXACTLY the expected base units — not a ceiling.
 *
 * Before those, the typed-data envelope itself (`checkTypedData`): `primaryType` is
 * one of the two EIP-3009 authorization types, `types[primaryType]` is EXACTLY the
 * EIP-3009 field list, `types.EIP712Domain` (when present) is exactly the token domain's
 * field list, and `types` defines nothing else. A key signer rebuilds the digest from
 * fixed typehashes, but a browser wallet hashes whatever `types` says — so without this
 * a payload could rename or retype fields under the same names and the wallet would
 * sign a struct the token never verifies, or one the checks above never read.
 *
 * FAIL-CLOSED: a missing payload, a missing chain/token/contract on the payment, or a
 * value that cannot be derived locally (no amount, unknown decimals, an amount finer
 * than the token's decimals) refuses rather than skips. The validity window is not
 * checked — matching the CLI.
 */
export function verifySigningPayload(
  payload: SigningPayload | null | undefined,
  expectation: SigningPayloadExpectation,
  signer?: string,
): SigningPayload {
  if (!payload || typeof payload !== 'object') {
    refuse(
      'there is no signing payload to check (already signed, or the gateway could not build one)',
    )
  }
  const payment = expectation?.payment
  if (!payment) refuse('cannot check the authorization without the payment it is for')
  const { domain, message } = payload
  if (!domain || !message) refuse('the signing payload has no domain or message')
  checkTypedData(payload)

  // The one comparison whose right-hand side is derived from the private key itself,
  // so it holds no matter what the endpoint claims.
  if (signer && !same(String(message.from ?? ''), signer)) {
    refuse(`the authorization is from ${message.from} but the signing key is ${signer}`)
  }

  if (!payment.chain_id)
    refuse("cannot check the authorization's chain without the payment's chain_id")
  if (Number(domain.chainId) !== payment.chain_id) {
    refuse(
      `the authorization is scoped to chain ${domain.chainId} but this payment is on chain ${payment.chain_id}`,
    )
  }

  if (!payment.token) refuse("cannot check the authorization's token without the payment's token")
  if (!same(String(domain.verifyingContract ?? ''), payment.token)) {
    refuse(
      `the authorization is against token ${domain.verifyingContract} but this payment's token is ${payment.token}`,
    )
  }

  if (!payment.rail0_contract) {
    refuse(
      "cannot check the authorization's recipient without the payment's rail0_contract (fetch the payment with get() first)",
    )
  }
  if (!same(String(message.to ?? ''), payment.rail0_contract)) {
    refuse(
      `the authorization pays ${message.to} but this payment's RAIL0 contract is ${payment.rail0_contract}`,
    )
  }

  const want = expectedPayloadValue(expectation)
  const got = String(message.value ?? '').trim()
  // Exact, not a ceiling: the gateway signs for the full amount of the operation, so
  // anything else is a mismatch rather than a partial authorization.
  if (!/^\d+$/.test(got) || BigInt(got) !== BigInt(want)) {
    refuse(`the authorization is for ${message.value} base units but you asked for ${want}`)
  }
  return payload
}

/**
 * The EIP-3009 authorization types the gateway emits. Which one a payment needs depends
 * on the RAIL0 deployment's contract version, which no payment response carries:
 * 1.4.0 and later use ReceiveWithAuthorization for authorize/charge, 1.1.0–1.3.x used
 * TransferWithAuthorization, and refunds are ReceiveWithAuthorization on every version.
 * So both are accepted and nothing else is.
 */
const EIP3009_PRIMARY_TYPES = ['TransferWithAuthorization', 'ReceiveWithAuthorization']

/** The EIP-3009 struct, shared by both types — names, types AND order are the typehash. */
const EIP3009_FIELDS: readonly [string, string][] = [
  ['from', 'address'],
  ['to', 'address'],
  ['value', 'uint256'],
  ['validAfter', 'uint256'],
  ['validBefore', 'uint256'],
  ['nonce', 'bytes32'],
]

/** The token's EIP-712 domain, as the gateway declares it and FiatToken hashes it. */
const EIP712_DOMAIN_FIELDS: readonly [string, string][] = [
  ['name', 'string'],
  ['version', 'string'],
  ['chainId', 'uint256'],
  ['verifyingContract', 'address'],
]

/**
 * Refuses a typed-data envelope that is not exactly the gateway's EIP-3009 shape: an
 * unknown `primaryType`, a `types[primaryType]` that differs from the EIP-3009 struct
 * in any name, type or position, an `EIP712Domain` that differs from the token domain,
 * or any further type definition.
 */
function checkTypedData(payload: SigningPayload): void {
  const { primaryType, types } = payload
  if (!EIP3009_PRIMARY_TYPES.includes(primaryType)) {
    refuse(
      `the authorization's primaryType ${JSON.stringify(primaryType)} is not an EIP-3009 authorization type (TransferWithAuthorization or ReceiveWithAuthorization)`,
    )
  }
  if (!types || typeof types !== 'object' || Array.isArray(types)) {
    refuse('the signing payload has no types')
  }
  for (const name of Object.keys(types)) {
    if (name !== primaryType && name !== 'EIP712Domain') {
      refuse(
        `the signing payload's types define ${JSON.stringify(name)}, which an EIP-3009 authorization does not use`,
      )
    }
  }
  checkTypeFields(`types.${primaryType}`, types[primaryType], EIP3009_FIELDS)
  if (Object.hasOwn(types, 'EIP712Domain')) {
    checkTypeFields('types.EIP712Domain', types.EIP712Domain, EIP712_DOMAIN_FIELDS)
  }
}

function checkTypeFields(label: string, got: unknown, want: readonly [string, string][]): void {
  const expected = want.map(([n, t]) => `${t} ${n}`).join(',')
  const fields = Array.isArray(got) ? got : []
  const actual = fields.map((f) =>
    f && typeof f === 'object' && !Array.isArray(f)
      ? `${String((f as Record<string, unknown>).type)} ${String((f as Record<string, unknown>).name)}`
      : JSON.stringify(f),
  )
  const exact =
    Array.isArray(got) &&
    got.length === want.length &&
    got.every((f, i) => {
      if (!f || typeof f !== 'object' || Array.isArray(f)) return false
      const keys = Object.keys(f)
      const rec = f as Record<string, unknown>
      return keys.length === 2 && rec.name === want[i]?.[0] && rec.type === want[i]?.[1]
    })
  if (!exact) {
    refuse(
      `${label} is (${Array.isArray(got) ? actual.join(',') : JSON.stringify(got ?? null)}) but must be exactly (${expected})`,
    )
  }
}

/**
 * The base units the authorization must carry: the caller's `amount` scaled by the
 * payment's decimals, or the payment's stored amount. Refuses when neither yields a
 * base-unit integer — skipping here would drop the one check the guard exists for.
 */
function expectedPayloadValue({ payment, amount }: SigningPayloadExpectation): string {
  if (amount !== undefined) {
    if (amount === '')
      refuse("cannot check the authorization's amount without the amount you asked for")
    if (payment.decimals === undefined || payment.decimals === null) {
      refuse(
        "the payment's token decimals are unknown, so the authorization's amount cannot be checked (fetch the payment with get() first)",
      )
    }
    try {
      return toBaseUnits(amount, payment.decimals)
    } catch (err) {
      refuse(`amount "${amount}": ${(err as Error).message}`)
    }
  }
  const stored = String(payment.amount ?? '').trim()
  if (!/^\d+$/.test(stored)) {
    refuse(
      "cannot check the authorization's amount: pass the amount you asked for, or a payment carrying its base-unit amount",
    )
  }
  return stored
}

// ================================================================
//  Pre-sign verification of a gateway-built payout transfer
// ================================================================
//
// A payout's `unsigned_transaction` is a plain ERC-20 `transfer(address,uint256)` on the
// token contract — so, unlike a RAIL0 call, the calldata IS the money: whoever controls
// it controls where the merchant's balance goes. The gateway answers it BESIDE its
// decoded intent (`chain_id`, `token`, `address`, `amount` on the Payout), and the check
// below holds the transaction to that intent EXACTLY — and, when the caller passes them,
// the intent to the destination the caller picked and to the amount it typed. Ported from
// rail0-admin's assertTransferCall / assertPreparedMatches; same "refusing to sign: …"
// wording as the payment checks above.

/** The ERC-20 function a payout calls. */
export const ERC20_TRANSFER_SIGNATURE = 'transfer(address,uint256)'

/** `transfer(address,uint256)`'s selector as 8 lowercase hex chars (`a9059cbb`), derived. */
export const ERC20_TRANSFER_SELECTOR: string = bytesToHex(
  keccak_256(new TextEncoder().encode(ERC20_TRANSFER_SIGNATURE)).slice(0, 4),
)

/**
 * What the caller independently knows about the payout it is about to sign.
 *
 * `payout` is the prepared record (`payouts.prepare()` / `payouts.get()`); its `chain_id`,
 * `token`, `address` and `amount` are REQUIRED — they are what the transaction is held to.
 *
 * The rest bind that record to the CALLER's own input, and are each checked when given:
 * - `destination`: the destination the caller picked (its own record, from
 *   `payoutDestinations.get()` or `create()`) — the payout must be on its chain, in its
 *   token, to its address. Catches a prepare answered for another destination.
 * - `amount`: the human decimal the caller passed to prepare. Checked exactly, scaled by
 *   `decimals`, which is then REQUIRED (a scale the gateway reports would let it inflate
 *   the amount). `"all"` is decided by the gateway and skipped here — use `maxAmount`.
 * - `maxAmount`: a base-unit ceiling (e.g. the balance the caller read, or one whole token
 *   for a proof): the payout may move at most this much.
 */
export interface PayoutTxExpectation {
  payout: {
    id?: string | null
    destination_id?: string | null
    chain_id?: number | null
    token?: string | null
    /** The recipient. */
    address?: string | null
    /** Base units. */
    amount?: string | null
  }
  destination?: {
    id?: string | null
    chain_id?: number | null
    token?: string | null
    address?: string | null
  }
  /** Human decimal as passed to prepare (`"25.50"`), or `"all"` (not checked exactly). */
  amount?: string | undefined
  /** The token's decimals, to scale `amount`. Required when `amount` is a decimal. */
  decimals?: number | undefined
  /** At most this many base units may move. */
  maxAmount?: string | undefined
}

/**
 * Verifies a payout's gateway-built `unsigned_transaction` BEFORE any key touches it.
 * Throws `Error("refusing to sign: …")` naming the first field that disagrees; returns the
 * parsed transaction otherwise.
 *
 * In order:
 *  1. the JSON parses, and the payout carries its chain, token, recipient and amount;
 *  2. the payout is for the caller's `destination` (chain, token, address, id), when given;
 *  3. the payout's amount is the caller's `amount` scaled by `decimals` (unless `"all"`),
 *     and at most `maxAmount`, when given;
 *  4. `value` is zero — a token transfer never attaches native currency;
 *  5. `chain_id` is the payout's chain;
 *  6. `from`, when present, is the signing key's address (`signer`);
 *  7. `to` is an address (never empty: that would sign a contract creation) and is the
 *     payout's TOKEN contract;
 *  8. the calldata is EXACTLY `transfer(payout.address, payout.amount)`: the selector
 *     `0xa9059cbb`, the recipient word (12 zero bytes + the address), the amount word,
 *     and nothing after them.
 *
 * FAIL-CLOSED throughout: a missing field refuses rather than skips.
 */
export function verifyPayoutTransaction(
  unsignedTransaction: string | Record<string, unknown> | null | undefined,
  expectation: PayoutTxExpectation,
  signer?: string,
): Record<string, unknown> {
  if (unsignedTransaction === null || unsignedTransaction === undefined) {
    refuse('the payout has no unsigned transaction (already signed, or not pending)')
  }
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

  const payout = expectation?.payout
  if (!payout) refuse('cannot check the transfer without the payout it is for')
  const chainId = payout.chain_id
  const token = (payout.token ?? '').trim()
  const recipient = (payout.address ?? '').trim()
  const amount = String(payout.amount ?? '').trim()
  if (!chainId) refuse("cannot check the transfer's chain without the payout's chain_id")
  if (!isAddress(token))
    refuse(`the payout's token ${JSON.stringify(payout.token ?? null)} is not an address`)
  if (!isAddress(recipient)) {
    refuse(
      `the payout's destination address ${JSON.stringify(payout.address ?? null)} is not an address`,
    )
  }
  if (!/^\d+$/.test(amount))
    refuse(`the payout's amount ${JSON.stringify(payout.amount ?? null)} is not base units`)

  checkPayoutIntent(expectation, chainId, token, recipient, BigInt(amount))

  if (!isZeroNativeValue(tx.value)) {
    refuse(
      `transaction attaches native currency (value=${String(tx.value)}); a token transfer is value-0`,
    )
  }
  if (Number(tx.chain_id) !== chainId) {
    refuse(`transaction targets chain ${tx.chain_id} but this payout is on chain ${chainId}`)
  }
  const from = typeof tx.from === 'string' ? tx.from : ''
  if (signer && from && !same(from, signer)) {
    refuse(`transaction is prepared from ${from} but the signing key is ${signer}`)
  }
  const to = typeof tx.to === 'string' ? tx.to.trim() : ''
  if (!isAddress(to)) {
    refuse(
      to === ''
        ? 'transaction has no recipient (`to` is missing or empty), which would deploy a contract'
        : `transaction recipient ${to} is not an address`,
    )
  }
  if (!same(to, token)) {
    refuse(`transaction is addressed to ${to} but this payout's token is ${token}`)
  }

  checkTransferCalldata(typeof tx.data === 'string' ? tx.data : '', recipient, BigInt(amount))
  return tx
}

/** Steps 2-3 of verifyPayoutTransaction: the payout's intent against the caller's input. */
function checkPayoutIntent(
  { payout, destination, amount, decimals, maxAmount }: PayoutTxExpectation,
  chainId: number,
  token: string,
  recipient: string,
  got: bigint,
): void {
  if (destination) {
    if (destination.id && payout.destination_id && destination.id !== payout.destination_id) {
      refuse(`the payout is for destination ${payout.destination_id}, not ${destination.id}`)
    }
    if (!destination.chain_id || destination.chain_id !== chainId) {
      refuse(
        `the payout is on chain ${chainId} but the destination is on chain ${destination.chain_id}`,
      )
    }
    if (!destination.token || !same(destination.token, token)) {
      refuse(`the payout moves token ${token} but the destination takes ${destination.token}`)
    }
    if (!destination.address || !same(destination.address, recipient)) {
      refuse(`the payout pays ${recipient} but the destination's address is ${destination.address}`)
    }
  }
  if (amount !== undefined && amount.trim().toLowerCase() !== 'all') {
    if (decimals === undefined || decimals === null) {
      refuse("the token's decimals are unknown, so the payout amount cannot be checked")
    }
    let want: string
    try {
      want = toBaseUnits(amount, decimals)
    } catch (err) {
      refuse(`amount "${amount}": ${(err as Error).message}`)
    }
    if (BigInt(want) !== got) refuse(`the payout moves ${got} base units but you asked for ${want}`)
  }
  if (maxAmount !== undefined) {
    if (!/^\d+$/.test(maxAmount.trim())) refuse(`maxAmount "${maxAmount}" is not base units`)
    if (got > BigInt(maxAmount.trim())) {
      refuse(`the payout moves ${got} base units, more than the ${maxAmount.trim()} allowed`)
    }
  }
}

/**
 * Asserts the calldata is exactly `transfer(recipient, amount)`: 4 + 32 + 32 bytes, no
 * more. The recipient word's upper 12 bytes must be zero — a dirty word is a different
 * input to the token than the address it ends in — and nothing may trail the two words.
 */
function checkTransferCalldata(data: string, recipient: string, amount: bigint): void {
  const raw = stripHex(data)
  if (!/^[0-9a-f]*$/.test(raw)) refuse('the calldata is not hex')
  if (raw.length < SELECTOR_LEN) refuse('the transaction carries no function call')
  const sel = raw.slice(0, SELECTOR_LEN)
  if (sel !== ERC20_TRANSFER_SELECTOR) {
    refuse(`the call is ${describeSelector(sel)}, not ${ERC20_TRANSFER_SIGNATURE}`)
  }
  const want = SELECTOR_LEN + 2 * WORD_LEN
  if (raw.length < want) refuse(`calldata is ${raw.length} hex chars, too short for a transfer`)
  if (raw.length > want) {
    refuse(`calldata carries ${(raw.length - want) / 2} bytes after the transfer's two arguments`)
  }
  const toWord = raw.slice(SELECTOR_LEN, SELECTOR_LEN + WORD_LEN)
  const wantTo = stripHex(recipient)
  if (toWord.slice(0, 24) !== '0'.repeat(24)) {
    refuse(`the transfer's recipient word 0x${toWord} is not a left-padded address`)
  }
  if (toWord.slice(24) !== wantTo) {
    refuse(`the transfer pays 0x${toWord.slice(24)} but the payout's destination is ${recipient}`)
  }
  const value = BigInt(`0x${raw.slice(SELECTOR_LEN + WORD_LEN)}`)
  if (value !== amount) {
    refuse(`the transfer moves ${value} base units but the payout is for ${amount}`)
  }
}
