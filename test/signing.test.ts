import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { describe, expect, it } from 'vitest'
import type { PaymentConfig } from '../src/resources/types.js'
import {
  signAuthorize,
  signCharge,
  signTransferWithAuthorization,
  type TokenDomain,
} from '../src/signing.js'

// ================================================================
//  Test fixtures
// ================================================================

// Well-known test private key (never use in production)
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const

// Corresponding address (from the above key)
const PAYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const

const TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const // USDC on Base
const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890' as const

const TOKEN_DOMAIN: TokenDomain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: TOKEN_ADDRESS,
}

const PAYMENT: PaymentConfig = {
  payer: PAYER,
  payee: '0x2222222222222222222222222222222222222222',
  token: TOKEN_ADDRESS,
  amount: '50000000',
  authorization_expiry: 9999999999,
  refund_expiry: 9999999999 + 60 * 60 * 24 * 7,
}

const NONCE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const

// ================================================================
//  signTransferWithAuthorization
// ================================================================

describe('signTransferWithAuthorization', () => {
  it('returns an object with v, r, s', () => {
    const sig = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 50_000_000n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })

    expect(sig.v).toSatisfy((v: number) => v === 27 || v === 28)
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/i)
  })

  it('produces a verifiable secp256k1 signature', () => {
    const sig = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 50_000_000n,
      validAfter: 0n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })

    // Re-derive the public key and verify using secp256k1.verify
    function hexToBytes(hex: string) {
      const h = hex.startsWith('0x') ? hex.slice(2) : hex
      const out = new Uint8Array(h.length / 2)
      for (let i = 0; i < h.length; i += 2) out[i >> 1] = Number.parseInt(h.slice(i, i + 2), 16) // base-16
      return out
    }
    function abiAddress(addr: string) {
      const out = new Uint8Array(32)
      out.set(hexToBytes(addr), 12)
      return out
    }
    function abiUint256(v: bigint) {
      const out = new Uint8Array(32)
      let x = v
      for (let i = 31; i >= 0; i--) {
        out[i] = Number(x & 0xffn)
        x >>= 8n
      }
      return out
    }
    function concat(...parts: Uint8Array[]) {
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

    const domainTypehash = keccak_256(
      new TextEncoder().encode(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
      ),
    )
    const transferTypehash = keccak_256(
      new TextEncoder().encode(
        'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)',
      ),
    )
    const domainSeparator = keccak_256(
      concat(
        domainTypehash,
        keccak_256(new TextEncoder().encode('USD Coin')),
        keccak_256(new TextEncoder().encode('2')),
        abiUint256(8453n),
        abiAddress(TOKEN_ADDRESS),
      ),
    )
    const structHash = keccak_256(
      concat(
        transferTypehash,
        abiAddress(PAYER),
        abiAddress(CONTRACT_ADDRESS),
        abiUint256(50_000_000n),
        abiUint256(0n),
        abiUint256(9999999999n),
        hexToBytes(NONCE),
      ),
    )
    const digest = keccak_256(concat(new Uint8Array([0x19, 0x01]), domainSeparator, structHash))

    // Build compact sig (r+s, 64 bytes) for secp256k1.verify
    const compactSig = new Uint8Array(64)
    compactSig.set(hexToBytes(sig.r), 0) // r occupies bytes 0-31
    compactSig.set(hexToBytes(sig.s), 32) // s occupies bytes 32-63

    const pubKey = secp256k1.getPublicKey(hexToBytes(PRIVATE_KEY))
    const isValid = secp256k1.verify(compactSig, digest, pubKey, { prehash: false, lowS: true })

    expect(isValid).toBe(true)
  })

  it('validAfter defaults to 0 when omitted', () => {
    const withDefault = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })
    const withExplicit = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validAfter: 0n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })

    expect(withDefault).toEqual(withExplicit)
  })

  it('produces different signatures for different nonces', () => {
    const nonce2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
    const sig1 = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })
    const sig2 = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validBefore: 9999999999n,
      nonce: nonce2,
    })

    expect(sig1.r).not.toBe(sig2.r)
  })

  it('accepts a Uint8Array private key', () => {
    const hexKey = PRIVATE_KEY.slice(2)
    const keyBytes = new Uint8Array(hexKey.length / 2)
    for (let i = 0; i < hexKey.length; i += 2)
      keyBytes[i >> 1] = Number.parseInt(hexKey.slice(i, i + 2), 16)

    const sigHex = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })
    const sigBytes = signTransferWithAuthorization(keyBytes, TOKEN_DOMAIN, {
      from: PAYER,
      to: CONTRACT_ADDRESS,
      value: 1n,
      validBefore: 9999999999n,
      nonce: NONCE,
    })

    expect(sigHex).toEqual(sigBytes)
  })
})

// ================================================================
//  signAuthorize / signCharge
// ================================================================

describe('signAuthorize', () => {
  it('returns a valid signature using payment.authorization_expiry as default validBefore', () => {
    const sig = signAuthorize({
      privateKey: PRIVATE_KEY,
      payment: PAYMENT,
      nonce: NONCE,
      contractAddress: CONTRACT_ADDRESS,
      tokenDomain: TOKEN_DOMAIN,
    })

    expect(sig.v).toSatisfy((v: number) => v === 27 || v === 28)
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(sig.s).toMatch(/^0x[0-9a-f]{64}$/i)
  })

  it('matches signTransferWithAuthorization with explicit params', () => {
    const manual = signTransferWithAuthorization(PRIVATE_KEY, TOKEN_DOMAIN, {
      from: PAYMENT.payer,
      to: CONTRACT_ADDRESS,
      value: BigInt(PAYMENT.amount),
      validAfter: 0n,
      validBefore: BigInt(PAYMENT.authorization_expiry),
      nonce: NONCE,
    })
    const auto = signAuthorize({
      privateKey: PRIVATE_KEY,
      payment: PAYMENT,
      nonce: NONCE,
      contractAddress: CONTRACT_ADDRESS,
      tokenDomain: TOKEN_DOMAIN,
    })

    expect(auto).toEqual(manual)
  })
})

describe('signCharge', () => {
  it('returns a valid signature', () => {
    const chargeNonce =
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as const
    const sig = signCharge({
      privateKey: PRIVATE_KEY,
      payment: PAYMENT,
      nonce: chargeNonce,
      contractAddress: CONTRACT_ADDRESS,
      tokenDomain: TOKEN_DOMAIN,
    })

    expect(sig.v).toSatisfy((v: number) => v === 27 || v === 28)
    expect(sig.r).toMatch(/^0x[0-9a-f]{64}$/i)
  })

  it('produces a different signature than signAuthorize for a different nonce', () => {
    const authSig = signAuthorize({
      privateKey: PRIVATE_KEY,
      payment: PAYMENT,
      nonce: NONCE,
      contractAddress: CONTRACT_ADDRESS,
      tokenDomain: TOKEN_DOMAIN,
    })
    const chargeSig = signCharge({
      privateKey: PRIVATE_KEY,
      payment: PAYMENT,
      nonce: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      contractAddress: CONTRACT_ADDRESS,
      tokenDomain: TOKEN_DOMAIN,
    })

    expect(authSig.r).not.toBe(chargeSig.r)
  })
})

// ================================================================
//  signTransaction (EIP-1559)
// ================================================================

// Minimal RLP list decoder — enough to verify the type-2 transaction layout.
function rlpDecode(buf: Uint8Array): Uint8Array[] {
  const first = buf[0] as number
  if (first < 0xc0) throw new Error('not a list')
  let start: number
  let end: number
  if (first < 0xf8) {
    start = 1
    end = 1 + (first - 0xc0)
  } else {
    const ll = first - 0xf7
    let len = 0
    for (let i = 1; i <= ll; i++) len = len * 256 + (buf[i] as number)
    start = 1 + ll
    end = start + len
  }
  const items: Uint8Array[] = []
  let p = start
  while (p < end) {
    const b = buf[p] as number
    if (b < 0x80) {
      items.push(buf.slice(p, p + 1))
      p += 1
    } else if (b < 0xb8) {
      const len = b - 0x80
      items.push(buf.slice(p + 1, p + 1 + len))
      p += 1 + len
    } else if (b < 0xc0) {
      const ll = b - 0xb7
      let len = 0
      for (let i = 1; i <= ll; i++) len = len * 256 + (buf[p + i] as number)
      items.push(buf.slice(p + 1 + ll, p + 1 + ll + len))
      p += 1 + ll + len
    } else {
      // nested list (the access list) — capture its raw bytes as one item
      const listLen = b < 0xf8 ? b - 0xc0 : 0
      items.push(buf.slice(p, p + 1 + listLen))
      p += 1 + listLen
    }
  }
  return items
}

function toHex(b: Uint8Array): string {
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`
}

describe('signTransaction (EIP-1559)', () => {
  const unsigned = JSON.stringify({
    chain_id: 8453,
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    to: '0x1234567890123456789012345678901234567890',
    value: 0,
    data: '0xabcdef',
    nonce: 5,
    gas_limit: 120000,
    max_priority_fee_per_gas: 1000000,
    max_fee_per_gas: 2000000000,
  })

  it('produces a type-2 transaction with the correct field layout', async () => {
    const { signTransaction } = await import('../src/signing.js')
    const raw = signTransaction(unsigned, PRIVATE_KEY)

    expect(raw.startsWith('0x02')).toBe(true)

    // Strip the 0x02 type byte, decode the RLP list.
    const body = raw.slice(4)
    const bytes = new Uint8Array(body.length / 2)
    for (let i = 0; i < body.length; i += 2)
      bytes[i >> 1] = Number.parseInt(body.slice(i, i + 2), 16)
    const items = rlpDecode(bytes)

    // [chainId, nonce, maxPrio, maxFee, gasLimit, to, value, data, accessList, yParity, r, s]
    expect(items).toHaveLength(12)
    expect(toHex(items[0] as Uint8Array)).toBe('0x2105') // chain id 8453
    expect(toHex(items[1] as Uint8Array)).toBe('0x05') // nonce
    expect(toHex(items[4] as Uint8Array)).toBe('0x01d4c0') // gas limit 120000
    expect(toHex(items[5] as Uint8Array)).toBe('0x1234567890123456789012345678901234567890') // to
    expect((items[6] as Uint8Array).length).toBe(0) // value 0 → empty
    expect(toHex(items[7] as Uint8Array)).toBe('0xabcdef') // data
    expect((items[8] as Uint8Array).length).toBe(1) // empty access list → 0xc0
    expect((items[10] as Uint8Array).length).toBeLessThanOrEqual(32) // r
    expect((items[11] as Uint8Array).length).toBeLessThanOrEqual(32) // s
  })
})
