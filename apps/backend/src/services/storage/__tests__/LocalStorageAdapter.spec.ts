import fs from 'fs/promises';
import path from 'path';
import { LocalStorageAdapter } from '../LocalStorageAdapter';

describe('LocalStorageAdapter', () => {
  const testDir = './test-uploads';
  const testUrl = 'http://localhost:3001/test-uploads';
  let adapter: LocalStorageAdapter;

  beforeAll(async () => {
    adapter = new LocalStorageAdapter(testDir, testUrl);
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('upload', () => {
    it('should upload a buffer and return StorageFile', async () => {
      const buffer = Buffer.from('test content');
      const options = {
        filename: 'test-file.txt',
        folder: 'test-folder',
        contentType: 'text/plain'
      };

      const result = await adapter.upload(buffer, options);

      expect(result).toMatchObject({
        key: expect.stringContaining('test-folder'),
        url: expect.stringContaining(testUrl),
        size: buffer.length,
        contentType: 'text/plain'
      });

      // Verify file exists
      const exists = await adapter.exists(result.key);
      expect(exists).toBe(true);
    });

    it('should generate unique key if filename not provided', async () => {
      const buffer = Buffer.from('test content');
      const options = { folder: 'auto-named' };

      const result = await adapter.upload(buffer, options);

      expect(result.key).toContain('auto-named');
      expect(result.key).toMatch(/file-\d+-[a-z0-9]+/);
    });

    it('should create nested directories', async () => {
      const buffer = Buffer.from('nested content');
      const options = {
        filename: 'deep-file.txt',
        folder: 'level1/level2/level3'
      };

      const result = await adapter.upload(buffer, options);

      expect(result.key).toContain('level1/level2/level3');
      const exists = await adapter.exists(result.key);
      expect(exists).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve uploaded file content', async () => {
      const content = 'content to retrieve';
      const buffer = Buffer.from(content);
      const options = { filename: 'retrieve-test.txt', folder: 'get-test' };

      const uploaded = await adapter.upload(buffer, options);
      const retrieved = await adapter.get(uploaded.key);

      expect(retrieved.toString()).toBe(content);
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.get('non-existent/file.txt')).rejects.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return correct URL for key', async () => {
      const key = 'folder/file.txt';
      const url = await adapter.getUrl(key);

      expect(url).toBe(`${testUrl}/${key}`);
    });
  });

  describe('delete', () => {
    it('should delete uploaded file', async () => {
      const buffer = Buffer.from('to delete');
      const options = { filename: 'delete-me.txt', folder: 'delete-test' };

      const uploaded = await adapter.upload(buffer, options);
      
      // Verify exists
      let exists = await adapter.exists(uploaded.key);
      expect(exists).toBe(true);

      // Delete
      await adapter.delete(uploaded.key);

      // Verify deleted
      exists = await adapter.exists(uploaded.key);
      expect(exists).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const buffer = Buffer.from('exists test');
      const options = { filename: 'exists.txt', folder: 'exists-test' };

      const uploaded = await adapter.upload(buffer, options);
      const exists = await adapter.exists(uploaded.key);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await adapter.exists('does-not-exist/file.txt');
      expect(exists).toBe(false);
    });
  });

  describe('list', () => {
    it('should list files in folder', async () => {
      const folder = 'list-test';
      
      // Upload multiple files
      await adapter.upload(Buffer.from('file1'), { filename: 'file1.txt', folder });
      await adapter.upload(Buffer.from('file2'), { filename: 'file2.txt', folder });
      await adapter.upload(Buffer.from('file3'), { filename: 'file3.txt', folder });

      const files = await adapter.list(folder);

      expect(files.length).toBe(3);
      expect(files).toContain(path.join(folder, 'file1.txt'));
      expect(files).toContain(path.join(folder, 'file2.txt'));
      expect(files).toContain(path.join(folder, 'file3.txt'));
    });

    it('should return empty array for non-existent folder', async () => {
      const files = await adapter.list('non-existent-folder');
      expect(files).toEqual([]);
    });
  });
});
