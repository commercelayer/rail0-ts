export interface paths {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Service descriptor
         * @description Public service descriptor at the API root: names the service and exposes the api/contract version plus pointers to /health and /openapi.json. Unknown paths return 404.
         */
        get: operations["getRoot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/openapi.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OpenAPI specification
         * @description The generated OpenAPI 3.1 specification for this API, served raw.
         */
        get: operations["getOpenapiSpec"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Liveness/readiness check (incl. DB connectivity)
         * @description **Public and token-blind**: one body for every caller, and the Authorization header is never read — a missing, invalid or revoked token changes nothing and never yields a 401. The Sidekiq worker figures moved to the operator-only GET /admin/health.
         *
         *     **Alert on `status`, not on the HTTP status code.** The code is liveness for the load balancer — 503 only when the database is down — and a dead Sidekiq fleet stays 200 on purpose, because the API still serves every synchronous request while jobs queue. A monitor watching only the code therefore reports a healthy gateway while nothing broadcasts or confirms. `status` carries `ok` / `degraded` / `error`.
         */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/nonces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Issue a single-use SIWE nonce */
        post: operations["createNonce"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify a signed SIWE message and return a JWT */
        post: operations["verifySiwe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * End the current session
         * @description Revokes the token presented in the Authorization header, so it stops authenticating before its `exp`. PER TOKEN, not per address: signing out one device leaves the others signed in — revoking every session of an address is a different operation and is not this one. Requires the session it revokes, which is what keeps it from being a way to sign someone else out.
         *
         *     Best-effort by construction. The revocation list fails OPEN: if its store cannot be reached, a token cannot be known to be revoked and the request proceeds — one store outage must not sign out the whole platform. `revoked` in the response therefore reports whether the revocation was durably written; `false` means the token remains usable until `exp`, and the caller should treat its own copy as compromised.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Session ended (see `revoked`). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description true when the revocation was durably recorded. false when it was not — the token is still valid until `exp`. */
                            revoked: boolean;
                        };
                    };
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/revoke_all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Revoke every session of an address (fresh SIWE proof, not a session)
         * @description Writes an address-wide cutoff: every JWT issued to the address before it is refused with 401 sessions_revoked. Gated on a fresh SIWE proof carrying its own statement ("Sign out of RAIL0 everywhere") rather than on a session — an operator reacting to a leaked key holds the wallet, not the stolen token, and purpose-binding keeps a login signature from being replayed here. Self-revoking: the cutoff is now+1, so any token the caller holds dies too; sign in again afterwards. The revocation propagates within seconds (a short per-process cache pays the hot-path read), and the write is durable in Postgres — unlike the per-token denylist, this lever fails closed.
         */
        post: operations["revokeAllSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete an onboarding request: create the account with the emailed link and a SIWE proof by its wallet
         * @description Unauthenticated: the account does not exist until this call succeeds. The one way an account is born, for an operator's invite and a public sign-up alike. Two factors at once: `token`, the link the GATEWAY emailed for the onboarding request (HMAC-signed; it names the request, its link version, address, email and name, and expires with the request), and a SIWE proof whose statement is exactly "Claim this RAIL0 merchant account with this wallet", signed by the request's wallet (nonce from POST /auth/nonces; same domain/uri/chain binding as login). The link and the request are checked before the proof, so a stale link never spends the nonce. On success, in one transaction: the account is created with the REQUEST'S id, active, with its wallet; the request is marked completed with `terms_version`. The answer is the same session POST /auth would mint (201). A repeat with the same link after completion is a login: 200 and a fresh session if the account is active. A name, email or address taken by an account between the request and the claim answers 409 and leaves the request open. Throttled per client IP with the rest of the public surface (the same limit as POST /auth).
         */
        post: operations["claimOnboarding"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create an onboarding request: a public sign-up, or an operator's invite
         * @description One endpoint and one body for both entrances, discriminated by the Authorization header BEFORE the body is read:
         *     - **no header**: a public self-service sign-up (origin `signup`, link valid 24 h). Every outcome — a request created, an open one reused, or an email that already has an account (then the mailbox receives "account already exists" instead of a link) — answers the SAME 202 `{status: "check_your_email"}`, so the response reveals nothing about which emails are registered. An address or a name already registered is explicit (409): addresses are public on-chain, and names are shown to payers. They are checked BEFORE the email, so that 409 is the same whatever the email, and the neutral 202 only ever covers an email clash.
         *     - **an admin session** (require_admin!): an operator's invite (origin `operator`, link valid 7 days), audited as onboarding.create (onboarding.send when an open invite with the same email and address is reused), with explicit 409s.
         *     - **any other token**: 401 (invalid, expired, revoked; the codes of every authenticated route) or 403 (valid but without the operator grant, or a deactivated wallet) — never a fallback to the public path.
         *
         *     Before anything is written: validation (400), a delivering email provider (503) and the email domain allowlist (422). An open request of the same origin with the same email and address is REUSED (a new link: link_version + 1, renewed expiry, send_count + 1, and the name just submitted); otherwise a new request is inserted, and the open requests already past their expiry are deleted in the same transaction. Open requests never block each other: clashes with other requests are reported to the operator as `conflicts`. The mail is queued after the commit and sent by the gateway's worker; no response ever contains the link. `RAIL0_SIGNUP_ENABLED=false` switches the public path off (503 signup_unavailable) without touching invites. Rate limits: `signup/ip` (5/h per client IP, an IPv6 client by its /64) without a verifiable token, `signup/operator` (60/h per session) with one, plus the shared public per-IP tier.
         */
        post: operations["signup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/blockchains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List blockchains available as payment methods */
        get: operations["listBlockchains"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active tokens, optionally filtered by chain */
        get: operations["listTokens"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every account (admin)
         * @description Admin only (require_admin!: the session account must hold the operator grant — a row in administrators — and be active, re-read from the rows per request, so a revocation bites on the next request; the session wallet must be active even for reads, because these reads are cross-account). Every account, Full entity, each carrying `admin` (whether the account holds the grant) and the derived `status`: `active` or `deactivated` (switched off by an operator). Filters: admin, status; sort and pagination. There is no create: an account is born only at POST /claim, from an onboarding request (POST /signup).
         */
        get: operations["listAccounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        /**
         * Read an account profile (own account; any account for an admin)
         * @description The account row. The owner reads their own profile (id, name, email, priority_tip and timestamps — the explicit allow-list, with no admin/role field: the operator axis leaves no trace on a standard response); an active admin reads ANY account, whole record (AccountFull: every column plus `admin`, whether the account holds the operator grant, and the derived `status`). For a non-admin, another account's id and an id that is not an account answer alike, so this cannot be used to tell whether an account exists.
         */
        get: operations["getAccount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update an account: own profile; an admin may also set active
         * @description The one write on the account row. The owner updates name, email and/or priority_tip (the fee setting of its own transactions); active is an operator field — supplying it requires the operator grant (403 otherwise). An admin may also change ANY account's name and email (audited as account.update, with the replaced values in detail.previous). The grant itself is not writable here: it is granted and revoked on /admin/administrators. Requires an ACTIVE session wallet: deactivation is the revocation primitive, and a revoked key must not be able to redirect the account's contact email. name/email are unique; a taken value is a 409. The owner or an admin may set the account's payment windows (authorization_ttl, refund_ttl; null = the gateway default): they apply to payments created afterwards, whose expiries are signed, and an operator's change is audited like name and email. Out of bounds, or a pair closer than the contract's one-day gap, is a 422 invalid_payment_windows. An admin cannot deactivate their own account (422 self_deactivate). Last-admin guard: deactivating the account holding the last operative grant is refused with 422 last_admin. Exposure guard: deactivating an account that still has money in motion (payments in flight or in escrow, open disputes, pending or submitted payouts — GET /admin/accounts/{id}/exposure) is refused with 409 account_has_open_exposure, whose body carries the summary as `exposure`, unless the request also sends acknowledge_open_exposure: true; the acknowledged deactivation is audited with acknowledged_open_exposure and the counts.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    account_id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description Display name. Unique across accounts. */
                        name?: string;
                        /** @description Contact email: ONE bare address `x@y` (no spaces, commas, semicolons, quotes or angle brackets: the mailer's own rule). Stored lowercase; unique across accounts case-insensitively. */
                        email?: string;
                        /** @description Active status (admin only). */
                        active?: boolean;
                        /** @description With active: false, deactivate even though the account still has open exposure (see GET /admin/accounts/{id}/exposure). Without it such a deactivation is refused with 409 account_has_open_exposure. Changes nothing on its own (it does not count as a field to update). */
                        acknowledge_open_exposure?: boolean;
                        /** @description Tip the network's suggested priority fee on the merchant's own transactions (default true); false uses the chain's minimum tip (0 on most chains, 25 gwei on Polygon PoS/Amoy). Owner or admin. */
                        priority_tip?: boolean;
                        /**
                         * @description Authorization (capture) window of the account's NEW payments, in seconds; null puts it back on the gateway default (AUTHORIZATION_TTL). Between AUTHORIZATION_TTL_MIN and AUTHORIZATION_TTL_MAX (see payment_windows). Owner or admin.
                         * @example 172800
                         */
                        authorization_ttl?: number | null;
                        /**
                         * @description Refund and dispute window of the account's NEW payments, in seconds; null puts it back on the gateway default (REFUND_TTL). At most REFUND_TTL_MAX, and the effective pair must keep refund_ttl - authorization_ttl >= min_refund_window (a single window is checked against the default the other follows). Owner or admin.
                         * @example 5184000
                         */
                        refund_ttl?: number | null;
                    };
                };
            };
            responses: {
                /** @description The updated account: the owner's profile (Account), or for an admin session the whole record (AccountFull). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Account"] | components["schemas"]["AccountFull"];
                    };
                };
                /** @description Neither field was supplied, or a value was blank/malformed. */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Missing or invalid token. */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Another account's id, the session wallet is deactivated, active without the operator grant, or an operator changing another account's email (forbidden). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description conflict: the name or email is already taken by another account; account_has_open_exposure: active: false on an account with open exposure and no acknowledge_open_exposure: true — the body adds `exposure` (AccountExposure). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"] | components["schemas"]["AccountOpenExposureError"];
                    };
                };
                /** @description invalid_payment_windows: a window outside its bounds, or a refund window not at least min_refund_window past the authorization window; self_deactivate: an admin deactivating their own account; last_admin: the change would leave zero active admins. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": Record<string, never>;
                    };
                };
            };
        };
        trace?: never;
    };
    "/accounts/{account_id}/wallets": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        /**
         * List the account's wallets, each with its token holdings nested
         * @description Owner or admin.
         */
        get: operations["listAccountWallets"];
        put?: never;
        /**
         * Add a wallet to the account (suspended)
         * @description SUSPENDED: every session is refused 403 `wallet_add_unavailable` ("Adding a wallet is not available yet."). A session is bound to the one wallet it signed in with; adding another wallet will return with a dedicated merchant wallet-management section that requires a fresh signature by the wallet being added. The request shape and the proof verification below are kept for that section. When it returns: Registers a wallet on the account. Owner only. Requires a SIWE proof-of-ownership of the address being added: obtain a single-use nonce from `POST /auth/nonces`, build an EIP-4361 message carrying that nonce and signed by the address's private key, and submit `message` + `signature` here. The gateway verifies the signature recovers to `address`, the nonce is unused/unexpired, and the message binds to an allowed SIWE domain/chain — otherwise 422. The proven address need not equal the session address (a merchant may control several payee wallets). An admin cannot add a wallet to another account (403): the proof is exactly what an operator cannot produce. Wallet addresses are globally unique: an address already registered (to this or any other account) yields 409.
         */
        post: operations["createWallet"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. The address is unique per account, so either resolves to the same wallet. */
                id: string;
            };
            cookie?: never;
        };
        /** Get a single wallet (by id or address) */
        get: operations["getWallet"];
        put?: never;
        post?: never;
        /**
         * Deactivate a wallet (soft delete)
         * @description Owner or admin. An owner session may change ONLY the wallet it signed in with (the session's address): another wallet of the same account is refused 403 `not_your_wallet`. An admin may switch off any wallet. Only ever deactivates (payments name the address, so the row stays; there is no removal). Last-active-wallet guard: the account's only active wallet is refused with 422 last_active_wallet. Records who switched it off (`deactivated_by`), which decides who may switch it back on (see PATCH): an operator's switch-off only an operator lifts, and an operator switching off a wallet its owner already switched off takes the switch-off over.
         */
        delete: operations["deactivateWallet"];
        options?: never;
        head?: never;
        /**
         * Update a wallet label or active status
         * @description Owner or admin. An owner session may change ONLY the wallet it signed in with (the session's address): another wallet of the same account is refused 403 `not_your_wallet`. An admin may change any wallet, including the guarded switch-off. Last-active-wallet guard: `active: false` on the account's only active wallet is refused with 422 last_active_wallet. Every switch-off records who did it (`deactivated_by`: `owner` when the session is signed in with this wallet, `operator` when an admin session acts on it). Switching back on (`active: true` on an inactive wallet): an admin may always; the owner's session may switch its OWN wallet back on — this is the one write a deactivated session may make, anything else from it is 403 `wallet_deactivated` — unless an operator switched it off, or the switch-off predates the record (`deactivated_by` null), which is refused 403 `wallet_deactivated_by_operator`: an operator's switch-off revokes the key, so only an operator lifts it. Residual limit: a wallet its owner switched off can be switched back on by whoever holds its key; a definitive revocation must come from an operator.
         */
        patch: operations["updateWallet"];
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/usage": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * What still names a wallet's address (admin)
         * @description Admin only. Counts the payments naming the wallet's address as payee and as payer, and the transactions it sent — the history the admin console shows before switching the wallet off. Switching off keeps all of it.
         */
        get: operations["getWalletUsage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/balances": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * Get the wallet's on-chain balances (native + tokens)
         * @description Reads the wallet address's on-chain balances — native gas token + active ERC-20 tokens — across all active chains, or one chain via `chain_id`. Protected: only the wallet's own account may read it. Chains are read in parallel; one whose RPC is unreachable is returned with an `error` instead of failing the whole response.
         */
        get: operations["getWalletBalances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enable a token (chain) this wallet accepts
         * @description Upserts an accepted token/chain combination for the wallet — the same combinations exposed by GET /payment_methods and enforced by POST /payments. Re-enabling a previously-disabled holding reactivates its row rather than duplicating it (200 vs 201 on a first enable). THE DEFAULT: a wallet that accepts anything keeps exactly one, so the FIRST token enabled takes the role unasked, and `default: true` here is how it is switched OVER — the successor is promoted and the incumbent demoted in the same request. `default: false` on the CURRENT default is refused 422 `default_payment_method`: clearing it without naming a successor would leave the wallet with no preferred method and nothing saying so. Owner only, and only on the wallet the session signed in with: another wallet of the same account is refused 403 `not_your_wallet`.
         */
        post: operations["enableWalletToken"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/tokens/{token_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Disable a token this wallet accepts (soft delete)
         * @description Soft-disables the accepted token/chain holding (active:false), removing it from discovery/creation while keeping the row. Re-enable via POST. Refused 422 `default_payment_method` when the holding is the wallet's ACTIVE default and the wallet accepts other methods — switch the default over first (POST with default:true on its successor). The LAST active method can be disabled even as the default: the wallet then accepts nothing, and the flag is cleared with it. An INACTIVE holding still carrying the flag is not protected: that is a row already stood down when its chain left service. Owner only, and only on the wallet the session signed in with: another wallet of the same account is refused 403 `not_your_wallet`.
         */
        delete: operations["disableWalletToken"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/tokens/{token_id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Enable an existing token holding
         * @description Enables an existing holding (active:true). Returns 404 if the wallet has no holding for the token (use POST to create one). Owner only, and only on the wallet the session signed in with: another wallet of the same account is refused 403 `not_your_wallet`.
         */
        patch: operations["enableExistingWalletToken"];
        trace?: never;
    };
    "/accounts/{account_id}/wallets/{id}/tokens/{token_id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Disable an existing token holding
         * @description Disables an existing holding (active:false). Returns 404 if the wallet has no holding for the token, and 422 `default_payment_method` when it is the wallet's active default and other methods are active — switch the default over first. The last active method can be disabled even as the default (the flag is cleared with it). Owner only, and only on the wallet the session signed in with: another wallet of the same account is refused 403 `not_your_wallet`.
         */
        patch: operations["disableExistingWalletToken"];
        trace?: never;
    };
    "/payment_methods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a merchant's active payment methods (wallets + accepted tokens/chains)
         * @description Public, buyer-facing discovery of a merchant's payment methods. Provide EXACTLY ONE of `account_id` (returns all the merchant's active wallets) or `address` (returns just that one wallet). An unknown account/address yields an empty list. Only active wallets and active token holdings are exposed.
         */
        get: operations["listPaymentMethods"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List disputes on the authenticated wallet's payments (open and closed) */
        get: operations["listAccountDisputes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List payments for the authenticated wallet (payer or payee) */
        get: operations["listPayments"];
        put?: never;
        /**
         * Create a payment
         * @description Session required (an account-less token is fine); the `payer` in the body must equal the authenticated address (403 otherwise) — a buyer only drafts payments payable from its own wallet. `payer` and `payee` must be different addresses (a payment to oneself is rejected with 422). Idempotent on the `Idempotency-Key` header, scoped to the caller: when a payment already exists for the key AND the same payer, that record is returned with 200 instead of 201. Keys are per payer, uniqueness included: a key another payer already used is not shared and does not conflict — this payer's request creates its own payment (201), and never returns or reveals the other one.
         *
         *     **Idempotency-Key** (optional header) REJECTS a reused key rather than replaying it: the same key with different terms answers 422 `idempotency_key_reused`, not 200 carrying the first payment — silently returning a payment whose terms are not the ones just sent is how a client charges the wrong amount. Same key + same terms replays with 200 (amounts compare converted, so "1.0" and "1.00" match). A key used by another payer is independent of this payer's: it neither replays nor conflicts. Rotate per logical order.
         */
        post: operations["createPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The `:id` accepts either the payment UUID or its `rail0_id` (the contract's bytes32 paymentId, `0x…`), resolved to the UUID internally. This holds for every `/payments/{id}/…` route. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * Get a payment with embedded transactions and optional signing payload
         * @description Participant-only: readable only by the payment's payer or payee (bearerAuth), not by anyone who learns the id. The payer authenticates with an account-less SIWE token. 401 without a token, 403 for a non-participant. An active admin reads ANY payment through the Full entity: everything a participant reads (chain_id, rail0_contract, the escrow fields, the embedded transactions, and signing_payload while unsigned) plus every column — signatures, broadcast bookkeeping, error diagnostics. The operator's debugging view, a superset of the participant's, so an admin who is party to the payment can act on it.
         */
        get: operations["getPayment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a payment's description and/or the payee's internal note
         * @description Participant-only (payer or payee): 401 without a token, 404 for a non-participant, 403 `wallet_deactivated` from a retired wallet. Allowed in every status, closed ones included. At least one field. The description is gateway-side only — in nothing signed or hashed on chain — so this moves no money and dispatches no webhook. A changed description bumps `updated_at`; writing the same value back is a no-op. `reference` / `reference_origin` (the payment's identifier in the merchant's own system, and which system) are the payee's to correct: 403 `not_the_payee` for the payer; a changed one moves `updated_at`. `merchant_note` is the payee's internal note: only the payee may write it (403 `not_the_payee` for the payer), only the payee (and an operator) reads it, and writing it does not move `updated_at`.
         */
        patch: operations["updatePayment"];
        trace?: never;
    };
    "/payments/{id}/sign": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Store the payer's signature on a payment
         * @description Session required (an account-less token is fine) and the caller must be a participant (payer or payee). The signer itself is additionally verified from the recovered signature, not the session party.
         */
        put: operations["signPayment"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /**
         * List a payment's transactions
         * @description Participant-only (bearerAuth): readable only by the payment's payer or payee. 401 without a token, 403 for a non-participant.
         */
        get: operations["listPaymentTransactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/transactions/{transaction_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The transaction row to read, resolved through the payment's own transactions - an id belonging to another payment answers 404. */
                transaction_id: string;
            };
            cookie?: never;
        };
        /**
         * Fetch one of a payment's transactions
         * @description Reads a single transaction by id - the read the list endpoint could only answer by returning every row. Anything holding a transaction id (the `action_id` an asynchronous integration is handed when an operation is accepted) resolves it directly, instead of fetching the payment and scanning its transactions for an id it already has. Participant-only (bearerAuth): readable by the payment's payer or payee. A caller who is party to neither gets 404 rather than 403, so the response never confirms the payment exists; an unknown, malformed or foreign transaction id answers 404 the same way.
         */
        get: operations["getPaymentTransaction"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/transactions/{transaction_id}/redrive": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The transaction row to redrive, resolved through the payment's own transactions - an id belonging to another payment answers 404. */
                transaction_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-enqueue a stuck broadcast for this transaction (payee, or an operator)
         * @description Payee-gated, OR an operator session on any payment (audited as transaction.redrive). On-demand doorbell for the recovery the Recovery already performs at cadence: a `pending` transaction still holding its `signed_transaction` is a broadcast the queue lost (a hard worker kill drops the in-flight job), and this re-enqueues the broadcaster for it NOW instead of waiting for the recovery tick. Same redrivable predicate, same enqueue, no new state and no new worker. Payee-only, like the other operation writes. Idempotent under double-click: the broadcaster re-checks under the row lock before sending, so a duplicate enqueue is harmless and never double-broadcasts. Any other state is refused with 422 `not_redrivable`, the detail naming the state the row IS in (a pending row without its signed transaction has nothing to broadcast; submitting/submitted already reached the send; confirmed is settled; a failed row's repair path is the operation's /submitted endpoint, not another send).
         */
        post: operations["redrivePaymentTransaction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/{operation}/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an operation's unsigned transaction
         * @description Builds the unsigned transaction and stores it on a new `pending` transaction. Session required (bearerAuth) for every operation. The payee operations additionally require the caller to be the payee; `release` is not payee-gated (it is payer-or-payee on-chain and the payer has no gateway account, so its acting party is authorized on-chain — the signed tx + the contract's NotPayerOrPayee gate) but its prepare is still restricted to a payment participant. Each operation reads only its own body fields: `amount` for `capture` and `refund` (required for both), `signature` for `refund`, `from` for `release`; `authorize`, `charge` and `void` take none. A field another operation reads is ignored, never an error. `refund` is two-phase: with no `signature` it returns `{ signing_payload }` (phase 1, no transaction row created); with `signature` it creates the pending transaction (phase 2). `release` is also the one operation with an INVERTED time window: it returns the *uncaptured remainder* of an authorization, which the contract keeps available to the merchant until the authorization expires, so release opens only AFTER `authorization_expiry` and answers 422 `authorization_not_expired` before then (the refusal carries the timestamp). The operation whose card-processing analogue is “cancel the hold early” is `void`, not release — and void requires the authorization to be fully intact, so any capture rules it out permanently.
         */
        post: operations["preparePaymentOperation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/{operation}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit an operation's signed transaction
         * @description Stores the caller's signed raw transaction on the latest pending transaction for this operation and enqueues the broadcaster. Session required (bearerAuth) for every operation. The payee operations additionally require the caller to be the payee; `release` accepts any session (payer-or-payee submit it). As a robustness check the gateway also recovers the signed tx's sender and requires it to match the party the contract accepts as msg.sender — the payee for payee ops, the payer or payee for `release` — returning 403 otherwise and 400 if the tx can't be decoded, before broadcasting. Broadcast happens asynchronously.
         */
        post: operations["submitPaymentOperation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/{operation}/submitted": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record an externally-broadcast operation transaction (MetaMask)
         * @description For wallets that sign and broadcast in one step (MetaMask `eth_sendTransaction`) and so cannot hand the gateway a raw `signed_transaction`. The caller broadcasts the prepared transaction themselves and reports its hash here; the gateway VERIFIES on-chain that the transaction targets this payment's RAIL0 deployment and carries this payment's id in its calldata (422 `foreign_transaction_hash` otherwise — a hash no node has seen yet is accepted, since propagation is not instant), then attaches it to the operation's open transaction and moves it straight to `submitted`, WITHOUT the broadcaster — the indexer then confirms it by hash exactly as for a gateway-broadcast tx. JWT-gated (bearerAuth) since a bare hash carries no signature to authorize it: payee-only for the merchant operations (authorize/capture/charge/void/refund); `release` is payer-or-payee on-chain so it accepts EITHER participant (a MetaMask buyer can report a payer-side release). The payer operations dispute/close_dispute have their own payer-only /submitted endpoints. Re-callable while the tx is still unconfirmed to OVERWRITE a stuck or wrong hash; a confirmed/failed operation is terminal and returns 422.
         */
        post: operations["submitPaymentOperationByHash"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute/submitted": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record an externally-broadcast dispute transaction (MetaMask)
         * @description The payer's counterpart to /payments/{id}/{operation}/submitted: a MetaMask buyer signs+sends the dispute() tx in one step and reports its hash here. Payer-only (bearerAuth): the bare hash carries no signature, so the SIWE session is the authorization (the payer authenticates with an account-less token). Records the hash on the payment's dispute transaction and moves it to `submitted`, skipping the broadcaster. Re-callable while unconfirmed; a confirmed/failed tx is terminal (422).
         */
        post: operations["submitDisputeByHash"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute/close/submitted": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record an externally-broadcast close-dispute transaction (MetaMask)
         * @description Payer-only report-by-hash for the closeDispute() tx, same contract as /payments/{id}/dispute/submitted. Lets a MetaMask buyer close a dispute it broadcast itself.
         */
        post: operations["submitCloseDisputeByHash"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare the dispute transaction (open; payer-signed)
         * @description Builds the unsigned dispute() transaction on a pending transaction for the payer to sign. Signal-only (no fund effect). Session required (an account-less token is fine) and restricted to a payment participant (payer or payee); the acting party (payer) is authorized on-chain, not by the session (the payer has no gateway account) — the payer-signed tx + the contract's NotPayer gate. Submit the signed tx to POST /payments/{id}/dispute.
         */
        post: operations["prepareDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit the signed dispute transaction (open; payer-signed)
         * @description Stores the payer's signed dispute() transaction and enqueues the broadcaster. Session required (an account-less token is fine); the acting party is authorized on-chain — the gateway recovers the signed tx's sender and requires it to be the payer (403 otherwise, 400 if undecodable), mirroring the contract's NotPayer gate. The disputed flag is set when the indexer reports the on-chain event.
         */
        post: operations["submitDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute/close/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare the close-dispute transaction (open; payer-signed)
         * @description Builds the unsigned closeDispute() transaction on a pending transaction for the payer to sign. Session required (an account-less token is fine) and restricted to a payment participant (payer or payee); the acting party (payer) is authorized on-chain, not by the session (the payer has no gateway account) — the payer-signed tx + the contract's NotPayer gate. Submit the signed tx to POST /payments/{id}/dispute/close.
         */
        post: operations["prepareCloseDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/dispute/close": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit the signed close-dispute transaction (open; payer-signed)
         * @description Stores the payer's signed closeDispute() transaction and enqueues the broadcaster. Session required (an account-less token is fine); the acting party is authorized on-chain — the gateway recovers the signed tx's sender and requires it to be the payer (403 otherwise, 400 if undecodable), mirroring the contract's NotPayer gate.
         */
        post: operations["submitCloseDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /**
         * List a payment's disputes
         * @description Participant-only (bearerAuth): readable only by the payment's payer or payee. 401 without a token, 403 for a non-participant.
         */
        get: operations["listDisputes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/analytics/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Merchant sales KPIs (counts, per-token/chain volume, per-chain gas)
         * @description Account-only (require_account!): headline sales analytics over the merchant account's own payments as payee. 403 for an account-less (buyer) session. Scope: every wallet of the account by default; `payee` narrows it to ONE of the account's wallets (case-insensitive; a deactivated wallet is still readable), which also narrows the gas and failure rows to that wallet's broadcasts. A `payee` that is not a wallet of the session's account is 403 `forbidden`; a malformed one is 400. Counts are token-agnostic; monetary volume is grouped per (token, chain) and only summed within one token; gas is grouped per chain and denominated in that chain's native token, so it is never summed across chains either, and is additionally sliced by payment status and by operation.
         */
        get: operations["analyticsSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/analytics/timeseries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Order count per time bucket
         * @description Account-only. Order count per time interval (day/week/month), oldest first. Accepts the same `payee` scope as /analytics/summary (403 `forbidden` for a payee that is not a wallet of the session's account). Per-bucket volume is included only when both a token and a chain are filtered (so the sum is over one token); otherwise null.
         */
        get: operations["analyticsTimeseries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/analytics/breakdown": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Orders aggregated by a dimension
         * @description Account-only. Aggregate orders by `token`, `chain`, `mode`, or `status`. Accepts the same `payee` scope as /analytics/summary (403 `forbidden` for a payee that is not a wallet of the session's account). token rows carry per-token volume; chain, mode and status rows are counts only (volume is never summed across tokens).
         */
        get: operations["analyticsBreakdown"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List webhooks for the authenticated account */
        get: operations["listWebhooks"];
        put?: never;
        /** Create a webhook */
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /** Get a webhook */
        get: operations["getWebhook"];
        put?: never;
        post?: never;
        /** Delete a webhook */
        delete: operations["deleteWebhook"];
        options?: never;
        head?: never;
        /** Update a webhook (name, callback_url, topics) */
        patch: operations["updateWebhook"];
        trace?: never;
    };
    "/webhooks/{id}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /** Enable a webhook */
        put: operations["enableWebhook"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /** Disable a webhook */
        put: operations["disableWebhook"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/rotate_secret": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Rotate the shared secret — returns the new secret once
         * @description Replaces the shared secret and returns the new one once. The replaced key is kept for a grace window (one hour): inside it every delivery carries X-Rail0-Signature under the new key AND X-Rail0-Signature-Previous under the old one, so an endpoint verifies with whichever key it has deployed and no delivery in flight at rotation becomes unverifiable. The old key signs only, is never honoured past the window, and a second rotation inside it drops the oldest key. Two concurrent rotations cannot both succeed: the one that loses the race answers 409.
         */
        put: operations["rotateWebhookSecret"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/reset_circuit": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /** Reset the circuit breaker and re-enable the webhook */
        put: operations["resetWebhookCircuit"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/test": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a test event to the webhook's callback and report the response
         * @description Delivers one event with topic `webhooks.test`, `test: true` and no payment (`payment` and `transaction` null) to the callback, now, and answers with what the endpoint did. Same delivery as a real event: the vetted, pinned addresses (SSRF guard), the timestamped `X-Rail0-Signature` (dual-signed inside a rotation grace window) and the delivery deadline. Synchronous and single-attempt, and NOT recorded: no event_callbacks row, no circuit-breaker accounting, so a failing test cannot trip the breaker and a passing one does not reset it. Works on a disabled webhook too. Owner only (404 for another account's webhook); a write, so a deactivated wallet or account gets 403.
         */
        post: operations["testWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/event_callbacks": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        /** List delivery attempts for a webhook */
        get: operations["listWebhookEventCallbacks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/event_callbacks/{callback_id}/redeliver": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The event_callback row whose recorded payload to re-send. */
                callback_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-deliver a recorded event callback's exact payload
         * @description Re-sends the stored delivery payload verbatim (same embedded event `id`, so a consumer that already processed it deduplicates) under a fresh timestamped signature, through the standard async delivery job. A disabled or circuit-open webhook drops the replay like any delivery - reset the circuit first.
         */
        post: operations["redeliverEventCallback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sync/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stale submitted transactions for the indexer sweeper
         * @description HMAC-protected, indexer-facing.
         */
        get: operations["getSyncTransactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sync/chains/{chain_id}/transactions/{tx_hash}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description EVM chain id the transaction belongs to. */
                chain_id: number;
                /** @description On-chain transaction hash (0x + 64 hex). Anything else is refused 400. */
                tx_hash: string;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Indexer callback: confirm or fail an on-chain transaction
         * @description HMAC-protected, indexer-facing event delivery. The `operation` field selects the action. For `confirm`, `event_type` and `block_number` are required, and fund-affecting events also carry `capturable_amount`/`refundable_amount` — the live on-chain escrow balances the gateway mirrors (the indexer is the single source; the gateway no longer recomputes them). As long as the request is authentic and well-formed the gateway accepts it (202) and enqueues the Syncer; matching the callback to a gateway transaction is asynchronous. A callback for an unknown tx hash, or one whose tx is on a different chain than the URL, is recorded as a SyncError for manual review rather than rejected — so the indexer never receives a 404 to retry.
         */
        put: operations["syncTransactionCallback"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/administrators/{account_id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The account being granted/revoked. */
                account_id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Grant the operator role to an account (admin)
         * @description Admin only. Inserts the account's administrators row — the operator grant — recording the granting admin as granted_by, an optional free-text audit note, and an optional expiry: a time-boxed grant past its expires_at no longer opens the surface (checked per request) and no longer counts for the last-admin guard, but the row lingers as audit history. One grant per account: a duplicate answers 409 (the unique index is the authority, no pre-check race). A past expires_at answers 422 expiry_in_the_past. The grant is deliberately not a field on the account: standard responses carry no trace of the operator axis.
         */
        post: operations["grantAdministrator"];
        /**
         * Revoke the operator role (admin; refused for the last active admin)
         * @description Admin only. Deletes the account's administrators row. Read from the row per request everywhere, so the revocation bites on the target's very next request — no token tail. An admin cannot revoke their own grant (422 self_revoke). Last-admin guard: revoking the grant that would leave zero operative admins (grants on active accounts) is refused with 422 last_admin.
         */
        delete: operations["revokeAdministrator"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Operator diagnostics: every standing failure condition, with a verdict (admin)
         * @description The operator's view of what is wrong RIGHT NOW: a top-level `status` (the worst of the checks) and a named check per condition, each carrying its figures AND a `describes` sentence saying what they mean. Admin only, and deliberately never on the public GET /health: queue depth tells an observer when settlement is lagging, which is when a load-based attack lands hardest (#153), and `indexer_intake` goes further — it says whether indexing is blind. Always 200: diagnostics, not a liveness probe, so a degraded system is the CONTENT; the only 503 in the health surface is the public probe's DB gate. BREAKING (Sep 2026): `sidekiq` and `divergences` were top-level and now live at `checks.workers.fleet` and `checks.balances` — nesting is what lets a caller read one `status` without knowing every check's name, and lets checks be added without a new top-level key each time.
         */
        get: operations["getAdminHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/rpc_health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * RPC endpoint reachability per active chain, probed from the gateway (admin)
         * @description Every active chain's rpc_urls, probed FROM THE GATEWAY'S OWN PROCESS — the view an IP ban or a provider outage actually hits, and the one the pool's silent failover hides. Per endpoint: eth_chainId (must equal the chain), eth_blockNumber (head), first-round-trip latency, and the finality-tag block where the chain gates on safe/finalized (null with tag_error when the node refuses the tag — where the indexer falls back to depth). Per chain: `ok` (at least one endpoint serves it), `primary_status` (the first endpoint's, which the pool tries before any fallback) and `status` (ok all up / degraded some / error none). URLs are shown as configured, as on GET /admin/blockchains. Probed concurrently with short timeouts and cached 60s per process. Always 200: a dead endpoint is the content.
         */
        get: operations["getAdminRpcHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * This process's chain-config snapshot against the database (admin)
         * @description What a restart would pick up: per table (blockchains, tokens, contracts) the rows added since the snapshot, removed, and changed with the differing fields as {from, to} — bookkeeping timestamps excluded — plus the snapshot's loaded_at, a stale flag and the pending count. One process (chain config changes only via seeds and a deploy that restarts every process, #374): a worker's snapshot is not visible from here (#374).
         */
        get: operations["adminCatalogDiff"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/catalog/reload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rebuild this process's chain-config cache (admin)
         * @description Chain config is read once at boot into an in-memory snapshot so hot paths never query the DB for it; after a seed changes a chain, a token or an RPC endpoint, the running process keeps serving what it read at boot. This rebuilds that snapshot. ONE PROCESS: it refreshes the process that serves this request, so a deployment with a web machine and a worker machine has two snapshots and several web machines have several — this is the tool for a single-process environment, not a fleet-wide invalidation, for which a restart is still the only honest instrument. Answers the counts it now holds, because "reloaded" alone cannot distinguish a snapshot that picked up the change from one that rebuilt the same rows.
         */
        post: operations["reloadCatalog"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Transactions across every account, or only the stuck ones (admin)
         * @description The cross-account transaction list, and with `stuck` only the wedged rows: `unbroadcast` (signed, never sent, past two broadcast re-drive cycles of 600 s — the rows behind /admin/health's broadcasts check), `unconfirmed` (broadcast past SUBMITTED_TX_TTL with no indexer confirm — the indexer_intake check) or `any`. Same predicates as the health figures, so count and page agree. Each row carries `redrivable` and its `payment` summary; never signed_transaction. Oldest first; paginated.
         */
        get: operations["listAdminTransactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/accounts/{id}/exposure": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The account id. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * An account's open exposure: what a deactivation would leave in motion (admin)
         * @description Read before PATCH /accounts/{id} {active: false}, which refuses a non-empty exposure with 409 account_has_open_exposure unless acknowledged. Payee side only (payments whose payee is one of the account's wallets, switched-off wallets included); the account acting as a payer is not counted. in_flight: unsigned or signed, authorization_expiry still ahead (amount); in_escrow: authorized, expired, partially_captured or partially_refunded with capturable_amount > 0 (capturable_amount — captured and charged funds are already in the merchant's wallet, not escrow); disputed: an open dispute (refundable_amount). by_token adds those figures per chain and token, in base units, `count` being the distinct payments. Payouts are counted by status (pending, submitted). `empty` is true when every count is zero.
         */
        get: operations["getAdminAccountExposure"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Every account's payouts (admin)
         * @description Read-only, across accounts, newest first (the id breaks a tie). Each row is the whole record minus the signed payload, plus `token_symbol`, `amount_formatted` and `account: {id, name}`. Filters account_id, wallet_id, destination_id (UUIDs), chain_id, status (one or several, comma-separated), purpose, created_from / created_to (inclusive); sort created_at, updated_at, submitted_at, amount (numeric), status; offset pages like GET /payouts.
         */
        get: operations["listAdminPayouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payouts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        /** Read any account's payout (admin) */
        get: operations["getAdminPayout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payouts/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * Any account's payout audit trail (admin)
         * @description Newest first, offset pages.
         */
        get: operations["listAdminPayoutEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payout_destinations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Every account's payout destinations (admin)
         * @description Read-only, across accounts, newest first. Each row is the whole record plus `token_symbol` and `account: {id, name}` (not the suggested reserve: one aggregate query per row). Filters account_id, wallet_id (UUIDs), chain_id, status; sort created_at, updated_at, label, status; offset pages.
         */
        get: operations["listAdminPayoutDestinations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payout_destinations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        /** Read any account's payout destination (admin) */
        get: operations["getAdminPayoutDestination"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/payout_destinations/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * Any account's payout destination audit trail (admin)
         * @description The destination's events and those of its payouts, newest first, offset pages.
         */
        get: operations["listAdminPayoutDestinationEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/event_callbacks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Webhook deliveries across accounts, by payment or subscription (admin)
         * @description The delivery log across every account: the merchant's GET /webhooks/:id/event_callbacks is one subscription's; this answers from the payment (payment_id, UUID or rail0 id) or the subscription (webhook_id), with the same status / topic / response_code / since / until filters. Each row carries its webhook (operator view, no secrets) and through it the account; the payload is the JSON that was POSTed. Paginated.
         */
        get: operations["listAdminEventCallbacks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Every dispute across accounts (admin)
         * @description Open and closed disputes on every account's payments, newest first, each with its payment summary and the dictionary reading of both reasons. Filters status, chain_id, reason_code (an open-reason dictionary code), from/to on opened_at; paginated.
         */
        get: operations["listAdminDisputes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The effective operator configuration of this process (admin)
         * @description Every window, threshold and limit in config/rail0_config.rb as this process resolved it, grouped (payments, recovery, retention, webhooks, settlement, rate_limit, siwe, session, fees, rpc, onboarding, email), each as {value, env, overridden, description}: the variable that sets it (null for a constant), whether that variable is set, and a plain-text explanation of what the entry is for. Most entries are constants (env null); the rest read the environment. Read-only: changing a value is a deploy. Nothing secret.
         */
        get: operations["adminConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/transactions/timeseries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Transactions handled per time bucket (admin)
         * @description What the GATEWAY has been doing: transactions handled per slice of time, across every account, with the failed count beside each total. Not the merchant rollup with a wider scope — GET /analytics/timeseries counts one account's ORDERS, this counts the machine's broadcasts. Buckets: minute, hour, day, week, month (default hour). `from`/`to` bound the window; omitted, each interval defaults to a span sized for it (minute → 2h, hour → 48h, day → 30d, week → 26w, month → 24m). The window is echoed in the response, because a caller that named none cannot otherwise label an axis. A window wider than 750 buckets is REFUSED with 422 window_too_wide rather than truncated: a chart missing its tail reads as a quiet period rather than as a clipped answer.
         */
        get: operations["adminTransactionThroughput"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/gas/by_hour": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Average gas per chain and hour of the day (admin)
         * @description Average gas the gateway's OWN transactions paid, per chain and per hour of the day (UTC, by confirmation time), computed on request from the gas fields the indexer mirrors onto transactions — no sampling. Failed transactions count (a revert burns gas). Every chain lists all 24 hours; an hour with no transaction has 0 and null averages, and `transactions` beside each average says how much it rests on. Amounts are in each chain's native token and never summed across chains. The window defaults to the last 30 days and is echoed; one wider than 90 days is REFUSED with 422 window_too_wide rather than truncated. Answers are cached for 5 minutes.
         */
        get: operations["adminGasByHour"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/sync_errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List sync errors (admin)
         * @description Why a /sync callback could not be applied — written by the Syncer for exactly this. Admin only. Filters: reason, outcome (confirmed|failed), tx_hash; sort and pagination. Full entity.
         */
        get: operations["listSyncErrors"];
        put?: never;
        post?: never;
        /**
         * Clear sync errors (admin)
         * @description Delete rows from the sync-error ledger, honouring the SAME filters as the listing (reason, outcome, tx_hash) — so a clear removes what the caller is looking at rather than whatever the table holds. Unfiltered it empties the table, which is what an operator's Clear button is for; the confirmation belongs at the click. The table is otherwise append-only — nothing prunes it on a clock — so this is the only way rows leave it. NOTE: balance_divergence rows live here too and GET /admin/health reports their standing count, so an unfiltered clear resets that count; filter by reason to keep them. Answers the number of rows deleted.
         */
        delete: operations["clearSyncErrors"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/administrators": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every operator grant (admin)
         * @description Every administrators row, expired ones included (the row lingers as audit history), newest first, with the grantee and the grantor named as `account` and `grantor` (null on a bootstrap grant). Unpaginated: a handful of operators, not a ledger.
         */
        get: operations["listAdministrators"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every webhook subscription across accounts (admin)
         * @description Every account's subscriptions with circuit state, `active`, the owning `account` and the newest delivery attempt (`last_attempt_at`, `last_attempt_status`). Open circuits first. NEVER carries a signing key: shared_secret and previous_secret are returned once, to the owner, on create and rotate. Filters: account_id, circuit_state (closed|open), topic; sort created_at, updated_at, circuit_failure_count, name; paginated (x-total-count and friends).
         */
        get: operations["listAdminWebhooks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/webhooks/{id}/reset_circuit": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Reset a webhook's circuit breaker on any account (admin)
         * @description The same write as the owner's PUT /webhooks/:id/reset_circuit — closes the circuit, zeroes the failure count and re-enables the hook — on any account's subscription. Audited (webhook.reset_circuit): it re-arms delivery to an endpoint the operator does not control. Answers the operator view, secrets excluded.
         */
        put: operations["adminResetWebhookCircuit"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The operator audit log (admin)
         * @description Every admin write, newest first: who (`actor`, and `actor_address` — the wallet the session signed in with), what (`action`), on which resource (`resource_type`, `resource_id`), to whom (`target_account`), with a small secret-free `detail`. Written inside the same transaction as the write it describes; append-only, never pruned, and there is deliberately no DELETE. Filters: action, actor_account_id, target_account_id, resource_type, from, to; paginated.
         */
        get: operations["listAdminActions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/onboardings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Onboarding requests, with their clashes (admin)
         * @description Every onboarding request in the selected states — open and expired by default, newest first — whole record each with the derived `status`, the `creator` (the operator account of an invite; null for a sign-up) and `conflicts`: the accounts and the other not-completed requests that already hold its name (accounts only), email or address. Clashes do not block anything: the first claim wins and the other fails with a 409. An expired request stays listed until the next new request deletes it. `last_sent_at`/`send_count` count the QUEUED sends; `last_delivered_at`/`last_send_error` say what the provider did with the last one (both null while it is in flight). Filters: status (multi-value), origin, send_failed; sort (created_at, expires_at, last_sent_at, name, email) and pagination.
         */
        get: operations["listOnboardings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/onboardings/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The onboarding request id. */
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Cancel an onboarding request that is not completed (admin)
         * @description Deletes the request (a mistaken invite, a suspicious sign-up); its links stop working. Audited as onboarding.delete with its name, email and address. A completed request is history: to stop the merchant, deactivate the account.
         */
        delete: operations["deleteOnboarding"];
        options?: never;
        head?: never;
        /**
         * Correct an onboarding request and send a new link (admin)
         * @description New values for a request that is not completed (an expired one is renewed). The resulting values are validated and checked like a creation — a delivering provider, the domain allowlist, and no account holding the email, address or name (explicit 409s) — then, under the row lock: the values are written, link_version + 1 (every earlier link is superseded), a renewed expiry, send_count + 1, audited as onboarding.update with the changed `fields` and their `previous` values, and a correction mail queued to the (new) email, saying what changed. Nothing goes to the old address.
         */
        patch: operations["updateOnboarding"];
        trace?: never;
    };
    "/admin/onboardings/{id}/send": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The onboarding request id. */
                id: string;
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resend a request's link: the invite again, or a reminder for a sign-up (admin)
         * @description No body. The same values, a new link: checked like a creation (provider, domain, no account holding the email, address or name — correct the request first on a 409), then link_version + 1, renewed expiry, send_count + 1, the last send's outcome cleared, audited as onboarding.send, and the mail queued: `invite` for an operator request, `solicit` (a reminder) for a sign-up. Also the way to retry a failed send.
         */
        post: operations["sendOnboarding"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/blockchains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every configured blockchain (admin)
         * @description Every chain this environment knows about, out-of-service ones included. This is NOT the public GET /blockchains with more columns: that endpoint answers "what can I pay with" and lists only active chains carrying an active token, so it filters away exactly the rows an operator opens this page to see. Unpaginated — bounded configuration, not a ledger. Scoped to the environment's network class, so a testnet environment never lists mainnet chains. Admin only. Full entity.
         */
        get: operations["listAdminBlockchains"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/tokens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every configured token (admin)
         * @description Every token this environment knows about, including those on chains that are not in service. The public GET /tokens is already the historical catalogue (a retired token stays resolvable) but stops at ACTIVE chains. Unpaginated. Admin only. Full entity.
         */
        get: operations["listAdminTokens"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every non-archived RAIL0 deployment (admin)
         * @description Every non-archived RAIL0 deployment known to this environment. Read with /admin/blockchains it answers what a configured chain still needs before it can serve: a chain with no deployment here cannot take a payment. Archived deployments are excluded — nothing may reference one again. Unpaginated. Admin only. Full entity.
         */
        get: operations["listAdminContracts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payout_destinations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the account's payout destinations */
        get: operations["listPayoutDestinations"];
        put?: never;
        /** Register a payout destination for the session's wallet */
        post: operations["createPayoutDestination"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payout_destinations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        /** Read a payout destination */
        get: operations["getPayoutDestination"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update a payout destination (label, reserve, minimum, enabled)
         * @description `active: false` disables the destination. Its pending payout, if any, is settled first: an unsigned one is marked `failed` with `cancelled`; a signed one (its transaction may still be mined) refuses the switch-off with 409 `payout_already_signed` — resend it or wait for it to settle, then disable. `active: true` restores the verification it had. Only the destination's own wallet may edit or re-enable it; any wallet of the account may disable it (`active: false` alone). A deactivated account is read-only: every change, disabling included, is 403 `account_deactivated`. Every change is recorded in the audit trail (GET /payout_destinations/{id}/events).
         */
        patch: operations["updatePayoutDestination"];
        trace?: never;
    };
    "/payout_destinations/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm the proof transfer was credited: marks the destination verified
         * @description The merchant's attestation that the venue credited the proof transfer, recorded with who and when. Requires the proof to be `confirmed` on-chain first.
         */
        post: operations["confirmPayoutDestination"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payout_destinations/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * A payout destination's audit trail, newest first
         * @description The destination's own events AND those of every payout made to it (see PayoutEvent), newest first. Same visibility as GET /payout_destinations/{id}: every wallet of the account. Offset pages like GET /payouts (`page`, `per_page` default 25 capped at 100; x-total-count / x-total-pages / x-page / x-per-page and a Link header).
         */
        get: operations["listPayoutDestinationEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the account's payouts
         * @description The payout history, paged exactly like GET /payments: offset pages (`page`, `per_page` default 25 capped at 100, with x-total-count / x-total-pages / x-page / x-per-page and a Link header) or cursor pages (`after`, x-next-cursor, no total). Newest first by default. `status` takes one value, a comma-separated list or the repeated `status[]=` form; `created_from` / `created_to` are inclusive. A `destination_id` / `wallet_id` that is not a UUID answers 404.
         */
        get: operations["listPayouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a transfer to a payout destination
         * @description Builds the unsigned ERC-20 transfer (one balance read, one fee/nonce read). `proof` sends PAYOUT_PROOF_AMOUNT, raised to the destination's `min_amount` when that is higher; `payout` sends `amount` — a human decimal, or `all` for the balance minus the refund reserve. An unverified destination may receive the proof amount at most. A payout below the destination's `min_amount` is refused with `payout_below_minimum` (for `all`: when what is available after the reserve is below it, but nothing available at all is `insufficient_balance`). One pending row per destination: a re-prepare replaces it while it is unsigned. Once a signed transaction is stored for it (see submit), a re-prepare is refused with 409 `payout_already_signed`: that transaction may still be mined, so it is resent (POST /payouts/{id}/resend), never replaced.
         */
        post: operations["preparePayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        /** Read a payout */
        get: operations["getPayout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        /**
         * A payout's audit trail, newest first
         * @description Every event of this payout (see PayoutEvent), newest first, paged like GET /payouts (offset pages).
         */
        get: operations["listPayoutEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit the signed transfer; the gateway broadcasts it
         * @description The signed payload must be signed by the wallet and match the prepared transaction (target, calldata, value, chain). The signature and its hash (keccak of the raw bytes, computed by the gateway) are stored BEFORE the broadcast, so from here on `signed` is true and `transaction_hash` is set, whatever the node answers. Broadcast is synchronous. A node answering `already known`, or `nonce too low` while a node has this very hash, counts as broadcast (202). Any other refusal leaves the row `pending` with its signature and hash, and the 502 carries the node's reason: retry with POST /payouts/{id}/resend (or submit the same bytes again). A signed row is also settled by Recovery from its hash if it is mined anyway. Submitting DIFFERENT bytes for a row that already holds a signature is refused (409).
         */
        post: operations["submitPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-broadcast the stored signed transfer
         * @description No body. Re-sends the signed transaction stored by a submit whose broadcast was refused or went unanswered: the same bytes, so the same nonce and hash — it can be mined once at most. Same rules as submit's broadcast: `already known`, or `nonce too low` while a node has this hash, count as broadcast; any other refusal is a 502 with the node's reason and the row stays `pending`.
         */
        post: operations["resendPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an unsigned pending payout
         * @description No body. A `pending` payout the wallet has not signed becomes `failed` with `error_code` `cancelled` and fires `payouts.failed`; the destination is free for a new prepare. A signed one is refused: its transaction may still be mined. Resend it and let it settle, or replace it from the wallet with any transaction of the same nonce (Recovery then fails it `dropped`).
         */
        post: operations["cancelPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payouts/{id}/submitted": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record a wallet-broadcast transfer by hash
         * @description For a wallet that signs and sends in one step. A hash a node already has must be THIS transfer: sent by the wallet, to the token, moving this amount to this destination. One no node has seen yet is accepted; Recovery settles it from the receipt and confirms it only if the receipt carries this ERC-20 Transfer (else `failed` with `foreign_transfer`). For a payout whose signed transaction the gateway already stores, only that transaction's hash is accepted. A LATE hash is accepted on a payout that failed `submission_timeout` or `dropped` (a sped-up or replaced transaction, or the wallet's own broadcast surfacing after the TTL): same claim check and the same `payout_hash_in_use` rule; the payout goes back to `submitted` under the reported hash (its stored signature, `sender` and failure fields are cleared) and Recovery settles it from the receipt.
         */
        post: operations["reportPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description What still names a wallet's address: the payments and transactions an admin is shown before switching the wallet off. */
        WalletUsage: {
            /** Format: uuid */
            wallet_id?: string;
            address?: string;
            payments_as_payee?: number;
            payments_as_payer?: number;
            transactions_as_sender?: number;
        };
        /** @description A wallet's on-chain balances, one entry per chain. */
        WalletBalances: {
            /** Format: uuid */
            wallet_id?: string;
            address?: string;
            balances?: components["schemas"]["ChainBalance"][];
        };
        /** @description Balances on one chain. `native`/`tokens` are null when `error` is present; `error` is null on success. */
        ChainBalance: {
            chain_id?: number;
            network_type?: string;
            native?: components["schemas"]["AssetBalance"];
            tokens?: components["schemas"]["AssetBalance"][];
            error?: components["schemas"]["BalanceError"];
        };
        /** @description A single balance line — the native gas token or one ERC-20. */
        AssetBalance: {
            symbol?: string;
            /** @description Token contract address; null for the native balance. */
            address?: string | null;
            decimals?: number;
            /** @description Balance in base units (exact). */
            raw?: string;
            /** @description Human-decimal balance. */
            amount?: string;
        };
        /** @description Why a chain's balances couldn't be read. */
        BalanceError: {
            /** @enum {string} */
            code?: "rpc_unavailable" | "rpc_error" | "timeout" | "error";
            message?: string;
        };
        /** @description What an account still has in motion (GET /admin/accounts/{id}/exposure, and `exposure` on a 409 account_has_open_exposure). */
        AccountExposure: {
            payments: {
                /**
                 * @description Created or signed, not yet on chain, authorization window still open.
                 * @example 1
                 */
                in_flight: number;
                /**
                 * @description Buyer funds held by the RAIL0 contract (capturable_amount > 0).
                 * @example 2
                 */
                in_escrow: number;
                /**
                 * @description Open disputes.
                 * @example 0
                 */
                disputed: number;
                by_token: {
                    /** @example 5042002 */
                    chain_id: number | null;
                    /**
                     * @description Token address, lowercase.
                     * @example 0x3600000000000000000000000000000000000000
                     */
                    token: string;
                    /**
                     * @description null when the catalogue no longer knows the token.
                     * @example USDC
                     */
                    symbol: string | null;
                    /**
                     * @description Distinct payments contributing.
                     * @example 3
                     */
                    count: number;
                    /**
                     * @description Base units: in-flight amounts + escrow + disputed refundable balances.
                     * @example 125500000
                     */
                    amount: string;
                    /**
                     * @description Human decimals; the base units when the token is unknown.
                     * @example 125.5
                     */
                    amount_formatted: string;
                }[];
            };
            payouts: {
                /** @example 0 */
                pending: number;
                /** @example 1 */
                submitted: number;
            };
            /**
             * @description true when every count is zero.
             * @example false
             */
            empty: boolean;
        };
        /** @description The 409 account_has_open_exposure: the error envelope plus the exposure summary. */
        AccountOpenExposureError: components["schemas"]["Error"] & {
            exposure: components["schemas"]["AccountExposure"];
        };
        /** @description The error envelope: exactly code (stable, the only field to branch on), title (short label) and detail (a sentence a UI can print verbatim). The legacy status/message/error aliases were removed in #252. */
        Error: {
            /** @example amount_exceeds_refundable */
            code: string;
            /** @example Amount above the refundable balance */
            title: string;
            /** @example The amount is higher than the balance the merchant still holds for this payment. */
            detail: string;
        } & {
            [key: string]: unknown;
        };
        /** @description Gateway liveness/readiness — public and token-blind: one body for every caller, and every field is public by nature (the versions are on-chain / on the root descriptor; the counts are derivable from the public catalog reads). Only the database gates the HTTP code (200 healthy, 503 when the DB is unreachable); the Sidekiq worker fleet never flips the code, since the API still serves synchronous requests when workers are down. `status` is the global signal: `ok` (all good), `degraded` (DB ok but the worker fleet not ok), `error` (DB down — the only 503). The fleet FIGURES (queue depth, worker count, Redis reachability) are operational internals and live on the operator-only GET /admin/health. */
        Health: {
            /** @enum {string} */
            status: "ok" | "degraded" | "error";
            /** @enum {string} */
            db: "ok" | "error";
            /** Format: date-time */
            timestamp: string;
            api_version: string;
            contract_version: string;
            active_chains: number;
            active_contracts: number;
        };
        /** @description GET /admin/rpc_health: per-chain RPC reachability as seen from the gateway's process. */
        AdminRpcHealth: {
            /**
             * @description The worst chain status.
             * @enum {string}
             */
            status?: "ok" | "degraded" | "error";
            /**
             * Format: date-time
             * @description When the probe ran; a cached answer keeps its original time.
             */
            checked_at?: string;
            chains?: components["schemas"]["AdminRpcHealthChain"][];
        };
        AdminRpcHealthChain: {
            chain_id?: number;
            name?: string;
            /** @enum {string} */
            finality_tag?: "safe" | "finalized" | "depth";
            /** @description At least one endpoint serves the chain. */
            ok?: boolean;
            /**
             * @description The first endpoint's status; null when none is configured.
             * @enum {string|null}
             */
            primary_status?: "ok" | "wrong_chain" | "error" | null;
            /**
             * @description ok: every endpoint up; degraded: some; error: none, or no endpoint configured.
             * @enum {string}
             */
            status?: "ok" | "degraded" | "error";
            endpoints?: components["schemas"]["AdminRpcHealthEndpoint"][];
        };
        AdminRpcHealthEndpoint: {
            /** @description The endpoint, as configured. */
            url?: string;
            ok?: boolean;
            /** @enum {string} */
            status?: "ok" | "wrong_chain" | "error";
            /** @description Short `Class: first line`; never an upstream body. */
            error?: string | null;
            /** @description What the node reported. */
            chain_id?: number | null;
            /** @description First round trip, handshake included. */
            latency_ms?: number | null;
            head?: number | null;
            /** @description The finality-tag block; null on depth chains or when the node refuses the tag. */
            tag_block?: number | null;
            tag_error?: string | null;
        };
        /** @description Operator diagnostics for GET /admin/health: one verdict plus a named check per standing failure condition, always 200 (a degraded system is the content, not an error — this is not a liveness probe). Every figure is computed on request from state the gateway already keeps; nothing here is a counter anyone increments. */
        AdminHealth: {
            /**
             * @description The worst of the checks. Exists so "is anything wrong" can be read without knowing which checks there are, nor which will be added later.
             * @enum {string}
             */
            status: "ok" | "degraded" | "error";
            checks: {
                /** @description Whether the Sidekiq fleet is reachable and processing. Jobs queue silently when it is not, so nothing fails — it just stops happening. */
                workers: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    /** @description The fleet detail this endpoint has always returned. */
                    fleet?: {
                        /**
                         * @description ok = Redis up and >=1 live worker; degraded = Redis up but no live worker; down = Redis unreachable.
                         * @enum {string}
                         */
                        status?: "ok" | "degraded" | "down";
                        /** @enum {string} */
                        redis?: "ok" | "error";
                        /** @description Live Sidekiq process count (present only when Redis is up). */
                        processes?: number;
                        /** @description Total enqueued jobs across queues (present only when Redis is up). */
                        enqueued?: number;
                    };
                };
                /** @description Transactions broadcast longer ago than SUBMITTED_TX_TTL that the chain HAS and no confirmation has arrived for. Above zero means the indexer has stopped reporting — not that the payments failed. The Recovery leaves these rows alone rather than expiring them, so this is the gateway's only standing signal that indexing has gone blind. */
                indexer_intake: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    unconfirmed?: number;
                    /**
                     * Format: date-time
                     * @description When the oldest such transaction was broadcast, or null when there are none.
                     */
                    oldest_broadcast?: string | null;
                };
                /** @description Indexer callbacks the gateway accepted but could not apply (not_found, chain_mismatch, payment_mismatch, operation_mismatch, unapplicable, impossible_balances). Each is an on-chain event the mirror never recorded. Excludes balance_divergence and external_operation, each its own check — one counter mixing "the numbers disagreed" with "we could not apply it at all" is unreadable. */
                sync_callbacks: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    unapplied?: number;
                    /**
                     * Format: date-time
                     * @description When the most recent one landed, or null.
                     */
                    latest_at?: string | null;
                };
                /** @description Confirms whose reported balances disagreed with the gateway's own recomputation. The indexer's numbers are applied anyway — this is the second witness over them. */
                balances: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    /** @description All-time count; the table is never pruned, so this is history — context, not the alert. */
                    total?: number;
                    last_24h?: number;
                    /**
                     * Format: date-time
                     * @description When the most recent divergence landed, or null. The figure to act on: a monotonic total says nothing about now.
                     */
                    latest_at?: string | null;
                };
                /** @description On-chain operations on this gateway's payments that were sent to the contract directly (a buyer's dispute, a merchant capturing from their own wallet), recorded as sync_errors with reason external_operation. Not applied — the gateway mirrors only what it prepared — so each payment's state here is behind the chain and its merchant got no webhook. Same {total, last_24h, latest_at} figure as balances. */
                external_operations: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    /** @description All-time count; the table is never pruned, so this is history — context, not the alert. */
                    total?: number;
                    last_24h?: number;
                    /**
                     * Format: date-time
                     * @description When the most recent divergence landed, or null. The figure to act on: a monotonic total says nothing about now.
                     */
                    latest_at?: string | null;
                };
                /** @description Signed transactions the gateway holds but has not managed to broadcast, past two redrive cycles. Above zero means the Recovery's redrive itself is not landing. */
                broadcasts: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    awaiting?: number;
                    /**
                     * Format: date-time
                     * @description When the oldest stuck row was last touched, or null.
                     */
                    oldest_since?: string | null;
                };
                /** @description Subscriptions whose circuit breaker tripped after repeated delivery failures. Those merchants receive no events at all until it is reset. */
                webhooks: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    circuits_open?: number;
                    /**
                     * Format: date-time
                     * @description When the most recent circuit opened, or null.
                     */
                    latest_at?: string | null;
                };
                /** @description Active chains whose deployed contract is not the version this gateway signs for. Payer signatures do not verify there, because the EIP-712 domain is built from Rail0::VERSION globally. Until now this existed only as a boot-time log line, gone the moment it scrolled. */
                contracts: {
                    /**
                     * @description This check's own verdict; the top-level `status` is the worst of them.
                     * @enum {string}
                     */
                    status: "ok" | "degraded" | "error";
                    /** @description One sentence on what this check's figures MEAN. It ships in the response rather than living in the dashboard, so curl and the UI read the same explanation. */
                    describes: string;
                    /** @description Rail0::VERSION — the version every active contract must be on. */
                    expected?: string;
                    /** @description chain_id → the version actually deployed there. Empty when every active chain agrees. */
                    diverging?: {
                        [key: string]: string;
                    };
                };
            };
            /** Format: date-time */
            timestamp: string;
        };
        /** @description A single-use SIWE nonce to embed in the sign-in message. */
        Nonce: {
            /** @description The nonce value to place in the SIWE message's `Nonce:` field. */
            nonce: string;
            /**
             * Format: date-time
             * @description When the nonce expires and can no longer be used.
             */
            expires_at: string;
        };
        /** @description Issued after a successful SIWE verification. SIWE alone proves control of the address, so a token is issued even when the address is not registered to any account; in that case `account_id` and `name` are null (an account-less session, e.g. a buyer). Clients that require an account must treat a null `account_id` as not-allowed. A session whose account holds the operator grant additionally carries `admin: true` (the Session::Admin variant); a standard or account-less session has no admin/role field at all. */
        Session: {
            /** @description JWT bearer token. */
            token?: string;
            /** @description Resolved wallet address. */
            address?: string;
            /**
             * Format: uuid
             * @description The account owning the signed-in wallet, or null for an account-less (e.g. buyer) session.
             */
            account_id?: string | null;
            /** @description The account's human-readable name, or null for an account-less session. */
            name?: string | null;
            /** Format: date-time */
            expires_at?: string;
        };
        /** @description The RAIL0 deployment a NEW payment on this chain is opened against — what escrows the payer's funds, and which version of it. Nothing here is a disclosure: the address is on-chain, every payment response already carries it as `rail0_contract`, and the explorer shows its verified source. It is published so a client does not carry its own address-per-chain table and go quietly stale on the next rollout. Null only for a chain with no deployment, which cannot appear in this listing anyway. The operator's bookkeeping (start_block, active/archived) stays on /admin/contracts: it describes how this gateway and its indexer are run, not what a payer is signing into. */
        ChainContract: {
            address?: string;
            /** @description Semver of the deployed contract. Every active deployment agrees on the one the gateway targets. */
            version?: string;
            /** Format: date-time */
            deployed_at?: string;
        } | null;
        /** @description Public blockchain view. */
        Blockchain: {
            chain_id?: number;
            name?: string;
            /**
             * @description The chain's short name, the same for its testnet and its mainnet (`arc` is Arc Testnet on a testnet gateway, Arc on production): a gateway serves one network class, so a client may name the chain by slug instead of chain_id. Lowercase, unique per network class.
             * @example arc
             */
            slug: string;
            native_symbol?: string;
            network_type?: string;
            explorer_url?: string;
            /** @description Public, keyless RPC endpoints published for clients that read the chain directly (a balance, a receipt), in failover order: try them in turn. Not necessarily the endpoints the gateway itself uses. */
            public_rpc_urls: string[];
            /** @description Confirmations this gateway waits for before treating a transaction as settled. The FALLBACK rule: where the chain serves a finality tag (see finality_tag) that tag governs instead, so a client showing this number on such a chain is describing a rule that is not in force. */
            required_confirmations?: number;
            /** @description The block tag the chain calls settled (`safe`, `finalized`), when it serves one — and what the gateway actually gates on. Null where the chain serves none, in which case required_confirmations is counted. */
            finality_tag?: string | null;
            contract?: components["schemas"]["ChainContract"];
            settlement?: components["schemas"]["BlockchainSettlement"];
        };
        /** @description How long an operation on this chain has taken to settle ON THIS GATEWAY: percentiles of broadcast (`submitted_at`) to confirmation (`confirmed_at`) over the confirmed transactions of the trailing `window_days`. End-to-end — the chain's finality lag plus the gateway/indexer pipeline — so it is what a client actually waits for, not the chain's finality. A measurement, not a guarantee: use it as a wait-deadline hint (e.g. a small multiple of `p90_seconds`) and keep a fixed fallback for when it is null. Deliberately a long-window capacity figure, not a live alarm (#289). Always present; the percentiles are null when `sample_size` is below the gateway's minimum (20). */
        BlockchainSettlement: {
            /** @description Median settlement time, whole seconds rounded up. Null below the minimum sample. */
            p50_seconds?: number | null;
            /** @description 90th-percentile settlement time, whole seconds rounded up — the figure to size a deadline from. Null below the minimum sample. */
            p90_seconds?: number | null;
            /** @description Confirmed transactions measured in the window (0 when none). */
            sample_size?: number;
            /** @description The trailing window the figures cover, in days. */
            window_days?: number;
        };
        /** @description Public accepted-token view. The listing is not implicitly active-only (a payment references its token address forever, so a retired token must stay resolvable), so `active` tells a usable token from a retired one. */
        Token: {
            chain_id?: number;
            symbol?: string;
            address?: string;
            decimals?: number;
            /** @description False for a retired token: still resolvable for historical payments, but not usable for a new one. */
            active: boolean;
        };
        /** @description Public-safe wallet view (the reduced set a buyer needs to discover a merchant's payment methods). */
        Wallet: {
            /** Format: uuid */
            id?: string;
            address?: string;
            label?: string | null;
            active?: boolean;
            /**
             * @description Who switched the wallet off: `owner` (a session signed in with this wallet) or `operator` (an admin session). Null while active, and on a switch-off that predates the record — treated as `operator`. A wallet an operator switched off can be switched back on only by an operator (403 `wallet_deactivated_by_operator`). Always null on GET /payment_methods, which serves active wallets only.
             * @enum {string|null}
             */
            deactivated_by?: "owner" | "operator" | null;
        };
        /** @description A wallet's token holding as nested under its wallet (GET /accounts/:id/wallets): the token plus this wallet's per-token flags, without re-nesting the wallet. */
        WalletTokenHolding: {
            /**
             * Format: uuid
             * @description The token's UUID — the handle for PATCH/DELETE /accounts/{account_id}/wallets/{id}/tokens/{token_id}.
             */
            token_id?: string;
            token?: components["schemas"]["Token"];
            active?: boolean;
            default?: boolean;
        };
        /** @description A wallet with its token holdings nested inline. `tokens` is empty when the wallet has none — the wallet is still returned, never omitted. */
        WalletWithTokens: {
            /** Format: uuid */
            id?: string;
            address?: string;
            label?: string | null;
            active?: boolean;
            /**
             * @description Who switched the wallet off: `owner` (a session signed in with this wallet) or `operator` (an admin session). Null while active, and on a switch-off that predates the record — treated as `operator`. A wallet an operator switched off can be switched back on only by an operator (403 `wallet_deactivated_by_operator`). Always null on GET /payment_methods, which serves active wallets only.
             * @enum {string|null}
             */
            deactivated_by?: "owner" | "operator" | null;
            tokens?: components["schemas"]["WalletTokenHolding"][];
        };
        /** @description Base persisted payment fields, plus the `chain_id` of the payment's deployment, its token's `decimals`, and whether a transaction is `in_flight`. */
        Payment: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            contract_id?: string;
            /** @description EVM chain id of the payment's deployment. Present on the list view too: `amount` is in base units, and the token's `decimals` can only be resolved from `token` together with its chain. */
            chain_id?: number;
            /** @description Protocol-level identifier (66-char hex). */
            rail0_id?: string;
            /**
             * @description Lifecycle state. Deliberately a HAPPY-PATH label, not a ledger: a partial operation does NOT move it, so a payment captured 100 and refunded 40 still reads `captured`, and a full refund that leaves uncaptured escrow does too. `capturable_amount` / `refundable_amount` are the authoritative residuals — reconcile on those, not on this. `partially_refunded` is retained for historical rows only and is no longer produced.
             * @enum {string}
             */
            status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded";
            /** @enum {string} */
            mode?: "authorize" | "charge";
            amount?: string;
            /** @description Mirrors on-chain capturableAmount (escrow still held); base units. */
            capturable_amount?: string;
            /** @description Mirrors on-chain refundableAmount (held by payee, still refundable); base units. */
            refundable_amount?: string;
            config_hash?: string;
            payer?: string;
            payee?: string;
            token?: string;
            /** @description Decimals of the payment's token: divide `amount`, `capturable_amount` and `refundable_amount` (base units) by 10^decimals to render them, with no GET /tokens join on `token` + `chain_id`. Resolved from the gateway's in-memory chain catalogue, retired tokens and archived contract versions included. Null only when the gateway cannot resolve the token (a contract it has not loaded, a token deleted outright) — fall back to GET /tokens then. */
            decimals?: number | null;
            authorization_expiry?: number;
            refund_expiry?: number;
            /** @description True exactly inside the stranded-escrow window (#233): a partial capture has permanently ruled void out, and release only opens at authorization_expiry — so no verb can return the buyer's uncaptured escrow until then. Mirrors RAIL0.sol; the gateway names the window, it cannot shorten it. */
            escrow_stranded?: boolean;
            /**
             * Format: date-time
             * @description When the stranded escrow becomes returnable (release opens) — the authorization expiry as ISO-8601. Null whenever nothing is stranded, so presence alone is the signal.
             */
            escrow_returnable_at?: string | null;
            /** @description True while an open dispute exists. */
            disputed?: boolean;
            /** @description True while one of the payment's transactions is on its way to the chain and not yet settled: status `submitting`, `submitted`, or `pending` holding its signed transaction (the `redrivable` rows — signed and handed over, broadcast not yet sent). A `pending` row still awaiting its signature (an unfinished prepare) does not count, nor do `confirmed`/`failed`. While true the mirrored balances are about to move, so a client should disable further actions on the payment. Carried by list rows too, which embed no transactions; computed for a whole page in one query. */
            in_flight?: boolean;
            /** @description Decoded reason of the last failed on-chain attempt; null once the payment makes forward progress. Non-null means the latest attempt failed. */
            last_error_code?: string | null;
            /** @description Human-readable form of last_error_code. */
            last_error_message?: string | null;
            description?: string | null;
            /** @description This payment's identifier in the merchant's own system; set at create, correctable by the payee. */
            reference?: string | null;
            /** @description The system the reference comes from, a lowercase slug (e.g. commercelayer). */
            reference_origin?: string | null;
            /** @description The payee's internal note (PATCH /payments/{id}). Present only when the session is the payment's PAYEE, and on the operator's Full view; absent for the payer. */
            merchant_note?: string | null;
            metadata?: {
                [key: string]: unknown;
            } | null;
            /**
             * Format: date-time
             * @description When the payer signature was stored (null while unsigned).
             */
            signed_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /** @description Buyer-driven, signal-only dispute lifecycle (no fund effect). */
        Dispute: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            payment_id?: string;
            /** @enum {string} */
            status?: "open" | "closed";
            /** @description On-chain bytes32 reason the dispute was opened with (hex); the all-zero word when no reason was given; kept verbatim even when it is outside the dispute-reason dictionary. */
            reason?: string;
            /** @description The DisputeOpenReason code `reason` reads as; null when no reason was given (the zero bytes32) or when the bytes32 is not in the dictionary (a direct contract call). */
            reason_code?: components["schemas"]["DisputeOpenReason"] | null;
            /** @description English description of `reason_code`; "No reason given" when `reason` is the zero bytes32; "Unrecognised reason" when it is a non-zero bytes32 outside the dictionary. */
            reason_description?: string;
            opened_block?: number | null;
            /** Format: date-time */
            opened_at?: string;
            /** @enum {string|null} */
            closed_by?: "payer" | "payee" | null;
            /** @description On-chain bytes32 close reason (hex); the all-zero word when closed with no reason; null while the dispute is open. */
            close_reason?: string | null;
            /** @description The code `close_reason` reads as: a DisputeCloseReason, or the system DisputeSystemCloseReason `full_refund` when a full refund auto-closed the dispute. Null while open, when closed with no reason (the zero bytes32), or when the bytes32 is not in the dictionary. */
            close_reason_code?: components["schemas"]["DisputeCloseReason"] | components["schemas"]["DisputeSystemCloseReason"] | null;
            /** @description English description of `close_reason_code`; "No reason given" when `close_reason` is the zero bytes32; "Unrecognised reason" when it is a non-zero bytes32 outside the dictionary; null while open. */
            close_reason_description?: string | null;
            closed_block?: number | null;
            /** Format: date-time */
            closed_at?: string | null;
        };
        DisputeDetail: components["schemas"]["Dispute"] & {
            payment?: components["schemas"]["Payment"];
        };
        /** @description What the callback did with a test event (POST /webhooks/{id}/test). */
        WebhookTestResult: {
            /** @description The endpoint answered 2xx. */
            delivered?: boolean;
            /** @description The HTTP status it answered; null when no response came (see error_reason). */
            response_code?: string | null;
            /** @description Up to 1000 printable characters of its response body. */
            response_message?: string | null;
            /** @description Why no response came: a refused address, a TLS or connection error, the deadline. */
            error_reason?: string | null;
            /** @description How long the attempt took. */
            duration_ms?: number;
        };
        PaymentDetail: components["schemas"]["Payment"] & {
            /** @description Deployed rail0 contract address. */
            rail0_contract?: string;
            transactions?: components["schemas"]["Transaction"][];
            /** @description EIP-3009 payload the payer must sign; present only when the payment is unsigned (may be null on transient RPC failure). */
            signing_payload?: unknown;
        };
        Transaction: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            payment_id?: string;
            /**
             * @description Which on-chain call this row attempts. A SUPERSET of the `{operation}` path enum: `dispute` and `close_dispute` have their own hand-written routes rather than living under the generic namespace, but they mint transaction rows like any other operation, so a generated client must be able to represent them.
             * @enum {string}
             */
            operation?: "authorize" | "charge" | "capture" | "void" | "release" | "refund" | "dispute" | "close_dispute";
            /** @enum {string} */
            status?: "pending" | "submitting" | "submitted" | "confirmed" | "failed";
            /** @description True when this transaction's broadcast can be re-enqueued: it is `pending` and the gateway holds its signed transaction, i.e. a send that was prepared and signed but never reached the chain. The same predicate `POST /payments/{id}/transactions/{transaction_id}/redrive` guards on, so a client can offer the action exactly when it will succeed instead of on a 422. False on a `pending` row that holds no signed transaction - there the next step is submitting the signature, not a redrive. */
            redrivable?: boolean;
            /** @description Decoded failure code, null unless `status` is "failed". Same catalogue as an error body's `code`: a RAIL0 custom error (`not_payee`), a token-level revert (`insufficient_token_balance`, `invalid_token_signature`, `authorization_already_used`), a Solidity panic, or a rejection that stopped the broadcast before the chain saw it (`insufficient_gas_funds`, `nonce_too_low`). */
            error_code?: string | null;
            /** @description Short label for `error_code`; null unless failed. */
            error_title?: string | null;
            /** @description Sentence explaining the failure; null unless failed. Carries the chain's own words when the revert was not one the gateway recognises. */
            error_detail?: string | null;
            unsigned_transaction?: string | null;
            transaction_hash?: string | null;
            /** @description The address that SIGNED the submitted transaction, recovered from the signature by the gateway at submit — a fact, not a client claim. Null where the gateway held no signature to recover from (a report-by-hash submit, where the wallet broadcast it itself) or where nothing has been submitted yet. This is what makes `release` gas attributable: that operation is payer-OR-payee, so whose cost it is depends on who signed. */
            sender?: string | null;
            /** @description Amount in token BASE units. On capture and refund it is the amount the caller asked for. On void and release it is PROVISIONAL — those operations carry no amount and move the whole uncaptured escrow, so this is the capturable residual as of prepare, re-sealed with the exact on-chain amount when the indexer confirms. */
            amount?: string | null;
            block_number?: number | null;
            /** @description Gas units used, mirrored from the indexer on confirm. */
            gas_used?: string | null;
            /** @description Gas limit, mirrored from the indexer on confirm. */
            gas_limit?: string | null;
            /** @description Effective gas price in wei, mirrored from the indexer on confirm. */
            effective_gas_price?: string | null;
            /** @description Block base fee per gas in wei, mirrored from the indexer on confirm. */
            base_fee_per_gas?: string | null;
            /** @description Total gas cost in wei (gas_used * effective_gas_price); derived, null until confirmed. */
            gas_cost?: string | null;
            /** Format: date-time */
            pending_at?: string | null;
            /** Format: date-time */
            submitted_at?: string | null;
            /** Format: date-time */
            confirmed_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        AdminPayment: components["schemas"]["Payment"] & {
            signature?: string | null;
            last_error_code?: string | null;
            last_error_message?: string | null;
        };
        AdminTransaction: components["schemas"]["Transaction"] & {
            signed_transaction?: string | null;
            error_reason?: string | null;
        };
        AdminBlockchain: components["schemas"]["Blockchain"] & {
            /** Format: uuid */
            id?: string;
            /** @description Public providers, tried in serial. The first one wins, so its health decides the chain's. */
            rpc_urls?: string[];
            /** @description False for a chain that is configured but not in service. Such a chain never appears in the public GET /blockchains. */
            active?: boolean;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        AdminToken: components["schemas"]["Token"] & {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            blockchain_id?: string;
            /** @description The token's own name() — NOT interchangeable between chains. USDC answers "USDC" on some and "USD Coin" on others, and the wrong one yields a payload whose signature the token rejects only at broadcast. */
            eip712_name?: string;
            eip712_version?: string;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /** @description Full RAIL0 deployment row (admin surfaces only). Read alongside AdminBlockchain: a chain with no row here cannot take a payment, which is what keeps it out of service. */
        AdminContract: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            blockchain_id?: string;
            address?: string;
            /** @description Semver, and every ACTIVE deployment must agree on the one the code targets. */
            version?: string;
            /** Format: date-time */
            deployed_at?: string;
            /** @description Where the indexer starts. Null means the deployment block. */
            start_block?: number | null;
            /** @description The single deployment new payments are opened against, at most one per chain. */
            active?: boolean;
            /** @description Always false here: the listing excludes archived deployments. */
            archived?: boolean;
            /** Format: date-time */
            archived_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /**
         * @description Payment event a subscription can receive. Every delivery POSTs the same JSON body — `{id, emitted_at, topic, payment: {id, rail0_id, status, mode, amount, payer, payee, token, chain_id, capturable_amount, authorization_expiry, last_error_code, last_error_message, metadata, reference, reference_origin}, transaction}` — with `transaction` null for events that involve none (`payments.created`, `payments.signed`, `payments.authorization_expiring`, `payments.expired`). The payment fields are read at delivery time. `payments.authorization_expiring` is the advance notice of `payments.expired`: sent once per payment, `AUTHORIZATION_EXPIRING_NOTICE` seconds (default 86400) before `authorization_expiry`, for a payment that is still capturable (`authorized`, `partially_captured` or `partially_refunded`) with `capturable_amount` above zero. A payment whose authorization window is shorter than the notice is warned once, as soon as it qualifies. The time left is `authorization_expiry` minus `emitted_at`; capture before then or the escrow returns to the payer via release. `payments.expired` follows if the authorization lapses uncaptured. The payout topics carry the same envelope (`id`, `emitted_at`, `topic`) with the subject under its own key instead of `payment`/`transaction`: `payouts.confirmed` and `payouts.failed` POST `{id, emitted_at, topic, payout}` (`payout` = the Payout schema, as GET /payouts/{id} returns it; a failure's reason is its `error_code`: `reverted`, `foreign_transfer`, `dropped`, `submission_timeout`, `cancelled`), sent when Recovery settles a payout or when it is cancelled (POST /payouts/{id}/cancel, or disabling its destination); `payout_destinations.verified` POSTs `{id, emitted_at, topic, payout_destination}` (the PayoutDestination schema) when POST /payout_destinations/{id}/confirm verifies it. A payout failed `submission_timeout` or `dropped` and later revived by a late hash can be followed by `payouts.confirmed`. Like payment events, nothing is sent once the wallet or the account is deactivated.
         * @enum {string}
         */
        WebhookTopic: "payments.created" | "payments.signed" | "payments.authorized" | "payments.charged" | "payments.captured" | "payments.voided" | "payments.released" | "payments.refunded" | "payments.authorization_expiring" | "payments.expired" | "payments.failed" | "payments.disputed" | "payments.dispute_closed" | "payouts.confirmed" | "payouts.failed" | "payout_destinations.verified";
        /** @description The account's own profile as the holder reads it (GET) and as a PATCH returns it — id, name, email, priority_tip, payment windows, timestamps. Deliberately no admin/role field: the operator grant lives in a separate table, so a standard account's profile carries no trace of that axis. An ADMIN reading any account gets the whole record plus `admin` instead, which is a different shape and not this one. */
        Account: {
            /** Format: uuid */
            id?: string;
            name?: string;
            email?: string | null;
            /** @description Whether the merchant's own transactions tip the network's suggested priority fee (true, the default) or the chain's minimum tip (false: 0 on most chains, 25 gwei on Polygon PoS/Amoy). The buyer's dispute/close_dispute never read it. */
            priority_tip?: boolean;
            /**
             * @description Seconds an authorization of the account's new payments stays capturable after the payment is created: the account's own value, or the gateway default (AUTHORIZATION_TTL).
             * @example 604800
             */
            authorization_ttl?: number;
            /**
             * @description Seconds the account's new payments stay refundable, and open to a dispute, after they are created: the account's own value, or the gateway default (REFUND_TTL).
             * @example 2592000
             */
            refund_ttl?: number;
            payment_windows?: components["schemas"]["PaymentWindows"];
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /** @description How the account's windows are set and what a new value must meet: per window, whether it is the account's own (custom) or the default, the default, and the bounds. The refund window has no floor of its own: the pair must keep refund_ttl - authorization_ttl >= min_refund_window. */
        PaymentWindows: {
            authorization_ttl?: {
                custom?: boolean;
                /** @example 604800 */
                default?: number;
                /** @example 3600 */
                min?: number;
                /** @example 2592000 */
                max?: number;
            };
            refund_ttl?: {
                custom?: boolean;
                /** @example 2592000 */
                default?: number;
                /** @example 15552000 */
                max?: number;
            };
            /** @example 86400 */
            min_refund_window?: number;
        };
        /** @description The whole account record, as an operator reads it (Full entity: GET /accounts, and GET/PATCH /accounts/{account_id} for an admin session): every column plus `admin` and the derived `status`. */
        AccountFull: {
            /** Format: uuid */
            id?: string;
            name?: string;
            /** @description Stored lowercase. */
            email?: string;
            /** @description The operator's switch. false = deactivated. */
            active?: boolean;
            /** @description The merchant's fee setting (see Account.priority_tip). */
            priority_tip?: boolean;
            /**
             * @description Seconds an authorization of the account's new payments stays capturable after the payment is created: the account's own value, or the gateway default (AUTHORIZATION_TTL).
             * @example 604800
             */
            authorization_ttl?: number;
            /**
             * @description Seconds the account's new payments stay refundable, and open to a dispute, after they are created: the account's own value, or the gateway default (REFUND_TTL).
             * @example 2592000
             */
            refund_ttl?: number;
            payment_windows?: components["schemas"]["PaymentWindows"];
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
            /** @description Whether the account holds the operator grant (a row in administrators). */
            admin?: boolean;
            /**
             * @description One-word reading of active: active, or deactivated (switched off by an operator).
             * @enum {string}
             */
            status?: "active" | "deactivated";
        };
        /** @description An onboarding request (Full entity): every column plus the derived `status` and the `creator`. Never a token or a link: the token is not stored. */
        Onboarding: {
            /**
             * Format: uuid
             * @description Also the id of the account the claim creates.
             */
            id?: string;
            /** @enum {string} */
            origin?: "operator" | "signup";
            name?: string;
            /** @description Lowercase. */
            email?: string;
            /** @description Lowercase 0x + 40 hex. */
            address?: string;
            /**
             * Format: uuid
             * @description The operator account of an invite; null for a sign-up.
             */
            created_by?: string | null;
            /** @description The version of the last link minted; a link for any lower one answers onboarding_link_superseded. */
            link_version?: number;
            /**
             * Format: date-time
             * @description When the last send was queued.
             */
            last_sent_at?: string;
            /** @description Sends queued in all (0 for a request migrated from a pending account, which has no link in the current format yet). */
            send_count?: number;
            /**
             * Format: date-time
             * @description When the provider accepted the last send.
             */
            last_delivered_at?: string | null;
            /** @description A short fixed code for why the last send failed (provider_rejected, timeout, email_domain_not_allowed, …); null when it was delivered or is in flight. */
            last_send_error?: string | null;
            /**
             * Format: date-time
             * @description When the last link, and the open request, expire.
             */
            expires_at?: string;
            /**
             * Format: date-time
             * @description When the claim created the account.
             */
            completed_at?: string | null;
            /** @description The terms version accepted at the claim. */
            terms_version?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
            /** @enum {string} */
            status?: "open" | "expired" | "completed";
            /** @description The operator who created an invite; null for a sign-up. */
            creator?: components["schemas"]["Account"] | null;
        };
        /** @description A row of GET /admin/onboardings: the request and its clashes. */
        OnboardingListed: components["schemas"]["Onboarding"] & {
            conflicts?: components["schemas"]["OnboardingConflict"][];
        };
        /** @description A clash of a request with an account (the value already belongs to it) or with another request not yet completed. */
        OnboardingConflict: {
            /** @enum {string} */
            field: "name" | "email" | "address";
            /** @enum {string} */
            with: "account" | "onboarding";
            /**
             * Format: uuid
             * @description The account's or the other request's id.
             */
            id: string;
        };
        /** @description The mail queued for the request — never its link, which exists only in the mail. */
        QueuedEmail: {
            /** @enum {string} */
            kind: "invite" | "solicit" | "correction";
            to: string;
            /** @enum {boolean} */
            queued: true;
        };
        /** @description An operator's create, reuse or correction. */
        OnboardingOutcome: {
            onboarding: components["schemas"]["Onboarding"];
            conflicts: components["schemas"]["OnboardingConflict"][];
            email: components["schemas"]["QueuedEmail"];
        };
        /** @description A resend or reminder. */
        OnboardingSent: {
            onboarding: components["schemas"]["Onboarding"];
            email: components["schemas"]["QueuedEmail"];
        };
        /** @description The mail as it would have been sent, rendered by the gateway's template with `<claim link generated after the request is created>` in place of the link. */
        EmailPreview: {
            to: string;
            subject: string;
            text: string;
        };
        /** @description An operator grant with the people named. */
        AdministratorFull: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            account_id?: string;
            /** Format: uuid */
            granted_by?: string | null;
            note?: string | null;
            /** Format: date-time */
            expires_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** @description The account's public shape (id, name, email, priority_tip, timestamps). */
            account?: Record<string, never>;
            /** @description The account's public shape (id, name, email, priority_tip, timestamps). */
            grantor?: Record<string, never> | null;
        };
        WebhookOperator: components["schemas"]["Webhook"] & {
            /** Format: uuid */
            account_id?: string;
            /** Format: date-time */
            disabled_at?: string | null;
            /** Format: date-time */
            rotated_at?: string | null;
            /** Format: date-time */
            last_attempt_at?: string | null;
            /** @enum {string|null} */
            last_attempt_status?: "pending" | "delivered" | "failed" | null;
            /** @description The account's public shape (id, name, email, priority_tip, timestamps). */
            account?: Record<string, never>;
        };
        /** @description One row of the operator audit log. */
        AdminAction: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            actor_account_id?: string | null;
            actor_address?: string | null;
            /** @example administrator.grant */
            action?: string;
            /** @example administrator */
            resource_type?: string;
            resource_id?: string | null;
            /** Format: uuid */
            target_account_id?: string | null;
            detail?: {
                [key: string]: unknown;
            } | null;
            /** Format: date-time */
            created_at?: string;
            /** @description The account's public shape (id, name, email, priority_tip, timestamps). */
            actor?: Record<string, never> | null;
            /** @description The account's public shape (id, name, email, priority_tip, timestamps). */
            target_account?: Record<string, never> | null;
        };
        TransactionOperator: components["schemas"]["Transaction"] & {
            redrivable?: boolean;
            error_reason?: string | null;
            payment?: {
                /** Format: uuid */
                id?: string;
                rail0_id?: string;
                chain_id?: number;
                status?: string;
                mode?: string;
                amount?: string;
                decimals?: number | null;
                payer?: string;
                payee?: string;
                token?: string;
            };
        };
        /** @description One reported configuration value. */
        ConfigSetting: {
            /** @description The effective value (number, boolean, string, list or map). */
            value?: unknown;
            /** @description The environment variable that sets it; null for a constant. */
            env?: string | null;
            /** @description Whether that variable is set in this process. */
            overridden?: boolean;
            /** @description Plain-text explanation of the entry: what it controls, which part of the gateway reads it and the effect of raising or lowering it, and its unit (from config/config_descriptions.yml). Every entry has one; older gateways omit the field. */
            description?: string;
        };
        /** @description GET /admin/config: the effective configuration, grouped. Every leaf is a ConfigSetting. */
        ConfigReport: {
            payments?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            recovery?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            retention?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            webhooks?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            settlement?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            rate_limit?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            /** @description domains (SIWE_DOMAIN), accepted_chain_ids (1 plus the ids of the active catalog chains: the chainId values a login may carry) and nonce_ttl. */
            siwe?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            /** @description environment (RAIL0_ENVIRONMENT, default RACK_ENV: the scope every issued token is bound to), jwt_ttl and jwt_audience: the session token's lifetime (a constant) and audience (`rail0-gateway:<environment>`). */
            session?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            fees?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            rpc?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            onboarding?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            email?: {
                [key: string]: components["schemas"]["ConfigSetting"];
            };
            /** Format: date-time */
            generated_at?: string;
        };
        DisputeOperator: components["schemas"]["Dispute"] & {
            payment?: {
                /** Format: uuid */
                id?: string;
                rail0_id?: string;
                chain_id?: number;
                status?: string;
                mode?: string;
                amount?: string;
                decimals?: number | null;
                payer?: string;
                payee?: string;
                token?: string;
            };
        };
        EventCallbackOperator: components["schemas"]["EventCallback"] & {
            webhook?: components["schemas"]["WebhookOperator"];
        };
        /** @description GET /admin/catalog: the snapshot against the database, per table. */
        CatalogDiff: {
            /** Format: date-time */
            loaded_at?: string;
            /** Format: date-time */
            checked_at?: string;
            stale?: boolean;
            pending?: number;
            blockchains?: {
                added?: Record<string, never>[];
                removed?: Record<string, never>[];
                changed?: {
                    fields?: {
                        [key: string]: {
                            from?: unknown;
                            to?: unknown;
                        };
                    };
                }[];
            };
            tokens?: {
                added?: Record<string, never>[];
                removed?: Record<string, never>[];
                changed?: {
                    fields?: {
                        [key: string]: {
                            from?: unknown;
                            to?: unknown;
                        };
                    };
                }[];
            };
            contracts?: {
                added?: Record<string, never>[];
                removed?: Record<string, never>[];
                changed?: {
                    fields?: {
                        [key: string]: {
                            from?: unknown;
                            to?: unknown;
                        };
                    };
                }[];
            };
        };
        Webhook: {
            /** Format: uuid */
            id?: string;
            name?: string;
            callback_url?: string;
            /** @description Every event this subscription delivers. The delivery itself names the one that fired, in X-Rail0-Topic. */
            topics?: components["schemas"]["WebhookTopic"][];
            active?: boolean;
            /** @enum {string} */
            circuit_state?: "closed" | "open";
            circuit_failure_count?: number;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        WebhookWithSecret: components["schemas"]["Webhook"] & {
            shared_secret?: string;
        };
        EventCallback: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            webhook_id?: string;
            /**
             * Format: uuid
             * @description The payment a payments.* delivery is about. Exactly one of payment_id, payout_id and payout_destination_id is set.
             */
            payment_id?: string | null;
            /**
             * Format: uuid
             * @description The payout a payouts.* delivery is about.
             */
            payout_id?: string | null;
            /**
             * Format: uuid
             * @description The destination a payout_destinations.verified delivery is about.
             */
            payout_destination_id?: string | null;
            topic?: string;
            callback_url?: string;
            response_code?: string | null;
            response_message?: string | null;
            error_reason?: string | null;
            /** @enum {string} */
            status?: "delivered" | "failed";
            /** Format: date-time */
            created_at?: string;
            /** @description The JSON request body POSTed to the callback URL (decompressed). */
            payload?: string | null;
        };
        /** @description Sweeper view of a stale submitted transaction. */
        SyncTransaction: {
            transaction_hash?: string;
            /**
             * @description Same vocabulary as `Transaction.operation` — dispute rows go stale too.
             * @enum {string}
             */
            operation?: "authorize" | "charge" | "capture" | "void" | "release" | "refund" | "dispute" | "close_dispute";
            /** @description Protocol-level rail0_id. */
            payment_id?: string;
            chain_id?: number;
            /** @description Address (lowercase) of the RAIL0 deployment the payment is bound to, archived versions included. The sweeper accepts a receipt's event only when this contract emitted it. */
            contract_address?: string;
        };
        /** @description One entry of the payout audit trail, written in the same transaction as the change it records. Append-only. */
        PayoutEvent: {
            /** Format: uuid */
            id?: string;
            /** @enum {string} */
            action?: "destination.created" | "destination.verified" | "destination.disabled" | "destination.enabled" | "destination.label_changed" | "destination.reserve_changed" | "destination.min_amount_changed" | "payout.prepared" | "payout.replaced" | "payout.signed" | "payout.hash_reported" | "payout.resent" | "payout.cancelled" | "payout.confirmed" | "payout.failed";
            /** @description Who did it: the lowercase 0x address of the session wallet; `system` for the gateway's own settlement (Recovery); `operator:<administrator id>` reserved for an operator (none today). */
            actor?: string;
            /** @description `{"before": {…}, "after": {…}}` of the fields the event changed, either side optional. Amounts in base units. Never a signature or a payload. `destination.created` and `destination.min_amount_changed` also carry `confirmed_details`: `{"version": "details_v1", "by": <session address>, "at": <ISO 8601 UTC>}`, the merchant's attestation that they checked the details at the venue. */
            changes?: Record<string, never> | null;
            /**
             * Format: uuid
             * @description The destination, also on every payout event.
             */
            destination_id?: string | null;
            /**
             * Format: uuid
             * @description Null for a destination event, and once Retention purged the payout (a never-signed prepare).
             */
            payout_id?: string | null;
            /**
             * Format: uuid
             * @description The destination's / payout's wallet (not necessarily the actor's).
             */
            wallet_id?: string;
            /** Format: date-time */
            created_at?: string;
        };
        PayoutEventOperator: components["schemas"]["PayoutEvent"] & {
            /** Format: uuid */
            account_id?: string;
        };
        /** @description An account named and nothing more, embedded where an operator listing must say whose row each is. */
        AccountSummary: {
            /** Format: uuid */
            id?: string;
            name?: string;
        };
        PayoutOperator: components["schemas"]["Payout"] & {
            /** Format: uuid */
            account_id?: string;
            error_reason?: string | null;
            account?: components["schemas"]["AccountSummary"];
        };
        PayoutDestinationOperator: components["schemas"]["PayoutDestination"] & {
            /** Format: uuid */
            account_id?: string;
            /** @description The attesting session's address. */
            verified_by?: string | null;
            /** @description The session address that registered it. */
            created_by?: string;
            account?: components["schemas"]["AccountSummary"];
        };
        PayoutDestination: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            wallet_id?: string;
            chain_id?: number;
            /** @description ERC-20 address on that chain, lowercased. */
            token?: string;
            token_symbol?: string | null;
            /** @description The deposit address, lowercased. */
            address?: string;
            label?: string | null;
            /** @enum {string} */
            kind?: "exchange" | "circle_mint" | "self_custody" | "provider";
            /** @enum {string} */
            status?: "unverified" | "verified" | "disabled";
            /** @description Whether the address held code on this chain when registered (eth_getCode, best effort). An EOA and an undeployed contract look the same. */
            has_code?: boolean | null;
            /** @description Base units kept in the wallet on a full-balance payout; null = the suggestion. */
            reserve_amount?: string | null;
            /** @description `reserve_amount` in human decimals (the token's decimals); null while the suggestion applies, or when the token left the catalog. */
            reserve_amount_formatted?: string | null;
            /** @description Base units: the refundable balance of the wallet's payments in this token still inside their refund window. */
            suggested_reserve?: string;
            /** @description `suggested_reserve` in human decimals; null when the token left the catalog. */
            suggested_reserve_formatted?: string | null;
            /** @description The venue's deposit minimum, base units; null = no minimum. A payout below it is refused (`payout_below_minimum`); the proof transfer is raised to it. */
            min_amount?: string | null;
            /** @description `min_amount` in human decimals (the token's decimals); null when there is no minimum, or when the token left the catalog. */
            min_amount_formatted?: string | null;
            /** Format: uuid */
            proof_payout_id?: string | null;
            /** Format: date-time */
            verified_at?: string | null;
            /** Format: date-time */
            disabled_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        Payout: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            destination_id?: string;
            /** Format: uuid */
            wallet_id?: string;
            chain_id?: number;
            token?: string;
            token_symbol?: string | null;
            /** @description The recipient. */
            address?: string;
            /** @description Base units. */
            amount?: string;
            /** @description Human decimals. */
            amount_formatted?: string;
            /** @enum {string} */
            purpose?: "proof" | "payout";
            /** @enum {string} */
            status?: "pending" | "submitted" | "confirmed" | "failed";
            /** @description JSON of the EIP-1559 transaction to sign (`to` = the token, `data` = transfer(address,uint256)). Check it against the decoded fields beside it before signing. */
            unsigned_transaction?: string | null;
            /** @description Whether the gateway stores the wallet's signed transaction (the payload itself is never exposed). A `pending` payout with `signed: true` already has its `transaction_hash` and may be in a mempool: resend it (POST /payouts/{id}/resend); it cannot be re-prepared. */
            signed?: boolean;
            /** @description Keccak of the signed transaction, stored with it on submit (so a signed `pending` row has it too), or the hash the wallet reported. */
            transaction_hash?: string | null;
            sender?: string | null;
            block_number?: number | null;
            gas_used?: string | null;
            /** @description When failed: `reverted` (mined, status 0), `foreign_transfer` (mined, but the receipt has no Transfer of this amount of this token from the wallet to this destination), `dropped` (not mined, and the wallet's confirmed nonce has passed the signed transaction's), `submission_timeout` (a reported hash no node has ever known, past SUBMITTED_TX_TTL), `cancelled` (unsigned, cancelled by the merchant with POST /payouts/{id}/cancel or by disabling its destination). `submission_timeout` and `dropped` are not final: POST /payouts/{id}/submitted with a late hash puts the payout back to `submitted`. */
            error_code?: string | null;
            error_title?: string | null;
            error_detail?: string | null;
            /** Format: date-time */
            submitted_at?: string | null;
            /** Format: date-time */
            confirmed_at?: string | null;
            /** Format: date-time */
            failed_at?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /**
         * @description Reason a payer may open a dispute with (POST /payments/{id}/dispute/prepare). On-chain the reason is a bytes32, derived from the code as keccak256("rail0.dispute.<code>") (see `x-enum-bytes32`).
         *
         *     - `not_received` — Goods or service not received
         *     - `not_as_described` — Not as described, or not what was ordered
         *     - `damaged_or_defective` — Arrived damaged or defective
         *     - `duplicate` — Charged twice for the same purchase
         *     - `incorrect_amount` — Amount differs from what was agreed
         *     - `cancelled` — Order or subscription cancelled but still charged
         *     - `refund_not_received` — A refund promised by the merchant never arrived
         *     - `unauthorized` — Payment not recognised (e.g. a compromised wallet)
         *     - `other` — Other reason, detailed off-chain
         * @enum {string}
         */
        DisputeOpenReason: "not_received" | "not_as_described" | "damaged_or_defective" | "duplicate" | "incorrect_amount" | "cancelled" | "refund_not_received" | "unauthorized" | "other";
        /**
         * @description Reason a payer may close a dispute with (POST /payments/{id}/dispute/close/prepare). On-chain the reason is a bytes32, derived from the code as keccak256("rail0.dispute.<code>") (see `x-enum-bytes32`).
         *
         *     - `resolved_with_merchant` — Resolved with the merchant off-chain
         *     - `withdrawn` — Withdrawn by the buyer (a mistake, or changed their mind)
         *     - `item_received` — The disputed goods or service arrived after all
         *     - `other` — Other reason
         * @enum {string}
         */
        DisputeCloseReason: "resolved_with_merchant" | "withdrawn" | "item_received" | "other";
        /**
         * @description Close reason the protocol records on its own — never accepted from a caller. full_refund is emitted on DisputeClosed when a full refund auto-closes an open dispute. On-chain the reason is a bytes32, derived from the code as keccak256("rail0.dispute.<code>") (see `x-enum-bytes32`).
         *
         *     - `full_refund` — Closed automatically by a full refund
         * @enum {string}
         */
        DisputeSystemCloseReason: "full_refund";
    };
    responses: {
        /** @description Resource not found. */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Authentication failed. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Caller not permitted. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Validation error. */
        Validation: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: {
        /** @description 1-based page number. */
        Page: number;
        /** @description Items per page (capped at 100). */
        PerPage: number;
        /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
        Sort: string;
    };
    requestBodies: never;
    headers: {
        /** @description Total items before pagination. */
        XTotalCount: number;
        /** @description Number of pages at this per_page. Zero for an empty collection - "no pages" is what there are, so a pager rendered off this renders none. */
        XTotalPages: number;
        /** @description RFC 8288 pagination links: first and last always, prev and next only where they exist. The URIs are RELATIVE (path and query, resolved against the URI you requested) and carry every other filter and sort you sent, so following one does not silently change the query. Absent when the collection is empty. */
        Link: string;
        /** @description Current page. */
        XPage: number;
        /** @description Items per page. */
        XPerPage: number;
        /** @description Cursor paging: pass it as `after` to read the next page; absent on the last page. */
        XNextCursor: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getRoot: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service info. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    getOpenapiSpec: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OpenAPI document. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service healthy. One public body for every caller — the endpoint is token-blind. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description Degraded (database unreachable). Same public body as the 200. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
        };
    };
    createNonce: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nonce created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Nonce"];
                };
            };
        };
    };
    verifySiwe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description EIP-4361 SIWE message text. Purpose-bound: its `statement` must be exactly "Sign in to RAIL0" — a proof signed for wallet registration (or with no statement) is refused with 422 `siwe_purpose_mismatch`, so a signature obtained for one flow can never be spent at the other. */
                    message: string;
                    /** @description Wallet signature over the SIWE message (0x…). */
                    signature: string;
                };
            };
        };
        responses: {
            /** @description SIWE verified; JWT issued. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            /** @description SIWE verification failed. The `code` field identifies the failing step: `invalid_siwe`, `invalid_nonce`, `nonce_used`, `signer_mismatch`, or one of the four binding failures `siwe_domain_not_allowed` / `siwe_uri_mismatch` / `siwe_chain_mismatch` / `siwe_proof_expired` (each names the value the caller sent, never the gateway's expected value). The message's `chainId` may be 1, or the id of any active chain of this environment's catalog; anything else is `siwe_chain_mismatch`. An address with no gateway account is NOT a failure — it yields an account-less token (201). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeAllSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description EIP-4361 SIWE message signed by the address, carrying the revoke-all statement. */
                    message: string;
                    /** @description Signature over the SIWE message (0x…). */
                    signature: string;
                };
            };
        };
        responses: {
            /** @description Every session of the address issued before cutoff_at is revoked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @description Always true on a 200: the cutoff was written.
                         * @example true
                         */
                        revoked_all: boolean;
                        /**
                         * Format: date-time
                         * @description ISO-8601 UTC instant. Every token for the address issued before it is refused (it is one second after the request, so a token minted in the same second is refused too).
                         */
                        cutoff_at: string;
                    };
                };
            };
            /** @description The proof failed verification (same SIWE codes as POST /auth) or carries the wrong statement (siwe_purpose_mismatch). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    claimOnboarding: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The token from the emailed link (`<claim page>#<token>`): base64url(JSON payload) "." base64url(HMAC-SHA256(RAIL0_ONBOARDING_SECRET, payload segment)), both unpadded. Payload keys: v (3), env (the minting gateway's environment, RAIL0_ENVIRONMENT or by default RACK_ENV; a token from another environment is onboarding_link_invalid), onboarding_id, lv (the link version), address (lowercase), email (lowercase), name, exp (unix seconds). Minted only by the gateway; a client may decode the payload to show it, never mint one. */
                    token: string;
                    /** @description EIP-4361 SIWE message signed by the request's wallet. Its statement must be exactly "Claim this RAIL0 merchant account with this wallet" — a login or wallet-add proof is refused with 422 siwe_purpose_mismatch. */
                    message: string;
                    /** @description Signature over the SIWE message (0x…). */
                    signature: string;
                    /** @description The version of the terms the merchant accepted. Missing or blank is 422 terms_required. */
                    terms_version: string;
                };
            };
        };
        responses: {
            /** @description The request was already completed: a fresh session for its (active) account. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            /** @description Account created and operational. The session, as POST /auth returns it. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            /** @description token, message or signature missing. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description account_deactivated: a repeat of a completed claim whose account an operator has deactivated. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description account_name_taken, account_email_taken or account_wallet_taken: an account took the value first. The request stays open. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description onboarding_link_invalid (not signed by the gateway, malformed, for a request that no longer exists, or whose email/address differ from the request), onboarding_link_expired, onboarding_link_superseded (a newer link was sent: use the newest email), terms_required, signer_mismatch (the proof is not signed by the request's wallet), or one of the SIWE failures of POST /auth (invalid_siwe, invalid_nonce, nonce_used, siwe_purpose_mismatch, siwe_domain_not_allowed, siwe_uri_mismatch, siwe_chain_mismatch, siwe_proof_expired). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description rate_limited. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description onboarding_unavailable: this gateway has no RAIL0_ONBOARDING_SECRET configured. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    signup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The account's name (stripped). Unique among accounts. */
                    name: string;
                    /** @description Contact email: ONE bare address `x@y` (no spaces, commas, semicolons, quotes or angle brackets: the mailer's own rule); the link is sent here. Stored stripped and lowercase. */
                    email: string;
                    /** @description The merchant's wallet (stored lowercase). The claim must be signed by it. */
                    address: string;
                };
            };
        };
        responses: {
            /** @description Operator: an open invite with the same email and address was reused and a new link queued. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingOutcome"];
                };
            };
            /** @description Operator: the invite was created and its mail queued. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingOutcome"];
                };
            };
            /** @description Public: always this body — created, reused, or the email already has an account. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status: "check_your_email";
                    };
                };
            };
            /** @description validation_failed: a field is missing or malformed (name 1–100 characters, email one bare `x@y` address, address 0x + 40 hex). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description A token was sent but is not valid: invalid_token, token_expired, token_revoked, sessions_revoked. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description forbidden (a valid session without the operator grant) or wallet_deactivated. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description account_wallet_taken or account_name_taken; for the operator also account_email_taken (the public path answers that one with the neutral 202). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description email_domain_not_allowed: the email is outside EMAIL_ALLOWED_DOMAINS (the body carries `allowed`, the domains that are); nothing was written. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description rate_limited. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description signup_unavailable (public path switched off), onboarding_unavailable, or email_provider_not_configured (operator: with `preview`). */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"] & {
                        preview?: components["schemas"]["EmailPreview"];
                    };
                };
            };
        };
    };
    listBlockchains: {
        parameters: {
            query?: {
                /** @description Filter by network type. */
                network_type?: "testnet" | "mainnet";
                /** @description Filter by native symbol (case-insensitive, e.g. ETH, USDC, CELO). */
                symbol?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active blockchains that carry at least one active token (a payment method is a chain+token pair). Each carries `settlement`, the measured broadcast-to-confirmation time on this gateway over a trailing window — served from an in-process cache refreshed at most every 10 minutes, so the listing never runs the aggregate per request. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Blockchain"][];
                };
            };
        };
    };
    listTokens: {
        parameters: {
            query?: {
                /** @description EVM chain ID to filter tokens. */
                chain_id?: number;
                /** @description Token symbol to filter by (case-insensitive, e.g. USDC). */
                symbol?: string;
                /** @description Filter by active flag. OMITTED RETURNS EVERY TOKEN, retired ones included — this endpoint is the historical catalogue, so a payment created years ago still resolves its token. Only an active token may be used for a NEW payment (POST /payments answers 422 unknown_token otherwise), so a checkout picker should pass ?active=true. */
                active?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Active tokens. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Token"][];
                };
            };
        };
    };
    listAccounts: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by whether the account holds the operator grant. */
                admin?: boolean;
                /** @description Filter by status: active or deactivated. */
                status?: "active" | "deactivated";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The accounts, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountFull"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getAccount: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The owner's profile (Account: id, name, email, priority_tip, timestamps), or for an admin session the whole record (AccountFull). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Account"] | components["schemas"]["AccountFull"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAccountWallets: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Restrict nested tokens to this chain ID (does not hide wallets). */
                chain_id?: number;
                /** @description Restrict nested tokens to this symbol (does not hide wallets). */
                token_symbol?: string;
                /** @description Filter wallets by active status. */
                active?: boolean;
                /** @description Restrict nested token holdings to the default one (does not hide wallets). */
                default?: boolean;
                /** @description Restrict nested token holdings to this active status (does not hide wallets). */
                token_active?: boolean;
            };
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The account's wallets, each with its token holdings nested under `tokens` (empty when the wallet has none). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletWithTokens"][];
                };
            };
        };
    };
    createWallet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description EVM wallet address to add (0x, 40 hex). Must be the address that signed the SIWE message. */
                    address: string;
                    /** @description EIP-4361 SIWE message text signed by the address being added (carries the nonce from POST /auth/nonces). Purpose-bound: its `statement` must be exactly "Add this wallet to your RAIL0 account" — a login-shaped proof is refused with 422 `siwe_purpose_mismatch`, so a login signature can never be replayed here to bind someone else's wallet to the caller's account. */
                    message: string;
                    /** @description Signature over the SIWE message (0x…), proving control of the address's private key. */
                    signature: string;
                    /** @description Human-readable label. */
                    label?: string;
                };
            };
        };
        responses: {
            /** @description Wallet created (unreachable while the route is suspended). */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Wallet"];
                };
            };
            400: components["responses"]["Validation"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The address is already registered to an account (addresses are globally unique). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The SIWE proof-of-ownership failed: unparseable message, unknown/used/expired nonce, domain/chain mismatch, or a signature that does not recover to `address`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getWallet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. The address is unique per account, so either resolves to the same wallet. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Wallet. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Wallet"];
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    deactivateWallet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. The address is unique per account, so either resolves to the same wallet. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Wallet deactivated. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description last_active_wallet: the wallet is the account's last active one. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    updateWallet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. The address is unique per account, so either resolves to the same wallet. */
                id: string;
            };
            cookie?: never;
        };
        /** @description At least one of `label` or `active` must be supplied. */
        requestBody: {
            content: {
                "application/json": {
                    label?: string;
                    active?: boolean;
                };
            };
        };
        responses: {
            /** @description Wallet updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Wallet"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description not_your_wallet (another wallet of the session's account), wallet_deactivated (a deactivated session doing anything but switching its own wallet back on), wallet_deactivated_by_operator (the owner switching back on a wallet an operator switched off, or one whose switch-off predates the record), or account_deactivated. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["NotFound"];
            /** @description last_active_wallet: the wallet is the account's last active one. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getWalletUsage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The wallet's usage. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletUsage"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getWalletBalances: {
        parameters: {
            query?: {
                /** @description Restrict to one chain; omit for all active chains. */
                chain_id?: number;
                /** @description Restrict tokens to this symbol; omit for all active tokens. */
                token_symbol?: string;
            };
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The wallet's balances per chain. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletBalances"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    enableWalletToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description EVM chain id of the token. */
                    chain_id: number;
                    /** @description Token address (0x, 40 hex). */
                    token: string;
                    /** @description Make this the wallet's default token. */
                    default?: boolean;
                };
            };
        };
        responses: {
            /** @description Existing holding re-enabled/updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletTokenHolding"];
                };
            };
            /** @description Holding created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletTokenHolding"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description Unknown chain or token. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    disableWalletToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Holding disabled. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The holding is the wallet's ACTIVE default payment method and the wallet accepts other methods. `code` is `default_payment_method` — switch the default over first (POST .../tokens with default:true on the successor, which demotes this one in the same request). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    enableExistingWalletToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Holding enabled. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletTokenHolding"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    disableExistingWalletToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                account_id: string;
                /** @description Wallet id (UUID) or 0x address. */
                id: string;
                /** @description Token UUID. */
                token_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Holding disabled. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletTokenHolding"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The holding is the wallet's ACTIVE default payment method and the wallet accepts other methods. `code` is `default_payment_method` — switch the default over first (POST .../tokens with default:true on the successor, which demotes this one in the same request). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listPaymentMethods: {
        parameters: {
            query?: {
                /** @description Merchant account UUID — returns all its active wallets. */
                account_id?: string;
                /** @description A merchant wallet address — returns just that wallet. */
                address?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The merchant's active wallets, each with its active token holdings nested under `tokens`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletWithTokens"][];
                };
            };
        };
    };
    listAccountDisputes: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by dispute status. */
                status?: "open" | "closed";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disputes (open and closed) on the caller's payments (as payer or payee). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputeDetail"][];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    listPayments: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Cursor paging: the `x-next-cursor` (or the Link `next`'s `after`) of the previous page. Walks the collection by `-created_at` without a total count, at a constant cost per page; `page` and any `sort` other than `-created_at` are rejected with 422 `invalid_cursor` beside it. The last page carries no `x-next-cursor` and no `next` link. */
                after?: string;
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Lifecycle state(s): one value, a comma-separated list (`status=authorized,expired`) or the repeated `status[]=` form; matches any of them. An unknown value is 400 `validation_failed` naming it. Deliberately a HAPPY-PATH label, not a ledger: a partial operation does NOT move it, so a payment captured 100 and refunded 40 still reads `captured`, and a full refund that leaves uncaptured escrow does too. `capturable_amount` / `refundable_amount` are the authoritative residuals — reconcile on those, not on this. `partially_refunded` is retained for historical rows only and is no longer produced. */
                status?: ("unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded")[];
                mode?: "authorize" | "charge";
                payer?: string;
                payee?: string;
                token?: string;
                /** @description Filter by the logical on-chain payment id (0x…). */
                rail0_id?: string;
                /** @description Filter by the reference (exact match). */
                reference?: string;
                /** @description Filter by the system the reference comes from. */
                reference_origin?: string;
                /** @description Filter by the payment's chain (resolved via its contract). */
                chain_id?: number;
                /** @description Filter by whether an open dispute exists. */
                disputed?: boolean;
                /** @description Minimum amount in token base units (inclusive). */
                min_amount?: string;
                /** @description Maximum amount in token base units (inclusive). */
                max_amount?: string;
                /** @description Only payments created at/after this time (ISO-8601). */
                created_from?: string;
                /** @description Only payments created at/before this time (ISO-8601). */
                created_to?: string;
                /** @description Only payments carrying at least one transaction with this operation. */
                operation?: "authorize" | "capture" | "charge" | "void" | "release" | "refund" | "dispute" | "close_dispute";
                /** @description `mine` (default): the authenticated wallet's payments. `all` (admin only, 403 otherwise): every payment on the gateway. */
                scope?: "mine" | "all";
                /** @description scope=all only: payments whose payee is one of this account's wallets. */
                account_id?: string;
                /** @description scope=all only: true = payments carrying a last_error_code; false = none. */
                has_error?: boolean;
                /** @description scope=all only: capturable holds (authorized, or partially captured with escrow still held) whose authorization_expiry falls within this many seconds from now and has not yet passed. */
                expiring_within?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Payments. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    "x-next-cursor": components["headers"]["XNextCursor"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payment"][];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    createPayment: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-supplied key; replays return the existing payment. */
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description EVM chain id of the target deployment. */
                    chain_id: number;
                    /** @enum {string} */
                    mode: "authorize" | "charge";
                    /** @description Human decimal amount, e.g. "10.50". */
                    amount: string;
                    /** @description Token address (0x, 40 hex). */
                    token: string;
                    /** @description Buyer address (0x, 40 hex). */
                    payer: string;
                    /** @description Merchant address (0x, 40 hex). */
                    payee: string;
                    /** @description Free-text note (what is being paid for, a reconciliation reference). Gateway-side only: in nothing signed on chain, editable afterwards via PATCH /payments/{id}, and not an idempotency term. */
                    description?: string;
                    /** @description This payment's identifier in the merchant's own system (e.g. an order, invoice or cart id there). Stripped; not unique — several payments may carry one reference. Readable by both parties, carried in webhooks, filterable with ?reference=. An idempotency term. */
                    reference?: string;
                    /** @description The system the reference comes from, a lowercase slug (stored lowercased), e.g. commercelayer, shopify, pos. Needs a reference. */
                    reference_origin?: string;
                    metadata?: {
                        [key: string]: unknown;
                    };
                };
            };
        };
        responses: {
            /** @description Existing payment returned (idempotent replay). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentDetail"];
                };
            };
            /** @description Payment created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentDetail"];
                };
            };
            /** @description Validation error. `code` is one of `no_active_contract`, `unknown_token`, `unsupported_payment_method` (the payee does not offer that token/chain), `invalid_amount`, `idempotency_key_reused` (the `Idempotency-Key` was already used by this payer for a payment with DIFFERENT terms — retry the original request with that key, or use a new key for the new terms; the response carries the existing `payment_id`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The `:id` accepts either the payment UUID or its `rail0_id` (the contract's bytes32 paymentId, `0x…`), resolved to the UUID internally. This holds for every `/payments/{id}/…` route. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Payment detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentDetail"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    updatePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The `:id` accepts either the payment UUID or its `rail0_id` (the contract's bytes32 paymentId, `0x…`), resolved to the UUID internally. This holds for every `/payments/{id}/…` route. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description New description; null or an empty string clears it. */
                    description?: string | null;
                    /** @description The payee's internal note, never shown to the payer; payee only. Null or an empty string clears it. */
                    merchant_note?: string | null;
                    /** @description Correct the reference; payee only (403 not_the_payee for the payer). Null or an empty string clears it, and its origin with it unless reference_origin is sent too. Moves updated_at. */
                    reference?: string | null;
                    /** @description The system the reference comes from (a lowercase slug); payee only. Needs a reference. */
                    reference_origin?: string | null;
                };
            };
        };
        responses: {
            /** @description Payment updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentDetail"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Validation"];
        };
    };
    signPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Payer's EIP-3009 signature (0x…, 65 bytes). */
                    signature: string;
                };
            };
        };
        responses: {
            /** @description Signature stored. Returns the updated payment, now in the `signed` state. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentDetail"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
            /** @description Payment not signable, signer mismatch, or `invalid_signature`: a signature that cannot be recovered, or whose recovery byte `v` is not 27/28 (0/1 are read as 27/28). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPaymentTransactions: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                operation?: "authorize" | "capture" | "charge" | "void" | "release" | "refund" | "dispute" | "close_dispute";
                /** @description Transaction status(es): one value, a comma-separated list or the repeated `status[]=` form; matches any of them. */
                status?: ("pending" | "submitting" | "submitted" | "confirmed" | "failed")[];
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Transactions. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    getPaymentTransaction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The transaction row to read, resolved through the payment's own transactions - an id belonging to another payment answers 404. */
                transaction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The transaction. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    redrivePaymentTransaction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The transaction row to redrive, resolved through the payment's own transactions - an id belonging to another payment answers 404. */
                transaction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Accepted; the broadcaster was re-enqueued and the broadcast happens asynchronously. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The transaction is not in the redrivable state (`pending` with its `signed_transaction` stored). Code `not_redrivable`; the detail names the state the row is in. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `queue_unavailable`: the job queue could not be reached, so nothing was enqueued. The row is unchanged; retry in a moment. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    preparePaymentOperation: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-supplied key; a replay returns the transaction the first call created, with 200 instead of 201. Bound to the request as well as the key: the same key with different terms (a corrected amount, another dispute reason) is refused 422 `idempotency_key_reused` rather than answered with the first transaction. Scoped to this payment. Without it a retry that arrives after the first transaction was signed and broadcast opens a SECOND transaction, which is the correct behaviour for a genuine sequential partial capture and the wrong one for a retry - only the caller can tell those apart. */
                "Idempotency-Key"?: string;
            };
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description `capture` and `refund` only (required there): the amount as a human decimal. Ignored by the other operations. */
                    amount?: string;
                    /** @description `refund` only: the payee's EIP-3009 refund signature (phase 2; 0x + 130 hex). Ignored by the other operations. */
                    signature?: string;
                    /** @description `release` only: the submitter, the payment's payer or payee (422 release_submitter_not_a_party otherwise). The transaction is built with its nonce. Defaults to the caller. Ignored by the other operations. */
                    from?: string;
                };
            };
        };
        responses: {
            /** @description Reused the existing pending transaction (idempotent re-prepare); or, for refund phase-1, the `{ signing_payload }` for the payee to sign off-chain (no transaction created). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"] | {
                        /** @description EIP-3009 payload for the payee to sign (refund phase-1). */
                        signing_payload?: unknown;
                    };
                };
            };
            /** @description Created the pending (unsubmitted) transaction. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Missing required param (`amount` for capture/refund, `signature` for refund phase-2). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description Payment not in a state that permits this operation. Inside the stranded-escrow window (after a partial capture, before authorization_expiry) the void and release refusals each name the other verb and the timestamp when release opens — the codes (not_voidable / authorization_not_expired) are unchanged and remain the field to branch on. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitPaymentOperation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Signed raw transaction (0x…). */
                    signed_transaction: string;
                };
            };
        };
        responses: {
            /** @description Accepted; broadcast enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description The signed transaction could not be decoded. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description `transaction_mismatch`: the signed transaction's target, calldata, value or chain differs from the one this operation prepared. Sign the payload prepare returned, unmodified. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitPaymentOperationByHash: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. These six are the operations reachable through the generic namespace; `dispute`/`close_dispute` are payer-only and have their own dedicated routes. The set of operations a stored transaction can CARRY is wider — see `Transaction.operation`. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Hash of the already-broadcast transaction (0x + 64 hex). */
                    transaction_hash: string;
                };
            };
        };
        responses: {
            /** @description Accepted; the hash was recorded and awaits on-chain confirmation. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Malformed transaction_hash. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The operation's transaction is already confirmed — its hash is not overwritable. A `failed` row IS overwritable: re-reporting the hash repairs an orphan (mined on-chain, recorded failed) by moving it back to `submitted`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    submitDisputeByHash: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Hash of the already-broadcast transaction (0x + 64 hex). */
                    transaction_hash: string;
                };
            };
        };
        responses: {
            /** @description Accepted; the hash was recorded and awaits on-chain confirmation. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Malformed transaction_hash. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The operation's transaction is already confirmed — its hash is not overwritable. A `failed` row IS overwritable: re-reporting the hash repairs an orphan (mined on-chain, recorded failed) by moving it back to `submitted`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    submitCloseDisputeByHash: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Hash of the already-broadcast transaction (0x + 64 hex). */
                    transaction_hash: string;
                };
            };
        };
        responses: {
            /** @description Accepted; the hash was recorded and awaits on-chain confirmation. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Malformed transaction_hash. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The operation's transaction is already confirmed — its hash is not overwritable. A `failed` row IS overwritable: re-reporting the hash repairs an orphan (mined on-chain, recorded failed) by moving it back to `submitted`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    prepareDispute: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-supplied key; a replay returns the transaction the first call created, with 200 instead of 201. Bound to the request as well as the key: the same key with different terms (a corrected amount, another dispute reason) is refused 422 `idempotency_key_reused` rather than answered with the first transaction. Scoped to this payment. Without it a retry that arrives after the first transaction was signed and broadcast opens a SECOND transaction, which is the correct behaviour for a genuine sequential partial capture and the wrong one for a retry - only the caller can tell those apart. */
                "Idempotency-Key"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Optional. A DisputeOpenReason code (e.g. `not_received`), or exactly that code's bytes32 — keccak256("rail0.dispute.<code>") as 0x-hex; the gateway encodes the bytes32 into the calldata. Omitted (or the all-zero bytes32) means no reason: the calldata carries bytes32 zero. Any other value is refused 422 `unknown_dispute_reason`. */
                    reason?: components["schemas"]["DisputeOpenReason"];
                };
            };
        };
        responses: {
            /** @description Reused the existing pending dispute transaction. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Pending dispute transaction with the unsigned payload. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_the_payer`: only the payment's payer can prepare this; a payee or another session gets this 403 (a stranger gets 404). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["NotFound"];
            /** @description `unknown_dispute_reason` when `reason` is supplied, non-zero, and not a DisputeOpenReason code or its bytes32; otherwise the payment-state refusal or `idempotency_key_reused`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitDispute: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Signed raw transaction (0x…). */
                    signed_transaction: string;
                };
            };
        };
        responses: {
            /** @description Accepted — broadcast happens asynchronously. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description The signed transaction could not be decoded. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description `transaction_mismatch`: the signed transaction's target, calldata, value or chain differs from the one this operation prepared. Sign the payload prepare returned, unmodified. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    prepareCloseDispute: {
        parameters: {
            query?: never;
            header?: {
                /** @description Client-supplied key; a replay returns the transaction the first call created, with 200 instead of 201. Bound to the request as well as the key: the same key with different terms (a corrected amount, another dispute reason) is refused 422 `idempotency_key_reused` rather than answered with the first transaction. Scoped to this payment. Without it a retry that arrives after the first transaction was signed and broadcast opens a SECOND transaction, which is the correct behaviour for a genuine sequential partial capture and the wrong one for a retry - only the caller can tell those apart. */
                "Idempotency-Key"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Optional. A DisputeCloseReason code (e.g. `withdrawn`), or exactly that code's bytes32 — keccak256("rail0.dispute.<code>") as 0x-hex; the gateway encodes the bytes32 into the calldata. Omitted (or the all-zero bytes32) means no reason: the calldata carries bytes32 zero. `full_refund` is recorded by the protocol itself and is not accepted here. Any other value is refused 422 `unknown_dispute_reason`. */
                    reason?: components["schemas"]["DisputeCloseReason"];
                };
            };
        };
        responses: {
            /** @description Reused the existing pending close-dispute transaction. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description Pending close-dispute transaction with the unsigned payload. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_the_payer`: only the payment's payer can prepare this; a payee or another session gets this 403 (a stranger gets 404). */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            404: components["responses"]["NotFound"];
            /** @description `unknown_dispute_reason` when `reason` is supplied, non-zero, and not a DisputeCloseReason code or its bytes32; otherwise the payment-state refusal or `idempotency_key_reused`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    submitCloseDispute: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Signed raw transaction (0x…). */
                    signed_transaction: string;
                };
            };
        };
        responses: {
            /** @description Accepted — broadcast happens asynchronously. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            /** @description The signed transaction could not be decoded. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description `transaction_mismatch`: the signed transaction's target, calldata, value or chain differs from the one this operation prepared. Sign the payload prepare returned, unmodified. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listDisputes: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by dispute status. */
                status?: "open" | "closed";
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Dispute open/close history. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Dispute"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            404: components["responses"]["NotFound"];
        };
    };
    analyticsSummary: {
        parameters: {
            query?: {
                /** @description One of the account's wallet addresses (0x, 40 hex, any case) — scopes the analytics to that wallet only. Omitted: every wallet of the account. 403 when it is not a wallet of the session's account. */
                payee?: string;
                mode?: "authorize" | "charge";
                status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded";
                /** @description Token address (0x…) — scopes volume to one token. */
                token?: string;
                chain_id?: number;
                /** @description Only payments created at/after this time (ISO-8601). */
                from?: string;
                /** @description Only payments created at/before this time (ISO-8601). */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order counts, by-status counts, refund/dispute rates, and per-(token, chain) volume: gross authorized, net settled to the payee, still in escrow, and gross captured/refunded from the confirmed transactions (base units). Plus `gas` per chain — `spent` on confirmed transactions and `wasted` by on-chain reverts, as wei-scale base-unit strings in the chain's native token (decimals 18) — with `confirmed`/`failed` resolved transaction counts, and `failed_rate` derived from them (per resolved transaction, not per order). `gas_by_status` and `gas_by_operation` are those same rows regrouped, each carrying a `key` (the payment status / the operation) alongside the same fields; every cut sums back to its chain's `gas` row. The status cut is a SNAPSHOT — a payment's status moves and its gas moves with it, so the same period changes over time; the operation cut is stable. Each chain/status row carries `orders`, the count of payments behind it (including those that produced no transaction), so `(spent + wasted) / orders` is the average cost of an order in that state; it is null on the operation cut, where one order spans several operations and `spent / confirmed` is the meaningful average instead. Gas covers the operations the merchant broadcasts: dispute/close_dispute are the buyer's cost and are excluded; a release counts when its recorded `sender` is one of the account's wallets, and one with an unknown sender (a report-by-hash submit) stays out. Also `failures` — one row per decoded failure code with the number of the merchant's transactions that hit it, commonest first — and `confirmation_secs` on each gas row: the mean seconds from broadcast to confirmation on that chain, weighted by its confirmations and null when none confirmed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    analyticsTimeseries: {
        parameters: {
            query?: {
                /** @description One of the account's wallet addresses (0x, 40 hex, any case) — scopes the analytics to that wallet only. Omitted: every wallet of the account. 403 when it is not a wallet of the session's account. */
                payee?: string;
                mode?: "authorize" | "charge";
                status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded";
                /** @description Token address (0x…) — scopes volume to one token. */
                token?: string;
                chain_id?: number;
                /** @description Only payments created at/after this time (ISO-8601). */
                from?: string;
                /** @description Only payments created at/before this time (ISO-8601). */
                to?: string;
                interval?: "day" | "week" | "month";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Buckets with order count and (single-token) volume. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>[];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    analyticsBreakdown: {
        parameters: {
            query: {
                /** @description One of the account's wallet addresses (0x, 40 hex, any case) — scopes the analytics to that wallet only. Omitted: every wallet of the account. 403 when it is not a wallet of the session's account. */
                payee?: string;
                mode?: "authorize" | "charge";
                status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded";
                /** @description Token address (0x…) — scopes volume to one token. */
                token?: string;
                chain_id?: number;
                /** @description Only payments created at/after this time (ISO-8601). */
                from?: string;
                /** @description Only payments created at/before this time (ISO-8601). */
                to?: string;
                by: "token" | "chain" | "mode" | "status" | "operation";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One row per dimension key with an order count (and volume for token). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>[];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listWebhooks: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter to subscriptions that include this topic. */
                topic?: components["schemas"]["WebhookTopic"];
                /** @description Filter by active status. */
                active?: boolean;
                /** @description Filter by circuit state. */
                circuit_state?: "closed" | "open";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhooks. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"][];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Human-readable identifier. */
                    name: string;
                    /** @description HTTPS destination URL. */
                    callback_url: string;
                    /** @description Event topics for this subscription — one secret and one circuit breaker for all of them. Repeated values are collapsed. */
                    topics: components["schemas"]["WebhookTopic"][];
                };
            };
        };
        responses: {
            /** @description Webhook created. `shared_secret` is returned only on this response and on rotate. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookWithSecret"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `validation_failed` (a malformed callback_url or topic), or `webhook_limit_reached`: the account already holds 20 subscriptions (WEBHOOKS_PER_ACCOUNT; disabled ones count, deleted ones do not). Delete one, or add topics to an existing subscription. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    deleteWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    name?: string;
                    callback_url?: string;
                    /** @description REPLACES the whole set, so this is also how a topic is removed. The shared secret is untouched. */
                    topics?: components["schemas"]["WebhookTopic"][];
                };
            };
        };
        responses: {
            /** @description Webhook updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["Validation"];
        };
    };
    enableWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook enabled. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    disableWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook disabled. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    rotateWebhookSecret: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Secret rotated; the new `shared_secret` is returned once. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookWithSecret"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description `conflict`: another rotation of this webhook replaced the secret while this request was in flight. No secret is returned; the winning request's secret is the current one. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    resetWebhookCircuit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Circuit reset. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Webhook"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    testWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The delivery result — 200 whether or not the endpoint accepted it; read `delivered`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookTestResult"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listWebhookEventCallbacks: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by delivery status. */
                status?: "delivered" | "failed";
                /** @description Filter by event topic. */
                topic?: components["schemas"]["WebhookTopic"];
                /** @description Filter by the payment the delivery is for: its id (UUID) or its rail0_id (0x…). */
                payment_id?: string;
                /** @description Filter by the subscriber's exact HTTP response code (e.g. 500). */
                response_code?: string;
                /** @description Only deliveries at/after this time (ISO-8601). */
                since?: string;
                /** @description Only deliveries at/before this time (ISO-8601). */
                until?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event callbacks. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventCallback"][];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    redeliverEventCallback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description The event_callback row whose recorded payload to re-send. */
                callback_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Replay queued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example queued */
                        status?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description `queue_unavailable`: the job queue could not be reached, so nothing was enqueued and no replay will happen. Nothing is written by this endpoint; retry in a moment. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    getSyncTransactions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stale submitted transactions wrapped under `transactions`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        transactions?: components["schemas"]["SyncTransaction"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    syncTransactionCallback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description EVM chain id the transaction belongs to. */
                chain_id: number;
                /** @description On-chain transaction hash (0x + 64 hex). Anything else is refused 400. */
                tx_hash: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description "confirm" when mined, "fail" when reverted.
                     * @enum {string}
                     */
                    operation: "confirm" | "fail";
                    /**
                     * @description Event name (required on confirm).
                     * @enum {string}
                     */
                    event_type?: "authorized" | "charged" | "captured" | "voided" | "released" | "refunded" | "disputed" | "dispute_closed";
                    /** @description On-chain amount, base units (confirm only). Decimal digits. */
                    amount?: string;
                    /** @description Decimal digits. Live on-chain capturable balance after the event, base units (confirm only; sent by fund-affecting events, omitted by dispute/dispute_closed). The gateway mirrors it — the indexer is the single source. */
                    capturable_amount?: string;
                    /** @description Decimal digits. Live on-chain refundable balance after the event, base units (confirm only; sent by fund-affecting events, omitted by dispute/dispute_closed). The gateway mirrors it — the indexer is the single source. */
                    refundable_amount?: string;
                    /** @description Block the event was mined in (required on confirm). */
                    block_number?: number;
                    /** @description Event position within the block (orders same-block confirms; optional, older indexers omit it). */
                    log_index?: number;
                    /** @description On-chain bytes32 paymentId, read from the event. REQUIRED: it is the compensating control for the submit-by-hash hole — /{operation}/submitted accepts a transaction hash no node has seen yet, so the Syncer's comparison of this value against the payment the transaction row belongs to is what rejects a squatted hash. It was optional, which meant a caller omitting it silently skipped that check. */
                    payment_id: string;
                    /** @description Revert reason / raw error data (fail only). Stored whole: the columns it lands in are text, so a long Error(string) or a multi-word custom error no longer fails the callback. */
                    revert_reason?: string;
                    /** @description Gas units used (confirm and fail — a reverted transaction still burns gas). Decimal digits. */
                    gas_used?: string;
                    /** @description Gas limit. Decimal digits. */
                    gas_limit?: string;
                    /** @description Effective gas price in wei. Decimal digits. */
                    effective_gas_price?: string;
                    /** @description Block base fee per gas in wei. Decimal digits. */
                    base_fee_per_gas?: string;
                    /** @description Transaction sender, from the receipt the indexer already reads for the gas fields. Mirrored ONLY into an empty column: when the gateway broadcast the transaction it recovered the sender from the signature, which is the verified fact — this fills the gap left by a wallet that broadcast for itself, where a release's gas would otherwise stay unattributable to either party. */
                    sender?: string;
                    /** @description On-chain bytes32 dispute reason, read from the PaymentDisputed / DisputeClosed event (disputed and dispute_closed only). The dispute records THIS value, not the one the gateway prepared: a payer can broadcast their own dispute transaction with a different reason and report its hash. */
                    reason?: string;
                };
            };
        };
        responses: {
            /** @description Callback accepted; Syncer enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example accepted */
                        status?: string;
                    };
                };
            };
            /** @description A malformed path `tx_hash` (not 0x + 64 hex), or a body field missing or failing its format (`operation`, `payment_id`, the base-units amounts, `sender`, `reason`). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `invalid_event_type` or `missing_param` (block_number) — a malformed payload. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    grantAdministrator: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The account being granted/revoked. */
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Why the grant exists — free-text audit context. */
                    note?: string;
                    /**
                     * Format: date-time
                     * @description Time-box the grant: past this instant it no longer opens the surface. Omit for no expiry.
                     */
                    expires_at?: string;
                };
            };
        };
        responses: {
            /** @description The grant, whole record (Full entity): id, account_id, granted_by, note, expires_at, created_at. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The account already holds the grant. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            /** @description expiry_in_the_past: expires_at is not in the future. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    revokeAdministrator: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The account being granted/revoked. */
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description self_revoke: an admin revoking their own grant; last_admin: the revoke would leave zero active admins. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    getAdminHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The verdict and every check behind it. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminHealth"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getAdminRpcHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The verdict and every chain's endpoints. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminRpcHealth"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    adminCatalogDiff: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The diff. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CatalogDiff"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    reloadCatalog: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description What the rebuilt snapshot holds. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        reloaded?: boolean;
                        blockchains?: number;
                        tokens?: number;
                        contracts?: number;
                        payment_blockchains?: number;
                        /** Format: date-time */
                        reloaded_at?: string;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdminTransactions: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only stuck rows: `unbroadcast` (signed, never sent, past two redrive cycles), `unconfirmed` (broadcast past SUBMITTED_TX_TTL with no confirm), or `any` of the two. */
                stuck?: "unbroadcast" | "unconfirmed" | "any";
                /** @description Filter by status (comma-separated). */
                status?: ("pending" | "submitting" | "submitted" | "confirmed" | "failed")[];
                /** @description Filter by operation. */
                operation?: "authorize" | "charge" | "capture" | "void" | "release" | "refund" | "dispute" | "close_dispute";
                /** @description Only transactions on this chain (EVM chain id). */
                chain_id?: number;
                /** @description Only transactions on payments whose payee is one of this account's wallets. */
                account_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The rows, whole record each (Full entity, signed_transaction excluded). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransactionOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getAdminAccountExposure: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The account id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountExposure"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminPayouts: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only this account's payouts. */
                account_id?: string;
                /** @description Only this wallet's payouts. */
                wallet_id?: string;
                /** @description Only payouts to this destination. */
                destination_id?: string;
                /** @description Only payouts on this chain (EVM chain id). */
                chain_id?: number;
                /** @description Status(es): one value, a comma-separated list or the repeated `status[]=` form. */
                status?: ("pending" | "submitted" | "confirmed" | "failed")[];
                purpose?: "proof" | "payout";
                /** @description Only payouts created at/after this time (ISO-8601). */
                created_from?: string;
                /** @description Only payouts created at/before this time (ISO-8601). */
                created_to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The payouts (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getAdminPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutOperator"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminPayoutEvents: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
            };
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Newest first. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutEventOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminPayoutDestinations: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only this account's destinations. */
                account_id?: string;
                /** @description Only this wallet's destinations. */
                wallet_id?: string;
                /** @description Only destinations on this chain (EVM chain id). */
                chain_id?: number;
                status?: "unverified" | "verified" | "disabled";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The destinations (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestinationOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    getAdminPayoutDestination: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestinationOperator"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminPayoutDestinationEvents: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
            };
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Newest first. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutEventOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminEventCallbacks: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only deliveries for this payment: its id (UUID) or its rail0_id (0x…). */
                payment_id?: string;
                /** @description Only this subscription's deliveries. */
                webhook_id?: string;
                /** @description Filter by delivery status. */
                status?: "delivered" | "failed";
                /** @description Filter by event topic. */
                topic?: components["schemas"]["WebhookTopic"];
                /** @description Filter by the subscriber's exact HTTP response code. */
                response_code?: string;
                /** @description Only deliveries at/after this time (ISO-8601). */
                since?: string;
                /** @description Only deliveries at/before this time (ISO-8601). */
                until?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The deliveries, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventCallbackOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdminDisputes: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by dispute status. */
                status?: "open" | "closed";
                /** @description Only this payment's disputes: its id (UUID) or its rail0_id (0x…). */
                payment_id?: string;
                /** @description Only disputes on payments of this chain (EVM chain id). */
                chain_id?: number;
                /** @description Only disputes opened with this dictionary code. */
                reason_code?: "not_received" | "not_as_described" | "damaged_or_defective" | "duplicate" | "incorrect_amount" | "cancelled" | "refund_not_received" | "unauthorized" | "other";
                /** @description Only disputes opened at or after this instant (ISO-8601). */
                from?: string;
                /** @description Only disputes opened at or before this instant (ISO-8601). */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The disputes, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputeOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    adminConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The effective configuration. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfigReport"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    adminTransactionThroughput: {
        parameters: {
            query?: {
                /** @description Bucket size: minute, hour, day, week or month. */
                interval?: "minute" | "hour" | "day" | "week" | "month";
                /** @description Window start (ISO-8601). Defaults to a span sized for the interval. */
                from?: string;
                /** @description Window end (ISO-8601). Defaults to now. */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The series and the window it covers. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        interval?: "minute" | "hour" | "day" | "week" | "month";
                        /** Format: date-time */
                        from?: string;
                        /** Format: date-time */
                        to?: string;
                        /** @description False only on a gateway that has never handled a transaction at all. It exists so an empty `buckets` can be read correctly: a quiet window on a working gateway, or nothing ever — which usually means the client is pointed at an environment that has never taken a payment. An existence check, not a count. */
                        any_transactions?: boolean;
                        buckets?: {
                            /** Format: date-time */
                            bucket?: string;
                            transactions?: number;
                            failed?: number;
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["Validation"];
        };
    };
    adminGasByHour: {
        parameters: {
            query?: {
                /** @description Only this chain (EVM chain id). */
                chain_id?: number;
                /** @description Window start (ISO-8601). Defaults to 30 days before `to`. */
                from?: string;
                /** @description Window end (ISO-8601). Defaults to now. */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The report and the window it covers. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: date-time */
                        from?: string;
                        /** Format: date-time */
                        to?: string;
                        chains?: {
                            chain_id?: number;
                            chain_name?: string;
                            native_symbol?: string;
                            /** @description Always 18 (EVM native token). */
                            decimals?: number;
                            /** @description Transactions with gas figures in the window, all hours. */
                            transactions?: number;
                            hours?: {
                                /** @description Hour of the day, UTC, of confirmation. */
                                hour?: number;
                                transactions?: number;
                                /** @description Wei-scale integer string in the chain's native token (18 decimals); null for an hour with no transaction. */
                                avg_gas_price?: string | null;
                                /** @description Wei-scale integer string in the chain's native token (18 decimals); null for an hour with no transaction. */
                                avg_base_fee?: string | null;
                                /** @description Average gas_used × effective_gas_price per transaction, wei-scale integer string in the native token; null for an hour with no transaction. */
                                avg_cost?: string | null;
                            }[];
                        }[];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["Validation"];
        };
    };
    listSyncErrors: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by rejection reason (e.g. payment_mismatch). */
                reason?: string;
                /** @description Filter by outcome. */
                outcome?: "confirmed" | "failed";
                /** @description Filter by transaction hash. */
                tx_hash?: string;
                /** @description Only rows about this payment: its id (UUID) or its rail0_id (0x…). */
                payment_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The sync errors, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    clearSyncErrors: {
        parameters: {
            query?: {
                /** @description Only rows with this rejection reason. */
                reason?: string;
                /** @description Only rows for this callback type. */
                outcome?: "confirmed" | "failed";
                /** @description Only rows for this transaction hash. */
                tx_hash?: string;
                /** @description Only rows about this payment: its id (UUID) or its rail0_id (0x…). */
                payment_id?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description How many rows were deleted. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 12 */
                        deleted: number;
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdministrators: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The rows, whole record each (Full entity). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdministratorFull"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdminWebhooks: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only this account's subscriptions. */
                account_id?: string;
                /** @description Filter by circuit state. */
                circuit_state?: "closed" | "open";
                /** @description Only subscriptions that include this topic. */
                topic?: components["schemas"]["WebhookTopic"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The rows, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookOperator"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    adminResetWebhookCircuit: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Circuit reset. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WebhookOperator"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listAdminActions: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Only this kind of action. */
                action?: "account.create" | "account.update" | "account.activate" | "account.deactivate" | "onboarding.create" | "onboarding.update" | "onboarding.send" | "onboarding.delete" | "wallet.add" | "wallet.update" | "wallet.deactivate" | "wallet.reactivate" | "administrator.grant" | "administrator.revoke" | "webhook.reset_circuit" | "transaction.redrive" | "catalog.reload" | "sync_errors.clear";
                /** @description Only actions by this admin account. */
                actor_account_id?: string;
                /** @description Only actions that landed on this account. */
                target_account_id?: string;
                /** @description Only actions on this kind of resource (e.g. wallet). */
                resource_type?: string;
                /** @description Only actions whose detail names this payment (a redrive): its UUID. */
                payment_id?: string;
                /** @description Only actions at or after this instant (ISO-8601). */
                from?: string;
                /** @description Only actions at or before this instant (ISO-8601). */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The rows, whole record each (Full entity). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminAction"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listOnboardings: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description State(s): open, expired, completed — one value, a comma-separated list or the repeated `status[]=` form. Default: open,expired. */
                status?: ("open" | "expired" | "completed")[];
                /** @description Only requests from this entrance: operator (an invite) or signup (self-service). */
                origin?: "operator" | "signup";
                /** @description true: only requests whose last send failed (last_send_error set); false: only the others. */
                send_failed?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The requests. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingListed"][];
                };
            };
            /** @description validation_failed: an unknown status or origin. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    deleteOnboarding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The onboarding request id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description onboarding_not_found: no request with that id (never created, cancelled, or deleted after it expired). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description onboarding_completed: the request is completed (history); act on its account instead. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    updateOnboarding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The onboarding request id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name?: string;
                    email?: string;
                    address?: string;
                };
            };
        };
        responses: {
            /** @description Corrected; the correction mail is queued. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingOutcome"];
                };
            };
            /** @description validation_failed: nothing supplied, nothing different, or a malformed value. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description onboarding_not_found: no request with that id (never created, cancelled, or deleted after it expired). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description account_email_taken, account_wallet_taken or account_name_taken. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description onboarding_completed: the request is completed (history); act on its account instead. email_domain_not_allowed: the email is outside EMAIL_ALLOWED_DOMAINS (the body carries `allowed`, the domains that are); nothing was written. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description email_provider_not_configured: no email provider that delivers is configured, so nothing was written; for the operator the body also carries `preview` (EmailPreview: the mail as it would have gone, with a placeholder instead of the link). onboarding_unavailable: RAIL0_ONBOARDING_SECRET (or the claim URL) is not configured. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"] & {
                        preview?: components["schemas"]["EmailPreview"];
                    };
                };
            };
        };
    };
    sendOnboarding: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The onboarding request id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The new link is queued. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OnboardingSent"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description onboarding_not_found: no request with that id (never created, cancelled, or deleted after it expired). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description account_email_taken, account_wallet_taken or account_name_taken. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description onboarding_completed: the request is completed (history); act on its account instead. email_domain_not_allowed: the email is outside EMAIL_ALLOWED_DOMAINS (the body carries `allowed`, the domains that are); nothing was written. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description email_provider_not_configured: no email provider that delivers is configured, so nothing was written; for the operator the body also carries `preview` (EmailPreview: the mail as it would have gone, with a placeholder instead of the link). onboarding_unavailable: RAIL0_ONBOARDING_SECRET (or the claim URL) is not configured. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"] & {
                        preview?: components["schemas"]["EmailPreview"];
                    };
                };
            };
        };
    };
    listAdminBlockchains: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The whole catalogue, whole record each (Full entity). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminBlockchain"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdminTokens: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The whole catalogue, whole record each (Full entity). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminToken"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listAdminContracts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The whole catalogue, whole record each (Full entity). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminContract"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
        };
    };
    listPayoutDestinations: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Restrict to one wallet (uuid). */
                wallet_id?: string;
                status?: "unverified" | "verified" | "disabled";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The account's destinations (x-total-count / x-total-pages headers). */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestination"][];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    createPayoutDestination: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The wallet (uuid or address) that will sign transfers to it; must be the session's own. */
                    wallet_id: string;
                    /** @description The chain the deposit address was issued for. */
                    chain_id: number;
                    /** @description The token's address on that chain. */
                    token: string;
                    /** @description The deposit address, generated at the venue WITH THE NETWORK SET TO THIS CHAIN. */
                    address: string;
                    label?: string;
                    /**
                     * @default exchange
                     * @enum {string}
                     */
                    kind?: "exchange" | "circle_mint" | "self_custody" | "provider";
                    /** @description Base units to keep in the wallet on a full-balance payout (digits only, below 2^120; 422 `invalid_amount` otherwise); omit for the suggestion. */
                    reserve_amount?: string;
                    /** @description The venue's deposit minimum in base units (digits only, below 2^120; 422 `invalid_amount` otherwise); omit for none. A payout below it is refused (`payout_below_minimum`) and the proof transfer is raised to it. */
                    min_amount?: string;
                    /** @description Must be `true` (else 422 `confirmation_required`): the merchant confirms the text of version `details_v1` — "I have checked the address, network, token and minimum deposit on the venue's deposit page and confirm they are correct. Funds sent to a wrong address or network, or below the venue's minimum, may be permanently lost and cannot be recovered by rail0." Recorded in the `destination.created` event as `changes.confirmed_details` {version, by, at}. */
                    confirm_details: boolean;
                };
            };
        };
        responses: {
            /** @description Registered, `unverified`. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestination"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: the wallet is not the session's; `account_deactivated`; `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: the wallet is not in this account. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_destination_exists`: this wallet already has this address for this token and chain. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `unknown_chain`, `unknown_token`, `payout_destination_zero_address`, `payout_destination_own_wallet`, `payout_destination_is_contract` (any RAIL0 deployment on the chain, archived included, or any catalogued token there), `invalid_amount` (`reserve_amount` or `min_amount` is not base units below 2^120), `confirmation_required` (`confirm_details` is not `true`). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getPayoutDestination: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestination"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    updatePayoutDestination: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    label?: string;
                    /** @description Base units (digits only, below 2^120; 422 `invalid_amount` otherwise); an empty string restores the suggestion. */
                    reserve_amount?: string;
                    /** @description The venue's deposit minimum, base units (digits only, below 2^120; 422 `invalid_amount` otherwise); an empty string removes it. Changing it requires `confirm_details: true`. Raising it above the amount of the destination's latest proof takes its verification away (`status` back to `unverified`, `verified_at` null; a disabled one re-enables unverified): the merchant proves the address again with a new proof, prepared at the new minimum. The change is recorded in `destination.min_amount_changed`, with `status` and `verified_by` beside `min_amount`. */
                    min_amount?: string;
                    /** @description Required `true` when the request CHANGES `min_amount` (the same value again needs nothing; label, reserve and active never do): the merchant confirms the `details_v1` text (see POST /payout_destinations). Recorded in the `destination.min_amount_changed` event as `changes.confirmed_details` {version, by, at}. */
                    confirm_details?: boolean;
                    /** @description false disables it, true re-enables it (a verified destination stays verified). */
                    active?: boolean;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestination"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: an edit (label, reserve, minimum, re-enable) by another wallet than the destination's — any wallet of the account may only disable; `account_deactivated`: any change on a deactivated account, disabling included (it is read-only); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_already_signed`: disabling is refused while a signed payout to this destination is pending. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `invalid_amount`: `reserve_amount` or `min_amount` is not base units below 2^120; `confirmation_required`: the request changes `min_amount` without `confirm_details: true` (nothing is written). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    confirmPayoutDestination: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Now `verified`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDestination"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`; `account_deactivated`; `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_destination_proof_missing` (no confirmed proof yet), `payout_destination_disabled`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listPayoutDestinationEvents: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
            };
            header?: never;
            path: {
                /** @description The payout destination id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Newest first. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutEvent"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listPayouts: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Cursor paging: the `x-next-cursor` (or the Link `next`'s `after`) of the previous page. Walks the collection by `-created_at` without a total count, at a constant cost per page; `page` and any `sort` other than `-created_at` are rejected with 422 `invalid_cursor` beside it. The last page carries no `x-next-cursor` and no `next` link. */
                after?: string;
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                destination_id?: string;
                wallet_id?: string;
                /** @description Status(es): one value, a comma-separated list or the repeated `status[]=` form; matches any of them. */
                status?: ("pending" | "submitted" | "confirmed" | "failed")[];
                purpose?: "proof" | "payout";
                /** @description Only payouts created at/after this time (ISO-8601). */
                created_from?: string;
                /** @description Only payouts created at/before this time (ISO-8601). */
                created_to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Newest first by default. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    "x-next-cursor": components["headers"]["XNextCursor"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"][];
                };
            };
            401: components["responses"]["Unauthorized"];
        };
    };
    preparePayout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    destination_id: string;
                    /**
                     * @default payout
                     * @enum {string}
                     */
                    purpose?: "proof" | "payout";
                    /** @description Human decimals, or `all`. Required for a payout. */
                    amount?: string;
                };
            };
        };
        responses: {
            /** @description The destination's pending payout, re-prepared. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            /** @description A new pending payout; `unsigned_transaction` is the payload to sign. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            /** @description `missing_param`: amount. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: not the destination's own wallet; `account_deactivated`: the account is deactivated, and a deactivated account writes no payouts (see the Payouts section); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_already_signed`: the destination's pending payout holds a signed transaction; resend it or let it settle. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_destination_disabled`, `payout_destination_unverified`, `payout_below_minimum` (the detail names the minimum, and for `all` what is available), `insufficient_balance` (names what is available after the reserve; also a proof above the balance), `payout_limit_reached`, `unknown_chain`, `unknown_token`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The chain could not be read (`rpc_unavailable`, …). */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listPayoutEvents: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
            };
            header?: never;
            path: {
                /** @description The payout id. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Newest first. */
            200: {
                headers: {
                    "x-total-count": components["headers"]["XTotalCount"];
                    "x-total-pages": components["headers"]["XTotalPages"];
                    link: components["headers"]["Link"];
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutEvent"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    submitPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Signed raw transaction (0x…). */
                    signed_transaction: string;
                };
            };
        };
        responses: {
            /** @description Broadcast; now `submitted` with its hash. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            /** @description `invalid_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: components["responses"]["Unauthorized"];
            /** @description `forbidden`: not signed by the wallet; `not_your_wallet`: not the destination's own wallet; `account_deactivated`: the account is deactivated, and a deactivated account writes no payouts (see the Payouts section); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_already_signed`: another signed transaction is already stored for this payout; `payout_hash_in_use`: another payout records this transaction's hash. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_not_pending`, `transaction_mismatch` (also when the payout was re-prepared meanwhile), `payout_destination_disabled`; `payout_below_minimum`: the destination's `min_amount` was raised above this payout after it was prepared; `payout_destination_unverified`: the destination lost its verification after prepare (a minimum raised above its proof). These last two store nothing: the payout stays `pending` and unsigned — prepare it again, or cancel it. A resend of bytes already stored is not judged again. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The node refused the broadcast (`insufficient_gas_funds`, `nonce_too_low`, `rpc_unavailable`, …). The row is still `pending`, with its signature and `transaction_hash`: resend it. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    resendPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Broadcast; now `submitted` with its hash. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: not the destination's own wallet; `account_deactivated`: the account is deactivated, and a deactivated account writes no payouts (see the Payouts section); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_not_pending`, `payout_not_signed` (nothing stored to resend: submit first), `payout_destination_disabled`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The node refused the broadcast (`insufficient_gas_funds`, `nonce_too_low`, `rpc_unavailable`, …). The row is still `pending`. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    cancelPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Now `failed` with `cancelled`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: not the destination's own wallet; `account_deactivated`: the account is deactivated, and a deactivated account writes no payouts (see the Payouts section); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_already_signed`: the payout holds a signed transaction (resend it, or reuse its nonce from the wallet). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_not_pending`: already submitted or settled. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    reportPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    transaction_hash: string;
                };
            };
        };
        responses: {
            /** @description Now `submitted`. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Payout"];
                };
            };
            401: components["responses"]["Unauthorized"];
            /** @description `not_your_wallet`: not the destination's own wallet; `account_deactivated`: the account is deactivated, and a deactivated account writes no payouts (see the Payouts section); `wallet_deactivated`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `not_found`: no such row in this account (another account's row answers the same). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_already_signed`: a different signed transaction is stored for this payout; `payout_hash_in_use`: another payout records this hash. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description `payout_not_pending` (settled, or failed for a reason other than `submission_timeout` / `dropped`), `foreign_transfer_hash`, `payout_destination_disabled`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
