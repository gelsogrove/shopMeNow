import { createStorageService, getStorageService } from '../index';
import { LocalStorageAdapter } from '../LocalStorageAdapter';
import { S3StorageAdapter } from '../S3StorageAdapter';

// Mock the adapters
jest.mock('../LocalStorageAdapter');
jest.mock('../S3StorageAdapter');

describe('Storage Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('createStorageService', () => {
    it('should return LocalStorageAdapter in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.UPLOADS_DIR = './custom-uploads';
      process.env.UPLOADS_URL = 'http://localhost:4000/uploads';

      // Re-import to get fresh instance
      jest.isolateModules(() => {
        const { createStorageService } = require('../index');
        const service = createStorageService();

        expect(LocalStorageAdapter).toHaveBeenCalledWith(
          './custom-uploads',
          'http://localhost:4000/uploads'
        );
      });
    });

    it('should return LocalStorageAdapter with defaults when env vars not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.UPLOADS_DIR;
      delete process.env.UPLOADS_URL;

      jest.isolateModules(() => {
        const { createStorageService } = require('../index');
        const service = createStorageService();

        expect(LocalStorageAdapter).toHaveBeenCalledWith(
          './uploads',
          'http://localhost:3001/uploads'
        );
      });
    });

    it('should return S3StorageAdapter in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.AWS_S3_BUCKET = 'my-prod-bucket';
      process.env.AWS_REGION = 'us-east-1';

      jest.isolateModules(() => {
        const { createStorageService } = require('../index');
        const service = createStorageService();

        expect(S3StorageAdapter).toHaveBeenCalledWith(
          'my-prod-bucket',
          'us-east-1'
        );
      });
    });

    it('should use default S3 values when env vars not set in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AWS_S3_BUCKET;
      delete process.env.AWS_REGION;

      jest.isolateModules(() => {
        const { createStorageService } = require('../index');
        const service = createStorageService();

        expect(S3StorageAdapter).toHaveBeenCalledWith(
          'echatbot-uploads-prod',
          'eu-west-1'
        );
      });
    });

    it('should return LocalStorageAdapter when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;

      jest.isolateModules(() => {
        const { createStorageService } = require('../index');
        const service = createStorageService();

        expect(LocalStorageAdapter).toHaveBeenCalled();
        expect(S3StorageAdapter).not.toHaveBeenCalled();
      });
    });
  });

  describe('getStorageService (singleton)', () => {
    it('should return the same instance on multiple calls', () => {
      process.env.NODE_ENV = 'test';

      jest.isolateModules(() => {
        const { getStorageService } = require('../index');
        
        const instance1 = getStorageService();
        const instance2 = getStorageService();

        // LocalStorageAdapter should be called only once
        expect(LocalStorageAdapter).toHaveBeenCalledTimes(1);
      });
    });
  });
});
