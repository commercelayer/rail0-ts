import { describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import { buildSiweMessage, checksumAddress } from '../src/resources/auth.js'

// The EIP-4361 message is built in-SDK (no `siwe`/`ethers` dependency), so these
// tests are the ONLY thing standing between a whitespace slip and a gateway that
// refuses every login. The gateway parses the text with one regex (ruby siwe
// 0.1.5, AuthService.verify_proof_of_ownership → Siwe::Message.from_message):
//
//   ^(?<domain>[^?#]*) wants you to sign in with your Ethereum account:\n
//   (?<address>0x[a-zA-Z0-9]{40})\n\n
//   ((?<statement>[^\n]+)\n)?\n
//   URI: …\nVersion: 1\nChain ID: \d+\nNonce: [a-zA-Z0-9]{8,}\nIssued At: …
//
// Note the statement group: it ends in an unconditional `\n`, so an ABSENT
// statement still requires a blank line of its own. Emit one blank line instead
// of two and the regex misses — the gateway answers 422 invalid_siwe. Hence the
// byte-for-byte assertions below rather than `toContain` checks.

const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const NONCE = 'testNonce123'
const ISSUED_AT = '2026-07-31T10:00:00.000Z'

describe('buildSiweMessage', () => {
  it('emits the exact EIP-4361 bytes with a statement', () => {
    const message = buildSiweMessage({
      domain: 'api.rail0.xyz',
      address: ADDRESS,
      uri: 'https://api.rail0.xyz',
      chainId: 1,
      nonce: NONCE,
      statement: 'Sign in to RAIL0',
      issuedAt: ISSUED_AT,
    })

    expect(message).toBe(
      'api.rail0.xyz wants you to sign in with your Ethereum account:\n' +
        `${ADDRESS}\n` +
        '\n' +
        'Sign in to RAIL0\n' +
        '\n' +
        'URI: https://api.rail0.xyz\n' +
        'Version: 1\n' +
        'Chain ID: 1\n' +
        `Nonce: ${NONCE}\n` +
        `Issued At: ${ISSUED_AT}`,
    )
  })

  it('emits TWO blank lines between the address and URI when there is no statement', () => {
    const message = buildSiweMessage({
      domain: 'localhost',
      address: ADDRESS,
      uri: 'http://localhost:3000',
      chainId: 84532,
      nonce: NONCE,
      issuedAt: ISSUED_AT,
    })

    expect(message).toBe(
      'localhost wants you to sign in with your Ethereum account:\n' +
        `${ADDRESS}\n` +
        '\n' +
        '\n' +
        'URI: http://localhost:3000\n' +
        'Version: 1\n' +
        'Chain ID: 84532\n' +
        `Nonce: ${NONCE}\n` +
        `Issued At: ${ISSUED_AT}`,
    )
    // Explicit: three consecutive newlines after the address line, not two.
    expect(message).toContain(`${ADDRESS}\n\n\nURI:`)
  })

  it('treats an empty statement as absent (still two blank lines)', () => {
    const withEmpty = buildSiweMessage({
      domain: 'localhost',
      address: ADDRESS,
      uri: 'http://localhost',
      chainId: 1,
      nonce: NONCE,
      statement: '',
      issuedAt: ISSUED_AT,
    })
    const withNone = buildSiweMessage({
      domain: 'localhost',
      address: ADDRESS,
      uri: 'http://localhost',
      chainId: 1,
      nonce: NONCE,
      issuedAt: ISSUED_AT,
    })
    expect(withEmpty).toBe(withNone)
  })

  it('defaults issuedAt to an ISO-8601 now', () => {
    const message = buildSiweMessage({
      domain: 'localhost',
      address: ADDRESS,
      uri: 'http://localhost',
      chainId: 1,
      nonce: NONCE,
    })
    const issuedAt = message.split('Issued At: ')[1] as string
    expect(issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Date.now() - Date.parse(issuedAt)).toBeLessThan(10_000)
  })

  // The parser's own regex tolerates a lowercase address, but EIP-4361 mandates
  // the checksummed form and the strict verifiers (viem, siwe-js) reject anything
  // else — so login must always send what checksumAddress derives.
  it('carries the EIP-55 checksummed address derived from the key', () => {
    expect(checksumAddress(KEY)).toBe(ADDRESS)
  })
})

describe('auth.login message', () => {
  it('posts a message matching the parser layout, address line included', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nonce: NONCE, expires_at: '2099-01-01T00:00:00Z' })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 't',
            address: ADDRESS,
            account_id: null,
            name: null,
            expires_at: '2099-01-01T00:00:00Z',
          }),
        ),
      )

    await client.auth.login(KEY, 'localhost:3000')
    const body = JSON.parse((spy.mock.calls[1]?.[1] as RequestInit).body as string)

    // domain is host-only (the port is stripped) while uri keeps it — the gateway
    // asserts URI.host == domain, and the ruby regex would swallow a port into
    // the domain capture and then fail the allow-list check.
    expect(body.message).toBe(
      'localhost wants you to sign in with your Ethereum account:\n' +
        `${ADDRESS}\n` +
        '\n' +
        'Sign in to RAIL0\n' +
        '\n' +
        'URI: http://localhost:3000\n' +
        'Version: 1\n' +
        'Chain ID: 1\n' +
        `Nonce: ${NONCE}\n` +
        `Issued At: ${body.message.split('Issued At: ')[1]}`,
    )
    expect(body.signature).toMatch(/^0x[0-9a-f]{130}$/i)
    vi.restoreAllMocks()
  })
})
