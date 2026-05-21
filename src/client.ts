import { HttpClient, type HttpClientOptions } from './core/http.js'
import { MerchantsResource } from './resources/merchants.js'
import { PaymentsResource } from './resources/payments.js'

/** Configuration passed to the `Rail0Client` constructor. See `HttpClientOptions` for all fields. */
export type Rail0ClientOptions = HttpClientOptions

/**
 * Entry point for the RAIL0 SDK.
 *
 * ```ts
 * const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })
 * const methods = await client.merchants.paymentMethods(1)
 * const resp = await client.payments.createPayment({ payment, chainId, mode: 'authorize' })
 * ```
 */
export class Rail0Client {
  /** Merchant configuration operations: paymentMethods. */
  readonly merchants: MerchantsResource
  /** Payment lifecycle operations: get, create, sign, authorize, submitAuthorize, charge, capture, void, release, approve, refund. */
  readonly payments: PaymentsResource

  constructor(options: Rail0ClientOptions) {
    const http = new HttpClient(options)
    this.merchants = new MerchantsResource(http)
    this.payments = new PaymentsResource(http)
  }
}
