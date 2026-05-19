import { HttpClient, type HttpClientOptions } from './core/http.js'
import { PaymentsResource } from './resources/payments.js'

/** Configuration passed to the `Rail0Client` constructor. See `HttpClientOptions` for all fields. */
export type Rail0ClientOptions = HttpClientOptions

/**
 * Entry point for the RAIL0 SDK.
 *
 * ```ts
 * const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })
 * const resp = await client.payments.createPayment({ payment, amount, chainId, mode: 'authorize' })
 * ```
 */
export class Rail0Client {
  /** Payment lifecycle operations: create, sign, authorize, charge, capture, void, release, approve, refund. */
  readonly payments: PaymentsResource

  constructor(options: Rail0ClientOptions) {
    const http = new HttpClient(options)
    this.payments = new PaymentsResource(http)
  }
}
