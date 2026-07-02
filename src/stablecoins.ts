/**
 * Stablecoin addresses and capabilities for supported EVM networks.
 *
 * eip3009 — transferWithAuthorization (Circle / USDC standard).
 * eip2612 — permit (ERC-20 extension).
 * bridged  — token is a bridge-wrapped variant and may not support either extension.
 */

/** Static metadata for a single stablecoin on a specific chain. */
export interface StablecoinInfo {
  /** Checksummed contract address. */
  readonly address: string
  /** Number of decimal places (typically 6 for USDC/USDT, 18 for DAI). */
  readonly decimals: number
  /** Supports `transferWithAuthorization` (EIP-3009 / Circle standard). Required by RAIL0. */
  readonly eip3009: boolean
  /** Supports `permit` (EIP-2612). Not used by RAIL0 but useful for other integrations. */
  readonly eip2612: boolean
  /** Token is a bridge-wrapped variant and may not support either auth extension. */
  readonly bridged?: boolean
}

export const stablecoins = {
  ethereum: {
    chainId: 1,
    tokens: {
      USDC: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      EURC: {
        address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      PYUSD: {
        address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        eip3009: false,
        eip2612: false,
      },
      DAI: {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        eip3009: false,
        eip2612: true,
      },
    },
  },
  base: {
    chainId: 8453,
    tokens: {
      USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      EURC: {
        address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      USDbC: {
        address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
        decimals: 6,
        eip3009: false,
        eip2612: false,
        bridged: true,
      },
    },
  },
  polygon: {
    chainId: 137,
    tokens: {
      USDC: {
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      'USDC.e': {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
        eip3009: true,
        eip2612: false,
        bridged: true,
      },
      USDT: {
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        eip3009: false,
        eip2612: false,
      },
      DAI: {
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
        eip3009: false,
        eip2612: false,
      },
    },
  },
  arbitrumOne: {
    chainId: 42161,
    tokens: {
      USDC: {
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      'USDC.e': {
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        decimals: 6,
        eip3009: false,
        eip2612: false,
        bridged: true,
      },
      USDT: {
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        decimals: 6,
        eip3009: false,
        eip2612: false,
      },
      DAI: {
        address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        decimals: 18,
        eip3009: false,
        eip2612: true,
      },
    },
  },
  optimism: {
    chainId: 10,
    tokens: {
      USDC: {
        address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      'USDC.e': {
        address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        decimals: 6,
        eip3009: false,
        eip2612: false,
        bridged: true,
      },
      USDT: {
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        decimals: 6,
        eip3009: false,
        eip2612: false,
      },
      DAI: {
        address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        decimals: 18,
        eip3009: false,
        eip2612: true,
      },
    },
  },
  avalanche: {
    chainId: 43114,
    tokens: {
      USDC: {
        address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      'USDC.e': {
        address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
        decimals: 6,
        eip3009: false,
        eip2612: false,
        bridged: true,
      },
      USDT: {
        address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
        decimals: 6,
        eip3009: false,
        eip2612: false,
      },
    },
  },
  celo: {
    chainId: 42220,
    tokens: {
      USDC: {
        address: '0xcebA9300f2b948710d2De3250b7Ad3e4aFb0e50a',
        decimals: 6,
        eip3009: true,
        eip2612: false,
      },
      cUSD: {
        address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
        decimals: 18,
        eip3009: true,
        eip2612: false,
      },
      cEUR: {
        address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
        decimals: 18,
        eip3009: true,
        eip2612: false,
      },
    },
  },
} as const satisfies Record<string, { chainId: number; tokens: Record<string, StablecoinInfo> }>

export type StablecoinChain = keyof typeof stablecoins
export type StablecoinSymbol<C extends StablecoinChain> = keyof (typeof stablecoins)[C]['tokens'] &
  string

/** Returns the registry entry for a chain, or `undefined` if the chain is unknown. */
export function chainInfo(
  chain: string,
): { chainId: number; tokens: Record<string, StablecoinInfo> } | undefined {
  return (
    stablecoins as Record<string, { chainId: number; tokens: Record<string, StablecoinInfo> }>
  )[chain]
}

/** Returns all tokens on a chain that support EIP-3009 (transferWithAuthorization). */
export function eip3009Tokens(
  chain: StablecoinChain,
): Array<{ symbol: string; address: string; decimals: number }> {
  return (Object.entries(stablecoins[chain].tokens) as Array<[string, StablecoinInfo]>)
    .filter(([, t]) => t.eip3009)
    .map(([symbol, t]) => ({ symbol, address: t.address, decimals: t.decimals }))
}

/** Returns all tokens on a chain that support EIP-2612 (permit). */
export function eip2612Tokens(
  chain: StablecoinChain,
): Array<{ symbol: string; address: string; decimals: number }> {
  return (Object.entries(stablecoins[chain].tokens) as Array<[string, StablecoinInfo]>)
    .filter(([, t]) => t.eip2612)
    .map(([symbol, t]) => ({ symbol, address: t.address, decimals: t.decimals }))
}
