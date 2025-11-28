import { Settings } from "../entities/settings.entity";

/**
 * Interface for Settings Service
 */
export interface ISettingsService {
  /**
   * Get settings for a workspace
   * @param workspaceId The workspace ID
   */
  getSettings(workspaceId: string): Promise<Settings | null>;

  /**
   * Update settings for a workspace
   * @param workspaceId The workspace ID
   * @param data The settings data
   */
  updateSettings(workspaceId: string, data: any): Promise<Settings | null>;

  /**
   * Delete settings for a workspace
   * @param workspaceId The workspace ID
   */
  deleteSettings(workspaceId: string): Promise<boolean>;

  /**
   * Get GDPR content for a workspace
   * @param workspaceId The workspace ID
   */
  getGdprContent(workspaceId: string): Promise<string | null>;

  /**
   * Update GDPR content for a workspace
   * @param workspaceId The workspace ID
   * @param content The GDPR content
   */
  updateGdprContent(workspaceId: string, content: string): Promise<Settings | null>;

  /**
   * Get default GDPR content
   */
  getDefaultGdprContent(): Promise<string>;
} 