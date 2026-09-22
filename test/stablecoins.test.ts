import { describe, expect, it } from 'vitest'
import { chainInfo, eip2612Tokens, eip3009Tokens, stablecoins } from '../src/stablecoins.js'

describe('chainInfo', () => {
  it('returns chain data for a known chain', () => {
    const info = chainInfo('base')
    expect(info?.chainId).toBe(8453)
    expect(info?.tokens.USDC).toBeDefined()
  })

  it('returns undefined for an unknown chain', () => {
    expect(chainInfo('nope')).toBeUndefined()
  })
})

describe('eip3009Tokens', () => {
  it('returns the EIP-3009 tokens for a chain and omits the others', () => {
    const symbols = eip3009Tokens('base').map((t) => t.symbol)
    expect(symbols).toContain('USDC')
    expect(symbols).toContain('EURC')
    // USDbC is bridge-wrapped and carries no auth extension.
    expect(symbols).not.toContain('USDbC')
  })

  it('returns entries carrying address and decimals', () => {
    const usdc = eip3009Tokens('base').find((t) => t.symbol === 'USDC')
    expect(usdc?.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(usdc?.decimals).toBe(6)
  })
})

describe('eip2612Tokens', () => {
  it('returns permit-capable tokens', () => {
    expect(eip2612Tokens('ethereum').map((t) => t.symbol)).toContain('DAI')
  })
})

describe('the registry', () => {
  it('covers the 7 mainnets and the 3 testnets', () => {
    expect(Object.keys(stablecoins).sort()).toEqual(
      [
        'arbitrumOne',
        'arc-testnet',
        'avalanche',
        'base',
        'celo',
        'celo-sepolia',
        'ethereum',
        'ethereum-sepolia',
        'optimism',
        'polygon',
      ].sort(),
    )
  })

  // Pinned address by address, because a wrong entry here is invisible from
  // TypeScript: a caller looking one up to sign against gets a plausible answer
  // either way. rail0-go filed Celo Sepolia under Alfajores' chain id (44787) with a
  // USDC address that has no code on that chain, and nothing caught it.
  const testnets = {
    'arc-testnet': {
      chainId: 5042002,
      tokens: {
        USDC: '0x3600000000000000000000000000000000000000',
        EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
      },
    },
    'celo-sepolia': {
      chainId: 11142220,
      tokens: {
        USDC: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
        'USD₮': '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
      },
    },
    'ethereum-sepolia': {
      chainId: 11155111,
      tokens: {
        USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        PYUSD: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
      },
    },
  } as const

  for (const [chain, expected] of Object.entries(testnets)) {
    it(`pins ${chain}`, () => {
      const info = chainInfo(chain)
      expect(info).toBeDefined()
      expect(info?.chainId).toBe(expected.chainId)
      expect(Object.keys(info?.tokens ?? {}).sort()).toEqual(Object.keys(expected.tokens).sort())
      for (const [symbol, address] of Object.entries(expected.tokens)) {
        const token = info?.tokens[symbol]
        expect(token?.address).toBe(address)
        expect(token?.decimals).toBe(6)
        // RAIL0 pulls funds with receiveWithAuthorization, so a token that is not
        // EIP-3009 cannot be paid with and must never be listed as payable.
        expect(token?.eip3009).toBe(true)
      }
    })
  }

  // PYUSD is the first non-Circle token served: it is what proves the registry is
  // not implicitly a USDC list.
  it('exposes PYUSD as an EIP-3009 token on ethereum-sepolia', () => {
    expect(eip3009Tokens('ethereum-sepolia').map((t) => t.symbol)).toContain('PYUSD')
  })
})
