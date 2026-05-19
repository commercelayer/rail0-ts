export interface paths {
    "/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create a payment intent
         * @description Called by the payer. Creates a payment record and returns the EIP-712 typed-data payload for the payer to sign immediately. The `signingPayload` contains `domain`, `types`, and `message` in standard EIP-712 format: wallet users pass it verbatim to `eth_signTypedData_v4`; backends or SDKs with direct key access compute the same hash with any EIP-712 library and sign it with secp256k1 — the result is identical. The `mode` field determines the flow: `authorize` places funds in escrow for later capture; `charge` is a one-shot authorize+capture with no escrow window. The nonce in the `signingPayload` is derived using the corresponding prefix (`RAIL0.AUTHORIZE` or `RAIL0.CHARGE`), so a signature for one mode cannot be reused for the other. The signed components (v, r, s) must then be submitted to `PUT /payments/{paymentId}/signature`, after which the payee triggers on-chain submission via `POST /payments/{paymentId}/authorize` or `POST /payments/{paymentId}/charge`.
         */
        post: operations["createPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/sign": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Submit the payer's authorization signature
         * @description Called by the payer after signing the `signingPayload` returned by `POST /payments`. Stores the EIP-3009 signature (v, r, s) server-side so that the payee can later trigger on-chain submission via `POST /payments/{paymentId}/authorize` without needing any input from the payer. Idempotent: re-submitting the same signature for the same payment is accepted.
         */
        put: operations["sign"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/capture": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a capture transaction
         * @description Called by the payee to build the unsigned `capture()` transaction. The API validates the amount against the current on-chain state and returns a ready-to-sign EIP-1559 transaction. The payee signs it with their wallet (`eth_signTransaction`) and submits the result to `POST /payments/{paymentId}/capture/submit`.
         */
        post: operations["prepareCapture"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/capture/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Broadcast a signed capture transaction
         * @description Submits a signed capture transaction to the network. The payee is the on-chain sender and pays gas. The `POST /payments/{paymentId}/capture` prepare step is optional: clients that can construct and sign the transaction independently (e.g. via an SDK with ABI knowledge) may call this endpoint directly with a self-built signed transaction. The `paymentId` in the path must match the one encoded in the transaction calldata and must already exist in the API (created via `POST /payments`) so that the stored payment config can be used to decode and return the updated state.
         */
        post: operations["submitCapture"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Release escrowed funds back to the payer
         * @description Submits the RAIL0 `release()` transaction on-chain. Returns all remaining escrowed funds to the payer after `authorizationExpiry` has passed and no full capture occurred. Unlike capture, void, and refund, `release` has no `msg.sender` restriction — anyone can trigger it, so the API acts as relayer and pays gas. No request body or signing step required.
         */
        post: operations["releasePayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit the authorization transaction on-chain
         * @description Called by the payee to relay the payer's previously stored EIP-3009 signature to the RAIL0 `authorize()` function. Funds are pulled from the payer into escrow. The payee is the on-chain transaction sender and pays gas. No request body is required: the signature was already deposited by the payer via `PUT /payments/{paymentId}/signature`.
         */
        post: operations["authorizePayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/charge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit the charge transaction on-chain
         * @description Called by the payee to relay the payer's EIP-3009 signature (mode=charge) to the RAIL0 `charge()` function. Funds are pulled from the payer and immediately distributed to payee and feeReceiver — no escrow window. The payee is the on-chain transaction sender and pays gas. The signature must have been deposited via `PUT /payments/{paymentId}/signature` with a payment created with `mode=charge`.
         */
        post: operations["chargePayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a token approval transaction
         * @description Builds an unsigned ERC-20 `approve(spender, amount)` transaction where `spender` is the RAIL0 contract and the token is taken from the payment config. Required before the payee can broadcast a refund. The payee signs the returned transaction and submits it to `POST /payments/{paymentId}/approve/submit`.
         */
        post: operations["prepareApprove"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/approve/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Broadcast a signed token approval transaction
         * @description Submits a signed ERC-20 `approve` transaction to the network. Once confirmed, the RAIL0 contract is authorized to pull up to `amount` tokens from the payee's wallet, enabling refund operations. The `POST /payments/{paymentId}/approve` prepare step is optional: clients that can construct and sign the transaction independently may call this endpoint directly.
         */
        post: operations["submitApprove"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/void": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a void transaction
         * @description Called by the payee to cancel the authorization and return all escrowed funds to the payer. Void is only possible while `capturableAmount > 0`. The API returns an unsigned transaction; the payee signs it and submits to `POST /payments/{paymentId}/void/submit`.
         */
        post: operations["prepareVoid"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/void/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Broadcast a signed void transaction
         * @description Submits a signed void transaction to the network. All remaining escrowed funds are returned to the payer. The `POST /payments/{paymentId}/void` prepare step is optional: clients that can construct and sign the transaction independently may call this endpoint directly.
         */
        post: operations["submitVoid"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/refund": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Prepare a refund transaction
         * @description Called by the payee to refund a previously captured amount to the payer. The payee must have approved the RAIL0 contract as an ERC-20 spender on the token for at least `amount` before submitting. The API returns an unsigned transaction; the payee signs it and submits to `POST /payments/{paymentId}/refund/submit`.
         */
        post: operations["prepareRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{paymentId}/refund/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Broadcast a signed refund transaction
         * @description Submits a signed refund transaction to the network. The specified amount is pulled from the payee's wallet back to the payer via `transferFrom`. The `POST /payments/{paymentId}/refund` prepare step is optional: clients that can construct and sign the transaction independently may call this endpoint directly.
         */
        post: operations["submitRefund"];
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
            /** @description Merchant address. Authorized to capture, void, and refund. */
            payee: components["schemas"]["Address"];
            /** @description EIP-3009-capable ERC-20 token address (must be accepted by the RAIL0 deployment). */
            token: components["schemas"]["Address"];
            /** @description Upper bound on the authorized amount (fits in uint120). */
            maxAmount: components["schemas"]["Uint256String"];
            /**
             * Format: int64
             * @description Unix timestamp (seconds). Capture must happen before this; release opens after.
             * @example 1780000000
             */
            authorizationExpiry: number;
            /**
             * Format: int64
             * @description Unix timestamp (seconds). Refund must happen before this. Must be >= authorizationExpiry.
             * @example 1785000000
             */
            refundExpiry: number;
            /**
             * @description Fee in basis points (0 = no fee, 10000 = 100%).
             * @example 100
             */
            feeBps: number;
            /** @description Recipient of the fee on each capture. Use the zero address (0x0000…0000) when feeBps is 0. */
            feeReceiver: components["schemas"]["Address"];
        };
        /** @description Parameters needed to create a payment intent. The API generates a unique `paymentId` and constructs the EIP-712 signing payload. */
        CreatePaymentRequest: {
            payment: components["schemas"]["PaymentConfig"];
            /** @description Exact amount to authorize (in token base units). Must be > 0 and <= payment.maxAmount. */
            amount: components["schemas"]["Uint256String"];
            /**
             * @description EVM chain ID of the target network.
             * @example 84532
             */
            chainId: number;
            /**
             * @description `authorize` — funds are held in escrow and captured later by the payee. `charge` — one-shot: funds are immediately distributed to payee and feeReceiver with no escrow window. The two modes use different EIP-3009 nonce prefixes; a signature produced for one cannot be submitted for the other.
             * @default authorize
             * @enum {string}
             */
            mode: "authorize" | "charge";
        };
        /** @description EIP-712 domain for the token contract (used by EIP-3009 TransferWithAuthorization). */
        EIP712Domain: {
            /**
             * @description Token's EIP-712 domain name.
             * @example USD Coin
             */
            name: string;
            /**
             * @description Token's EIP-712 domain version.
             * @example 2
             */
            version: string;
            /**
             * @description EVM chain ID.
             * @example 84532
             */
            chainId: number;
            /** @description Token contract address. */
            verifyingContract: components["schemas"]["Address"];
        };
        /** @description Message fields for the EIP-3009 TransferWithAuthorization typed-data signature. */
        EIP3009Message: {
            /** @description Payer address (token sender). */
            from: components["schemas"]["Address"];
            /** @description RAIL0 contract address (token recipient / escrow). */
            to: components["schemas"]["Address"];
            /** @description Amount to transfer (same as the requested authorization amount). */
            value: components["schemas"]["Uint256String"];
            /** @description Always '0' for RAIL0 authorize flows. */
            validAfter: components["schemas"]["Uint256String"];
            /** @description Equals payment.authorizationExpiry (Unix timestamp as string). */
            validBefore: components["schemas"]["Uint256String"];
            /** @description keccak256(NONCE_PREFIX, paymentId, configHash) where NONCE_PREFIX is `RAIL0.AUTHORIZE` for mode=authorize and `RAIL0.CHARGE` for mode=charge. Binds the signature to the exact Payment configuration and operation type. */
            nonce: components["schemas"]["Bytes32"];
        };
        /** @description EIP-712 typed-data structure that the payer must sign. The `domain`, `types`, and `message` fields follow the EIP-712 standard. Signing options: (a) wallet users pass this object verbatim to `eth_signTypedData_v4`; (b) backends with direct key access compute `keccak256('\x19\x01' || domainSeparator || hashStruct(message))` with any EIP-712 library and sign with secp256k1. Both approaches produce the same (v, r, s) components to submit to `PUT /payments/{paymentId}/signature`. */
        SigningPayload: {
            domain: components["schemas"]["EIP712Domain"];
            /** @description EIP-712 type definitions. */
            types: {
                /**
                 * @description Type definition for EIP-3009 TransferWithAuthorization.
                 * @example [
                 *       {
                 *         "name": "from",
                 *         "type": "address"
                 *       },
                 *       {
                 *         "name": "to",
                 *         "type": "address"
                 *       },
                 *       {
                 *         "name": "value",
                 *         "type": "uint256"
                 *       },
                 *       {
                 *         "name": "validAfter",
                 *         "type": "uint256"
                 *       },
                 *       {
                 *         "name": "validBefore",
                 *         "type": "uint256"
                 *       },
                 *       {
                 *         "name": "nonce",
                 *         "type": "bytes32"
                 *       }
                 *     ]
                 */
                TransferWithAuthorization: {
                    name: string;
                    type: string;
                }[];
            };
            /**
             * @description EIP-712 primary type.
             * @enum {string}
             */
            primaryType: "TransferWithAuthorization";
            message: components["schemas"]["EIP3009Message"];
        };
        CreatePaymentResponse: {
            /** @description Unique identifier for this payment (generated by the API, bytes32 hex). */
            paymentId: components["schemas"]["Bytes32"];
            /** @description EIP-712 hash of the Payment struct over the RAIL0 domain. Commits the signature to the exact payment terms. */
            configHash: components["schemas"]["Bytes32"];
            payment: components["schemas"]["PaymentConfig"];
            /** @description Exact amount to be authorized. */
            amount: components["schemas"]["Uint256String"];
            /**
             * @description EVM chain ID.
             * @example 84532
             */
            chainId: number;
            /** @description Address of the RAIL0 contract on the target chain. */
            rail0Contract: components["schemas"]["Address"];
            signingPayload: components["schemas"]["SigningPayload"];
        };
        /** @description An unsigned EIP-1559 transaction ready for the payee to sign. Signing options: (a) wallet users pass `unsignedTransaction` to `eth_signTransaction`; (b) backends with direct key access sign the RLP blob with any secp256k1 library (e.g. `wallet.signTransaction` in ethers.js). Submit the resulting signed RLP to the corresponding `/submit` endpoint. */
        PrepareTransactionResponse: {
            /**
             * @description RLP-encoded unsigned EIP-1559 transaction (type 2). Pass to `eth_signTransaction` (browser wallet) or sign directly with a secp256k1 library if the key is available in-process.
             * @example 0x02f8...
             */
            unsignedTransaction: string;
            /** @description RAIL0 contract address (informational; already encoded in `unsignedTransaction`). */
            to: components["schemas"]["Address"];
            /**
             * @description ABI-encoded calldata (informational; already encoded in `unsignedTransaction`).
             * @example 0x1234abcd...
             */
            data: string;
            /**
             * @description EVM chain ID.
             * @example 84532
             */
            chainId: number;
            /**
             * @description Transaction nonce for the payee's account.
             * @example 42
             */
            nonce: number;
            /** @description EIP-1559 max fee per gas (wei). */
            maxFeePerGas: components["schemas"]["Uint256String"];
            /** @description EIP-1559 max priority fee per gas (wei). */
            maxPriorityFeePerGas: components["schemas"]["Uint256String"];
            /** @description Estimated gas limit with a safety margin. */
            gasLimit: components["schemas"]["Uint256String"];
        };
        /** @description Signed transaction to submit on-chain. */
        SubmitTransactionRequest: {
            /**
             * @description RLP-encoded signed EIP-1559 transaction as returned by `eth_signTransaction`.
             * @example 0x02f8...
             */
            signedTransaction: string;
        };
        /** @description Amount to capture from escrow. May be less than the total capturable balance for a partial capture. */
        CapturePaymentRequest: {
            /** @description Amount to capture (in token base units). Must be > 0 and <= current capturableAmount. */
            amount: components["schemas"]["Uint256String"];
        };
        CapturePaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `capture()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Gross amount captured in this call (before fee deduction). Matches the `amount` parameter passed to the contract. */
            capturedAmount: components["schemas"]["Uint256String"];
            /** @description Fee deducted from this capture and sent to feeReceiver. '0' when feeBps is 0. */
            feeAmount?: components["schemas"]["Uint256String"];
            /** @description Remaining escrowed amount still available for future captures. */
            capturableAmount: components["schemas"]["Uint256String"];
            /** @description Cumulative amount already captured and eligible for refund (until refundExpiry). */
            refundableAmount: components["schemas"]["Uint256String"];
            /**
             * Format: int64
             * @description Unix timestamp after which further captures are no longer possible.
             * @example 1780000000
             */
            authorizationExpiry?: number;
        };
        /** @description Amount to approve on the token contract. Setting this to the maximum expected refund (or `type(uint256).max` for unlimited) avoids repeated approvals. */
        ApproveRequest: {
            /** @description Allowance to grant the RAIL0 contract (in token base units). Use '115792089237316195423570985008687907853269984665640564039457584007913129639935' for unlimited approval. */
            amount: components["schemas"]["Uint256String"];
        };
        ApproveResponse: {
            /** @description On-chain transaction hash of the `approve()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Token contract on which the approval was set. */
            token: components["schemas"]["Address"];
            /** @description RAIL0 contract address that was approved as spender. */
            spender: components["schemas"]["Address"];
            /** @description Approved allowance amount. */
            amount: components["schemas"]["Uint256String"];
        };
        /** @description Amount to refund to the payer. Must be > 0 and <= current refundableAmount. */
        RefundPaymentRequest: {
            /** @description Amount to refund (in token base units). Must be > 0 and <= current refundableAmount. */
            amount: components["schemas"]["Uint256String"];
        };
        ReleasePaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `release()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Amount returned to the payer (was the full remaining capturableAmount). */
            releasedAmount: components["schemas"]["Uint256String"];
        };
        ChargePaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `charge()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Gross amount charged (before fee deduction). Matches the `amount` parameter passed to the contract. */
            chargedAmount: components["schemas"]["Uint256String"];
            /** @description Fee sent to feeReceiver. '0' when feeBps is 0. */
            feeAmount: components["schemas"]["Uint256String"];
            /** @description Amount eligible for refund (equals chargedAmount; the full gross amount is tracked as refundable by the contract). */
            refundableAmount: components["schemas"]["Uint256String"];
        };
        VoidPaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `void()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Amount returned to the payer (was the full capturableAmount). */
            releasedAmount: components["schemas"]["Uint256String"];
        };
        RefundPaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `refund()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Amount refunded to the payer in this call. */
            refundedAmount: components["schemas"]["Uint256String"];
            /** @description Remaining refundable balance after this refund. */
            refundableAmount: components["schemas"]["Uint256String"];
        };
        /** @description EIP-712 signature over the `signingPayload` returned by `POST /payments`. The payer may produce this with `eth_signTypedData_v4` (browser wallet) or with any EIP-712 library that has direct access to the private key — the on-chain verification only checks the recovered address. */
        PayerSignatureRequest: {
            /**
             * @description Signature recovery byte (27 or 28).
             * @example 28
             * @enum {integer}
             */
            v: 27 | 28;
            /** @description Signature r component. */
            r: components["schemas"]["Bytes32"];
            /** @description Signature s component. */
            s: components["schemas"]["Bytes32"];
        };
        PayerSignatureResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /**
             * @description Confirms the signature was accepted and stored.
             * @enum {string}
             */
            status: "signature_stored";
            /** @description The address recovered from the signature — should match `payment.payer`. Included for client-side verification. */
            recoveredPayer?: components["schemas"]["Address"];
        };
        AuthorizePaymentResponse: {
            /** @description Payment identifier. */
            paymentId: components["schemas"]["Bytes32"];
            /** @description On-chain transaction hash of the `authorize()` call. */
            transactionHash: components["schemas"]["Bytes32"];
            /** @description Amount now held in escrow and available for capture (equals the authorized amount). */
            capturableAmount: components["schemas"]["Uint256String"];
            /**
             * Format: int64
             * @description Unix timestamp after which capture is no longer possible and release becomes available.
             * @example 1780000000
             */
            authorizationExpiry?: number;
        };
        Error: {
            /**
             * @description Machine-readable error code.
             * @example AUTHORIZATION_EXPIRED
             */
            code: string;
            /**
             * @description Human-readable error description.
             * @example The authorization window has already passed.
             */
            message: string;
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
            /** @description Payment intent created. Sign the returned `signingPayload` and submit to `PUT /payments/{paymentId}/signature`. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatePaymentResponse"];
                };
            };
            /** @description Validation error (invalid addresses, expired deadlines, fee config, etc.). */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayerSignatureRequest"];
            };
        };
        responses: {
            /** @description Signature stored. The payee may now call `POST /payments/{paymentId}/authorize`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayerSignatureResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment already authorized on-chain; signature can no longer be updated. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Signature does not recover to the expected payer address. */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CapturePaymentRequest"];
            };
        };
        responses: {
            /** @description Unsigned transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Amount is zero, exceeds capturable balance, or authorizationExpiry has already passed. */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Transaction submitted successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CapturePaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid or malformed signed transaction, or on-chain revert (NotPayee, AuthorizationExpired, InvalidCaptureAmount). */
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
    releasePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Release submitted on-chain successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReleasePaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description On-chain revert — authorizationExpiry not yet reached, or nothing left to release (capturableAmount is 0). */
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
    authorizePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authorization submitted on-chain successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthorizePaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment already authorized (on-chain state already exists). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payer signature not yet submitted, or on-chain revert (e.g. AuthorizationExpired, TokenNotAccepted). */
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
    chargePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Charge submitted on-chain successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChargePaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payment already exists on-chain. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Payer signature not yet submitted, payment was created with mode=authorize, or on-chain revert (e.g. AuthorizationExpired, TokenNotAccepted). */
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
    prepareApprove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApproveRequest"];
            };
        };
        responses: {
            /** @description Unsigned approve transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found. */
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
    submitApprove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Unique payment identifier (bytes32 hex). */
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Approval transaction submitted successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApproveResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid or malformed signed transaction. */
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
                paymentId: components["schemas"]["Bytes32"];
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
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Nothing to void (capturableAmount is already 0). */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Void transaction submitted successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VoidPaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid or malformed signed transaction, or on-chain revert (NotPayee, NothingToVoid). */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefundPaymentRequest"];
            };
        };
        responses: {
            /** @description Unsigned refund transaction ready to sign. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrepareTransactionResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Amount is zero, exceeds refundable balance, or refundExpiry has already passed. */
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
                paymentId: components["schemas"]["Bytes32"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitTransactionRequest"];
            };
        };
        responses: {
            /** @description Refund transaction submitted successfully. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundPaymentResponse"];
                };
            };
            /** @description Payment not found. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid or malformed signed transaction, or on-chain revert (NotPayee, RefundExpired, InvalidRefundAmount, TransferFailed). */
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
