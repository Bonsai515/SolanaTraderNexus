"use strict";
/**
 * Ensure RPC Connection to Solana
 *
 * This module ensures a stable and reliable connection to Solana RPC nodes,
 * with automatic fallback and connection verification.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRpcConnection = initializeRpcConnection;
exports.getSolanaConnection = getSolanaConnection;
exports.verifyWalletConnection = verifyWalletConnection;
var web3_js_1 = require("@solana/web3.js");
var logger_1 = require("../logger");
// Validate URL formatting with enhanced error handling
var validateRpcUrl = function (url, defaultUrl) {
    if (defaultUrl === void 0) { defaultUrl = 'https://api.mainnet-beta.solana.com'; }
    if (!url)
        return defaultUrl;
    try {
        // Ensure URL has proper prefix
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        else {
            return "https://".concat(url);
        }
    }
    catch (error) {
        logger_1.logger.error("Invalid RPC URL format: ".concat(error));
        return defaultUrl;
    }
};
// Set of backup RPC endpoints with validation and priority order
var RPC_ENDPOINTS = {
    // Primary connection - Instant Nodes premium endpoint (4M daily limit)
    primary: validateRpcUrl(process.env.INSTANT_NODES_RPC_URL, 'https://api.mainnet-beta.solana.com'),
    // Secondary connection - Alchemy endpoint
    alchemy: validateRpcUrl(process.env.ALCHEMY_RPC_URL, 'https://api.mainnet-beta.solana.com'),
    // Tertiary connection - Helius (if API key available)
    helius: process.env.HELIUS_API_KEY ?
        validateRpcUrl("https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY)) :
        'https://api.mainnet-beta.solana.com',
    // Additional fallbacks in case all premium endpoints fail
    fallback1: 'https://solana-api.projectserum.com',
    fallback2: 'https://rpc.ankr.com/solana',
    fallback3: (0, web3_js_1.clusterApiUrl)('mainnet-beta')
};
// Track connection status
var currentEndpoint = 'primary';
var connectionActive = false;
var lastConnectionCheck = 0;
var connectionFailures = {
    primary: 0,
    helius: 0,
    fallback1: 0,
    fallback2: 0,
    fallback3: 0
};
// Main connection instance
var solanaConnection = null;
/**
 * Initialize and verify Solana RPC connection
 */
function initializeRpcConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var blockchainInfo, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info('Initializing Solana RPC connection...');
                    // Try primary first
                    solanaConnection = new web3_js_1.Connection(RPC_ENDPOINTS.primary, {
                        commitment: 'confirmed',
                        disableRetryOnRateLimit: false,
                        confirmTransactionInitialTimeout: 60000
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, solanaConnection.getVersion()];
                case 2:
                    blockchainInfo = _a.sent();
                    logger_1.logger.info("Successfully connected to Solana RPC node. Version: ".concat(blockchainInfo['solana-core']));
                    // Check if we can reach the instant nodes API with 4M requests limit
                    if (RPC_ENDPOINTS.primary.includes('instanton')) {
                        logger_1.logger.info('Using Instant Nodes RPC with 4 million daily request limit');
                    }
                    connectionActive = true;
                    lastConnectionCheck = Date.now();
                    // Start connection monitoring
                    startConnectionMonitoring();
                    return [2 /*return*/, solanaConnection];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.error('Failed to connect to primary Solana RPC:', error_1);
                    connectionFailures.primary++;
                    // Try fallbacks
                    return [2 /*return*/, switchToFallbackRpc()];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Switch to a fallback RPC if primary fails
 */
function switchToFallbackRpc() {
    return __awaiter(this, void 0, void 0, function () {
        var endpoints, sortedEndpoints, currentKey, nextEndpoint, endpoint, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    endpoints = Object.keys(RPC_ENDPOINTS);
                    sortedEndpoints = endpoints.sort(function (a, b) {
                        return (connectionFailures[a] || 0) - (connectionFailures[b] || 0);
                    });
                    currentKey = currentEndpoint;
                    nextEndpoint = sortedEndpoints.find(function (ep) { return ep !== currentKey; }) || 'primary';
                    logger_1.logger.info("Switching from ".concat(currentEndpoint, " to ").concat(nextEndpoint, " RPC endpoint"));
                    currentEndpoint = nextEndpoint;
                    endpoint = RPC_ENDPOINTS[nextEndpoint];
                    solanaConnection = new web3_js_1.Connection(endpoint, {
                        commitment: 'confirmed',
                        disableRetryOnRateLimit: false,
                        confirmTransactionInitialTimeout: 60000
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // Test connection
                    return [4 /*yield*/, solanaConnection.getVersion()];
                case 2:
                    // Test connection
                    _a.sent();
                    connectionActive = true;
                    lastConnectionCheck = Date.now();
                    logger_1.logger.info("Successfully switched to ".concat(nextEndpoint, " RPC endpoint"));
                    return [2 /*return*/, solanaConnection];
                case 3:
                    error_2 = _a.sent();
                    logger_1.logger.error("Failed to connect to ".concat(nextEndpoint, " RPC:"), error_2);
                    connectionFailures[nextEndpoint]++;
                    // Try another one recursively
                    return [2 /*return*/, switchToFallbackRpc()];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Start monitoring the RPC connection
 */
function startConnectionMonitoring() {
    var _this = this;
    setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
        var now, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    if (now - lastConnectionCheck < 30000)
                        return [2 /*return*/];
                    lastConnectionCheck = now;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 7]);
                    if (!solanaConnection) return [3 /*break*/, 3];
                    return [4 /*yield*/, solanaConnection.getLatestBlockhash()];
                case 2:
                    _a.sent();
                    connectionActive = true;
                    return [3 /*break*/, 4];
                case 3: throw new Error('Connection object is null');
                case 4: return [3 /*break*/, 7];
                case 5:
                    error_3 = _a.sent();
                    logger_1.logger.warn("RPC connection check failed for ".concat(currentEndpoint, ":"), error_3);
                    connectionActive = false;
                    connectionFailures[currentEndpoint]++;
                    // Switch to fallback
                    return [4 /*yield*/, switchToFallbackRpc()];
                case 6:
                    // Switch to fallback
                    _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); }, 5000); // Check every 5 seconds
}
/**
 * Get current Solana connection
 */
function getSolanaConnection() {
    if (!solanaConnection) {
        // Create on demand if not exists
        var endpointKey = currentEndpoint;
        var endpoint = RPC_ENDPOINTS[endpointKey] || 'https://api.mainnet-beta.solana.com';
        solanaConnection = new web3_js_1.Connection(endpoint, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: false
        });
        // Start monitoring if not already
        if (!connectionActive) {
            startConnectionMonitoring();
        }
    }
    return solanaConnection;
}
/**
 * Check if wallet exists and has SOL
 */
function verifyWalletConnection(walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var connection, pubkey, accountInfo, balance, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    connection = getSolanaConnection();
                    pubkey = new web3_js_1.PublicKey(walletAddress);
                    return [4 /*yield*/, connection.getAccountInfo(pubkey)];
                case 1:
                    accountInfo = _a.sent();
                    return [4 /*yield*/, connection.getBalance(pubkey)];
                case 2:
                    balance = _a.sent();
                    logger_1.logger.info("Wallet ".concat(walletAddress, " exists: ").concat(accountInfo !== null, ", balance: ").concat(balance / 1e9, " SOL"));
                    return [2 /*return*/, accountInfo !== null && balance > 0];
                case 3:
                    error_4 = _a.sent();
                    logger_1.logger.error("Failed to verify wallet ".concat(walletAddress, ":"), error_4);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Initialize on module load
initializeRpcConnection().catch(function (err) {
    logger_1.logger.error('Failed to initialize any Solana RPC connection:', err);
});
