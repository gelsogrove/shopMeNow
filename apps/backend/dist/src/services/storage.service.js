"use strict";
/**
 * Storage Service - Unified file upload/delete interface
 *
 * Automatically switches between:
 * - LOCAL filesystem (development)
 * - CLOUDINARY (production/Heroku)
 *
 * Usage:
 *   const url = await storageService.uploadImage(file, 'products')
 *   await storageService.deleteImage(url)
 */
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
exports.storageService = void 0;
const cloudinary_1 = require("cloudinary");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../utils/logger"));
class StorageService {
    constructor() {
        // Determine storage type based on environment
        const useCloudinary = process.env.CLOUDINARY_URL || process.env.NODE_ENV === 'production';
        this.storageType = useCloudinary ? 'cloudinary' : 'local';
        this.localUploadDir = path_1.default.join(__dirname, '../../uploads');
        // Configure Cloudinary if credentials exist
        if (this.storageType === 'cloudinary') {
            if (!process.env.CLOUDINARY_URL) {
                logger_1.default.warn('⚠️ CLOUDINARY_URL not set - falling back to local storage');
                this.storageType = 'local';
            }
            else {
                // Parse CLOUDINARY_URL: cloudinary://api_key:api_secret@cloud_name
                const cloudinaryUrl = process.env.CLOUDINARY_URL;
                const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
                if (!match) {
                    logger_1.default.error('❌ Invalid CLOUDINARY_URL format - falling back to local storage');
                    this.storageType = 'local';
                }
                else {
                    const [, api_key, api_secret, cloud_name] = match;
                    cloudinary_1.v2.config({ cloud_name, api_key, api_secret });
                    logger_1.default.info(`✅ Cloudinary configured: ${cloud_name}`);
                }
            }
        }
        // Ensure local upload directories exist
        if (this.storageType === 'local') {
            this.ensureLocalDirectories();
            logger_1.default.info('✅ Local storage configured');
        }
        logger_1.default.info(`📦 Storage Service initialized: ${this.storageType.toUpperCase()}`);
    }
    /**
     * Upload image to storage
     * @param file Express.Multer.File object
     * @param folder Folder name (products, services, etc.)
     * @returns Public URL of uploaded image
     */
    uploadImage(file, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.storageType === 'cloudinary') {
                return this.uploadToCloudinary(file, folder);
            }
            else {
                return this.uploadToLocal(file, folder);
            }
        });
    }
    /**
     * Delete image from storage
     * @param imageUrl Full URL or path to image
     */
    deleteImage(imageUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!imageUrl)
                return;
            if (this.storageType === 'cloudinary') {
                yield this.deleteFromCloudinary(imageUrl);
            }
            else {
                yield this.deleteFromLocal(imageUrl);
            }
        });
    }
    /**
     * Upload multiple images (array of files)
     */
    uploadImages(files, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            const uploadPromises = files.map(file => this.uploadImage(file, folder));
            return Promise.all(uploadPromises);
        });
    }
    /**
     * Delete multiple images (array of URLs)
     */
    deleteImages(imageUrls) {
        return __awaiter(this, void 0, void 0, function* () {
            const deletePromises = imageUrls.map(url => this.deleteImage(url));
            yield Promise.all(deletePromises);
        });
    }
    // ==================== LEGACY COMPATIBILITY METHODS (for InvoiceService) ====================
    /**
     * Upload raw buffer (for PDFs, etc.)
     * @deprecated Use uploadImage() for images, this is for PDF/documents only
     */
    upload(buffer, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.storageType === 'cloudinary') {
                // For Cloudinary: save buffer to temp file, upload, then delete
                const tempPath = path_1.default.join(this.localUploadDir, `temp_${Date.now()}_${options.filename}`);
                fs_1.default.writeFileSync(tempPath, buffer);
                try {
                    const result = yield cloudinary_1.v2.uploader.upload(tempPath, {
                        folder: `echatbot/${options.folder}`,
                        resource_type: 'raw', // For non-image files like PDF
                        public_id: path_1.default.parse(options.filename).name,
                        use_filename: true,
                    });
                    fs_1.default.unlinkSync(tempPath); // Cleanup temp file
                    logger_1.default.info(`☁️ Uploaded buffer to Cloudinary: ${result.secure_url}`);
                    return { url: result.secure_url, key: result.public_id };
                }
                catch (error) {
                    if (fs_1.default.existsSync(tempPath))
                        fs_1.default.unlinkSync(tempPath);
                    throw error;
                }
            }
            else {
                // Local: save buffer directly
                const folderPath = path_1.default.join(this.localUploadDir, options.folder);
                if (!fs_1.default.existsSync(folderPath)) {
                    fs_1.default.mkdirSync(folderPath, { recursive: true });
                }
                const filePath = path_1.default.join(folderPath, options.filename);
                fs_1.default.writeFileSync(filePath, buffer);
                const url = `/uploads/${options.folder}/${options.filename}`;
                logger_1.default.info(`💾 Uploaded buffer to local: ${url}`);
                return { url, key: url };
            }
        });
    }
    /**
     * Get file as buffer
     * @deprecated Legacy method for InvoiceService
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.storageType === 'cloudinary') {
                // Download from Cloudinary URL
                const response = yield fetch(key);
                const arrayBuffer = yield response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
            else {
                // Read from local filesystem
                const filePath = key.startsWith('/') ? path_1.default.join(this.localUploadDir, key.replace('/uploads/', '')) : key;
                return fs_1.default.readFileSync(filePath);
            }
        });
    }
    /**
     * Get signed/public URL for file
     * @deprecated Legacy method for InvoiceService
     */
    getUrl(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, expiresIn = 3600) {
            if (this.storageType === 'cloudinary') {
                // Cloudinary URLs are already accessible, just return them
                // For private files, would use cloudinary.utils.private_download_url() but PDF are already secure URLs
                return key;
            }
            else {
                // For local, return the URL directly (handled by Express static middleware)
                return key.startsWith('/') ? key : `/uploads/${key}`;
            }
        });
    }
    /**
     * Delete file by key
     * @deprecated Use deleteImage() instead, this is for backwards compat
     */
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.deleteImage(key);
        });
    }
    // ==================== CLOUDINARY METHODS ====================
    uploadToCloudinary(file, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield cloudinary_1.v2.uploader.upload(file.path, {
                    folder: `echatbot/${folder}`,
                    resource_type: 'image',
                    use_filename: true,
                    unique_filename: true,
                });
                // Delete temp file after upload
                fs_1.default.unlinkSync(file.path);
                logger_1.default.info(`☁️ Uploaded to Cloudinary: ${result.secure_url}`);
                return result.secure_url;
            }
            catch (error) {
                logger_1.default.error('❌ Cloudinary upload failed:', error);
                throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
            }
        });
    }
    deleteFromCloudinary(imageUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Extract public_id from Cloudinary URL
                // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/echatbot/products/image.jpg
                // public_id: echatbot/products/image
                const matches = imageUrl.match(/\/([^/]+\/[^/]+\/[^/.]+)\.[^.]+$/);
                if (!matches) {
                    logger_1.default.warn(`⚠️ Could not extract public_id from: ${imageUrl}`);
                    return;
                }
                const publicId = matches[1];
                yield cloudinary_1.v2.uploader.destroy(publicId);
                logger_1.default.info(`🗑️ Deleted from Cloudinary: ${publicId}`);
            }
            catch (error) {
                logger_1.default.error('❌ Cloudinary delete failed:', error);
                // Don't throw - image might already be deleted
            }
        });
    }
    // ==================== LOCAL FILESYSTEM METHODS ====================
    uploadToLocal(file, folder) {
        try {
            const folderPath = path_1.default.join(this.localUploadDir, folder);
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 8);
            const ext = path_1.default.extname(file.originalname);
            const filename = `${path_1.default.parse(file.originalname).name}_${timestamp}_${randomString}${ext}`;
            // Move file to destination
            const destPath = path_1.default.join(folderPath, filename);
            fs_1.default.renameSync(file.path, destPath);
            // Return relative URL (served by Express static middleware)
            const relativeUrl = `/uploads/${folder}/${filename}`;
            logger_1.default.info(`💾 Uploaded to local: ${relativeUrl}`);
            return relativeUrl;
        }
        catch (error) {
            logger_1.default.error('❌ Local upload failed:', error);
            throw new Error(`Failed to upload locally: ${error.message}`);
        }
    }
    deleteFromLocal(imageUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Convert URL to file path
                // Example: /uploads/products/image.jpg → /path/to/backend/uploads/products/image.jpg
                const relativePath = imageUrl.replace(/^\/uploads\//, '');
                const filePath = path_1.default.join(this.localUploadDir, relativePath);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                    logger_1.default.info(`🗑️ Deleted from local: ${filePath}`);
                }
            }
            catch (error) {
                logger_1.default.error('❌ Local delete failed:', error);
                // Don't throw - file might already be deleted
            }
        });
    }
    ensureLocalDirectories() {
        const folders = ['products', 'services', 'suppliers', 'users', 'channels'];
        folders.forEach(folder => {
            const folderPath = path_1.default.join(this.localUploadDir, folder);
            if (!fs_1.default.existsSync(folderPath)) {
                fs_1.default.mkdirSync(folderPath, { recursive: true });
            }
        });
    }
    // ==================== UTILITY METHODS ====================
    /**
     * Get storage type (local or cloudinary)
     */
    getStorageType() {
        return this.storageType;
    }
    /**
     * Check if running on Cloudinary
     */
    isCloudinary() {
        return this.storageType === 'cloudinary';
    }
}
// Export singleton instance
exports.storageService = new StorageService();
//# sourceMappingURL=storage.service.js.map