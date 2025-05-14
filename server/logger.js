"use strict";
/**
 * Logger Module
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.log.apply(console, __spreadArray(["".concat(new Date().toISOString().split('T')[0], " ").concat(new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':'), " info: ").concat(message)], args, false));
    },
    warn: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.warn.apply(console, __spreadArray(["".concat(new Date().toISOString().split('T')[0], " ").concat(new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':'), " warn: ").concat(message)], args, false));
    },
    error: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.error.apply(console, __spreadArray(["".concat(new Date().toISOString().split('T')[0], " ").concat(new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':'), " error: ").concat(message)], args, false));
    },
    debug: function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.debug.apply(console, __spreadArray(["".concat(new Date().toISOString().split('T')[0], " ").concat(new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, ':'), " debug: ").concat(message)], args, false));
    }
};
