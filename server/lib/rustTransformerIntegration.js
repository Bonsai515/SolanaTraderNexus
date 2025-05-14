"use strict";
/**
 * Rust Transformer Integration
 *
 * Complete integration of all transformers with their Rust implementations.
 * Provides direct bindings to the Rust code for maximum performance.
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
exports.RustTransformerIntegration = exports.TransformerType = void 0;
exports.getRustTransformerIntegration = getRustTransformerIntegration;
var child_process_1 = require("child_process");
var util_1 = require("util");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var logger_1 = require("../logger");
var execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// Paths to Rust transformer binaries
var RUST_TRANSFORMERS_DIR = './rust_engine/transformers';
var RUST_TRANSFORMER_BINARIES = {
    memecortex: path.join(RUST_TRANSFORMERS_DIR, 'memecortexremix'),
    security: path.join(RUST_TRANSFORMERS_DIR, 'security'),
    crosschain: path.join(RUST_TRANSFORMERS_DIR, 'crosschain'),
    microqhc: path.join(RUST_TRANSFORMERS_DIR, 'microqhc')
};
// Type definitions
var TransformerType;
(function (TransformerType) {
    TransformerType["MemeCortex"] = "memecortex";
    TransformerType["Security"] = "security";
    TransformerType["CrossChain"] = "crosschain";
    TransformerType["MicroQHC"] = "microqhc";
})(TransformerType || (exports.TransformerType = TransformerType = {}));
/**
 * Class for handling Rust transformer integration
 */
var RustTransformerIntegration = /** @class */ (function () {
    function RustTransformerIntegration() {
        var _a;
        this.transformersAvailable = (_a = {},
            _a[TransformerType.MemeCortex] = false,
            _a[TransformerType.Security] = false,
            _a[TransformerType.CrossChain] = false,
            _a[TransformerType.MicroQHC] = false,
            _a);
        this.checkTransformerBinaries();
    }
    /**
     * Check if all transformer binaries are available
     */
    RustTransformerIntegration.prototype.checkTransformerBinaries = function () {
        for (var _i = 0, _a = Object.entries(RUST_TRANSFORMER_BINARIES); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], path_1 = _b[1];
            var transformerType = type;
            try {
                if (fs.existsSync(path_1)) {
                    // Set executable permission on binaries
                    fs.chmodSync(path_1, '755');
                    this.transformersAvailable[transformerType] = true;
                    logger_1.logger.info("\u2705 Found Rust transformer binary: ".concat(transformerType));
                }
                else {
                    this.transformersAvailable[transformerType] = false;
                    logger_1.logger.warn("\u26A0\uFE0F ".concat(transformerType, " transformer binary not found at ").concat(path_1));
                }
            }
            catch (error) {
                this.transformersAvailable[transformerType] = false;
                logger_1.logger.error("Error checking ".concat(transformerType, " transformer binary: ").concat(error));
            }
        }
    };
    /**
     * Check if a transformer is available
     */
    RustTransformerIntegration.prototype.isTransformerAvailable = function (type) {
        return this.transformersAvailable[type];
    };
    /**
     * Check if all transformers are available
     */
    RustTransformerIntegration.prototype.areAllTransformersAvailable = function () {
        return Object.values(this.transformersAvailable).every(function (available) { return available; });
    };
    /**
     * Execute a transformer request
     */
    RustTransformerIntegration.prototype.executeTransformer = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var type, payload, _a, timeout, startTime, payloadString, spawn, process_1, stdoutChunks_1, stdout, outputData, runtimeMs, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        type = request.type, payload = request.payload, _a = request.timeout, timeout = _a === void 0 ? 30000 : _a;
                        if (!this.transformersAvailable[type]) {
                            logger_1.logger.warn("\u26A0\uFE0F ".concat(type, " transformer binary not available"));
                            return [2 /*return*/, {
                                    success: false,
                                    error: "".concat(type, " transformer binary not available")
                                }];
                        }
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        payloadString = JSON.stringify(payload);
                        spawn = require('child_process').spawn;
                        process_1 = spawn(RUST_TRANSFORMER_BINARIES[type], [], {
                            timeout: timeout
                        });
                        stdoutChunks_1 = [];
                        process_1.stdout.on('data', function (chunk) {
                            stdoutChunks_1.push(chunk);
                        });
                        // Send payload to stdin
                        process_1.stdin.write(payloadString);
                        process_1.stdin.end();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                process_1.on('exit', function (code) {
                                    if (code === 0) {
                                        resolve(Buffer.concat(stdoutChunks_1).toString());
                                    }
                                    else {
                                        reject(new Error("Transformer exited with code ".concat(code)));
                                    }
                                });
                                process_1.on('error', function (err) {
                                    reject(err);
                                });
                                // Add timeout
                                setTimeout(function () {
                                    process_1.kill();
                                    reject(new Error("Transformer execution timed out after ".concat(timeout, "ms")));
                                }, timeout);
                            })];
                    case 2:
                        stdout = _b.sent();
                        outputData = JSON.parse(stdout);
                        runtimeMs = Date.now() - startTime;
                        // Return response
                        return [2 /*return*/, {
                                success: true,
                                data: outputData,
                                runtimeMs: runtimeMs
                            }];
                    case 3:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        logger_1.logger.error("Error executing ".concat(type, " transformer: ").concat(errorMessage));
                        return [2 /*return*/, {
                                success: false,
                                error: errorMessage,
                                runtimeMs: Date.now() - startTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute the MemeCortex transformer
     */
    RustTransformerIntegration.prototype.executeMemeCortexTransformer = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.executeTransformer({
                        type: TransformerType.MemeCortex,
                        payload: payload
                    })];
            });
        });
    };
    /**
     * Execute the Security transformer
     */
    RustTransformerIntegration.prototype.executeSecurityTransformer = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.executeTransformer({
                        type: TransformerType.Security,
                        payload: payload
                    })];
            });
        });
    };
    /**
     * Execute the CrossChain transformer
     */
    RustTransformerIntegration.prototype.executeCrossChainTransformer = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.executeTransformer({
                        type: TransformerType.CrossChain,
                        payload: payload
                    })];
            });
        });
    };
    /**
     * Execute the MicroQHC transformer
     */
    RustTransformerIntegration.prototype.executeMicroQHCTransformer = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.executeTransformer({
                        type: TransformerType.MicroQHC,
                        payload: payload
                    })];
            });
        });
    };
    // No temporary files needed with direct stdin/stdout approach
    /**
     * Build all rust transformers
     *
     * Note: Since we're using shell scripts as temporary stand-ins for the Rust binaries,
     * this method ensures the scripts are executable and have the correct permissions.
     */
    RustTransformerIntegration.prototype.buildAllTransformers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, _b, type, path_2, allAvailable, missingTransformers;
            return __generator(this, function (_c) {
                logger_1.logger.info('Building all Rust transformers...');
                try {
                    // Ensure transformers directory exists
                    if (!fs.existsSync(RUST_TRANSFORMERS_DIR)) {
                        fs.mkdirSync(RUST_TRANSFORMERS_DIR, { recursive: true });
                        logger_1.logger.info("Created transformers directory at ".concat(RUST_TRANSFORMERS_DIR));
                    }
                    // Set executable permissions on all transformer scripts
                    for (_i = 0, _a = Object.entries(RUST_TRANSFORMER_BINARIES); _i < _a.length; _i++) {
                        _b = _a[_i], type = _b[0], path_2 = _b[1];
                        if (fs.existsSync(path_2)) {
                            fs.chmodSync(path_2, 493); // rwxr-xr-x
                            logger_1.logger.info("Set executable permissions on ".concat(type, " transformer"));
                        }
                        else {
                            logger_1.logger.warn("Transformer ".concat(type, " not found at ").concat(path_2));
                        }
                    }
                    // Re-check binaries after permission changes
                    this.checkTransformerBinaries();
                    allAvailable = this.areAllTransformersAvailable();
                    if (allAvailable) {
                        logger_1.logger.info('✅ Successfully initialized all transformers');
                    }
                    else {
                        missingTransformers = Object.entries(this.transformersAvailable)
                            .filter(function (_a) {
                            var available = _a[1];
                            return !available;
                        })
                            .map(function (_a) {
                            var type = _a[0];
                            return type;
                        })
                            .join(', ');
                        logger_1.logger.warn("Missing transformers: ".concat(missingTransformers));
                    }
                    return [2 /*return*/, allAvailable];
                }
                catch (error) {
                    logger_1.logger.error("Failed to initialize Rust transformers: ".concat(error));
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    return RustTransformerIntegration;
}());
exports.RustTransformerIntegration = RustTransformerIntegration;
// Create singleton instance
var rustTransformerIntegration = new RustTransformerIntegration();
/**
 * Get the Rust transformer integration instance
 */
function getRustTransformerIntegration() {
    return rustTransformerIntegration;
}
