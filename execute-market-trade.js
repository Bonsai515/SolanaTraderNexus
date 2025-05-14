"use strict";
/**
 * Execute Market Trade
 *
 * This script executes a market trade using the Nexus Professional Engine.
 * It allows trading specified tokens on Solana DEXes.
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
var nexusTransactionEngine = __importStar(require("./server/nexus-transaction-engine"));
var dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Default system wallet is configured in the Nexus engine
function executeMarketTrade(options) {
    return __awaiter(this, void 0, void 0, function () {
        var slippageBps, dex, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('=============================================');
                    console.log('EXECUTING MARKET TRADE');
                    console.log('=============================================');
                    // Validate parameters
                    if (!options.fromToken || !options.toToken || !options.amount) {
                        console.error('Invalid trade parameters. Required: fromToken, toToken, amount');
                        return [2 /*return*/];
                    }
                    if (options.amount <= 0) {
                        console.error('Amount must be greater than 0');
                        return [2 /*return*/];
                    }
                    slippageBps = options.slippageBps || 50;
                    dex = options.dex || 'Jupiter';
                    console.log("Trade parameters:");
                    console.log("- From: ".concat(options.fromToken));
                    console.log("- To: ".concat(options.toToken));
                    console.log("- Amount: ".concat(options.amount));
                    console.log("- Slippage: ".concat(slippageBps / 100, "%"));
                    console.log("- DEX: ".concat(dex));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    if (!!nexusTransactionEngine.isInitialized()) return [3 /*break*/, 3];
                    console.log('Initializing Nexus Professional Engine...');
                    return [4 /*yield*/, nexusTransactionEngine.initializeTransactionEngine(process.env.ALCHEMY_RPC_URL || process.env.INSTANT_NODES_RPC_URL || 'https://api.mainnet-beta.solana.com', true // Use real funds
                        )];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    // Execute the trade
                    console.log('Executing market trade...');
                    return [4 /*yield*/, nexusTransactionEngine.executeMarketTrade({
                            fromToken: options.fromToken,
                            toToken: options.toToken,
                            amount: options.amount,
                            slippageBps: slippageBps,
                            dex: dex,
                            walletPath: options.walletPath || './wallet.json'
                        })];
                case 4:
                    result = _a.sent();
                    if (result && result.success) {
                        console.log('✅ Trade executed successfully!');
                        console.log("Transaction signature: ".concat(result.signature || 'N/A'));
                        console.log("Received: ".concat(result.amount || 'N/A', " ").concat(options.toToken));
                        return [2 /*return*/, result];
                    }
                    else {
                        console.error("\u274C Trade failed: ".concat((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error'));
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _a.sent();
                    console.error('Error executing market trade:', error_1.message);
                    return [2 /*return*/, null];
                case 6:
                    console.log('\n=============================================');
                    console.log('MARKET TRADE OPERATION COMPLETE');
                    console.log('=============================================');
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Check available trading pairs
function checkAvailableTrades() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log('\nRecommended markets:');
            console.log('- SOL/USDC (SOL to USDC)');
            console.log('- USDC/SOL (USDC to SOL)');
            console.log('- BONK/USDC (BONK to USDC)');
            console.log('- USDC/BONK (USDC to BONK)');
            console.log('- wSOL/USDC (Wrapped SOL to USDC)');
            console.log('- USDC/wSOL (USDC to Wrapped SOL)');
            console.log('- SAMO/USDC (SAMO to USDC)');
            console.log('- USDC/SAMO (USDC to SAMO)');
            // Show current token addresses for convenience
            console.log('\nToken addresses:');
            console.log('- SOL: So11111111111111111111111111111111111111112 (native)');
            console.log('- USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
            console.log('- BONK: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
            console.log('- SAMO: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
            return [2 /*return*/];
        });
    });
}
// Parse command line arguments
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, command, options;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    args = process.argv.slice(2);
                    if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
                        console.log('Usage:');
                        console.log('  npx ts-node execute-market-trade.ts check         - Check available tokens for trading');
                        console.log('  npx ts-node execute-market-trade.ts execute <options>  - Execute a market trade');
                        console.log('');
                        console.log('Trade options:');
                        console.log('  --from=TOKEN    - From token (symbol or mint address)');
                        console.log('  --to=TOKEN      - To token (symbol or mint address)');
                        console.log('  --amount=NUM    - Amount to trade');
                        console.log('  --slippage=NUM  - Slippage in basis points (optional, default 50 = 0.5%)');
                        console.log('  --dex=NAME      - DEX to use (optional, default Jupiter)');
                        console.log('');
                        console.log('Example:');
                        console.log('  npx ts-node execute-market-trade.ts execute --from=SOL --to=USDC --amount=0.1');
                        return [2 /*return*/];
                    }
                    command = args[0];
                    if (!(command === 'check')) return [3 /*break*/, 2];
                    return [4 /*yield*/, checkAvailableTrades()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    if (!(command === 'execute')) return [3 /*break*/, 4];
                    options = parseTradeOptions(args.slice(1));
                    return [4 /*yield*/, executeMarketTrade(options)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    console.error('Unknown command:', command);
                    console.log('Use "help" to see available commands');
                    return [2 /*return*/];
            }
        });
    });
}
function parseTradeOptions(args) {
    var options = {
        slippageBps: 50
    };
    args.forEach(function (arg) {
        if (arg.startsWith('--from=')) {
            options.fromToken = arg.substring('--from='.length);
        }
        else if (arg.startsWith('--to=')) {
            options.toToken = arg.substring('--to='.length);
        }
        else if (arg.startsWith('--amount=')) {
            options.amount = parseFloat(arg.substring('--amount='.length));
        }
        else if (arg.startsWith('--slippage=')) {
            options.slippageBps = parseInt(arg.substring('--slippage='.length));
        }
        else if (arg.startsWith('--dex=')) {
            options.dex = arg.substring('--dex='.length);
        }
    });
    return options;
}
// Run the main function
main().catch(function (error) {
    console.error('Error running market trade script:', error);
});
