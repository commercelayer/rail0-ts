import { describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import {
  addressFromPrivateKey,
  buildSiweMessage,
  checksumAddress,
  LOGIN_STATEMENT,
  WALLET_LINK_STATEMENT,
} from '../src/resources/auth.js'

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
    expect(addressFromPrivateKey(KEY)).toBe(ADDRESS)
    // The deprecated name is the same function, not a reimplementation.
    expect(checksumAddress).toBe(addressFromPrivateKey)
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

describe('SIWE statements are purpose-bound', () => {
  // The gateway binds each endpoint to exactly one statement
  // (Policy::SIWE_LOGIN_STATEMENT / SIWE_WALLET_LINK_STATEMENT) and answers the
  // other with 422 siwe_purpose_mismatch. rail0-go shipped a ProveAddress that
  // reused the login message verbatim, which broke `wallets create` outright and
  // went unnoticed because no test had ever asserted the statement. These two
  // pin both directions so the pair cannot converge again.
  //
  // The separation is a security property, not a label: a login signature is
  // handed out on every sign-in, so a wallet-link endpoint that accepted one
  // would let anyone holding a captured login proof bind that address to their
  // own account.

  it('login signs the login statement and not the wallet-link one', async () => {
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

    expect(body.message).toContain(LOGIN_STATEMENT)
    expect(body.message).not.toContain(WALLET_LINK_STATEMENT)
    vi.restoreAllMocks()
  })

  it('proveAddress signs the wallet-link statement, and does not authenticate', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nonce: NONCE, expires_at: '2099-01-01T00:00:00Z' })),
      )

    const proof = await client.auth.proveAddress(KEY, 'localhost:3000')

    expect(proof.message).toContain(WALLET_LINK_STATEMENT)
    expect(proof.message).not.toContain(LOGIN_STATEMENT)
    expect(proof.message).toContain(`Nonce: ${NONCE}`)
    expect(proof.signature).toMatch(/^0x[0-9a-f]{130}$/i)

    // Only the nonce endpoint is hit: proving an address must NOT POST /auth —
    // the wallet write is authorized by the caller's own session, which may be a
    // different address entirely.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toContain('/auth/nonces')
    vi.restoreAllMocks()
  })
})

describe('auth.login / auth.verify install the token on the client', () => {
  // As rail0-go's Auth.Verify does: a successful sign-in authenticates the client it ran
  // on, so `client.setAuthToken(token)` afterwards is no longer required (still harmless).
  const session = (token: string) =>
    new Response(
      JSON.stringify({
        token,
        address: ADDRESS,
        account_id: null,
        name: null,
        expires_at: '2099-01-01T00:00:00Z',
      }),
    )
  const authHeader = (spy: ReturnType<typeof vi.spyOn>, call: number) =>
    ((spy.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>).Authorization

  it('login: returns the AuthResponse AND sends the token on the next request', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nonce: NONCE, expires_at: '2099-01-01T00:00:00Z' })),
      )
      .mockResolvedValueOnce(session('jwt-login'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))

    const auth = await client.auth.login(KEY, 'localhost:3000')
    expect(auth.token).toBe('jwt-login')

    await client.health.get()
    expect(authHeader(spy, 2)).toBe('Bearer jwt-login')
    vi.restoreAllMocks()
  })

  it('verify: replaces a token the client was constructed with', async () => {
    const client = new Rail0Client({
      baseUrl: 'http://localhost:3000',
      headers: { Authorization: 'Bearer old' },
    })
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(session('jwt-verify'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))

    const auth = await client.auth.verify('msg', '0xsig')
    expect(auth.token).toBe('jwt-verify')

    await client.health.get()
    expect(authHeader(spy, 1)).toBe('Bearer jwt-verify')
    vi.restoreAllMocks()
  })

  it('a failed verify leaves the current token untouched', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    client.setAuthToken('kept')
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'invalid_siwe', title: 'Bad', detail: 'Bad' }), {
          status: 422,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))

    await expect(client.auth.verify('msg', '0xsig')).rejects.toThrow()
    await client.health.get()
    expect(authHeader(spy, 1)).toBe('Bearer kept')
    vi.restoreAllMocks()
  })
})
