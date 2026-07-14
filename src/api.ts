export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness/readiness check (incl. DB connectivity) */
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
        /** Add a wallet to the account */
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
         * @description Idempotent on the `Idempotency-Key` header: when a payment already exists for the key, the existing record is returned with 200 instead of 201.
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
        /** Get a payment with embedded transactions and optional signing payload */
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
        /** Store the payer's signature on a payment */
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
        /** List a payment's transactions */
        get: operations["listPaymentTransactions"];
        put?: never;
        post?: never;
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
                /** @description Payment operation namespace. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an operation's unsigned transaction
         * @description Builds the unsigned transaction and stores it on a new `pending` transaction. Requires the caller to be the payee (bearerAuth), EXCEPT `release`, which is NOT session-gated: it is payer-or-payee on-chain and the payer has no gateway account, so authorization is on-chain (the signed tx + the contract's NotPayerOrPayee gate). `amount` is required for `capture` and `refund`. `refund` is two-phase: with no `signature` it returns `{ signing_payload }` (phase 1, no transaction row created); with `signature` it creates the pending transaction (phase 2).
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
                /** @description Payment operation namespace. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit an operation's signed transaction
         * @description Stores the caller's signed raw transaction on the latest pending transaction for this operation and enqueues the broadcaster. Requires the caller to be the payee (bearerAuth), EXCEPT `release`, which is NOT session-gated (payer-or-payee submit it). As a robustness check the gateway also recovers the signed tx's sender and requires it to match the party the contract accepts as msg.sender — the payee for payee ops, the payer or payee for `release` — returning 403 otherwise and 400 if the tx can't be decoded, before broadcasting. Broadcast happens asynchronously.
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
                /** @description Payment operation namespace. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record an externally-broadcast operation transaction (MetaMask)
         * @description For wallets that sign and broadcast in one step (MetaMask `eth_sendTransaction`) and so cannot hand the gateway a raw `signed_transaction`. The caller broadcasts the prepared transaction themselves and reports its hash here; the gateway attaches the hash to the operation's open transaction and moves it straight to `submitted`, WITHOUT the broadcaster — the indexer then confirms it by hash exactly as for a gateway-broadcast tx. Payee-only (bearerAuth) for every operation, `release` included (MetaMask support is merchant-only): a bare hash carries no signature to authorize it, so the SIWE session is the authorization. Re-callable while the tx is still unconfirmed to OVERWRITE a stuck or wrong hash; a confirmed/failed operation is terminal and returns 422.
         */
        post: operations["submitPaymentOperationByHash"];
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
         * @description Builds the unsigned dispute() transaction on a pending transaction for the payer to sign. Signal-only (no fund effect). NOT session-gated — the payer has no gateway account, so authorization is on-chain (the payer-signed tx + the contract's NotPayer gate). Submit the signed tx to POST /payments/{id}/dispute.
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
         * @description Stores the payer's signed dispute() transaction and enqueues the broadcaster. NOT session-gated; as a robustness check the gateway recovers the signed tx's sender and requires it to be the payer (403 otherwise, 400 if undecodable), mirroring the contract's NotPayer gate. The disputed flag is set when the indexer reports the on-chain event.
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
         * @description Builds the unsigned closeDispute() transaction on a pending transaction for the payer to sign. NOT session-gated — the payer has no gateway account; authorization is on-chain (the payer-signed tx + the contract's NotPayer gate). Submit the signed tx to POST /payments/{id}/dispute/close.
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
         * @description Stores the payer's signed closeDispute() transaction and enqueues the broadcaster. NOT session-gated; as a robustness check the gateway recovers the signed tx's sender and requires it to be the payer (403 otherwise, 400 if undecodable), mirroring the contract's NotPayer gate.
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
        /** List a payment's disputes */
        get: operations["listDisputes"];
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
    "/sync/info": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Indexer/sync status information
         * @description Indexer-facing. Currently not implemented (returns 501).
         */
        get: operations["getSyncInfo"];
        put?: never;
        post?: never;
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
        /** @description Generic error envelope. `status` is a machine-readable code; additional context fields (e.g. `message`, `resource`, `param`, `errors`, `chain_id`) may also be present. */
        Error: {
            status: string;
            message?: string;
        } & {
            [key: string]: unknown;
        };
        Health: {
            /** @enum {string} */
            status?: "ok" | "degraded";
            api_version?: string;
            contract_version?: string;
            /** @enum {string} */
            db?: "ok" | "error";
            active_chains?: number;
            active_contracts?: number;
            /** Format: date-time */
            timestamp?: string;
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
        /** @description Issued after a successful SIWE verification. */
        Session: {
            /** @description JWT bearer token. */
            token?: string;
            /** @description Resolved wallet address. */
            address?: string;
            /** Format: uuid */
            account_id?: string;
            /** @description The account's human-readable name. */
            name?: string;
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
        };
        /** @description Public accepted-token view. */
        Token: {
            chain_id?: number;
            symbol?: string;
            address?: string;
            decimals?: number;
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
        /** @description Base persisted payment fields. */
        Payment: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            contract_id?: string;
            /** @description Protocol-level identifier (66-char hex). */
            rail0_id?: string;
            /** @enum {string} */
            status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "voided" | "released" | "refunded" | "partially_refunded";
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
            chain_id?: number;
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
            /** @enum {string} */
            operation?: "authorize" | "charge" | "capture" | "void" | "release" | "refund";
            /** @enum {string} */
            status?: "pending" | "submitting" | "submitted" | "confirmed" | "failed";
            /** @description Decoded on-chain failure code (null unless status is "failed"): the RAIL0 custom error in snake_case (e.g. "not_payee"), or "revert" when the selector is unknown. The raw revert bytes are not exposed. */
            error_code?: string | null;
            /** @description Human-readable form of error_code (e.g. "NotPayee"); null unless status is "failed". */
            error_message?: string | null;
            unsigned_transaction?: string | null;
            transaction_hash?: string | null;
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
        WebhookTopic: "payments.created" | "payments.signed" | "payments.authorized" | "payments.charged" | "payments.captured" | "payments.voided" | "payments.released" | "payments.refunded" | "payments.failed" | "payments.disputed" | "payments.dispute_closed";
        Webhook: {
            /** Format: uuid */
            id?: string;
            name?: string;
            callback_url?: string;
            topic?: components["schemas"]["WebhookTopic"];
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
            status?: "pending" | "delivered" | "failed";
            /** Format: date-time */
            created_at?: string;
        };
        /** @description Sweeper view of a stale submitted transaction. */
        SyncTransaction: {
            transaction_hash?: string;
            operation?: string;
            /** @description Protocol-level rail0_id. */
            payment_id?: string;
            chain_id?: number;
        };
        /** @description Per-chain indexer config. */
        SyncBlockchain: {
            chain_id?: number;
            start_block?: number;
            required_confirmations?: number;
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
        /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
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
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service healthy. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            /** @description Degraded (database unreachable). */
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
                    /** @description EIP-4361 SIWE message text. */
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
            /** @description SIWE verification failed. The `status` field identifies the failing step: `invalid_siwe`, `invalid_nonce`, `nonce_used`, `signer_mismatch`, or `address_not_registered`. */
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
    listAccountWallets: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
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
                    /** @description EVM wallet address (0x, 40 hex). */
                    address: string;
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
                sort?: components["parameters"]["Sort"];
                status?: "unsigned" | "signed" | "authorized" | "charged" | "captured" | "partially_captured" | "voided" | "released" | "refunded" | "partially_refunded";
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
            /** @description Validation error. `status` is one of `no_active_contract`, `unknown_token`, `invalid_amount`. */
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
                sort?: components["parameters"]["Sort"];
                operation?: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
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
            404: components["responses"]["NotFound"];
        };
    };
    preparePaymentOperation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                /** @description Payment operation namespace. */
                operation: "authorize" | "capture" | "charge" | "void" | "release" | "refund";
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @description Amount (required for capture/refund). */
                    amount?: string;
                    /** @description Payee's EIP-3009 refund signature (refund phase-2 only). */
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
            /** @description Payment not in a state that permits this operation. */
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
                /** @description Payment operation namespace. */
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
                /** @description Payment operation namespace. */
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
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The operation's transaction is already confirmed or failed — its hash is not overwritable. */
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
                    /** @description bytes32 reason code (0x…); defaults to zero. */
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
            403: components["responses"]["Forbidden"];
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
                    /** @description bytes32 reason code (0x…); defaults to zero. */
                    reason?: string;
                };
            };
        };
        responses: {
            /** @description Pending close-dispute transaction with the unsigned payload (closing acts on the existing dispute, so never 201). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Transaction"];
                };
            };
            403: components["responses"]["Forbidden"];
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
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
            404: components["responses"]["NotFound"];
        };
    };
    listWebhooks: {
        parameters: {
            query?: {
                /** @description 1-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Items per page (capped at 100). */
                per_page?: components["parameters"]["PerPage"];
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by topic. */
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
                    topic: components["schemas"]["WebhookTopic"];
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
                /** @description Comma-separated sort fields; prefix with - for descending (e.g. -created_at,status). */
                sort?: components["parameters"]["Sort"];
                /** @description Filter by delivery status. */
                status?: "pending" | "delivered" | "failed";
                /** @description Filter by event topic. */
                topic?: components["schemas"]["WebhookTopic"];
                /** @description Filter by the payment the delivery is for. */
                payment_id?: string;
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
    getSyncInfo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Not implemented yet. */
            501: {
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
                    /** @description On-chain bytes32 paymentId (diagnostics; recorded on a SyncError). */
                    payment_id?: string;
                    /** @description Revert reason / raw error data (fail only). */
                    revert_reason?: string;
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
}
