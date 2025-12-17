import { IStorageService, UploadOptions, StorageFile } from './StorageService';
export declare class S3StorageAdapter implements IStorageService {
    private s3Client;
    private bucketName;
    private region;
    constructor(bucketName: string, region?: string);
    upload(buffer: Buffer, options: UploadOptions): Promise<StorageFile>;
    uploadFromPath(filePath: string, options: UploadOptions): Promise<StorageFile>;
    get(key: string): Promise<Buffer>;
    getUrl(key: string, expiresIn?: number): Promise<string>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    list(folder: string): Promise<string[]>;
    private generateKey;
}
//# sourceMappingURL=S3StorageAdapter.d.ts.map