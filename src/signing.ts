import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import type { Address, Bytes32, PaymentConfig } from './resources/types.js'

// ================================================================
//  EIP-712 type strings
// ================================================================

const DOMAIN_TYPE =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'

const TRANSFER_TYPE =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'

// Pre-computed type hashes
const DOMAIN_TYPEHASH = keccak_256(new TextEncoder().encode(DOMAIN_TYPE))
const TRANSFER_TYPEHASH = keccak_256(new TextEncoder().encode(TRANSFER_TYPE))

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

function hashStruct(p: {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: Bytes32
}): Uint8Array {
  return keccak_256(
    concat(
      TRANSFER_TYPEHASH,
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
): Uint8Array {
  return keccak_256(
    concat(new Uint8Array([0x19, 0x01]), hashDomainSeparator(domain), hashStruct(transfer)),
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
 */
export interface SignPaymentParams {
  /** Payer's private key (0x-prefixed hex or raw Uint8Array). */
  privateKey: `0x${string}` | Uint8Array
  payment: PaymentConfig
  /** Amount to pull from the payer, in token base units. */
  amount: bigint
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
): Eip3009Signature {
  const keyBytes = privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey)
  const digest = buildDigest(domain, transfer)
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
 * const resp = await client.payments.createPayment({ payment, amount: '50000000', chainId, mode: 'authorize' })
 * const { nonce } = resp.signingPayload.message
 * const domain = resp.signingPayload.domain
 * const sig = signAuthorize({ privateKey, payment, amount: 50_000_000n, nonce, contractAddress: resp.rail0Contract, tokenDomain: domain })
 * await client.payments.sign(resp.paymentId, sig)
 * await client.payments.authorize(resp.paymentId)
 * ```
 */
export function signAuthorize(params: SignPaymentParams): Eip3009Signature {
  return doSign(params.privateKey, params.tokenDomain, {
    from: params.payment.payer,
    to: params.contractAddress,
    value: params.amount,
    validAfter: 0n,
    validBefore: BigInt(params.payment.authorizationExpiry),
    nonce: params.nonce,
  })
}

/**
 * Sign the EIP-3009 payload required by a charge call.
 *
 * ```ts
 * const resp = await client.payments.createPayment({ payment, amount: '25000000', chainId, mode: 'charge' })
 * const { nonce } = resp.signingPayload.message
 * const sig = signCharge({ privateKey, payment, amount: 25_000_000n, nonce, contractAddress: resp.rail0Contract, tokenDomain: resp.signingPayload.domain })
 * await client.payments.sign(resp.paymentId, sig)
 * await client.payments.charge(resp.paymentId)
 * ```
 */
export function signCharge(params: SignPaymentParams): Eip3009Signature {
  return doSign(params.privateKey, params.tokenDomain, {
    from: params.payment.payer,
    to: params.contractAddress,
    value: params.amount,
    validAfter: 0n,
    validBefore: BigInt(params.payment.authorizationExpiry),
    nonce: params.nonce,
  })
}
