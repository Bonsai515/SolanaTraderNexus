"use strict";
/**
 * Advanced Priority Fee Calculator
 *
 * Optimizes transaction priority fees based on:
 * - Expected profit from the transaction
 * - Current network congestion
 * - Recent block history
 * - Historical success rates
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityFeeCalculator = void 0;
exports.getPriorityFeeCalculator = getPriorityFeeCalculator;
var logger_1 = require("../logger");
var ensureRpcConnection_1 = require("./ensureRpcConnection");
// Window to analyze for fee calculation
var FEE_WINDOW_SLOTS = 150;
// Default parameters
var DEFAULT_PARAMS = {
    baseFeeMicroLamports: 1000000, // 1,000,000 micro-lamports = 0.001 SOL
    maxFeeMicroLamports: 1000000000, // 1 SOL max
    profitMultiplier: 0.05, // 5% of profit
    congestionMultiplier: 2.5, // Up to 2.5x during high congestion
    urgencyMultiplier: 3.0, // Up to 3x for urgent transactions
    minSuccessRate: 0.95 // Target 95% success rate
};
/**
 * Priority Fee Calculator with machine learning optimization
 */
var PriorityFeeCalculator = /** @class */ (function () {
    function PriorityFeeCalculator(params) {
        if (params === void 0) { params = {}; }
        this.historicalData = [];
        this.recentBlockhashInfo = null;
        this.lastCongestionCheck = 0;
        this.currentCongestionLevel = 0;
        this.connection = (0, ensureRpcConnection_1.getSolanaConnection)();
        this.params = __assign(__assign({}, DEFAULT_PARAMS), params);
    }
    /**
     * Calculate optimal priority fee based on expected profit
     * @param expectedProfitUsd Expected profit in USD
     * @param urgent Whether this is an urgent transaction
     * @returns Priority fee in micro-lamports
     */
    PriorityFeeCalculator.prototype.calculatePriorityFee = function (expectedProfitUsd_1) {
        return __awaiter(this, arguments, void 0, function (expectedProfitUsd, urgent) {
            var solPriceUsd, expectedProfitLamports, priorityFeeMicroLamports, priorityFeeLamports, error_1;
            if (urgent === void 0) { urgent = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        // Update congestion data if needed
                        return [4 /*yield*/, this.updateCongestionLevel()];
                    case 1:
                        // Update congestion data if needed
                        _a.sent();
                        return [4 /*yield*/, this.getSolPrice()];
                    case 2:
                        solPriceUsd = _a.sent();
                        expectedProfitLamports = (expectedProfitUsd / solPriceUsd) * 1000000000;
                        priorityFeeMicroLamports = this.params.baseFeeMicroLamports;
                        // Add profit-based component
                        priorityFeeMicroLamports += Math.floor(expectedProfitLamports * 1000 * this.params.profitMultiplier);
                        // Apply congestion multiplier
                        priorityFeeMicroLamports = Math.floor(priorityFeeMicroLamports * (1 + (this.currentCongestionLevel * this.params.congestionMultiplier)));
                        // Apply urgency multiplier if needed
                        if (urgent) {
                            priorityFeeMicroLamports = Math.floor(priorityFeeMicroLamports * this.params.urgencyMultiplier);
                        }
                        // Apply machine learning adjustment based on historical data
                        priorityFeeMicroLamports = this.applyMachineLearningAdjustment(priorityFeeMicroLamports, expectedProfitUsd, urgent);
                        // Ensure fee is within limits
                        priorityFeeMicroLamports = Math.min(priorityFeeMicroLamports, this.params.maxFeeMicroLamports);
                        priorityFeeLamports = priorityFeeMicroLamports / 1000;
                        logger_1.logger.debug("Calculated priority fee: ".concat(priorityFeeLamports, " lamports (").concat(priorityFeeLamports / 1000000000, " SOL)"));
                        return [2 /*return*/, priorityFeeMicroLamports];
                    case 3:
                        error_1 = _a.sent();
                        logger_1.logger.error("Error calculating priority fee: ".concat(error_1));
                        return [2 /*return*/, this.params.baseFeeMicroLamports];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Record transaction outcome for learning
     */
    PriorityFeeCalculator.prototype.recordTransactionOutcome = function (feeMicroLamports, successful, expectedProfit, actualProfit) {
        this.historicalData.push({
            timestamp: Date.now(),
            feeMicroLamports: feeMicroLamports,
            successful: successful,
            expectedProfit: expectedProfit,
            actualProfit: actualProfit,
            congestionLevel: this.currentCongestionLevel
        });
        // Keep history limited to last 1000 transactions
        if (this.historicalData.length > 1000) {
            this.historicalData.shift();
        }
        // Trigger model optimization
        this.optimizeModel();
    };
    /**
     * Update network congestion level
     */
    PriorityFeeCalculator.prototype.updateCongestionLevel = function () {
        return __awaiter(this, void 0, void 0, function () {
            var perfSamples, totalTxCount, totalSlots, avgTxPerSlot, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Only check every 10 seconds
                        if (Date.now() - this.lastCongestionCheck < 10000) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.connection.getRecentPerformanceSamples(FEE_WINDOW_SLOTS)];
                    case 2:
                        perfSamples = _a.sent();
                        if (!perfSamples || perfSamples.length === 0) {
                            logger_1.logger.warn('No performance samples available for congestion calculation');
                            return [2 /*return*/];
                        }
                        totalTxCount = perfSamples.reduce(function (sum, sample) { return sum + sample.numTransactions; }, 0);
                        totalSlots = perfSamples.reduce(function (sum, sample) { return sum + sample.samplePeriodSecs; }, 0);
                        avgTxPerSlot = totalSlots > 0 ? totalTxCount / totalSlots : 0;
                        // Network congestion is normalized between 0 and 1
                        // Assuming 2000 tx/sec is high congestion
                        this.currentCongestionLevel = Math.min(avgTxPerSlot / 2000, 1);
                        this.lastCongestionCheck = Date.now();
                        logger_1.logger.debug("Current network congestion level: ".concat(this.currentCongestionLevel.toFixed(2)));
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger_1.logger.error("Error updating congestion level: ".concat(error_2));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current SOL price in USD
     */
    PriorityFeeCalculator.prototype.getSolPrice = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // In a real implementation, this would call an oracle or price feed
                // For now, using a placeholder price
                return [2 /*return*/, 145.75]; // Current SOL price in USD
            });
        });
    };
    /**
     * Apply machine learning adjustment based on historical data
     */
    PriorityFeeCalculator.prototype.applyMachineLearningAdjustment = function (baseFee, expectedProfit, urgent) {
        if (this.historicalData.length < 10) {
            return baseFee; // Not enough data yet
        }
        // Get recent similar transactions
        var similarTransactions = this.getSimilarTransactions(expectedProfit, urgent);
        if (similarTransactions.length < 5) {
            return baseFee; // Not enough similar transactions
        }
        // Calculate success rate at different fee levels
        var feeGroups = this.groupByFeeLevel(similarTransactions);
        // Find minimum fee level that meets target success rate
        var optimalFee = baseFee;
        var highestSuccessRate = 0;
        for (var _i = 0, _a = Object.entries(feeGroups); _i < _a.length; _i++) {
            var _b = _a[_i], feeLevelStr = _b[0], transactions = _b[1];
            var feeLevel = parseInt(feeLevelStr);
            var successCount = transactions.filter(function (tx) { return tx.successful; }).length;
            var successRate = successCount / transactions.length;
            if (successRate >= this.params.minSuccessRate && successRate > highestSuccessRate) {
                optimalFee = feeLevel;
                highestSuccessRate = successRate;
            }
        }
        // If we couldn't find a fee level with target success rate, use base fee
        return optimalFee !== baseFee ? optimalFee : baseFee;
    };
    /**
     * Get similar historical transactions
     */
    PriorityFeeCalculator.prototype.getSimilarTransactions = function (expectedProfit, urgent) {
        var _this = this;
        // Get transactions from similar market conditions
        return this.historicalData.filter(function (tx) {
            // Within 20% of profit range and similar congestion conditions
            var profitSimilar = Math.abs(tx.expectedProfit - expectedProfit) / expectedProfit < 0.2;
            var congestionSimilar = Math.abs(tx.congestionLevel - _this.currentCongestionLevel) < 0.2;
            return profitSimilar && congestionSimilar;
        });
    };
    /**
     * Group transactions by fee level
     */
    PriorityFeeCalculator.prototype.groupByFeeLevel = function (transactions) {
        var groups = {};
        // Group by fee level (rounded to nearest 100,000 micro-lamports)
        for (var _i = 0, transactions_1 = transactions; _i < transactions_1.length; _i++) {
            var tx = transactions_1[_i];
            var feeLevel = Math.round(tx.feeMicroLamports / 100000) * 100000;
            if (!groups[feeLevel]) {
                groups[feeLevel] = [];
            }
            groups[feeLevel].push(tx);
        }
        return groups;
    };
    /**
     * Optimize model parameters based on historical data
     */
    PriorityFeeCalculator.prototype.optimizeModel = function () {
        if (this.historicalData.length < 100) {
            return; // Not enough data yet
        }
        // Calculate success rates for different parameter settings
        // This is a simplified implementation that would be more sophisticated in production
        // Analyze profit multiplier effectiveness
        var profitCorrelation = this.calculateProfitMultiplierCorrelation();
        if (profitCorrelation > 0.7) {
            // Strong correlation, increase multiplier
            this.params.profitMultiplier *= 1.05;
        }
        else if (profitCorrelation < 0.3) {
            // Weak correlation, decrease multiplier
            this.params.profitMultiplier *= 0.95;
        }
        // Keep parameters within reasonable bounds
        this.params.profitMultiplier = Math.min(Math.max(this.params.profitMultiplier, 0.01), 0.2);
        logger_1.logger.debug("Optimized fee model parameters: profitMultiplier=".concat(this.params.profitMultiplier.toFixed(3)));
    };
    /**
     * Calculate correlation between profit multiplier and success rate
     */
    PriorityFeeCalculator.prototype.calculateProfitMultiplierCorrelation = function () {
        // This would be a more complex calculation in production
        // Simplified implementation for demonstration
        var recentTransactions = this.historicalData.slice(-100);
        var successfulCount = recentTransactions.filter(function (tx) { return tx.successful; }).length;
        return successfulCount / recentTransactions.length;
    };
    return PriorityFeeCalculator;
}());
exports.PriorityFeeCalculator = PriorityFeeCalculator;
// Create singleton instance
var priorityFeeCalculator = new PriorityFeeCalculator();
/**
 * Get the priority fee calculator instance
 */
function getPriorityFeeCalculator() {
    return priorityFeeCalculator;
}
