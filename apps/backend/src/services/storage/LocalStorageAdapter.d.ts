import { IStorageService, UploadOptions, StorageFile } from './StorageService';
export declare class LocalStorageAdapter implements IStorageService {
    private baseDir;
    private baseUrl;
    constructor(baseDir?: string, baseUrl?: string);
    upload(buffer: Buffer, options: UploadOptions): Promise<StorageFile>;
    uploadFromPath(filePath: string, options: UploadOptions): Promise<StorageFile>;
    get(key: string): Promise<Buffer>;
    getUrl(key: string): Promise<string>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    list(folder: string): Promise<string[]>;
    private generateKey;
}
//# sourceMappingURL=LocalStorageAdapter.d.ts.map