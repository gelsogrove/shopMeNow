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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unusedImagesCleanupJob = unusedImagesCleanupJob;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cloudinary_1 = require("cloudinary");
/**
 * Unused Images Cleanup Job
 * Runs daily at 23:02
 * Deletes orphaned images not referenced in the database
 * Covers: products, services, suppliers, users, channels (logos)
 *
 * ⚙️ BEHAVIOR:
 * - Production (CLOUDINARY_URL set): Deletes from Cloudinary
 * - Development (local): Deletes from uploads/ folder
 */
async function unusedImagesCleanupJob() {
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'backend', 'uploads');
    const isProduction = !!process.env.CLOUDINARY_URL;
    logger_1.default.info(`🧹 [Unused Images Cleanup] Starting cleanup (${isProduction ? 'CLOUDINARY' : 'LOCAL'})`);
    // Configure Cloudinary if in production
    if (isProduction) {
        const cloudinaryUrl = process.env.CLOUDINARY_URL;
        const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
        if (!match) {
            logger_1.default.error('❌ Invalid CLOUDINARY_URL format - skipping cleanup');
            return;
        }
        const [, api_key, api_secret, cloud_name] = match;
        cloudinary_1.v2.config({ cloud_name, api_key, api_secret });
        logger_1.default.info(`✅ Cloudinary configured: ${cloud_name}`);
    }
    let totalDeleted = 0;
    // ═══════════════════════════════════════════════════════════════
    // 1. PRODUCT IMAGES CLEANUP
    // ═══════════════════════════════════════════════════════════════
    const productImagesDir = path.join(uploadsDir, 'products');
    const products = await database_1.prisma.products.findMany({
        select: { imageUrl: true },
    });
    const usedProductImages = new Set();
    for (const product of products) {
        if (product.imageUrl && product.imageUrl.length > 0) {
            for (const url of product.imageUrl) {
                const filename = path.basename(url);
                usedProductImages.add(filename);
            }
        }
    }
    logger_1.default.info(`[Products] Found ${usedProductImages.size} images referenced in database`);
    totalDeleted += await cleanupDirectory(productImagesDir, usedProductImages, 'products', 'products');
    // ═══════════════════════════════════════════════════════════════
    // 2. SERVICE IMAGES CLEANUP
    // ═══════════════════════════════════════════════════════════════
    const serviceImagesDir = path.join(uploadsDir, 'services');
    const services = await database_1.prisma.services.findMany({
        select: { imageUrl: true },
    });
    const usedServiceImages = new Set();
    for (const service of services) {
        if (service.imageUrl && service.imageUrl.length > 0) {
            for (const url of service.imageUrl) {
                const filename = path.basename(url);
                usedServiceImages.add(filename);
            }
        }
    }
    logger_1.default.info(`[Services] Found ${usedServiceImages.size} images referenced in database`);
    totalDeleted += await cleanupDirectory(serviceImagesDir, usedServiceImages, 'services', 'services');
    // ═══════════════════════════════════════════════════════════════
    // 3. USER LOGOS CLEANUP
    // ═══════════════════════════════════════════════════════════════
    const userImagesDir = path.join(uploadsDir, 'users');
    const users = await database_1.prisma.user.findMany({
        select: { logo: true },
    });
    const usedUserLogos = new Set();
    for (const user of users) {
        if (user.logo) {
            const filename = path.basename(user.logo);
            usedUserLogos.add(filename);
        }
    }
    logger_1.default.info(`[Users] Found ${usedUserLogos.size} logos referenced in database`);
    totalDeleted += await cleanupDirectory(userImagesDir, usedUserLogos, 'users', 'users');
    // ═══════════════════════════════════════════════════════════════
    // 4. CHANNEL LOGOS CLEANUP
    // ═══════════════════════════════════════════════════════════════
    const channelImagesDir = path.join(uploadsDir, 'channels');
    const workspaces = await database_1.prisma.workspace.findMany({
        select: { logoUrl: true },
    });
    const usedChannelLogos = new Set();
    for (const workspace of workspaces) {
        if (workspace.logoUrl) {
            const filename = path.basename(workspace.logoUrl);
            usedChannelLogos.add(filename);
        }
    }
    logger_1.default.info(`[Channels] Found ${usedChannelLogos.size} logos referenced in database`);
    totalDeleted += await cleanupDirectory(channelImagesDir, usedChannelLogos, 'channels', 'channels');
    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    logger_1.default.info(`✅ [Unused Images Cleanup] Total orphan files deleted: ${totalDeleted}`);
}
/**
 * Helper function to cleanup a directory
 * @param dir - Directory path to clean (local)
 * @param usedImages - Set of filenames that are in use
 * @param label - Label for logging
 * @param cloudinaryFolder - Cloudinary folder name (products, services, users, channels)
 * @returns Number of deleted files
 */
async function cleanupDirectory(dir, usedImages, label, cloudinaryFolder) {
    const isProduction = !!process.env.CLOUDINARY_URL;
    let deleted = 0;
    if (!isProduction) {
        // LOCAL MODE: Delete from filesystem
        if (!fs.existsSync(dir)) {
            logger_1.default.info(`[${label}] Directory not found: ${dir}`);
            return 0;
        }
        const files = fs.readdirSync(dir);
        for (const file of files) {
            // Skip hidden files and directories
            if (file.startsWith('.'))
                continue;
            const filePath = path.join(dir, file);
            // Skip directories
            if (fs.statSync(filePath).isDirectory())
                continue;
            if (!usedImages.has(file)) {
                try {
                    fs.unlinkSync(filePath);
                    deleted++;
                    logger_1.default.info(`[${label}] 🗑️ Deleted local orphan: ${file}`);
                }
                catch (error) {
                    logger_1.default.error(`[${label}] Failed to delete ${file}:`, error);
                }
            }
        }
    }
    else {
        // PRODUCTION MODE: Delete from Cloudinary
        try {
            // List all images in Cloudinary folder
            const result = await cloudinary_1.v2.api.resources({
                type: 'upload',
                prefix: `echatbot/${cloudinaryFolder}`,
                max_results: 500,
            });
            for (const resource of result.resources) {
                const filename = path.basename(resource.secure_url);
                if (!usedImages.has(filename)) {
                    try {
                        await cloudinary_1.v2.uploader.destroy(resource.public_id);
                        deleted++;
                        logger_1.default.info(`[${label}] ☁️ Deleted Cloudinary orphan: ${filename} (${resource.public_id})`);
                    }
                    catch (error) {
                        logger_1.default.error(`[${label}] Failed to delete ${filename} from Cloudinary:`, error);
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error(`[${label}] Failed to list Cloudinary images:`, error);
            return 0;
        }
    }
    logger_1.default.info(`[${label}] Deleted ${deleted} orphan files`);
    return deleted;
}
//# sourceMappingURL=unused-images-cleanup.job.js.map