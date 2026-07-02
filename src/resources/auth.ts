import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { SiweMessage } from 'siwe'
import type { HttpClient } from '../core/http.js'

// ================================================================
//  Types
// ================================================================

export interface AuthResponse {
  token: string
  address: string
  accountId: string
  expiresAt: string
}

// ================================================================
//  Internal helpers
// ================================================================

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < h.length; i += 2) out[i >> 1] = Number.parseInt(h.slice(i, i + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Derive EIP-55 checksummed Ethereum address from a secp256k1 private key.
 */
export function checksumAddress(privateKeyHex: string): string {
  const privBytes = hexToBytes(privateKeyHex)
  const pubUncompressed = secp256k1.getPublicKey(privBytes, false) // 65 bytes: 0x04 || X || Y
  const pubHash = keccak_256(pubUncompressed.slice(1)) // hash of X || Y
  const addrBytes = pubHash.slice(12) // last 20 bytes
  const lower = bytesToHex(addrBytes)
  const checkHash = keccak_256(new TextEncoder().encode(lower))
  let checksummed = ''
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i] as string
    if (c >= 'a' && c <= 'f') {
      // nibble index: byte i>>1, high nibble if i is even
      const hashByte = checkHash[i >> 1] as number
      const nibble = i % 2 === 0 ? (hashByte >> 4) & 0xf : hashByte & 0xf
      checksummed += nibble >= 8 ? c.toUpperCase() : c
    } else {
      checksummed += c
    }
  }
  return `0x${checksummed}`
}

/**
 * EIP-191 personal_sign: hash `\x19Ethereum Signed Message:\n<byteLen><message>`,
 * then sign with secp256k1. Returns 0x-prefixed 65-byte hex (r || s || v, v ∈ {27,28}).
 */
export function personalSign(privateKeyHex: string, message: string): string {
  const msgBytes = new TextEncoder().encode(message)
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`)
  const combined = new Uint8Array(prefix.length + msgBytes.length)
  combined.set(prefix)
  combined.set(msgBytes, prefix.length)
  const digest = keccak_256(combined)

  const privBytes = hexToBytes(privateKeyHex)
  // format:'recovered' → Uint8Array(65): recovery(1) || r(32) || s(32)
  const sig = secp256k1.sign(digest, privBytes, { format: 'recovered', lowS: true, prehash: false }) as Uint8Array
  const recovery = sig[0] as number
  const r = sig.slice(1, 33)
  const s = sig.slice(33, 65)
  const v = recovery + 27
  // EIP-191 expects: r(32) || s(32) || v(1)
  const out = new Uint8Array(65)
  out.set(r, 0)
  out.set(s, 32)
  out[64] = v
  return `0x${bytesToHex(out)}`
}

// ================================================================
//  AuthResource
// ================================================================

export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /** POST /auth/nonces — issue a single-use SIWE nonce. */
  getNonce(): Promise<{ nonce: string; expiresAt: string }> {
    return this.http
      .post<{ nonce: string; expires_at: string }>('/auth/nonces', {})
      .then((r) => ({ nonce: r.nonce, expiresAt: r.expires_at }))
  }

  /** POST /auth — submit a signed SIWE message and receive a JWT. */
  verify(message: string, signature: string): Promise<AuthResponse> {
    return this.http
      .post<{ token: string; address: string; account_id: string; expires_at: string }>('/auth', {
        message,
        signature,
      })
      .then((r) => ({
        token: r.token,
        address: r.address,
        accountId: r.account_id,
        expiresAt: r.expires_at,
      }))
  }

  /**
   * Full SIWE login flow:
   *  1. POST /nonces
   *  2. Build EIP-4361 message via siwe library
   *  3. Sign with EIP-191 personal_sign using noble/curves
   *  4. POST /auth and return the JWT response
   *
   * @param privateKeyHex - 0x-prefixed or raw hex private key (32 bytes)
   * @param domain - host of the API server, e.g. "api.rail0.xyz"
   */
  async login(privateKeyHex: string, domain: string): Promise<AuthResponse> {
    const { nonce } = await this.getNonce()
    const address = checksumAddress(privateKeyHex)

    // Strip port from domain — the API's siwe_domain is host-only (e.g. "localhost")
    const siweHost = domain.split(':')[0] as string

    const siweMessage = new SiweMessage({
      domain: siweHost,
      address,
      uri: `http://${domain}`,
      version: '1',
      chainId: 1,
      nonce,
      statement: 'Sign in to RAIL0',
    })
    const messageStr = siweMessage.prepareMessage()
    const signature = personalSign(privateKeyHex, messageStr)
    return this.verify(messageStr, signature)
  }
}
