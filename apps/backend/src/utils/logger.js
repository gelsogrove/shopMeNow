"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableLogsForTests = void 0;
const winston = __importStar(require("winston"));
// Determiniamo se dobbiamo abilitare i log in test in base alla variabile di ambiente
const enableTestLogs = process.env.TEST_LOGS === "true";
// Verifica se siamo in ambiente di test e se dobbiamo silenziare i log
const isTest = process.env.NODE_ENV === "test";
const shouldSilenceTestLogs = isTest && !enableTestLogs;
// Replacer function to handle circular references
const circularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
};
const logger = winston.createLogger({
    level: process.env.NODE_ENV === "development" || enableTestLogs ? "debug" : "info",
    silent: shouldSilenceTestLogs, // I log sono silenziati nei test a meno che non siano esplicitamente abilitati
    format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length
            ? JSON.stringify(meta, circularReplacer(), 2)
            : ""}`;
    })),
    // Only Console transport - PM2 handles log rotation via pm2-logrotate
    transports: [
        new winston.transports.Console({
            stderrLevels: ["error"],
        }),
    ],
});
// Esponiamo una funzione per abilitare i log nei test
const enableLogsForTests = () => {
    if (isTest) {
        if (enableTestLogs) {
            logger.silent = false;
            logger.level = "debug";
            logger.info("Test logs enabled");
        }
        else {
            // Se i log non sono esplicitamente abilitati, li mantieniamo silenziati
            logger.silent = true;
        }
    }
};
exports.enableLogsForTests = enableLogsForTests;
exports.default = logger;
//# sourceMappingURL=logger.js.map