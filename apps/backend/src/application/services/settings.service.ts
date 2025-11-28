import fs from "fs";
import path from "path";
import { Settings } from "../../domain/entities/settings.entity";
import { ISettingsService } from "../../domain/services/settings.service.interface";
import { SettingsRepository } from "../../repositories/settings.repository";
import logger from "../../utils/logger";

/**
 * Service layer for Settings
 * Handles business logic for WhatsApp settings
 */
export class SettingsService implements ISettingsService {
  private repository: SettingsRepository;
  
  constructor() {
    this.repository = new SettingsRepository();
  }
  
  /**
   * Get settings for a workspace
   * @param workspaceId The workspace ID
   */
  async getSettings(workspaceId: string): Promise<Settings | null> {
    try {
      // Try to find existing settings
      const existingSettings = await this.repository.findByWorkspaceId(workspaceId);
      
      // If settings exist, return them
      if (existingSettings) {
        return existingSettings;
      }
      
      // If settings don't exist, create and return default settings
      const defaultSettings = new Settings({
        workspaceId,
        phoneNumber: '',
        apiKey: '',
        webhookUrl: '',
        settings: {},
        gdpr: await this.getDefaultGdprContent()
      });

      // Create settings in database but don't throw if it fails
      try {
        return await this.repository.create(defaultSettings);
      } catch (error) {
        logger.error(`Failed to create default settings: ${error.message}`);
        return defaultSettings;
      }
    } catch (error) {
      logger.error(`Error in getSettings: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Update settings for a workspace
   * @param workspaceId The workspace ID
   * @param data The settings data
   */
  async updateSettings(workspaceId: string, data: any): Promise<Settings | null> {
    try {
      // Try to find existing settings
      const existingSettings = await this.repository.findByWorkspaceId(workspaceId);
      
      if (existingSettings) {
        // Update existing settings
        return await this.repository.update(workspaceId, data);
      } else {
        // Create new settings with provided data
        const newSettings = new Settings({
          workspaceId,
          phoneNumber: data.phoneNumber || '',
          apiKey: data.apiKey || '',
          webhookUrl: data.webhookUrl || '',
          settings: data.settings || {},
          gdpr: data.gdpr || await this.getDefaultGdprContent()
        });
        
        return await this.repository.create(newSettings);
      }
    } catch (error) {
      logger.error(`Error in updateSettings: ${error.message}`);
      
      // Return a temporary settings object instead of throwing
      return new Settings({
        id: 'temp-id',
        workspaceId,
        phoneNumber: data.phoneNumber || '',
        apiKey: data.apiKey || '',
        webhookUrl: data.webhookUrl || '',
        settings: data.settings || {},
        gdpr: data.gdpr || await this.getDefaultGdprContent(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
  
  /**
   * Delete settings for a workspace
   * @param workspaceId The workspace ID
   */
  async deleteSettings(workspaceId: string): Promise<boolean> {
    try {
      return await this.repository.delete(workspaceId);
    } catch (error) {
      logger.error(`Error in deleteSettings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get GDPR content for a workspace
   * @param workspaceId The workspace ID
   */
  async getGdprContent(workspaceId: string): Promise<string | null> {
    try {
      return await this.repository.getGdprContent(workspaceId) || await this.getDefaultGdprContent();
    } catch (error) {
      logger.error(`Error in getGdprContent: ${error.message}`);
      return await this.getDefaultGdprContent();
    }
  }
  
  /**
   * Update GDPR content for a workspace
   * @param workspaceId The workspace ID
   * @param content The GDPR content
   */
  async updateGdprContent(workspaceId: string, content: string): Promise<Settings | null> {
    try {
      logger.info(`[GDPR SERVICE] Starting updateGdprContent for workspace: ${workspaceId}`);
      logger.info(`[GDPR SERVICE] Content length: ${content.length}`);
      
      const result = await this.repository.updateGdprContent(workspaceId, content);
      
      logger.info(`[GDPR SERVICE] Repository returned: ${result ? 'success' : 'null'}`);
      if (result) {
        logger.info(`[GDPR SERVICE] Result ID: ${result.id}, WorkspaceId: ${result.workspaceId}`);
        logger.info(`[GDPR SERVICE] Result GDPR length: ${result.gdpr ? result.gdpr.length : 'undefined'}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in updateGdprContent: ${error.message}`);
      
      // Return a temporary settings object instead of throwing
      return new Settings({
        id: 'temp-id',
        workspaceId,
        phoneNumber: '',
        apiKey: '',
        webhookUrl: '',
        settings: {},
        gdpr: content,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
  
  /**
   * Get default GDPR content from file
   */
  async getDefaultGdprContent(): Promise<string> {
    try {
      // Try to read the GDPR content from file
      const filePath = path.join(process.cwd(), '..', 'finalproject-AG', 'GDPR.md');
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (error) {
      // If file doesn't exist or can't be read, return default content
      logger.warn(`GDPR.md file not found, using default content ${error}`);
      return `# GDPR Compliance

## Privacy Policy

This is a default GDPR privacy policy for your application.

### Data Collection
We collect minimal data necessary for the functioning of our services.

### Data Usage
Your data is used solely for providing you with our services.

### Data Rights
You have the right to access, modify, or request deletion of your data.

### Contact
For any privacy-related inquiries, please contact us at support@example.com.`;
    }
  }
}

// Export a singleton instance for backward compatibility
export default new SettingsService(); 