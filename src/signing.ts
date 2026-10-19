import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import type { Address, Bytes32, PaymentConfig, SigningPayload } from './resources/types.js'
import {
  type SigningPayloadExpectation,
  signerAddress,
  stripHex,
  type TxExpectation,
  verifySigningPayload,
  verifyUnsignedTransaction,
} from './tx-verify.js'

// ================================================================
//  EIP-712 type strings
// ================================================================

const DOMAIN_TYPE =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'

const TRANSFER_TYPE =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'

// EIP-3009 receiveWithAuthorization — same field layout as transfer, different
// primaryType (so a distinct type hash). Used for refunds (the payee signs).
const RECEIVE_TYPE =
  'ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'

// Pre-computed type hashes
const DOMAIN_TYPEHASH = keccak_256(new TextEncoder().encode(DOMAIN_TYPE))
const TRANSFER_TYPEHASH = keccak_256(new TextEncoder().encode(TRANSFER_TYPE))
const RECEIVE_TYPEHASH = keccak_256(new TextEncoder().encode(RECEIVE_TYPE))

// ================================================================
//  ABI encoding (fixed-size types: address, uint256, bytes32)
// ================================================================

/**
 * Decodes hex through the same normalisation the pre-sign checks use (`stripHex`:
 * trimmed, either `0x` / `0X` prefix), so the bytes signed are the bytes verified. It
 * used to strip only a lowercase `0x`: `0X…` calldata passed verification and was then
 * signed with its "0X" decoded as a leading 0x00 byte. Strict: odd length or a non-hex
 * character throws instead of decoding to zeros.
 */
function hexToBytes(hex: string): Uint8Array {
  const h = stripHex(hex)
  if (h.length % 2 !== 0 || !/^[0-9a-f]*$/.test(h)) {
    throw new Error(`invalid hex string: ${hex.length > 20 ? `${hex.slice(0, 20)}…` : hex}`)
  }
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < h.length; i += 2) out[i >> 1] = Number.parseInt(h.slice(i, i + 2), 16)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function abiAddress(address: Address): Uint8Array {
  const out = new Uint8Array(32) // 12 zero-pad + 20 bytes
  out.set(hexToBytes(address), 12)
  return out
}

function abiUint256(value: bigint): Uint8Array {
  const out = new Uint8Array(32)
  let v = value
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function bytesSliceToHex(bytes: Uint8Array, start: number, end: number): Bytes32 {
  return `0x${Array.from(bytes.slice(start, end), (b) => b.toString(16).padStart(2, '0')).join('')}` as Bytes32
}

// ================================================================
//  EIP-712 digest construction
// ================================================================

function hashDomainSeparator(domain: TokenDomain): Uint8Array {
  return keccak_256(
    concat(
      DOMAIN_TYPEHASH,
      keccak_256(new TextEncoder().encode(domain.name)),
      keccak_256(new TextEncoder().encode(domain.version)),
      abiUint256(BigInt(domain.chainId)),
      abiAddress(domain.verifyingContract),
    ),
  )
}

function hashStruct(
  p: {
    from: Address
    to: Address
    value: bigint
    validAfter: bigint
    validBefore: bigint
    nonce: Bytes32
  },
  typeHash: Uint8Array,
): Uint8Array {
  return keccak_256(
    concat(
      typeHash,
      abiAddress(p.from),
      abiAddress(p.to),
      abiUint256(p.value),
      abiUint256(p.validAfter),
      abiUint256(p.validBefore),
      hexToBytes(p.nonce),
    ),
  )
}

function buildDigest(
  domain: TokenDomain,
  transfer: {
    from: Address
    to: Address
    value: bigint
    validAfter: bigint
    validBefore: bigint
    nonce: Bytes32
  },
  typeHash: Uint8Array,
): Uint8Array {
  return keccak_256(
    concat(
      new Uint8Array([0x19, 0x01]),
      hashDomainSeparator(domain),
      hashStruct(transfer, typeHash),
    ),
  )
}

// ================================================================
//  Public types
// ================================================================

/** EIP-712 domain of the ERC-20 token (NOT the RAIL0 contract). */
export interface TokenDomain {
  /** Token's EIP-712 name, e.g. "USD Coin" for USDC. */
  name: string
  /** Token's EIP-712 version, e.g. "2" for USDC. */
  version: string
  chainId: number
  /** Token contract address — used as verifyingContract in the domain. */
  verifyingContract: Address
}

/** EIP-3009 transferWithAuthorization signature, ready to pass into authorize / charge. */
export interface Eip3009Signature {
  v: 27 | 28
  r: Bytes32
  s: Bytes32
}

/**
 * Anything carrying the gateway's EIP-712 payload: a `PaymentDetail`, a refund
 * `Transaction`, or a bare `{ signing_payload }`. `signPayment` / `signRefund`
 * read only that one field, so they ask only for it — demanding the whole record
 * forced callers into a cast that would swallow a real shape change.
 */
export interface WithSigningPayload {
  signing_payload?: SigningPayload | null
}

/** Parameters for a raw transferWithAuthorization signature. */
export interface SignTransferParams {
  from: Address
  /** Recipient of the transfer — the RAIL0 contract address. */
  to: Address
  /** Amount in token base units (e.g. 6 decimals for USDC). */
  value: bigint
  /** Earliest block timestamp at which the signature is valid (default: 0). */
  validAfter?: bigint
  /** Latest block timestamp at which the signature is valid. */
  validBefore: bigint
  /** Unique bytes32 nonce — must not have been used before for this (from, to) pair. */
  nonce: Bytes32
}

/**
 * Parameters for signing an authorize or charge call.
 * The nonce comes from `signing_payload.message.nonce` returned by `POST /payments`.
 * The contract hardcodes validAfter=0 and validBefore=payment.authorization_expiry.
 *
 * For the simple case, prefer `signPayment(privateKey, paymentDetail)`, which reads
 * every field off the `POST /payments` response directly.
 */
export interface SignPaymentParams {
  /** Payer's private key (0x-prefixed hex or raw Uint8Array). */
  privateKey: `0x${string}` | Uint8Array
  payment: PaymentConfig
  /** Nonce from `paymentDetail.signing_payload.message.nonce`. */
  nonce: Bytes32
  /** RAIL0 contract address — from `paymentDetail.rail0_contract`. */
  contractAddress: Address
  /** EIP-712 domain of the payment token — from `paymentDetail.signing_payload.domain`. */
  tokenDomain: TokenDomain
}

// ================================================================
//  Public API
// ================================================================

function doSign(
  privateKey: `0x${string}` | Uint8Array,
  domain: TokenDomain,
  transfer: {
    from: Address
    to: Address
    value: bigint
    validAfter: bigint
    validBefore: bigint
    nonce: Bytes32
  },
  typeHash: Uint8Array = TRANSFER_TYPEHASH,
): Eip3009Signature {
  const keyBytes = privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey)
  const digest = buildDigest(domain, transfer, typeHash)
  // 'recovered' format: [recovery(1), r(32), s(32)] = 65 bytes
  // prehash: false because digest is already keccak256
  const sig = secp256k1.sign(digest, keyBytes, { format: 'recovered', lowS: true, prehash: false })
  return {
    v: ((sig.at(0) ?? 0) + 27) as 27 | 28,
    r: bytesSliceToHex(sig, 1, 33),
    s: bytesSliceToHex(sig, 33, 65),
  }
}

/**
 * Pack an `{ v, r, s }` signature into the 65-byte hex string every gateway
 * endpoint that takes a signature expects — `payments.sign(id, { signature })`
 * and refund `prepare` phase-2.
 *
 * Layout: `0x` || r (32 bytes) || s (32 bytes) || v (1 byte), so 132 chars. The
 * two easy mistakes are writing `v` as the decimal 27/28 instead of the 1-byte
 * hex `1b`/`1c`, and leaving the `0x` on `s`: either one still produces a
 * well-formed 0x string, so the gateway's `recover_signer` simply lands on a
 * different address and answers 422 `signer_mismatch` with nothing pointing at
 * the packing. Use this instead of hand-rolling it.
 */
export function packSignature(sig: Eip3009Signature): string {
  return `${sig.r}${sig.s.slice(2)}${sig.v.toString(16).padStart(2, '0')}`
}

/**
 * Sign a raw EIP-3009 transferWithAuthorization message.
 *
 * For RAIL0 payment flows use `signSigningPayload` / `signPayment` / `signRefund`,
 * which sign the gateway's own payload (and check it first, given an expectation).
 */
export function signTransferWithAuthorization(
  privateKey: `0x${string}` | Uint8Array,
  domain: TokenDomain,
  params: SignTransferParams,
): Eip3009Signature {
  return doSign(privateKey, domain, {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: params.validAfter ?? 0n,
    validBefore: params.validBefore,
    nonce: params.nonce,
  })
}

/**
 * @deprecated Rebuilds the digest from the payment record and hardcodes the
 * TransferWithAuthorization typehash, but every active RAIL0 deployment (v1.4.0) has
 * the payer sign a ReceiveWithAuthorization — so the signature this returns recovers to
 * a different address and the gateway answers 422 `signer_mismatch`. Use
 * `signSigningPayload(privateKey, payment.signing_payload, expectation)` (or
 * `signPayment(privateKey, payment, expectation)`), which signs the gateway's payload
 * verbatim under its own `primaryType`, after checking it. Mirrors rail0-go's
 * deprecated `SignAuthorize`. Will be removed in the next major version.
 *
 * Sign the EIP-3009 payload required by an authorize call.
 *
 * ```ts
 * const resp = await client.payments.create({
 *   chain_id: 8453,
 *   mode: 'authorize',
 *   amount: '50.00', // HUMAN decimal — the gateway applies the token's decimals
 *   token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   payer,
 *   payee,
 * })
 * const payload = resp.signing_payload!
 * const sig = signAuthorize({
 *   privateKey,
 *   payment: resp,
 *   nonce: payload.message.nonce,
 *   contractAddress: resp.rail0_contract!,
 *   tokenDomain: payload.domain,
 * })
 * await client.payments.sign(resp.rail0_id, { signature: packSignature(sig) })
 * ```
 */
export function signAuthorize(params: SignPaymentParams): Eip3009Signature {
  return doSign(params.privateKey, params.tokenDomain, {
    from: params.payment.payer,
    to: params.contractAddress,
    value: BigInt(params.payment.amount),
    validAfter: 0n,
    validBefore: BigInt(params.payment.authorization_expiry),
    nonce: params.nonce,
  })
}

/**
 * @deprecated Same defect as `signAuthorize` — the hardcoded TransferWithAuthorization
 * typehash makes the gateway answer 422 `signer_mismatch` on every active deployment.
 * Use `signSigningPayload(privateKey, payment.signing_payload, expectation)` (or
 * `signPayment(privateKey, payment, expectation)`). Will be removed in the next major
 * version.
 *
 * Sign the EIP-3009 payload required by a charge call.
 *
 * ```ts
 * const resp = await client.payments.create({
 *   chain_id: 8453,
 *   mode: 'charge',
 *   amount: '25.00', // HUMAN decimal — the gateway applies the token's decimals
 *   token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   payer,
 *   payee,
 * })
 * const payload = resp.signing_payload!
 * const sig = signCharge({
 *   privateKey,
 *   payment: resp,
 *   nonce: payload.message.nonce,
 *   contractAddress: resp.rail0_contract!,
 *   tokenDomain: payload.domain,
 * })
 * await client.payments.sign(resp.rail0_id, { signature: packSignature(sig) })
 * // The payee then broadcasts it: chargePrepare → signTransaction → charge.
 * ```
 */
export function signCharge(params: SignPaymentParams): Eip3009Signature {
  return doSign(params.privateKey, params.tokenDomain, {
    from: params.payment.payer,
    to: params.contractAddress,
    value: BigInt(params.payment.amount),
    validAfter: 0n,
    validBefore: BigInt(params.payment.authorization_expiry),
    nonce: params.nonce,
  })
}

/**
 * Sign the EIP-3009 payload returned by `POST /payments`, after checking it.
 *
 * Reads all required parameters directly from the API response — no manual
 * field extraction needed. This is the recommended signing path for payers.
 * Equivalent to `signSigningPayload(privateKey, payment.signing_payload, expectation)`,
 * with an error message that names the payer case.
 *
 * ```ts
 * const resp = await client.payments.create({
 *   chain_id: 8453,
 *   mode: 'authorize',
 *   amount: '50.00', // HUMAN decimal — the gateway applies the token's decimals
 *   token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   payer,
 *   payee,
 * })
 * const sig = signPayment(privateKey, resp, { payment: resp, amount: '50.00' })
 * await client.payments.sign(resp.rail0_id, { signature: packSignature(sig) })
 * // The payee then broadcasts it: authorizePrepare → signTransaction → authorize.
 * ```
 */
export function signPayment(
  privateKey: `0x${string}` | Uint8Array,
  payment: WithSigningPayload,
  expectation: SigningPayloadExpectation,
): Eip3009Signature
/**
 * @deprecated Signs the gateway's authorization BLINDLY: an EIP-3009 authorization is
 * honoured by the token itself, so a compromised or misconfigured endpoint could have
 * this key sign away its balance. Pass the `expectation` (`{ payment, amount? }`) so
 * the payload is checked first — see `verifySigningPayload`. This form will be removed
 * in the next major version.
 */
export function signPayment(
  privateKey: `0x${string}` | Uint8Array,
  payment: WithSigningPayload,
): Eip3009Signature
export function signPayment(
  privateKey: `0x${string}` | Uint8Array,
  payment: WithSigningPayload,
  expectation?: SigningPayloadExpectation,
): Eip3009Signature {
  const payload = payment.signing_payload
  if (!payload) {
    throw new Error('payment has no signing_payload (already signed, or a transient RPC failure)')
  }
  return expectation
    ? signSigningPayload(privateKey, payload, expectation)
    : signVerbatim(privateKey, payload)
}

/**
 * Sign the gateway's EIP-712 `signing_payload` — whatever operation it belongs to —
 * after checking it against `expectation` (`verifySigningPayload`): `from` is the key's
 * own address, the domain's chain and token are the payment's, `to` is the payment's
 * RAIL0 contract, and `value` is exactly the amount asked for. A mismatch throws
 * `Error("refusing to sign: …")` naming the field, and nothing is signed. Everything
 * compared is already in hand, so this adds no gateway call.
 *
 * The one generic signer, mirroring rail0-go's `SignSigningPayload`: `signPayment`
 * (payer, the payload from `create()`) and `signRefund` (payee, the payload from
 * `refundPrepare` phase-1) are both this call on `.signing_payload`, kept for the
 * clearer name at each call site.
 *
 * Selects TransferWithAuthorization vs ReceiveWithAuthorization by the payload's
 * `primaryType`. An unrecognised `primaryType` throws rather than falling back to the
 * transfer typehash. A fallback would still yield a well-formed signature — over the
 * WRONG digest — which only surfaces on-chain as `invalid_token_signature` after gas
 * is spent. `primaryType` is precisely the field that moves when the contract's
 * EIP-3009 primitive changes (commercelayer/rail0#58), so a client must never guess
 * it: the gateway's payload is signed verbatim or not at all.
 *
 * A missing payload (`null`/`undefined`) throws too — `create()` answers 502
 * `signing_payload_unavailable` when it cannot build one, and an already-signed
 * payment no longer carries it.
 *
 * ```ts
 * const created = await client.payments.create(req)
 * const sig = signSigningPayload(payerKey, created.signing_payload, {
 *   payment: created,
 *   amount: req.amount, // the human decimal you sent, scaled by created.decimals
 * })
 * await client.payments.sign(created.rail0_id, { signature: packSignature(sig) })
 * ```
 */
export function signSigningPayload(
  privateKey: `0x${string}` | Uint8Array,
  payload: SigningPayload | null | undefined,
  expectation: SigningPayloadExpectation,
): Eip3009Signature
/**
 * @deprecated Signs the gateway's authorization BLINDLY: an EIP-3009 authorization is
 * honoured by the token itself, for up to its `value`, so a compromised or misconfigured
 * endpoint could have this key sign away its balance. Pass the `expectation`
 * (`{ payment, amount? }`) so the payload is checked first — see
 * `verifySigningPayload`. This form will be removed in the next major version.
 */
export function signSigningPayload(
  privateKey: `0x${string}` | Uint8Array,
  payload: SigningPayload | null | undefined,
): Eip3009Signature
export function signSigningPayload(
  privateKey: `0x${string}` | Uint8Array,
  payload: SigningPayload | null | undefined,
  expectation?: SigningPayloadExpectation,
): Eip3009Signature {
  if (!payload) {
    throw new Error(
      'signing payload is missing (already signed, or the gateway could not build one)',
    )
  }
  // Before the digest is built: a payload that fails the check leaves no signature.
  if (expectation) verifySigningPayload(payload, expectation, signerAddress(privateKey))
  return signVerbatim(privateKey, payload)
}

/** Signs a present payload under its own `primaryType`, with no expectation check. */
function signVerbatim(
  privateKey: `0x${string}` | Uint8Array,
  payload: SigningPayload,
): Eip3009Signature {
  let typeHash: Uint8Array
  switch (payload.primaryType) {
    case 'TransferWithAuthorization':
      typeHash = TRANSFER_TYPEHASH
      break
    case 'ReceiveWithAuthorization':
      typeHash = RECEIVE_TYPEHASH
      break
    default:
      throw new Error(
        `unsupported EIP-712 primaryType: ${payload.primaryType} (expected TransferWithAuthorization or ReceiveWithAuthorization) — upgrade @commercelayer/rail0-sdk`,
      )
  }
  const { message, domain } = payload
  return doSign(
    privateKey,
    domain as TokenDomain,
    {
      from: message.from as Address,
      to: message.to as Address,
      value: BigInt(message.value),
      validAfter: BigInt(message.validAfter),
      validBefore: BigInt(message.validBefore),
      nonce: message.nonce as Bytes32,
    },
    typeHash,
  )
}

/**
 * Sign a raw EIP-3009 receiveWithAuthorization message (the payee-side signature
 * a refund requires). Same fields as transferWithAuthorization, different type.
 */
export function signReceiveWithAuthorization(
  privateKey: `0x${string}` | Uint8Array,
  domain: TokenDomain,
  params: SignTransferParams,
): Eip3009Signature {
  return doSign(
    privateKey,
    domain,
    {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter ?? 0n,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
    RECEIVE_TYPEHASH,
  )
}

/**
 * Sign the refund payload returned by `refundPrepare` phase-1, after checking it.
 * Reads the ReceiveWithAuthorization payload off the returned transaction and signs it
 * with the payee key; pass the packed result to `refundPrepare` phase-2. Equivalent to
 * `signSigningPayload(privateKey, transaction.signing_payload, expectation)`, with an
 * error message that names the refund case.
 *
 * Pass the refund `amount` in the expectation: the payment's own amount is the whole
 * payment, not the part being refunded.
 *
 * ```ts
 * const payment = await client.payments.get(id) // chain_id, token, rail0_contract, decimals
 * const phase1 = await client.payments.refundPrepare(id, { amount: '10.00' })
 * const sig = signRefund(payeeKey, phase1, { payment, amount: '10.00' })
 * const phase2 = await client.payments.refundPrepare(id, {
 *   amount: '10.00',
 *   signature: packSignature(sig),
 * })
 * ```
 */
export function signRefund(
  privateKey: `0x${string}` | Uint8Array,
  transaction: WithSigningPayload,
  expectation: SigningPayloadExpectation,
): Eip3009Signature
/**
 * @deprecated Signs the gateway's refund authorization BLINDLY: a ReceiveWithAuthorization
 * is honoured by the token itself, so a compromised or misconfigured endpoint could
 * answer with the payee's whole balance as `value` and have it signed. Pass the
 * `expectation` (`{ payment, amount }`) so the payload is checked first — see
 * `verifySigningPayload`. This form will be removed in the next major version.
 */
export function signRefund(
  privateKey: `0x${string}` | Uint8Array,
  transaction: WithSigningPayload,
): Eip3009Signature
export function signRefund(
  privateKey: `0x${string}` | Uint8Array,
  transaction: WithSigningPayload,
  expectation?: SigningPayloadExpectation,
): Eip3009Signature {
  const payload = transaction.signing_payload
  if (!payload) {
    throw new Error('transaction has no signing_payload (call refundPrepare phase-1 first)')
  }
  return expectation
    ? signSigningPayload(privateKey, payload, expectation)
    : signVerbatim(privateKey, payload)
}

// ================================================================
//  EIP-1559 (type-2) transaction signing
// ================================================================

/** Minimal big-endian byte encoding of a non-negative integer (0 → empty). */
function toMinimalBytes(v: bigint): Uint8Array {
  if (v <= 0n) return new Uint8Array()
  let hex = v.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  return hexToBytes(hex)
}

/** Drop leading zero bytes (for RLP integer encoding of r / s). */
function stripLeadingZeros(b: Uint8Array): Uint8Array {
  let i = 0
  while (i < b.length && b[i] === 0) i++
  return b.slice(i)
}

type RlpItem = Uint8Array | RlpItem[]

function rlpLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([offset + len])
  const lenBytes = toMinimalBytes(BigInt(len))
  return concat(new Uint8Array([offset + 55 + lenBytes.length]), lenBytes)
}

function rlpEncode(item: RlpItem): Uint8Array {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && (item[0] as number) < 0x80) return item
    return concat(rlpLength(item.length, 0x80), item)
  }
  const body = concat(...item.map(rlpEncode))
  return concat(rlpLength(body.length, 0xc0), body)
}

function bytesToHex(b: Uint8Array): `0x${string}` {
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
}

/**
 * Sign the unsigned EIP-1559 transaction returned by a prepare endpoint
 * (`Transaction.unsigned_transaction`, a JSON blob) and return the 0x-prefixed
 * raw signed transaction ready to pass to a submit endpoint. Mirrors rail0-go's
 * SignTransaction: no viem/ethers — RLP is encoded here over @noble primitives.
 *
 * With an `expectation` the transaction is VERIFIED before the key touches it
 * (`verifyUnsignedTransaction`): zero value, the payment's chain and RAIL0 contract,
 * the key's own address as `from`, the RAIL0 function for `operation`, this payment's
 * id in the calldata and — for capture and refund — the amount you asked for. A
 * mismatch throws `Error("refusing to sign: …")` naming the field, and nothing is
 * signed. Everything compared is already in hand, so this adds no gateway call.
 *
 * ```ts
 * const payment = await merchant.payments.get(id)          // chain_id, rail0_contract, rail0_id, decimals
 * const prep = await merchant.payments.capturePrepare(id, '50.00')
 * const raw = signTransaction(prep.unsigned_transaction!, MERCHANT_KEY, {
 *   payment, operation: 'capture', amount: '50.00',
 * })
 * ```
 *
 * Note: fee/value fields are read via JSON.parse, so values above 2^53 lose
 * precision (fine for testnet gas). The gateway emits standard base-unit integers.
 */
export function signTransaction(
  unsignedTransaction: string,
  privateKey: `0x${string}` | Uint8Array,
  expectation: TxExpectation,
): `0x${string}`
/**
 * @deprecated Signs the gateway's transaction BLINDLY: a compromised or misconfigured
 * endpoint could have this key sign an arbitrary transaction. Pass the `expectation`
 * (the payment, the operation, and the amount for capture/refund) so the transaction
 * is checked first — see `verifyUnsignedTransaction`. This form will be removed in the
 * next major version.
 */
export function signTransaction(
  unsignedTransaction: string,
  privateKey: `0x${string}` | Uint8Array,
): `0x${string}`
export function signTransaction(
  unsignedTransaction: string,
  privateKey: `0x${string}` | Uint8Array,
  expectation?: TxExpectation,
): `0x${string}` {
  // Before anything else, and before the key is even decoded: a transaction that
  // fails the check must leave no signature behind.
  if (expectation)
    verifyUnsignedTransaction(unsignedTransaction, expectation, signerAddress(privateKey))
  const tx = JSON.parse(unsignedTransaction)
  const int = (v: unknown): Uint8Array => toMinimalBytes(BigInt(String(v ?? 0)))
  // Never an empty recipient, with or without an expectation (rail0-go refuses it too):
  // RLP encodes an absent `to` as the empty string, which makes the transaction a
  // CONTRACT CREATION deploying whatever bytecode is in `data`. No RAIL0 operation is one.
  const toHex = typeof tx.to === 'string' ? tx.to.trim() : ''
  if (!/^0x[0-9a-f]{40}$/i.test(toHex)) {
    throw new Error(
      `refusing to sign: invalid to address ${JSON.stringify(tx.to ?? null)} — a RAIL0 transaction always has a 20-byte recipient`,
    )
  }
  const to = hexToBytes(toHex)
  const data = tx.data ? hexToBytes(tx.data) : new Uint8Array()

  // EIP-1559 signing payload: 0x02 || rlp([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])
  const fields: RlpItem[] = [
    int(tx.chain_id),
    int(tx.nonce),
    int(tx.max_priority_fee_per_gas),
    int(tx.max_fee_per_gas),
    int(tx.gas_limit),
    to,
    int(tx.value),
    data,
    [], // empty access list
  ]
  const digest = keccak_256(concat(new Uint8Array([0x02]), rlpEncode(fields)))

  const keyBytes = privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey)
  const sig = secp256k1.sign(digest, keyBytes, { format: 'recovered', lowS: true, prehash: false })
  const yParity = sig.at(0) ?? 0
  const r = stripLeadingZeros(sig.slice(1, 33))
  const s = stripLeadingZeros(sig.slice(33, 65))

  const signed = concat(
    new Uint8Array([0x02]),
    rlpEncode([...fields, toMinimalBytes(BigInt(yParity)), r, s]),
  )
  return bytesToHex(signed)
}
