import { IStorageService } from './StorageService';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { S3StorageAdapter } from './S3StorageAdapter';

/**
 * Storage Factory
 * Automatically selects the right storage adapter based on NODE_ENV
 */
export function createStorageService(): IStorageService {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    // Production: Use S3
    const bucketName = process.env.AWS_S3_BUCKET || 'echatbot-uploads-prod';
    const region = process.env.AWS_REGION || 'eu-west-1';
    
    console.log(`📦 Storage: S3 (bucket: ${bucketName}, region: ${region})`);
    return new S3StorageAdapter(bucketName, region);
  } else {
    // Development: Use local filesystem
    const baseDir = process.env.UPLOADS_DIR || './uploads';
    const baseUrl = process.env.UPLOADS_URL || 'http://localhost:3001/uploads';
    
    console.log(`📦 Storage: Local (dir: ${baseDir})`);
    return new LocalStorageAdapter(baseDir, baseUrl);
  }
}

// Singleton instance
let storageInstance: IStorageService | null = null;

export function getStorageService(): IStorageService {
  if (!storageInstance) {
    storageInstance = createStorageService();
  }
  return storageInstance;
}

// Export types
export * from './StorageService';
export { LocalStorageAdapter } from './LocalStorageAdapter';
export { S3StorageAdapter } from './S3StorageAdapter';
