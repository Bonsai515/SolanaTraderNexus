"use strict";
/**
 * Real Transaction Broadcaster for Solana Blockchain
 *
 * This module handles creating and broadcasting real transactions to the Solana blockchain.
 * It only deals with real transactions - no simulations or test transactions.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.solanaTransactionBroadcaster = exports.SolanaTransactionBroadcaster = void 0;
var web3_js_1 = require("@solana/web3.js");
var logger_1 = require("../logger");
var fs_1 = __importDefault(require("fs"));
// Default connection retry parameters
var DEFAULT_SEND_OPTIONS = {
    skipPreflight: false,
    preflightCommitment: 'finalized',
    maxRetries: 5
};
var SolanaTransactionBroadcaster = /** @class */ (function () {
    function SolanaTransactionBroadcaster(rpcUrl) {
        this.initialized = false;
        this.lastSignature = null;
        // Use provided RPC URL or fallback to environment variable
        var url = rpcUrl || process.env.SOLANA_RPC_URL || process.env.HELIUS_API_KEY
            ? "https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY)
            : 'https://api.mainnet-beta.solana.com';
        this.connection = new web3_js_1.Connection(url, 'finalized');
    }
    /**
     * Initialize the broadcaster
     */
    SolanaTransactionBroadcaster.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var version, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        logger_1.logger.info('Initializing Solana transaction broadcaster');
                        return [4 /*yield*/, this.connection.getVersion()];
                    case 1:
                        version = _a.sent();
                        logger_1.logger.info("Connected to Solana node with version: ".concat(version['solana-core']));
                        this.initialized = true;
                        return [2 /*return*/, true];
                    case 2:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to initialize Solana transaction broadcaster:', error_1);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load a wallet keypair from file
     */
    SolanaTransactionBroadcaster.prototype.loadWalletKeypair = function (walletPath) {
        try {
            var keypairData = JSON.parse(fs_1.default.readFileSync(walletPath, 'utf-8'));
            return web3_js_1.Keypair.fromSecretKey(new Uint8Array(keypairData));
        }
        catch (error) {
            logger_1.logger.error("Failed to load keypair from ".concat(walletPath, ":"), error);
            throw error;
        }
    };
    /**
     * Send SOL from one wallet to another
     */
    SolanaTransactionBroadcaster.prototype.sendSol = function (fromWalletPath_1, toWallet_1, amountSol_1) {
        return __awaiter(this, arguments, void 0, function (fromWalletPath, toWallet, amountSol, options) {
            var fromKeypair, toAddress, transaction, blockhash, signature, error_2;
            if (options === void 0) { options = DEFAULT_SEND_OPTIONS; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        logger_1.logger.info("Sending ".concat(amountSol, " SOL from wallet to ").concat(toWallet));
                        fromKeypair = this.loadWalletKeypair(fromWalletPath);
                        toAddress = new web3_js_1.PublicKey(toWallet);
                        transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                            fromPubkey: fromKeypair.publicKey,
                            toPubkey: toAddress,
                            lamports: amountSol * 1000000000 // Convert SOL to lamports
                        }));
                        // Add priority fee if needed for faster processing
                        transaction.add(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: 1000000 // 0.001 SOL per compute unit
                        }));
                        return [4 /*yield*/, this.connection.getLatestBlockhash('finalized')];
                    case 3:
                        blockhash = (_a.sent()).blockhash;
                        transaction.recentBlockhash = blockhash;
                        transaction.feePayer = fromKeypair.publicKey;
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [fromKeypair], options)];
                    case 4:
                        signature = _a.sent();
                        logger_1.logger.info("Transaction sent with signature: ".concat(signature));
                        this.lastSignature = signature;
                        return [2 /*return*/, signature];
                    case 5:
                        error_2 = _a.sent();
                        logger_1.logger.error('Failed to send SOL:', error_2);
                        throw error_2;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a token swap on Jupiter or Raydium
     */
    SolanaTransactionBroadcaster.prototype.executeTokenSwap = function (walletPath_1, fromToken_1, toToken_1, amountIn_1) {
        return __awaiter(this, arguments, void 0, function (walletPath, fromToken, toToken, amountIn, slippageBps, // 0.5%
        swapInstructions) {
            var walletKeypair, transaction, _i, swapInstructions_1, instruction, blockhash, signature, error_3;
            if (slippageBps === void 0) { slippageBps = 50; }
            if (swapInstructions === void 0) { swapInstructions = []; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        logger_1.logger.info("Swapping ".concat(amountIn, " of ").concat(fromToken, " to ").concat(toToken));
                        walletKeypair = this.loadWalletKeypair(walletPath);
                        // In a real implementation, this would get the actual swap instructions
                        // from Jupiter or Raydium APIs based on the provided tokens and amount
                        if (swapInstructions.length === 0) {
                            throw new Error('Swap instructions must be provided');
                        }
                        transaction = new web3_js_1.Transaction();
                        // Add priority fee for faster processing
                        transaction.add(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: 1000000 // 0.001 SOL per compute unit
                        }));
                        // Add all swap instructions
                        for (_i = 0, swapInstructions_1 = swapInstructions; _i < swapInstructions_1.length; _i++) {
                            instruction = swapInstructions_1[_i];
                            transaction.add(instruction);
                        }
                        return [4 /*yield*/, this.connection.getLatestBlockhash('finalized')];
                    case 3:
                        blockhash = (_a.sent()).blockhash;
                        transaction.recentBlockhash = blockhash;
                        transaction.feePayer = walletKeypair.publicKey;
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [walletKeypair], DEFAULT_SEND_OPTIONS)];
                    case 4:
                        signature = _a.sent();
                        logger_1.logger.info("Swap transaction sent with signature: ".concat(signature));
                        this.lastSignature = signature;
                        return [2 /*return*/, signature];
                    case 5:
                        error_3 = _a.sent();
                        logger_1.logger.error('Failed to execute token swap:', error_3);
                        throw error_3;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a cross-exchange arbitrage transaction
     */
    SolanaTransactionBroadcaster.prototype.executeArbitrage = function (walletPath, route, arbitrageInstructions) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceExchange, targetExchange, tokenPath, amountIn, expectedProfit, walletKeypair, transaction, _i, arbitrageInstructions_1, instruction, blockhash, signature, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        sourceExchange = route.sourceExchange, targetExchange = route.targetExchange, tokenPath = route.tokenPath, amountIn = route.amountIn, expectedProfit = route.expectedProfit;
                        logger_1.logger.info("Executing arbitrage from ".concat(sourceExchange, " to ").concat(targetExchange, " with expected profit of ").concat(expectedProfit, " SOL"));
                        walletKeypair = this.loadWalletKeypair(walletPath);
                        // In a real implementation, this would get the actual arbitrage instructions
                        // from different DEXes based on the provided route
                        if (arbitrageInstructions.length === 0) {
                            throw new Error('Arbitrage instructions must be provided');
                        }
                        transaction = new web3_js_1.Transaction();
                        // Add priority fee for faster processing
                        transaction.add(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: 1200000 // 0.0012 SOL per compute unit - higher for arbitrage
                        }));
                        // Add all arbitrage instructions
                        for (_i = 0, arbitrageInstructions_1 = arbitrageInstructions; _i < arbitrageInstructions_1.length; _i++) {
                            instruction = arbitrageInstructions_1[_i];
                            transaction.add(instruction);
                        }
                        return [4 /*yield*/, this.connection.getLatestBlockhash('finalized')];
                    case 3:
                        blockhash = (_a.sent()).blockhash;
                        transaction.recentBlockhash = blockhash;
                        transaction.feePayer = walletKeypair.publicKey;
                        return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [walletKeypair], __assign(__assign({}, DEFAULT_SEND_OPTIONS), { skipPreflight: true // Skip preflight for arbitrage to avoid false failures
                             }))];
                    case 4:
                        signature = _a.sent();
                        logger_1.logger.info("Arbitrage transaction sent with signature: ".concat(signature));
                        this.lastSignature = signature;
                        return [2 /*return*/, signature];
                    case 5:
                        error_4 = _a.sent();
                        logger_1.logger.error('Failed to execute arbitrage:', error_4);
                        throw error_4;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if a transaction was confirmed
     */
    SolanaTransactionBroadcaster.prototype.checkTransactionConfirmation = function (signature) {
        return __awaiter(this, void 0, void 0, function () {
            var status_1, confirmed, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.connection.getSignatureStatus(signature)];
                    case 1:
                        status_1 = _a.sent();
                        if (status_1 && status_1.value) {
                            confirmed = status_1.value.confirmationStatus === 'confirmed' ||
                                status_1.value.confirmationStatus === 'finalized';
                            if (confirmed) {
                                logger_1.logger.info("Transaction ".concat(signature, " confirmed"));
                            }
                            else {
                                logger_1.logger.info("Transaction ".concat(signature, " not yet confirmed, status: ").concat(status_1.value.confirmationStatus));
                            }
                            return [2 /*return*/, confirmed];
                        }
                        logger_1.logger.warn("Transaction ".concat(signature, " not found"));
                        return [2 /*return*/, false];
                    case 2:
                        error_5 = _a.sent();
                        logger_1.logger.error("Failed to check transaction status for ".concat(signature, ":"), error_5);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get the last transaction signature
     */
    SolanaTransactionBroadcaster.prototype.getLastSignature = function () {
        return this.lastSignature;
    };
    return SolanaTransactionBroadcaster;
}());
exports.SolanaTransactionBroadcaster = SolanaTransactionBroadcaster;
// Export a singleton instance
exports.solanaTransactionBroadcaster = new SolanaTransactionBroadcaster();
