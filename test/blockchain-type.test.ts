import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import type { Blockchain, ChainContract, components, Nonce, Session } from '../src/index.js'

// The public types used to be spelled out field by field in gen/generate.ts, so a field
// the gateway added reached `components` on regenerate but never the exported type —
// `Blockchain` lacked `contract` although the gateway sends it and the schema types it.
// These are now ALIASES of the schema components; the assertions below fail to compile
// (`pnpm typecheck` runs tsc over test/) if one drifts back into a hand-written copy.

describe('Blockchain.contract is typed', () => {
  it('carries address, version and deployed_at', () => {
    type Contract = NonNullable<Blockchain['contract']>
    expectTypeOf<Contract>().toEqualTypeOf<ChainContract>()
    expectTypeOf<Contract>().toHaveProperty('address').toEqualTypeOf<string | undefined>()
    expectTypeOf<Contract>().toHaveProperty('version').toEqualTypeOf<string | undefined>()
    expectTypeOf<Contract>().toHaveProperty('deployed_at').toEqualTypeOf<string | undefined>()
    // Nullable, as the schema says: a chain with no deployment has none.
    expectTypeOf<null>().toMatchTypeOf<Blockchain['contract']>()
  })

  it('is the schema component, not a copy', () => {
    expectTypeOf<Blockchain>().toEqualTypeOf<components['schemas']['Blockchain']>()
    expectTypeOf<Nonce>().toEqualTypeOf<components['schemas']['Nonce']>()
    expectTypeOf<Session>().toEqualTypeOf<components['schemas']['Session']>()
    expectTypeOf<Nonce>().toHaveProperty('nonce').toEqualTypeOf<string>()
    expectTypeOf<Session>().toHaveProperty('name').toEqualTypeOf<string | null | undefined>()
  })

  it('reaches the caller of chains.list() without a cast', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            chain_id: 84532,
            name: 'Base Sepolia',
            contract: {
              address: '0x1111111111111111111111111111111111111111',
              version: '1.3.0',
              deployed_at: '2026-09-01T00:00:00Z',
            },
          },
        ]),
      ),
    )

    const [chain] = await client.chains.list()
    expect(chain?.contract?.address).toBe('0x1111111111111111111111111111111111111111')
    expect(chain?.contract?.version).toBe('1.3.0')
    expect(chain?.contract?.deployed_at).toBe('2026-09-01T00:00:00Z')
    vi.restoreAllMocks()
  })
})
