import { describe, expect, it } from 'vitest'
import { resolveChain } from '../src/index.js'
import type { Blockchain } from '../src/resources/types.js'

// resolveChain picks one chain from chains.list() by slug (case-insensitive) or chain id.

function chain(chain_id: number, slug: string | undefined, network_type: string): Blockchain {
  return { chain_id, slug, network_type, public_rpc_urls: [] } as unknown as Blockchain
}

const testnet = [
  chain(5042002, 'arc', 'testnet'),
  chain(84532, 'base', 'testnet'),
  chain(11155111, undefined, 'testnet'),
]

describe('resolveChain', () => {
  it('resolves a slug, case-insensitively and trimmed', () => {
    expect(resolveChain(testnet, 'arc').chain_id).toBe(5042002)
    expect(resolveChain(testnet, ' ARC ').chain_id).toBe(5042002)
  })

  it('resolves a numeric id, as a number or a digit string', () => {
    expect(resolveChain(testnet, 84532).slug).toBe('base')
    expect(resolveChain(testnet, '84532').slug).toBe('base')
    expect(resolveChain(testnet, 11155111).chain_id).toBe(11155111)
  })

  it('names the available slugs when nothing matches', () => {
    expect(() => resolveChain(testnet, 'polygon')).toThrow(
      'no chain matches slug "polygon" — available slugs: arc, base',
    )
    expect(() => resolveChain(testnet, 1)).toThrow(/chain id "1" — available slugs: arc, base/)
    expect(() => resolveChain([], 'arc')).toThrow(/available slugs: \(none\)/)
  })

  it('refuses an ambiguous slug instead of guessing', () => {
    const mixed = [...testnet, chain(5042000, 'arc', 'mainnet')]
    expect(() => resolveChain(mixed, 'arc')).toThrow(
      /"arc" is ambiguous — it matches chains 5042002 \(testnet\), 5042000 \(mainnet\)/,
    )
    expect(resolveChain(mixed, 5042000).network_type).toBe('mainnet')
  })

  it('refuses an empty reference', () => {
    expect(() => resolveChain(testnet, '  ')).toThrow(/empty chain reference/)
  })
})

describe('Blockchain type', () => {
  it('carries slug and public_rpc_urls as required fields', () => {
    // Compile-time: the gateway marks both required, so the public alias does too.
    const slug: Blockchain['slug'] = 'arc'
    const rpcs: Blockchain['public_rpc_urls'] = ['https://rpc.example']
    // @ts-expect-error slug is not optional
    const noSlug: Blockchain['slug'] = undefined
    expect([slug, rpcs, noSlug]).toHaveLength(3)
  })
})
