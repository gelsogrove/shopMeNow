/**
 * Storage Service Interface
 * Unified interface for file storage (local or S3)
 */
export interface UploadOptions {
    filename?: string;
    folder?: string;
    contentType?: string;
    isPublic?: boolean;
}
export interface StorageFile {
    url: string;
    key: string;
    size: number;
    contentType: string;
}
export interface IStorageService {
    upload(buffer: Buffer, options: UploadOptions): Promise<StorageFile>;
    uploadFromPath(filePath: string, options: UploadOptions): Promise<StorageFile>;
    get(key: string): Promise<Buffer>;
    getUrl(key: string, expiresIn?: number): Promise<string>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    list(folder: string): Promise<string[]>;
}
//# sourceMappingURL=StorageService.d.ts.map