import { IStorageService } from './StorageService';
/**
 * Storage Factory
 * Automatically selects the right storage adapter based on NODE_ENV
 */
export declare function createStorageService(): IStorageService;
export declare function getStorageService(): IStorageService;
export * from './StorageService';
export { LocalStorageAdapter } from './LocalStorageAdapter';
export { S3StorageAdapter } from './S3StorageAdapter';
//# sourceMappingURL=index.d.ts.map