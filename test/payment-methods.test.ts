import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rail0Client } from '../src/client.js'

const BASE_URL = 'http://localhost:3000'

describe('paymentMethods.list', () => {
  let client: Rail0Client

  beforeEach(() => {
    client = new Rail0Client({ baseUrl: BASE_URL })
    vi.restoreAllMocks()
  })

  it('by account_id → GET /payment_methods?account_id=… returning wallets with nested tokens', async () => {
    const mockResponse = [
      {
        id: 'w_1',
        address: '0xpayee1',
        active: true,
        tokens: [
          {
            active: true,
            default: true,
            token: { symbol: 'USDC', chain_id: 8453, address: '0xusdc' },
          },
        ],
      },
      { id: 'w_2', address: '0xpayee2', active: true, tokens: [] },
    ]
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 200 }))

    const result = await client.paymentMethods.list({ account_id: 'acc_1' })

    expect(spy).toHaveBeenCalledWith(
      `${BASE_URL}/payment_methods?account_id=acc_1`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toHaveLength(2)
    expect(result[0]?.address).toBe('0xpayee1')
    expect(result[0]?.tokens?.[0]?.token?.symbol).toBe('USDC')
    expect(result[0]?.tokens?.[0]?.token?.chain_id).toBe(8453)
  })

  it('by address → GET /payment_methods?address=…', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'w_1', address: '0xabc', active: true, tokens: [] }]), {
        status: 200,
      }),
    )

    const result = await client.paymentMethods.list({ address: '0xABC' })

    expect(spy).toHaveBeenCalledWith(
      `${BASE_URL}/payment_methods?address=0xABC`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.address).toBe('0xabc')
  })
})
