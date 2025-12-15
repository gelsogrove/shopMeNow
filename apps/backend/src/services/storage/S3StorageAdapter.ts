import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService, UploadOptions, StorageFile } from './StorageService';
import fs from 'fs/promises';

export class S3StorageAdapter implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(bucketName: string, region: string = 'eu-west-1') {
    this.bucketName = bucketName;
    this.region = region;
    this.s3Client = new S3Client({ region });
  }

  async upload(buffer: Buffer, options: UploadOptions): Promise<StorageFile> {
    const key = this.generateKey(options);
    
    const command = new PutObjectCommand({
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

  async uploadFromPath(filePath: string, options: UploadOptions): Promise<StorageFile> {
    const buffer = await fs.readFile(filePath);
    return this.upload(buffer, options);
  }

  async get(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  async getUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    await this.s3Client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async list(folder: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: folder
    });

    const response = await this.s3Client.send(command);
    return response.Contents?.map(obj => obj.Key!) || [];
  }

  private generateKey(options: UploadOptions): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = options.filename || `file-${timestamp}-${random}`;
    const folder = options.folder || 'uploads';
    return `${folder}/${filename}`;
  }
}
