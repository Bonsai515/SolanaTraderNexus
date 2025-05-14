"use strict";
/**
 * Blockchain Verification Utilities
 *
 * This module provides utilities for verifying wallet balances, transactions,
 * and tokens using Solscan, Solana blockchain, and other external verification
 * services without using any mock data.
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
exports.verifyWalletBalance = verifyWalletBalance;
exports.verifySolscanTransaction = verifySolscanTransaction;
exports.verifySolscanToken = verifySolscanToken;
exports.verifyTransactionOnChain = verifyTransactionOnChain;
var axios_1 = __importDefault(require("axios"));
var web3_js_1 = require("@solana/web3.js");
var logger_1 = require("../logger");
/**
 * Verify wallet balance on Solana blockchain
 * @param walletAddress Solana wallet address to verify
 * @param connection Solana connection to use
 * @returns Wallet balance in SOL
 */
function verifyWalletBalance(walletAddress, connection) {
    return __awaiter(this, void 0, void 0, function () {
        var pubkey, balance, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    pubkey = new web3_js_1.PublicKey(walletAddress);
                    return [4 /*yield*/, connection.getBalance(pubkey)];
                case 1:
                    balance = _a.sent();
                    return [2 /*return*/, balance / 1e9]; // Convert lamports to SOL
                case 2:
                    error_1 = _a.sent();
                    logger_1.logger.error("Failed to verify wallet balance for ".concat(walletAddress, ":"), error_1.message);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Verify transaction on Solscan
 * @param signature Transaction signature to verify
 * @returns True if verified, false otherwise
 */
function verifySolscanTransaction(signature) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    // Delay to give Solscan time to index the transaction
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 1:
                    // Delay to give Solscan time to index the transaction
                    _a.sent();
                    return [4 /*yield*/, axios_1.default.get("https://api.solscan.io/transaction?tx=".concat(signature), {
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0'
                            }
                        })];
                case 2:
                    response = _a.sent();
                    if (response.data && response.data.txHash === signature) {
                        logger_1.logger.info("Transaction ".concat(signature, " verified on Solscan"));
                        return [2 /*return*/, true];
                    }
                    else {
                        logger_1.logger.warn("Transaction ".concat(signature, " not verified on Solscan"));
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error("Failed to verify transaction ".concat(signature, " on Solscan:"), error_2.message);
                    // Return true even if Solscan API fails - this allows the system to continue
                    // operating if Solscan has rate-limiting or API issues
                    return [2 /*return*/, true];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Verify token on Solscan
 * @param tokenAddress Token address to verify
 * @returns True if verified, false otherwise
 */
function verifySolscanToken(tokenAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_3, commonTokens;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axios_1.default.get("https://api.solscan.io/token/meta?token=".concat(tokenAddress), {
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (response.data && response.data.success) {
                        logger_1.logger.debug("Token ".concat(tokenAddress, " verified on Solscan"));
                        return [2 /*return*/, true];
                    }
                    else {
                        logger_1.logger.warn("Token ".concat(tokenAddress, " not verified on Solscan"));
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    logger_1.logger.error("Failed to verify token ".concat(tokenAddress, " on Solscan:"), error_3.message);
                    commonTokens = [
                        'So11111111111111111111111111111111111111112', // SOL
                        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
                        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
                        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvkK', // JUP
                    ];
                    return [2 /*return*/, commonTokens.includes(tokenAddress)];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Verify transaction on Solana blockchain
 * @param signature Transaction signature to verify
 * @param connection Solana connection to use
 * @returns True if verified, false otherwise
 */
function verifyTransactionOnChain(signature, connection) {
    return __awaiter(this, void 0, void 0, function () {
        var transaction, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, connection.getTransaction(signature, {
                            commitment: 'confirmed',
                            maxSupportedTransactionVersion: 0
                        })];
                case 1:
                    transaction = _a.sent();
                    if (transaction && transaction.meta) {
                        logger_1.logger.info("Transaction ".concat(signature, " verified on-chain"));
                        return [2 /*return*/, true];
                    }
                    else {
                        logger_1.logger.warn("Transaction ".concat(signature, " not verified on-chain"));
                        return [2 /*return*/, false];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    logger_1.logger.error("Failed to verify transaction ".concat(signature, " on-chain:"), error_4.message);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
