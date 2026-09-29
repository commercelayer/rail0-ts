// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
import type { HttpClient } from '../core/http.js'
import { path } from '../core/path.js'
import type { Account, UpdateAccountRequest } from './types.js'

/**
 * The merchant account itself (GET/PATCH /accounts/:id).
 *
 * Behind SIWE and behind an ownership guard: the gateway requires a JWT whose account
 * matches the path — OR an active admin session, which may read and repair any account
 * (the operator surface). For a merchant that means its OWN account only. An id that is
 * not an account answers 404, the same shape the ownership guard gives a non-admin for
 * another account's id, so the pair cannot be used to tell whether an account exists.
 *
 * The account's wallets live on WalletsResource (they are a collection under the same
 * path), and buyer-facing discovery on PaymentMethodsResource.
 */
export class AccountsResource {
  constructor(private readonly http: HttpClient) {}

  /** The account's profile: id, name, email, timestamps. */
  get(account_id: string): Promise<Account> {
    return this.http.get(path`/accounts/${account_id}`)
  }

  /**
   * PATCH /accounts/:id — change the account's own `name` and/or `email`.
   *
   * At least one field is required (400 otherwise); a name or email another account
   * already holds is a 409. It is a write, so the session's standing matters: a
   * deactivated session wallet answers 403 `wallet_deactivated` and a deactivated
   * account 403 `account_deactivated` — a revoked key must not be able to redirect the
   * contact email. Another account's id is 403 `not_your_account` for a non-admin.
   * The account's `active` flag is operator-only and not exposed here.
   */
  update(account_id: string, params: UpdateAccountRequest): Promise<Account> {
    return this.http.patch(path`/accounts/${account_id}`, params)
  }
}
