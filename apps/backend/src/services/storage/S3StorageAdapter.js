"use strict";
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
    async upload(buffer, options) {
        const key = this.generateKey(options);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: options.contentType || 'application/octet-stream',
            ACL: options.isPublic ? 'public-read' : 'private'
        });
        await this.s3Client.send(command);
        const url = options.isPublic
            ? `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`
            : await this.getUrl(key);
        return {
            url,
            key,
            size: buffer.length,
            contentType: options.contentType || 'application/octet-stream'
        };
    }
    async uploadFromPath(filePath, options) {
        const buffer = await promises_1.default.readFile(filePath);
        return this.upload(buffer, options);
    }
    async get(key) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });
        const response = await this.s3Client.send(command);
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
    async getUrl(key, expiresIn = 3600) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, { expiresIn });
    }
    async delete(key) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });
        await this.s3Client.send(command);
    }
    async exists(key) {
        try {
            const command = new client_s3_1.HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            await this.s3Client.send(command);
            return true;
        }
        catch {
            return false;
        }
    }
    async list(folder) {
        const command = new client_s3_1.ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: folder
        });
        const response = await this.s3Client.send(command);
        return response.Contents?.map(obj => obj.Key) || [];
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