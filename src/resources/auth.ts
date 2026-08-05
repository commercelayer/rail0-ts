import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import type { HttpClient } from '../core/http.js'

// ================================================================
//  Types
// ================================================================

export interface AuthResponse {
  token: string
  address: string
  /**
   * The account owning the signed-in wallet, or null for an account-less
   * session. SIWE alone proves control of the address, so the gateway issues a
   * token even when the address is registered to no account (e.g. a buyer).
   * Clients that require an account must treat null as "not allowed".
   */
  accountId: string | null
  /** The account's human-readable name, or null for an account-less session. */
  name: string | null
  expiresAt: string
}

/** Fields of the EIP-4361 message built by `buildSiweMessage`. */
export interface SiweMessageParams {
  /** RFC 4501 authority requesting the sign-in — HOST ONLY, no port, no scheme. */
  domain: string
  /**
   * The signing address, EIP-55 checksummed (see `checksumAddress`). EIP-4361
   * mandates the checksummed form and the strict verifiers (viem, siwe-js)
   * reject a lowercase address, so never pass one.
   */
  address: string
  /** RFC 3986 URI of the resource being signed in to. Its host must equal `domain`. */
  uri: string
  /** EIP-155 chain id the session is bound to. */
  chainId: number
  /** Single-use nonce from `POST /auth/nonces` (≥ 8 alphanumeric chars). */
  nonce: string
  /** Optional one-line assertion shown to the user. Must not contain a newline. */
  statement?: string
  /** ISO-8601 issue time; defaults to now. The gateway rejects a stale or future one. */
  issuedAt?: string
}

// ================================================================
//  EIP-4361 (SIWE) message
// ================================================================

/**
 * Build the canonical EIP-4361 message text to sign, byte-for-byte as the
 * gateway's parser expects it. Owned here rather than delegated to the `siwe`
 * npm package, which pulls all of `ethers` (~16 MB) in at module scope for this
 * one string.
 *
 * The layout is unforgiving, because the gateway parses it with a single regex
 * (ruby `siwe` 0.1.5: `…account:\n(0x…{40})\n\n((statement)\n)?\n URI: …`). The
 * statement slot is `\n{statement}\n` when present and a bare `\n` when absent —
 * which is why an omitted statement leaves TWO blank lines between the address
 * and `URI:`. Emitting one blank line there makes the regex miss and the gateway
 * answer `invalid_siwe` ("Could not parse SIWE message"). Joining the parts with
 * '\n' reproduces both cases exactly (the same construction the ruby gem uses).
 */
export function buildSiweMessage(params: SiweMessageParams): string {
  const statement =
    params.statement === undefined || params.statement === '' ? '\n' : `\n${params.statement}\n`
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    statement,
    `URI: ${params.uri}`,
    'Version: 1',
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt ?? new Date().toISOString()}`,
  ].join('\n')
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
  const sig = secp256k1.sign(digest, privBytes, {
    format: 'recovered',
    lowS: true,
    prehash: false,
  }) as Uint8Array
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

  /**
   * POST /auth/logout — end the session whose token this client carries.
   *
   * Per TOKEN, not per address: signing out one device leaves the others signed in.
   * Requires the session it revokes, so the client must be holding one.
   *
   * `revoked` is the outcome, not a formality. The gateway's denylist fails open by
   * design — a store outage must not sign out the whole platform — so `false` means
   * the token is STILL USABLE until its `exp` and the caller should treat its own
   * copy as compromised rather than assume the session is gone.
   */
  logout(): Promise<{ revoked: boolean }> {
    return this.http.post<{ revoked: boolean }>('/auth/logout', {})
  }

  /** POST /auth — submit a signed SIWE message and receive a JWT. */
  verify(message: string, signature: string): Promise<AuthResponse> {
    return this.http
      .post<{
        token: string
        address: string
        account_id: string | null
        name: string | null
        expires_at: string
      }>('/auth', {
        message,
        signature,
      })
      .then((r) => ({
        token: r.token,
        address: r.address,
        accountId: r.account_id,
        name: r.name,
        expiresAt: r.expires_at,
      }))
  }

  /**
   * Full SIWE login flow:
   *  1. POST /auth/nonces
   *  2. Build the EIP-4361 message (buildSiweMessage)
   *  3. Sign with EIP-191 personal_sign using noble/curves
   *  4. POST /auth and return the JWT response
   *
   * @param privateKeyHex - 0x-prefixed or raw hex private key (32 bytes)
   * @param domain - host of the API server, e.g. "api.rail0.xyz"
   * @param chainId - chain id embedded in the SIWE message. Must match the
   *   gateway's SIWE_CHAIN_ID policy (default 1); override only when the gateway
   *   is configured with a different login chain.
   */
  async login(privateKeyHex: string, domain: string, chainId = 1): Promise<AuthResponse> {
    const { nonce } = await this.getNonce()
    const address = checksumAddress(privateKeyHex)

    // Strip port from domain — the API's siwe_domain is host-only (e.g. "localhost")
    const siweHost = domain.split(':')[0] as string

    // Statement kept identical to rail0-go's signSIWE, so both SDKs put the same
    // text in front of the user for the same handshake.
    const message = buildSiweMessage({
      domain: siweHost,
      address,
      uri: `http://${domain}`,
      chainId,
      nonce,
      statement: 'Sign in to RAIL0',
    })
    const signature = personalSign(privateKeyHex, message)
    return this.verify(message, signature)
  }
}
