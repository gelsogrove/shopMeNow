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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageAdapter = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const promises_1 = __importDefault(require("fs/promises"));
class S3StorageAdapter {
    constructor(bucketName, region = 'eu-west-1') {
        this.bucketName = bucketName;
        this.region = region;
        this.s3Client = new client_s3_1.S3Client({ region });
    }
    upload(buffer, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.generateKey(options);
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: options.contentType || 'application/octet-stream',
                ACL: options.isPublic ? 'public-read' : 'private'
            });
            yield this.s3Client.send(command);
            const url = options.isPublic
                ? `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`
                : yield this.getUrl(key);
            return {
                url,
                key,
                size: buffer.length,
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
            var _a, e_1, _b, _c;
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            const response = yield this.s3Client.send(command);
            const chunks = [];
            try {
                for (var _d = true, _e = __asyncValues(response.Body), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    chunks.push(chunk);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return Buffer.concat(chunks);
        });
    }
    getUrl(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, expiresIn = 3600) {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            return (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn });
        });
    }
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            yield this.s3Client.send(command);
        });
    }
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const command = new client_s3_1.HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: key
                });
                yield this.s3Client.send(command);
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    list(folder) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: folder
            });
            const response = yield this.s3Client.send(command);
            return ((_a = response.Contents) === null || _a === void 0 ? void 0 : _a.map(obj => obj.Key)) || [];
        });
    }
    generateKey(options) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const filename = options.filename || `file-${timestamp}-${random}`;
        const folder = options.folder || 'uploads';
        return `${folder}/${filename}`;
    }
}
exports.S3StorageAdapter = S3StorageAdapter;
//# sourceMappingURL=S3StorageAdapter.js.map