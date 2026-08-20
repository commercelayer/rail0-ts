// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import type { Account } from './types.js'

/**
 * The merchant account itself (GET /accounts/:id).
 *
 * Behind SIWE and behind an ownership guard: the gateway requires a JWT whose account
 * matches the path, so this only ever reads the caller's OWN account — there is no
 * endpoint here for reading someone else's, by design. An id that is not an account
 * answers 404, the same shape the ownership guard gives for another account's id, so the
 * pair cannot be used to tell whether an account exists.
 *
 * The account's wallets live on WalletsResource (they are a collection under the same
 * path), and buyer-facing discovery on PaymentMethodsResource.
 */
export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** The account's own profile: id, name, email, timestamps. */
  get(account_id: string): Promise<Account> {
    return this.http.get(`/accounts/${account_id}`)
  }
}
