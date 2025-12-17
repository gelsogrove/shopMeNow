import cron from 'node-cron';
import { prisma } from '@echatbot/database';

// Storage service interface for cleanup operations
interface IStorageService {
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

// Simple storage service implementation for scheduler
// This avoids importing from backend which causes rootDir issues
function getStorageService(): IStorageService {
  const storageType = process.env.STORAGE_TYPE || 'local';
  
  if (storageType === 's3') {
    // For S3, we'd need AWS SDK - for now just log and skip
    console.warn('⚠️ S3 storage cleanup not yet implemented in scheduler');
    return {
      list: async () => [],
      delete: async () => {},
    };
  }
  
  // Local storage implementation
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../../../backend/uploads');
  
  return {
    list: async (prefix: string): Promise<string[]> => {
      const dir = path.join(uploadsDir, prefix);
      if (!fs.existsSync(dir)) return [];
      
      const files: string[] = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile()) {
          files.push(`${prefix}/${item.name}`);
        } else if (item.isDirectory()) {
          const subFiles = await listRecursive(path.join(dir, item.name), `${prefix}/${item.name}`);
          files.push(...subFiles);
        }
      }
      return files;
      
      async function listRecursive(dirPath: string, prefix: string): Promise<string[]> {
        const result: string[] = [];
        if (!fs.existsSync(dirPath)) return result;
        
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile()) {
            result.push(`${prefix}/${item.name}`);
          } else if (item.isDirectory()) {
            const subFiles = await listRecursive(path.join(dirPath, item.name), `${prefix}/${item.name}`);
            result.push(...subFiles);
          }
        }
        return result;
      }
    },
    delete: async (key: string): Promise<void> => {
      const filePath = path.join(uploadsDir, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },
  };
}

/**
 * Job 1: Cleanup Orphaned Files
 * Runs every night at 03:00
 */
export function setupOrphanedFilesCleanup() {
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Starting orphaned files cleanup...');
    
    try {
      const storage = getStorageService();
      let totalDeleted = 0;

      // Cleanup products
      const productFiles = await storage.list('products');
      const activeProducts = await prisma.products.findMany({
        select: { imageKey: true }
      });
      const activeProductKeys = activeProducts
        .map(p => p.imageKey)
        .filter(Boolean);
      
      for (const file of productFiles) {
        if (!activeProductKeys.includes(file)) {
          await storage.delete(file);
          totalDeleted++;
          console.log(`🗑️ Deleted orphaned product image: ${file}`);
        }
      }

      // Cleanup services
      const serviceFiles = await storage.list('services');
      const activeServices = await prisma.services.findMany({
        select: { imageKey: true }
      });
      const activeServiceKeys = activeServices
        .map(s => s.imageKey)
        .filter(Boolean);
      
      for (const file of serviceFiles) {
        if (!activeServiceKeys.includes(file)) {
          await storage.delete(file);
          totalDeleted++;
          console.log(`🗑️ Deleted orphaned service image: ${file}`);
        }
      }

      // Cleanup workspaces
      const workspaceFiles = await storage.list('workspaces');
      const activeWorkspaces = await prisma.workspace.findMany({
        select: { logoKey: true }
      });
      const activeWorkspaceKeys = activeWorkspaces
        .map(w => w.logoKey)
        .filter(Boolean);
      
      for (const file of workspaceFiles) {
        if (!activeWorkspaceKeys.includes(file)) {
          await storage.delete(file);
          totalDeleted++;
          console.log(`🗑️ Deleted orphaned workspace logo: ${file}`);
        }
      }

      console.log(`✅ Orphaned files cleanup completed: ${totalDeleted} files deleted`);
    } catch (error) {
      console.error('❌ Orphaned files cleanup failed:', error);
    }
  });
}

/**
 * Job 2: Cleanup Temp Files
 * Runs every hour
 */
export function setupTempFilesCleanup() {
  cron.schedule('0 * * * *', async () => {
    console.log('🧹 Starting temp files cleanup...');
    
    try {
      const storage = getStorageService();
      const tempFiles = await storage.list('temp');
      
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      let deleted = 0;
      for (const file of tempFiles) {
        const filename = file.split('/').pop();
        if (!filename) continue;
        
        const timestamp = parseInt(filename.split('-')[0]);
        if (isNaN(timestamp)) continue;
        
        const age = now - timestamp;
        if (age > maxAge) {
          await storage.delete(file);
          deleted++;
        }
      }
      
      console.log(`✅ Temp files cleanup completed: ${deleted} files deleted`);
    } catch (error) {
      console.error('❌ Temp files cleanup failed:', error);
    }
  });
}

/**
 * Job 3: Cleanup Cancelled Order Invoices
 * Runs every night at 04:00
 */
export function setupInvoiceCleanup() {
  cron.schedule('0 4 * * *', async () => {
    console.log('🧹 Starting invoice cleanup...');
    
    try {
      const storage = getStorageService();
      
      const cancelledOrders = await prisma.orders.findMany({
        where: {
          status: 'CANCELLED',
          invoiceKey: { not: null }
        }
      });
      
      let deleted = 0;
      for (const order of cancelledOrders) {
        if (order.invoiceKey) {
          await storage.delete(order.invoiceKey);
          
          await prisma.orders.update({
            where: { id: order.id },
            data: {
              invoiceUrl: null,
              invoiceKey: null
            }
          });
          
          deleted++;
          console.log(`🗑️ Deleted invoice for cancelled order: ${order.orderCode}`);
        }
      }
      
      console.log(`✅ Invoice cleanup completed: ${deleted} invoices deleted`);
    } catch (error) {
      console.error('❌ Invoice cleanup failed:', error);
    }
  });
}

export function setupStorageCleanup() {
  console.log('📦 Setting up storage cleanup jobs...');
  setupOrphanedFilesCleanup();
  setupTempFilesCleanup();
  setupInvoiceCleanup();
  console.log('✅ Storage cleanup jobs configured');
}
