import fs from 'fs/promises';
import path from 'path';
import { IStorageService, UploadOptions, StorageFile } from './StorageService';

export class LocalStorageAdapter implements IStorageService {
  private baseDir: string;
  private baseUrl: string;

  constructor(baseDir: string = './uploads', baseUrl: string = 'http://localhost:3001/uploads') {
    this.baseDir = baseDir;
    this.baseUrl = baseUrl;
  }

  async upload(buffer: Buffer, options: UploadOptions): Promise<StorageFile> {
    const key = this.generateKey(options);
    const filePath = path.join(this.baseDir, key);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    
    const stats = await fs.stat(filePath);
    
    return {
      url: `${this.baseUrl}/${key}`,
      key,
      size: stats.size,
      contentType: options.contentType || 'application/octet-stream'
    };
  }

  async uploadFromPath(filePath: string, options: UploadOptions): Promise<StorageFile> {
    const buffer = await fs.readFile(filePath);
    return this.upload(buffer, options);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, key);
    return fs.readFile(filePath);
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    await fs.unlink(filePath);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(folder: string): Promise<string[]> {
    const folderPath = path.join(this.baseDir, folder);
    try {
      const files = await fs.readdir(folderPath);
      return files.map(file => path.join(folder, file));
    } catch {
      return [];
    }
  }

  private generateKey(options: UploadOptions): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = options.filename || `file-${timestamp}-${random}`;
    const folder = options.folder || 'uploads';
    return path.join(folder, filename);
  }
}
