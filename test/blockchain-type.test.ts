import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'
import type {
  Blockchain,
  BlockchainSettlement,
  ChainContract,
  components,
  Nonce,
  Session,
} from '../src/index.js'

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
    // Every field but `settlement` is the component verbatim; `settlement` is narrowed to
    // required (the gateway always sends it) — see the describe block below.
    expectTypeOf<Omit<Blockchain, 'settlement'>>().toEqualTypeOf<
      Omit<components['schemas']['Blockchain'], 'settlement'>
    >()
    expectTypeOf<Blockchain>().toMatchTypeOf<components['schemas']['Blockchain']>()
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

// commercelayer/rail0-gateway#365: every chain carries the measured settlement time. The
// gateway always sends the object (percentiles null below its minimum sample), so the SDK
// types it required on `Blockchain`, although the schema marks it optional.
describe('Blockchain.settlement is typed', () => {
  it('is always present, with nullable percentiles', () => {
    expectTypeOf<Blockchain['settlement']>().toEqualTypeOf<BlockchainSettlement>()
    expectTypeOf<BlockchainSettlement>().toEqualTypeOf<{
      p50_seconds: number | null
      p90_seconds: number | null
      sample_size: number
      window_days: number
    }>()
  })

  it('reaches the caller of chains.list(), null percentiles included', async () => {
    const client = new Rail0Client({ baseUrl: 'http://localhost:3000' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            chain_id: 84532,
            name: 'Base Sepolia',
            settlement: { p50_seconds: 11, p90_seconds: 19, sample_size: 20, window_days: 7 },
          },
          {
            chain_id: 11155111,
            name: 'Ethereum Sepolia',
            settlement: { p50_seconds: null, p90_seconds: null, sample_size: 3, window_days: 7 },
          },
        ]),
      ),
    )

    const [base, sepolia] = await client.chains.list()
    // The documented use: a deadline hint from p90, with a fixed fallback when null.
    const deadline = (c: Blockchain) =>
      c.settlement.p90_seconds === null ? 900 : c.settlement.p90_seconds * 3
    expect(base && deadline(base)).toBe(57)
    expect(sepolia && deadline(sepolia)).toBe(900)
    expect(sepolia?.settlement.sample_size).toBe(3)
    vi.restoreAllMocks()
  })
})
