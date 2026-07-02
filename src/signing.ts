import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import type {
  Address,
  Bytes32,
  PaymentConfig,
  PaymentDetail,
  SigningPayload,
  Transaction,
} from './resources/types.js'

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

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
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
    concat(new Uint8Array([0x19, 0x01]), hashDomainSeparator(domain), hashStruct(transfer, typeHash)),
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
 * The nonce comes from `signingPayload.message.nonce` returned by `POST /payments`.
 * The contract hardcodes validAfter=0 and validBefore=payment.authorizationExpiry.
 *
 * For the simple case, prefer `signPayment(privateKey, createPaymentResponse)` which
 * reads all fields from the API response directly.
 */
export interface SignPaymentParams {
  /** Payer's private key (0x-prefixed hex or raw Uint8Array). */
  privateKey: `0x${string}` | Uint8Array
  payment: PaymentConfig
  /** Nonce from `createPaymentResponse.signingPayload.message.nonce`. */
  nonce: Bytes32
  /** RAIL0 contract address — from `createPaymentResponse.rail0Contract`. */
  contractAddress: Address
  /** EIP-712 domain of the payment token — from `createPaymentResponse.signingPayload.domain`. */
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
 * Sign a raw EIP-3009 transferWithAuthorization message.
 *
 * For RAIL0 payment flows prefer signAuthorize / signCharge which
 * set `from`, `to`, `validBefore` automatically from the Payment struct.
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
 * Sign the EIP-3009 payload required by an authorize call.
 *
 * ```ts
 * const resp = await client.payments.createPayment({ payment: { ...payment, amount: '50000000' }, chainId, mode: 'authorize' })
 * const sig = signAuthorize({ privateKey, payment: resp.payment, nonce: resp.signingPayload.message.nonce, contractAddress: resp.rail0Contract, tokenDomain: resp.signingPayload.domain })
 * await client.payments.sign(resp.paymentId, sig)
 * await client.payments.authorize(resp.paymentId)
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
 * Sign the EIP-3009 payload required by a charge call.
 *
 * ```ts
 * const resp = await client.payments.createPayment({ payment: { ...payment, amount: '25000000' }, chainId, mode: 'charge' })
 * const sig = signCharge({ privateKey, payment: resp.payment, nonce: resp.signing_payload.message.nonce, contractAddress: resp.rail0_contract, tokenDomain: resp.signing_payload.domain })
 * await client.payments.sign(resp.rail0_id, sig)
 * await client.payments.charge(resp.rail0_id, signedTx)
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
 * Sign the EIP-3009 payload returned by `POST /payments`.
 *
 * Reads all required parameters directly from the API response — no manual
 * field extraction needed. This is the recommended signing path for payers.
 *
 * ```ts
 * const resp = await client.payments.create({ payment: { ...payment, amount: '50000000' }, chain_id: chainId, mode: 'authorize' })
 * const sig = signPayment(privateKey, resp)
 * await client.payments.sign(resp.rail0_id, sig)
 * await client.payments.authorizePrepare(resp.rail0_id)
 * ```
 */
export function signPayment(
  privateKey: `0x${string}` | Uint8Array,
  payment: PaymentDetail,
): Eip3009Signature {
  const payload = payment.signing_payload
  if (!payload) {
    throw new Error('payment has no signing_payload (already signed, or a transient RPC failure)')
  }
  return signFromPayload(privateKey, payload)
}

/**
 * Sign an EIP-712 payload, selecting TransferWithAuthorization vs
 * ReceiveWithAuthorization by its `primaryType`. Shared by signPayment (payer,
 * authorize/charge) and signRefund (payee, refund).
 */
function signFromPayload(
  privateKey: `0x${string}` | Uint8Array,
  payload: SigningPayload,
): Eip3009Signature {
  const typeHash =
    payload.primaryType === 'ReceiveWithAuthorization' ? RECEIVE_TYPEHASH : TRANSFER_TYPEHASH
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
 * Sign the refund payload returned by `refundPrepare` phase-1. Reads the
 * ReceiveWithAuthorization payload off the returned transaction and signs it
 * with the payee key; pass the resulting (v, r, s) to `refundPrepare` phase-2.
 */
export function signRefund(
  privateKey: `0x${string}` | Uint8Array,
  transaction: Transaction,
): Eip3009Signature {
  const payload = transaction.signing_payload
  if (!payload) {
    throw new Error('transaction has no signing_payload (call refundPrepare phase-1 first)')
  }
  return signFromPayload(privateKey, payload)
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
 * Note: fee/value fields are read via JSON.parse, so values above 2^53 lose
 * precision (fine for testnet gas). The gateway emits standard base-unit integers.
 */
export function signTransaction(
  unsignedTransaction: string,
  privateKey: `0x${string}` | Uint8Array,
): `0x${string}` {
  const tx = JSON.parse(unsignedTransaction)
  const int = (v: unknown): Uint8Array => toMinimalBytes(BigInt(String(v ?? 0)))
  const to = tx.to ? hexToBytes(tx.to) : new Uint8Array()
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
