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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageAdapter = exports.LocalStorageAdapter = void 0;
exports.createStorageService = createStorageService;
exports.getStorageService = getStorageService;
const LocalStorageAdapter_1 = require("./LocalStorageAdapter");
const S3StorageAdapter_1 = require("./S3StorageAdapter");
/**
 * Storage Factory
 * Automatically selects the right storage adapter based on NODE_ENV
 */
function createStorageService() {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') {
        // Production: Use S3
        const bucketName = process.env.AWS_S3_BUCKET || 'echatbot-uploads-prod';
        const region = process.env.AWS_REGION || 'eu-west-1';
        console.log(`📦 Storage: S3 (bucket: ${bucketName}, region: ${region})`);
        return new S3StorageAdapter_1.S3StorageAdapter(bucketName, region);
    }
    else {
        // Development: Use local filesystem
        const baseDir = process.env.UPLOADS_DIR || './uploads';
        const baseUrl = process.env.UPLOADS_URL || 'http://localhost:3001/uploads';
        console.log(`📦 Storage: Local (dir: ${baseDir})`);
        return new LocalStorageAdapter_1.LocalStorageAdapter(baseDir, baseUrl);
    }
}
// Singleton instance
let storageInstance = null;
function getStorageService() {
    if (!storageInstance) {
        storageInstance = createStorageService();
    }
    return storageInstance;
}
// Export types
__exportStar(require("./StorageService"), exports);
var LocalStorageAdapter_2 = require("./LocalStorageAdapter");
Object.defineProperty(exports, "LocalStorageAdapter", { enumerable: true, get: function () { return LocalStorageAdapter_2.LocalStorageAdapter; } });
var S3StorageAdapter_2 = require("./S3StorageAdapter");
Object.defineProperty(exports, "S3StorageAdapter", { enumerable: true, get: function () { return S3StorageAdapter_2.S3StorageAdapter; } });
//# sourceMappingURL=index.js.map