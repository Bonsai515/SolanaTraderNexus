"use strict";
/**
 * Transaction Verification System
 *
 * This module provides blockchain verification of transactions using Solscan
 * and direct Solana RPC verification. It ensures all executed trades are
 * properly verified and recorded in the blockchain with confirmations.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionVerifier = exports.TransactionVerifier = void 0;
var axios_1 = __importDefault(require("axios"));
var web3_js_1 = require("@solana/web3.js");
var logger_1 = require("../logger");
var heliusIntegration_1 = require("./heliusIntegration");
/**
 * Transaction Verifier Class
 */
var TransactionVerifier = /** @class */ (function () {
    /**
     * Constructor
     * @param rpcUrl Solana RPC URL
     */
    function TransactionVerifier(rpcUrl) {
        this.solanaConnection = null;
        this.initialized = false;
        this.verifyRetryAttempts = 3;
        // Try to use Helius connection if available
        if (heliusIntegration_1.heliusApiIntegration.isInitialized()) {
            this.solanaConnection = heliusIntegration_1.heliusApiIntegration.getConnection();
            this.initialized = true;
            logger_1.logger.info('Transaction verifier initialized with Helius connection');
        }
        else if (rpcUrl) {
            this.solanaConnection = new web3_js_1.Connection(rpcUrl, 'confirmed');
            this.initialized = true;
            logger_1.logger.info('Transaction verifier initialized with provided RPC connection');
        }
        else {
            this.solanaConnection = null;
            this.initialized = false;
            logger_1.logger.warn('No valid RPC connection for transaction verifier');
        }
        // Get Solscan API key from environment if available
        this.solscanApiKey = process.env.SOLSCAN_API_KEY;
    }
    /**
     * Initialize the transaction verifier
     */
    TransactionVerifier.prototype.initialize = function (rpcUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.initialized) {
                            return [2 /*return*/, true];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        if (heliusIntegration_1.heliusApiIntegration.isInitialized()) {
                            this.solanaConnection = heliusIntegration_1.heliusApiIntegration.getConnection();
                        }
                        else if (rpcUrl) {
                            this.solanaConnection = new web3_js_1.Connection(rpcUrl, 'confirmed');
                        }
                        else if (process.env.HELIUS_API_KEY) {
                            this.solanaConnection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY), 'confirmed');
                        }
                        else {
                            throw new Error('No valid RPC connection for transaction verifier');
                        }
                        if (!this.solanaConnection) return [3 /*break*/, 3];
                        // Test connection
                        return [4 /*yield*/, this.solanaConnection.getVersion()];
                    case 2:
                        // Test connection
                        _a.sent();
                        this.initialized = true;
                        logger_1.logger.info('Transaction verifier initialized successfully');
                        return [2 /*return*/, true];
                    case 3: return [2 /*return*/, false];
                    case 4:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to initialize transaction verifier:', error_1.message);
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if the verifier is initialized
     */
    TransactionVerifier.prototype.isInitialized = function () {
        return this.initialized && !!this.solanaConnection;
    };
    /**
     * Verify a transaction using direct Solana RPC
     */
    TransactionVerifier.prototype.verifyTransaction = function (signature) {
        return __awaiter(this, void 0, void 0, function () {
            var attempt_1, status_1, error_2, confirmations, verified, blockTime, slot, txInfo, error_3, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 14, , 15]);
                        if (!(!this.initialized || !this.solanaConnection)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        if (!this.solanaConnection) {
                            throw new Error('Transaction verifier not properly initialized');
                        }
                        _a.label = 2;
                    case 2:
                        attempt_1 = 0;
                        status_1 = null;
                        _a.label = 3;
                    case 3:
                        if (!(attempt_1 < this.verifyRetryAttempts)) return [3 /*break*/, 9];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 8]);
                        return [4 /*yield*/, this.solanaConnection.getSignatureStatus(signature, {
                                searchTransactionHistory: true
                            })];
                    case 5:
                        status_1 = _a.sent();
                        return [3 /*break*/, 9];
                    case 6:
                        error_2 = _a.sent();
                        logger_1.logger.warn("Verification attempt ".concat(attempt_1 + 1, " failed, retrying..."));
                        attempt_1++;
                        if (attempt_1 >= this.verifyRetryAttempts) {
                            throw error_2;
                        }
                        // Wait before retrying
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt_1); })];
                    case 7:
                        // Wait before retrying
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 3];
                    case 9:
                        if (!status_1 || !status_1.value) {
                            return [2 /*return*/, {
                                    signature: signature,
                                    verified: false,
                                    confirmations: 0,
                                    error: 'Transaction not found on blockchain'
                                }];
                        }
                        confirmations = status_1.value.confirmations || 0;
                        verified = confirmations > 0 && !status_1.value.err;
                        blockTime = void 0, slot = void 0;
                        if (!verified) return [3 /*break*/, 13];
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.solanaConnection.getTransaction(signature, {
                                maxSupportedTransactionVersion: 0
                            })];
                    case 11:
                        txInfo = _a.sent();
                        blockTime = (txInfo === null || txInfo === void 0 ? void 0 : txInfo.blockTime) || undefined;
                        slot = (txInfo === null || txInfo === void 0 ? void 0 : txInfo.slot) || undefined;
                        return [3 /*break*/, 13];
                    case 12:
                        error_3 = _a.sent();
                        logger_1.logger.warn("Failed to get transaction details for ".concat(signature));
                        return [3 /*break*/, 13];
                    case 13: return [2 /*return*/, {
                            signature: signature,
                            verified: verified,
                            confirmations: confirmations,
                            blockTime: blockTime,
                            slot: slot,
                            solscanLink: "https://solscan.io/tx/".concat(signature),
                            error: status_1.value.err ? JSON.stringify(status_1.value.err) : undefined
                        }];
                    case 14:
                        error_4 = _a.sent();
                        logger_1.logger.error("Failed to verify transaction ".concat(signature, ":"), error_4.message);
                        return [2 /*return*/, {
                                signature: signature,
                                verified: false,
                                confirmations: 0,
                                error: error_4.message
                            }];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get transaction details from Solscan
     */
    TransactionVerifier.prototype.getTransactionDetailsFromSolscan = function (signature) {
        return __awaiter(this, void 0, void 0, function () {
            var response, txData, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("https://api.solscan.io/transaction?tx=".concat(signature), {
                                headers: this.solscanApiKey ? {
                                    'token': this.solscanApiKey
                                } : undefined
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.data || response.data.status !== 'success') {
                            logger_1.logger.warn("Solscan API returned invalid response for ".concat(signature));
                            return [2 /*return*/, null];
                        }
                        txData = response.data.data;
                        return [2 /*return*/, {
                                signature: signature,
                                status: txData.status === 0 ? 'success' : 'failed',
                                blockTime: txData.blockTime,
                                slot: txData.slot,
                                fee: txData.fee,
                                confirmations: txData.confirmations || 0,
                                solscanLink: "https://solscan.io/tx/".concat(signature),
                                rawData: txData
                            }];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.logger.error("Failed to get transaction details from Solscan for ".concat(signature, ":"), error_5.message);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify token balance change after transaction
     */
    TransactionVerifier.prototype.verifyTokenBalanceChange = function (walletAddress, tokenMint, expectedChangePercent) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenAccounts, balances, totalBalance, error_6;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!this.initialized || !this.solanaConnection) {
                            throw new Error('Transaction verifier not properly initialized');
                        }
                        return [4 /*yield*/, this.solanaConnection.getTokenAccountsByOwner(new web3_js_1.PublicKey(walletAddress), { mint: new web3_js_1.PublicKey(tokenMint) })];
                    case 1:
                        tokenAccounts = _a.sent();
                        if (tokenAccounts.value.length === 0) {
                            logger_1.logger.warn("No token accounts found for wallet ".concat(walletAddress, " and token ").concat(tokenMint));
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, Promise.all(tokenAccounts.value.map(function (account) { return __awaiter(_this, void 0, void 0, function () {
                                var accountInfo;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.solanaConnection.getTokenAccountBalance(account.pubkey)];
                                        case 1:
                                            accountInfo = _a.sent();
                                            return [2 /*return*/, {
                                                    address: account.pubkey.toString(),
                                                    balance: accountInfo.value.uiAmount || 0
                                                }];
                                    }
                                });
                            }); }))];
                    case 2:
                        balances = _a.sent();
                        totalBalance = balances.reduce(function (sum, account) { return sum + account.balance; }, 0);
                        logger_1.logger.info("Verified token balance for ".concat(walletAddress, ": ").concat(totalBalance, " ").concat(tokenMint));
                        // For now, just return true if we have any balance
                        // In a real implementation, you would compare with a previous balance
                        return [2 /*return*/, totalBalance > 0];
                    case 3:
                        error_6 = _a.sent();
                        logger_1.logger.error('Failed to verify token balance change:', error_6.message);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Monitor transaction until confirmed
     */
    TransactionVerifier.prototype.monitorUntilConfirmed = function (signature_1) {
        return __awaiter(this, arguments, void 0, function (signature, maxRetries, interval) {
            var retries, result;
            if (maxRetries === void 0) { maxRetries = 10; }
            if (interval === void 0) { interval = 2000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.initialized || !this.solanaConnection) {
                            throw new Error('Transaction verifier not properly initialized');
                        }
                        retries = 0;
                        _a.label = 1;
                    case 1:
                        if (!(retries < maxRetries)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.verifyTransaction(signature)];
                    case 2:
                        result = _a.sent();
                        if (result.verified && result.confirmations > 0) {
                            logger_1.logger.info("Transaction ".concat(signature, " confirmed with ").concat(result.confirmations, " confirmations"));
                            return [2 /*return*/, result];
                        }
                        retries++;
                        logger_1.logger.debug("Waiting for transaction confirmation (attempt ".concat(retries, "/").concat(maxRetries, ")..."));
                        // Wait before checking again
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, interval); })];
                    case 3:
                        // Wait before checking again
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 4:
                        logger_1.logger.warn("Transaction ".concat(signature, " not confirmed after ").concat(maxRetries, " attempts"));
                        return [2 /*return*/, {
                                signature: signature,
                                verified: false,
                                confirmations: 0,
                                error: 'Transaction not confirmed within timeout period'
                            }];
                }
            });
        });
    };
    return TransactionVerifier;
}());
exports.TransactionVerifier = TransactionVerifier;
// Create singleton instance
exports.transactionVerifier = new TransactionVerifier();
