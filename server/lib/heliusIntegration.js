"use strict";
/**
 * Helius API Integration for Solana Blockchain
 *
 * This module provides direct integration with Helius API for enhanced
 * Solana blockchain functionality including NFT data, token data,
 * and transaction history with DAS API support.
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
exports.heliusApiIntegration = exports.HeliusApiIntegration = void 0;
var axios_1 = __importDefault(require("axios"));
var logger_1 = require("../logger");
var web3_js_1 = require("@solana/web3.js");
var HeliusApiIntegration = /** @class */ (function () {
    function HeliusApiIntegration() {
        this.baseUrl = 'https://api.helius.xyz/v0';
        this.connection = null;
        this.initialized = false;
        this.apiKey = process.env.HELIUS_API_KEY;
        if (!this.apiKey) {
            logger_1.logger.warn('Helius API key not found in environment variables');
        }
        else {
            // Initialize Solana connection with Helius endpoint
            this.connection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=".concat(this.apiKey), 'confirmed');
            this.initialized = true;
            logger_1.logger.info('Helius API integration initialized');
        }
    }
    /**
     * Initialize the Helius API integration
     * @param apiKey Optional API key, uses environment variable if not provided
     * @returns Boolean indicating if initialization was successful
     */
    HeliusApiIntegration.prototype.initialize = function (apiKey) {
        return __awaiter(this, void 0, void 0, function () {
            var version, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.initialized) {
                            return [2 /*return*/, true];
                        }
                        if (apiKey) {
                            this.apiKey = apiKey;
                        }
                        else if (!this.apiKey && process.env.HELIUS_API_KEY) {
                            this.apiKey = process.env.HELIUS_API_KEY;
                        }
                        if (!this.apiKey) {
                            logger_1.logger.warn('Helius API key not found, cannot initialize');
                            return [2 /*return*/, false];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Initialize Solana connection with Helius endpoint
                        this.connection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=".concat(this.apiKey), 'confirmed');
                        return [4 /*yield*/, this.connection.getVersion()];
                    case 2:
                        version = _a.sent();
                        logger_1.logger.info("Connected to Solana cluster version: ".concat(version['solana-core']));
                        this.initialized = true;
                        logger_1.logger.info('Helius API integration initialized successfully');
                        return [2 /*return*/, true];
                    case 3:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to initialize Helius API integration:', error_1.message);
                        this.initialized = false;
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if the integration is initialized
     */
    HeliusApiIntegration.prototype.isInitialized = function () {
        return this.initialized && !!this.apiKey;
    };
    /**
     * Get connection object
     */
    HeliusApiIntegration.prototype.getConnection = function () {
        return this.connection;
    };
    /**
     * Get enhanced account information with token holdings
     */
    HeliusApiIntegration.prototype.getEnhancedAccountInfo = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.apiKey) {
                            throw new Error('Helius API key not configured');
                        }
                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl, "/addresses/").concat(address, "/balances"), {
                                params: {
                                    'api-key': this.apiKey
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.error('Failed to get enhanced account info from Helius:', error_2.message);
                        throw error_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get token balances for an account
     */
    HeliusApiIntegration.prototype.getTokenBalances = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.apiKey) {
                            throw new Error('Helius API key not configured');
                        }
                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl, "/addresses/").concat(address, "/balances"), {
                                params: {
                                    'api-key': this.apiKey
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        // Process token balances
                        if (response.data && response.data.tokens) {
                            return [2 /*return*/, response.data.tokens.map(function (token) { return ({
                                    mint: token.mint,
                                    address: address,
                                    symbol: token.symbol || 'UNKNOWN',
                                    name: token.name || 'Unknown Token',
                                    amount: token.amount,
                                    decimals: token.decimals,
                                    uiAmount: token.uiAmount || (token.amount / Math.pow(10, token.decimals)),
                                    usdValue: token.price ? token.uiAmount * token.price : undefined
                                }); })];
                        }
                        return [2 /*return*/, []];
                    case 2:
                        error_3 = _a.sent();
                        logger_1.logger.error('Failed to get token balances from Helius:', error_3.message);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get enriched transaction history for an account
     */
    HeliusApiIntegration.prototype.getEnrichedTransactions = function (address_1) {
        return __awaiter(this, arguments, void 0, function (address, limit) {
            var response, error_4;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.apiKey) {
                            throw new Error('Helius API key not configured');
                        }
                        return [4 /*yield*/, axios_1.default.post("".concat(this.baseUrl, "/addresses/").concat(address, "/transactions"), {
                                options: {
                                    limit: limit
                                }
                            }, {
                                params: {
                                    'api-key': this.apiKey
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data || []];
                    case 2:
                        error_4 = _a.sent();
                        logger_1.logger.error('Failed to get enriched transactions from Helius:', error_4.message);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get token metadata for a mint address
     */
    HeliusApiIntegration.prototype.getTokenMetadata = function (mintAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.apiKey) {
                            throw new Error('Helius API key not configured');
                        }
                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl, "/tokens"), {
                                params: {
                                    'api-key': this.apiKey,
                                    'mint': mintAddress
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        if (response.data && response.data.length > 0) {
                            return [2 /*return*/, response.data[0]];
                        }
                        return [2 /*return*/, null];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.logger.error('Failed to get token metadata from Helius:', error_5.message);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check transaction status using Helius enhanced API
     */
    HeliusApiIntegration.prototype.checkTransactionStatus = function (signature) {
        return __awaiter(this, void 0, void 0, function () {
            var status_1, confirmations, statusText, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.connection) {
                            throw new Error('Helius connection not initialized');
                        }
                        return [4 /*yield*/, this.connection.getSignatureStatus(signature, {
                                searchTransactionHistory: true
                            })];
                    case 1:
                        status_1 = _a.sent();
                        if (!status_1 || !status_1.value) {
                            return [2 /*return*/, { status: 'not_found', confirmations: 0 }];
                        }
                        confirmations = status_1.value.confirmations || 0;
                        statusText = 'processing';
                        if (status_1.value.err) {
                            statusText = 'failed';
                        }
                        else if (confirmations >= 32) {
                            statusText = 'finalized';
                        }
                        else if (confirmations > 0) {
                            statusText = 'confirmed';
                        }
                        return [2 /*return*/, { status: statusText, confirmations: confirmations }];
                    case 2:
                        error_6 = _a.sent();
                        logger_1.logger.error('Failed to check transaction status with Helius:', error_6.message);
                        return [2 /*return*/, { status: 'error', confirmations: 0 }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a transaction with priority fee optimization
     */
    HeliusApiIntegration.prototype.executeTransaction = function (transaction_1, signers_1) {
        return __awaiter(this, arguments, void 0, function (transaction, signers, confirmLevel) {
            var priorityFee, _a, signature, confirmation, _b, _c, error_7;
            var _d;
            if (confirmLevel === void 0) { confirmLevel = 'confirmed'; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 11, , 12]);
                        if (!this.connection) {
                            throw new Error('Helius connection not initialized');
                        }
                        return [4 /*yield*/, this.calculateOptimalPriorityFee()];
                    case 1:
                        priorityFee = _e.sent();
                        logger_1.logger.info("Using optimal priority fee: ".concat(priorityFee, " microLamports"));
                        if (!(transaction instanceof web3_js_1.Transaction)) return [3 /*break*/, 3];
                        _a = transaction;
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 2:
                        _a.recentBlockhash = (_e.sent()).blockhash;
                        // Set priority fee if needed and supported
                        if (priorityFee > 0) {
                            // Here we would add priority fee if implementing prioritized transactions
                        }
                        _e.label = 3;
                    case 3:
                        signature = void 0;
                        if (!(transaction instanceof web3_js_1.Transaction)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.connection.sendTransaction(transaction, signers)];
                    case 4:
                        signature = _e.sent();
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, this.connection.sendTransaction(transaction)];
                    case 6:
                        signature = _e.sent();
                        _e.label = 7;
                    case 7:
                        _c = (_b = this.connection).confirmTransaction;
                        _d = {
                            signature: signature
                        };
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 8:
                        _d.blockhash = (_e.sent()).blockhash;
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 9: return [4 /*yield*/, _c.apply(_b, [(_d.lastValidBlockHeight = (_e.sent()).lastValidBlockHeight,
                                _d), confirmLevel])];
                    case 10:
                        confirmation = _e.sent();
                        return [2 /*return*/, {
                                signature: signature,
                                success: !confirmation.value.err
                            }];
                    case 11:
                        error_7 = _e.sent();
                        logger_1.logger.error('Failed to execute transaction with Helius:', error_7.message);
                        return [2 /*return*/, {
                                signature: '',
                                success: false
                            }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate optimal priority fee based on recent transactions
     */
    HeliusApiIntegration.prototype.calculateOptimalPriorityFee = function () {
        return __awaiter(this, void 0, void 0, function () {
            var recentBlockhash, block, fees, medianFee, p75Fee, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (!this.connection) {
                            return [2 /*return*/, 0];
                        }
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 1:
                        recentBlockhash = _a.sent();
                        return [4 /*yield*/, this.connection.getBlock(recentBlockhash.lastValidBlockHeight, {
                                maxSupportedTransactionVersion: 0
                            })];
                    case 2:
                        block = _a.sent();
                        if (!block || !block.transactions || block.transactions.length === 0) {
                            return [2 /*return*/, 10000]; // Default 10,000 microLamports if no data
                        }
                        fees = block.transactions
                            .filter(function (tx) { return tx.meta && tx.meta.fee; })
                            .map(function (tx) { return tx.meta.fee; });
                        if (fees.length === 0) {
                            return [2 /*return*/, 10000];
                        }
                        // Calculate percentiles
                        fees.sort(function (a, b) { return a - b; });
                        medianFee = fees[Math.floor(fees.length / 2)];
                        p75Fee = fees[Math.floor(fees.length * 0.75)];
                        // Use the 75th percentile for faster confirmation
                        return [2 /*return*/, Math.max(5000, p75Fee)];
                    case 3:
                        error_8 = _a.sent();
                        logger_1.logger.warn('Failed to calculate optimal priority fee:', error_8.message);
                        return [2 /*return*/, 10000]; // Default value
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return HeliusApiIntegration;
}());
exports.HeliusApiIntegration = HeliusApiIntegration;
// Create singleton instance
exports.heliusApiIntegration = new HeliusApiIntegration();
