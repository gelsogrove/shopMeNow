"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    upload(buffer, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.generateKey(options);
            const filePath = path_1.default.join(this.baseDir, key);
            yield promises_1.default.mkdir(path_1.default.dirname(filePath), { recursive: true });
            yield promises_1.default.writeFile(filePath, buffer);
            const stats = yield promises_1.default.stat(filePath);
            return {
                url: `${this.baseUrl}/${key}`,
                key,
                size: stats.size,
                contentType: options.contentType || 'application/octet-stream'
            };
        });
    }
    uploadFromPath(filePath, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield promises_1.default.readFile(filePath);
            return this.upload(buffer, options);
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path_1.default.join(this.baseDir, key);
            return promises_1.default.readFile(filePath);
        });
    }
    getUrl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return `${this.baseUrl}/${key}`;
        });
    }
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path_1.default.join(this.baseDir, key);
            yield promises_1.default.unlink(filePath);
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path_1.default.join(this.baseDir, key);
            try {
                yield promises_1.default.access(filePath);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    list(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderPath = path_1.default.join(this.baseDir, folder);
            try {
                const files = yield promises_1.default.readdir(folderPath);
                return files.map(file => path_1.default.join(folder, file));
            }
            catch (_a) {
                return [];
            }
        });
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