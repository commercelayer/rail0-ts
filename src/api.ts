export interface paths {
    "/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get API version
         * @description Returns the current RAIL0 API and contract version.
         */
        get: operations["getVersion"];
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
        /**
         * Issue a SIWE nonce
         * @description Issues a single-use nonce to embed in a SIWE (EIP-4361) message. The nonce is stored server-side and expires after a short TTL.
         */
        post: operations["issueNonce"];
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
        /**
         * Authenticate via SIWE
         * @description Verify an EIP-4361 SIWE message and its secp256k1 signature. Returns a JWT for use in subsequent authenticated requests.
         */
        post: operations["authenticate"];
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
        /**
         * List supported blockchains
         * @description Returns all blockchain networks supported by this RAIL0 deployment.
         */
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
        /**
         * List supported tokens
         * @description Returns all ERC-20 tokens accepted by this RAIL0 deployment.
         */
        get: operations["listTokens"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/accounts/{account_id}/payment-methods": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List accepted payment methods for a account
         * @description Returns all active wallet configurations for the given account, enriched with chain and token details. Called by the buyer's frontend before `POST /payments` to present available payment options. The `default` flag identifies the pre-selected method; the buyer may confirm it or choose another. The response is stable and safe to cache client-side — it changes only when the account updates their configuration.
         */
        get: operations["getPaymentMethods"];
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
        /**
         * List payments
         * @description Returns a paginated list of payments where the authenticated address is the payer or payee. Requires a valid JWT.
         */
        get: operations["listPayments"];
        put?: never;
        /**
         * Create a payment intent
         * @description Called by the payer. Creates a payment record and returns the EIP-712 typed-data payload for the payer to sign immediately. The `signing_payload` contains `domain`, `types`, and `message` in standard EIP-712 format: wallet users pass it verbatim to `eth_signTypedData_v4`; backends with direct key access compute the same hash with any EIP-712 library and sign it with secp256k1 — the result is identical. The `mode` field determines the flow: `authorize` places funds in escrow for later capture; `charge` is a one-shot authorize+capture with no escrow window. The nonce in the `signing_payload` is derived using the corresponding prefix (`RAIL0.AUTHORIZE` or `RAIL0.CHARGE`), so a signature for one mode cannot be reused for the other. The resulting signature must then be submitted to `PUT /payments/{rail0_id}/sign`, after which the payee prepares the on-chain transaction via `POST /payments/{rail0_id}/authorize/prepare` or `POST /payments/{rail0_id}/charge/prepare`.
         */
        post: operations["createPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get current payment state
         * @description Returns the full payment record from the database, plus live on-chain amounts when the payment is in an active on-chain state (`authorized`, `captured`, `voided`, `released`, `charged`, `refunded`). Clients should poll this endpoint after calling a submit endpoint — the `status` field progresses from `submitting` to the target state (e.g. `authorized`) once the background worker confirms the transaction. If the worker encounters an error, `status` becomes `failed` and the `last_error_code` / `last_error_message` fields explain why.
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
    "/payments/{rail0_id}/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List transactions for a payment
         * @description Returns a paginated list of on-chain transaction attempts associated with a payment. Each operation (authorize, capture, refund, etc.) produces one transaction record.
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
    "/payments/{rail0_id}/sign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Submit the payer's authorization signature
         * @description Called by the payer after signing the `signing_payload` returned by `POST /payments`. Stores the EIP-3009 signature server-side so that the payee can later trigger on-chain submission via `POST /payments/{rail0_id}/authorize/prepare` without needing any further input from the payer.
         */
        put: operations["sign"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/authorize/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an unsigned authorization transaction
         * @description Called by the payee to build the unsigned `authorize()` transaction. Requires the payer's signature to have been deposited via `PUT /payments/{rail0_id}/sign`. Creates a Transaction row with `status: pending`. Returns a ready-to-sign EIP-1559 transaction. The payee signs it and submits to `POST /payments/{rail0_id}/authorize`.
         */
        post: operations["prepareAuthorize"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed authorization transaction
         * @description Called by the payee after signing the unsigned tx from `POST /payments/{rail0_id}/authorize/prepare`. Returns HTTP 202 immediately; the Broadcaster worker picks up the job, broadcasts on-chain, and updates the payment status. Poll `GET /payments/{rail0_id}` for the outcome.
         */
        post: operations["submitAuthorize"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/charge/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an unsigned charge transaction
         * @description Called by the payee to build the unsigned `charge()` transaction. Requires the payer's signature (mode=charge) to have been deposited via `PUT /payments/{rail0_id}/sign`. Creates a Transaction row with `status: pending`. Returns a ready-to-sign EIP-1559 transaction. The payee signs it and submits to `POST /payments/{rail0_id}/charge`.
         */
        post: operations["prepareCharge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/charge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed charge transaction
         * @description Called by the payee after signing the unsigned tx from `POST /payments/{rail0_id}/charge/prepare`. Returns HTTP 202 immediately; the Broadcaster worker broadcasts on-chain and updates the payment status.
         */
        post: operations["submitCharge"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/capture/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an unsigned capture transaction
         * @description Called by the payee to build the unsigned `capture()` transaction. Returns a ready-to-sign EIP-1559 transaction. The payee signs it and submits to `POST /payments/{rail0_id}/capture`. Partial captures are supported: `amount` may be less than the current `capturable_amount`.
         */
        post: operations["prepareCapture"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/capture": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed capture transaction
         * @description Called by the payee after signing the unsigned tx from `POST /payments/{rail0_id}/capture/prepare`. Returns HTTP 202 immediately; the Broadcaster worker broadcasts on-chain and updates the payment status.
         */
        post: operations["submitCapture"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/void/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an unsigned void transaction
         * @description Called by the payee to build the unsigned `void()` transaction. Cancels the authorization and returns all escrowed funds to the payer. Only possible when `status=authorized`. The payee signs the returned transaction and submits to `POST /payments/{rail0_id}/void`.
         */
        post: operations["prepareVoid"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/void": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed void transaction
         * @description Called by the payee after signing the unsigned tx from `POST /payments/{rail0_id}/void/prepare`. Returns HTTP 202 immediately.
         */
        post: operations["submitVoid"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/release/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare an unsigned release transaction
         * @description Called by the payer or payee to build the unsigned `release()` transaction. Returns all remaining escrowed funds to the payer. Available in states `authorized`, `captured`, or `refunded`. The caller signs the returned transaction and submits to `POST /payments/{rail0_id}/release`. If `caller_address` is omitted the API defaults to the payment's `payee`.
         */
        post: operations["prepareRelease"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed release transaction
         * @description Called after signing the unsigned tx from `POST /payments/{rail0_id}/release/prepare`. Returns HTTP 202 immediately.
         */
        post: operations["submitRelease"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/refund/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a refund (two-phase EIP-3009)
         * @description Prepare a refund using EIP-3009 `receiveWithAuthorization`. Two-phase flow:
         *
         *     **Phase 1** — POST with only `amount`. Returns `{ signing_payload }` (EIP-712 typed data for `ReceiveWithAuthorization`). The payee signs this with `eth_signTypedData_v4`.
         *
         *     **Phase 2** — POST with `amount`, `v`, `r`, `s` (from the phase 1 signature). Returns a full `PrepareTransactionResponse` with the unsigned `refund()` transaction (EIP-3009 signature embedded in calldata).
         *
         *     No separate ERC-20 `approve()` step needed.
         */
        post: operations["prepareRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{rail0_id}/refund": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit a signed refund transaction
         * @description Called after signing the unsigned tx from phase 2 of `POST /payments/{rail0_id}/refund/prepare`. Returns HTTP 202 immediately.
         */
        post: operations["submitRefund"];
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
            path?: never;
            cookie?: never;
        };
        /**
         * List wallet tokens for an account
         * @description Returns paginated wallet token configurations for the given account. Public — no authentication required.
         */
        get: operations["listWallets"];
        put?: never;
        post?: never;
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
            path?: never;
            cookie?: never;
        };
        /**
         * Get a wallet token
         * @description Returns a single wallet token record for the given account. Public — no authentication required.
         */
        get: operations["getWallet"];
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
        /**
         * @description EVM address (checksummed or lowercase hex, 20 bytes).
         * @example 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
         */
        Address: string;
        /**
         * @description 32-byte hex value.
         * @example 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab
         */
        Bytes32: string;
        /**
         * @description Non-negative integer encoded as a decimal string to avoid JSON numeric precision loss.
         * @example 1000000
         */
        Uint256String: string;
        /** @description Immutable payment configuration that maps 1-to-1 to the RAIL0 `Payment` Solidity struct. */
        PaymentConfig: {
            /** @description Buyer address. Funds are pulled from this address. */
            payer: components["schemas"]["Address"];
            /** @description Account address. Authorized to capture, void, and refund. */
            payee: components["schemas"]["Address"];
            /** @description EIP-3009-capable ERC-20 token address (must be accepted by the RAIL0 deployment). */
            token: components["schemas"]["Address"];
            /** @description Exact amount the payer commits to pay (in token base units). */
            amount: components["schemas"]["Uint256String"];
            /**
             * Format: int64
             * @description Unix timestamp (seconds). Capture must happen before this; release opens after.
             * @example 1780000000
             */
            authorization_expiry: number;
            /**
             * Format: int64
             * @description Unix timestamp (seconds). Refund must happen before this. Must be >= authorization_expiry.
             * @example 1785000000
             */
            refund_expiry: number;
        };
        /** @description Buyer-supplied payment parameters. Policy fields (authorization_expiry, refund_expiry) are fixed API configuration applied server-side. */
        PaymentInput: {
            /** @description Buyer address. Funds are pulled from this address. */
            payer: components["schemas"]["Address"];
            /** @description Account wallet address (wallet_address from GET /accounts/{id}/payment-methods). */
            payee: components["schemas"]["Address"];
            /** @description ERC-20 token address (token_address from GET /accounts/{id}/payment-methods). */
            token: components["schemas"]["Address"];
            /** @description Amount to pay (in token base units). */
            amount: components["schemas"]["Uint256String"];
        };
        /** @description Parameters needed to create a payment intent. */
        CreatePaymentRequest: {
            /**
             * @description EVM chain ID of the target network.
             * @example 84532
             */
            chain_id: number;
            /**
             * @description `authorize` — funds held in escrow, captured later. `charge` — one-shot: funds immediately distributed. The two modes use different EIP-3009 nonce prefixes; a signature for one cannot be reused for the other.
             * @default authorize
             * @enum {string}
             */
            mode: "authorize" | "charge";
            /** @description Amount to pay (in token base units). */
            amount: components["schemas"]["Uint256String"];
            /** @description ERC-20 token address (token_address from GET /accounts/{id}/wallets). */
            token: components["schemas"]["Address"];
            /** @description Buyer address. Funds are pulled from this address. */
            payer: components["schemas"]["Address"];
            /** @description Account wallet address (wallet_address from GET /accounts/{id}/wallets). */
            payee: components["schemas"]["Address"];
            /**
             * @description Optional human-readable payment label visible to the payer (e.g. "Order #123 — Acme Store").
             * @example Order #123 — Acme Store
             */
            description?: string | null;
            /**
             * @description Arbitrary key-value data for custom reconciliation. Set at creation and immutable. Max 4 KB.
             * @example {
             *       "order_id": "ORD-123",
             *       "customer_ref": "CUST-456"
             *     }
             */
            metadata?: Record<string, never> | null;
        };
        /** @description EIP-712 domain for the token contract. */
        EIP712Domain: {
            /** @example USD Coin */
            name: string;
            /** @example 2 */
            version: string;
            /** @example 84532 */
            chainId: number;
            /** @description Token contract address. */
            verifyingContract: components["schemas"]["Address"];
        };
        /** @description Message fields for the EIP-3009 TransferWithAuthorization signature. */
        EIP3009Message: {
            from: components["schemas"]["Address"];
            /** @description RAIL0 contract address. */
            to: components["schemas"]["Address"];
            value: components["schemas"]["Uint256String"];
            /** @description Always '0' for RAIL0 flows. */
            validAfter: components["schemas"]["Uint256String"];
            /** @description Equals authorization_expiry. */
            validBefore: components["schemas"]["Uint256String"];
            /** @description keccak256(NONCE_PREFIX, rail0_id, config_hash). Binds the signature to the exact config and operation type. */
            nonce: components["schemas"]["Bytes32"];
        };
        /** @description EIP-712 typed-data structure that the payer (or payee for refund) must sign. Pass verbatim to `eth_signTypedData_v4`. */
        SigningPayload: {
            domain: components["schemas"]["EIP712Domain"];
            types: {
                TransferWithAuthorization?: {
                    name: string;
                    type: string;
                }[];
                ReceiveWithAuthorization?: {
                    name: string;
                    type: string;
                }[];
            };
            /** @enum {string} */
            primaryType: "TransferWithAuthorization" | "ReceiveWithAuthorization";
            message: components["schemas"]["EIP3009Message"];
        };
        CreatePaymentResponse: {
            /** @description Unique identifier for this payment. */
            rail0_id: components["schemas"]["Bytes32"];
            /** @description EIP-712 hash of the Payment struct. Commits the signature to the exact payment terms. */
            config_hash: components["schemas"]["Bytes32"];
            payment: components["schemas"]["PaymentConfig"];
            /** @example 84532 */
            chain_id: number;
            /** @description Address of the RAIL0 contract on the target chain. */
            rail0_contract: components["schemas"]["Address"];
            signing_payload: components["schemas"]["SigningPayload"];
            /**
             * @description Optional human-readable payment label.
             * @example Order #123 — Acme Store
             */
            description?: string | null;
            /**
             * @description Arbitrary key-value data attached at creation for custom reconciliation.
             * @example {
             *       "order_id": "ORD-123",
             *       "customer_ref": "CUST-456"
             *     }
             */
            metadata?: Record<string, never> | null;
        };
        /** @description Current state of a payment record. */
        GetPaymentResponse: {
            rail0_id: components["schemas"]["Bytes32"];
            /**
             * @description Current lifecycle state.
             * @enum {string}
             */
            status: "unsigned" | "signed" | "submitting" | "submitted" | "authorized" | "charged" | "captured" | "partially_captured" | "voided" | "released" | "refunded" | "partially_refunded" | "failed";
            /** @enum {string} */
            mode: "authorize" | "charge";
            amount: components["schemas"]["Uint256String"];
            payer: components["schemas"]["Address"];
            payee: components["schemas"]["Address"];
            token: components["schemas"]["Address"];
            /** @example 84532 */
            chain_id: number;
            /**
             * Format: int64
             * @example 1780000000
             */
            authorization_expiry: number;
            /**
             * Format: int64
             * @example 1785000000
             */
            refund_expiry: number;
            /**
             * @description Optional human-readable payment label.
             * @example Order #123 — Acme Store
             */
            description?: string | null;
            /**
             * @description Arbitrary key-value data attached at creation for custom reconciliation.
             * @example {
             *       "order_id": "ORD-123",
             *       "customer_ref": "CUST-456"
             *     }
             */
            metadata?: Record<string, never> | null;
            /** @description Live on-chain amounts. Present when status is authorized, captured, voided, released, charged, or refunded. */
            on_chain?: {
                exists?: boolean;
                capturable_amount?: components["schemas"]["Uint256String"];
                refundable_amount?: components["schemas"]["Uint256String"];
            } | null;
            /** @description Hash of the most recently broadcast transaction. */
            last_broadcast_hash?: components["schemas"]["Bytes32"];
            /**
             * @description Machine-readable failure reason. Present only when status=failed.
             * @example revert
             */
            last_error_code?: string;
            /**
             * @description Human-readable failure description. Present only when status=failed.
             * @example Transaction reverted
             */
            last_error_message?: string;
        };
        /** @description An unsigned EIP-1559 transaction ready for the payee to sign. */
        PrepareTransactionResponse: {
            /**
             * @description RLP-encoded unsigned EIP-1559 transaction (type 2).
             * @example 0x02f8...
             */
            unsigned_transaction: string;
            /**
             * Format: uuid
             * @description Server-side Transaction row ID. Passed back in the submit body to link the signed tx to the prepare step.
             */
            transaction_id: string;
            /** @description Target contract address (informational). */
            to: components["schemas"]["Address"];
            /**
             * @description ABI-encoded calldata (informational).
             * @example 0x1234abcd...
             */
            data: string;
            /** @example 84532 */
            chainId: number;
            /** @example 42 */
            nonce: number;
            maxFeePerGas: components["schemas"]["Uint256String"];
            maxPriorityFeePerGas: components["schemas"]["Uint256String"];
            gasLimit: components["schemas"]["Uint256String"];
        };
        /** @description Signed transaction to broadcast on-chain. */
        SubmitTransactionRequest: {
            /**
             * @description RLP-encoded signed EIP-1559 transaction as returned by `eth_signTransaction`.
             * @example 0x02f8...
             */
            signed_transaction: string;
        };
        /** @description Acknowledgement that the transaction has been enqueued. Poll `GET /payments/{rail0_id}` for the final outcome. */
        SubmitTransactionAcceptedResponse: {
            /** @description Payment identifier. */
            rail0_id: components["schemas"]["Bytes32"];
            /**
             * @description Always `submitting` — the worker has not yet received the on-chain receipt.
             * @enum {string}
             */
            status: "submitting";
        };
        /** @description Amount to capture from escrow. May be less than `capturable_amount` for a partial capture. */
        CapturePaymentRequest: {
            /** @description Amount to capture (in token base units). Must be > 0 and <= current capturable_amount. */
            amount: components["schemas"]["Uint256String"];
        };
        /** @description Amount to refund to the payer. */
        RefundPaymentRequest: {
            /** @description Amount to refund (in token base units). Must be > 0 and <= current refundable_amount. */
            amount: components["schemas"]["Uint256String"];
        };
        /** @description Optional parameters for the release prepare step. */
        ReleaseRequest: {
            /** @description Address of the account that will sign and submit the release transaction. Defaults to the payment's `payee` if omitted. */
            caller_address?: components["schemas"]["Address"];
        };
        /** @description EIP-712 signature over the `signing_payload` returned by `POST /payments`. */
        PayerSignatureRequest: {
            /**
             * @description 65-byte secp256k1 signature (0x-prefixed, 132 chars): r (32 bytes) + s (32 bytes) + v (1 byte).
             * @example 0xd693b532a80fed6392b428604171fb1c5e7a2513e9e785424e8b7cbe6d7f4a4b2b9b7b3f4c2d1e0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f61b
             */
            signature: string;
        };
        PayerSignatureResponse: {
            rail0_id: components["schemas"]["Bytes32"];
            /**
             * @description Confirms the signature was accepted and stored.
             * @enum {string}
             */
            status: "signature_stored";
            /** @description The address recovered from the signature — should match `payment.payer`. */
            recovered_payer: components["schemas"]["Address"];
        };
        /** @description A single accepted payment method for a account: one (chain, token, wallet) combination. */
        PaymentMethod: {
            /** @example 1 */
            id: number;
            /** @example 7 */
            token_id: number;
            /** @example 8453 */
            chain_id: number;
            /** @example Base */
            chain_name: string;
            /** @description ERC-20 token contract address on the chain. */
            token_address: components["schemas"]["Address"];
            /** @example USDC */
            token_symbol: string;
            /** @example 6 */
            token_decimals: number;
            /** @description Account wallet address to use as `payee` in PaymentConfig. */
            wallet_address: components["schemas"]["Address"];
            /** @example true */
            default: boolean;
        };
        /** @description Payload sent by the rail0-indexer when an on-chain event is detected for a known transaction. */
        ConfirmTransactionRequest: {
            /** @description The rail0_id of the payment this transaction belongs to. */
            payment_id: components["schemas"]["Bytes32"];
            /**
             * @description The on-chain event emitted by the RAIL0 contract.
             * @enum {string}
             */
            event_type: "authorized" | "charged" | "captured" | "voided" | "released" | "refunded";
            /**
             * @description Block number in which the transaction was confirmed.
             * @example 12345678
             */
            block_number: number;
            /** @description Token amount from the on-chain event. Required for `captured` and `refunded` events; optional for others. */
            amount?: components["schemas"]["Uint256String"] | null;
        };
        /** @description A RAIL0 merchant account. */
        Account: {
            /** Format: uuid */
            id: string;
            /** @example Acme Corp */
            name: string;
            /** @example acme-corp */
            slug: string;
            /**
             * Format: email
             * @example payments@acme.com
             */
            email: string;
            active: boolean;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            updated_at?: string;
        };
        /** @description Condensed payment record returned by GET /payments. */
        PaymentSummary: {
            rail0_id: components["schemas"]["Bytes32"];
            /** @example authorized */
            status: string;
            /** @enum {string} */
            mode: "authorize" | "charge";
            /** @example 1000000 */
            amount: string;
            payer: components["schemas"]["Address"];
            payee: components["schemas"]["Address"];
            token: components["schemas"]["Address"];
            /** @example 1717500000 */
            authorization_expiry: number;
            /** @example 1717600000 */
            refund_expiry: number;
            /** @example Order #123 — Acme Store */
            description?: string | null;
            /**
             * @example {
             *       "order_id": "ORD-123"
             *     }
             */
            metadata?: Record<string, never> | null;
            /** Format: date-time */
            created_at: string;
        };
        /** @description An on-chain transaction attempt associated with a payment. */
        TransactionRecord: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            operation: "authorize" | "charge" | "capture" | "void" | "release" | "refund";
            /** @enum {string} */
            status: "pending" | "submitting" | "submitted" | "confirmed" | "failed";
            transaction_hash?: components["schemas"]["Bytes32"];
            /** @example 1000000 */
            amount?: string | null;
            /** @example 12345678 */
            block_number?: number | null;
            /** @example 0x08c379a0... */
            error_reason?: string | null;
            /** Format: date-time */
            pending_at?: string | null;
            /** Format: date-time */
            submitted_at?: string | null;
            /** Format: date-time */
            confirmed_at?: string | null;
        };
        /** @description A wallet token configuration linking a wallet address to a specific token on a chain. */
        WalletToken: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            wallet_id: string;
            /** @description Ethereum wallet address. */
            address: components["schemas"]["Address"];
            /** @example Treasury */
            label?: string | null;
            /** @example true */
            default: boolean;
            /** @example true */
            active: boolean;
            /** Format: uuid */
            token_id: string;
            /** @example USDC */
            token_symbol: string;
            token_address: components["schemas"]["Address"];
            /** @example 6 */
            token_decimals: number;
            /** @example 8453 */
            chain_id: number;
            /** @example Base */
            chain_name: string;
            /** @example base */
            chain_slug: string;
        };
        Error: {
            /**
             * @description Human-readable error description.
             * @example Payment cannot be captured in its current state.
             */
            message: string;
            /**
             * @description Machine-readable error code (snake_case).
             * @example not_capturable
             */
            code: string;
        };
        /** @description A blockchain transaction associated with a payment. */
        Transaction: {
            /** @description Keccak256 hash of the broadcast transaction. */
            transaction_hash: components["schemas"]["Bytes32"];
            /** @description Parent payment identifier. */
            rail0_id: components["schemas"]["Bytes32"];
            /**
             * @description Smart contract operation executed by this transaction.
             * @enum {string}
             */
            operation: "authorize" | "charge" | "capture" | "void" | "refund" | "release";
            /**
             * @description `submitted` = broadcast, awaiting confirmation. `confirmed` = mined successfully. `failed` = reverted.
             * @enum {string}
             */
            status: "submitted" | "confirmed" | "failed";
            /** @description Token amount processed. `null` until confirmed. */
            amount?: components["schemas"]["Uint256String"] | null;
            /** @description Block number in which the transaction was mined. `null` until confirmed. */
            block_number?: number | null;
            /**
             * Format: date-time
             * @description ISO 8601 timestamp when the transaction was broadcast on-chain.
             */
            submitted_at: string;
            /**
             * Format: date-time
             * @description ISO 8601 timestamp when the transaction was confirmed. `null` until confirmed.
             */
            confirmed_at?: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getVersion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Version information. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 0.3.0 */
                        version?: string;
                    };
                };
            };
        };
    };
    issueNonce: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Nonce issued. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example abc123xyz */
                        nonce: string;
                        /**
                         * Format: date-time
                         * @description ISO 8601 timestamp when the nonce expires.
                         * @example 2026-06-03T00:05:00Z
                         */
                        expires_at: string;
                    };
                };
            };
        };
    };
    authenticate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description The EIP-4361 SIWE message text that was signed. */
                    message: string;
                    /** @description 65-byte secp256k1 signature over the SIWE message. */
                    signature: string;
                };
            };
        };
        responses: {
            /** @description Authentication successful. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description JWT bearer token for authenticated requests. */
                        token: string;
                        /** @description Ethereum address recovered from the SIWE signature. */
                        address: string;
                        /**
                         * Format: uuid
                         * @description Account UUID, if the signing address is a known account wallet.
                         */
                        account_id?: string | null;
                        /**
                         * @description URL-safe account identifier.
                         * @example acme-corp
                         */
                        account_slug?: string | null;
                        /**
                         * Format: date-time
                         * @description ISO 8601 timestamp when the JWT expires.
                         * @example 2026-06-04T00:00:00Z
                         */
                        expires_at?: string;
                    };
                };
            };
            /** @description Invalid signature or expired nonce. */
            401: {
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
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of supported blockchains. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 8453 */
                        chain_id: number;
                        /** @example Base */
                        name: string;
                        contract_address?: components["schemas"]["Address"];
                    }[];
                };
            };
        };
    };
    listTokens: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of supported tokens. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 7 */
                        id: number;
                        /** @example USDC */
                        symbol: string;
                        address: components["schemas"]["Address"];
                        /** @example 6 */
                        decimals: number;
                        /** @example 8453 */
                        chain_id: number;
                    }[];
                };
            };
        };
    };
    getPaymentMethods: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Account UUID. */
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Array of accepted payment methods, ordered with the default first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaymentMethod"][];
                };
            };
            /** @description Account not found or has no active payment methods. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    listPayments: {
        parameters: {
            query?: {
                /** @description Filter by payment status. */
                status?: string;
                /** @description Filter by payment mode. */
                mode?: "authorize" | "charge";
                /** @description Filter by payer Ethereum address. */
                payer?: string;
                /** @description Filter by payee Ethereum address. */
                payee?: string;
                /** @description Filter by token contract address. */
                token?: string;
                /** @description Page number (1-based, default 1). */
                page?: number;
                /** @description Items per page (default 20, max 100). */
                per_page?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated list of payments. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["PaymentSummary"][];
                        meta: {
                            /** @example 1 */
                            page: number;
                            /** @example 20 */
                            per_page: number;
                            /** @example 42 */
                            total: number;
                        };
                    };
                };
            };
            /** @description Missing or invalid JWT. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createPayment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePaymentRequest"];
            };
        };
        responses: {
            /** @description Payment intent created. Sign the returned `signing_payload` and submit to `PUT /payments/{rail0_id}/sign`. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatePaymentResponse"];
                };
            };
            /** @description Missing or invalid request fields. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation error (unsupported chain_id, invalid mode, etc.). */
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
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current payment state. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetPaymentResponse"];
                };
            };
            /** @description Payment not found. */
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
                /** @description Filter by operation type. */
                operation?: "authorize" | "charge" | "capture" | "void" | "release" | "refund";
                /** @description Filter by transaction status. */
                status?: "pending" | "submitting" | "submitted" | "confirmed" | "failed";
                /** @description Page number (1-based, default 1). */
                page?: number;
                /** @description Items per page (default 20, max 100). */
                per_page?: number;
            };
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated list of transaction records. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TransactionRecord"][];
                        meta: {
                            /** @example 1 */
                            page: number;
                            /** @example 20 */
                            per_page: number;
                            /** @example 3 */
                            total: number;
                        };
                    };
                };
            };
            /** @description Payment not found. */
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
    sign: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayerSignatureRequest"];
            };
        };
        responses: {
            /** @description Signature stored. The payee may now call `POST /payments/{rail0_id}/authorize/prepare`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayerSignatureResponse"];
                };
            };
            /** @description Missing or malformed signature. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found, already signed, or signature does not recover to the expected payer address. */
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
    prepareAuthorize: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Unsigned authorization transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found, payer signature not yet submitted, or payment was created with `mode=charge`. */
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
    submitAuthorize: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. Poll `GET /payments/{rail0_id}` for the outcome. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    prepareCharge: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Unsigned charge transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found, payer signature not yet submitted, or payment was created with `mode=authorize`. */
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
    submitCharge: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    prepareCapture: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CapturePaymentRequest"];
            };
        };
        responses: {
            /** @description Unsigned capture transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Missing `amount` field. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or not in a capturable state (`authorized` or `captured`). */
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
    submitCapture: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    prepareVoid: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Unsigned void transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found or not in `authorized` state. */
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
    submitVoid: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    prepareRelease: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ReleaseRequest"];
            };
        };
        responses: {
            /** @description Unsigned release transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found or not in a releasable state. */
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
    submitRelease: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    prepareRefund: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Amount to refund in token base units.
                     * @example 1000000
                     */
                    amount: string;
                    /**
                     * @description EIP-3009 signature recovery id (phase 2 only).
                     * @example 27
                     */
                    v?: number;
                    /** @description EIP-3009 signature r component, 0x-prefixed (phase 2 only). */
                    r?: string;
                    /** @description EIP-3009 signature s component, 0x-prefixed (phase 2 only). */
                    s?: string;
                };
            };
        };
        responses: {
            /** @description Phase 1: `{ signing_payload }` for the payee to sign. Phase 2: unsigned transaction ready for the payee to sign and submit. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        signing_payload: components["schemas"]["SigningPayload"];
                    } | components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Missing `amount` field. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or not in a refundable state (`captured`, `refunded`, or `charged`). */
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
    submitRefund: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                rail0_id: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction accepted and enqueued. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmitTransactionAcceptedResponse"];
                };
            };
            /** @description Missing `signed_transaction`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment not found or no pending transaction. */
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
    listWallets: {
        parameters: {
            query?: {
                /** @description Filter by EVM chain ID. */
                chain_id?: number;
                /** @description Filter by chain slug (e.g. "base"). */
                chain_slug?: string;
                /** @description Filter by token symbol (e.g. "USDC"). */
                token_symbol?: string;
                /** @description Filter by active flag. Omit to return all records. */
                active?: boolean;
                /** @description Page number (1-based, default 1). */
                page?: number;
                /** @description Items per page (default 20, max 100). */
                per_page?: number;
            };
            header?: never;
            path: {
                /** @description Account UUID. */
                account_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated list of wallet token objects. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WalletToken"][];
                        meta: {
                            /** @example 1 */
                            page: number;
                            /** @example 20 */
                            per_page: number;
                            /** @example 42 */
                            total: number;
                        };
                    };
                };
            };
        };
    };
    getWallet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Account UUID. */
                account_id: string;
                /** @description Wallet token UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Wallet token object. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WalletToken"];
                };
            };
            /** @description Wallet token not found. */
            404: {
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
