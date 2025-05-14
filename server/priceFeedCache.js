"use strict";
/**
 * Price Feed System with Rate-Limited Cache
 *
 * This module provides a comprehensive price feed system for the entire application
 * with automatic caching to respect RPC and API rate limits.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.priceFeedCache = void 0;
var axios_1 = __importDefault(require("axios"));
var logger_1 = require("./logger");
var web3 = __importStar(require("@solana/web3.js"));
// Cache Configuration
var CACHE_TTL_MS = {
    DEX: 30 * 1000, // 30 seconds for DEX prices
    CEX: 15 * 1000, // 15 seconds for CEX prices
    ORACLE: 60 * 1000, // 1 minute for oracle prices
    CHAINLINK: 90 * 1000, // 1.5 minutes for Chainlink
    PYTH: 15 * 1000, // 15 seconds for Pyth
    HELIUS: 2 * 60 * 1000, // 2 minutes for Helius API
    WORMHOLE: 2 * 60 * 1000 // 2 minutes for Wormhole
};
// The main price cache
var PriceFeedCache = /** @class */ (function () {
    function PriceFeedCache() {
        var _this = this;
        this.priceCache = new Map();
        this.solanaConnection = null;
        this.rateLimits = {
            'INSTANT_NODES': {
                dailyLimit: 40000,
                currentUsage: 0,
                resetTime: Date.now() + 24 * 60 * 60 * 1000
            },
            'HELIUS': {
                dailyLimit: 100000,
                currentUsage: 0,
                resetTime: Date.now() + 24 * 60 * 60 * 1000
            },
            'BLOCKCHAIN_API': {
                dailyLimit: 20000,
                currentUsage: 0,
                resetTime: Date.now() + 24 * 60 * 60 * 1000
            }
        };
        this.dexSources = [
            { name: 'Jupiter', enabled: true, priority: 1, rateLimitPerMinute: 600 },
            { name: 'Raydium', enabled: true, priority: 2, rateLimitPerMinute: 300 },
            { name: 'Orca', enabled: true, priority: 3, rateLimitPerMinute: 300 },
            { name: 'Openbook', enabled: true, priority: 4, rateLimitPerMinute: 200 }
        ];
        // Popular token addresses for quick lookup
        this.POPULAR_TOKENS = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            'BONK': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
            'WIF': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvkK',
            'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
            'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
            'BTC': '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E'
        };
        logger_1.logger.info('Initializing Price Feed Cache system');
        this.heliusApiKey = process.env.HELIUS_API_KEY;
        this.wormholeApiKey = process.env.WORMHOLE_API_KEY;
        // Connect to Solana with proper error handling for RPC URL
        try {
            var rpcUrl = process.env.INSTANT_NODES_RPC_URL;
            // Validate RPC URL format
            if (rpcUrl && (rpcUrl.startsWith('http://') || rpcUrl.startsWith('https://'))) {
                logger_1.logger.info("Using RPC URL from environment: ".concat(rpcUrl.substring(0, 15), "..."));
                this.solanaConnection = new web3.Connection(rpcUrl, 'confirmed');
            }
            else {
                // Fallback to public endpoint
                logger_1.logger.warn('Invalid or missing RPC URL, falling back to public Solana endpoint');
                this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
            }
        }
        catch (error) {
            logger_1.logger.error("Error initializing Solana connection: ".concat(error.message));
            // Initialize with public endpoint as fallback
            this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        }
        // Initialize a housekeeping interval to clean up expired cache entries
        setInterval(function () { return _this.cleanExpiredEntries(); }, 5 * 60 * 1000); // Run every 5 minutes
        // Initialize rate limit reset timers
        Object.keys(this.rateLimits).forEach(function (api) {
            var resetTimeMs = _this.rateLimits[api].resetTime - Date.now();
            if (resetTimeMs > 0) {
                setTimeout(function () { return _this.resetRateLimitCounter(api); }, resetTimeMs);
            }
            else {
                _this.resetRateLimitCounter(api);
            }
        });
    }
    /**
     * Connect to required services for price data
     */
    PriceFeedCache.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, reconnectError_1, jupiterResponse, error_2, error_3, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 17, , 18]);
                        logger_1.logger.info('Connecting to price feed services...');
                        // Re-verify and potentially reconnect to Solana
                        if (!this.solanaConnection) {
                            logger_1.logger.warn('No Solana connection, initializing new connection');
                            this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 10]);
                        if (!this.solanaConnection) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.solanaConnection.getLatestBlockhash()];
                    case 2:
                        _a.sent();
                        logger_1.logger.info('Successfully connected to Solana RPC for price data');
                        return [3 /*break*/, 4];
                    case 3: throw new Error('Solana connection not initialized');
                    case 4: return [3 /*break*/, 10];
                    case 5:
                        error_1 = _a.sent();
                        logger_1.logger.warn("Error connecting to Solana RPC: ".concat(error_1.message));
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        logger_1.logger.info('Attempting to reconnect using public Solana API');
                        this.solanaConnection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
                        return [4 /*yield*/, this.solanaConnection.getLatestBlockhash()];
                    case 7:
                        _a.sent();
                        logger_1.logger.info('Successfully reconnected to Solana using public API');
                        return [3 /*break*/, 9];
                    case 8:
                        reconnectError_1 = _a.sent();
                        logger_1.logger.error("Failed to reconnect to Solana: ".concat(reconnectError_1.message));
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 10];
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, axios_1.default.get('https://quote-api.jup.ag/v4/tokens')];
                    case 11:
                        jupiterResponse = _a.sent();
                        logger_1.logger.info("Successfully connected to Jupiter API. Found ".concat(jupiterResponse.data.length, " tokens."));
                        return [3 /*break*/, 13];
                    case 12:
                        error_2 = _a.sent();
                        logger_1.logger.warn("Error connecting to Jupiter API: ".concat(error_2.message));
                        return [3 /*break*/, 13];
                    case 13:
                        _a.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, this.prefetchPopularTokens()];
                    case 14:
                        _a.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        error_3 = _a.sent();
                        logger_1.logger.warn("Error prefetching token prices: ".concat(error_3.message));
                        return [3 /*break*/, 16];
                    case 16: 
                    // Even with errors, return true to continue with best effort
                    return [2 /*return*/, true];
                    case 17:
                        error_4 = _a.sent();
                        logger_1.logger.error("Failed to connect to price feed services: ".concat(error_4.message));
                        // Return true anyway to allow the system to function with limited price capabilities
                        return [2 /*return*/, true];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Reset rate limit counter for an API
     */
    PriceFeedCache.prototype.resetRateLimitCounter = function (api) {
        var _this = this;
        if (this.rateLimits[api]) {
            this.rateLimits[api].currentUsage = 0;
            this.rateLimits[api].resetTime = Date.now() + 24 * 60 * 60 * 1000; // Reset after 24 hours
            // Schedule next reset
            setTimeout(function () { return _this.resetRateLimitCounter(api); }, 24 * 60 * 60 * 1000);
            logger_1.logger.info("Rate limit counter reset for ".concat(api));
        }
    };
    /**
     * Track API usage for rate limiting
     */
    PriceFeedCache.prototype.trackApiUsage = function (api) {
        if (!this.rateLimits[api])
            return true; // No limits if not tracked
        // Check if we need to reset
        if (Date.now() > this.rateLimits[api].resetTime) {
            this.resetRateLimitCounter(api);
        }
        // Check if we're over limit
        if (this.rateLimits[api].currentUsage >= this.rateLimits[api].dailyLimit) {
            logger_1.logger.warn("Rate limit exceeded for ".concat(api, ", ").concat(this.rateLimits[api].currentUsage, "/").concat(this.rateLimits[api].dailyLimit));
            return false;
        }
        // Track usage
        this.rateLimits[api].currentUsage++;
        return true;
    };
    /**
     * Clean expired cache entries
     */
    PriceFeedCache.prototype.cleanExpiredEntries = function () {
        var now = Date.now();
        var expiredCount = 0;
        for (var _i = 0, _a = this.priceCache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            var ttl = CACHE_TTL_MS[entry.source] || 60 * 1000; // Default 1 minute
            if (now - entry.timestamp > ttl) {
                this.priceCache.delete(key);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            logger_1.logger.debug("Cleaned ".concat(expiredCount, " expired price entries from cache"));
        }
    };
    /**
     * Prefetch prices for popular tokens
     */
    PriceFeedCache.prototype.prefetchPopularTokens = function () {
        return __awaiter(this, void 0, void 0, function () {
            var symbols, fetchPromises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info('Prefetching prices for popular tokens...');
                        symbols = Object.keys(this.POPULAR_TOKENS);
                        fetchPromises = symbols.map(function (symbol) {
                            return _this.getTokenPrice(_this.POPULAR_TOKENS[symbol], symbol);
                        });
                        return [4 /*yield*/, Promise.allSettled(fetchPromises)];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("Completed prefetching prices for ".concat(symbols.length, " popular tokens"));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get the cache key for a token
     */
    PriceFeedCache.prototype.getCacheKey = function (tokenAddress) {
        return tokenAddress.toLowerCase();
    };
    /**
     * Get token price prioritizing cache
     */
    PriceFeedCache.prototype.getTokenPrice = function (tokenAddress, tokenSymbol) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cachedEntry, ttl, _i, _a, _b, symbol, address, jupiterPrice, error_5, heliusPrice, error_6, raydiumPrice, error_7, error_8;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cacheKey = this.getCacheKey(tokenAddress);
                        cachedEntry = this.priceCache.get(cacheKey);
                        if (cachedEntry) {
                            ttl = CACHE_TTL_MS[cachedEntry.source] || 60 * 1000;
                            if (Date.now() - cachedEntry.timestamp < ttl) {
                                return [2 /*return*/, cachedEntry.price];
                            }
                        }
                        // Find token symbol if not provided
                        if (!tokenSymbol) {
                            for (_i = 0, _a = Object.entries(this.POPULAR_TOKENS); _i < _a.length; _i++) {
                                _b = _a[_i], symbol = _b[0], address = _b[1];
                                if (address.toLowerCase() === tokenAddress.toLowerCase()) {
                                    tokenSymbol = symbol;
                                    break;
                                }
                            }
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 14, , 15]);
                        if (!this.trackApiUsage('BLOCKCHAIN_API')) return [3 /*break*/, 5];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.fetchJupiterPrice(tokenAddress)];
                    case 3:
                        jupiterPrice = _c.sent();
                        if (jupiterPrice > 0) {
                            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', jupiterPrice, 'DEX', 0.9);
                            return [2 /*return*/, jupiterPrice];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _c.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        if (!(this.heliusApiKey && this.trackApiUsage('HELIUS'))) return [3 /*break*/, 9];
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.fetchHeliusPrice(tokenAddress)];
                    case 7:
                        heliusPrice = _c.sent();
                        if (heliusPrice > 0) {
                            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', heliusPrice, 'HELIUS', 0.95);
                            return [2 /*return*/, heliusPrice];
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        error_6 = _c.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        if (!this.trackApiUsage('BLOCKCHAIN_API')) return [3 /*break*/, 13];
                        _c.label = 10;
                    case 10:
                        _c.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.fetchRaydiumPrice(tokenAddress)];
                    case 11:
                        raydiumPrice = _c.sent();
                        if (raydiumPrice > 0) {
                            this.updateCache(tokenAddress, tokenSymbol || 'UNKNOWN', raydiumPrice, 'DEX', 0.85);
                            return [2 /*return*/, raydiumPrice];
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        error_7 = _c.sent();
                        return [3 /*break*/, 13];
                    case 13:
                        // Return cached value if all else fails
                        if (cachedEntry) {
                            logger_1.logger.warn("Using outdated price for ".concat(tokenSymbol || tokenAddress, " from cache"));
                            return [2 /*return*/, cachedEntry.price];
                        }
                        // Last resort: make an educated guess based on addresses for well-known stablecoins
                        if (tokenAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
                            tokenAddress === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') { // USDT
                            return [2 /*return*/, 1.0];
                        }
                        throw new Error("Failed to fetch price for token ".concat(tokenSymbol || tokenAddress));
                    case 14:
                        error_8 = _c.sent();
                        logger_1.logger.error("Error fetching token price: ".concat(error_8.message));
                        // Return cached value even if expired as a last resort
                        if (cachedEntry) {
                            logger_1.logger.warn("Using expired price for ".concat(tokenSymbol || tokenAddress, " from cache as fallback"));
                            return [2 /*return*/, cachedEntry.price];
                        }
                        throw new Error("Failed to get price for ".concat(tokenSymbol || tokenAddress, ": ").concat(error_8.message));
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update price cache with new data
     */
    PriceFeedCache.prototype.updateCache = function (tokenAddress, tokenSymbol, price, source, confidence, volume24h, change24h) {
        var cacheKey = this.getCacheKey(tokenAddress);
        this.priceCache.set(cacheKey, {
            symbol: tokenSymbol,
            address: tokenAddress,
            price: price,
            timestamp: Date.now(),
            source: source,
            confidence: confidence,
            volume24h: volume24h,
            change24h: change24h
        });
    };
    /**
     * Fetch price from Jupiter API
     */
    PriceFeedCache.prototype.fetchJupiterPrice = function (tokenAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_9, response, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(tokenAddress === 'So11111111111111111111111111111111111111112')) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.get('https://price.jup.ag/v4/price?ids=SOL')];
                    case 2:
                        response = _a.sent();
                        if (response.data && response.data.data && response.data.data.SOL) {
                            return [2 /*return*/, response.data.data.SOL.price];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_9 = _a.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, axios_1.default.get("https://price.jup.ag/v4/price?ids=".concat(tokenAddress))];
                    case 5:
                        response = _a.sent();
                        if (response.data && response.data.data && response.data.data[tokenAddress]) {
                            return [2 /*return*/, response.data.data[tokenAddress].price];
                        }
                        throw new Error('Token not found in Jupiter API');
                    case 6:
                        error_10 = _a.sent();
                        logger_1.logger.debug("Jupiter price fetch failed for ".concat(tokenAddress, ": ").concat(error_10.message));
                        throw error_10;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch price from Helius API
     */
    PriceFeedCache.prototype.fetchHeliusPrice = function (tokenAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.heliusApiKey) {
                            throw new Error('Helius API key not configured');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, axios_1.default.post("https://api.helius.xyz/v0/tokens/price?api-key=".concat(this.heliusApiKey), { mintAddresses: [tokenAddress] })];
                    case 2:
                        response = _a.sent();
                        if (response.data && response.data.length > 0 && response.data[0].price) {
                            return [2 /*return*/, response.data[0].price];
                        }
                        throw new Error('Token not found in Helius API');
                    case 3:
                        error_11 = _a.sent();
                        logger_1.logger.debug("Helius price fetch failed for ".concat(tokenAddress, ": ").concat(error_11.message));
                        throw error_11;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch price from Raydium API
     */
    PriceFeedCache.prototype.fetchRaydiumPrice = function (tokenAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("https://api.raydium.io/v2/main/price?token=".concat(tokenAddress))];
                    case 1:
                        response = _a.sent();
                        if (response.data && response.data.data && !isNaN(parseFloat(response.data.data))) {
                            return [2 /*return*/, parseFloat(response.data.data)];
                        }
                        throw new Error('Token not found in Raydium API');
                    case 2:
                        error_12 = _a.sent();
                        logger_1.logger.debug("Raydium price fetch failed for ".concat(tokenAddress, ": ").concat(error_12.message));
                        throw error_12;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all available token prices in cache
     */
    PriceFeedCache.prototype.getAllCachedPrices = function () {
        return Array.from(this.priceCache.values());
    };
    /**
     * Get current cache statistics
     */
    PriceFeedCache.prototype.getCacheStats = function () {
        var _this = this;
        var entries = Array.from(this.priceCache.values());
        var now = Date.now();
        // Count by source
        var sources = {};
        entries.forEach(function (entry) {
            sources[entry.source] = (sources[entry.source] || 0) + 1;
        });
        // Calculate average age
        var totalAge = entries.reduce(function (sum, entry) { return sum + (now - entry.timestamp); }, 0);
        var avgAge = entries.length > 0 ? totalAge / entries.length : 0;
        // Format rate limits
        var rateLimits = {};
        Object.keys(this.rateLimits).forEach(function (api) {
            rateLimits[api] = {
                current: _this.rateLimits[api].currentUsage,
                limit: _this.rateLimits[api].dailyLimit,
                resetIn: Math.max(0, _this.rateLimits[api].resetTime - now)
            };
        });
        return {
            cacheSize: entries.length,
            sources: sources,
            avgAge: avgAge,
            rateLimits: rateLimits
        };
    };
    return PriceFeedCache;
}());
// Export singleton instance
exports.priceFeedCache = new PriceFeedCache();
