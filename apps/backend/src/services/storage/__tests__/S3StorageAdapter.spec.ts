import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageAdapter } from '../S3StorageAdapter';
import { Readable } from 'stream';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

const mockSend = jest.fn();
const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;

describe('S3StorageAdapter', () => {
  const bucketName = 'test-bucket';
  const region = 'eu-west-1';
  let adapter: S3StorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    MockS3Client.prototype.send = mockSend;
    adapter = new S3StorageAdapter(bucketName, region);
  });

  describe('upload', () => {
    it('should upload buffer to S3 with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('test content');
      const options = {
        filename: 'test-file.txt',
        folder: 'products/workspace-123',
        contentType: 'text/plain',
        isPublic: true
      };

      const result = await adapter.upload(buffer, options);

      // Verify S3 PutObjectCommand was called
      expect(mockSend).toHaveBeenCalledTimes(1);
      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand).toBeInstanceOf(PutObjectCommand);
      expect(putCommand.input).toMatchObject({
        Bucket: bucketName,
        Body: buffer,
        ContentType: 'text/plain',
        ACL: 'public-read'
      });
      expect(putCommand.input.Key).toContain('products/workspace-123');

      // Verify result
      expect(result).toMatchObject({
        size: buffer.length,
        contentType: 'text/plain'
      });
      expect(result.url).toContain(bucketName);
      expect(result.key).toContain('products/workspace-123');
    });

    it('should upload private file without public-read ACL', async () => {
      mockSend.mockResolvedValueOnce({});
      (getSignedUrl as jest.Mock).mockResolvedValueOnce('https://signed-url.com/file');

      const buffer = Buffer.from('private content');
      const options = {
        filename: 'private-file.pdf',
        folder: 'invoices',
        contentType: 'application/pdf',
        isPublic: false
      };

      const result = await adapter.upload(buffer, options);

      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.ACL).toBe('private');
      expect(result.url).toBe('https://signed-url.com/file');
    });

    it('should generate unique key if filename not provided', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('auto named');
      const options = { folder: 'auto', isPublic: true };

      const result = await adapter.upload(buffer, options);

      expect(result.key).toMatch(/auto\/file-\d+-[a-z0-9]+/);
    });
  });

  describe('get', () => {
    it('should retrieve file content from S3', async () => {
      const content = 'retrieved content';
      const mockStream = Readable.from([Buffer.from(content)]);
      mockSend.mockResolvedValueOnce({ Body: mockStream });

      const result = await adapter.get('folder/file.txt');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const getCommand = mockSend.mock.calls[0][0];
      expect(getCommand).toBeInstanceOf(GetObjectCommand);
      expect(getCommand.input).toMatchObject({
        Bucket: bucketName,
        Key: 'folder/file.txt'
      });

      expect(result.toString()).toBe(content);
    });
  });

  describe('getUrl', () => {
    it('should return signed URL with default expiration', async () => {
      const signedUrl = 'https://bucket.s3.amazonaws.com/file?signature=abc';
      (getSignedUrl as jest.Mock).mockResolvedValueOnce(signedUrl);

      const result = await adapter.getUrl('folder/file.txt');

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
      expect(result).toBe(signedUrl);
    });

    it('should use custom expiration time', async () => {
      const signedUrl = 'https://bucket.s3.amazonaws.com/file?signature=xyz';
      (getSignedUrl as jest.Mock).mockResolvedValueOnce(signedUrl);

      const result = await adapter.getUrl('folder/file.txt', 7200);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 7200 }
      );
      expect(result).toBe(signedUrl);
    });
  });

  describe('delete', () => {
    it('should delete file from S3', async () => {
      mockSend.mockResolvedValueOnce({});

      await adapter.delete('folder/file-to-delete.txt');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const deleteCommand = mockSend.mock.calls[0][0];
      expect(deleteCommand).toBeInstanceOf(DeleteObjectCommand);
      expect(deleteCommand.input).toMatchObject({
        Bucket: bucketName,
        Key: 'folder/file-to-delete.txt'
      });
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await adapter.exists('folder/existing-file.txt');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const headCommand = mockSend.mock.calls[0][0];
      expect(headCommand).toBeInstanceOf(HeadObjectCommand);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      const result = await adapter.exists('folder/non-existent.txt');

      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should list files in folder', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'folder/file1.txt' },
          { Key: 'folder/file2.txt' },
          { Key: 'folder/subfolder/file3.txt' }
        ]
      });

      const result = await adapter.list('folder');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const listCommand = mockSend.mock.calls[0][0];
      expect(listCommand).toBeInstanceOf(ListObjectsV2Command);
      expect(listCommand.input).toMatchObject({
        Bucket: bucketName,
        Prefix: 'folder'
      });

      expect(result).toEqual([
        'folder/file1.txt',
        'folder/file2.txt',
        'folder/subfolder/file3.txt'
      ]);
    });

    it('should return empty array for empty folder', async () => {
      mockSend.mockResolvedValueOnce({ Contents: undefined });

      const result = await adapter.list('empty-folder');

      expect(result).toEqual([]);
    });
  });
});
