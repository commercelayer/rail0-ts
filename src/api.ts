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
         * @description Admin only (require_admin!: the session account must hold the operator grant — a row in administrators — and be active, re-read from the rows per request, so a revocation bites on the next request; the session wallet must be active even for reads, because these reads are cross-account). Every account, Full entity, each carrying `admin` (whether the account holds the grant). Filters: admin, active; sort and pagination.
         */
        get: operations["listAccounts"];
        put?: never;
        /**
         * Create an account with its first wallet (admin)
         * @description Admin only. The first wallet is required and registered WITHOUT a SIWE proof — the admin vouches: auth resolves the account FROM the wallet, so a walletless account could never be signed into to add one. Ownership is still proven at the owner's first SIWE login; a typo is recoverable by deactivating the wallet before first use. One transaction — the account cannot exist without its wallet. Unique name/email/address collisions answer 409. Creation never carries the operator grant — granting is a separate POST /admin/administrators/{account_id}.
         */
        post: operations["createAccount"];
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
         * @description The account row. The owner reads their own profile (id, name, email and timestamps — the explicit allow-list, with no admin/role field: the operator axis leaves no trace on a standard response); an active admin reads ANY account, whole record (Full entity) plus `admin`, whether the account holds the operator grant. For a non-admin, another account's id and an id that is not an account answer alike, so this cannot be used to tell whether an account exists.
         */
        get: operations["getAccount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update an account: own profile; an admin may also set active
         * @description The one write on the account row. The owner updates name and/or email; active is an operator field — supplying it requires the operator grant (403 otherwise), and an admin may patch ANY account. The grant itself is not writable here: it is granted and revoked on /admin/administrators. Requires an ACTIVE session wallet: deactivation is the revocation primitive, and a revoked key must not be able to redirect the account's contact email. name/email are unique; a taken value is a 409. Last-admin guard: deactivating the account holding the last operative grant is refused with 422 last_admin — including doing it to yourself.
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
                        /** @description Contact email. Unique across accounts. */
                        email?: string;
                        /** @description Active status (admin only). */
                        active?: boolean;
                    };
                };
            };
            responses: {
                /** @description The updated account profile. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Account"];
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
                /** @description Another account's id, or the session wallet is deactivated. */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The name or email is already taken by another account. */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description last_admin: the change would leave zero active admins. */
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
        /** List the account's wallets, each with its token holdings nested */
        get: operations["listAccountWallets"];
        put?: never;
        /**
         * Add a wallet to the account
         * @description Registers a wallet on the account. Requires a SIWE proof-of-ownership of the address being added: obtain a single-use nonce from `POST /auth/nonces`, build an EIP-4361 message carrying that nonce and signed by the address's private key, and submit `message` + `signature` here. The gateway verifies the signature recovers to `address`, the nonce is unused/unexpired, and the message binds to an allowed SIWE domain/chain — otherwise 422. The proven address need not equal the session address (a merchant may control several payee wallets). Wallet addresses are globally unique: an address already registered (to this or any other account) yields 409.
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
        /** Deactivate a wallet (soft delete) */
        delete: operations["deactivateWallet"];
        options?: never;
        head?: never;
        /** Update a wallet label or active status */
        patch: operations["updateWallet"];
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
         * @description Upserts an accepted token/chain combination for the wallet — the same combinations exposed by GET /payment_methods and enforced by POST /payments. Re-enabling a previously-disabled holding reactivates its row (never duplicates). 201 when created, 200 when an existing holding is updated.
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
         * @description Soft-disables the accepted token/chain holding (active:false), removing it from discovery/creation while keeping the row. Re-enable via POST.
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
         * @description Enables an existing holding (active:true). Returns 404 if the wallet has no holding for the token (use POST to create one).
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
         * @description Disables an existing holding (active:false). Returns 404 if the wallet has no holding for the token.
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
         * @description Session required (an account-less token is fine); the `payer` in the body must equal the authenticated address (403 otherwise) — a buyer only drafts payments payable from its own wallet. `payer` and `payee` must be different addresses (a payment to oneself is rejected with 422). Idempotent on the `Idempotency-Key` header, scoped to the caller: when a payment already exists for the key AND the same payer, that record is returned with 200 instead of 201. A key already used by a different account is not shared — it falls through to create and hits the global unique key, returning 409.
         *
         *     **Idempotency-Key** (optional header) REJECTS a reused key rather than replaying it: the same key with different terms answers 422 `idempotency_key_reused`, not 200 carrying the first payment — silently returning a payment whose terms are not the ones just sent is how a client charges the wrong amount. Same key + same terms replays with 200 (amounts compare converted, so "1.0" and "1.00" match). A key already used by another account answers 409, never that account's payment. Rotate per logical order.
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
         * @description Participant-only: readable only by the payment's payer or payee (bearerAuth), not by anyone who learns the id. The payer authenticates with an account-less SIWE token. 401 without a token, 403 for a non-participant. An active admin reads ANY payment, whole record (Full entity): signatures, broadcast bookkeeping, error diagnostics — the operator's debugging view.
         */
        get: operations["getPayment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
         * Re-enqueue a stuck broadcast for this transaction (payee only)
         * @description On-demand doorbell for the recovery the Janitor already performs at cadence: a `pending` transaction still holding its `signed_transaction` is a broadcast the queue lost (a hard worker kill drops the in-flight job), and this re-enqueues the broadcaster for it NOW instead of waiting for the recovery tick. Same redrivable predicate, same enqueue, no new state and no new worker. Payee-only, like the other operation writes. Idempotent under double-click: the broadcaster re-checks under the row lock before sending, so a duplicate enqueue is harmless and never double-broadcasts. Any other state is refused with 422 `not_redrivable`, the detail naming the state the row IS in (a pending row without its signed transaction has nothing to broadcast; submitting/submitted already reached the send; confirmed is settled; a failed row's repair path is the operation's /submitted endpoint, not another send).
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
         * @description Builds the unsigned transaction and stores it on a new `pending` transaction. Session required (bearerAuth) for every operation. The payee operations additionally require the caller to be the payee; `release` is not payee-gated (it is payer-or-payee on-chain and the payer has no gateway account, so its acting party is authorized on-chain — the signed tx + the contract's NotPayerOrPayee gate) but its prepare is still restricted to a payment participant. `amount` is required for `capture` and `refund`. `refund` is two-phase: with no `signature` it returns `{ signing_payload }` (phase 1, no transaction row created); with `signature` it creates the pending transaction (phase 2). `release` is also the one operation with an INVERTED time window: it returns the *uncaptured remainder* of an authorization, which the contract keeps available to the merchant until the authorization expires, so release opens only AFTER `authorization_expiry` and answers 422 `authorization_not_expired` before then (the refusal carries the timestamp). The operation whose card-processing analogue is “cancel the hold early” is `void`, not release — and void requires the authorization to be fully intact, so any capture rules it out permanently.
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
         * @description Account-only (require_account!): headline sales analytics over the merchant account's own payments as payee. 403 for an account-less (buyer) session. Counts are token-agnostic; monetary volume is grouped per (token, chain) and only summed within one token; gas is grouped per chain and denominated in that chain's native token, so it is never summed across chains either, and is additionally sliced by payment status and by operation.
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
         * @description Account-only. Order count per time interval (day/week/month), oldest first. Per-bucket volume is included only when both a token and a chain are filtered (so the sum is over one token); otherwise null.
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
         * @description Account-only. Aggregate orders by `token`, `chain`, `mode`, or `status`. token/chain rows carry per-token volume; mode/status are counts only.
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
        /** Update a webhook (name, callback_url, topic) */
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
        /** Rotate the shared secret — returns the new secret once */
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
    "/sync/blockchains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Start blocks and confirmations per chain for the indexer
         * @description HMAC-protected, indexer-facing.
         */
        get: operations["getSyncBlockchains"];
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
                /** @description On-chain transaction hash. */
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
         * @description Admin only. Deletes the account's administrators row. Read from the row per request everywhere, so the revocation bites on the target's very next request — no token tail. Last-admin guard: revoking the grant that would leave zero operative admins (grants on active accounts) is refused with 422 last_admin — including revoking yourself as the last one.
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
         * Operator diagnostics: worker fleet + divergence signal (admin)
         * @description The worker fleet figures GET /health used to return to any valid JWT (Redis reachability, live worker process count, enqueued backlog), plus `divergences`: the standing count of `balance_divergence` sync errors — confirms whose reported balances disagreed with the gateway's own mirror, which the Syncer records and never rejects. Admin only, and deliberately not on the public GET /health: that endpoint is token-blind, and publishing a detector's own verdicts would tell whoever is probing /sync whether their payload landed. Always 200 — this is operator diagnostics, never a liveness probe: a down fleet is the content (`sidekiq.status: "down"`), and the only 503 in the health surface is the public GET /health's DB gate. Backed by the same 5s-cached probe as GET /health, so polling adds no Redis load.
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
        /** @description Operator diagnostics for GET /admin/health: the Sidekiq worker fleet detail and the balance-divergence signal, always 200 (a down fleet is the content, not an error — this is not a liveness probe). */
        AdminHealth: {
            /** @description Worker fleet health (does not gate liveness anywhere). */
            sidekiq: {
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
            /** @description Balance-divergence signal over `sync_errors` rows with `reason: balance_divergence` — confirms the gateway applied even though the reported capturable/refundable disagreed with its own mirror. Filtered on that one reason: the all-reasons ledger is GET /admin/sync_errors. */
            divergences: {
                /** @description All-time count. The table is never pruned, so this is the full history — context, not the alert. */
                total: number;
                /** @description Rows created in the trailing 24 hours. */
                last_24h: number;
                /**
                 * Format: date-time
                 * @description When the most recent divergence landed, or null when there are none. The figure to act on: a monotonic total says nothing about now.
                 */
                latest_at: string | null;
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
        /** @description Public blockchain view. */
        Blockchain: {
            chain_id?: number;
            name?: string;
            native_symbol?: string;
            network_type?: string;
            explorer_url?: string;
            /** @description Confirmations this gateway waits for before treating a transaction as settled. The FALLBACK rule: where the chain serves a finality tag (see finality_tag) that tag governs instead, so a client showing this number on such a chain is describing a rule that is not in force. */
            required_confirmations?: number;
            /** @description The block tag the chain calls settled (`safe`, `finalized`), when it serves one — and what the gateway actually gates on. Null where the chain serves none, in which case required_confirmations is counted. */
            finality_tag?: string | null;
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
        };
        /** @description A wallet's token holding, with the wallet, token, and blockchain nested via their own schemas. */
        WalletToken: {
            default?: boolean;
            active?: boolean;
            wallet?: components["schemas"]["Wallet"];
            token?: components["schemas"]["Token"];
            blockchain?: components["schemas"]["Blockchain"];
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
            tokens?: components["schemas"]["WalletTokenHolding"][];
        };
        /** @description Base persisted payment fields, plus the `chain_id` of the payment's deployment. */
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
            /** @description Decoded reason of the last failed on-chain attempt; null once the payment makes forward progress. Non-null means the latest attempt failed. */
            last_error_code?: string | null;
            /** @description Human-readable form of last_error_code. */
            last_error_message?: string | null;
            description?: string | null;
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
            /** @description On-chain bytes32 reason code (hex). */
            reason?: string;
            opened_block?: number | null;
            /** Format: date-time */
            opened_at?: string;
            /** @enum {string|null} */
            closed_by?: "payer" | "payee" | null;
            close_reason?: string | null;
            closed_block?: number | null;
            /** Format: date-time */
            closed_at?: string | null;
        };
        DisputeDetail: components["schemas"]["Dispute"] & {
            payment?: components["schemas"]["Payment"];
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
        /** @enum {string} */
        WebhookTopic: "payments.created" | "payments.signed" | "payments.authorized" | "payments.charged" | "payments.captured" | "payments.voided" | "payments.released" | "payments.refunded" | "payments.expired" | "payments.failed" | "payments.disputed" | "payments.dispute_closed";
        /** @description The account's own profile as the holder reads it (GET) and as a PATCH returns it — id, name, email, timestamps. Deliberately no admin/role field: the operator grant lives in a separate table, so a standard account's profile carries no trace of that axis. An ADMIN reading any account gets the whole record plus `admin` instead, which is a different shape and not this one. */
        Account: {
            /** Format: uuid */
            id?: string;
            name?: string;
            email?: string | null;
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
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
            /** Format: uuid */
            payment_id?: string;
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
        };
        /** @description Per-chain indexer config. */
        SyncBlockchain: {
            chain_id?: number;
            start_block?: number;
            /** @description Fallback burial depth, used where the chain serves no finality tag. */
            required_confirmations?: number;
            /**
             * @description Which block the chain calls settled; the indexer gates every notify on it.
             * @enum {string}
             */
            finality_tag?: "safe" | "finalized" | "depth";
            /** @description Block explorer base URL; null when the chain has none. */
            explorer_url?: string | null;
            /** @description "testnet" or "mainnet"; selects which chains a deployment indexes. */
            network_type?: string;
            /** @description Ordered list of public RPC endpoints tried in turn (serial fallback). */
            rpc_urls?: string[];
            /** @description Active RAIL0 contract addresses on the chain (all watched versions). */
            contracts?: string[];
        };
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
        /** @description Current page. */
        XPage: number;
        /** @description Items per page. */
        XPerPage: number;
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
            /** @description SIWE verification failed. The `code` field identifies the failing step: `invalid_siwe`, `invalid_nonce`, `nonce_used`, `signer_mismatch`, or one of the four binding failures `siwe_domain_not_allowed` / `siwe_uri_mismatch` / `siwe_chain_mismatch` / `siwe_proof_expired` (each names the value the caller sent, never the gateway's expected value). An address with no gateway account is NOT a failure — it yields an account-less token (200). */
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
                    "application/json": Record<string, never>;
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
            /** @description Active blockchains that carry at least one active token (a payment method is a chain+token pair). */
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
                /** @description Filter by active status. */
                active?: boolean;
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
    createAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Display name. Unique. */
                    name: string;
                    /** @description Contact email. Unique. */
                    email: string;
                    /** @description The owner's wallet address (0x…40 hex). Vouched, not proven. */
                    address: string;
                    /** @description Label for the first wallet. */
                    label?: string;
                };
            };
        };
        responses: {
            /** @description The created account, whole record (Full entity). */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            /** @description A required field is missing or malformed. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description name, email or wallet address already taken. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
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
            /** @description The account's profile: id, name, email, created_at, updated_at. */
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
            /** @description Wallet created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Wallet"];
                };
            };
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
                    "application/json": components["schemas"]["WalletToken"];
                };
            };
            /** @description Holding created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletToken"];
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
                    "application/json": components["schemas"]["WalletToken"];
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
                    "application/json": components["schemas"]["WalletToken"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). An unsupported field is rejected with 422 `invalid_sort`, whose detail names the allowed set — it is never silently dropped (#243). */
                sort?: components["parameters"]["Sort"];
                /** @description Lifecycle state. Deliberately a HAPPY-PATH label, not a ledger: a partial operation does NOT move it, so a payment captured 100 and refunded 40 still reads `captured`, and a full refund that leaves uncaptured escrow does too. `capturable_amount` / `refundable_amount` are the authoritative residuals — reconcile on those, not on this. `partially_refunded` is retained for historical rows only and is no longer produced. */
                status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "expired" | "voided" | "released" | "refunded" | "partially_refunded";
                mode?: "authorize" | "charge";
                payer?: string;
                payee?: string;
                token?: string;
                /** @description Filter by the logical on-chain payment id (0x…). */
                rail0_id?: string;
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
                    "x-page": components["headers"]["XPage"];
                    "x-per-page": components["headers"]["XPerPage"];
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
                    description?: string;
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
            /** @description Payment not signable or signer mismatch. */
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
                status?: "pending" | "submitting" | "submitted" | "confirmed" | "failed";
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
        };
    };
    preparePaymentOperation: {
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
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Amount (required for capture/refund). */
                    amount?: string;
                    /** @description Payee's EIP-3009 refund signature (refund phase-2 only; 0x + 130 hex). */
                    signature?: string;
                    /** @description Submitter address (release; defaults to payer). */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
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
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description bytes32 reason code (0x + 64 hex); defaults to zero. */
                    reason?: string;
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
            404: components["responses"]["NotFound"];
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    prepareCloseDispute: {
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
                    /** @description bytes32 reason code (0x + 64 hex); defaults to zero. */
                    reason?: string;
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
            404: components["responses"]["NotFound"];
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
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
            /** @description Order counts, by-status counts, refund/dispute rates, and per-(token, chain) volume: gross authorized, net settled to the payee, still in escrow, and gross captured/refunded from the confirmed transactions (base units). Plus `gas` per chain — `spent` on confirmed transactions and `wasted` by on-chain reverts, as wei-scale base-unit strings in the chain's native token (decimals 18) — with `confirmed`/`failed` resolved transaction counts, and `failed_rate` derived from them (per resolved transaction, not per order). `gas_by_status` and `gas_by_operation` are those same rows regrouped, each carrying a `key` (the payment status / the operation) alongside the same fields; every cut sums back to its chain's `gas` row. The status cut is a SNAPSHOT — a payment's status moves and its gas moves with it, so the same period changes over time; the operation cut is stable. Each chain/status row carries `orders`, the count of payments behind it (including those that produced no transaction), so `(spent + wasted) / orders` is the average cost of an order in that state; it is null on the operation cut, where one order spans several operations and `spent / confirmed` is the meaningful average instead. Gas covers only the operations the merchant broadcasts; dispute/close_dispute are the buyer's cost and release has no stored sender, so both are excluded. Also `failures` — one row per decoded failure code with the number of the merchant's transactions that hit it, commonest first — and `confirmation_secs` on each gas row: the mean seconds from broadcast to confirmation on that chain, weighted by its confirmations and null when none confirmed. */
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
            /** @description One row per dimension key with an order count (and volume for token/chain). */
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
                    /** @description Event topics for this subscription — one secret and one circuit breaker for all of them. Repeated values are collapsed. Exactly one of `topics` or `topic` must be sent. */
                    topics?: components["schemas"]["WebhookTopic"][];
                    /**
                     * @deprecated
                     * @description Deprecated alias for a single-element `topics`.
                     */
                    topic?: components["schemas"]["WebhookTopic"];
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
            422: components["responses"]["Validation"];
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
                    /**
                     * @deprecated
                     * @description Deprecated alias for a single-element `topics`.
                     */
                    topic?: components["schemas"]["WebhookTopic"];
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
                /** @description Filter by the payment the delivery is for. */
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
    getSyncBlockchains: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Per-chain indexer config. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncBlockchain"][];
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
                /** @description On-chain transaction hash. */
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
                    /** @description On-chain amount (confirm only). */
                    amount?: string;
                    /** @description Live on-chain capturable balance after the event, base units (confirm only; sent by fund-affecting events, omitted by dispute/dispute_closed). The gateway mirrors it — the indexer is the single source. */
                    capturable_amount?: string;
                    /** @description Live on-chain refundable balance after the event, base units (confirm only; sent by fund-affecting events, omitted by dispute/dispute_closed). The gateway mirrors it — the indexer is the single source. */
                    refundable_amount?: string;
                    /** @description Block the event was mined in (required on confirm). */
                    block_number?: number;
                    /** @description Event position within the block (orders same-block confirms; optional, older indexers omit it). */
                    log_index?: number;
                    /** @description On-chain bytes32 paymentId, read from the event. REQUIRED: it is the compensating control for the submit-by-hash hole — /{operation}/submitted accepts a transaction hash no node has seen yet, so the Syncer's comparison of this value against the payment the transaction row belongs to is what rejects a squatted hash. It was optional, which meant a caller omitting it silently skipped that check. */
                    payment_id: string;
                    /** @description Revert reason / raw error data (fail only). */
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
            /** @description last_admin: the revoke would leave zero active admins. */
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
            /** @description The fleet diagnostics and the divergence signal. */
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
}
