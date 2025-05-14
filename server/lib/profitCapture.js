"use strict";
/**
 * Profit Capture System for Solana Trading
 *
 * This module handles collecting trading profits to the system wallet.
 * It manages periodic capture of profits, ensuring they are securely
 * transferred to the designated wallet for further capital deployment.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.profitCapture = exports.ProfitCapture = void 0;
var web3_js_1 = require("@solana/web3.js");
var fs = __importStar(require("fs"));
var logger_1 = require("../logger");
var heliusIntegration_1 = require("./heliusIntegration");
var transactionVerifier_1 = require("./transactionVerifier");
/**
 * Profit Capture System
 */
var ProfitCapture = /** @class */ (function () {
    /**
     * Constructor
     * @param systemWalletAddress System wallet address for profit collection
     */
    function ProfitCapture(systemWalletAddress) {
        this.initialized = false;
        this.agentProfits = new Map();
        this.captureInterval = 30 * 60 * 1000; // 30 minutes
        this.lastCaptureTime = 0;
        this.connection = null;
        this.autoCapture = true;
        this.captureTimerId = null;
        this.systemWalletAddress = systemWalletAddress || 'HXqzZuPG7TGLhgYGAkAzH67tXmHNPwbiXiTi3ivfbDqb';
        // Try to use Helius connection if available
        if (heliusIntegration_1.heliusApiIntegration.isInitialized()) {
            this.connection = heliusIntegration_1.heliusApiIntegration.getConnection();
            this.initialized = true;
            logger_1.logger.info('Profit capture system initialized with Helius connection');
        }
        else if (process.env.HELIUS_API_KEY) {
            this.connection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY), 'confirmed');
            this.initialized = true;
            logger_1.logger.info('Profit capture system initialized with Helius connection');
        }
        else {
            logger_1.logger.warn('No valid RPC connection for profit capture system');
        }
        // Load saved profit data if available
        this.loadProfitData();
    }
    /**
     * Initialize the profit capture system
     */
    ProfitCapture.prototype.initialize = function (rpcUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var systemWallet, accountInfo, balance, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.initialized) {
                            return [2 /*return*/, true];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        if (heliusIntegration_1.heliusApiIntegration.isInitialized()) {
                            this.connection = heliusIntegration_1.heliusApiIntegration.getConnection();
                        }
                        else if (rpcUrl) {
                            this.connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
                        }
                        else if (process.env.HELIUS_API_KEY) {
                            this.connection = new web3_js_1.Connection("https://mainnet.helius-rpc.com/?api-key=".concat(process.env.HELIUS_API_KEY), 'confirmed');
                        }
                        else {
                            throw new Error('No valid RPC connection for profit capture system');
                        }
                        systemWallet = new web3_js_1.PublicKey(this.systemWalletAddress);
                        return [4 /*yield*/, this.connection.getAccountInfo(systemWallet)];
                    case 2:
                        accountInfo = _a.sent();
                        if (!!accountInfo) return [3 /*break*/, 3];
                        logger_1.logger.warn("System wallet ".concat(this.systemWalletAddress, " not found on blockchain"));
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.connection.getBalance(systemWallet)];
                    case 4:
                        balance = _a.sent();
                        logger_1.logger.info("System wallet ".concat(this.systemWalletAddress, " found with balance: ").concat(balance / web3_js_1.LAMPORTS_PER_SOL, " SOL"));
                        _a.label = 5;
                    case 5:
                        this.initialized = true;
                        // Start automatic capture if enabled
                        if (this.autoCapture) {
                            this.startAutomaticCapture();
                        }
                        logger_1.logger.info('Profit capture system initialized successfully');
                        return [2 /*return*/, true];
                    case 6:
                        error_1 = _a.sent();
                        logger_1.logger.error('Failed to initialize profit capture system:', error_1.message);
                        return [2 /*return*/, false];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if the system is initialized
     */
    ProfitCapture.prototype.isInitialized = function () {
        return this.initialized;
    };
    /**
     * Load profit data from file
     */
    ProfitCapture.prototype.loadProfitData = function () {
        var _this = this;
        try {
            var dataPath = './data/profit_data.json';
            if (fs.existsSync(dataPath)) {
                var data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                if (data && Array.isArray(data)) {
                    this.agentProfits.clear();
                    data.forEach(function (agentProfit) {
                        _this.agentProfits.set(agentProfit.agentId, agentProfit);
                    });
                    logger_1.logger.info("Loaded profit data for ".concat(data.length, " agents"));
                }
            }
            else {
                logger_1.logger.info('No profit data file found, starting with empty data');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load profit data:', error.message);
        }
    };
    /**
     * Save profit data to file
     */
    ProfitCapture.prototype.saveProfitData = function () {
        try {
            var dataPath = './data/profit_data.json';
            // Create data directory if it doesn't exist
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }
            var data = Array.from(this.agentProfits.values());
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
            logger_1.logger.debug("Saved profit data for ".concat(data.length, " agents"));
        }
        catch (error) {
            logger_1.logger.error('Failed to save profit data:', error.message);
        }
    };
    /**
     * Record profit for an agent
     */
    ProfitCapture.prototype.recordProfit = function (agentId, agentName, amount, walletAddress) {
        try {
            var agentProfit = this.agentProfits.get(agentId);
            if (!agentProfit) {
                agentProfit = {
                    agentId: agentId,
                    agentName: agentName,
                    totalProfit: 0,
                    lastCapture: 0,
                    walletAddress: walletAddress
                };
            }
            agentProfit.totalProfit += amount;
            this.agentProfits.set(agentId, agentProfit);
            logger_1.logger.info("Recorded profit of ".concat(amount, " SOL for agent ").concat(agentName, " (").concat(agentId, ")"));
            // Save updated data
            this.saveProfitData();
        }
        catch (error) {
            logger_1.logger.error("Failed to record profit for agent ".concat(agentId, ":"), error.message);
        }
    };
    /**
     * Get total profits
     */
    ProfitCapture.prototype.getTotalProfits = function () {
        var total = 0;
        for (var _i = 0, _a = this.agentProfits.values(); _i < _a.length; _i++) {
            var agentProfit = _a[_i];
            total += agentProfit.totalProfit;
        }
        return total;
    };
    /**
     * Get profits by agent
     */
    ProfitCapture.prototype.getProfitsByAgent = function () {
        return Array.from(this.agentProfits.values());
    };
    /**
     * Capture profits from agent wallet to system wallet
     */
    ProfitCapture.prototype.captureProfit = function (agentId, walletPath, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var agentProfit, agentKeyData, agentKeypair, balance, balanceInSol, captureAmount, transaction, _a, signature, verification, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        if (!(!this.initialized || !this.connection)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _b.sent();
                        if (!this.connection) {
                            throw new Error('Profit capture system not properly initialized');
                        }
                        _b.label = 2;
                    case 2:
                        agentProfit = this.agentProfits.get(agentId);
                        if (!agentProfit) {
                            throw new Error("No profit data found for agent ".concat(agentId));
                        }
                        agentKeyData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
                        agentKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(agentKeyData));
                        return [4 /*yield*/, this.connection.getBalance(agentKeypair.publicKey)];
                    case 3:
                        balance = _b.sent();
                        balanceInSol = balance / web3_js_1.LAMPORTS_PER_SOL;
                        logger_1.logger.info("Agent ".concat(agentProfit.agentName, " wallet balance: ").concat(balanceInSol, " SOL"));
                        captureAmount = amount !== undefined ? amount : Math.min(balanceInSol * 0.9, agentProfit.totalProfit);
                        if (captureAmount <= 0 || captureAmount > balanceInSol - 0.01) { // Keep at least 0.01 SOL for fees
                            logger_1.logger.warn("Insufficient balance to capture profit from agent ".concat(agentProfit.agentName));
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Insufficient balance for profit capture'
                                }];
                        }
                        transaction = new web3_js_1.Transaction();
                        transaction.add(web3_js_1.SystemProgram.transfer({
                            fromPubkey: agentKeypair.publicKey,
                            toPubkey: new web3_js_1.PublicKey(this.systemWalletAddress),
                            lamports: Math.floor(captureAmount * web3_js_1.LAMPORTS_PER_SOL)
                        }));
                        // Sign and send transaction
                        _a = transaction;
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 4:
                        // Sign and send transaction
                        _a.recentBlockhash = (_b.sent()).blockhash;
                        transaction.feePayer = agentKeypair.publicKey;
                        return [4 /*yield*/, this.connection.sendTransaction(transaction, [agentKeypair])];
                    case 5:
                        signature = _b.sent();
                        return [4 /*yield*/, transactionVerifier_1.transactionVerifier.monitorUntilConfirmed(signature)];
                    case 6:
                        verification = _b.sent();
                        if (!verification.verified) {
                            throw new Error("Transaction failed: ".concat(verification.error));
                        }
                        // Update agent profit data
                        agentProfit.lastCapture = Date.now();
                        this.agentProfits.set(agentId, agentProfit);
                        this.saveProfitData();
                        logger_1.logger.info("Successfully captured ".concat(captureAmount, " SOL from agent ").concat(agentProfit.agentName, " to system wallet"));
                        return [2 /*return*/, {
                                success: true,
                                signature: signature,
                                amount: captureAmount
                            }];
                    case 7:
                        error_2 = _b.sent();
                        logger_1.logger.error("Failed to capture profit from agent ".concat(agentId, ":"), error_2.message);
                        return [2 /*return*/, {
                                success: false,
                                error: error_2.message
                            }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Capture profits from all agents
     */
    ProfitCapture.prototype.captureAllProfits = function () {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, _a, _b, agentId, agentProfit, walletPath, result;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        results = [];
                        if (this.agentProfits.size === 0) {
                            logger_1.logger.info('No agents with profits to capture');
                            return [2 /*return*/, []];
                        }
                        logger_1.logger.info("Capturing profits from ".concat(this.agentProfits.size, " agents..."));
                        _i = 0, _a = this.agentProfits.entries();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        _b = _a[_i], agentId = _b[0], agentProfit = _b[1];
                        // Skip agents with zero profit
                        if (agentProfit.totalProfit <= 0) {
                            return [3 /*break*/, 3];
                        }
                        walletPath = "./wallets/".concat(agentId, ".json");
                        if (!fs.existsSync(walletPath)) {
                            results.push({
                                success: false,
                                error: "Wallet not found for agent ".concat(agentId)
                            });
                            return [3 /*break*/, 3];
                        }
                        return [4 /*yield*/, this.captureProfit(agentId, walletPath)];
                    case 2:
                        result = _c.sent();
                        results.push(result);
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        this.lastCaptureTime = Date.now();
                        logger_1.logger.info("Completed profit capture for ".concat(results.length, " agents"));
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Start automatic profit capture
     */
    ProfitCapture.prototype.startAutomaticCapture = function () {
        var _this = this;
        if (this.captureTimerId) {
            clearInterval(this.captureTimerId);
        }
        this.autoCapture = true;
        logger_1.logger.info("Starting automatic profit capture every ".concat(this.captureInterval / 60000, " minutes"));
        this.captureTimerId = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info('Running scheduled profit capture...');
                        return [4 /*yield*/, this.captureAllProfits()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, this.captureInterval);
    };
    /**
     * Stop automatic profit capture
     */
    ProfitCapture.prototype.stopAutomaticCapture = function () {
        if (this.captureTimerId) {
            clearInterval(this.captureTimerId);
            this.captureTimerId = null;
        }
        this.autoCapture = false;
        logger_1.logger.info('Stopped automatic profit capture');
    };
    /**
     * Set capture interval
     */
    ProfitCapture.prototype.setCaptureInterval = function (minutes) {
        if (minutes < 1) {
            throw new Error('Capture interval must be at least 1 minute');
        }
        this.captureInterval = minutes * 60 * 1000;
        logger_1.logger.info("Set profit capture interval to ".concat(minutes, " minutes"));
        // Restart automatic capture if enabled
        if (this.autoCapture) {
            this.startAutomaticCapture();
        }
    };
    /**
     * Get time until next capture
     */
    ProfitCapture.prototype.getTimeUntilNextCapture = function () {
        if (!this.autoCapture || !this.captureTimerId) {
            return -1;
        }
        var elapsed = Date.now() - this.lastCaptureTime;
        return Math.max(0, this.captureInterval - elapsed);
    };
    /**
     * Reset profit data
     */
    ProfitCapture.prototype.resetProfitData = function () {
        this.agentProfits.clear();
        this.saveProfitData();
        logger_1.logger.info('Reset all profit data');
    };
    return ProfitCapture;
}());
exports.ProfitCapture = ProfitCapture;
// Create singleton instance
exports.profitCapture = new ProfitCapture();
