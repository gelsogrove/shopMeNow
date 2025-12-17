"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageAdapter = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class LocalStorageAdapter {
    constructor(baseDir = './uploads', baseUrl = 'http://localhost:3001/uploads') {
        this.baseDir = baseDir;
        this.baseUrl = baseUrl;
    }
    async upload(buffer, options) {
        const key = this.generateKey(options);
        const filePath = path_1.default.join(this.baseDir, key);
        await promises_1.default.mkdir(path_1.default.dirname(filePath), { recursive: true });
        await promises_1.default.writeFile(filePath, buffer);
        const stats = await promises_1.default.stat(filePath);
        return {
            url: `${this.baseUrl}/${key}`,
            key,
            size: stats.size,
            contentType: options.contentType || 'application/octet-stream'
        };
    }
    async uploadFromPath(filePath, options) {
        const buffer = await promises_1.default.readFile(filePath);
        return this.upload(buffer, options);
    }
    async get(key) {
        const filePath = path_1.default.join(this.baseDir, key);
        return promises_1.default.readFile(filePath);
    }
    async getUrl(key) {
        return `${this.baseUrl}/${key}`;
    }
    async delete(key) {
        const filePath = path_1.default.join(this.baseDir, key);
        await promises_1.default.unlink(filePath);
    }
    async exists(key) {
        const filePath = path_1.default.join(this.baseDir, key);
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async list(folder) {
        const folderPath = path_1.default.join(this.baseDir, folder);
        try {
            const files = await promises_1.default.readdir(folderPath);
            return files.map(file => path_1.default.join(folder, file));
        }
        catch {
            return [];
        }
    }
    generateKey(options) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const filename = options.filename || `file-${timestamp}-${random}`;
        const folder = options.folder || 'uploads';
        return path_1.default.join(folder, filename);
    }
}
exports.LocalStorageAdapter = LocalStorageAdapter;
//# sourceMappingURL=LocalStorageAdapter.js.map