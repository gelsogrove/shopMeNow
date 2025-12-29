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
type StorageType = 'local' | 'cloudinary';
type Folder = 'products' | 'services' | 'suppliers' | 'users' | 'channels';
declare class StorageService {
    private storageType;
    private localUploadDir;
    constructor();
    /**
     * Upload image to storage
     * @param file Express.Multer.File object
     * @param folder Folder name (products, services, etc.)
     * @returns Public URL of uploaded image
     */
    uploadImage(file: Express.Multer.File, folder: Folder): Promise<string>;
    /**
     * Delete image from storage
     * @param imageUrl Full URL or path to image
     */
    deleteImage(imageUrl: string): Promise<void>;
    /**
     * Upload multiple images (array of files)
     */
    uploadImages(files: Express.Multer.File[], folder: Folder): Promise<string[]>;
    /**
     * Delete multiple images (array of URLs)
     */
    deleteImages(imageUrls: string[]): Promise<void>;
    /**
     * List all images in a folder
     * @param folder Folder name (products, services, users, channels)
     * @returns Array of image objects with url and publicId
     */
    listImages(folder: Folder): Promise<Array<{
        url: string;
        publicId: string;
    }>>;
    /**
     * Upload raw buffer (for PDFs, etc.)
     * @deprecated Use uploadImage() for images, this is for PDF/documents only
     */
    upload(buffer: Buffer, options: {
        filename: string;
        folder: string;
        contentType: string;
        isPublic?: boolean;
    }): Promise<{
        url: string;
        key: string;
    }>;
    /**
     * Get file as buffer
     * @deprecated Legacy method for InvoiceService
     */
    get(key: string): Promise<Buffer>;
    /**
     * Get signed/public URL for file
     * @deprecated Legacy method for InvoiceService
     */
    getUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * Delete file by key
     * @deprecated Use deleteImage() instead, this is for backwards compat
     */
    delete(key: string): Promise<void>;
    private uploadToCloudinary;
    private deleteFromCloudinary;
    private uploadToLocal;
    private deleteFromLocal;
    private listFromCloudinary;
    private listFromLocal;
    private ensureLocalDirectories;
    /**
     * Get storage type (local or cloudinary)
     */
    getStorageType(): StorageType;
    /**
     * Check if running on Cloudinary
     */
    isCloudinary(): boolean;
}
export declare const storageService: StorageService;
export {};
//# sourceMappingURL=storage.service.d.ts.map